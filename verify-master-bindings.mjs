import fs from 'node:fs';
import { canUnlockMute } from './src/moderation/mute-locks.js';

function assert(condition, message) { if (!condition) throw new Error(message); }
const env = { DEVELOPER_ID: '3569028262' };
const masterLock = { active: true, groupId: '10001', userId: '20002', source: 'master', masterId: '30003', createdBy: '30003', expiresAt: Date.now() + 60000 };
assert(canUnlockMute(env, masterLock, { actorId: '30003', masterCommand: true }).allowed, 'The matching master must release a master-source mute');
assert(!canUnlockMute(env, masterLock, { actorId: '40004', masterCommand: true }).allowed, 'Another member must not release a master-source mute');
assert(canUnlockMute(env, masterLock, { actorId: '50005', actorRole: 'admin' }).allowed, 'Native group management must retain authority over master-source mutes');
assert(!canUnlockMute(env, { ...masterLock, source: 'manual', masterId: '' }, { actorId: '30003', masterCommand: true }).allowed, 'Master privilege must not release manual protected mutes');

const bindings = fs.readFileSync('src/moderation/partner-bindings.js', 'utf8');
assert(bindings.includes('mode === "master"'), 'Relationship storage must support master mode');
assert(bindings.includes('masterId'), 'Master relationships must persist the master ID');
assert(bindings.includes('memberId'), 'Master relationships must persist the subordinate member ID');
assert(bindings.includes('createMasterBindingRequest'), 'Master relationship requests must use the consent request store');
assert(bindings.includes('request.targetId'), 'Only the invited target may approve master binding');

const worker = fs.readFileSync('worker.js', 'utf8');
assert(worker.includes('!同意主人绑定'), 'Master binding must require an explicit approval command');
assert(worker.includes('所属成员必须是当前普通群成员'), 'Subordinate eligibility must exclude management and system accounts');
assert(worker.includes('masterId === String(botId || "")'), 'The bot account must be rejected before a master relationship request is created');
assert(worker.includes('no_cache: true'), 'Master relationship roles must use live OneBot checks');
assert(worker.includes('createMasterMuteLock'), 'Master mute must use a distinct lock source');
assert(worker.includes('masterCommand: true'), 'Master unmute must use the restricted master permission path');
assert(worker.includes('主人关系任何等级都没有踢出权限'), 'Master kick commands must be permanently denied at every level');
assert(worker.includes('!主人改名'), 'Master must be able to change the subordinate member card');
assert(worker.includes('!主人撤回'), 'Master must be able to recall only the subordinate member messages');
assert(worker.includes('binding.mode !== "partner"'), 'Symmetric partner commands must not operate on master relationships');
assert(worker.includes('clearPartnerBinding(env, currentGroupId, leavingUserId)'), 'Leaving the group must clear either relationship mode');

const portal = fs.readFileSync('src/portal/members.js', 'utf8');
assert(portal.includes('主人禁言锁'), 'Portal must label master-source locks');
assert(portal.includes('if (!protect && previousLock)'), 'Normal Portal moderation must clear an old relationship lock after overriding it');

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
assert(pkg.version === '2.6.0', 'Package version must be 2.5.2');
assert(pkg.scripts.check.includes('verify-master-bindings.mjs'), 'Master relationship verification must run permanently');
console.log('verify-master-bindings: ok');
