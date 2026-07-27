import fs from 'node:fs';
import {
  DEFAULT_POLICY,
  buildCleanupSummary,
  classifyMemberForCleanup,
  honorMapFromResponse,
  injectMemberCleanupClient,
  normalizeFullMember,
  normalizePolicy,
  normalizeRequestedMemberIds
} from './src/portal/member-cleanup.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const unlimitedSelection = normalizeRequestedMemberIds(Array.from({ length: 75 }, (_, index) => String(100000 + index)));
assert(unlimitedSelection.length === 75, 'Cleanup preview must not truncate selections above 20 members');
assert(normalizeRequestedMemberIds(['100001', '100001', 'bad']).length === 1, 'Unlimited selection normalization must still deduplicate and reject empty ids');

const raw = {
  group_id: '123456789',
  user_id: '987654321',
  nickname: '昵称',
  card: '群名片',
  sex: 'female',
  age: 22,
  area: '测试地区',
  join_time: 1600000000,
  last_sent_time: 1700000000,
  level: '42',
  qq_level: 88,
  role: 'member',
  unfriendly: true,
  title: '专属头衔',
  title_expire_time: 1800000000,
  card_changeable: false,
  is_robot: false,
  shut_up_timestamp: 1900000000,
  custom_extension: 'implementation-specific'
};
const normalized = normalizeFullMember(raw, 1750000000000);
assert(normalized.qq === '987654321', 'QQ must remain a string');
assert(normalized.groupId === '123456789', 'Group id must remain a string');
assert(normalized.name === '群名片', 'Group card should be the display name');
assert(normalized.level === '42' && normalized.qqLevel === 88, 'Group and QQ levels must be preserved');
assert(normalized.title === '专属头衔' && normalized.specialTitle === '专属头衔', 'Special title must be preserved');
assert(normalized.titleExpireTime === 1800000000000, 'Title expiry must be normalized to milliseconds');
assert(normalized.cardChangeable === false && normalized.unfriendly === true, 'OneBot member flags must be preserved');
assert(normalized.extra.custom_extension === 'implementation-specific', 'Unknown implementation fields must be retained safely');

const honorMap = honorMapFromResponse({ data: {
  current_talkative: { user_id: 1, nickname: 'A', day_count: 3 },
  performer_list: [{ user_id: 2, nickname: 'B', description: '群聊之火' }],
  emotion_list: [{ user_id: 1, nickname: 'A', description: '快乐源泉' }]
} });
assert(honorMap.get('1').length === 2, 'Multiple honor types for one member must be retained');
assert(honorMap.get('2')[0].type === 'performer', 'Honor list type must be normalized');

const now = Date.UTC(2026, 6, 26);
const daysAgo = days => now - days * 86400000;
const base = { qq: '10001', role: 'member', isRobot: false, joinTime: daysAgo(500), lastSentTime: daysAgo(400), title: '', honors: [] };
const dormant = classifyMemberForCleanup(base, {}, DEFAULT_POLICY, now);
assert(dormant.category === 'long_dormant' && dormant.recommendation === 'cleanup_candidate', 'Long dormant members should become cleanup candidates');
const active = classifyMemberForCleanup({ ...base, lastSentTime: daysAgo(3) }, {}, DEFAULT_POLICY, now);
assert(active.category === 'active' && active.recommendation === 'keep', 'Recently active members must be kept');
const newMember = classifyMemberForCleanup({ ...base, joinTime: daysAgo(2), lastSentTime: 0 }, {}, DEFAULT_POLICY, now);
assert(newMember.category === 'new_member' && newMember.recommendation === 'keep', 'New members must receive a grace period');
const neverSpoke = classifyMemberForCleanup({ ...base, joinTime: daysAgo(80), lastSentTime: 0 }, {}, DEFAULT_POLICY, now);
assert(neverSpoke.category === 'never_spoke_established', 'Established members without a speech timestamp should be reviewable candidates');
const protectedAdmin = classifyMemberForCleanup({ ...base, role: 'admin' }, {}, DEFAULT_POLICY, now);
assert(protectedAdmin.protected && protectedAdmin.recommendation === 'keep', 'Admins must be protected');
const protectedTag = classifyMemberForCleanup(base, { profile: { tags: ['免清'] } }, DEFAULT_POLICY, now);
assert(protectedTag.protected, 'Manual keep tags must protect members');
const protectedHonor = classifyMemberForCleanup(base, { honors: [{ type: 'legend' }] }, DEFAULT_POLICY, now);
assert(protectedHonor.protected, 'Group honors must protect members by default');

const demographicA = classifyMemberForCleanup({ ...base, sex: 'male', age: 18, area: 'A' }, {}, DEFAULT_POLICY, now);
const demographicB = classifyMemberForCleanup({ ...base, sex: 'female', age: 99, area: 'B' }, {}, DEFAULT_POLICY, now);
assert(demographicA.category === demographicB.category && demographicA.score === demographicB.score, 'Sex, age and area must never affect cleanup classification');
assert(JSON.stringify(demographicA.reasons) === JSON.stringify(demographicB.reasons), 'Demographic fields must not appear in cleanup reasoning');

const policy = normalizePolicy({ activeDays: 100, coolingDays: 20, dormantDays: 10, longDormantDays: 5 });
assert(policy.coolingDays > policy.activeDays && policy.dormantDays > policy.coolingDays && policy.longDormantDays > policy.dormantDays, 'Policy thresholds must remain monotonic');

const summary = buildCleanupSummary([
  { classification: active },
  { classification: dormant },
  { classification: protectedAdmin },
  { classification: neverSpoke }
]);
assert(summary.total === 4 && summary.cleanupCandidates === 2 && summary.protected === 1, 'Cleanup summary counts must be correct');

const html = injectMemberCleanupClient('<html><head></head><body><div id="memberList" class="list"><div class="empty">尚未读取群友列表</div></div></body></html>');
assert(html.includes('qqai-member-cleanup-client'), 'Cleanup client must be injected into the member console');
assert(html.includes('快速同步') && html.includes('深度补全所选') && html.includes('建立清理预览'), 'Cleanup UI must expose sync and reviewed cleanup controls');
assert(html.includes('所选清理人数不设上限'), 'Cleanup UI must explain unlimited selection with automatic internal batching');
for (const match of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)) new Function(match[1]);

const cleanupModule = fs.readFileSync('src/portal/member-cleanup.js', 'utf8');
assert(cleanupModule.includes('确认清理 ${preview.eligible.length} 人'), 'Execution must require an exact preview-bound confirmation phrase');
assert(cleanupModule.includes('get_group_member_info') && cleanupModule.includes('no_cache: true'), 'Execution must revalidate live QQ member roles without cache before removal');
assert(cleanupModule.includes('UPDATE kv_store SET value = ? WHERE key = ? AND value = ?'), 'Each preview or continuation token must be claimed atomically before use');
assert(cleanupModule.includes('await dbDel(env, key)'), 'Claimed cleanup tokens must be removed before execution');
assert(cleanupModule.includes('liveHonors.get(userId)'), 'Execution must refresh group honors before the final cleanup decision');
const cleanupSource = fs.readFileSync('src/portal/member-cleanup.js', 'utf8');
assert(!cleanupSource.includes('EXECUTE_BATCH_LIMIT'), 'Legacy 20-member hard limit must be removed');
assert(cleanupSource.includes('continuationToken') && cleanupSource.includes('while(token)'), 'Unlimited cleanup must continue automatically across internal chunks');
assert(cleanupSource.includes('UPDATE kv_store SET value = ? WHERE key = ? AND value = ?'), 'Each continuation token must be claimed atomically before use');
const members = fs.readFileSync('src/portal/members.js', 'utf8');
assert(members.includes('handleMemberCleanupApi'), 'Member API must route cleanup endpoints');
assert(members.includes('injectMemberCleanupClient'), 'Portal HTML must inject the cleanup client');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
assert(pkg.version === '2.7.9', 'Package version must be 2.7.3');
assert(pkg.scripts.check.includes('verify-member-cleanup.mjs'), 'Member cleanup verification must run in the permanent test suite');
const notes = JSON.parse(fs.readFileSync('release-notes.json', 'utf8'));
assert(notes.version === '2.7.9', 'Release notes must be 2.7.3');

console.log('verify-member-cleanup: ok');
