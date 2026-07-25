import fs from 'node:fs';

function replaceOnce(path, search, replacement, label) {
  const source = fs.readFileSync(path, 'utf8');
  if (!source.includes(search)) throw new Error(`Missing ${label} in ${path}`);
  fs.writeFileSync(path, source.replace(search, replacement));
}

const oldList = `async function listGroupBindings(env, groupId) {
  const group = cleanId(groupId);
  if (!env?.DB || !group) return [];
  const prefix = \`partner_binding:\${group}:\`;
  const rows = await env.DB.prepare("SELECT key, value FROM kv_store WHERE substr(key, 1, ?) = ? ORDER BY key ASC").bind(prefix.length, prefix).all();
  const output = [];
  const seen = new Set();
  for (const row of rows.results || []) {
    let parsed = null;
    try { parsed = JSON.parse(String(row?.value || "{}")); } catch {}
    const binding = normalizeBinding(parsed);
    if (!binding.active) continue;
    const live = await getPartnerBinding(env, group, binding.userId);
    if (!live) continue;
    const pair = [live.userId, live.partnerId].sort();
    const key = \`\${live.mode}:\${pair[0]}:\${pair[1]}\`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(live.mode === "master" ? {
      mode: "master",
      masterId: live.masterId,
      memberId: live.memberId,
      userIds: [live.masterId, live.memberId],
      createdAt: live.createdAt,
      requestId: live.requestId
    } : {
      mode: "partner",
      leftId: pair[0],
      rightId: pair[1],
      userIds: pair,
      createdAt: live.createdAt,
      requestId: live.requestId
    });
  }
  return output.sort((left, right) => Number(right.createdAt || 0) - Number(left.createdAt || 0));
}`;

const newList = `async function listGroupBindings(env, groupId) {
  const group = cleanId(groupId);
  if (!env?.DB || !group) return [];
  const prefix = \`partner_binding:\${group}:\`;
  const rows = await env.DB.prepare("SELECT key, value FROM kv_store WHERE substr(key, 1, ?) = ? ORDER BY key ASC").bind(prefix.length, prefix).all();
  const byUser = new Map();
  for (const row of rows.results || []) {
    let parsed = null;
    try { parsed = JSON.parse(String(row?.value || "{}")); } catch {}
    const binding = normalizeBinding(parsed);
    if (binding.active) byUser.set(binding.userId, binding);
  }
  const output = [];
  const seen = new Set();
  for (const binding of byUser.values()) {
    const reverse = byUser.get(binding.partnerId);
    if (!reverse || reverse.partnerId !== binding.userId || reverse.mode !== binding.mode) continue;
    if (binding.mode === "master" && (reverse.masterId !== binding.masterId || reverse.memberId !== binding.memberId || reverse.relationshipRole === binding.relationshipRole)) continue;
    const pair = [binding.userId, binding.partnerId].sort();
    const key = \`\${binding.mode}:\${pair[0]}:\${pair[1]}\`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(binding.mode === "master" ? {
      mode: "master",
      masterId: binding.masterId,
      memberId: binding.memberId,
      userIds: [binding.masterId, binding.memberId],
      createdAt: binding.createdAt,
      requestId: binding.requestId
    } : {
      mode: "partner",
      leftId: pair[0],
      rightId: pair[1],
      userIds: pair,
      createdAt: binding.createdAt,
      requestId: binding.requestId
    });
  }
  return output.sort((left, right) => Number(right.createdAt || 0) - Number(left.createdAt || 0));
}`;
replaceOnce('src/moderation/partner-bindings.js', oldList, newList, 'group relationship listing implementation');

replaceOnce(
  'src/portal/members.js',
  '    const raw = response?.data && typeof response.data === "object" ? response.data : response;\n    return normalizeMember(raw);',
  '    const raw = response?.data && typeof response.data === "object" ? response.data : response;\n    const member = normalizeMember(raw);\n    if (!member.isRobot) {\n      const cached = await readJson(env, `group_members:${groupId}`, []);\n      const known = Array.isArray(cached) ? cached.find(item => String(item?.qq || item?.user_id || "") === userId) : null;\n      if (known?.isRobot || known?.is_robot) member.isRobot = true;\n    }\n    return member;',
  'cached robot classification fallback'
);

replaceOnce(
  'src/portal/members.js',
  '一般管理层可查看，只有最高核心开发者可直接配对或强制解除。</p>',
  '一般管理层可查看，只有最高核心开发者可直接配对或强制解除。替换或解除关系不会自动改变尚未到期的既有禁言。</p>',
  'relationship mute warning'
);

const verifyPath = 'verify-portal-relationships.mjs';
let verify = fs.readFileSync(verifyPath, 'utf8');
verify = verify.replace("assert(bindings.includes('listGroupBindings'), 'Portal must be able to list group relationships');", "assert(bindings.includes('listGroupBindings'), 'Portal must be able to list group relationships');\nassert(bindings.includes('const byUser = new Map()'), 'Relationship listing must validate pairs without per-member database round trips');");
verify = verify.replace("assert(members.includes('no_cache: true'), 'Direct pairing must live-verify group roles');", "assert(members.includes('no_cache: true'), 'Direct pairing must live-verify group roles');\nassert(members.includes('known?.isRobot || known?.is_robot'), 'Direct pairing must honor cached robot classification as a fallback');");
fs.writeFileSync(verifyPath, verify);
console.log('v2.4.1 hardening applied');
