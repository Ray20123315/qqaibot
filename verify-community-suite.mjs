import fs from 'node:fs';
import vm from 'node:vm';
import { injectPortalMembersClient } from './src/portal/members.js';
import { DEFAULT_STICKER_CATEGORIES, stickerCategoryForText, stickerCqMessage } from './src/social/sticker-library.js';
import { MASTER_RELATIONSHIP_DEFAULTS } from './src/moderation/partner-bindings.js';

function assert(condition, message) { if (!condition) throw new Error(message); }

const baseHtml = '<!doctype html><html><head></head><body><aside><nav><button data-view="home">首页</button><button data-view="logs">操作日志</button></nav></aside><main><section id="v-home" class="view active"></section><section id="v-logs" class="view"></section></main></body></html>';
const html = injectPortalMembersClient(baseHtml);
assert(html.includes('id="memberConsoleNav"'), 'The member console navigation entry must always be injected');
assert(!html.includes("function syncNav()"), 'The injected client must not hide the member entry by guessing a private session variable');
assert(html.includes('qqai-community-suite-client'), 'The Portal community suite client must be injected');
assert(html.includes('Portal 自我诊断'), 'Diagnostics UI must be present');
assert(html.includes('批量管理'), 'Batch management UI must be present');
assert(html.includes('表情库'), 'Sticker library UI must be present');
assert(html.includes('AI 决策回放'), 'Decision replay UI must be present');

const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map(match => match[1]);
assert(scripts.length >= 2, 'Both member console and community suite browser clients must be generated');
for (const [index, script] of scripts.entries()) {
  try { new vm.Script(script, { filename: `portal-script-${index}.js` }); }
  catch (error) { throw new Error(`Generated Portal script ${index} is invalid: ${error.message}`); }
}

const members = fs.readFileSync('src/portal/members.js', 'utf8');
assert(members.includes('handleCommunitySuiteApi'), 'Member API must delegate to the community suite');
assert(members.includes('injectCommunitySuiteClient'), 'Member HTML must include the community suite');
assert(members.includes('const navFallbacks'), 'Member navigation injection must have multiple fallback anchors');

const suite = fs.readFileSync('src/portal/community-suite.js', 'utf8');
for (const marker of ['/members/diagnostics', '/members/profiles', '/members/profile', '/members/batch', '/members/stickers', '/members/decisions', '/members/relationships/policy']) {
  assert(suite.includes(marker), `Community suite route missing: ${marker}`);
}
assert(suite.includes('aiUseAllowed'), 'Member notes must control whether AI may use them');
assert(suite.includes('increase_penalty'), 'Batch review must support increased punishment classification');
assert(suite.includes('listAiDecisionLogs'), 'Decision replay must use the permanent AI decision log');

assert(DEFAULT_STICKER_CATEGORIES.includes('抱抱'), 'Sticker defaults must include hug reactions');
assert(stickerCategoryForText('？？？') === '疑惑', 'Punctuation reactions must map to the question sticker category');
assert(stickerCategoryForText('抱抱') === '抱抱', 'Hug actions must map to hug stickers');
assert(stickerCqMessage({ file: 'https://example.com/a.png' }).includes('[CQ:image'), 'Sticker messages must use OneBot CQ images');

assert(MASTER_RELATIONSHIP_DEFAULTS.kick === false, 'Master kick permission must default to disabled');
assert(MASTER_RELATIONSHIP_DEFAULTS.maxMuteSeconds === 1800, 'Master mute must default to a 30 minute maximum');

const worker = fs.readFileSync('worker.js', 'utf8');
assert(worker.includes('pickStickerForText'), 'Worker must support short-message sticker reactions');
assert(worker.includes('!表情'), 'Worker must expose the manual sticker command');
assert(worker.includes('主人权限未开放禁言'), 'Worker must enforce master mute permission');
assert(worker.includes('主人权限未开放踢出'), 'Worker must enforce master kick permission');
assert(worker.includes('maxMuteSeconds'), 'Worker must enforce the master mute duration limit');

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
assert(pkg.version === '2.5.0', 'Package version must be 2.5.0');
assert(pkg.scripts.check.includes('verify-community-suite.mjs'), 'Community suite verification must run permanently');
console.log('verify-community-suite: ok');
