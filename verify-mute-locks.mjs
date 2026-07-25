import fs from 'node:fs';
import { canUnlockMute, muteLockRemainingSeconds } from './src/moderation/mute-locks.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const env = { DEVELOPER_ID: '3569028262' };
const manual = {
  active: true,
  groupId: '10001',
  userId: '20002',
  source: 'manual',
  allowOwnerUnmute: false,
  expiresAt: Date.now() + 60000
};
assert(canUnlockMute(env, manual, { actorId: '3569028262', actorRole: 'member' }).allowed, 'Developer must always be able to release a protected manual mute');
assert(!canUnlockMute(env, manual, { actorId: '30003', actorRole: 'owner' }).allowed, 'Owner must not release a protected mute unless explicitly allowed');
manual.allowOwnerUnmute = true;
assert(canUnlockMute(env, manual, { actorId: '30003', actorRole: 'owner' }).allowed, 'Owner must be able to release only when the lock allows it');
assert(!canUnlockMute(env, manual, { actorId: '40004', actorRole: 'admin' }).allowed, 'Admin must not release a protected mute');

const selfLock = { ...manual, source: 'self', userId: '50005', allowOwnerUnmute: false };
assert(!canUnlockMute(env, selfLock, { actorId: '3569028262', actorRole: 'developer' }).allowed, 'Even developer must not bypass self mute through management paths');
assert(!canUnlockMute(env, selfLock, { actorId: '50005', actorRole: 'member' }).allowed, 'Self mute must not be released from a group command');
assert(canUnlockMute(env, selfLock, { actorId: '50005', privateSelfCommand: true }).allowed, 'Self mute must be releasable by the member through the private command');
assert(muteLockRemainingSeconds(selfLock) > 0, 'Active lock must expose remaining seconds');

const portal = fs.readFileSync('src/portal/members.js', 'utf8');
assert(portal.includes('member-protect'), 'Portal must expose the prevent-unmute checkbox');
assert(portal.includes('member-owner-unlock'), 'Portal must expose the owner-can-unmute checkbox');
assert(portal.includes('member-skip-confirm'), 'Portal must expose the skip-confirmation checkbox');
assert(portal.includes('createManualMuteLock'), 'Portal mute action must persist the protection lock');
assert(portal.includes('canUnlockMute'), 'Portal unmute action must enforce the lock');
assert(portal.includes('isVerifiedGroupOwner'), 'Portal owner release must be verified against the live group role');
const portalMuteBlock = portal.slice(portal.indexOf('path === "/members/mute"'), portal.indexOf('path === "/members/unmute"'));
assert(portalMuteBlock.indexOf('createManualMuteLock') < portalMuteBlock.indexOf('action: "set_group_ban"'), 'Protected mute lock must be stored before the OneBot mute action');

const moderation = fs.readFileSync('src/moderation/runtime.js', 'utf8');
assert(moderation.includes('const permission = canUnlockMute(env, lock'), 'Confirmed unmute proposals must enforce the same lock permission matrix');
const executionFailureBlock = moderation.slice(moderation.indexOf('let result;'), moderation.indexOf('return result.ok ?'));
assert(executionFailureBlock.includes('if (!result.ok)'), 'Confirmed moderation failures must enter a rollback branch');
assert(executionFailureBlock.includes('if (releasedLock) await putMuteLock'), 'Failed confirmed unmute actions must restore the lock');

const worker = fs.readFileSync('worker.js', 'utf8');
assert(worker.includes('createSelfMuteLock'), 'Worker must support member self mute');
assert(worker.includes('listActiveSelfMuteLocks'), 'Private unmute must find active self-mute locks');
assert(worker.includes('privateSelfCommand: true'), 'Private unmute must be the only self-mute release path');
assert(worker.includes('markMuteUnlockBlocked'), 'Unauthorized release attempts must be counted and deduplicated');
assert(worker.includes('shouldNotify'), 'Blocked release warning must be emitted only once');
assert(worker.includes('const permission = canUnlockMute(env, protectedLock'), 'Authorized developer or owner group commands must reach the normal confirmation flow');
assert(worker.includes('isVerifiedGroupOwner(this.env, groupId, operatorId)'), 'Native QQ owner release must use a live owner verification rather than cached member roles');
assert(worker.includes('!解除禁言'), 'Worker must document the private silent self-unmute command in the guard message');

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
assert(pkg.version === '2.3.1', 'Package version must be 2.3.1');
assert(pkg.scripts.check.includes('verify-mute-locks.mjs'), 'Mute lock verification must run in the permanent suite');

console.log('verify-mute-locks: ok');
