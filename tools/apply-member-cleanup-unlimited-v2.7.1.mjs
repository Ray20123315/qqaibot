import fs from 'node:fs';

function read(path) { return fs.readFileSync(path, 'utf8'); }
function write(path, content) { fs.writeFileSync(path, content); }
function replaceOnce(source, before, after, label) {
  if (!source.includes(before)) throw new Error(`Missing patch anchor: ${label}`);
  return source.replace(before, after);
}

const memberPath = 'src/portal/member-cleanup.js';
let member = read(memberPath);
member = replaceOnce(member,
  'const EXECUTE_BATCH_LIMIT = 20;\n',
  'const EXECUTE_CHUNK_SIZE = 5;\n',
  'cleanup execution hard limit');

if (!member.includes('function normalizeRequestedMemberIds(value)')) {
  member = replaceOnce(member,
    'function cleanId(value) {\n  return String(value || "").replace(/\\D/g, "");\n}\n',
    'function cleanId(value) {\n  return String(value || "").replace(/\\D/g, "");\n}\n\nfunction normalizeRequestedMemberIds(value) {\n  return [...new Set((Array.isArray(value) ? value : []).map(cleanId).filter(Boolean))];\n}\n',
    'unlimited member-id normalization');
}

member = replaceOnce(member,
  '  const ids = [...new Set((Array.isArray(body?.userIds) ? body.userIds : []).map(cleanId).filter(Boolean))].slice(0, EXECUTE_BATCH_LIMIT);\n',
  '  const ids = normalizeRequestedMemberIds(body?.userIds);\n',
  'preview hard cap');

member = replaceOnce(member,
  '  const preview = { token, groupId: cleanId(groupId), actorId: cleanId(authed?.qq), eligible, excluded, createdAt: Date.now(), expiresAt: Date.now() + PREVIEW_TTL_MS };\n',
  '  const preview = { token, groupId: cleanId(groupId), actorId: cleanId(authed?.qq), eligible, excluded, offset: 0, succeeded: 0, failed: 0, createdAt: Date.now(), expiresAt: Date.now() + PREVIEW_TTL_MS };\n',
  'preview continuation state');

const executeStart = member.indexOf('async function executeCleanup(env, groupId, authed, body, helpers) {');
const executeEnd = member.indexOf('\nasync function handleMemberCleanupApi', executeStart);
if (executeStart < 0 || executeEnd < 0) throw new Error('Missing executeCleanup function boundary');
const unlimitedExecution = `async function claimPreviewToken(env, token, groupId, actorId, confirmationText) {
  const key = \`\${PREVIEW_PREFIX}\${String(token || "")}\`;
  const raw = await dbGet(env, key);
  if (!raw || !env?.DB) return { ok: false, status: 409, message: "清理预览不存在、已过期、正在使用或不属于当前账号，请重新建立预览。" };
  let preview = null;
  try { preview = JSON.parse(raw); } catch { return { ok: false, status: 409, message: "清理预览资料损坏，请重新建立预览。" }; }
  if (preview.claimedAt || preview.claimId) return { ok: false, status: 409, message: "这张清理预览已被使用，请勿重复提交。" };
  if (preview.groupId !== cleanId(groupId) || preview.actorId !== cleanId(actorId) || Number(preview.expiresAt || 0) < Date.now()) {
    return { ok: false, status: 409, message: "清理预览不存在、已过期或不属于当前账号，请重新建立预览。" };
  }
  const expected = \`确认清理 \${preview.eligible.length} 人\`;
  if (String(confirmationText || "").trim() !== expected) return { ok: false, status: 400, message: \`请输入：\${expected}\` };
  const claimId = crypto.randomUUID();
  const claimed = JSON.stringify({ ...preview, claimedAt: Date.now(), claimId });
  const result = await env.DB.prepare("UPDATE kv_store SET value = ? WHERE key = ? AND value = ?").bind(claimed, key, raw).run();
  const changes = Number(result?.meta?.changes ?? result?.changes ?? 0);
  if (changes !== 1) return { ok: false, status: 409, message: "这张清理预览已被使用，请勿重复提交。" };
  await dbDel(env, key);
  return { ok: true, preview };
}

async function executeCleanup(env, groupId, authed, body, helpers) {
  const token = String(body?.token || "");
  const claim = await claimPreviewToken(env, token, groupId, authed?.qq, body?.confirmationText);
  if (!claim.ok) return claim;
  const preview = claim.preview;
  const policy = await readPolicy(env, groupId);
  const [profiles, relationships, liveHonors] = await Promise.all([
    typeof helpers?.listMemberProfileSummaries === "function" ? helpers.listMemberProfileSummaries(env, groupId) : {},
    typeof helpers?.listGroupBindings === "function" ? helpers.listGroupBindings(env, groupId) : [],
    fetchHonors(env, groupId)
  ]);
  const related = relationshipUsers(relationships);
  const start = Math.max(0, Math.trunc(Number(preview.offset || 0)));
  const end = Math.min(preview.eligible.length, start + EXECUTE_CHUNK_SIZE);
  const chunk = preview.eligible.slice(start, end);
  const results = await runPool(chunk, Math.min(3, chunk.length || 1), async requested => {
    const userId = cleanId(requested.userId);
    try {
      const member = await liveMember(env, groupId, userId);
      const context = { profile: profiles?.[userId] || null, honors: liveHonors.get(userId) || [], hasRelationship: related.has(userId), isDeveloper: isDeveloperId(env, userId) };
      const classification = classifyMemberForCleanup(member, context, policy);
      if (classification.protected || member.role !== "member" || member.isRobot || !["cleanup_candidate", "review"].includes(classification.recommendation)) {
        throw new Error(\`即时复核不通过：\${classification.reasons.join("；") || classification.label}\`);
      }
      await callOneBotAction(env, { action: "set_group_kick", params: { group_id: numericId(groupId), user_id: numericId(userId), reject_add_request: false } }, 15000);
      return { userId, ok: true, name: member.name || userId };
    } catch (error) {
      return { userId, ok: false, error: String(error?.message || error).slice(0, 300) };
    }
  });
  const chunkSucceeded = results.filter(item => item.ok).length;
  const chunkFailed = results.length - chunkSucceeded;
  const succeeded = Number(preview.succeeded || 0) + chunkSucceeded;
  const failed = Number(preview.failed || 0) + chunkFailed;
  let continuationToken = "";
  if (end < preview.eligible.length) {
    continuationToken = crypto.randomUUID();
    const continuation = { ...preview, token: continuationToken, offset: end, succeeded, failed, expiresAt: Date.now() + PREVIEW_TTL_MS };
    delete continuation.claimedAt;
    delete continuation.claimId;
    await dbPut(env, \`\${PREVIEW_PREFIX}\${continuationToken}\`, JSON.stringify(continuation));
  }
  await writeSystemAudit(env, {
    type: continuationToken ? "portal_member_cleanup_execute_chunk" : "portal_member_cleanup_execute",
    groupId: cleanId(groupId),
    actorId: cleanId(authed?.qq),
    action: "kick_reviewed_members",
    requested: preview.eligible.length,
    processedFrom: start,
    processedTo: end,
    chunkSucceeded,
    chunkFailed,
    succeeded,
    failed,
    completed: !continuationToken,
    targets: results.map(item => item.userId)
  }).catch(() => {});
  return {
    ok: true,
    completed: !continuationToken,
    continuationToken,
    processed: end,
    total: preview.eligible.length,
    remaining: Math.max(0, preview.eligible.length - end),
    succeeded,
    failed,
    message: continuationToken
      ? \`清理处理中：已处理 \${end}/\${preview.eligible.length} 人，累计成功 \${succeeded}，失败 \${failed}。\`
      : \`清理执行完成：成功 \${succeeded}，失败 \${failed}。\`,
    results
  };
}
`;
member = member.slice(0, executeStart) + unlimitedExecution + member.slice(executeEnd);

member = replaceOnce(member,
  '<div class="section-head compact"><div><h3>群成员资料与清人分析</h3><p>同步 QQ／OneBot 可取得的成员资料并透明分类。系统不会自动踢人；执行前必须建立预览、即时复核并输入确认文字。</p></div>',
  '<div class="section-head compact"><div><h3>群成员资料与清人分析</h3><p>同步 QQ／OneBot 可取得的成员资料并透明分类。所选清理人数不设上限，系统会自动分批执行；执行前仍必须建立预览、即时复核并输入确认文字。</p></div>',
  'Portal unlimited cleanup explanation');

const oldClient = "  async function executeCleanup(){if(!cleanupPreviewToken){cn('请先建立清理预览');return}var text=String(ce('cleanupConfirmationText')&&ce('cleanupConfirmationText').value||'');if(text!==cleanupConfirmText){cn('确认文字不正确，应为：'+cleanupConfirmText);return}var r=await cc('/members/cleanup/execute','POST',{token:cleanupPreviewToken,confirmationText:text});cn(r.message||'执行完成');if(r.ok){cleanupPreviewToken='';cleanupConfirmText='';ce('cleanupExecutePanel')&&ce('cleanupExecutePanel').classList.add('hidden');if(typeof window.qqaiLoadMembers==='function')window.qqaiLoadMembers();loadCleanup()}}\n";
const newClient = "  async function executeCleanup(){if(!cleanupPreviewToken){cn('请先建立清理预览');return}var text=String(ce('cleanupConfirmationText')&&ce('cleanupConfirmationText').value||'');if(text!==cleanupConfirmText){cn('确认文字不正确，应为：'+cleanupConfirmText);return}var button=ce('cleanupExecute'),status=ce('cleanupPreviewText'),token=cleanupPreviewToken,previousToken='',last=null;if(button)button.disabled=true;while(token){if(token===previousToken){cn('服务器返回重复续传凭证，已停止以避免重复操作');break}previousToken=token;var r=await cc('/members/cleanup/execute','POST',{token:token,confirmationText:text});last=r;if(!r.ok){cn(r.message||'执行失败');break}token=String(r.continuationToken||'');cleanupPreviewToken=token;if(status)status.textContent=r.message||('已处理 '+String(r.processed||0)+'/'+String(r.total||0)+' 人')}if(button)button.disabled=false;if(last&&last.completed){cn(last.message||'执行完成');cleanupPreviewToken='';cleanupConfirmText='';ce('cleanupExecutePanel')&&ce('cleanupExecutePanel').classList.add('hidden');if(typeof window.qqaiLoadMembers==='function')window.qqaiLoadMembers();loadCleanup()}else if(token){cn('清理尚未完成，可再次点击继续处理剩余成员。')}}\n";
member = replaceOnce(member, oldClient, newClient, 'Portal automatic continuation loop');

if (!member.includes('  normalizeRequestedMemberIds\n')) {
  member = replaceOnce(member,
    '  normalizeFullMember,\n  normalizePolicy\n};\n',
    '  normalizeFullMember,\n  normalizePolicy,\n  normalizeRequestedMemberIds\n};\n',
    'export unlimited id helper');
}
write(memberPath, member);

const versionFiles = [
  'package.json',
  'release-notes.json',
  'src/config/runtime.js',
  'verify-werewolf.mjs',
  'verify-member-cleanup.mjs',
  'verify-social-digital-twin.mjs',
  'verify-mute-locks.mjs',
  'verify-community-suite.mjs',
  'verify-portal-relationships.mjs',
  'verify-partner-bindings.mjs',
  'verify-self-mute-reapply.mjs',
  'verify-deployment-notifications.mjs',
  'verify-master-bindings.mjs',
  'verify-explicit-question-priority.mjs',
  'verify-social-boundaries.mjs'
];
for (const path of versionFiles) {
  let content = read(path);
  if (!content.includes('2.7.0')) throw new Error(`Missing 2.7.0 version anchor in ${path}`);
  content = content.replaceAll('2.7.0', '2.7.1');
  write(path, content);
}

const notesPath = 'release-notes.json';
const notes = JSON.parse(read(notesPath));
notes.fixed = Array.isArray(notes.fixed) ? notes.fixed : [];
notes.fixed.unshift('移除单次最多清理 20 人的硬限制；Portal 可选择任意数量候选，并以单次续传凭证自动分批执行至完成');
write(notesPath, `${JSON.stringify(notes, null, 2)}\n`);

const verifyPath = 'verify-member-cleanup.mjs';
let verify = read(verifyPath);
verify = replaceOnce(verify,
  '  normalizeFullMember,\n  normalizePolicy\n',
  '  normalizeFullMember,\n  normalizePolicy,\n  normalizeRequestedMemberIds\n',
  'verification helper import');
verify = replaceOnce(verify,
  "function assert(condition, message) {\n  if (!condition) throw new Error(message);\n}\n",
  "function assert(condition, message) {\n  if (!condition) throw new Error(message);\n}\n\nconst unlimitedSelection = normalizeRequestedMemberIds(Array.from({ length: 75 }, (_, index) => String(100000 + index)));\nassert(unlimitedSelection.length === 75, 'Cleanup preview must not truncate selections above 20 members');\nassert(normalizeRequestedMemberIds(['100001', '100001', 'bad']).length === 1, 'Unlimited selection normalization must still deduplicate and reject empty ids');\n",
  'unlimited selection regression');
verify = replaceOnce(verify,
  "assert(html.includes('快速同步') && html.includes('深度补全所选') && html.includes('建立清理预览'), 'Cleanup UI must expose sync and reviewed cleanup controls');\n",
  "assert(html.includes('快速同步') && html.includes('深度补全所选') && html.includes('建立清理预览'), 'Cleanup UI must expose sync and reviewed cleanup controls');\nassert(html.includes('所选清理人数不设上限'), 'Cleanup UI must explain unlimited selection with automatic internal batching');\n",
  'Portal unlimited explanation regression');
verify = replaceOnce(verify,
  "const members = fs.readFileSync('src/portal/members.js', 'utf8');\n",
  "const cleanupSource = fs.readFileSync('src/portal/member-cleanup.js', 'utf8');\nassert(!cleanupSource.includes('EXECUTE_BATCH_LIMIT'), 'Legacy 20-member hard limit must be removed');\nassert(cleanupSource.includes('continuationToken') && cleanupSource.includes('while(token)'), 'Unlimited cleanup must continue automatically across internal chunks');\nassert(cleanupSource.includes('UPDATE kv_store SET value = ? WHERE key = ? AND value = ?'), 'Each continuation token must be claimed atomically before use');\nconst members = fs.readFileSync('src/portal/members.js', 'utf8');\n",
  'unlimited execution regression');
write(verifyPath, verify);

console.log('Applied unlimited member cleanup v2.7.1');
