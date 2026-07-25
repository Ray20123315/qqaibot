import fs from 'node:fs';

function read(path) { return fs.readFileSync(path, 'utf8'); }
function write(path, text) { fs.writeFileSync(path, text); }
function replaceOnce(path, search, replacement, label = search.slice(0, 80)) {
  const source = read(path);
  if (!source.includes(search)) throw new Error(`Missing anchor in ${path}: ${label}`);
  write(path, source.replace(search, replacement));
}
function insertBefore(path, anchor, addition, label = anchor.slice(0, 80)) {
  replaceOnce(path, anchor, `${addition}\n${anchor}`, label);
}
function replaceAll(path, search, replacement) {
  const source = read(path);
  if (!source.includes(search)) return false;
  write(path, source.split(search).join(replacement));
  return true;
}

const pkg = JSON.parse(read('package.json'));
pkg.version = '2.4.1';
if (!pkg.scripts.check.includes('verify-portal-relationships.mjs')) pkg.scripts.check += ' && node verify-portal-relationships.mjs';
write('package.json', JSON.stringify(pkg, null, 2) + '\n');
replaceOnce('src/config/runtime.js', 'const VERSION = "2.4.0";', 'const VERSION = "2.4.1";', 'runtime version');
for (const path of ['verify-deployment-notifications.mjs','verify-social-digital-twin.mjs','verify-explicit-question-priority.mjs','verify-mute-locks.mjs','verify-partner-bindings.mjs','verify-self-mute-reapply.mjs','verify-master-bindings.mjs']) {
  if (fs.existsSync(path)) replaceAll(path, '2.4.0', '2.4.1');
}
write('release-notes.json', JSON.stringify({
  version: '2.4.1',
  notificationPolicy: 'portal-only-with-private-developer-failure-details',
  added: [
    'Portal 群友列表新增关系管理控制台，可查看对象与主人关系',
    '最高核心开发者可在网页直接指定主人和所属成员，并可明确替换既有关系',
    '最高核心开发者可从网页强制解除关系；一般管理层保持只读查看'
  ],
  fixed: [
    '主人关系只能通过群指令建立，网页端无法查看或管理',
    '最高权限无法在紧急情况下绕过邀请流程直接配对',
    '直接配对前未统一执行即时群成员、管理身份与机器人检查'
  ]
}, null, 2) + '\n');

const partnerAddition = read('tools/v241-partner-addition.txt').trimEnd();
insertBefore('src/moderation/partner-bindings.js', 'async function clearPartnerBinding(env, groupId, userId) {', partnerAddition, 'partner direct binding functions');
replaceOnce(
  'src/moderation/partner-bindings.js',
  '  clearPartnerBinding,\n  createMasterBindingRequest,',
  '  clearPartnerBinding,\n  createDirectMasterBinding,\n  createMasterBindingRequest,',
  'export createDirectMasterBinding'
);
replaceOnce(
  'src/moderation/partner-bindings.js',
  '  getPartnerBinding,\n  partnerBindingKey',
  '  getPartnerBinding,\n  listGroupBindings,\n  partnerBindingKey',
  'export listGroupBindings'
);

replaceOnce(
  'src/portal/members.js',
  'import { recentConversationMessagesForUser } from "../core/identity.js";',
  'import { isDeveloperId, recentConversationMessagesForUser } from "../core/identity.js";',
  'portal identity import'
);
replaceOnce(
  'src/portal/members.js',
  'import { canUnlockMute, clearMuteLock, createManualMuteLock, getMuteLock, listGroupMuteLocks, putMuteLock } from "../moderation/mute-locks.js";',
  'import { canUnlockMute, clearMuteLock, createManualMuteLock, getMuteLock, listGroupMuteLocks, putMuteLock } from "../moderation/mute-locks.js";\nimport { clearPartnerBinding, createDirectMasterBinding, listGroupBindings } from "../moderation/partner-bindings.js";',
  'portal relationship imports'
);
const memberHelpers = read('tools/v241-members-helpers.txt').trimEnd();
insertBefore('src/portal/members.js', 'function normalizeEpochMs(primarySeconds, fallbackValue = 0) {', memberHelpers, 'portal relationship helpers');

const oldMembersPayload = '      const locks = await listGroupMuteLocks(env, groupId);\n      const visibleMembers = listing.members.map(item => ({ ...item, muteLock: locks[item.qq] ? { source: locks[item.qq].source, allowOwnerUnmute: locks[item.qq].allowOwnerUnmute, expiresAt: locks[item.qq].expiresAt, blockedAttempts: locks[item.qq].blockedAttempts } : null }));';
const newMembersPayload = '      const locks = await listGroupMuteLocks(env, groupId);\n      const relationships = (await listGroupBindings(env, groupId)).map(publicRelationship);\n      const relationshipByUser = new Map();\n      for (const relationship of relationships) for (const qq of relationship.userIds || []) relationshipByUser.set(String(qq), relationship);\n      const visibleMembers = listing.members.map(item => ({\n        ...item,\n        muteLock: locks[item.qq] ? { source: locks[item.qq].source, allowOwnerUnmute: locks[item.qq].allowOwnerUnmute, expiresAt: locks[item.qq].expiresAt, blockedAttempts: locks[item.qq].blockedAttempts } : null,\n        relationship: relationshipByUser.get(String(item.qq)) || null,\n        relationshipEligibility: {\n          master: !item.isRobot,\n          member: !item.isRobot && item.role === "member" && !isDeveloperId(env, item.qq)\n        }\n      }));';
replaceOnce('src/portal/members.js', oldMembersPayload, newMembersPayload, 'member relationship payload');
replaceOnce(
  'src/portal/members.js',
  '        members,\n        total: members.length,',
  '        members,\n        relationships,\n        total: members.length,',
  'relationship list response'
);
replaceOnce(
  'src/portal/members.js',
  '        permissions: { viewHistory: true, mute: true, unmute: true },',
  '        permissions: { viewHistory: true, mute: true, unmute: true, directRelationship: coreDeveloperAllowed(env, authed), removeRelationship: coreDeveloperAllowed(env, authed) },',
  'relationship permissions response'
);
const endpoints = read('tools/v241-members-endpoints.txt').trimEnd();
insertBefore('src/portal/members.js', '  if (request.method === "GET" && path === "/members/history") {', endpoints, 'portal relationship endpoints');

const section = read('tools/v241-members-section.txt').trimEnd();
replaceOnce(
  'src/portal/members.js',
  '  <div id="memberList" class="list"><div class="empty">尚未读取群友列表</div></div>',
  `${section}\n  <div id="memberList" class="list"><div class="empty">尚未读取群友列表</div></div>`,
  'relationship console section'
);
const cssAddition = '.relationship-console{margin-bottom:16px}.relationship-direct{display:grid;grid-template-columns:minmax(180px,1fr) minmax(180px,1fr) auto auto;gap:12px;align-items:end;margin:14px 0}.relationship-direct .field{margin:0}.relationship-replace{align-self:center}.relationship-row{display:grid;grid-template-columns:minmax(220px,1fr) auto;gap:12px;align-items:center}.relationship-actions{display:flex;gap:8px;justify-content:flex-end}.member-relationship{font-size:12px;font-weight:800;color:#6d28d9;margin-left:6px}@media(max-width:900px){.relationship-direct,.relationship-row{grid-template-columns:1fr}.relationship-actions{justify-content:stretch}.relationship-actions .btn{width:100%}}';
replaceOnce('src/portal/members.js', '</style>`;', `${cssAddition}\n</style>\`;`, 'relationship console styles');
replaceOnce('src/portal/members.js', '  var cachedMembers=[];', '  var cachedMembers=[],cachedRelationships=[],relationshipPermissions={};', 'relationship client state');
const client = read('tools/v241-members-client.txt').trimEnd();
insertBefore('src/portal/members.js', '  function renderMembers(){', client, 'relationship client functions');
replaceOnce(
  'src/portal/members.js',
  "      var state=member.muted?'<span class=\"member-muted\">禁言中，剩余 '+safe(secondsText(member.muteRemainingSeconds))+'</span>':'<span class=\"status ok\">可发言</span>';if(lockText)state+=' <span class=\"member-lock\">'+safe(lockText)+'</span>';",
  "      var state=member.muted?'<span class=\"member-muted\">禁言中，剩余 '+safe(secondsText(member.muteRemainingSeconds))+'</span>':'<span class=\"status ok\">可发言</span>';if(lockText)state+=' <span class=\"member-lock\">'+safe(lockText)+'</span>';var relation=relationshipFor(member.qq);if(relation)state+=' <span class=\"member-relationship\">'+safe(relation.mode==='master'?(String(relation.masterId)===String(member.qq)?'主人':'所属成员'):'对象')+'</span>';",
  'member relationship badge'
);
replaceOnce(
  'src/portal/members.js',
  '    cachedMembers=result.members||[];renderMembers();',
  '    cachedMembers=result.members||[];cachedRelationships=result.relationships||[];relationshipPermissions=result.permissions||{};renderMembers();renderRelationships();',
  'load relationship state'
);
replaceOnce(
  'src/portal/members.js',
  "    else if(target.id==='memberRefresh')loadMembers();",
  "    else if(target.id==='memberRefresh'||target.id==='relationshipRefresh')loadMembers();\n    else if(target.id==='relationshipDirectPair')directPairRelationship();",
  'relationship buttons'
);
replaceOnce(
  'src/portal/members.js',
  "    else if(target.classList.contains('member-unmute'))unmuteMember(target)",
  "    else if(target.classList.contains('member-unmute'))unmuteMember(target);\n    else if(target.classList.contains('relationship-remove'))removeRelationship(target)",
  'relationship remove button'
);

write('verify-portal-relationships.mjs', `import fs from 'node:fs';\n\nfunction assert(condition, message) { if (!condition) throw new Error(message); }\nconst pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));\nassert(pkg.version === '2.4.1', 'Package version must be 2.4.1');\nassert(pkg.scripts.check.includes('verify-portal-relationships.mjs'), 'Portal relationship verification must run permanently');\nconst bindings = fs.readFileSync('src/moderation/partner-bindings.js', 'utf8');\nassert(bindings.includes('createDirectMasterBinding'), 'Storage must support direct master pairing');\nassert(bindings.includes('replaceExisting'), 'Direct pairing must require explicit replacement for conflicts');\nassert(bindings.includes('listGroupBindings'), 'Portal must be able to list group relationships');\nassert(bindings.includes('status = "superseded"'), 'Direct pairing must close pending requests for both participants');\nconst members = fs.readFileSync('src/portal/members.js', 'utf8');\nassert(members.includes('/members/relationships/direct'), 'Portal must expose direct pairing endpoint');\nassert(members.includes('/members/relationships/remove'), 'Portal must expose forced relationship removal');\nassert(members.includes('coreDeveloperAllowed'), 'Direct pairing must be restricted to the core developer');\nassert(members.includes('isDeveloperId(env, String(authed.qq))'), 'Core developer authorization must use canonical identity logic');\nassert(members.includes('no_cache: true'), 'Direct pairing must live-verify group roles');\nassert(members.includes('所属成员必须是普通群成员'), 'Subordinate eligibility must reject elevated roles');\nassert(members.includes('relationshipDirectPanel'), 'Portal must render the relationship console');\nassert(members.includes('替换双方既有关系'), 'Portal must require an explicit replacement option');\nassert(members.includes('普通管理层不能跳过双方同意'), 'Portal must explain the read-only consent boundary');\nconsole.log('verify-portal-relationships: ok');\n`);

console.log('v2.4.1 Portal relationship patch applied');
