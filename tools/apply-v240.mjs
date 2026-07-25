import fs from 'node:fs';

function read(path) { return fs.readFileSync(path, 'utf8'); }
function write(path, text) { fs.writeFileSync(path, text); }
function replaceOnce(path, search, replacement, label = search.slice(0, 100)) {
  const source = read(path);
  if (!source.includes(search)) throw new Error(`Missing anchor in ${path}: ${label}`);
  write(path, source.replace(search, replacement));
}
function replaceAll(path, search, replacement) {
  const source = read(path);
  if (!source.includes(search)) return false;
  write(path, source.split(search).join(replacement));
  return true;
}

const pkg = JSON.parse(read('package.json'));
pkg.version = '2.4.0';
if (!pkg.scripts.check.includes('verify-master-bindings.mjs')) pkg.scripts.check += ' && node verify-master-bindings.mjs';
write('package.json', JSON.stringify(pkg, null, 2) + '\n');
replaceOnce('src/config/runtime.js', 'const VERSION = "2.3.1";', 'const VERSION = "2.4.0";', 'runtime version');
for (const path of ['verify-deployment-notifications.mjs','verify-social-digital-twin.mjs','verify-explicit-question-priority.mjs','verify-mute-locks.mjs','verify-partner-bindings.mjs','verify-self-mute-reapply.mjs']) {
  if (fs.existsSync(path)) replaceAll(path, '2.3.1', '2.4.0');
}
write('release-notes.json', JSON.stringify({
  version: '2.4.0',
  notificationPolicy: 'portal-only-with-private-developer-failure-details',
  added: [
    '双方同意的一对一主人关系：一方为主人，另一方为所属成员',
    '主人可直接禁言、解除自己造成的主人禁言、踢出、修改所属成员群名片及撤回所属成员消息',
    '群主、管理员、普通成员与核心开发者均可成为主人；所属成员必须持续是普通成员'
  ],
  fixed: [
    '原对象关系无法表达非对称主人权限',
    '对象或主人关系成员离群后关系可能继续残留',
    'Portal 普通管理禁言可能保留旧对象关系锁并被错误重新套用'
  ]
}, null, 2) + '\n');

replaceOnce('worker.js',
  'import { MAX_MUTE_SECONDS as MUTE_LOCK_MAX_SECONDS, canUnlockMute, clearMuteLock, createPartnerMuteLock, createSelfMuteLock, getMuteLock, listActiveSelfMuteLocks, markMuteLockReapplied, markMuteUnlockBlocked, muteLockRemainingSeconds, putMuteLock } from "./src/moderation/mute-locks.js";',
  'import { MAX_MUTE_SECONDS as MUTE_LOCK_MAX_SECONDS, canUnlockMute, clearMuteLock, createMasterMuteLock, createPartnerMuteLock, createSelfMuteLock, getMuteLock, listActiveSelfMuteLocks, markMuteLockReapplied, markMuteUnlockBlocked, muteLockRemainingSeconds, putMuteLock } from "./src/moderation/mute-locks.js";',
  'mute lock imports');
replaceOnce('worker.js',
  'import { clearPartnerBinding, createPartnerBindingRequest, decidePartnerBindingRequest, getPartnerBinding } from "./src/moderation/partner-bindings.js";',
  'import { clearPartnerBinding, createMasterBindingRequest, createPartnerBindingRequest, decidePartnerBindingRequest, getBindingRequest, getPartnerBinding } from "./src/moderation/partner-bindings.js";',
  'relationship imports');
replaceOnce('worker.js',
  "managementOverride: protectedLock.source === 'partner' && (liveOwner || liveOperatorRole === 'admin')",
  "managementOverride: ['partner', 'master'].includes(protectedLock.source) && (liveOwner || liveOperatorRole === 'admin')",
  'native relationship management override');
replaceOnce('worker.js',
  ": activeLock.source === 'partner'\n                ? '该成员处于对象禁言，只能对象或正常群管理权限解除。'\n                : activeLock.allowOwnerUnmute",
  ": activeLock.source === 'partner'\n                ? '该成员处于对象禁言，只能对象或正常群管理权限解除。'\n                : activeLock.source === 'master'\n                  ? '该成员处于主人禁言，只能对应主人或正常群管理权限解除。'\n                  : activeLock.allowOwnerUnmute",
  'native master lock hint');
replaceOnce('worker.js',
  '          ctx.waitUntil(opsHandleMemberLeave(env, currentGroupId, leavingUserId));',
  '          ctx.waitUntil(opsHandleMemberLeave(env, currentGroupId, leavingUserId));\n          ctx.waitUntil(clearPartnerBinding(env, currentGroupId, leavingUserId).catch(() => {}));',
  'relationship cleanup on leave');
const masterBlock = read('tools/master-block-v240.txt');
replaceOnce('worker.js',
  '      // 一对一对象绑定必须由双方同意；对象权限只作用于对象来源的禁言。',
  `${masterBlock}      // 一对一对象绑定必须由双方同意；对象权限只作用于对象来源的禁言。`,
  'master command insertion');
replaceOnce('worker.js',
  '        if (!binding) return jsonReply(`${atSender}你目前没有绑定对象。`);\n        const duration = Math.max(1, Math.min(MUTE_LOCK_MAX_SECONDS, parseDurationSeconds(String(partnerMuteCommand[1] || "10分")) || 600));',
  '        if (!binding) return jsonReply(`${atSender}你目前没有绑定对象。`);\n        if (binding.mode !== "partner") return jsonReply(`${atSender}当前是主人关系，不能使用对象禁言指令。`);\n        const duration = Math.max(1, Math.min(MUTE_LOCK_MAX_SECONDS, parseDurationSeconds(String(partnerMuteCommand[1] || "10分")) || 600));',
  'partner mute mode guard');
replaceOnce('worker.js',
  '        if (!binding) return jsonReply(`${atSender}你目前没有绑定对象。`);\n        const lock = await getMuteLock(env, currentGroupId, binding.partnerId);',
  '        if (!binding) return jsonReply(`${atSender}你目前没有绑定对象。`);\n        if (binding.mode !== "partner") return jsonReply(`${atSender}当前是主人关系，不能使用对象解禁指令。`);\n        const lock = await getMuteLock(env, currentGroupId, binding.partnerId);',
  'partner unmute mode guard');
replaceOnce('worker.js',
  '              const hint = protectedLock.source === "self"\n                ? "该成员为自我禁言，只能本人私讯机器人发送「!解除禁言」；群聊管理指令不能解除。"\n                : protectedLock.allowOwnerUnmute\n                  ? "该禁言已启用防解除，仅开发者或群主可以解除。"\n                  : "该禁言已启用防解除，仅开发者可以解除。";',
  '              const hint = protectedLock.source === "self"\n                ? "该成员为自我禁言，只能本人私讯机器人发送「!解除禁言」；群聊管理指令不能解除。"\n                : protectedLock.source === "partner"\n                  ? "该成员处于对象禁言，只能对象或正常群管理权限解除。"\n                  : protectedLock.source === "master"\n                    ? "该成员处于主人禁言，只能对应主人或正常群管理权限解除。"\n                    : protectedLock.allowOwnerUnmute\n                      ? "该禁言已启用防解除，仅开发者或群主可以解除。"\n                      : "该禁言已启用防解除，仅开发者可以解除。";',
  'group unmute relationship hint');

replaceOnce('src/portal/members.js',
  '    if (!protect && previousLock?.source === "manual") {',
  '    if (!protect && previousLock) {',
  'Portal management override clears old locks');
replaceOnce('src/portal/members.js',
  '      const message = lock?.source === "self" ? "该成员为自我禁言，只能本人私讯机器人发送 !解除禁言。" : lock?.allowOwnerUnmute ? "该禁言只能由开发者或群主解除。" : "该禁言只能由开发者解除。";',
  '      const message = lock?.source === "self" ? "该成员为自我禁言，只能本人私讯机器人发送 !解除禁言。" : lock?.source === "partner" ? "该成员处于对象禁言，只能对象或正常群管理权限解除。" : lock?.source === "master" ? "该成员处于主人禁言，只能对应主人或正常群管理权限解除。" : lock?.allowOwnerUnmute ? "该禁言只能由开发者或群主解除。" : "该禁言只能由开发者解除。";',
  'Portal master unmute hint');
replaceOnce('src/portal/members.js',
  "var lock=member.muteLock,lockText=lock?(lock.source==='self'?'自我禁言锁':lock.source==='partner'?'对象禁言锁':(lock.allowOwnerUnmute?'防解除：开发者或群主':'防解除：仅开发者')):'';",
  "var lock=member.muteLock,lockText=lock?(lock.source==='self'?'自我禁言锁':lock.source==='partner'?'对象禁言锁':lock.source==='master'?'主人禁言锁':(lock.allowOwnerUnmute?'防解除：开发者或群主':'防解除：仅开发者')):'';",
  'Portal master lock label');

write('verify-master-bindings.mjs', `import fs from 'node:fs';\nimport { canUnlockMute } from './src/moderation/mute-locks.js';\n\nfunction assert(condition, message) { if (!condition) throw new Error(message); }\nconst env = { DEVELOPER_ID: '3569028262' };\nconst masterLock = { active: true, groupId: '10001', userId: '20002', source: 'master', masterId: '30003', createdBy: '30003', expiresAt: Date.now() + 60000 };\nassert(canUnlockMute(env, masterLock, { actorId: '30003', masterCommand: true }).allowed, 'The matching master must release a master-source mute');\nassert(!canUnlockMute(env, masterLock, { actorId: '40004', masterCommand: true }).allowed, 'Another member must not release a master-source mute');\nassert(canUnlockMute(env, masterLock, { actorId: '50005', actorRole: 'admin' }).allowed, 'Native group management must retain authority over master-source mutes');\nassert(!canUnlockMute(env, { ...masterLock, source: 'manual', masterId: '' }, { actorId: '30003', masterCommand: true }).allowed, 'Master privilege must not release manual protected mutes');\n\nconst bindings = fs.readFileSync('src/moderation/partner-bindings.js', 'utf8');\nassert(bindings.includes('mode === "master"'), 'Relationship storage must support master mode');\nassert(bindings.includes('masterId'), 'Master relationships must persist the master ID');\nassert(bindings.includes('memberId'), 'Master relationships must persist the subordinate member ID');\nassert(bindings.includes('createMasterBindingRequest'), 'Master relationship requests must use the consent request store');\nassert(bindings.includes('request.targetId'), 'Only the invited target may approve master binding');\n\nconst worker = fs.readFileSync('worker.js', 'utf8');\nassert(worker.includes('!同意主人绑定'), 'Master binding must require an explicit approval command');\nassert(worker.includes('所属成员必须是当前普通群成员'), 'Subordinate eligibility must exclude management and system accounts');\nassert(worker.includes('no_cache: true'), 'Master relationship roles must use live OneBot checks');\nassert(worker.includes('createMasterMuteLock'), 'Master mute must use a distinct lock source');\nassert(worker.includes('masterCommand: true'), 'Master unmute must use the restricted master permission path');\nassert(worker.includes('!主人踢出'), 'Master must be able to kick the sole subordinate member');\nassert(worker.includes('!主人改名'), 'Master must be able to change the subordinate member card');\nassert(worker.includes('!主人撤回'), 'Master must be able to recall only the subordinate member messages');\nassert(worker.includes('binding.mode !== "partner"'), 'Symmetric partner commands must not operate on master relationships');\nassert(worker.includes('clearPartnerBinding(env, currentGroupId, leavingUserId)'), 'Leaving the group must clear either relationship mode');\n\nconst portal = fs.readFileSync('src/portal/members.js', 'utf8');\nassert(portal.includes('主人禁言锁'), 'Portal must label master-source locks');\nassert(portal.includes('if (!protect && previousLock)'), 'Normal Portal moderation must clear an old relationship lock after overriding it');\n\nconst pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));\nassert(pkg.version === '2.4.0', 'Package version must be 2.4.0');\nassert(pkg.scripts.check.includes('verify-master-bindings.mjs'), 'Master relationship verification must run permanently');\nconsole.log('verify-master-bindings: ok');\n`);
console.log('v2.4.0 master relationship patch applied');
