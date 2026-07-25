import { VERSION } from "../config/runtime.js";
import { isDeveloperId } from "../core/identity.js";
import { callOneBotAction, listAiDecisionLogs, writeSystemAudit } from "../core/permissions.js";
import { dbGet, dbPut } from "../data/store.js";
import { canUnlockMute, clearMuteLock, createManualMuteLock, getMuteLock, putMuteLock } from "../moderation/mute-locks.js";
import { MASTER_RELATIONSHIP_DEFAULTS, listGroupBindings, updateMasterBindingPermissions } from "../moderation/partner-bindings.js";
import { DEFAULT_STICKER_CATEGORIES, readStickerLibrary, removeSticker, stickerCqMessage, upsertSticker } from "../social/sticker-library.js";
import { isVerifiedGroupOwner } from "../group/runtime.js";
import { jsonResponse } from "./auth.js";
import { numericId } from "../security/network.js";

const MAX_BATCH_MEMBERS = 100;
const MAX_PROFILE_TAGS = 20;
const PROFILE_CLASSIFICATIONS = new Set(["", "violation", "no_violation", "increase_penalty"]);

function cleanId(value) {
  return String(value || "").replace(/\D/g, "");
}

function memberProfileKey(groupId, userId) {
  return `member_profile:${cleanId(groupId)}:${cleanId(userId)}`;
}

function normalizeTags(value) {
  const list = Array.isArray(value) ? value : String(value || "").split(/[,，\n]/);
  return [...new Set(list.map(item => String(item || "").trim().slice(0, 30)).filter(Boolean))].slice(0, MAX_PROFILE_TAGS);
}

function normalizeMemberProfile(value, groupId = "", userId = "") {
  const source = value && typeof value === "object" ? value : {};
  const classification = PROFILE_CLASSIFICATIONS.has(String(source.classification || "")) ? String(source.classification || "") : "";
  return {
    groupId: cleanId(source.groupId || groupId),
    userId: cleanId(source.userId || userId),
    tags: normalizeTags(source.tags),
    note: String(source.note || "").trim().slice(0, 2000),
    watched: source.watched === true,
    aiUseAllowed: source.aiUseAllowed !== false,
    classification,
    updatedAt: Number(source.updatedAt || 0),
    updatedBy: cleanId(source.updatedBy)
  };
}

async function readMemberProfile(env, groupId, userId) {
  const raw = await dbGet(env, memberProfileKey(groupId, userId));
  if (!raw) return normalizeMemberProfile(null, groupId, userId);
  try { return normalizeMemberProfile(JSON.parse(raw), groupId, userId); } catch { return normalizeMemberProfile(null, groupId, userId); }
}

async function writeMemberProfile(env, profile) {
  const normalized = normalizeMemberProfile(profile, profile?.groupId, profile?.userId);
  normalized.updatedAt = Date.now();
  await dbPut(env, memberProfileKey(normalized.groupId, normalized.userId), JSON.stringify(normalized));
  return normalized;
}

async function listMemberProfileSummaries(env, groupId) {
  const group = cleanId(groupId);
  if (!env?.DB || !group) return {};
  const prefix = `member_profile:${group}:`;
  const rows = await env.DB.prepare("SELECT value FROM kv_store WHERE substr(key, 1, ?) = ? ORDER BY key ASC").bind(prefix.length, prefix).all();
  const out = {};
  for (const row of rows.results || []) {
    let parsed = null;
    try { parsed = JSON.parse(String(row?.value || "{}")); } catch {}
    const profile = normalizeMemberProfile(parsed, group, parsed?.userId);
    if (!profile.userId) continue;
    out[profile.userId] = {
      tags: profile.tags,
      watched: profile.watched,
      aiUseAllowed: profile.aiUseAllowed,
      classification: profile.classification,
      hasNote: Boolean(profile.note),
      updatedAt: profile.updatedAt
    };
  }
  return out;
}

function classificationLabel(value) {
  return ({ violation: "有违规", no_violation: "无违规", increase_penalty: "有违规（增加处分）" })[String(value || "")] || "未分类";
}

async function countPrefix(env, prefix) {
  if (!env?.DB) return 0;
  const result = await env.DB.prepare("SELECT COUNT(*) AS count FROM kv_store WHERE substr(key, 1, ?) = ?").bind(prefix.length, prefix).first();
  return Number(result?.count || 0);
}

async function runPortalDiagnostics(env, groupId, authed, listPortalMembers) {
  const startedAt = Date.now();
  const checks = [];
  let d1Ok = false;
  try {
    if (!env?.DB) throw new Error("D1 binding missing");
    await env.DB.prepare("SELECT 1 AS ok").first();
    d1Ok = true;
    checks.push({ id: "d1", label: "D1 数据库", status: "ok", detail: "查询正常" });
  } catch (error) {
    checks.push({ id: "d1", label: "D1 数据库", status: "error", detail: String(error?.message || error).slice(0, 300) });
  }

  let botInfo = null;
  try {
    const response = await callOneBotAction(env, { action: "get_login_info", params: {} }, 10000);
    const raw = response?.data && typeof response.data === "object" ? response.data : response;
    botInfo = { qq: cleanId(raw?.user_id || raw?.userId), name: String(raw?.nickname || raw?.name || "") };
    checks.push({ id: "onebot", label: "OneBot 连接", status: botInfo.qq ? "ok" : "warning", detail: botInfo.qq ? `机器人 QQ ${botInfo.qq}` : "接口有响应但未返回 QQ" });
  } catch (error) {
    checks.push({ id: "onebot", label: "OneBot 连接", status: "error", detail: String(error?.message || error).slice(0, 300) });
  }

  let memberCount = 0;
  let memberSource = "";
  try {
    const listing = await listPortalMembers(env, groupId);
    memberCount = listing.members.length;
    memberSource = listing.source;
    checks.push({ id: "members", label: "群友目录", status: memberCount ? "ok" : "warning", detail: `${memberCount} 人｜${listing.stale ? "缓存" : "即时"}` });
  } catch (error) {
    checks.push({ id: "members", label: "群友目录", status: "error", detail: String(error?.message || error).slice(0, 300) });
  }

  const [relationshipCount, profileCount, stickerCount, decisionCount] = d1Ok ? await Promise.all([
    countPrefix(env, `partner_binding:${cleanId(groupId)}:`).then(value => Math.floor(value / 2)),
    countPrefix(env, `member_profile:${cleanId(groupId)}:`),
    readStickerLibrary(env, groupId).then(list => list.length),
    listAiDecisionLogs(env, { groupId, limit: 1000 }).then(list => list.length)
  ]) : [0, 0, 0, 0];

  return {
    ok: checks.every(item => item.status !== "error"),
    version: VERSION,
    groupId: cleanId(groupId),
    viewer: { qq: cleanId(authed?.qq), role: String(authed?.role || ""), permissions: authed?.permissions || {} },
    botInfo,
    memberCount,
    memberSource,
    counts: { relationships: relationshipCount, profiles: profileCount, stickers: stickerCount, decisions: decisionCount },
    checks,
    durationMs: Date.now() - startedAt,
    generatedAt: Date.now()
  };
}

function protectedMemberReason(member, authed) {
  if (!member) return "找不到该群成员。";
  if (member.isRobot) return "不能操作机器人账号。";
  if (member.role === "owner") return "群主不能被批量禁言或解禁。";
  if (String(member.qq) === String(authed?.qq)) return "批量操作不能包含当前登录账号。";
  if (String(authed?.role || "") === "admin" && member.role === "admin") return "管理员不能批量操作另一位管理员。";
  return "";
}

async function handleBatchAction(env, { groupId, authed, members, body }) {
  const action = String(body?.action || "");
  const ids = [...new Set((Array.isArray(body?.userIds) ? body.userIds : []).map(cleanId).filter(Boolean))].slice(0, MAX_BATCH_MEMBERS);
  if (!ids.length) return { ok: false, status: 400, message: "请至少选择一位群友。" };
  const directory = new Map((members || []).map(item => [String(item.qq), item]));
  const results = [];
  const developer = Boolean(authed?.permissions?.developer) || isDeveloperId(env, authed?.qq);
  const liveOwner = !developer && await isVerifiedGroupOwner(env, groupId, authed?.qq).catch(() => false);

  for (const userId of ids) {
    const member = directory.get(userId) || null;
    try {
      if (["mute", "unmute"].includes(action)) {
        const reason = protectedMemberReason(member, authed);
        if (reason) throw new Error(reason);
      }
      if (action === "mute") {
        const seconds = Math.max(1, Math.min(30 * 24 * 60 * 60, Math.trunc(Number(body?.seconds || 60))));
        const protect = body?.protect === true;
        const allowOwnerUnmute = protect && body?.allowOwnerUnmute === true;
        const previousLock = await getMuteLock(env, groupId, userId);
        if (previousLock?.source === "self") throw new Error("该成员正在自我禁言，管理入口不能覆盖。");
        if (protect) await createManualMuteLock(env, { groupId, userId, actorId: authed.qq, durationSeconds: seconds, allowOwnerUnmute, reason: "Portal 批量禁言" });
        try {
          await callOneBotAction(env, { action: "set_group_ban", params: { group_id: numericId(groupId), user_id: numericId(userId), duration: seconds } }, 15000);
        } catch (error) {
          if (protect) {
            if (previousLock?.active) await putMuteLock(env, previousLock).catch(() => {});
            else await clearMuteLock(env, groupId, userId).catch(() => {});
          }
          throw error;
        }
        if (!protect && previousLock) await clearMuteLock(env, groupId, userId);
        results.push({ userId, ok: true, action, seconds });
      } else if (action === "unmute") {
        const lock = await getMuteLock(env, groupId, userId);
        const permission = canUnlockMute(env, lock, { actorId: authed.qq, actorRole: liveOwner ? "owner" : authed.role, isDeveloper: developer, managementOverride: Boolean(authed?.permissions?.groupOps || authed?.permissions?.nativeAdmin) });
        if (!permission.allowed) throw new Error(lock?.source === "self" ? "自我禁言只能由本人私讯解除。" : "当前禁言锁不允许该账号解除。");
        if (lock) await clearMuteLock(env, groupId, userId);
        try {
          await callOneBotAction(env, { action: "set_group_ban", params: { group_id: numericId(groupId), user_id: numericId(userId), duration: 0 } }, 15000);
        } catch (error) {
          if (lock) await putMuteLock(env, lock).catch(() => {});
          throw error;
        }
        results.push({ userId, ok: true, action });
      } else if (["tag_add", "tag_remove", "watch", "classify"].includes(action)) {
        const profile = await readMemberProfile(env, groupId, userId);
        if (action === "tag_add") profile.tags = normalizeTags([...profile.tags, body?.tag]);
        if (action === "tag_remove") profile.tags = profile.tags.filter(tag => tag !== String(body?.tag || "").trim());
        if (action === "watch") profile.watched = body?.watched !== false;
        if (action === "classify") {
          const classification = String(body?.classification || "");
          if (!PROFILE_CLASSIFICATIONS.has(classification)) throw new Error("批量分类值无效。");
          profile.classification = classification;
        }
        profile.updatedBy = cleanId(authed?.qq);
        await writeMemberProfile(env, profile);
        results.push({ userId, ok: true, action, classification: profile.classification, tags: profile.tags, watched: profile.watched });
      } else {
        throw new Error("不支持的批量操作。");
      }
    } catch (error) {
      results.push({ userId, ok: false, action, error: String(error?.message || error).slice(0, 300) });
    }
  }

  const succeeded = results.filter(item => item.ok).length;
  await writeSystemAudit(env, { type: "portal_member_batch", groupId, actorId: authed.qq, action, count: ids.length, succeeded, failed: ids.length - succeeded, targets: ids.slice(0, 100) }).catch(() => {});
  return { ok: succeeded > 0, status: succeeded > 0 ? 200 : 409, message: `批量操作完成：成功 ${succeeded}，失败 ${ids.length - succeeded}。`, results };
}

async function handleCommunitySuiteApi(request, env, url, path, body, authed, helpers = {}) {
  if (!path.startsWith("/members/")) return null;
  const groupId = cleanId(authed?.groupId);
  if (!groupId) return jsonResponse({ ok: false, message: "请先选择群组。" }, 400);
  const listPortalMembers = helpers.listPortalMembers;
  if (typeof listPortalMembers !== "function") return jsonResponse({ ok: false, message: "群友目录服务未初始化。" }, 500);

  if (request.method === "GET" && path === "/members/diagnostics") {
    return jsonResponse(await runPortalDiagnostics(env, groupId, authed, listPortalMembers));
  }

  if (request.method === "GET" && path === "/members/profiles") {
    return jsonResponse({ ok: true, profiles: await listMemberProfileSummaries(env, groupId) });
  }

  if (request.method === "GET" && path === "/members/profile") {
    const userId = cleanId(url.searchParams.get("qq"));
    if (!userId) return jsonResponse({ ok: false, message: "请提供目标 QQ。" }, 400);
    return jsonResponse({ ok: true, profile: await readMemberProfile(env, groupId, userId) });
  }

  if (request.method === "POST" && path === "/members/profile") {
    const userId = cleanId(body?.qq);
    if (!userId) return jsonResponse({ ok: false, message: "请提供目标 QQ。" }, 400);
    const listing = await listPortalMembers(env, groupId);
    if (!listing.members.some(item => String(item.qq) === userId)) return jsonResponse({ ok: false, message: "目标不在当前群友目录中。" }, 404);
    const before = await readMemberProfile(env, groupId, userId);
    const profile = await writeMemberProfile(env, {
      ...before,
      groupId,
      userId,
      tags: body?.tags,
      note: body?.note,
      watched: body?.watched === true,
      aiUseAllowed: body?.aiUseAllowed !== false,
      classification: body?.classification,
      updatedBy: authed.qq
    });
    await writeSystemAudit(env, { type: "portal_member_profile", groupId, actorId: authed.qq, targetId: userId, action: "update", tags: profile.tags, watched: profile.watched, classification: profile.classification }).catch(() => {});
    return jsonResponse({ ok: true, message: "群友标签与管理备注已保存。", profile });
  }

  if (request.method === "POST" && path === "/members/batch") {
    const listing = await listPortalMembers(env, groupId);
    const result = await handleBatchAction(env, { groupId, authed, members: listing.members, body });
    return jsonResponse(result, result.status || 200);
  }

  if (request.method === "GET" && path === "/members/stickers") {
    return jsonResponse({ ok: true, stickers: await readStickerLibrary(env, groupId), categories: DEFAULT_STICKER_CATEGORIES });
  }

  if (request.method === "POST" && path === "/members/stickers") {
    const result = await upsertSticker(env, groupId, body?.sticker || body, authed.qq);
    if (!result.ok) return jsonResponse(result, 400);
    await writeSystemAudit(env, { type: "portal_sticker_saved", groupId, actorId: authed.qq, targetId: result.sticker.id, action: "upsert", category: result.sticker.category }).catch(() => {});
    return jsonResponse({ ok: true, message: "表情已保存。", sticker: result.sticker });
  }

  if (request.method === "POST" && path === "/members/stickers/delete") {
    const removed = await removeSticker(env, groupId, body?.id);
    if (!removed) return jsonResponse({ ok: false, message: "找不到该表情。" }, 404);
    await writeSystemAudit(env, { type: "portal_sticker_deleted", groupId, actorId: authed.qq, targetId: removed.id, action: "delete", category: removed.category }).catch(() => {});
    return jsonResponse({ ok: true, message: "表情已删除。" });
  }

  if (request.method === "POST" && path === "/members/stickers/send") {
    const stickers = await readStickerLibrary(env, groupId);
    const sticker = stickers.find(item => item.id === String(body?.id || ""));
    if (!sticker) return jsonResponse({ ok: false, message: "找不到该表情。" }, 404);
    const message = stickerCqMessage(sticker);
    if (!message) return jsonResponse({ ok: false, message: "表情图片来源无效。" }, 400);
    await callOneBotAction(env, { action: "send_group_msg", params: { group_id: numericId(groupId), message } }, 15000);
    await writeSystemAudit(env, { type: "portal_sticker_sent", groupId, actorId: authed.qq, targetId: sticker.id, action: "send", category: sticker.category }).catch(() => {});
    return jsonResponse({ ok: true, message: "表情已发送到当前群。" });
  }

  if (request.method === "GET" && path === "/members/decisions") {
    const userId = cleanId(url.searchParams.get("qq"));
    const decision = String(url.searchParams.get("decision") || "").trim();
    const query = String(url.searchParams.get("q") || "").trim();
    let logs = await listAiDecisionLogs(env, { groupId, query, decision, limit: Math.max(1, Math.min(300, Number(url.searchParams.get("limit") || 100))) });
    if (userId) logs = logs.filter(item => String(item.userId || "") === userId);
    return jsonResponse({ ok: true, logs });
  }

  if (request.method === "GET" && path === "/members/relationships/policies") {
    const relationships = await listGroupBindings(env, groupId);
    return jsonResponse({ ok: true, relationships });
  }

  if (request.method === "POST" && path === "/members/relationships/policy") {
    if (!isDeveloperId(env, authed?.qq)) return jsonResponse({ ok: false, message: "只有最高核心开发者可以修改主人权限。" }, 403);
    const userId = cleanId(body?.userId);
    if (!userId) return jsonResponse({ ok: false, message: "请指定关系中的任一 QQ。" }, 400);
    const result = await updateMasterBindingPermissions(env, groupId, userId, body?.permissions || {}, authed.qq);
    if (!result.ok) return jsonResponse(result, 400);
    await writeSystemAudit(env, { type: "portal_master_permissions", groupId, actorId: authed.qq, targetId: result.binding.memberId, action: "update", permissions: result.binding.permissions }).catch(() => {});
    return jsonResponse({ ok: true, message: "主人关系权限已更新。", relationship: result.binding });
  }

  return null;
}

function injectCommunitySuiteClient(html) {
  let source = String(html || "");
  if (!source || source.includes("qqai-community-suite-client")) return source;
  const cards = `
  <div class="card suite-diagnostics">
    <div class="section-head compact"><div><h3>Portal 自我诊断</h3><p>检查浏览器脚本、登录、当前群、D1、OneBot、群友目录与功能资料。</p></div><button id="suiteDiagnosticsRefresh" class="btn ghost">运行诊断</button></div>
    <div id="suiteDiagnosticsStatus" class="notice">尚未运行诊断。</div>
    <div id="suiteDiagnosticsList" class="suite-grid"></div>
  </div>
  <div class="card suite-batch">
    <div class="section-head compact"><div><h3>批量管理</h3><p>在下方群友列勾选成员，批量禁言、解禁、标记观察、加标签或分类复核。</p></div><button id="suiteClearSelection" class="btn ghost">清除选择</button></div>
    <div class="suite-batch-controls">
      <span id="suiteSelectedCount" class="notice">已选择 0 人</span>
      <select id="suiteBatchAction"><option value="mute">批量禁言</option><option value="unmute">批量解禁</option><option value="tag_add">添加标签</option><option value="tag_remove">移除标签</option><option value="watch">加入观察</option><option value="classify">批量分类</option></select>
      <input id="suiteBatchSeconds" type="number" min="1" max="2592000" value="60" placeholder="禁言秒数">
      <input id="suiteBatchTag" placeholder="标签">
      <select id="suiteBatchClassification"><option value="no_violation">无违规</option><option value="violation">有违规</option><option value="increase_penalty">有违规（增加处分）</option><option value="">清除分类</option></select>
      <label class="member-toggle"><input id="suiteBatchProtect" type="checkbox">防解除</label>
      <label class="member-toggle"><input id="suiteBatchOwnerUnlock" type="checkbox">群主可解除</label>
      <label class="member-toggle"><input id="suiteBatchSkipConfirm" type="checkbox">跳过确认</label>
      <button id="suiteBatchRun" class="btn danger">执行批量操作</button>
      <button id="suiteExportSelected" class="btn ghost">导出已选 CSV</button>
    </div>
    <div id="suiteBatchResult" class="notice">暂无批量操作。</div>
  </div>
  <div class="card suite-stickers">
    <div class="section-head compact"><div><h3>表情库</h3><p>保存 QQ 可发送的图片 URL、base64 或 OneBot 文件标识；群聊可使用「!表情 分类」。</p></div><button id="suiteStickerRefresh" class="btn ghost">刷新表情</button></div>
    <div class="suite-sticker-form"><input id="suiteStickerName" placeholder="名称"><input id="suiteStickerCategory" placeholder="分类，例如 抱抱"><input id="suiteStickerFile" placeholder="图片 URL 或 OneBot 文件标识"><input id="suiteStickerWeight" type="number" min="1" max="100" value="10"><label class="member-toggle"><input id="suiteStickerEnabled" type="checkbox" checked>启用</label><button id="suiteStickerSave" class="btn">保存表情</button></div>
    <div id="suiteStickerList" class="list"><div class="empty">尚未读取表情库</div></div>
  </div>
  <div class="card suite-master-policy">
    <div class="section-head compact"><div><h3>主人关系权限</h3><p>踢出默认关闭；可分别限制禁言、解禁、撤回、改名及最大禁言时长。</p></div><button id="suitePolicyRefresh" class="btn ghost">刷新权限</button></div>
    <div id="suitePolicyList" class="list"><div class="empty">尚未读取主人关系</div></div>
  </div>
  <div class="card suite-decisions">
    <div class="section-head compact"><div><h3>AI 决策回放</h3><p>查看为什么回复、跳过、限流或失败；可按 QQ、决策与关键字筛选。</p></div><button id="suiteDecisionRefresh" class="btn ghost">读取决策</button></div>
    <div class="suite-decision-filters"><input id="suiteDecisionQq" placeholder="QQ"><select id="suiteDecisionType"><option value="">全部决策</option><option value="reply">回复</option><option value="skipped">跳过</option><option value="blocked">阻止</option><option value="failed">失败</option></select><input id="suiteDecisionQuery" placeholder="原因、模型或内容关键字"></div>
    <div id="suiteDecisionList" class="list"><div class="empty">尚未读取决策记录</div></div>
    <pre id="suiteDecisionDetail" class="suite-decision-detail hidden"></pre>
  </div>
  <div id="suiteProfilePanel" class="card hidden">
    <div class="section-head compact"><div><h3 id="suiteProfileTitle">群友资料</h3><p>标签、管理备注与 AI 参考权限只对管理层可见。</p></div><button id="suiteProfileClose" class="btn ghost">关闭</button></div>
    <input id="suiteProfileQq" type="hidden"><div class="field"><label>标签（逗号分隔）</label><input id="suiteProfileTags"></div><div class="field"><label>管理备注</label><textarea id="suiteProfileNote" rows="5"></textarea></div><div class="suite-profile-flags"><label class="member-toggle"><input id="suiteProfileWatched" type="checkbox">加入观察</label><label class="member-toggle"><input id="suiteProfileAi" type="checkbox" checked>允许 AI 判断时参考</label><select id="suiteProfileClassification"><option value="">未分类</option><option value="no_violation">无违规</option><option value="violation">有违规</option><option value="increase_penalty">有违规（增加处分）</option></select><button id="suiteProfileSave" class="btn">保存资料</button></div>
  </div>`;
  const relationshipAnchor = '<div class="card relationship-console">';
  if (source.includes(relationshipAnchor)) source = source.replace(relationshipAnchor, cards + "\n" + relationshipAnchor);
  else if (source.includes('<div id="memberList"')) source = source.replace('<div id="memberList"', cards + '\n  <div id="memberList"');

  const style = `<style id="qqai-community-suite-style">
.suite-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-top:12px}.suite-check{padding:10px;border:1px solid var(--border);border-radius:12px}.suite-check strong{display:block}.suite-check.ok{border-color:#16a34a}.suite-check.warning{border-color:#d97706}.suite-check.error{border-color:#dc2626}.suite-batch-controls,.suite-sticker-form,.suite-decision-filters,.suite-profile-flags{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.suite-batch-controls input,.suite-batch-controls select,.suite-sticker-form input,.suite-decision-filters input,.suite-decision-filters select{min-width:130px;flex:1}.suite-select-wrap{display:inline-flex;align-items:center;gap:5px;font-size:12px}.suite-sticker-row,.suite-policy-row{display:grid;grid-template-columns:minmax(180px,1fr) auto;gap:10px;align-items:center}.suite-policy-controls{display:flex;gap:7px;flex-wrap:wrap;align-items:center}.suite-policy-controls input[type=number]{width:120px}.suite-decision-detail{white-space:pre-wrap;max-height:420px;overflow:auto;background:rgba(0,0,0,.05);padding:12px;border-radius:12px}.suite-profile-badge{font-size:11px;font-weight:800;margin-left:5px}.suite-tag{display:inline-block;padding:2px 7px;border-radius:999px;background:rgba(109,40,217,.12);margin:2px;font-size:11px}@media(max-width:900px){.suite-sticker-row,.suite-policy-row{grid-template-columns:1fr}.suite-batch-controls>*{flex:1 1 100%}}
</style>`;
  source = source.includes("</head>") ? source.replace("</head>", style + "\n</head>") : style + source;

  const script = `<script id="qqai-community-suite-client">
(function(){
  var selected=new Set(),suiteMembers=[],suiteProfiles={},suiteRelationships=[],suiteStickers=[],suiteDecisions=[];
  function e(id){return document.getElementById(id)}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]})}
  async function call(path,method,body){try{if(typeof api==='function')return await api(path,method||'GET',body);var r=await fetch('/api/portal'+path,{method:method||'GET',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined}),t=await r.text(),d={};try{d=t?JSON.parse(t):{}}catch(_){d={ok:false,message:'接口返回格式错误（HTTP '+r.status+'）'}}if(!r.ok){d.ok=false;d.message=d.message||('HTTP '+r.status)}return d}catch(x){return{ok:false,message:'请求失败：'+String(x&&x.message||x)}}}
  function toastMessage(v){if(typeof toast==='function')toast(v);else alert(v)}
  function updateSelected(){var n=e('suiteSelectedCount');if(n)n.textContent='已选择 '+selected.size+' 人';document.querySelectorAll('.suite-member-select').forEach(function(box){box.checked=selected.has(String(box.dataset.qq||''))})}
  function decorateRows(){document.querySelectorAll('#memberList .member-row').forEach(function(row){if(row.dataset.suiteDecorated)return;var button=row.querySelector('[data-qq]'),qq=button&&button.dataset.qq;if(!qq)return;row.dataset.suiteDecorated='1';var actions=row.querySelector('.member-actions');if(actions){var wrap=document.createElement('label');wrap.className='suite-select-wrap';wrap.innerHTML='<input type="checkbox" class="suite-member-select" data-qq="'+esc(qq)+'">选择';actions.insertBefore(wrap,actions.firstChild);var detail=document.createElement('button');detail.type='button';detail.className='btn ghost suite-profile-open';detail.dataset.qq=qq;detail.textContent='成员资料';actions.insertBefore(detail,actions.children[1]||null)}var main=row.querySelector('.member-main');var p=suiteProfiles[qq];if(main&&p){var meta=document.createElement('div');meta.className='member-meta suite-profile-summary';meta.innerHTML=(p.watched?'<span class="suite-profile-badge">观察</span> ':'')+(p.classification?'<span class="suite-profile-badge">'+esc(({violation:'有违规',no_violation:'无违规',increase_penalty:'加重处分'})[p.classification]||p.classification)+'</span> ':'')+(p.tags||[]).map(function(tag){return'<span class="suite-tag">'+esc(tag)+'</span>'}).join('');main.appendChild(meta)}});updateSelected()}
  async function loadProfiles(){var r=await call('/members/profiles');if(r.ok)suiteProfiles=r.profiles||{};decorateRows()}
  async function runDiagnostics(){var s=e('suiteDiagnosticsStatus'),root=e('suiteDiagnosticsList');if(s)s.textContent='正在诊断…';var r=await call('/members/diagnostics');if(!r.ok){if(s)s.textContent=r.message||'诊断失败';return}if(s)s.textContent='版本 '+r.version+'｜群 '+r.groupId+'｜耗时 '+r.durationMs+' ms｜前端脚本正常';if(root)root.innerHTML=(r.checks||[]).map(function(x){return'<div class="suite-check '+esc(x.status)+'"><strong>'+esc(x.label)+'</strong><span>'+esc(x.detail)+'</span></div>'}).join('')+'<div class="suite-check"><strong>功能资料</strong><span>关系 '+r.counts.relationships+'｜标签 '+r.counts.profiles+'｜表情 '+r.counts.stickers+'｜决策 '+r.counts.decisions+'</span></div>'}
  function selectedMembers(){return suiteMembers.filter(function(m){return selected.has(String(m.qq))})}
  function exportSelected(){var list=selectedMembers();if(!list.length){toastMessage('请先选择群友');return}var rows=[['QQ','名称','身份','标签','分类','观察']];list.forEach(function(m){var p=suiteProfiles[m.qq]||{};rows.push([m.qq,m.name||'',m.role||'',(p.tags||[]).join('|'),p.classification||'',p.watched?'是':'否'])});var csv='\ufeff'+rows.map(function(row){return row.map(function(v){return'"'+String(v||'').replace(/"/g,'""')+'"'}).join(',')}).join('\\r\\n'),blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='已选群友-'+new Date().toISOString().slice(0,10)+'.csv';a.click();setTimeout(function(){URL.revokeObjectURL(url)},1000)}
  async function runBatch(){if(!selected.size){toastMessage('请先选择群友');return}var action=e('suiteBatchAction').value,skip=e('suiteBatchSkipConfirm').checked,payload={action:action,userIds:Array.from(selected),seconds:Number(e('suiteBatchSeconds').value||60),tag:e('suiteBatchTag').value,classification:e('suiteBatchClassification').value,protect:e('suiteBatchProtect').checked,allowOwnerUnmute:e('suiteBatchOwnerUnlock').checked,watched:true};if(!skip&&!confirm('确定对 '+selected.size+' 位群友执行批量操作？'))return;var out=e('suiteBatchResult');if(out)out.textContent='正在执行…';var r=await call('/members/batch','POST',payload);if(out)out.textContent=r.message||'操作完成';toastMessage(r.message||'操作完成');if(r.ok){selected.clear();updateSelected();if(typeof window.qqaiLoadMembers==='function')window.qqaiLoadMembers();setTimeout(loadProfiles,300)}}
  async function openProfile(qq){var r=await call('/members/profile?qq='+encodeURIComponent(qq));if(!r.ok){toastMessage(r.message||'读取失败');return}var p=r.profile||{};e('suiteProfileQq').value=qq;e('suiteProfileTitle').textContent='群友资料｜QQ '+qq;e('suiteProfileTags').value=(p.tags||[]).join('，');e('suiteProfileNote').value=p.note||'';e('suiteProfileWatched').checked=!!p.watched;e('suiteProfileAi').checked=p.aiUseAllowed!==false;e('suiteProfileClassification').value=p.classification||'';e('suiteProfilePanel').classList.remove('hidden');e('suiteProfilePanel').scrollIntoView({behavior:'smooth',block:'start'})}
  async function saveProfile(){var qq=e('suiteProfileQq').value,r=await call('/members/profile','POST',{qq:qq,tags:e('suiteProfileTags').value,note:e('suiteProfileNote').value,watched:e('suiteProfileWatched').checked,aiUseAllowed:e('suiteProfileAi').checked,classification:e('suiteProfileClassification').value});toastMessage(r.message||'操作完成');if(r.ok){suiteProfiles[qq]={tags:r.profile.tags,watched:r.profile.watched,classification:r.profile.classification,hasNote:!!r.profile.note};document.querySelectorAll('.suite-profile-summary').forEach(function(n){n.remove()});document.querySelectorAll('#memberList .member-row').forEach(function(row){delete row.dataset.suiteDecorated;row.querySelectorAll('.suite-select-wrap,.suite-profile-open').forEach(function(n){n.remove()})});decorateRows()}}
  async function loadStickers(){var r=await call('/members/stickers');if(!r.ok){e('suiteStickerList').innerHTML='<div class="empty">'+esc(r.message||'读取失败')+'</div>';return}suiteStickers=r.stickers||[];e('suiteStickerList').innerHTML=suiteStickers.map(function(s){return'<div class="item suite-sticker-row"><div><div class="member-name">'+esc(s.name)+'｜'+esc(s.category)+'</div><div class="member-meta">权重 '+s.weight+'｜'+(s.enabled?'启用':'停用')+'｜'+esc(s.file)+'</div></div><div><button class="btn suite-sticker-send" data-id="'+esc(s.id)+'">发送测试</button> <button class="btn danger suite-sticker-delete" data-id="'+esc(s.id)+'">删除</button></div></div>'}).join('')||'<div class="empty">当前没有表情</div>'}
  async function saveSticker(){var r=await call('/members/stickers','POST',{name:e('suiteStickerName').value,category:e('suiteStickerCategory').value,file:e('suiteStickerFile').value,weight:Number(e('suiteStickerWeight').value||10),enabled:e('suiteStickerEnabled').checked});toastMessage(r.message||'操作完成');if(r.ok){e('suiteStickerName').value='';e('suiteStickerFile').value='';loadStickers()}}
  async function loadPolicies(){var r=await call('/members/relationships/policies');if(!r.ok){e('suitePolicyList').innerHTML='<div class="empty">'+esc(r.message||'读取失败')+'</div>';return}suiteRelationships=r.relationships||[];var masters=suiteRelationships.filter(function(x){return x.mode==='master'});e('suitePolicyList').innerHTML=masters.map(function(x){var p=x.permissions||{},id=x.masterId||((x.userIds||[])[0]);return'<div class="item suite-policy-row" data-user-id="'+esc(id)+'"><div><div class="member-name">主人 QQ '+esc(x.masterId)+' → 所属成员 QQ '+esc(x.memberId)+'</div><div class="member-meta">踢出默认关闭；设置对关系双方同时生效。</div></div><div class="suite-policy-controls"><label><input class="pol-mute" type="checkbox" '+(p.mute!==false?'checked':'')+'>禁言</label><label><input class="pol-unmute" type="checkbox" '+(p.unmute!==false?'checked':'')+'>解禁</label><label><input class="pol-recall" type="checkbox" '+(p.recall!==false?'checked':'')+'>撤回</label><label><input class="pol-rename" type="checkbox" '+(p.rename!==false?'checked':'')+'>改名</label><label><input class="pol-kick" type="checkbox" '+(p.kick===true?'checked':'')+'>踢出</label><input class="pol-max" type="number" min="1" max="2592000" value="'+esc(p.maxMuteSeconds||1800)+'" title="最大禁言秒数"><button class="btn suite-policy-save">保存</button></div></div>'}).join('')||'<div class="empty">当前没有主人关系</div>'}
  async function savePolicy(button){var row=button.closest('.suite-policy-row'),r=await call('/members/relationships/policy','POST',{userId:row.dataset.userId,permissions:{mute:row.querySelector('.pol-mute').checked,unmute:row.querySelector('.pol-unmute').checked,recall:row.querySelector('.pol-recall').checked,rename:row.querySelector('.pol-rename').checked,kick:row.querySelector('.pol-kick').checked,maxMuteSeconds:Number(row.querySelector('.pol-max').value||1800)}});toastMessage(r.message||'操作完成');if(r.ok)loadPolicies()}
  async function loadDecisions(){var qs=new URLSearchParams({qq:e('suiteDecisionQq').value,decision:e('suiteDecisionType').value,q:e('suiteDecisionQuery').value,limit:'100'}),r=await call('/members/decisions?'+qs.toString());if(!r.ok){e('suiteDecisionList').innerHTML='<div class="empty">'+esc(r.message||'读取失败')+'</div>';return}suiteDecisions=r.logs||[];e('suiteDecisionList').innerHTML=suiteDecisions.map(function(x,i){return'<button class="item suite-decision-item" data-index="'+i+'"><div class="member-name">'+esc(x.decision||'未知')+'｜'+esc(x.reason||'无原因')+'</div><div class="member-meta">'+esc(x.senderName||x.userId||'')+'｜'+esc(x.triggerType||'')+'｜'+esc(x.at||x.createdAt||'')+'</div></button>'}).join('')||'<div class="empty">没有符合条件的决策记录</div>'}
  async function bootstrap(){var r=await call('/members');if(r.ok){suiteMembers=r.members||[];suiteRelationships=r.relationships||[]}await Promise.all([loadProfiles(),loadStickers(),loadPolicies()]);decorateRows();runDiagnostics();window.__qqaiCommunitySuite={version:'2.5.0',ready:true,loadedAt:Date.now()}}
  document.addEventListener('click',function(ev){var t=ev.target.closest&&ev.target.closest('button');if(!t)return;if(t.id==='suiteDiagnosticsRefresh')runDiagnostics();else if(t.id==='suiteClearSelection'){selected.clear();updateSelected()}else if(t.id==='suiteBatchRun')runBatch();else if(t.id==='suiteExportSelected')exportSelected();else if(t.classList.contains('suite-profile-open'))openProfile(t.dataset.qq);else if(t.id==='suiteProfileClose')e('suiteProfilePanel').classList.add('hidden');else if(t.id==='suiteProfileSave')saveProfile();else if(t.id==='suiteStickerRefresh')loadStickers();else if(t.id==='suiteStickerSave')saveSticker();else if(t.classList.contains('suite-sticker-delete'))call('/members/stickers/delete','POST',{id:t.dataset.id}).then(function(r){toastMessage(r.message||'操作完成');if(r.ok)loadStickers()});else if(t.classList.contains('suite-sticker-send'))call('/members/stickers/send','POST',{id:t.dataset.id}).then(function(r){toastMessage(r.message||'操作完成')});else if(t.id==='suitePolicyRefresh')loadPolicies();else if(t.classList.contains('suite-policy-save'))savePolicy(t);else if(t.id==='suiteDecisionRefresh')loadDecisions();else if(t.classList.contains('suite-decision-item')){var x=suiteDecisions[Number(t.dataset.index)];e('suiteDecisionDetail').textContent=JSON.stringify(x,null,2);e('suiteDecisionDetail').classList.remove('hidden')}});
  document.addEventListener('change',function(ev){if(ev.target.classList.contains('suite-member-select')){var qq=String(ev.target.dataset.qq||'');if(ev.target.checked)selected.add(qq);else selected.delete(qq);updateSelected()}if(ev.target.id==='suiteBatchProtect'){e('suiteBatchOwnerUnlock').disabled=!ev.target.checked;if(!ev.target.checked)e('suiteBatchOwnerUnlock').checked=false}});
  var root=e('memberList');if(root)new MutationObserver(function(){decorateRows()}).observe(root,{childList:true,subtree:true});
  document.addEventListener('click',function(ev){var t=ev.target.closest&&ev.target.closest('[data-view="members"],#memberConsoleNav');if(t)setTimeout(bootstrap,80)});
  if(e('v-members')&&e('v-members').classList.contains('active'))setTimeout(bootstrap,0);
})();
</script>`;
  return source.includes("</body>") ? source.replace("</body>", script + "\n</body>") : source + script;
}

export {
  classificationLabel,
  handleCommunitySuiteApi,
  injectCommunitySuiteClient,
  listMemberProfileSummaries,
  memberProfileKey,
  normalizeMemberProfile,
  readMemberProfile,
  writeMemberProfile
};
