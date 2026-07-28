import fs from 'node:fs';

function assert(condition, message) { if (!condition) throw new Error(message); }
const worker = fs.readFileSync('worker.js', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
assert(pkg.version === '2.7.11', 'Package version must be 2.5.2');
assert(pkg.scripts.check.includes('verify-self-mute-reapply.mjs'), 'Permanent check suite must include self-mute reapply verification');
assert(worker.includes("body.notice_type === 'group_ban'"), 'Worker must process OneBot group_ban notices');
assert(worker.includes("subType === 'lift_ban'"), 'Worker must recognize lift_ban events');
assert(worker.includes("no_cache: true"), 'Native release permission must use live OneBot member data');
const noticeStart = worker.indexOf("body.notice_type === 'group_ban'");
const noticeEnd = worker.indexOf("body.notice_type === 'group_decrease'", noticeStart);
const block = worker.slice(noticeStart, noticeEnd);
assert(block.includes('markMuteUnlockBlocked'), 'Unauthorized unmute must be recorded');
assert(block.includes("action: 'set_group_ban'"), 'Unauthorized unmute must always reapply the ban');
assert(block.indexOf("action: 'set_group_ban'") < block.indexOf('if (blocked.shouldNotify)'), 'Notification dedupe must not gate reapplication');
assert(block.includes('markMuteLockReapplied'), 'Successful reapplication must update lock state');
assert(block.includes('isVerifiedGroupOwner'), 'Owner release must be live-verified');
assert(worker.includes('self_mute_message_fallback_reapplied'), 'Missed lift events must have a message fallback');
const refreshIndex = worker.indexOf('const refreshingSelfMute');
const fallbackReturn = worker.indexOf('return new Response(null, { status: 204 });', refreshIndex);
assert(refreshIndex >= 0 && fallbackReturn > refreshIndex, 'Self-mute fallback must explicitly allow refresh commands');
const selfCommand = worker.indexOf('const selfMuteCommand =');
const rateLimit = worker.indexOf('checkRuntimeRateLimit', selfCommand);
assert(selfCommand >= 0 && rateLimit > selfCommand, 'Self-mute command must run before the general runtime rate limit');
console.log('verify-self-mute-reapply: ok');
