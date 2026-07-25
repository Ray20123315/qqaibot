// Extracted from worker.js without behavioral changes.
// Cloudflare still deploys worker.js as the single Worker entry point.

import { callDeepSeekSummaryTask } from "../ai/runtime.js";
import { DEFAULTS } from "../config/runtime.js";
import { developerId, isDeveloperId } from "./identity.js";
import { dbDel, dbGet, dbPut } from "../data/store.js";
import { parseUnlimitedNonNegativeInteger } from "../moderation/runtime.js";
import { getOneBotHub, readJson, sha256Hex } from "../portal/auth.js";
import { numericId } from "../security/network.js";



const PERMISSIONS = Object.freeze({
  AI_ADMIN: "ai_admin",
  GROUP_OPS: "group_ops",
  SCHEDULE_REVIEWER: "schedule_reviewer",
  APPEAL_REVIEWER: "appeal_reviewer",
  PRIVATE_FULL: "private_full",
  PRIVATE_COMMANDS: "private_commands",
});



function normalizePermissionName(value) {
  const text = String(value || "").trim().toLowerCase().replace(/\s+/g, "");
  const map = new Map([
    ["ai管理", PERMISSIONS.AI_ADMIN], ["ai管理员", PERMISSIONS.AI_ADMIN], ["ai管理員", PERMISSIONS.AI_ADMIN], ["ai_admin", PERMISSIONS.AI_ADMIN],
    ["群操作", PERMISSIONS.GROUP_OPS], ["群管理操作", PERMISSIONS.GROUP_OPS], ["group_ops", PERMISSIONS.GROUP_OPS],
    ["排程审核", PERMISSIONS.SCHEDULE_REVIEWER], ["排程審核", PERMISSIONS.SCHEDULE_REVIEWER], ["schedule_reviewer", PERMISSIONS.SCHEDULE_REVIEWER],
    ["申诉审核", PERMISSIONS.APPEAL_REVIEWER], ["申訴審核", PERMISSIONS.APPEAL_REVIEWER], ["appeal_reviewer", PERMISSIONS.APPEAL_REVIEWER],
    ["私聊完整", PERMISSIONS.PRIVATE_FULL], ["private_full", PERMISSIONS.PRIVATE_FULL],
    ["私聊指令", PERMISSIONS.PRIVATE_COMMANDS], ["private_commands", PERMISSIONS.PRIVATE_COMMANDS],
  ]);
  return map.get(text) || null;
}



function permissionLabel(permission) {
  return ({
    ai_admin: "AI管理",
    group_ops: "群操作",
    schedule_reviewer: "排程审核",
    appeal_reviewer: "申诉审核",
    private_full: "完整私聊",
    private_commands: "私聊指令",
  })[permission] || permission;
}



function explicitProgramPermissionIndexKey(groupId) {
  return `permission_explicit_index:${groupId}`;
}



async function updateExplicitProgramPermissionIndex(env, groupId, userId) {
  const indexKey = explicitProgramPermissionIndexKey(groupId);
  const list = await readJson(env, indexKey, []);
  const normalized = [...new Set((Array.isArray(list) ? list : []).map(value => String(value || "").replace(/\D/g, "")).filter(Boolean))];
  const hasAiAdmin = await dbGet(env, `permission:${groupId}:${userId}:${PERMISSIONS.AI_ADMIN}`) === "true";
  const hasGroupOps = await dbGet(env, `permission:${groupId}:${userId}:${PERMISSIONS.GROUP_OPS}`) === "true";
  const next = hasAiAdmin || hasGroupOps
    ? [...new Set([...normalized, String(userId)])]
    : normalized.filter(value => value !== String(userId));
  await dbPut(env, indexKey, JSON.stringify(next.slice(-1000)));
  return next;
}



async function listExplicitProgramPermissions(env, groupId) {
  const indexed = await readJson(env, explicitProgramPermissionIndexKey(groupId), []);
  const audits = await readJson(env, `audit:system:group:${groupId}`, []);
  const candidates = new Set((Array.isArray(indexed) ? indexed : []).map(value => String(value || "").replace(/\D/g, "")).filter(Boolean));
  for (const entry of Array.isArray(audits) ? audits : []) {
    if (entry?.type !== "permission") continue;
    const action = String(entry.action || "");
    if (!/^(?:grant|revoke):(?:ai_admin|group_ops)$/.test(action)) continue;
    const qq = String(entry.targetId || "").replace(/\D/g, "");
    if (qq) candidates.add(qq);
  }

  let members = await readJson(env, `group_members:${groupId}`, []);
  try {
    const live = await callOneBotAction(env, { action: "get_group_member_list", params: { group_id: numericId(groupId), no_cache: false } }, 12000);
    const rows = Array.isArray(live) ? live : (Array.isArray(live?.data) ? live.data : []);
    if (rows.length) {
      members = rows.map(member => ({
        qq: String(member.user_id || member.qq || ""),
        user_id: String(member.user_id || member.qq || ""),
        card: String(member.card || ""),
        nickname: String(member.nickname || member.name || ""),
        role: String(member.role || "member")
      }));
      await dbPut(env, `group_members:${groupId}`, JSON.stringify(members.slice(0, 1000)));
    }
  } catch {}
  const directory = new Map((Array.isArray(members) ? members : []).map(member => [String(member.qq || member.user_id || ""), member]));
  const records = [];
  for (const qq of candidates) {
    const aiAdmin = await dbGet(env, `permission:${groupId}:${qq}:${PERMISSIONS.AI_ADMIN}`) === "true";
    const groupOps = await dbGet(env, `permission:${groupId}:${qq}:${PERMISSIONS.GROUP_OPS}`) === "true";
    if (!aiAdmin && !groupOps) continue;
    let member = directory.get(qq) || null;
    if (!member) {
      try {
        const live = await callOneBotAction(env, { action: "get_group_member_info", params: { group_id: numericId(groupId), user_id: numericId(qq), no_cache: false } }, 8000);
        if (live) member = { qq, card: live.card || "", nickname: live.nickname || live.name || "", role: live.role || "member" };
      } catch {}
    }
    const displayName = String(member?.card || member?.nickname || qq).trim() || qq;
    records.push({
      qq,
      displayName,
      card: String(member?.card || ""),
      nickname: String(member?.nickname || ""),
      role: String(member?.role || "member"),
      permissions: [aiAdmin ? PERMISSIONS.AI_ADMIN : "", groupOps ? PERMISSIONS.GROUP_OPS : ""].filter(Boolean)
    });
  }
  records.sort((a, b) => a.displayName.localeCompare(b.displayName, "zh-CN") || a.qq.localeCompare(b.qq));
  await dbPut(env, explicitProgramPermissionIndexKey(groupId), JSON.stringify(records.map(record => record.qq).slice(-1000)));
  return records;
}



async function setExplicitPermission(env, groupId, userId, permission, enabled) {
  if (permission === PERMISSIONS.PRIVATE_FULL || permission === PERMISSIONS.PRIVATE_COMMANDS) {
    if (enabled) await dbPut(env, `private_access:${userId}`, permission === PERMISSIONS.PRIVATE_FULL ? "full" : "commands");
    else await dbPut(env, `private_access:${userId}`, "none");
    return;
  }
  const key = `permission:${groupId}:${userId}:${permission}`;
  if (enabled) await dbPut(env, key, "true"); else await dbDel(env, key);
  if (permission === PERMISSIONS.AI_ADMIN || permission === PERMISSIONS.GROUP_OPS) {
    await updateExplicitProgramPermissionIndex(env, groupId, userId);
  }
  await writeSystemAudit(env, { type: "permission", groupId, actorId: developerId(env), targetId: userId, action: enabled ? `grant:${permission}` : `revoke:${permission}` });
}



async function getEffectivePermissions(env, groupId, userId, senderRole = "member", isDeveloper = false) {
  const developer = isDeveloper || isDeveloperId(env, userId);
  const nativeAdmin = senderRole === "owner" || senderRole === "admin";
  const legacyAdmin = await dbGet(env, `admin_auth:${userId}`) === "true";
  const explicit = async p => await dbGet(env, `permission:${groupId}:${userId}:${p}`) === "true";
  const aiAdmin = developer || nativeAdmin || legacyAdmin || await explicit(PERMISSIONS.AI_ADMIN);
  const groupOps = developer || nativeAdmin || await explicit(PERMISSIONS.GROUP_OPS);
  const scheduleReviewer = developer || nativeAdmin || await explicit(PERMISSIONS.SCHEDULE_REVIEWER);
  const appealReviewer = developer || nativeAdmin || await explicit(PERMISSIONS.APPEAL_REVIEWER);
  return { developer, nativeAdmin, aiAdmin, groupOps, scheduleReviewer, appealReviewer };
}



async function getRuntimeRateLimitSeconds(env, groupId) {
  const groupRaw = groupId ? await dbGet(env, `runtime_rate_limit_seconds:group:${groupId}`) : null;
  if (groupRaw !== null && groupRaw !== undefined && groupRaw !== "") return parseUnlimitedNonNegativeInteger(groupRaw, DEFAULTS.runtimeRateLimitSeconds);
  const globalRaw = await dbGet(env, "runtime_rate_limit_seconds:global");
  return parseUnlimitedNonNegativeInteger(globalRaw, DEFAULTS.runtimeRateLimitSeconds);
}



async function checkRuntimeRateLimit(env, { groupId, userId, isPrivate }) {
  const seconds = await getRuntimeRateLimitSeconds(env, groupId);
  if (seconds <= 0) return { allowed: true, seconds: 0, remaining: 0 };
  const key = `runtime_rate_limit_last:${isPrivate ? "private" : "group"}:${groupId || ""}:${userId}`;
  const now = Date.now();
  const lastAt = Number(await dbGet(env, key) || 0);
  const remainingMs = seconds * 1000 - (now - lastAt);
  if (lastAt && remainingMs > 0) return { allowed: false, seconds, remaining: Math.ceil(remainingMs / 1000) };
  await dbPut(env, key, String(now));
  return { allowed: true, seconds, remaining: 0 };
}



async function writeSystemAudit(env, entry) {
  const item = { id: crypto.randomUUID(), at: new Date().toISOString(), ...entry };
  const keys = ["audit:system:global"];
  if (entry.groupId) keys.push(`audit:system:group:${entry.groupId}`);
  for (const key of keys) {
    const list = await readJson(env, key, []);
    list.push(item);
    await dbPut(env, key, JSON.stringify(list.slice(-1000)));
  }
  return item;
}



async function enrichAuditLogsForPortal(env, logs) {
  const proposalCache = new Map();
  const appealCache = new Map();
  const memberDirectories = new Map();

  async function memberDirectory(groupId) {
    const key = String(groupId || "");
    if (!key) return new Map();
    if (memberDirectories.has(key)) return memberDirectories.get(key);
    let members = [];
    try {
      const live = await callOneBotAction(env, { action: "get_group_member_list", params: { group_id: numericId(key), no_cache: false } }, 12000);
      members = Array.isArray(live) ? live : (Array.isArray(live?.data) ? live.data : []);
      if (members.length) await dbPut(env, `group_members:${key}`, JSON.stringify(members.map(member => ({
        qq: String(member.user_id || member.qq || ""),
        user_id: String(member.user_id || member.qq || ""),
        card: member.card || "",
        nickname: member.nickname || member.name || "",
        role: member.role || "member"
      }))));
    } catch {
      members = await readJson(env, `group_members:${key}`, []);
    }
    const map = new Map();
    for (const member of members || []) {
      const id = String(member.user_id || member.qq || "");
      if (id) map.set(id, member);
    }
    memberDirectories.set(key, map);
    return map;
  }

  function roleOfMember(member, id) {
    if (isDeveloperId(env, id)) return "developer";
    if (member?.role === "owner") return "owner";
    if (member?.role === "admin") return "admin";
    return "member";
  }

  const output = [];
  for (const item of Array.isArray(logs) ? logs : []) {
    let next = { ...item };
    const proposalId = String(item?.proposalId || "");
    if (proposalId) {
      let proposal = proposalCache.get(proposalId);
      if (proposal === undefined) {
        proposal = await readJson(env, `moderation:proposal:${proposalId}`, null);
        proposalCache.set(proposalId, proposal || null);
      }
      if (proposal) {
        next = {
          ...next,
          action: next.action || proposal.action,
          targetId: next.targetId || proposal.targetId,
          targetName: next.targetName || proposal.targetName,
          actorName: next.actorName || proposal.actorName,
          actorRole: next.actorRole || proposal.actorRole,
          durationSeconds: Number(next.durationSeconds || proposal.durationSeconds || 0),
          classifierReason: next.classifierReason || proposal.classifierReason,
          proposalStatus: proposal.status || "",
          proposalResult: proposal.result || ""
        };
      }
    }

    const groupId = String(next.groupId || "");
    const directory = await memberDirectory(groupId);
    const actorId = String(next.actorId || "");
    if (actorId && actorId !== "system" && !actorId.startsWith("system:")) {
      const actorMember = directory.get(actorId);
      next.actorName = next.actorName || actorMember?.card || actorMember?.nickname || actorMember?.name || "";
      next.actorRole = next.actorRole || roleOfMember(actorMember, actorId);
    }

    const targetId = String(next.targetId || "");
    if (/^app_/i.test(targetId) || next.type === "appeal_review" || next.type === "violation_appeal_submitted") {
      let appeal = appealCache.get(targetId);
      if (appeal === undefined) {
        appeal = targetId ? await readJson(env, `appeal:${targetId}`, null) : null;
        appealCache.set(targetId, appeal || null);
      }
      next.targetKind = "appeal";
      next.targetName = next.targetName || appeal?.anonymousLabel || "申诉案件";
      next.appealType = appeal?.type || "";
      next.appealStatus = appeal?.status || "";
      next.violationIds = next.violationIds || appeal?.violationIds || [];
    } else if (/^\d{5,}$/.test(targetId)) {
      const targetMember = directory.get(targetId);
      next.targetName = next.targetName || targetMember?.card || targetMember?.nickname || targetMember?.name || "";
      next.targetRole = next.targetRole || roleOfMember(targetMember, targetId);
    }
    output.push(next);
  }
  return output;
}



async function writeAiDecisionLog(env, data) {
  const id = String(data?.id || `ai_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`);
  const item = {
    at: new Date().toISOString(),
    createdAt: Date.now(),
    decision: "unknown",
    reason: "",
    sendStatus: "not_applicable",
    searchRequired: false,
    searchAttempted: false,
    searchPerformed: false,
    searchQuery: "",
    searchContext: "",
    searchSources: [],
    searchQueries: [],
    searchProvider: "",
    searchModel: "",
    searchError: "",
    ...data,
    id
  };
  await dbPut(env, `ai_decision_log:${id}`, JSON.stringify(item));
  await appendIndex(env, "ai_decision_log:index", id, DEFAULTS.aiDecisionLogLimit);
  if (item.groupId) await appendIndex(env, `ai_decision_log:index:${item.groupId}`, id, DEFAULTS.aiDecisionLogLimit);
  return item;
}



async function updateAiDecisionLog(env, id, patch = {}) {
  if (!id) return null;
  const current = await readJson(env, `ai_decision_log:${id}`, null);
  if (!current) return null;
  const next = { ...current, ...patch, id: current.id, updatedAt: Date.now() };
  await dbPut(env, `ai_decision_log:${id}`, JSON.stringify(next));
  return next;
}



async function listAiDecisionLogs(env, { groupId = "", query = "", decision = "", triggerType = "", limit = 300 } = {}) {
  const ids = await readJson(env, groupId ? `ai_decision_log:index:${groupId}` : "ai_decision_log:index", []);
  const out = [];
  const q = String(query || "").trim().toLowerCase();
  for (const id of ids.slice(-Math.max(1, Math.min(DEFAULTS.aiDecisionLogLimit, Number(limit) * 5))).reverse()) {
    const item = await readJson(env, `ai_decision_log:${id}`, null);
    if (!item) continue;
    if (groupId && String(item.groupId || "") !== String(groupId)) continue;
    if (decision && String(item.decision || "") !== String(decision)) continue;
    if (triggerType && String(item.triggerType || "") !== String(triggerType)) continue;
    if (q && !JSON.stringify(item).toLowerCase().includes(q)) continue;
    out.push(item);
    if (out.length >= Math.max(1, Math.min(1000, Number(limit) || 300))) break;
  }
  return out;
}



async function buildLongGroupConversationContext(env, { groupId, userId, logs, currentText, relationContext }) {
  const list = (Array.isArray(logs) ? logs : []).map(String).filter(Boolean).slice(-DEFAULTS.groupContextMaximumMessages);
  if (!list.length) return null;
  const exactCount = Math.min(DEFAULTS.groupContextExactMessages, list.length);
  const exact = list.slice(-exactCount);
  const older = list.slice(0, -exactCount);
  let summary = "";
  let summaryProvider = "";
  if (older.length >= 16) {
    const cacheKey = `context_summary:long_group:${groupId}`;
    const cached = await readJson(env, cacheKey, null);
    const signature = await sha256Hex(older.join("\n"));
    const freshEnough = cached?.summary && Date.now() - Number(cached.updatedAt || 0) < 3 * 60 * 1000;
    if (cached?.signature === signature || freshEnough) {
      summary = String(cached.summary || "");
      summaryProvider = String(cached.provider || "cache");
    } else {
      const prompt = `请压缩以下 QQ 群较早的对话。保留：每个人的昵称与 QQ、谁在回复谁、@对象、正在讨论的主题、关键事实、笑点、争议、未解决的问题。不得把被 @ 的人当成发言者，不得编造。\n\n${older.join("\n")}`;
      const system = "你是群聊长上下文整理器，只做信息压缩，不做是否回复、插话或安全判断。输出简体中文，尽量紧凑。";
      try {
        const result = await callDeepSeekSummaryTask(env, {
          prompt, system, userId: String(userId || "context-summary"), groupId: String(groupId || "context-summary"), maxTokens: 1200
        });
        summary = result.text;
        summaryProvider = result.provider || "deepseek";
      } catch (summaryError) {
        console.warn("Long-context summary unavailable:", summaryError?.message || summaryError);
        summary = String(cached?.summary || "");
        summaryProvider = summary ? String(cached?.provider || "stale_cache") : "";
      }
      if (summary) await dbPut(env, cacheKey, JSON.stringify({ signature, summary, provider: summaryProvider, updatedAt: Date.now(), sourceCount: older.length }));
    }
  }
  const sections = [];
  if (summary) sections.push(`较早对话摘要：\n${summary}`);
  sections.push(`最近 ${exact.length} 条原始群聊（按时间顺序，必须精确区分发言者、引用者与被 @ 对象）：\n${exact.join("\n")}`);
  if (currentText || relationContext) sections.push(`当前触发消息关系：\n${relationContext || "无引用／@关系"}\n当前正文：${currentText || ""}`);
  return { text: sections.join("\n\n"), summary, summaryProvider, exactCount: exact.length, summarizedCount: older.length, totalCount: list.length };
}



async function appendIndex(env, key, id, max = 2000) {
  const list = await readJson(env, key, []);
  if (!list.includes(id)) list.push(id);
  await dbPut(env, key, JSON.stringify(list.slice(-max)));
}



async function removeFromIndex(env, key, id) {
  const list = await readJson(env, key, []);
  await dbPut(env, key, JSON.stringify(list.filter(x => x !== id)));
}



function normalizeMemoryItems(value, owner = "") {
  const list = Array.isArray(value) ? value : [];
  return list.map(item => {
    if (typeof item === "string") return { id: crypto.randomUUID(), text: item, scope: "private", owner, migrated: true };
    if (item && typeof item === "object") return { id: item.id || crypto.randomUUID(), text: String(item.text || ""), scope: item.scope || "private", owner: String(item.owner || owner), ...item };
    return null;
  }).filter(item => item && item.text.trim());
}



function normalizeModelPreference(value) {
  const text = String(value || "").trim().toLowerCase().replace(/[ _-]+/g, "");
  if (["自动", "自動", "auto"].includes(text)) return "auto";
  if (["gemini", "谷歌"].includes(text)) return "gemini";
  if (["gemma26", "gemma26b", "gemma426b", "gemma426ba4bit", "26b", "便宜", "快速gemma"].includes(text)) return "gemma_26b";
  if (["gemma", "gemma31", "gemma31b", "gemma431b", "gemma431bit", "31b", "gemma高质量", "gemma高品質"].includes(text)) return "gemma_31b";
  if (["deepseek", "deepseek不思考", "deepseekoff"].includes(text)) return "deepseek";
  if (["deepseekhigh", "high", "深度思考"].includes(text)) return "deepseek_high";
  if (["deepseekmax", "max", "极限", "極限"].includes(text)) return "deepseek_max";
  return null;
}



function modelPreferenceLabel(value) {
  return ({
    auto: "自动（Gemini 优先／Gemma 备用；连续失败时才临时启用 DeepSeek）",
    gemini: "Gemini 免费聊天池",
    gemma_26b: "Gemma 4 26B",
    gemma_31b: "Gemma 4 31B",
    deepseek: "DeepSeek（仅开发者）",
    deepseek_high: "DeepSeek High（仅开发者）",
    deepseek_max: "DeepSeek Max（仅开发者）"
  })[value] || "自动（Gemini 优先／Gemma 备用）";
}



function modelHealthStatusLabel(value) {
  const status = String(value || "unknown").toLowerCase();
  return ({ ok: "正常", warning: "警告", error: "异常", unknown: "尚未检查", unconfigured: "未配置", disabled: "已关闭" })[status] || status;
}



function modelHealthStatusRank(value) {
  return ({ ok: 6, warning: 5, error: 4, unknown: 3, unconfigured: 2, disabled: 1 })[String(value || "unknown").toLowerCase()] || 0;
}



function modelCapabilityLabel(value) {
  return ({ text: "文本", chat: "聊天", routing: "路由", decision: "审查判断", context_summary: "上下文整理", code: "代码", vision: "图片理解", emergency_chat: "紧急聊天" })[String(value || "")] || String(value || "");
}



function normalizeFingerprintText(text) {
  return String(text || "")
    .replace(/\[CQ:[^\]]+\]/g, "")
    .replace(/@\d{5,}/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4000);
}



function outboundFingerprint(info) {
  const payload = [info.isGroup ? "g" : "p", String(info.groupId || info.peerId || ""), normalizeFingerprintText(info.text), ...(info.mediaTypes || []).sort()].join("|");
  let hash = 2166136261;
  for (let i = 0; i < payload.length; i++) { hash ^= payload.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0).toString(16);
}



async function markOutboundPending(env, info) {
  const key = `outbound_pending:${outboundFingerprint(info)}`;
  // 僅保存短期去重時間戳；不保存任何指令或回覆正文。
  await dbPut(env, key, JSON.stringify({ at: Date.now() }));
  return key;
}



async function isKnownOutboundMessage(env, info) {
  if (info.messageId) {
    const raw = await dbGet(env, `outbound:${info.messageId}`);
    if (raw) {
      const item = (() => { try { return JSON.parse(raw); } catch { return { at: Number(raw) || Date.now() }; } })();
      if (Date.now() - Number(item.at || 0) < 10 * 60 * 1000) return true;
    }
  }
  const key = `outbound_pending:${outboundFingerprint(info)}`;
  const raw = await dbGet(env, key);
  if (!raw) return false;
  let item = null;
  try { item = JSON.parse(raw); } catch {}
  if (!item || Date.now() - Number(item.at || 0) > 2 * 60 * 1000) { await dbDel(env, key); return false; }
  await dbDel(env, key);
  return true;
}



async function callOneBotAction(env, actionPayload, timeoutMs = 15000) {
  if (!env.ONEBOT_HUB) throw new Error("ONEBOT_HUB_NOT_BOUND");
  const payload = actionPayload.action ? actionPayload : { action: actionPayload?.action, params: actionPayload?.params || {} };
  const res = await getOneBotHub(env).fetch("https://onebot-hub/rpc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, timeoutMs })
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) throw new Error(data?.error || `ONEBOT_RPC_${res.status}`);
  return data.data;
}

export { PERMISSIONS, appendIndex, buildLongGroupConversationContext, callOneBotAction, checkRuntimeRateLimit, enrichAuditLogsForPortal, explicitProgramPermissionIndexKey, getEffectivePermissions, getRuntimeRateLimitSeconds, isKnownOutboundMessage, listAiDecisionLogs, listExplicitProgramPermissions, markOutboundPending, modelCapabilityLabel, modelHealthStatusLabel, modelHealthStatusRank, modelPreferenceLabel, normalizeFingerprintText, normalizeMemoryItems, normalizeModelPreference, normalizePermissionName, outboundFingerprint, permissionLabel, removeFromIndex, setExplicitPermission, updateAiDecisionLog, updateExplicitProgramPermissionIndex, writeAiDecisionLog, writeSystemAudit };
