import fs from 'node:fs';

function replaceOnce(source, search, replacement, label) {
  if (!source.includes(search)) throw new Error(`missing anchor: ${label}`);
  if (source.indexOf(search) !== source.lastIndexOf(search)) throw new Error(`duplicate anchor: ${label}`);
  return source.replace(search, replacement);
}

let worker = fs.readFileSync('worker.js', 'utf8');
worker = replaceOnce(
  worker,
  `      const operatorMember = operatorId ? await getGroupMemberSafe(this.env, groupId, operatorId).catch(() => null) : null;
      const permission = canUnlockMute(this.env, muteLock, {
        actorId: operatorId,
        actorRole: String(operatorMember?.role || "")
      });`,
  `      const verifiedOwner = Boolean(muteLock.allowOwnerUnmute && operatorId)
        && await isVerifiedGroupOwner(this.env, groupId, operatorId).catch(() => false);
      const permission = canUnlockMute(this.env, muteLock, {
        actorId: operatorId,
        actorRole: verifiedOwner ? "owner" : ""
      });`,
  'live owner verification for native unmute'
);
fs.writeFileSync('worker.js', worker);

let test = fs.readFileSync('verify-mute-locks.mjs', 'utf8');
test = replaceOnce(
  test,
  `assert(worker.includes('const permission = canUnlockMute(env, protectedLock'), 'Authorized developer or owner group commands must reach the normal confirmation flow');`,
  `assert(worker.includes('const permission = canUnlockMute(env, protectedLock'), 'Authorized developer or owner group commands must reach the normal confirmation flow');
assert(worker.includes('isVerifiedGroupOwner(this.env, groupId, operatorId)'), 'Native QQ owner release must use a live owner verification rather than cached member roles');`,
  'live owner verification test'
);
fs.writeFileSync('verify-mute-locks.mjs', test);

let config = fs.readFileSync('src/config/runtime.js', 'utf8');
config = config.replace('const BUILD_DATE = "2026-07-25";', 'const BUILD_DATE = "2026-07-26";');
fs.writeFileSync('src/config/runtime.js', config);

console.log('final-owner-mute-lock-check: ok');
