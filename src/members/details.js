import { getAffinityProfile, isDeveloperId, recentConversationMessagesForUser } from "../core/identity.js";
import { callOneBotAction, writeSystemAudit } from "../core/permissions.js";
import { dbGet } from "../data/store.js";
import { getMuteLock } from "../moderation/mute-locks.js";
import { getPartnerBinding } from "../moderation/partner-bindings.js";
import { numericId } from "../security/network.js";

const SENSITIVE_KEY_RE = /(?:authorization|api[_-]?key|access[_-]?token|refresh[_-]?token|token|cookie|password|passwd|secret|private[_-]?key|session(?:id|_id)?|credential|bearer)/i;
const MAX_OBJECT_DEPTH = 7;
const MAX_ARRAY_ITEMS = 100;
const MAX_OBJECT_KEYS = 200;
const MAX_STRING_CHARS = 4000;

function cleanId(value) {
  return String(value || "").replace(/\D/g, "");
}

function safeJsonParse(value, fallback = null) {
  if (!value) return fallback;
  try { return JSON.parse(String(value)); } catch { return fallback; }
}

function normalizeEpochMs(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || number <= 0) return 0;
  return number > 100000000000 ? Math.trunc(number) : Math.trunc(number * 1000);
}

function sanitizeMemberDetailValue(value, key = "", depth = 0, seen = new WeakSet()) {
  if (SENSITIVE_KEY_RE.test(String(key || ""))) return "[已遮罩]";
  if (value == null) return value;
  if (["string", "number", "boolean"].includes(typeof value)) {
    return typeof value === "string" ? value.slice(0, MAX_STRING_CHARS) : value;
  }
  if (typeof value === "bigint") return String(value);
  if (typeof value !== "object") return String(value).slice(0, MAX_STRING_CHARS);
  if (depth >= MAX_OBJECT_DEPTH) return "[层级过深，已省略]";
  if (seen.has(value)) return "[循环引用，已省略]";
  seen.add(value);
  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY_ITEMS).map((item, index) => sanitizeMemberDetailValue(item, `${key}[${index}]`, depth + 1, seen));
  }
  const output = {};
  for (const [childKey, childValue] of Object.entries(value).slice(0, MAX_OBJECT_KEYS)) {
    output[String(childKey).slice(0, 120)] = sanitizeMemberDetailValue(childValue, childKey, depth + 1, seen);
  }
  return output;
}

function memberDetailAllowed(env, { actorId, targetId, actorRole = "member", permissions = {} } = {}) {
  const actor = cleanId(actorId);
  const target = cleanId(targetId);
  if (!actor || !target) return false;
  if (actor === target) return true;
  if (isDeveloperId(env, actor)) return true;
  return Boolean(
    permissions?.developer
    || permissions?.nativeAdmin
    || permissions?.groupOps
    || ["owner", "admin", "developer"].includes(String(actorRole || ""))
  );
}

function unwrapOneBotResponse(response) {
  return response?.data && typeof response.data === "object" ? response.data : response;
}

function honorRowsForUser(response, targetId) {
  const raw = unwrapOneBotResponse(response) || {};
  const target = cleanId(targetId);
  const rows = [];
  const add = (entry, type) => {
    if (!entry || cleanId(entry.user_id || entry.userId) !== target) return;
    rows.push({ type, ...sanitizeMemberDetailValue(entry) });
  };
  add(raw.current_talkative || raw.currentTalkative, "current_talkative");
  for (const [keys, type] of [
    [["talkative_list", "talkativeList"], "talkative"],
    [["performer_list", "performerList"], "performer"],
    [["legend_list", "legendList"], "legend"],
    [["strong_newbie_list", "strongNewbieList"], "strong_newbie"],
    [["emotion_list", "emotionList"], "emotion"]
  ]) {
    const list = keys.map(key => raw?.[key]).find(Array.isArray) || [];
    for (const entry of list) add(entry, type);
  }
  return rows;
}

async function getLiveDetailSource(env, action, params, timeoutMs = 15000) {
  try {
    const response = await callOneBotAction(env, { action, params }, timeoutMs);
    return { ok: true, value: sanitizeMemberDetailValue(unwrapOneBotResponse(response)) };
  } catch (error) {
    return { ok: false, error: String(error?.message || error).slice(0, 500), value: null };
  }
}

async function readStoredMemberSources(env, groupId, targetId) {
  const keys = {
    snapshot: `member_snapshot:${groupId}:${targetId}`,
    profile: `member_profile:${groupId}:${targetId}`,
    affinity: `affinity:${groupId}:${targetId}`,
    cachedMembers: `group_members:${groupId}`,
    enforcement: `rule_mute_enforcement:${groupId}:${targetId}`,
    selfMute: `self_mute:${groupId}:${targetId}`,
    contextSummary: `context_summary:chat:${groupId}:${targetId}`
  };
  const entries = await Promise.all(Object.entries(keys).map(async ([name, key]) => [name, safeJsonParse(await dbGet(env, key), null)]));
  const stored = Object.fromEntries(entries);
  const cachedList = Array.isArray(stored.cachedMembers) ? stored.cachedMembers : [];
  stored.cachedMember = cachedList.find(item => cleanId(item?.qq || item?.user_id) === targetId) || null;
  delete stored.cachedMembers;
  return sanitizeMemberDetailValue(stored);
}

function buildMessageStats(records) {
  const rows = Array.isArray(records) ? records : [];
  const timestamps = rows.map(item => Number(item?.createdAt || item?.at || 0)).filter(value => value > 0).sort((a, b) => a - b);
  const directCount = rows.filter(item => item?.direct).length;
  const imageCount = rows.filter(item => item?.hasImage || item?.imageUrl || item?.imageFile).length;
  return {
    retainedRecordCount: rows.length,
    firstRetainedAt: timestamps[0] || 0,
    lastRetainedAt: timestamps[timestamps.length - 1] || 0,
    directInteractionCount: directCount,
    imageMessageCount: imageCount
  };
}

async function collectFullMemberDetails(env, { groupId, targetId, actorId, actorRole = "member", permissions = {} } = {}) {
  const group = cleanId(groupId);
  const target = cleanId(targetId);
  const actor = cleanId(actorId);
  if (!group || !target) throw new Error("群号或目标 QQ 无效。");
  if (!memberDetailAllowed(env, { actorId: actor, targetId: target, actorRole, permissions })) {
    throw new Error("只能查询自己的完整资料；查询其他成员仅限本群管理员、群主、获授群操作权限者或开发者。");
  }

  const [groupInfo, strangerInfo, honorResponse, stored, muteLock, relationship, affinity, records] = await Promise.all([
    getLiveDetailSource(env, "get_group_member_info", { group_id: numericId(group), user_id: numericId(target), no_cache: true }),
    getLiveDetailSource(env, "get_stranger_info", { user_id: numericId(target), no_cache: true }),
    getLiveDetailSource(env, "get_group_honor_info", { group_id: numericId(group), type: "all" }),
    readStoredMemberSources(env, group, target),
    getMuteLock(env, group, target).catch(error => ({ readError: String(error?.message || error).slice(0, 500) })),
    getPartnerBinding(env, group, target).catch(error => ({ readError: String(error?.message || error).slice(0, 500) })),
    getAffinityProfile(env, { groupId: group, userId: target, refreshAi: false }).catch(error => ({ readError: String(error?.message || error).slice(0, 500) })),
    recentConversationMessagesForUser(env, group, target, 200).catch(() => [])
  ]);

  const honorRows = honorResponse.ok ? honorRowsForUser(honorResponse.value, target) : [];
  const liveMember = groupInfo.value && typeof groupInfo.value === "object" ? groupInfo.value : {};
  const result = {
    generatedAt: Date.now(),
    groupId: group,
    targetId: target,
    viewer: { actorId: actor, actorRole: String(actorRole || "member"), self: actor === target },
    identitySummary: {
      qq: target,
      nickname: String(liveMember.nickname || strangerInfo.value?.nickname || stored?.snapshot?.nickname || stored?.cachedMember?.nickname || ""),
      card: String(liveMember.card || stored?.snapshot?.card || stored?.cachedMember?.card || ""),
      role: String(liveMember.role || stored?.snapshot?.role || stored?.cachedMember?.role || "unknown"),
      sex: String(liveMember.sex || strangerInfo.value?.sex || stored?.snapshot?.sex || "unknown"),
      age: Number(liveMember.age || strangerInfo.value?.age || stored?.snapshot?.age || 0),
      area: String(liveMember.area || strangerInfo.value?.area || stored?.snapshot?.area || ""),
      joinTime: normalizeEpochMs(liveMember.join_time ?? liveMember.joinTime ?? stored?.snapshot?.joinTime),
      lastSentTime: normalizeEpochMs(liveMember.last_sent_time ?? liveMember.lastSentTime ?? stored?.snapshot?.lastSentTime),
      title: String(liveMember.title || liveMember.special_title || stored?.snapshot?.title || ""),
      titleExpireTime: normalizeEpochMs(liveMember.title_expire_time ?? liveMember.titleExpireTime ?? stored?.snapshot?.titleExpireTime),
      muteUntil: normalizeEpochMs(liveMember.shut_up_timestamp ?? liveMember.muteUntil ?? stored?.snapshot?.muteUntil),
      qqLevel: Number(liveMember.qq_level ?? liveMember.qqLevel ?? strangerInfo.value?.qq_level ?? stored?.snapshot?.qqLevel ?? 0),
      groupLevel: String(liveMember.level || stored?.snapshot?.level || ""),
      unfriendly: Boolean(liveMember.unfriendly ?? stored?.snapshot?.unfriendly),
      cardChangeable: liveMember.card_changeable ?? liveMember.cardChangeable ?? stored?.snapshot?.cardChangeable ?? null,
      isRobot: Boolean(liveMember.is_robot || liveMember.isRobot || stored?.snapshot?.isRobot || stored?.cachedMember?.isRobot)
    },
    liveSources: {
      groupMemberInfo: groupInfo,
      strangerInfo,
      honors: { ok: honorResponse.ok, error: honorResponse.error || "", rows: honorRows }
    },
    storedSources: stored,
    operationalState: {
      muteLock: sanitizeMemberDetailValue(muteLock),
      relationship: sanitizeMemberDetailValue(relationship),
      affinity: sanitizeMemberDetailValue(affinity),
      messageStats: buildMessageStats(records)
    },
    disclosure: {
      includes: "OneBot 即时成员资料、陌生人补充资料、群荣誉、D1 成员快照、管理备注、关系、禁言锁、好感与留存消息统计。",
      excludes: "密码、Token、Cookie、API Key、授权标头、Session、私钥等秘密字段会被遮罩；平台未返回的资料不会推测。",
      rawMessageBodiesIncluded: false
    }
  };
  await writeSystemAudit(env, {
    type: "member_full_details_viewed",
    groupId: group,
    actorId: actor,
    targetId: target,
    action: actor === target ? "self_view" : "privileged_view",
    liveGroupInfoOk: groupInfo.ok,
    liveStrangerInfoOk: strangerInfo.ok,
    liveHonorInfoOk: honorResponse.ok
  }).catch(() => {});
  return sanitizeMemberDetailValue(result);
}

function valueText(value) {
  if (value == null || value === "") return "未提供";
  if (typeof value === "boolean") return value ? "是" : "否";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

function dateText(value) {
  const time = Number(value || 0);
  if (!time) return "未提供";
  try { return new Date(time).toLocaleString("zh-CN", { timeZone: "Asia/Taipei", hour12: false }); } catch { return new Date(time).toISOString(); }
}

function formatFullMemberDetailsReport(details) {
  const summary = details?.identitySummary || {};
  const stats = details?.operationalState?.messageStats || {};
  const lines = [
    `【成员完整资料】`,
    `群号：${details?.groupId || ""}`,
    `目标 QQ：${details?.targetId || ""}`,
    `昵称：${valueText(summary.nickname)}`,
    `群名片：${valueText(summary.card)}`,
    `身份：${valueText(summary.role)}`,
    `性别：${valueText(summary.sex)}｜年龄：${summary.age || "未提供"}｜地区：${valueText(summary.area)}`,
    `入群时间：${dateText(summary.joinTime)}`,
    `最近发言：${dateText(summary.lastSentTime)}`,
    `群等级：${valueText(summary.groupLevel)}｜QQ 等级：${summary.qqLevel || "未提供"}`,
    `专属头衔：${valueText(summary.title)}｜头衔到期：${dateText(summary.titleExpireTime)}`,
    `禁言到期：${dateText(summary.muteUntil)}｜不友好标记：${valueText(summary.unfriendly)}`,
    `允许改群名片：${summary.cardChangeable == null ? "平台未提供" : valueText(summary.cardChangeable)}｜机器人：${valueText(summary.isRobot)}`,
    `已保存消息统计：${Number(stats.retainedRecordCount || 0)} 条｜直接互动 ${Number(stats.directInteractionCount || 0)} 条｜图片 ${Number(stats.imageMessageCount || 0)} 条`,
    `统计范围：${dateText(stats.firstRetainedAt)} ～ ${dateText(stats.lastRetainedAt)}`,
    ``,
    `【管理与关系状态】`,
    valueText(details?.operationalState || {}),
    ``,
    `【OneBot 即时原始资料】`,
    valueText(details?.liveSources || {}),
    ``,
    `【D1 已保存完整资料】`,
    valueText(details?.storedSources || {}),
    ``,
    `【资料边界】`,
    details?.disclosure?.includes || "",
    details?.disclosure?.excludes || "",
    `原始聊天正文：未包含。`
  ];
  return lines.join("\n");
}

export {
  SENSITIVE_KEY_RE,
  collectFullMemberDetails,
  formatFullMemberDetailsReport,
  honorRowsForUser,
  memberDetailAllowed,
  sanitizeMemberDetailValue
};
