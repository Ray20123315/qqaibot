import fs from 'node:fs';
import { honorMapFromResponse, injectMemberCleanupClient, normalizeFullMember, normalizeSex } from './src/portal/member-cleanup.js';
import { injectPortalMembersClient } from './src/portal/members.js';

function assert(condition, message) { if (!condition) throw new Error(message); }
assert(normalizeSex('男') === 'male' && normalizeSex(2) === 'female' && normalizeSex('unknown') === 'unknown', 'Sex aliases must normalize');
const normalized = normalizeFullMember({ user_id: '10001', sex: '女', age: 18, province: '台灣', city: '台北', title: '', title_expire_time: 0 });
assert(normalized.sex === 'female' && normalized.area.includes('台北'), 'Compatible demographic fields must normalize');
assert(normalized.titleStatus === 'none' && normalized.titleExpireTime === 0, 'No title must be not-applicable rather than ambiguous expiry');
const honors = honorMapFromResponse({ data: { currentTalkative: { user_id: 1 }, performerList: [{ user_id: 2 }] } });
assert(honors.get('1')?.[0]?.type === 'current_talkative' && honors.get('2')?.[0]?.type === 'performer', 'Honor camelCase aliases must parse');
const cleanupSource = fs.readFileSync('src/portal/member-cleanup.js', 'utf8');
assert(cleanupSource.includes('get_stranger_info'), 'Deep sync must use stranger fallback');
assert(cleanupSource.includes('preserveEnrichedMember'), 'Fast sync must preserve enriched fields');
assert(cleanupSource.includes('deepSyncAll'), 'Portal must support all-member batched completion');
assert(cleanupSource.includes('平台未提供'), 'Missing fields must be labeled honestly');
const base = '<!doctype html><html><head></head><body><nav><button data-view="logs">操作日志</button></nav><main><section id="v-logs"></section></main></body></html>';
const html = injectPortalMembersClient(base);
for (const id of ['v-members','v-member-actions','v-relationships','v-member-data','v-member-cleanup']) assert(html.includes('id="'+id+'"'), 'Missing split view '+id);
for (const glyph of ['友','禁','关','资','清']) assert(html.includes('qqai-nav-glyph') && html.includes('>'+glyph+'<'), 'Missing nav glyph '+glyph);
assert(html.includes('memberDataRoot') === false && html.includes('memberDataList'), 'Member data root must be populated');
for (const match of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)) new Function(match[1]);
const werewolfSource = fs.readFileSync('src/games/werewolf.js', 'utf8');
assert(werewolfSource.includes('qqai-nav-glyph') && werewolfSource.includes('>狼<'), 'Werewolf nav must have explicit glyph');
const pkg = JSON.parse(fs.readFileSync('package.json','utf8'));
assert(pkg.version === '2.7.2' && pkg.scripts.check.includes('verify-member-console-split.mjs'), 'v2.7.2 permanent check must be registered');
console.log('verify-member-console-split: ok');
