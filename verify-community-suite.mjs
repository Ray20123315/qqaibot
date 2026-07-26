import fs from 'node:fs';
import vm from 'node:vm';
import { injectPortalMembersClient } from './src/portal/members.js';
import { DEFAULT_STICKER_CATEGORIES, stickerCategoryForText, stickerCqMessage } from './src/social/sticker-library.js';
import { MASTER_RELATIONSHIP_DEFAULT_LEVEL, MASTER_RELATIONSHIP_LEVELS, masterPermissionsForLevel } from './src/moderation/partner-bindings.js';

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
  try {
    new vm.Script(script, { filename: `portal-script-${index}.js` });
  } catch (error) {
    fs.writeFileSync('portal-generated.html', html);
    fs.writeFileSync(`portal-script-${index}.js`, script);
    fs.writeFileSync('portal-script-error.log', `script=${index}\n${error.stack || error.message}\n`);
    throw new Error(`Generated Portal script ${index} is invalid: ${error.message}`);
  }
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
assert(suite.includes('pol-level'), 'Portal must configure master relationships by level');
assert(!suite.includes('pol-kick'), 'Portal must not expose a master kick permission');

assert(DEFAULT_STICKER_CATEGORIES.includes('抱抱'), 'Sticker defaults must include hug reactions');
assert(stickerCategoryForText('？？？') === '疑惑', 'Punctuation reactions must map to the question sticker category');
assert(stickerCategoryForText('抱抱') === '抱抱', 'Hug actions must map to hug stickers');
assert(stickerCqMessage({ file: 'https://example.com/a.png' }).includes('[CQ:image'), 'Sticker messages must use OneBot CQ images');

assert(MASTER_RELATIONSHIP_DEFAULT_LEVEL === 1, 'New master relationships must start at level 1');
assert(Object.keys(MASTER_RELATIONSHIP_LEVELS).length === 4, 'Master relationships must have four levels');
assert(masterPermissionsForLevel(1).mute && !masterPermissionsForLevel(1).unmute, 'Level 1 must only unlock mute');
assert(masterPermissionsForLevel(2).unmute && !masterPermissionsForLevel(2).recall, 'Level 2 must unlock unmute');
assert(masterPermissionsForLevel(3).recall && !masterPermissionsForLevel(3).rename, 'Level 3 must unlock recall');
assert(masterPermissionsForLevel(4).rename, 'Level 4 must unlock rename');
assert(Object.values(MASTER_RELATIONSHIP_LEVELS).every(level => level.kick === false), 'No master level may grant kick permission');
assert(masterPermissionsForLevel(1).maxMuteSeconds === 60 && masterPermissionsForLevel(4).maxMuteSeconds === 7200, 'Mute limits must scale with master level');

const worker = fs.readFileSync('worker.js', 'utf8');
assert(worker.includes('pickStickerForText'), 'Worker must support short-message sticker reactions');
assert(worker.includes('!表情'), 'Worker must expose the manual sticker command');
assert(worker.includes('主人权限未开放禁言'), 'Worker must enforce master mute permission');
assert(worker.includes('主人关系任何等级都没有踢出权限'), 'Worker must permanently reject master kick commands');
assert(!worker.includes('master_member_kicked'), 'Master relationship code must not execute kick actions');
assert(worker.includes('maxMuteSeconds'), 'Worker must enforce the master mute duration limit');
assert(worker.includes('【管理层群友资料｜仅供内部判断，严禁公开】'), 'Approved member notes must reach the AI context');
assert(worker.includes('memberProfile.aiUseAllowed !== false'), 'The AI context must honor the member-note opt-out');

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
assert(pkg.version === '2.7.1', 'Package version must be 2.5.2');
assert(pkg.scripts.check.includes('verify-community-suite.mjs'), 'Community suite verification must run permanently');
console.log('verify-community-suite: ok');
