import fs from 'node:fs';

function patch(path, search, replacement, label) {
  const source = fs.readFileSync(path, 'utf8');
  if (!source.includes(search)) throw new Error(`Missing ${label} in ${path}`);
  fs.writeFileSync(path, source.replace(search, replacement));
}

patch(
  'src/portal/runtime.js',
  '<button class="action-card" data-open-view="groups"><span class="action-icon">群</span><span><b>群组设置</b><small>AI 开关、人格与安全设置</small></span></button>',
  '<button class="action-card" data-open-view="groups"><span class="action-icon">群</span><span><b>群组设置</b><small>AI 开关、人格与安全设置</small></span></button>\n            <button class="action-card" data-open-view="members"><span class="action-icon">友</span><span><b>群友列表</b><small>历史消息、禁言与防解除</small></span></button>',
  'member dashboard action'
);

patch(
  'worker.js',
  '        if (!isGroup) return new Response(null, { status: 204 });\n        const targetId = String(targetMentionQqs[0] || partnerBindCommand[1] || "").replace(/\\D/g, "");',
  '        if (!isGroup) return new Response(null, { status: 204 });\n        const requester = await getGroupMemberSafe(env, currentGroupId, userId);\n        if (userId === String(env.DEVELOPER_ID || "") || String(requester?.role || "") === "owner") return jsonReply(`${atSender}群主与核心开发者不能建立对象绑定。`);\n        const targetId = String(targetMentionQqs[0] || partnerBindCommand[1] || "").replace(/\\D/g, "");',
  'partner requester protection'
);

patch(
  'verify-partner-bindings.mjs',
  "assert(portal.includes(\"'groups','moderation','members','ruleviolations'\"), 'Portal management visibility must include the member list');",
  "assert(portal.includes(\"'groups','moderation','members','ruleviolations'\"), 'Portal management visibility must include the member list');\nassert(portal.includes('data-open-view=\"members\"'), 'Portal dashboard must expose a member-list shortcut when the navigation permission is available');",
  'dashboard assertion'
);

patch(
  'verify-partner-bindings.mjs',
  "assert(worker.includes('createPartnerBindingRequest'), 'Worker must expose partner binding requests');",
  "assert(worker.includes('createPartnerBindingRequest'), 'Worker must expose partner binding requests');\nassert(worker.includes('群主与核心开发者不能建立对象绑定'), 'Owner and core developer accounts must be excluded from partner binding');",
  'protected requester assertion'
);

console.log('finalize-v230-review: ok');
