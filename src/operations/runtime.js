// Extracted from worker.js without behavioral changes.
// Cloudflare still deploys worker.js as the single Worker entry point.

import { callGemmaDecision, callGoogleDecision } from "../ai/runtime.js";
import { DEFAULTS, VERSION } from "../config/runtime.js";
import { isDeveloperId } from "../core/identity.js";
import { appendIndex, callOneBotAction, listAiDecisionLogs, writeSystemAudit } from "../core/permissions.js";
import { dbDel, dbGet, dbPut } from "../data/store.js";
import { canUseBotGroupOperations, getBotGroupRole, getBotIdentity } from "../group/runtime.js";
import { createGroupWorkRequest, extractOneBotMessageId, normalizeRuleStrictness } from "../moderation/runtime.js";
import { PORTAL_SETTING_DEFINITIONS, jsonResponse, readJson, readPortalSettingValue, resolvePortalRole, sendPortalVerificationMessage, writePortalSettingValue } from "../portal/auth.js";
import { cancelSchedule, computeNextScheduleRun, createScheduleRecord, extractScheduleMentionIds, listUserSchedules, parseManagementScheduleAction, parseScheduleRequest, parseTaipeiDateTime, reviewScheduleWithGemma, taipeiParts } from "../scheduler/runtime.js";
import { numericId } from "../security/network.js";




// -----------------------------------------------------------------------------
// v1.3.0 Operations Suite：权限化活动、投票、草稿、知识、维护与诊断中心
// -----------------------------------------------------------------------------

const OPS_CAPABILITIES = Object.freeze([
  { id: "operations.view", name: "查看营运中心", minRole: "member" },
  { id: "activity.view", name: "查看活动", minRole: "member" },
  { id: "activity.join", name: "报名／取消报名", minRole: "member" },
  { id: "activity.manage", name: "建立与管理活动", minRole: "admin" },
  { id: "activity.cross_group", name: "跨独立群统整活动", minRole: "owner" },
  { id: "activity.invite", name: "发送活动群邀请／批准待处理申请", minRole: "owner" },
  { id: "activity.announce", name: "发送活动报名通知", minRole: "admin" },
  { id: "activity.mention_all", name: "活动通知 @全体成员", minRole: "owner" },
  { id: "poll.view", name: "查看投票", minRole: "member" },
  { id: "poll.vote", name: "参与投票", minRole: "member" },
  { id: "poll.manage", name: "建立与管理投票", minRole: "admin" },
  { id: "schedule.view", name: "查看排程预览与冲突", minRole: "member" },
  { id: "schedule.manage", name: "建立、编辑、补发与取消排程", minRole: "admin" },
  { id: "task.view", name: "查看统一任务中心", minRole: "admin" },
  { id: "task.manage", name: "取消、重试与恢复任务", minRole: "admin" },
  { id: "todo.manage", name: "管理群待办与值班", minRole: "admin" },
  { id: "knowledge.view", name: "查看 FAQ／知识卡片", minRole: "member" },
  { id: "knowledge.manage", name: "管理 FAQ／知识卡片／AI 修正版", minRole: "admin" },
  { id: "model.analytics.view", name: "查看模型健康、用量与成本估算", minRole: "admin" },
  { id: "rules.manage", name: "管理群规版本、临时规则与例外", minRole: "admin" },
  { id: "rules.sandbox", name: "使用群规测试沙盒", minRole: "admin" },
  { id: "appeal.manage", name: "管理申诉对话串", minRole: "admin" },
  { id: "member.summary.view", name: "查看成员处理历史摘要", minRole: "admin" },
  { id: "announcement.manage", name: "管理公告版本", minRole: "admin" },
  { id: "announcement.publish", name: "发布公告与群待办", minRole: "owner" },
  { id: "diagnostics.view", name: "查看任务、时间线、健康与统计", minRole: "admin" },
  { id: "diagnostics.manage", name: "重试任务与清理残留提示", minRole: "admin" },
  { id: "quiet_hours.manage", name: "管理安静时段", minRole: "admin" },
  { id: "retention.manage", name: "管理资料保留期限", minRole: "owner" },
  { id: "automation.fuse.manage", name: "管理自动化保险丝", minRole: "owner" },
  { id: "maintenance.manage", name: "管理维护模式与紧急锁定", minRole: "owner" },
  { id: "permissions.manage", name: "管理细分功能权限与临时授权", minRole: "owner" },
  { id: "handoff.manage", name: "管理 Portal／QQ 管理交接", minRole: "owner" },
  { id: "settings.export_import", name: "汇出、汇入与复制群设置", minRole: "owner" },
  { id: "suggestion.create", name: "提交建议箱内容", minRole: "member" },
  { id: "suggestion.manage", name: "查看与处理匿名建议", minRole: "admin" },
  { id: "bug.create", name: "提交问题追踪", minRole: "member" },
  { id: "bug.manage", name: "查看与处理问题追踪", minRole: "admin" }
]);



const OPS_REMOVED_RECORD_TYPES = Object.freeze(new Set([
  "schedule_template", "draft", "welcome_template", "join_template", "quality_feedback", "deployment_snapshot"
]));



const OPS_RECORD_TYPES = Object.freeze({
  poll: { name: "群内投票", capability: "poll.manage", visibility: "group" },
  activity: { name: "活动报名", capability: "activity.manage", visibility: "group" },
  todo: { name: "群待办", capability: "todo.manage", visibility: "manager" },
  duty: { name: "管理员值班表", capability: "todo.manage", visibility: "manager" },
  faq: { name: "群内 FAQ", capability: "knowledge.manage", visibility: "group" },
  knowledge: { name: "知识卡片", capability: "knowledge.manage", visibility: "group" },
  correction: { name: "AI 回答修正版", capability: "knowledge.manage", visibility: "manager" },
  rule_version: { name: "群规版本", capability: "rules.manage", visibility: "manager" },
  temp_rule: { name: "临时群规", capability: "rules.manage", visibility: "group" },
  exception_rule: { name: "群规例外", capability: "rules.manage", visibility: "manager" },
  announcement_version: { name: "公告版本", capability: "announcement.manage", visibility: "manager" },
  appeal_thread: { name: "申诉对话串", capability: "appeal.manage", visibility: "manager" },
  handoff: { name: "管理交接", capability: "handoff.manage", visibility: "owner" },
  suggestion: { name: "匿名建议箱", capability: "suggestion.create", visibility: "self" },
  bug: { name: "问题追踪", capability: "bug.create", visibility: "self" },
  test_case: { name: "测试案例", capability: "rules.sandbox", visibility: "manager" },
  operation_batch: { name: "批次操作模拟", capability: "diagnostics.manage", visibility: "manager" }
});



function opsRoleRank(role) {
  return ({ member: 0, admin: 1, owner: 2, developer: 3 })[String(role || "member")] ?? 0;
}


function opsCapabilityDef(id) {
  return OPS_CAPABILITIES.find(item => item.id === String(id || "")) || null;
}


function opsTypeDef(type) {
  return OPS_RECORD_TYPES[String(type || "")] || null;
}


function opsRemovedType(type) {
  return OPS_REMOVED_RECORD_TYPES.has(String(type || ""));
}



async function opsPurgeRemovedRecordTypes(env, maxDeletes = 120) {
  const markerKey = "ops:removed-record-types-purge:v1.4.3";
  const state = await readJson(env, markerKey, { typeIndex: 0, deleted: 0, done: false });
  if (state?.done) return state;
  const types = [...OPS_REMOVED_RECORD_TYPES];
  let typeIndex = Math.max(0, Number(state?.typeIndex || 0));
  let deleted = Math.max(0, Number(state?.deleted || 0));
  let budget = Math.max(1, Math.min(500, Number(maxDeletes || 120)));
  while (typeIndex < types.length && budget > 0) {
    const type = types[typeIndex];
    const ids = await readJson(env, opsIndexKey(type), []);
    const remaining = Array.isArray(ids) ? ids.map(String).filter(Boolean) : [];
    while (remaining.length && budget > 0) {
      const id = remaining.pop();
      await dbDel(env, opsRecordKey(type, id));
      await dbDel(env, opsVersionKey(type, id));
      deleted += 1;
      budget -= 1;
    }
    if (remaining.length) {
      await dbPut(env, opsIndexKey(type), JSON.stringify(remaining));
      const nextState = { typeIndex, deleted, done: false, updatedAt: Date.now() };
      await dbPut(env, markerKey, JSON.stringify(nextState));
      return nextState;
    }
    await dbDel(env, opsIndexKey(type));
    typeIndex += 1;
  }
  const done = typeIndex >= types.length;
  const nextState = { typeIndex, deleted, done, updatedAt: Date.now() };
  await dbPut(env, markerKey, JSON.stringify(nextState));
  if (done) await writeSystemAudit(env, { type: "ops_removed_features_purged", groupId: "", actorId: "system", action: "v1.4.3", deleted }).catch(() => {});
  return nextState;
}


function opsSafeId(value) {
  return String(value || "").replace(/[^a-zA-Z0-9:_-]/g, "").slice(0, 160);
}


function opsIndexKey(type) {
  return `ops:index:${opsSafeId(type)}`;
}


function opsRecordKey(type, id) {
  return `ops:record:${opsSafeId(type)}:${opsSafeId(id)}`;
}


function opsVersionKey(type, id) {
  return `ops:versions:${opsSafeId(type)}:${opsSafeId(id)}`;
}


function opsPermissionKey(groupId, qq, capability) {
  return `ops:permission:${String(groupId || "")}:${String(qq || "")}:${String(capability || "")}`;
}


function opsSettingsKey(groupId) {
  return `ops:settings:${String(groupId || "")}`;
}


function opsParticipantsKey(activityId) {
  return `ops:activity:participants:${opsSafeId(activityId)}`;
}


function opsPollVotesKey(pollId) {
  return `ops:poll:votes:${opsSafeId(pollId)}`;
}



async function opsGetSettings(env, groupId) {
  const stored = await readJson(env, opsSettingsKey(groupId), {});
  return {
    quietHoursEnabled: Boolean(stored.quietHoursEnabled),
    quietStart: String(stored.quietStart || DEFAULTS.operationsQuietStart),
    quietEnd: String(stored.quietEnd || DEFAULTS.operationsQuietEnd),
    quietPolicy: ["defer", "skip", "admin_only", "send"].includes(stored.quietPolicy) ? stored.quietPolicy : "defer",
    retentionDays: Math.max(1, Math.min(3650, Number(stored.retentionDays || DEFAULTS.operationsRetentionDays))),
    maintenanceMode: Boolean(stored.maintenanceMode),
    maintenanceUntil: Number(stored.maintenanceUntil || 0),
    emergencyLock: Boolean(stored.emergencyLock),
    testMode: Boolean(stored.testMode),
    fuseEnabled: stored.fuseEnabled !== false,
    fuseFailureThreshold: Math.max(2, Math.min(50, Number(stored.fuseFailureThreshold || DEFAULTS.operationsFuseFailureThreshold))),
    dailyDigestEnabled: Boolean(stored.dailyDigestEnabled),
    dailyDigestTime: String(stored.dailyDigestTime || "09:00"),
    dailyDigestRecipientIds: [...new Set((Array.isArray(stored.dailyDigestRecipientIds) ? stored.dailyDigestRecipientIds : []).map(value => String(value || "").replace(/\D/g, "")).filter(Boolean))].slice(0, 30),
    scheduleRetryEnabled: stored.scheduleRetryEnabled !== false,
    scheduleRetryMax: Math.max(0, Math.min(10, Number(stored.scheduleRetryMax ?? 3))),
    scheduleRetryGraceMinutes: Math.max(1, Math.min(1440, Number(stored.scheduleRetryGraceMinutes ?? 30))),
    anomalyDetectionEnabled: stored.anomalyDetectionEnabled !== false,
    ruleSampleReviewPercent: Math.max(0, Math.min(100, Number(stored.ruleSampleReviewPercent || 0))),
    suggestionDeveloperCanResolveIdentity: stored.suggestionDeveloperCanResolveIdentity !== false,
    operationQuota: {
      recallPerMinute: Math.max(1, Math.min(500, Number(stored?.operationQuota?.recallPerMinute || 20))),
      kickPerHour: Math.max(1, Math.min(100, Number(stored?.operationQuota?.kickPerHour || 5))),
      batchMuteMax: Math.max(1, Math.min(100, Number(stored?.operationQuota?.batchMuteMax || 10))),
      announcementPerHour: Math.max(1, Math.min(200, Number(stored?.operationQuota?.announcementPerHour || 20))),
      activityInvitePerHour: Math.max(1, Math.min(1000, Number(stored?.operationQuota?.activityInvitePerHour || 100))),
      activityInviteBatchMax: Math.max(1, Math.min(100, Number(stored?.operationQuota?.activityInviteBatchMax || 25)))
    }
  };
}



async function opsSaveSettings(env, groupId, patch) {
  const current = await opsGetSettings(env, groupId);
  const next = {
    ...current,
    ...patch,
    operationQuota: { ...current.operationQuota, ...(patch?.operationQuota || {}) },
    updatedAt: Date.now()
  };
  await dbPut(env, opsSettingsKey(groupId), JSON.stringify(next));
  return next;
}



function opsMinutesOfDay(text) {
  const match = String(text || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return 0;
  return Math.max(0, Math.min(1439, Number(match[1]) * 60 + Number(match[2])));
}


function opsQuietState(settings, now = Date.now()) {
  if (!settings?.quietHoursEnabled) return { quiet: false, resumeAt: 0 };
  const p = taipeiParts(now);
  const minute = Number(p.hour) * 60 + Number(p.minute);
  const start = opsMinutesOfDay(settings.quietStart);
  const end = opsMinutesOfDay(settings.quietEnd);
  const quiet = start === end ? true : start < end ? minute >= start && minute < end : minute >= start || minute < end;
  if (!quiet) return { quiet: false, resumeAt: 0 };
  let delta = end - minute;
  if (delta <= 0) delta += 1440;
  return { quiet: true, resumeAt: now + delta * 60000 };
}



async function opsEffectiveCapability(env, { groupId, qq, role, capability }) {
  const def = opsCapabilityDef(capability);
  if (!def) return { allowed: false, reason: "未知权限" };
  if (isDeveloperId(env, qq) || role === "developer") return { allowed: true, source: "developer" };
  const override = await readJson(env, opsPermissionKey(groupId, qq, capability), null);
  if (override && Number(override.expiresAt || 0) > 0 && Date.now() > Number(override.expiresAt)) {
    await dbDel(env, opsPermissionKey(groupId, qq, capability));
  } else if (override && typeof override.allowed === "boolean") {
    return { allowed: override.allowed, source: "override", expiresAt: Number(override.expiresAt || 0), reason: override.reason || "" };
  }
  return {
    allowed: opsRoleRank(role) >= opsRoleRank(def.minRole),
    source: "role",
    requiredRole: def.minRole
  };
}



async function opsRequire(env, authed, capability, groupId = authed.groupId) {
  const role = String(groupId) === String(authed.groupId)
    ? authed.role
    : await resolvePortalRole(env, authed.qq, groupId);
  const decision = await opsEffectiveCapability(env, { groupId, qq: authed.qq, role, capability });
  if (!decision.allowed) {
    return { ok: false, response: jsonResponse({ ok: false, message: `权限不足：需要「${opsCapabilityDef(capability)?.name || capability}」。`, capability, decision }, 403) };
  }
  return { ok: true, role, decision };
}



async function opsListRecords(env, type, { groupId = "", qq = "", role = "member", limit = 300 } = {}) {
  const def = opsTypeDef(type);
  if (!def) return [];
  const ids = await readJson(env, opsIndexKey(type), []);
  const result = [];
  for (const id of ids.slice(-Math.max(1, Math.min(2000, Number(limit || 300)))).reverse()) {
    const item = await readJson(env, opsRecordKey(type, id), null);
    if (!item || item.deletedAt) continue;
    const groups = Array.isArray(item.groupIds) ? item.groupIds.map(String) : [String(item.groupId || "")];
    if (groupId && !groups.includes(String(groupId))) continue;
    if (def.visibility === "self" && String(item.creatorId || "") !== String(qq) && opsRoleRank(role) < opsRoleRank("admin")) continue;
    if (def.visibility === "owner" && opsRoleRank(role) < opsRoleRank("owner")) continue;
    if (def.visibility === "developer" && role !== "developer") continue;
    result.push(item);
  }
  return result;
}



async function opsSaveRecord(env, { type, existing = null, groupId, actorId, actorName = "", data = {} }) {
  const def = opsTypeDef(type);
  if (!def) throw new Error("不支持的记录类型");
  const now = Date.now();
  const id = existing?.id || `${type}_${now.toString(36)}_${crypto.randomUUID().slice(0, 8)}`;
  const previous = existing ? JSON.parse(JSON.stringify(existing)) : null;
  const groupIds = [...new Set((Array.isArray(data.groupIds) ? data.groupIds : [data.groupId || groupId]).map(value => String(value || "").replace(/\D/g, "")).filter(Boolean))].slice(0, 30);
  const item = {
    ...(existing || {}),
    ...data,
    id,
    type,
    groupId: String(data.groupId || existing?.groupId || groupId || groupIds[0] || ""),
    groupIds: groupIds.length ? groupIds : [String(groupId || "")],
    title: String(data.title ?? existing?.title ?? def.name).trim().slice(0, 200),
    description: String(data.description ?? existing?.description ?? "").trim().slice(0, 8000),
    status: String(data.status ?? existing?.status ?? "active").slice(0, 40),
    creatorId: existing?.creatorId || String(actorId || ""),
    creatorName: existing?.creatorName || String(actorName || actorId || ""),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    updatedBy: String(actorId || "")
  };
  if (type === "poll") {
    item.options = (Array.isArray(data.options) ? data.options : existing?.options || []).map(value => String(value).trim()).filter(Boolean).slice(0, 20);
    item.multiple = Boolean(data.multiple ?? existing?.multiple);
    item.anonymous = Boolean(data.anonymous ?? existing?.anonymous);
    item.allowChange = data.allowChange !== false;
    item.deadline = Number(data.deadline || existing?.deadline || 0);
  }
  if (type === "activity") {
    item.capacity = Math.max(0, Math.min(100000, Number(data.capacity ?? existing?.capacity ?? 0)));
    item.waitlistEnabled = data.waitlistEnabled !== false;
    item.signupDeadline = Number(data.signupDeadline || existing?.signupDeadline || 0);
    item.startAt = Number(data.startAt || existing?.startAt || 0);
    item.activityGroupId = String(data.activityGroupId || existing?.activityGroupId || "").replace(/\D/g, "");
    item.inviteMode = ["none", "private_card", "approve_pending"].includes(data.inviteMode) ? data.inviteMode : String(existing?.inviteMode || "none");
    item.autoInviteConfirmed = Boolean(data.autoInviteConfirmed ?? existing?.autoInviteConfirmed);
    item.announceMode = data.announceMode === "all" ? "all" : String(existing?.announceMode || "none") === "all" ? "all" : "none";
    item.announceOnCreate = Boolean(data.announceOnCreate ?? existing?.announceOnCreate);
  }
  if (type === "schedule_template") {
    item.scheduleSpec = String(data.scheduleSpec || existing?.scheduleSpec || data.description || "").trim().slice(0, 8000);
    item.defaultGroupId = String(data.defaultGroupId || existing?.defaultGroupId || item.groupId || "").replace(/\D/g, "");
  }
  if (type === "draft") {
    item.text = String(data.text ?? existing?.text ?? data.description ?? "").slice(0, 12000);
    item.targetGroupId = String(data.targetGroupId || existing?.targetGroupId || item.groupId || "").replace(/\D/g, "");
    item.mentionIds = [...new Set((Array.isArray(data.mentionIds) ? data.mentionIds : existing?.mentionIds || []).map(value => String(value || "")).filter(value => value === "all" || /^\d{5,}$/.test(value)))].slice(0, 50);
    item.replyId = String(data.replyId || existing?.replyId || "").slice(0, 100);
    item.attachments = (Array.isArray(data.attachments) ? data.attachments : existing?.attachments || []).slice(0, 10);
  }
  if (["temp_rule", "exception_rule", "rule_version"].includes(type)) {
    item.priority = Math.max(-1000, Math.min(1000, Number(data.priority ?? existing?.priority ?? 0)));
    item.startsAt = Number(data.startsAt || existing?.startsAt || 0);
    item.expiresAt = Number(data.expiresAt || existing?.expiresAt || 0);
    item.pattern = String(data.pattern ?? existing?.pattern ?? "").slice(0, 1000);
    item.regex = Boolean(data.regex ?? existing?.regex);
    item.caseSensitive = Boolean(data.caseSensitive ?? existing?.caseSensitive);
  }
  if (["todo", "duty"].includes(type)) {
    item.assigneeId = String(data.assigneeId || existing?.assigneeId || "").replace(/\D/g, "");
    item.dueAt = Number(data.dueAt || existing?.dueAt || 0);
    item.priority = ["low", "normal", "high", "urgent"].includes(data.priority) ? data.priority : String(existing?.priority || "normal");
  }
  if (type === "appeal_thread") {
    item.violationId = String(data.violationId || existing?.violationId || "").slice(0, 160);
    item.messages = (Array.isArray(data.messages) ? data.messages : existing?.messages || []).slice(-200);
  }
  if (["suggestion", "bug", "quality_feedback"].includes(type)) {
    item.publicCode = existing?.publicCode || `${type === "bug" ? "BUG" : type === "suggestion" ? "SUG" : "QF"}-${opsTaipeiDateKey(now).replace(/-/g, "")}-${String(id).slice(-6).toUpperCase()}`;
  }
  await dbPut(env, opsRecordKey(type, id), JSON.stringify(item));
  if (!existing) await appendIndex(env, opsIndexKey(type), id, 5000);
  if (previous) {
    const versions = await readJson(env, opsVersionKey(type, id), []);
    versions.push({ at: now, actorId: String(actorId || ""), snapshot: previous });
    await dbPut(env, opsVersionKey(type, id), JSON.stringify(versions.slice(-50)));
  }
  await writeSystemAudit(env, { type: `ops_${type}`, groupId: item.groupId, actorId: String(actorId || ""), action: existing ? "update" : "create", recordId: id, title: item.title });
  return item;
}



async function opsDeleteRecord(env, type, id, actorId) {
  const item = await readJson(env, opsRecordKey(type, id), null);
  if (!item) return false;
  item.deletedAt = Date.now();
  item.deletedBy = String(actorId || "");
  item.status = "deleted";
  await dbPut(env, opsRecordKey(type, id), JSON.stringify(item));
  await writeSystemAudit(env, { type: `ops_${type}`, groupId: item.groupId, actorId: String(actorId || ""), action: "delete", recordId: id });
  return true;
}



async function opsGetGroupMember(env, groupId, userId) {
  try {
    const row = await callOneBotAction(env, { action: "get_group_member_info", params: { group_id: numericId(groupId), user_id: numericId(userId), no_cache: false } }, 10000);
    return row && (row.user_id || row.qq) ? row : null;
  } catch {
    const rows = await readJson(env, `group_members:${groupId}`, []);
    return rows.find(item => String(item.user_id || item.qq || "") === String(userId)) || null;
  }
}



async function opsActivityParticipants(env, activityId) {
  return await readJson(env, opsParticipantsKey(activityId), []);
}



async function opsPromoteActivityWaitlist(env, activity) {
  const rows = await opsActivityParticipants(env, activity.id);
  const active = rows.filter(item => item.status === "confirmed");
  const wait = rows.filter(item => item.status === "waitlist").sort((a, b) => Number(a.joinedAt) - Number(b.joinedAt));
  const capacity = Number(activity.capacity || 0);
  let slots = capacity > 0 ? Math.max(0, capacity - active.length) : wait.length;
  const promoted = [];
  for (const item of wait) {
    if (slots <= 0) break;
    item.status = "confirmed";
    item.promotedAt = Date.now();
    promoted.push(item);
    slots -= 1;
    try {
      await sendPortalVerificationMessage(env, item.userId, `你报名的活动「${activity.title}」已有名额，已从候补转为正式报名。`);
    } catch {}
  }

  // 候补转正后沿用活动建立者当前的目标群邀请权限；权限或配额不足时只保留报名，不越权邀请。
  const targetGroupId = String(activity.activityGroupId || "").replace(/\D/g, "");
  if (promoted.length && activity.autoInviteConfirmed && targetGroupId) {
    const creatorId = String(activity.creatorId || "");
    const creatorRole = await resolvePortalRole(env, creatorId, targetGroupId);
    const permission = await opsEffectiveCapability(env, {
      groupId: targetGroupId, qq: creatorId, role: creatorRole, capability: "activity.invite"
    });
    for (const item of promoted) {
      if (!permission.allowed) {
        item.inviteStatus = "permission_unavailable";
        item.inviteUpdatedAt = Date.now();
        continue;
      }
      const quota = await opsConsumeQuota(env, targetGroupId, creatorId, "activityInvite", 1);
      if (!quota.ok) {
        item.inviteStatus = "quota_deferred";
        item.inviteError = String(quota.message || "活动群邀请配额不足").slice(0, 500);
        item.inviteUpdatedAt = Date.now();
        continue;
      }
      await opsInviteActivityParticipant(env, activity, item, creatorId);
    }
  }

  await dbPut(env, opsParticipantsKey(activity.id), JSON.stringify(rows.slice(-10000)));
  await writeSystemAudit(env, {
    type: "ops_activity_waitlist_promoted",
    groupId: String(activity.groupId || promoted[0]?.sourceGroupId || ""),
    actorId: String(activity.creatorId || ""),
    action: "promote",
    activityId: String(activity.id || ""),
    promotedCount: promoted.length,
    autoInviteAttempted: Boolean(promoted.length && activity.autoInviteConfirmed && targetGroupId)
  }).catch(() => {});
  return rows;
}



async function opsJoinActivity(env, activity, { userId, userName, sourceGroupId }) {
  if (!activity || activity.status !== "active") return { ok: false, message: "活动目前不可报名。" };
  if (activity.signupDeadline && Date.now() > Number(activity.signupDeadline)) return { ok: false, message: "报名已经截止。" };
  const allowedGroups = Array.isArray(activity.groupIds) ? activity.groupIds.map(String) : [String(activity.groupId || "")];
  if (!allowedGroups.includes(String(sourceGroupId))) return { ok: false, message: "当前群不在此活动的报名范围。" };
  const rows = await opsActivityParticipants(env, activity.id);
  const existing = rows.find(item => String(item.userId) === String(userId));
  if (existing && ["confirmed", "waitlist"].includes(existing.status)) return { ok: false, message: `你已经${existing.status === "confirmed" ? "报名" : "在候补名单中"}。`, participant: existing };
  const confirmedCount = rows.filter(item => item.status === "confirmed").length;
  const capacity = Number(activity.capacity || 0);
  const status = capacity > 0 && confirmedCount >= capacity ? (activity.waitlistEnabled ? "waitlist" : "full") : "confirmed";
  if (status === "full") return { ok: false, message: "活动名额已满，且未开放候补。" };
  const participant = {
    userId: String(userId),
    userName: String(userName || userId),
    sourceGroupId: String(sourceGroupId),
    status,
    joinedAt: Date.now(),
    updatedAt: Date.now(),
    inviteStatus: "not_requested"
  };
  if (existing) Object.assign(existing, participant);
  else rows.push(participant);
  await dbPut(env, opsParticipantsKey(activity.id), JSON.stringify(rows.slice(-10000)));
  let inviteResult = null;
  if (status === "confirmed" && activity.autoInviteConfirmed && String(activity.activityGroupId || "").replace(/\D/g, "")) {
    const targetGroupId = String(activity.activityGroupId).replace(/\D/g, "");
    const creatorId = String(activity.creatorId || "");
    const creatorRole = await resolvePortalRole(env, creatorId, targetGroupId);
    const permission = await opsEffectiveCapability(env, { groupId: targetGroupId, qq: creatorId, role: creatorRole, capability: "activity.invite" });
    if (permission.allowed) {
      const quota = await opsConsumeQuota(env, targetGroupId, creatorId, "activityInvite", 1);
      if (quota.ok) inviteResult = await opsInviteActivityParticipant(env, activity, participant, creatorId);
      else inviteResult = { ok: false, message: quota.message, deferred: true };
    } else {
      participant.inviteStatus = "permission_unavailable";
      participant.inviteUpdatedAt = Date.now();
      inviteResult = { ok: false, message: "活动建立者目前已没有目标活动群的邀请权限，已保留报名并等待有权限的管理处理。", deferred: true };
    }
    await dbPut(env, opsParticipantsKey(activity.id), JSON.stringify(rows.slice(-10000)));
  }
  await writeSystemAudit(env, { type: "ops_activity_signup", groupId: String(sourceGroupId), actorId: String(userId), action: status, activityId: activity.id, activityGroupId: activity.activityGroupId || "", autoInvite: inviteResult?.ok || false });
  const baseMessage = status === "confirmed" ? "报名成功。" : "名额已满，已加入候补名单。";
  return { ok: true, message: inviteResult ? `${baseMessage}${inviteResult.ok ? ` ${inviteResult.message}` : ` 活动群邀请暂未完成：${inviteResult.message}`}` : baseMessage, participant, inviteResult };
}



async function opsLeaveActivity(env, activity, userId) {
  const rows = await opsActivityParticipants(env, activity.id);
  const row = rows.find(item => String(item.userId) === String(userId) && ["confirmed", "waitlist"].includes(item.status));
  if (!row) return { ok: false, message: "找不到有效报名。" };
  row.status = "cancelled";
  row.cancelledAt = Date.now();
  await dbPut(env, opsParticipantsKey(activity.id), JSON.stringify(rows));
  await opsPromoteActivityWaitlist(env, activity);
  await writeSystemAudit(env, { type: "ops_activity_signup", groupId: row.sourceGroupId || activity.groupId, actorId: String(userId), action: "cancelled", activityId: activity.id });
  return { ok: true, message: "已取消报名。" };
}



function opsActivityAnnouncementText(activity) {
  const start = Number(activity.startAt || 0) ? new Date(Number(activity.startAt)).toLocaleString("zh-CN", { timeZone: "Asia/Taipei", hour12: false }) : "未设置";
  const deadline = Number(activity.signupDeadline || 0) ? new Date(Number(activity.signupDeadline)).toLocaleString("zh-CN", { timeZone: "Asia/Taipei", hour12: false }) : "未设置";
  return `【活动报名】\n${activity.title}\n编号：${activity.id}\n${activity.description ? `说明：${activity.description}\n` : ""}开始时间：${start}\n报名截止：${deadline}\n人数上限：${Number(activity.capacity || 0) > 0 ? activity.capacity : "不限"}\n候补：${activity.waitlistEnabled ? "开启" : "关闭"}\n\n报名方式：\n1. 群聊 @Bot 说“报名 ${activity.title}”\n2. 私聊 Bot 说“报名 ${activity.title}”\n3. 登录 Portal 的“活动与协作”页面\n取消时可说“取消报名 ${activity.title}”。`;
}



async function opsAnnounceActivity(env, activity, { actorId, mode = "none" } = {}) {
  if (!activity) return { ok: false, message: "找不到活动。", results: [] };
  const announceMode = mode === "all" ? "all" : "none";
  const groups = [...new Set((activity.groupIds || [activity.groupId]).map(value => String(value || "").replace(/\D/g, "")).filter(Boolean))];
  if (!groups.length) return { ok: false, message: "活动没有目标群。", results: [] };
  const results = [];
  for (const targetGroupId of groups) {
    try {
      const role = await resolvePortalRole(env, actorId, targetGroupId);
      const announcePermission = await opsEffectiveCapability(env, { groupId: targetGroupId, qq: actorId, role, capability: "activity.announce" });
      if (!announcePermission.allowed) {
        results.push({ groupId: targetGroupId, ok: false, error: "没有活动通知权限" });
        continue;
      }
      if (announceMode === "all") {
        const mentionPermission = await opsEffectiveCapability(env, { groupId: targetGroupId, qq: actorId, role, capability: "activity.mention_all" });
        if (!mentionPermission.allowed) {
          results.push({ groupId: targetGroupId, ok: false, error: "没有 @全体权限" });
          continue;
        }
      }
      const botState = await getBotGroupRole(env, targetGroupId);
      // 不 @全体时，以 send_group_msg 的实际结果为准；成员探针偶发失败不能误判 Bot 不在群。
      if (announceMode === "all" && !botState?.exists) {
        results.push({ groupId: targetGroupId, ok: false, error: "无法确认 Bot 在目标群，不能安全 @全体" });
        continue;
      }
      if (announceMode === "all" && !["owner", "admin"].includes(String(botState.role || ""))) {
        results.push({ groupId: targetGroupId, ok: false, error: "Bot 不是群主或管理员，无法可靠 @全体" });
        continue;
      }
      const message = [];
      if (announceMode === "all") {
        message.push({ type: "at", data: { qq: "all" } });
        message.push({ type: "text", data: { text: "\n" } });
      }
      message.push({ type: "text", data: { text: opsActivityAnnouncementText(activity) } });
      await callOneBotAction(env, { action: "send_group_msg", params: { group_id: numericId(targetGroupId), message, auto_escape: false } }, 15000);
      if (!botState?.exists) {
        const self = await getBotIdentity(env).catch(() => ({ userId: "" }));
        await dbPut(env, `onebot:self_group_role:${targetGroupId}`, JSON.stringify({ userId: String(self?.userId || ""), role: "member", exists: true, verifiedBy: "send_group_msg", at: Date.now() })).catch(() => null);
      }
      results.push({ groupId: targetGroupId, ok: true, mode: announceMode });
      await writeSystemAudit(env, { type: "ops_activity_announce", groupId: targetGroupId, actorId: String(actorId || ""), action: announceMode, activityId: activity.id });
    } catch (error) {
      results.push({ groupId: targetGroupId, ok: false, error: String(error?.message || error).slice(0, 500) });
    }
  }
  const successCount = results.filter(item => item.ok).length;
  return {
    ok: successCount === results.length,
    partial: successCount > 0 && successCount < results.length,
    results,
    message: successCount === results.length
      ? `已向 ${successCount} 个群发送活动报名通知${announceMode === "all" ? "并 @全体" : "，未 @全体"}。`
      : `活动通知完成 ${successCount}/${results.length} 个群；失败：${results.filter(item => !item.ok).map(item => `${item.groupId}（${item.error}）`).join("、")}`
  };
}




async function opsInviteActivityParticipant(env, activity, participant, actorId) {
  const targetGroupId = String(activity.activityGroupId || "").replace(/\D/g, "");
  if (!targetGroupId) return { ok: false, message: "此活动没有设置额外活动群。" };
  const inviteMode = String(activity.inviteMode || "none");
  if (inviteMode === "none") return { ok: false, message: "此活动尚未启用活动群邀请方式。" };
  const botState = await getBotGroupRole(env, targetGroupId);
  if (!botState?.exists) return { ok: false, message: "Bot 不在活动群内，无法发送活动群邀请。" };
  const member = await opsGetGroupMember(env, targetGroupId, participant.userId);
  if (member) {
    participant.inviteStatus = "already_member";
    participant.inviteUpdatedAt = Date.now();
    return { ok: true, message: "该参与者已经在活动群内。" };
  }
  const pending = await readJson(env, `group_join_request:${targetGroupId}:${participant.userId}`, null);
  if (inviteMode === "approve_pending" && pending?.flag && ["admin", "owner"].includes(String(botState.role || ""))) {
    try {
      await callOneBotAction(env, { action: "set_group_add_request", params: { flag: String(pending.flag), sub_type: String(pending.subType || "add"), approve: true, reason: "" } }, 15000);
      participant.inviteStatus = "pending_request_approved";
      participant.inviteUpdatedAt = Date.now();
      participant.invitedBy = String(actorId || "");
      return { ok: true, message: "已批准该参与者现有的活动群加群申请。" };
    } catch (error) {
      participant.inviteError = String(error?.message || error).slice(0, 500);
    }
  }
  try {
    const message = [
      { type: "text", data: { text: `你报名的活动「${activity.title}」设有活动群，请通过下方群卡片申请加入。申请后，具有权限的 Bot 可协助批准。\n` } },
      { type: "contact", data: { type: "group", id: targetGroupId } }
    ];
    await callOneBotAction(env, { action: "send_private_msg", params: { user_id: numericId(participant.userId), message, auto_escape: false } }, 15000);
    participant.inviteStatus = "group_card_sent";
    participant.inviteUpdatedAt = Date.now();
    participant.invitedBy = String(actorId || "");
    return { ok: true, message: "已私讯发送活动群卡片。QQ/NapCat 没有标准接口可强制把任意成员直接加入群；对方仍需申请加入。" };
  } catch (error) {
    participant.inviteStatus = "failed";
    participant.inviteError = String(error?.message || error).slice(0, 500);
    participant.inviteUpdatedAt = Date.now();
    return { ok: false, message: `邀请发送失败：${participant.inviteError}` };
  }
}



async function opsVotePoll(env, poll, { userId, optionIndexes }) {
  if (!poll || poll.status !== "active") return { ok: false, message: "投票目前不可用。" };
  if (poll.deadline && Date.now() > Number(poll.deadline)) return { ok: false, message: "投票已经截止。" };
  const options = Array.isArray(poll.options) ? poll.options : [];
  const indexes = [...new Set((Array.isArray(optionIndexes) ? optionIndexes : [optionIndexes]).map(Number).filter(index => Number.isInteger(index) && index >= 0 && index < options.length))];
  if (!indexes.length) return { ok: false, message: "请选择有效选项。" };
  if (!poll.multiple && indexes.length > 1) return { ok: false, message: "此投票只能选择一项。" };
  const votes = await readJson(env, opsPollVotesKey(poll.id), {});
  if (votes[userId] && poll.allowChange === false) return { ok: false, message: "此投票不允许改票。" };
  votes[userId] = { indexes, at: Date.now() };
  await dbPut(env, opsPollVotesKey(poll.id), JSON.stringify(votes));
  return { ok: true, message: "投票已记录。" };
}



async function opsPreviewMessage(env, { groupId, text, mentionIds = [], replyId = "", attachments = [] }) {
  const warnings = [];
  const segments = [];
  if (replyId) segments.push({ type: "reply", data: { id: String(replyId) } });
  const mentionSet = new Set((Array.isArray(mentionIds) ? mentionIds : []).map(String).filter(Boolean));
  for (const id of mentionSet) {
    if (id === "all") {
      segments.push({ type: "at", data: { qq: "all" } });
      continue;
    }
    const member = await opsGetGroupMember(env, groupId, id);
    if (!member) warnings.push(`QQ ${id} 目前不在目标群，无法保证有效 @。`);
    segments.push({ type: "at", data: { qq: id } });
  }
  if (text) segments.push({ type: "text", data: { text: String(text).slice(0, 12000) } });
  for (const attachment of Array.isArray(attachments) ? attachments.slice(0, 10) : []) {
    if (!["image", "record", "video", "file"].includes(attachment?.type)) continue;
    if (!attachment?.file && !attachment?.url) warnings.push(`${attachment.type} 缺少 file 或 url。`);
    segments.push({ type: attachment.type, data: { file: attachment.file || attachment.url, url: attachment.url || undefined } });
  }
  if (String(text || "").length > 4000) warnings.push("文字较长，QQ 客户端可能折叠或发送失败。");
  if (/@\d{5,}/.test(String(text || "")) && mentionSet.size === 0) warnings.push("内容中的 @QQ 只是普通文字，没有建立真正的 OneBot at 消息段。");
  const botRole = await getBotGroupRole(env, groupId);
  if (!botRole?.exists) warnings.push("Bot 不在目标群。");
  return { ok: true, segments, warnings, botRole };
}



async function opsActivitySummary(env, activity, { viewerId = "", canManage = false } = {}) {
  const participants = await opsActivityParticipants(env, activity.id);
  const visibleParticipants = canManage
    ? participants
    : participants.filter(item => String(item.userId || "") === String(viewerId || "")).map(item => ({ ...item, sourceGroupId: String(item.sourceGroupId || "") }));
  return {
    ...activity,
    confirmedCount: participants.filter(item => item.status === "confirmed").length,
    waitlistCount: participants.filter(item => item.status === "waitlist").length,
    cancelledCount: participants.filter(item => item.status === "cancelled").length,
    participants: visibleParticipants,
    participantListRestricted: !canManage
  };
}



async function opsAnalytics(env, groupId) {
  const audits = await readJson(env, `audit:system:group:${groupId}`, []);
  const now = Date.now();
  const recent = audits.filter(item => now - Date.parse(item.at || 0) <= 7 * 86400000);
  const count = type => recent.filter(item => String(item.type || "").includes(type)).length;
  const violationRecords = await listRuleViolations(env, groupId, { limit: 1000 }).catch(() => []);
  const reviewed = violationRecords.filter(item => item.humanVerdict);
  const falsePositives = reviewed.filter(item => item.humanVerdict === "not_violation");
  const categoryMap = new Map();
  for (const item of reviewed) {
    const category = String(item.violationType || "其他");
    if (!categoryMap.has(category)) categoryMap.set(category, { category, reviewed: 0, falsePositives: 0 });
    const row = categoryMap.get(category);
    row.reviewed += 1;
    if (item.humanVerdict === "not_violation") row.falsePositives += 1;
  }
  const byCategory = [...categoryMap.values()].map(row => ({ ...row, falsePositiveRate: row.reviewed ? Math.round(row.falsePositives / row.reviewed * 1000) / 10 : 0 })).sort((a, b) => b.reviewed - a.reviewed);
  const quality = await opsListRecords(env, "quality_feedback", { groupId, role: "developer", limit: 1000 }).catch(() => []);
  return {
    ok: true,
    rangeDays: 7,
    tasks: {
      schedules: count("schedule"),
      activityActions: count("ops_activity"),
      moderation: count("rule_"),
      portalOperations: count("ops_"),
      thinkingResiduals: count("thinking_indicator_residual")
    },
    moderation: {
      reviewed: reviewed.length,
      falsePositives: falsePositives.length,
      falsePositiveRate: reviewed.length ? Math.round(falsePositives.length / reviewed.length * 1000) / 10 : 0,
      byCategory
    },
    qualityFeedback: {
      total: quality.length,
      open: quality.filter(item => item.status === "open").length,
      byReason: Object.fromEntries([...new Set(quality.map(item => item.reasonType || "other"))].map(reason => [reason, quality.filter(item => (item.reasonType || "other") === reason).length]))
    }
  };
}



async function opsDependencyCheck(env, groupId) {
  const bot = await getBotGroupRole(env, groupId);
  const settings = await opsGetSettings(env, groupId);
  const checks = [
    { id: "bot_member", name: "Bot 位于群内", ok: Boolean(bot?.exists), detail: bot?.role || "not_member" },
    { id: "bot_moderation", name: "群规自动处理", ok: ["admin", "owner"].includes(String(bot?.role || "")), detail: "需要 Bot 为管理员或群主" },
    { id: "join_approval", name: "AI 同意入群申请", ok: ["admin", "owner"].includes(String(bot?.role || "")), detail: "需要 Bot 可处理群申请" },
    { id: "d1", name: "D1 储存", ok: Boolean(env.DB), detail: env.DB ? "configured" : "missing" },
    { id: "durable_object", name: "Durable Object", ok: Boolean(env.ONEBOT_WS), detail: env.ONEBOT_WS ? "configured" : "missing" },
    { id: "maintenance", name: "维护模式", ok: !settings.maintenanceMode, detail: settings.maintenanceMode ? "enabled" : "disabled" },
    { id: "emergency_lock", name: "紧急锁定", ok: !settings.emergencyLock, detail: settings.emergencyLock ? "enabled" : "disabled" }
  ];
  const weights = { bot_member: 20, bot_moderation: 20, join_approval: 15, d1: 15, durable_object: 15, maintenance: 5, emergency_lock: 10 };
  const totalWeight = checks.reduce((sum, item) => sum + Number(weights[item.id] || 5), 0);
  const passedWeight = checks.filter(item => item.ok).reduce((sum, item) => sum + Number(weights[item.id] || 5), 0);
  const score = totalWeight ? Math.round(passedWeight / totalWeight * 100) : 0;
  const status = score >= 90 ? "healthy" : score >= 70 ? "attention" : "critical";
  return { ok: checks.every(item => item.ok), checks, bot, settings, score, status, capabilities: {
    canSend: Boolean(bot?.exists),
    canRecallOwn: Boolean(bot?.exists),
    canModerateMembers: ["admin", "owner"].includes(String(bot?.role || "")),
    canApproveJoin: ["admin", "owner"].includes(String(bot?.role || "")),
    canSetAdmins: String(bot?.role || "") === "owner",
    canCheckIn: bot?.exists ? "unverified" : false
  } };
}



async function opsRuleSandbox(env, { groupId, text, context = [], role = "member" }) {
  const rules = String(await dbGet(env, `group_rules:${groupId}`) || "").trim();
  if (!rules) return { ok: false, message: "当前群没有设置群规。" };
  const strictness = normalizeRuleStrictness(await dbGet(env, `rule_strictness:${groupId}`) || DEFAULTS.ruleStrictness);
  try {
    const result = await callGemmaDecision(env, {
      system: `你是群规测试沙盒。只输出 JSON：{"violation":boolean,"category":string,"reason":string,"confidence":number,"suggestedAction":string,"matchedRule":string}。这是模拟，不执行处罚。严格度：${strictness}。群规：${rules.slice(0, 10000)}`,
      prompt: JSON.stringify({ currentMessage: String(text || "").slice(0, 4000), recentContext: (Array.isArray(context) ? context : []).slice(-20), senderRole: role }),
      maxOutputTokens: 400
    });
    const parsed = JSON.parse(result.text.match(/\{[\s\S]*\}/)?.[0] || "{}");
    return { ok: true, result: parsed, provider: result.provider || "gemma", model: result.model || "" };
  } catch (error) {
    return { ok: false, message: String(error?.message || error) };
  }
}



async function opsImpactPreview(env, groupId, patch) {
  const logs = (await readJson(env, `recent_logs:${groupId}`, [])).slice(-500);
  const windowSeconds = Math.max(5, Number(patch.ruleSpamWindowSeconds || await dbGet(env, `rule_spam_window_seconds:${groupId}`) || DEFAULTS.ruleSpamWindowSeconds));
  const threshold = Math.max(2, Number(patch.ruleSpamThreshold || await dbGet(env, `rule_spam_threshold:${groupId}`) || DEFAULTS.ruleSpamThreshold));
  const byUser = new Map();
  for (const raw of logs) {
    const line = String(raw || "");
    const match = line.match(/QQ[:：]?(\d{5,}).*?[：:]\s*([\s\S]+)/);
    if (!match) continue;
    const key = `${match[1]}:${match[2].trim().toLowerCase()}`;
    byUser.set(key, (byUser.get(key) || 0) + 1);
  }
  const possible = [...byUser.values()].filter(count => count >= threshold).length;
  return {
    ok: true,
    estimateOnly: true,
    settings: { windowSeconds, threshold },
    recentMessagesAnalyzed: logs.length,
    possibleRepeatedClusters: possible,
    message: "这是根据现有简化日志估算，不会执行任何处罚。"
  };
}



async function opsCleanupThinking(env, groupId, messageIds = []) {
  const audits = await readJson(env, `audit:system:group:${groupId}`, []);
  const residualIds = audits
    .filter(item => item.type === "thinking_indicator_residual")
    .flatMap(item => [item.messageId, ...(Array.isArray(item.failed) ? item.failed.map(x => x.id) : [])])
    .map(String).filter(Boolean);
  const ids = [...new Set([...(Array.isArray(messageIds) ? messageIds : []), ...residualIds])].slice(-100);
  const results = [];
  for (const id of ids) {
    try {
      await callOneBotAction(env, { action: "delete_msg", params: { message_id: numericId(id) } }, 10000);
      results.push({ id, ok: true });
    } catch (error) {
      results.push({ id, ok: false, error: String(error?.message || error).slice(0, 500) });
    }
  }
  return { ok: results.every(item => item.ok), results };
}




function opsTaipeiDateKey(now = Date.now()) {
  const p = taipeiParts(now);
  return `${p.year}-${p.month}-${p.day}`;
}



async function opsGetRecord(env, type, id) {
  return await readJson(env, opsRecordKey(type, id), null);
}



function opsNextScheduleRuns(parsed, count = 5) {
  if (!parsed?.ok || !parsed.nextRunAt) return [];
  const result = [];
  const record = { ...parsed };
  let next = Number(parsed.nextRunAt);
  for (let index = 0; index < Math.max(1, Math.min(20, Number(count || 5))) && next; index++) {
    result.push(next);
    next = computeNextScheduleRun(record, next);
  }
  return result;
}



async function opsSchedulePreview(env, { groupId, scheduleSpec, excludeId = "" }) {
  const parsed = parseScheduleRequest(String(scheduleSpec || ""), Date.now());
  if (!parsed.ok) return parsed;
  const nextRuns = opsNextScheduleRuns(parsed, 5);
  const ids = await readJson(env, "schedule:index", []);
  const conflicts = [];
  for (const id of ids.slice(-5000)) {
    if (String(id) === String(excludeId || "")) continue;
    const item = await readJson(env, `schedule:${id}`, null);
    if (!item || !item.enabled || item.status !== "active" || String(item.groupId || "") !== String(groupId || "")) continue;
    if (nextRuns.some(at => Math.abs(Number(item.nextRunAt || 0) - Number(at)) <= 60000)) {
      conflicts.push({ id: item.id, nextRunAt: item.nextRunAt, content: String(item.content || "").slice(0, 200) });
    }
  }
  const mentionIds = extractScheduleMentionIds(parsed.content);
  const preview = await opsPreviewMessage(env, { groupId, text: parsed.content, mentionIds });
  return {
    ok: true,
    parsed,
    nextRuns,
    conflicts,
    conflictCount: conflicts.length,
    managementAction: parseManagementScheduleAction(parsed.content),
    messagePreview: preview,
    warning: conflicts.length ? `发现 ${conflicts.length} 个一分钟内可能冲突的排程。` : "没有发现一分钟内的排程冲突。"
  };
}



async function opsCreateScheduleFromSpec(env, { groupId, actorId, actorRole, scheduleSpec, templateId = "", draftId = "" }) {
  const preview = await opsSchedulePreview(env, { groupId, scheduleSpec });
  if (!preview.ok) return preview;
  const parsed = preview.parsed;
  const review = await reviewScheduleWithGemma(env, JSON.stringify(parsed));
  if (review.decision === "reject") return { ok: false, message: `排程已拒绝：${review.reason || "内容不符合要求"}` };
  const managementAction = parseManagementScheduleAction(parsed.content);
  const canDirectManage = managementAction ? await canUseBotGroupOperations(env, groupId, actorId) : true;
  const status = managementAction ? (canDirectManage ? "active" : "pending_owner") : (review.decision === "allow" ? "active" : "pending_owner");
  const item = await createScheduleRecord(env, {
    ...parsed,
    groupId: String(groupId),
    creatorId: String(actorId),
    creatorRole: String(actorRole || "member"),
    scheduleSpec: String(scheduleSpec || "").trim(),
    mentionIds: extractScheduleMentionIds(parsed.content),
    managementAction,
    review,
    status,
    enabled: status === "active",
    sourceTemplateId: String(templateId || ""),
    sourceDraftId: String(draftId || ""),
    conflictCountAtCreation: Number(preview.conflictCount || 0)
  });
  await writeSystemAudit(env, { type: "ops_schedule", groupId, actorId, action: "create", scheduleId: item.id, templateId, draftId, conflictCount: preview.conflictCount });
  return { ok: true, message: status === "active" ? "排程已建立。" : "排程已建立并等待授权。", schedule: item, preview };
}



async function opsSendDraftNow(env, { draft, groupId, actorId }) {
  if (!draft || draft.status === "deleted") return { ok: false, message: "找不到可发送草稿。" };
  const targetGroupId = String(draft.targetGroupId || draft.groupId || groupId || "").replace(/\D/g, "");
  if (!targetGroupId) return { ok: false, message: "草稿缺少目标群。" };
  const preview = await opsPreviewMessage(env, {
    groupId: targetGroupId,
    text: draft.text || draft.description || "",
    mentionIds: draft.mentionIds || [],
    replyId: draft.replyId || "",
    attachments: draft.attachments || []
  });
  if (!preview.botRole?.exists) return { ok: false, message: "Bot 不在目标群，无法发送。", preview };
  try {
    const result = await callOneBotAction(env, {
      action: "send_group_msg",
      params: { group_id: numericId(targetGroupId), message: preview.segments, auto_escape: false }
    }, 20000);
    draft.lastSentAt = Date.now();
    draft.lastSentBy = String(actorId || "");
    draft.lastSentMessageId = String(extractOneBotMessageId(result) || "");
    draft.status = "sent";
    await dbPut(env, opsRecordKey("draft", draft.id), JSON.stringify(draft));
    await writeSystemAudit(env, { type: "ops_draft", groupId: targetGroupId, actorId, action: "send", recordId: draft.id, messageId: draft.lastSentMessageId });
    return { ok: true, message: "草稿已发送。", messageId: draft.lastSentMessageId, preview };
  } catch (error) {
    draft.lastSendError = String(error?.message || error).slice(0, 1000);
    draft.lastSendFailedAt = Date.now();
    await dbPut(env, opsRecordKey("draft", draft.id), JSON.stringify(draft));
    await writeSystemAudit(env, { type: "ops_draft", groupId: targetGroupId, actorId, action: "send_failed", recordId: draft.id, error: draft.lastSendError });
    return { ok: false, message: `发送失败：${draft.lastSendError}`, preview };
  }
}



async function opsTaskCenter(env, groupId, limit = 300) {
  const tasks = [];
  const scheduleIds = await readJson(env, "schedule:index", []);
  for (const id of scheduleIds.slice(-2000)) {
    const item = await readJson(env, `schedule:${id}`, null);
    if (!item || String(item.groupId || "") !== String(groupId || "") || item.status === "deleted") continue;
    tasks.push({ kind: "schedule", id: item.id, status: item.status, title: String(item.content || "排程").slice(0, 120), at: Number(item.nextRunAt || Date.parse(item.createdAt || 0) || 0), retryable: ["paused", "failed"].includes(item.status) || Number(item.failureCount || 0) > 0, cancellable: !["completed", "deleted"].includes(item.status), detail: item });
  }
  for (const [kind, indexKey, prefix] of [
    ["moderation", `moderation:proposal:index:${groupId}`, "moderation:proposal:"],
    ["groupwork", `groupwork:index:${groupId}`, "groupwork:"],
    ["join_request", `joinrequest:index:${groupId}`, "joinrequest:"]
  ]) {
    const ids = await readJson(env, indexKey, []);
    for (const id of ids.slice(-1000)) {
      const item = await readJson(env, `${prefix}${id}`, null);
      if (!item) continue;
      tasks.push({ kind, id: item.id, status: item.status, title: item.title || item.type || item.action || kind, at: Number(item.updatedAt || item.createdAt || item.at || 0), retryable: ["failed", "paused"].includes(item.status), cancellable: ["pending", "pending_owner", "pending_review", "active"].includes(item.status), detail: item });
    }
  }
  const opsTypes = ["activity", "poll", "todo", "duty", "appeal_thread", "bug", "operation_batch"];
  for (const type of opsTypes) {
    const rows = await opsListRecords(env, type, { groupId, role: "developer", limit: 500 });
    for (const item of rows) {
      if (!["active", "pending", "pending_owner", "failed", "paused", "open", "waiting"].includes(String(item.status || ""))) continue;
      tasks.push({ kind: `ops:${type}`, id: item.id, status: item.status, title: item.title || type, at: Number(item.updatedAt || item.createdAt || 0), retryable: ["failed", "paused"].includes(item.status), cancellable: true, detail: item });
    }
  }
  tasks.sort((a, b) => Number(b.at || 0) - Number(a.at || 0));
  return { ok: true, tasks: tasks.slice(0, Math.max(1, Math.min(1000, Number(limit || 300)))) };
}



async function opsTaskAction(env, { groupId, actorId, kind, id, action }) {
  if (kind === "schedule") {
    const item = await readJson(env, `schedule:${id}`, null);
    if (!item || String(item.groupId || "") !== String(groupId || "")) return { ok: false, message: "找不到排程。" };
    if (action === "retry") {
      item.status = "active";
      item.enabled = true;
      item.failureCount = 0;
      item.nextRunAt = Date.now() + 1000;
      item.lastResult = "manual_retry_queued";
      await dbPut(env, `schedule:${id}`, JSON.stringify(item));
      await opsResetFuse(env, groupId, "schedule", actorId);
      return { ok: true, message: "排程已排入立即重试。" };
    }
    if (action === "cancel") return await cancelSchedule(env, id, actorId, true, groupId, false);
  }
  if (kind === "groupwork") {
    const item = await readJson(env, `groupwork:${id}`, null);
    if (!item || String(item.groupId || "") !== String(groupId || "")) return { ok: false, message: "找不到待确认操作。" };
    if (action === "cancel" && ["pending_owner", "pending_review"].includes(item.status)) {
      item.status = "cancelled";
      item.decidedAt = Date.now();
      item.decidedBy = String(actorId || "");
      await dbPut(env, `groupwork:${id}`, JSON.stringify(item));
      return { ok: true, message: "待确认操作已取消。" };
    }
  }
  if (kind.startsWith("ops:")) {
    const type = kind.slice(4);
    const item = await opsGetRecord(env, type, id);
    if (!item || !(item.groupIds || [item.groupId]).map(String).includes(String(groupId))) return { ok: false, message: "找不到记录。" };
    if (action === "cancel") {
      item.status = "cancelled";
      item.cancelledAt = Date.now();
      item.cancelledBy = String(actorId || "");
      await dbPut(env, opsRecordKey(type, id), JSON.stringify(item));
      return { ok: true, message: "任务已取消。" };
    }
    if (action === "retry") {
      item.status = "active";
      item.failureCount = 0;
      item.updatedAt = Date.now();
      item.updatedBy = String(actorId || "");
      await dbPut(env, opsRecordKey(type, id), JSON.stringify(item));
      return { ok: true, message: "任务已恢复。" };
    }
  }
  return { ok: false, message: "此任务不支持该操作。" };
}



async function opsModelMetrics(env, groupId, days = 7) {
  const logs = await listAiDecisionLogs(env, { groupId, limit: 2000 }).catch(() => []);
  const cutoff = Date.now() - Math.max(1, Math.min(90, Number(days || 7))) * 86400000;
  const rows = logs.filter(item => Number(item.createdAt || Date.parse(item.at || 0) || 0) >= cutoff);
  const byModel = new Map();
  for (const row of rows) {
    const name = String(row.model || row.searchModel || row.provider || "unknown");
    if (!byModel.has(name)) byModel.set(name, { model: name, requests: 0, success: 0, errors: 0, timeouts: 0, rateLimited: 0, totalLatencyMs: 0, latencySamples: 0, fallbackCount: 0, estimatedTokens: 0 });
    const item = byModel.get(name);
    item.requests += 1;
    const failed = row.decision === "error" || row.sendStatus === "failed" || Boolean(row.error);
    if (failed) item.errors += 1; else item.success += 1;
    const text = JSON.stringify(row);
    if (/timeout|超时|超時/i.test(text)) item.timeouts += 1;
    if (/429|rate.?limit|限流/i.test(text)) item.rateLimited += 1;
    if (row.fallbackUsed || row.fallbackModel) item.fallbackCount += 1;
    const latency = Number(row.latencyMs || row.durationMs || row.elapsedMs || 0);
    if (latency > 0) { item.totalLatencyMs += latency; item.latencySamples += 1; }
    item.estimatedTokens += Number(row.usage?.total_tokens || row.totalTokens || row.estimatedTokens || 0);
  }
  const models = [...byModel.values()].map(item => ({
    ...item,
    successRate: item.requests ? Math.round(item.success / item.requests * 1000) / 10 : 0,
    averageLatencyMs: item.latencySamples ? Math.round(item.totalLatencyMs / item.latencySamples) : 0
  })).sort((a, b) => b.requests - a.requests);
  return { ok: true, rangeDays: Number(days || 7), totalRequests: rows.length, models, note: "Token 与费用仅在日志含用量字段时统计；未记录用量的请求不会被虚构估算。" };
}



async function opsRecordQualityFeedback(env, { groupId, actorId, actorName, body }) {
  const allowedReasons = ["wrong_person", "wrong_question", "context_error", "tone", "fact_error", "slow", "thinking_residual", "duplicate", "unsafe", "other"];
  const reasonType = allowedReasons.includes(String(body.reasonType || "")) ? String(body.reasonType) : "other";
  const item = await opsSaveRecord(env, {
    type: "quality_feedback",
    groupId,
    actorId,
    actorName,
    data: {
      title: `AI 回复品质回报：${reasonType}`,
      description: String(body.note || "").slice(0, 4000),
      reasonType,
      questionMessageId: String(body.questionMessageId || ""),
      answerMessageId: String(body.answerMessageId || ""),
      aiDecisionId: String(body.aiDecisionId || ""),
      model: String(body.model || ""),
      status: "open"
    }
  });
  return { ok: true, message: "品质回报已建立。", item };
}



async function opsActiveRuleRecords(env, groupId, now = Date.now()) {
  const result = { tempRules: [], exceptions: [], priorities: [] };
  for (const [type, target] of [["temp_rule", "tempRules"], ["exception_rule", "exceptions"], ["rule_version", "priorities"]]) {
    const ids = await readJson(env, opsIndexKey(type), []);
    for (const id of ids.slice(-1000)) {
      const item = await readJson(env, opsRecordKey(type, id), null);
      if (!item || item.deletedAt || item.status === "deleted") continue;
      const groups = (item.groupIds || [item.groupId]).map(String);
      if (!groups.includes(String(groupId))) continue;
      if (Number(item.startsAt || 0) && now < Number(item.startsAt)) continue;
      if (Number(item.expiresAt || item.deadline || 0) && now >= Number(item.expiresAt || item.deadline)) continue;
      if (["expired", "closed", "cancelled", "disabled"].includes(String(item.status || ""))) continue;
      result[target].push(item);
    }
  }
  result.tempRules.sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0));
  return result;
}



function opsRuleExceptionMatch(content, exceptions) {
  const text = String(content || "");
  for (const item of exceptions || []) {
    const pattern = String(item.pattern || item.matchText || item.description || "").trim();
    if (!pattern) continue;
    try {
      const matched = item.regex === true ? new RegExp(pattern, item.caseSensitive ? "" : "i").test(text) : (item.caseSensitive ? text.includes(pattern) : text.toLowerCase().includes(pattern.toLowerCase()));
      if (matched) return item;
    } catch {}
  }
  return null;
}



function opsRuleConflictCheck(records) {
  const warnings = [];
  const normalized = records.map(item => ({ id: item.id, title: item.title, text: `${item.title || ""} ${item.description || ""}`.toLowerCase() }));
  for (let i = 0; i < normalized.length; i++) {
    for (let j = i + 1; j < normalized.length; j++) {
      const a = normalized[i], b = normalized[j];
      if ((/允许|允許|可发送|可發送/.test(a.text) && /禁止|不得|不允许|不允許/.test(b.text)) || (/禁止|不得|不允许|不允許/.test(a.text) && /允许|允許|可发送|可發送/.test(b.text))) {
        warnings.push({ first: a.id, second: b.id, message: `「${a.title}」与「${b.title}」可能存在允许／禁止冲突。` });
      }
    }
  }
  return warnings.slice(0, 100);
}



async function opsFuseState(env, groupId, feature) {
  return await readJson(env, `ops:fuse:${groupId}:${opsSafeId(feature)}`, { feature, consecutiveFailures: 0, paused: false });
}



async function opsFuseAllows(env, groupId, feature) {
  const settings = await opsGetSettings(env, groupId);
  if (!settings.fuseEnabled) return { allowed: true, state: await opsFuseState(env, groupId, feature) };
  const state = await opsFuseState(env, groupId, feature);
  return { allowed: !state.paused, state };
}



async function opsRecordAutomationResult(env, groupId, feature, ok, error = "") {
  const settings = await opsGetSettings(env, groupId);
  const state = await opsFuseState(env, groupId, feature);
  state.feature = feature;
  state.updatedAt = Date.now();
  if (ok) {
    state.consecutiveFailures = 0;
    state.lastSuccessAt = Date.now();
    if (state.paused && state.autoRecover === true) state.paused = false;
  } else {
    state.consecutiveFailures = Number(state.consecutiveFailures || 0) + 1;
    state.lastFailureAt = Date.now();
    state.lastError = String(error || "").slice(0, 1000);
    if (settings.fuseEnabled && state.consecutiveFailures >= settings.fuseFailureThreshold) {
      state.paused = true;
      state.pausedAt = Date.now();
      await writeSystemAudit(env, { type: "ops_fuse", groupId, actorId: "system", action: "tripped", feature, failures: state.consecutiveFailures, error: state.lastError });
    }
  }
  await dbPut(env, `ops:fuse:${groupId}:${opsSafeId(feature)}`, JSON.stringify(state));
  return state;
}



async function opsResetFuse(env, groupId, feature, actorId) {
  const state = await opsFuseState(env, groupId, feature);
  state.paused = false;
  state.consecutiveFailures = 0;
  state.resetAt = Date.now();
  state.resetBy = String(actorId || "");
  await dbPut(env, `ops:fuse:${groupId}:${opsSafeId(feature)}`, JSON.stringify(state));
  await writeSystemAudit(env, { type: "ops_fuse", groupId, actorId, action: "reset", feature });
  return state;
}



async function opsConsumeQuota(env, groupId, actorId, quotaType, amount = 1) {
  const settings = await opsGetSettings(env, groupId);
  const rules = {
    recall: { limit: settings.operationQuota.recallPerMinute, windowMs: 60000 },
    kick: { limit: settings.operationQuota.kickPerHour, windowMs: 3600000 },
    batchMute: { limit: settings.operationQuota.batchMuteMax, windowMs: 60000 },
    announcement: { limit: settings.operationQuota.announcementPerHour, windowMs: 3600000 },
    activityInvite: { limit: settings.operationQuota.activityInvitePerHour, windowMs: 3600000 }
  };
  const rule = rules[quotaType];
  if (!rule) return { ok: true };
  const bucket = Math.floor(Date.now() / rule.windowMs);
  const key = `ops:quota:${groupId}:${actorId}:${quotaType}:${bucket}`;
  const used = Number(await dbGet(env, key) || 0);
  if (used + Number(amount || 1) > rule.limit) return { ok: false, message: `操作配额已达上限：${quotaType} 每个时窗最多 ${rule.limit}。`, used, limit: rule.limit };
  await dbPut(env, key, String(used + Number(amount || 1)));
  return { ok: true, used: used + Number(amount || 1), limit: rule.limit };
}



async function opsRetentionCleanup(env, groupId, now = Date.now()) {
  const settings = await opsGetSettings(env, groupId);
  const cutoff = now - Number(settings.retentionDays || 90) * 86400000;
  let deleted = 0;
  for (const type of Object.keys(OPS_RECORD_TYPES)) {
    const ids = await readJson(env, opsIndexKey(type), []);
    const keep = [];
    for (const id of ids) {
      const item = await readJson(env, opsRecordKey(type, id), null);
      if (!item) continue;
      const at = Number(item.updatedAt || item.createdAt || 0);
      const terminal = ["closed", "completed", "cancelled", "deleted", "expired", "resolved", "rejected"].includes(String(item.status || ""));
      if (terminal && at > 0 && at < cutoff) {
        await dbDel(env, opsRecordKey(type, id));
        await dbDel(env, opsVersionKey(type, id));
        if (type === "activity") await dbDel(env, opsParticipantsKey(id));
        if (type === "poll") await dbDel(env, opsPollVotesKey(id));
        deleted += 1;
      } else keep.push(id);
    }
    if (keep.length !== ids.length) await dbPut(env, opsIndexKey(type), JSON.stringify(keep.slice(-5000)));
  }
  const aiIds = await readJson(env, `ai_decision_log:index:${groupId}`, []);
  const aiKeep = [];
  for (const id of aiIds) {
    const item = await readJson(env, `ai_decision_log:${id}`, null);
    const at = Number(item?.createdAt || Date.parse(item?.at || 0) || 0);
    if (item && at > 0 && at < cutoff) { await dbDel(env, `ai_decision_log:${id}`); deleted += 1; }
    else if (item) aiKeep.push(id);
  }
  if (aiKeep.length !== aiIds.length) await dbPut(env, `ai_decision_log:index:${groupId}`, JSON.stringify(aiKeep.slice(-DEFAULTS.aiDecisionLogLimit)));
  const auditKey = `audit:system:group:${groupId}`;
  const audits = await readJson(env, auditKey, []);
  const auditKeep = audits.filter(item => {
    const at = Number(item?.createdAt || 0) || Date.parse(item?.at || item?.createdAt || 0) || 0;
    return !at || at >= cutoff;
  });
  const auditDeleted = Math.max(0, audits.length - auditKeep.length);
  if (auditDeleted) {
    await dbPut(env, auditKey, JSON.stringify(auditKeep.slice(-5000)));
    deleted += auditDeleted;
  }
  await writeSystemAudit(env, { type: "ops_retention", groupId, actorId: "system", action: "cleanup", deleted, auditDeleted, retentionDays: settings.retentionDays });
  return { ok: true, deleted, auditDeleted, retentionDays: settings.retentionDays };
}



async function opsResolveDigestRecipients(env, groupId, settings) {
  if (settings.dailyDigestRecipientIds?.length) return settings.dailyDigestRecipientIds;
  try {
    const members = await callOneBotAction(env, { action: "get_group_member_list", params: { group_id: numericId(groupId), no_cache: false } }, 15000);
    return (Array.isArray(members) ? members : []).filter(item => item.role === "owner").map(item => String(item.user_id || item.qq || "")).filter(Boolean).slice(0, 5);
  } catch { return []; }
}



async function opsSendDailyDigest(env, groupId, now = Date.now()) {
  const settings = await opsGetSettings(env, groupId);
  if (!settings.dailyDigestEnabled) return { ok: true, skipped: true, reason: "disabled" };
  const p = taipeiParts(now);
  const current = `${p.hour}:${p.minute}`;
  if (current < settings.dailyDigestTime) return { ok: true, skipped: true, reason: "not_due" };
  const dateKey = opsTaipeiDateKey(now);
  const sentKey = `ops:digest:sent:${groupId}:${dateKey}`;
  if (await dbGet(env, sentKey)) return { ok: true, skipped: true, reason: "already_sent" };
  const center = await opsTaskCenter(env, groupId, 1000);
  const counts = center.tasks.reduce((acc, item) => { acc[item.status] = (acc[item.status] || 0) + 1; return acc; }, {});
  const residuals = center.tasks.filter(item => item.kind === "thinking" || String(item.detail?.type || "").includes("thinking_indicator_residual")).length;
  const text = `【群务每日摘要】\n群号：${groupId}\n待确认／进行中：${(counts.pending || 0) + (counts.pending_owner || 0) + (counts.active || 0) + (counts.open || 0)}\n失败／暂停：${(counts.failed || 0) + (counts.paused || 0)}\n任务总数：${center.tasks.length}\n疑似思考提示残留：${residuals}\n如需处理，请进入 Portal 对应页面：任务、排程、活动、群规或申诉。`;
  const recipients = await opsResolveDigestRecipients(env, groupId, settings);
  let sent = 0;
  for (const qq of recipients) {
    try { await sendPortalVerificationMessage(env, qq, text); sent += 1; } catch {}
  }
  if (sent > 0) await dbPut(env, sentKey, String(now));
  return { ok: sent > 0, sent, recipients };
}



async function opsHandleMemberLeave(env, groupId, userId, now = Date.now()) {
  let cancelledSchedules = 0;
  const scheduleIds = await readJson(env, "schedule:index", []);
  for (const id of scheduleIds.slice(-5000)) {
    const item = await readJson(env, `schedule:${id}`, null);
    if (!item || String(item.groupId || "") !== String(groupId) || String(item.creatorId || "") !== String(userId)) continue;
    if (["active", "pending_owner", "pending_review", "paused"].includes(String(item.status || ""))) {
      item.status = "cancelled_member_left";
      item.enabled = false;
      item.cancelledAt = now;
      item.lastResult = "creator_left_group";
      await dbPut(env, `schedule:${id}`, JSON.stringify(item));
      cancelledSchedules += 1;
    }
  }
  let activityRowsUpdated = 0;
  const activityIds = await readJson(env, opsIndexKey("activity"), []);
  for (const id of activityIds.slice(-2000)) {
    const activity = await opsGetRecord(env, "activity", id);
    if (!activity || !(activity.groupIds || [activity.groupId]).map(String).includes(String(groupId))) continue;
    const rows = await opsActivityParticipants(env, id);
    const participant = rows.find(item => String(item.userId || "") === String(userId) && String(item.sourceGroupId || "") === String(groupId));
    if (participant) {
      participant.memberLeftAt = now;
      participant.notificationsPaused = true;
      activityRowsUpdated += 1;
      await dbPut(env, opsParticipantsKey(id), JSON.stringify(rows));
    }
  }
  for (const key of [`thinking_active:group:${groupId}:${userId}`, `question_pending:group:${groupId}:user:${userId}`, `question-inflight:group:${groupId}:user:${userId}`]) await dbDel(env, key).catch(() => {});
  await writeSystemAudit(env, { type: "ops_member_leave_cleanup", groupId, actorId: String(userId), action: "cleanup", cancelledSchedules, activityRowsUpdated });
  return { ok: true, cancelledSchedules, activityRowsUpdated };
}



async function opsMemberSummary(env, groupId, userId) {
  const member = await opsGetGroupMember(env, groupId, userId);
  const violations = (await listRuleViolations(env, groupId, { limit: 2000 }).catch(() => [])).filter(item => String(item.userId || "") === String(userId));
  const appeals = [];
  const appealIds = await readJson(env, `appeal:index:${groupId}`, []);
  for (const id of appealIds.slice(-1000)) {
    const item = await readJson(env, `appeal:${id}`, null);
    if (item && String(item.userId || item.qq || item.creatorId || "") === String(userId)) appeals.push(item);
  }
  const schedules = (await listUserSchedules(env, String(userId), groupId)).length;
  return {
    ok: true,
    userId: String(userId),
    member: member ? { userId: String(member.user_id || member.qq || userId), name: member.card || member.nickname || member.name || String(userId), role: member.role || "member", joinTime: member.join_time || member.joinTime || 0 } : null,
    facts: {
      violationCount: violations.length,
      reversedCount: violations.filter(item => item.humanVerdict === "not_violation").length,
      muteCount: violations.filter(item => String(item.actionTaken || "").includes("mute")).length,
      appealCount: appeals.length,
      approvedAppeals: appeals.filter(item => item.status === "approved").length,
      activeSchedules: schedules
    },
    recentViolations: violations.slice(-20).reverse(),
    recentAppeals: appeals.slice(-20).reverse(),
    note: "这里只呈现事实记录，不产生自动风险分数或自动定罪。"
  };
}



async function opsWelcomePreview(env, groupId, { userId, templateId = "", text = "" }) {
  const member = await opsGetGroupMember(env, groupId, userId);
  let template = templateId ? await opsGetRecord(env, "welcome_template", templateId) : null;
  const source = String(text || template?.description || await dbGet(env, `welcome_text:${groupId}`) || "欢迎 {at} 加入本群，请先阅读群规。");
  const rendered = source.replace(/\{at\}/g, `@${userId}`).replace(/\{name\}/g, member?.card || member?.nickname || String(userId));
  const preview = await opsPreviewMessage(env, { groupId, text: rendered.replace(new RegExp(`@${userId}`, "g"), ""), mentionIds: [String(userId)] });
  return { ok: true, source, rendered, member, preview };
}



async function opsPublishAnnouncement(env, { groupId, actorId, record, asTodo = false }) {
  if (!record) return { ok: false, message: "找不到公告记录。" };
  const quota = await opsConsumeQuota(env, groupId, actorId, "announcement", 1);
  if (!quota.ok) return quota;
  if (!(await canUseBotGroupOperations(env, groupId, actorId))) return { ok: false, message: "当前账号或 Bot 缺少群操作权限。" };
  const type = asTodo ? "todo" : "notice";
  const request = await createGroupWorkRequest(env, { groupId, creatorId: actorId, creatorName: actorId, type, content: record.description || record.title || "" });
  request.reason = String(record.reason || "").slice(0, 1000);
  await dbPut(env, `groupwork:${request.id}`, JSON.stringify(request));
  return { ok: true, message: "已建立待确认操作；确认后才会执行。", request };
}



async function opsExecuteHandoff(env, { groupId, actorId, actorRole, body }) {
  const mode = String(body.mode || "portal");
  const targetQq = String(body.targetQq || "").replace(/\D/g, "");
  const reason = String(body.reason || "").trim().slice(0, 1000);
  if (!targetQq || !reason) return { ok: false, message: "目标 QQ 与交接原因都必须填写。" };
  if (mode === "portal") {
    const capabilities = [...new Set((Array.isArray(body.capabilities) ? body.capabilities : []).map(String).filter(id => opsCapabilityDef(id)))];
    if (!capabilities.length) return { ok: false, message: "请至少选择一项 Portal 权限。" };
    const expiresAt = Number(body.expiresAt || 0);
    for (const capability of capabilities) {
      await dbPut(env, opsPermissionKey(groupId, targetQq, capability), JSON.stringify({ allowed: true, reason, expiresAt, actorId, updatedAt: Date.now(), handoff: true }));
    }
    const record = await opsSaveRecord(env, { type: "handoff", groupId, actorId, actorName: actorId, data: { title: `Portal 权限交接给 ${targetQq}`, description: reason, mode, targetQq, capabilities, expiresAt, status: "active" } });
    return { ok: true, message: "Portal 权限交接已生效。", record };
  }
  if (mode === "qq_admin") {
    const bot = await getBotGroupRole(env, groupId);
    if (String(bot?.role || "") !== "owner") return { ok: false, message: "Bot 必须是当前 QQ 群主，才能新增或撤销真正的 QQ 管理员。" };
    if (!isDeveloperId(env, actorId) && actorRole !== "owner") return { ok: false, message: "只有当前群主或开发者可以执行 QQ 管理员交接。" };
    const target = await opsGetGroupMember(env, groupId, targetQq);
    if (!target) return { ok: false, message: "目标成员目前不在群内。" };
    const enable = body.enable !== false;
    try {
      await callOneBotAction(env, { action: "set_group_admin", params: { group_id: numericId(groupId), user_id: numericId(targetQq), enable } }, 15000);
      const record = await opsSaveRecord(env, { type: "handoff", groupId, actorId, actorName: actorId, data: { title: `${enable ? "新增" : "撤销"} QQ 管理员 ${targetQq}`, description: reason, mode, targetQq, enable, status: "completed", executedAt: Date.now() } });
      return { ok: true, message: enable ? "已新增 QQ 管理员。" : "已撤销 QQ 管理员。", record };
    } catch (error) {
      return { ok: false, message: `QQ 管理员交接失败：${String(error?.message || error)}` };
    }
  }
  return { ok: false, message: "未知交接模式。" };
}



async function opsSnapshotConfig(env, groupId, actorId, title = "") {
  const payload = {
    schema: "qqai-ops-snapshot-v1",
    groupId,
    version: VERSION,
    at: Date.now(),
    settings: await opsGetSettings(env, groupId),
    portalSettings: Object.fromEntries(await Promise.all(PORTAL_SETTING_DEFINITIONS.filter(def => def.scope === "group").map(async def => [def.key, await readPortalSettingValue(env, def, groupId, actorId)])))
  };
  const item = await opsSaveRecord(env, { type: "deployment_snapshot", groupId, actorId, actorName: actorId, data: { title: title || `设置快照 ${new Date().toISOString()}`, description: "群设置与营运设置快照", status: "active", payload } });
  return { ok: true, item };
}



async function opsRestoreSnapshot(env, groupId, actorId, snapshotId, previewOnly = true) {
  const item = await opsGetRecord(env, "deployment_snapshot", snapshotId);
  if (!item?.payload || String(item.payload.groupId || "") !== String(groupId)) return { ok: false, message: "找不到可用快照。" };
  if (previewOnly) return { ok: true, preview: true, payload: item.payload, message: "这是恢复预览，尚未修改设置。" };
  await opsSaveSettings(env, groupId, item.payload.settings || {});
  for (const def of PORTAL_SETTING_DEFINITIONS.filter(def => def.scope === "group")) {
    if (Object.prototype.hasOwnProperty.call(item.payload.portalSettings || {}, def.key)) await writePortalSettingValue(env, def, groupId, actorId, item.payload.portalSettings[def.key]);
  }
  await writeSystemAudit(env, { type: "ops_snapshot", groupId, actorId, action: "restore", snapshotId });
  return { ok: true, message: "群设置快照已恢复。" };
}



function qqaiChineseNumber(value) {
  const source = String(value || "").trim();
  if (/^\d+$/.test(source)) return Number(source);
  const digit = { 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 兩: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  if (source === "十") return 10;
  if (source.includes("十")) {
    const [left, right] = source.split("十");
    return (left ? digit[left] || 0 : 1) * 10 + (right ? digit[right] || 0 : 0);
  }
  return digit[source] ?? NaN;
}



function qqaiNaturalTimeOfDay(text) {
  const source = String(text || "");
  let match = source.match(/(?:凌晨|早上|上午|中午|下午|傍晚|晚上)?\s*(\d{1,2}|[零〇一二两兩三四五六七八九十]{1,3})(?:[:：点點时時](\d{1,2})?|半)\s*(?:分)?/);
  if (!match) return "";
  let hour = qqaiChineseNumber(match[1]);
  const minute = /半/.test(match[0]) ? 30 : Math.max(0, Math.min(59, Number(match[2] || 0)));
  const period = String(match[0] || "");
  if (/(?:下午|傍晚|晚上)/.test(period) && hour < 12) hour += 12;
  if (/中午/.test(period) && hour < 11) hour += 12;
  if (/凌晨/.test(period) && hour === 12) hour = 0;
  if (hour < 0 || hour > 23) return "";
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}



function qqaiNaturalFutureDateTime(text, now = Date.now()) {
  const source = String(text || "");
  const absolute = source.match(/(20\d{2})[\/-](\d{1,2})[\/-](\d{1,2})[^\d]{0,8}((?:凌晨|早上|上午|中午|下午|傍晚|晚上)?\s*\d{1,2}(?:[:：点點时時]\d{0,2})?)/);
  if (absolute) {
    const time = qqaiNaturalTimeOfDay(absolute[4]);
    if (time) return parseTaipeiDateTime(`${absolute[1]}-${String(Number(absolute[2])).padStart(2, "0")}-${String(Number(absolute[3])).padStart(2, "0")} ${time}`);
  }
  const compact = source.match(/(20\d{2}-\d{2}-\d{2})\s+(\d{1,2}:\d{2})/);
  if (compact) return parseTaipeiDateTime(`${compact[1]} ${compact[2]}`);
  const time = qqaiNaturalTimeOfDay(source);
  if (!time) return 0;
  const p = taipeiParts(now);
  let days = 0;
  if (/后天|後天/.test(source)) days = 2;
  else if (/明天|明日/.test(source)) days = 1;
  else if (/今天|今日/.test(source)) days = 0;
  else {
    const week = source.match(/(?:下周|下週|周|週|星期)([一二三四五六日天])/);
    if (week) {
      const targetDay = ({ 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 7, 天: 7 })[week[1]];
      const weekdayMap = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
      const current = weekdayMap[p.weekday] || 1;
      days = (targetDay - current + 7) % 7;
      if (/下周|下週/.test(source)) days += 7;
      if (days === 0 && !/今天|今日/.test(source)) days = 7;
    }
  }
  const base = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), 0, 0) + days * 86400000;
  const targetParts = taipeiParts(base + 12 * 3600000);
  let target = parseTaipeiDateTime(`${targetParts.year}-${targetParts.month}-${targetParts.day} ${time}`);
  if (!/(?:今天|今日|明天|明日|后天|後天|下周|下週|周|週|星期)/.test(source) && target <= now) target += 86400000;
  return target;
}



function qqaiNaturalScheduleCommand(text, now = Date.now()) {
  const source = String(text || "").trim();
  let match = source.match(/^(?:请|請)?(?:帮我|幫我)?\s*(每天|每日)\s*(.+?)\s*(?:提醒|通知)\s*([\s\S]+)$/i);
  if (match) {
    const time = qqaiNaturalTimeOfDay(match[2]);
    if (time) return `!排程 每天 ${time} ${match[3].trim()}`;
  }
  match = source.match(/^(?:请|請)?(?:帮我|幫我)?\s*(?:每周|每週|每星期)([一二三四五六日天])\s*(.+?)\s*(?:提醒|通知)\s*([\s\S]+)$/i);
  if (match) {
    const time = qqaiNaturalTimeOfDay(match[2]);
    if (time) return `!排程 每周${match[1]} ${time} ${match[3].trim()}`;
  }
  match = source.match(/^(?:请|請)?(?:帮我|幫我)?\s*每隔\s*(\d+)\s*(分钟|分鐘|分|小时|小時|天)\s+(?:提醒|通知)?\s*([\s\S]+)$/i);
  if (match) return `!排程 每隔 ${match[1]}${match[2]} ${match[3].trim()}`;
  if (/(?:提醒|通知)/.test(source) && /(?:今天|今日|明天|明日|后天|後天|下周|下週|周|週|星期|20\d{2}[\/-]\d{1,2}[\/-]\d{1,2})/.test(source)) {
    const at = qqaiNaturalFutureDateTime(source, now);
    const contentMatch = source.match(/(?:提醒|通知)([\s\S]+)$/);
    if (at && at > now && contentMatch?.[1]?.trim()) {
      const p = taipeiParts(at);
      return `!排程 ${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute} ${contentMatch[1].trim()}`;
    }
  }
  match = source.match(/^(?:请|請)?(?:帮我|幫我)?\s*(?:取消|删除|刪除)\s*(?:编号为|編號為|编号|編號)?\s*([\w-]+)\s*(?:的)?排程$/i);
  if (match) return `!排程 取消 ${match[1]}`;
  match = source.match(/^(?:请|請)?(?:帮我|幫我)?\s*(?:把)?\s*排程\s*([\w-]+)\s*(?:暂停一次|暫停一次|跳过一次|跳過一次)$/i);
  if (match) return `!排程 暂停一次 ${match[1]}`;
  return "";
}



function normalizeNaturalLanguageCommandText(text, now = Date.now()) {
  const source = String(text || "").trim();
  if (!source || /^[!！/]/.test(source)) return null;
  if (/(?:建立|创建|創建|举办|舉辦|办|辦|开|開)\s*(?:一个|一個|个|個)?[^。\n]{0,30}(?:活动|活動)/i.test(source)) return null;
  const mappings = [
    [/^(?:请|請)?(?:帮我|幫我)?\s*(?:开启|開啟|打开|打開)\s*(?:本群)?\s*AI$/i, "!开启ai"],
    [/^(?:请|請)?(?:帮我|幫我)?\s*(?:关闭|關閉)\s*(?:本群)?\s*AI$/i, "!关闭ai"],
    [/^(?:查看|查询|查詢)(?:一下)?\s*(?:系统)?(?:状态|狀態|配额|配額)$/i, "!status"],
    [/^(?:查看|显示|顯示)(?:一下)?\s*(?:帮助|幫助|指令)$/i, "!帮助"],
    [/^(?:查看|查询|查詢|查|看看|告诉我|告訴我)(?:一下)?\s*(?:我的|我和你的)?\s*好感度(?:是多少)?$/i, "!好感度"],
    [/^(?:请|請)?(?:帮我|幫我)?\s*(?:开启|開啟|打开|打開)?\s*(?:把)?好感度(?:资料|資料)?(?:提供|给|給|加入)(?:给|給)?\s*AI$/i, "!好感度注入 开"],
    [/^(?:请|請)?(?:帮我|幫我)?\s*(?:关闭|關閉|停止|不要|別|别)\s*(?:把)?好感度(?:资料|資料)?(?:提供|给|給|加入)(?:给|給)?\s*AI$/i, "!好感度注入 关"],
    [/^(?:查看|查询|查詢)\s*好感度(?:给|給)?AI(?:的)?(?:状态|狀態|设置|設定)?$/i, "!好感度注入 状态"],
    [/^(?:请|請)?(?:帮我|幫我)?\s*(?:开启|開啟|打开|打開)\s*群规监控$/i, "!群规监控 开"],
    [/^(?:请|請)?(?:帮我|幫我)?\s*(?:关闭|關閉)\s*群规监控$/i, "!群规监控 关"],
    [/^(?:查看|查询|查詢)\s*群规监控(?:状态|狀態)?$/i, "!群规监控 状态"],
    [/^(?:请|請)?(?:帮我|幫我)?\s*(?:开启|開啟|打开|打開)\s*入群(?:辅助|輔助)$/i, "!入群辅助 开"],
    [/^(?:请|請)?(?:帮我|幫我)?\s*(?:关闭|關閉)\s*入群(?:辅助|輔助)$/i, "!入群辅助 关"],
    [/^(?:请|請)?(?:帮我|幫我)?\s*(?:开启|開啟|打开|打開)\s*自动欢迎$/i, "!自动欢迎 开"],
    [/^(?:请|請)?(?:帮我|幫我)?\s*(?:关闭|關閉)\s*自动欢迎$/i, "!自动欢迎 关"],
    [/^(?:请|請)?(?:帮我|幫我)?\s*(?:开启|開啟|打开|打開)\s*(?:群)?记忆$/i, "!记忆开"],
    [/^(?:请|請)?(?:帮我|幫我)?\s*(?:关闭|關閉)\s*(?:群)?记忆$/i, "!记忆关"],
    [/^(?:查看|告诉我|告訴我)(?:一下)?\s*(?:你)?记住了什么$/i, "!你记住了什么"],
    [/^(?:查看|显示|顯示)(?:一下)?\s*群规$/i, "!群规"],
    [/^(?:查看|显示|顯示|列出)(?:一下)?\s*(?:我的)?排程(?:列表|清单|清單)?$/i, "!排程 列表"],
    [/^(?:请|請)?(?:帮我|幫我)?\s*(?:开启|開啟|打开|打開)\s*违规禁言保护$/i, "!违规禁言保护 开"],
    [/^(?:请|請)?(?:帮我|幫我)?\s*(?:关闭|關閉)\s*违规禁言保护$/i, "!违规禁言保护 关"],
    [/^(?:查看|查询|查詢)\s*违规禁言保护(?:状态|狀態)?$/i, "!违规禁言保护 状态"],
    [/^(?:申请|申請)(?:加入)?(?:本群)?白名单$/i, "!申请白名单"]
  ];
  for (const [pattern, commandText] of mappings) if (pattern.test(source)) return { commandText, intent: commandText.slice(1), confidence: 1 };
  let match = source.match(/^(?:请|請)?(?:帮我|幫我)?\s*(?:检查|檢查|复核|復核)(?:一下)?(?:我回复|我回覆|回复|回覆)?(?:的)?(?:这条|這條)?(?:消息|訊息|发言|發言)?\s*(?:，|,|：|:)?\s*(?:原因(?:是|为|為)?|因为|因為|理由)?\s*([\s\S]{2,})$/i);
  if (match) return { commandText: `!检查 ${match[1].trim()}`, intent: "manual_rule_check", confidence: 1 };
  match = source.match(/^(?:这条|這條)(?:消息|訊息|发言|發言)(?:可能|好像|应该|應該)?(?:违规|違規)\s*(?:，|,|：|:)?\s*(?:原因(?:是|为|為)?|因为|因為|理由)?\s*([\s\S]{2,})$/i);
  if (match) return { commandText: `!检查 ${match[1].trim()}`, intent: "manual_rule_check", confidence: 0.99 };
  match = source.match(/^(?:查看|查询|查詢|查|看看|告诉我|告訴我)(?:一下)?\s*(@?\d{5,})\s*(?:的)?好感度(?:是多少)?$/i);
  if (match) return { commandText: `!好感度 ${match[1]}`, intent: "affinity_query", confidence: 1 };
  match = source.match(/^(?:请|請)?(?:帮我|幫我)?\s*(?:把)?(?:模型|回答模型)\s*(?:切换到|切換到|改成|设为|設為|使用)\s*([A-Za-z0-9 ._-]+)$/i);
  if (match) return { commandText: `!模型 ${match[1].trim()}`, intent: "model_preference", confidence: 1 };
  match = source.match(/^(?:我要|我想|帮我|幫我|请帮我|請幫我)?\s*(?:申诉|申訴)\s+([\s\S]+)$/i);
  if (match) return { commandText: `!申诉 ${match[1].trim()}`, intent: "appeal_create", confidence: 0.99 };
  match = source.match(/^(?:查看|查询|查詢)\s*(?:我的)?(?:申诉|申訴)(?:状态|狀態)\s+([a-z0-9:_-]+)$/i);
  if (match) return { commandText: `!申诉状态 ${match[1]}`, intent: "appeal_status", confidence: 1 };
  match = source.match(/^(?:请|請)?(?:帮我|幫我)?\s*(?:把)?群规(?:严格度|嚴格度|等级|等級)?\s*(?:改成|设为|設為|调整为|調整為)\s*(智慧|智能|自适应|自適應|宽松|寬鬆|低|中|高|严格|嚴格)$/i);
  if (match) return { commandText: `!群规严格度 ${match[1]}`, intent: "rule_strictness", confidence: 1 };
  match = source.match(/^(?:请|請)?(?:帮我|幫我)?\s*(?:把)?欢迎词\s*(?:改成|设为|設為)\s*([\s\S]+)$/i);
  if (match) return { commandText: `!欢迎词 ${match[1].trim()}`, intent: "welcome_text", confidence: 1 };
  match = source.match(/^(?:请|請)?(?:帮我|幫我)?\s*(?:把)?(?:主动)?插话率\s*(?:改成|设为|設為|调整为|調整為)\s*(\d{1,3})\s*%?$/i);
  if (match) return { commandText: `!设置插话率 ${Math.max(0, Math.min(100, Number(match[1])))}`, intent: "interject_rate", confidence: 1 };
  match = source.match(/^(?:请|請)?(?:帮我|幫我)?\s*记住\s+([\s\S]+)$/i);
  if (match) return { commandText: `!记住 ${match[1].trim()}`, intent: "memory_remember", confidence: 1 };
  match = source.match(/^(?:请|請)?(?:帮我|幫我)?\s*忘记\s+([\s\S]+)$/i);
  if (match) return { commandText: `!忘记 ${match[1].trim()}`, intent: "memory_forget", confidence: 1 };
  const schedule = qqaiNaturalScheduleCommand(source, now);
  if (schedule) return { commandText: schedule, intent: "schedule", confidence: 0.98 };
  return null;
}



function shouldClassifyNaturalLanguageCommand(text) {
  const source = String(text || "").trim();
  if (!/^(?:请|請|帮我|幫我|麻烦|麻煩|把|将|將|设置|設定|开启|開啟|打开|打開|关闭|關閉|查看|查询|查詢|显示|顯示|看看|告诉我|告訴我|检查|檢查|复核|復核|切换|切換|调整|調整|取消|暂停|暫停|记住|記住|忘记|忘記|申请|申請)/i.test(source)) return false;
  return /(?:本群\s*AI|群规|群規|排程|定时|定時|提醒|欢迎|歡迎|插话|插話|记忆|記憶|模型|入群辅助|入群輔助|违规禁言保护|違規禁言保護|违规检查|違規檢查|检查这条|檢查這條|复核这条|復核這條|好感度|申诉|申訴|系统状态|系統狀態|配额|配額)/i.test(source);
}



async function classifyNaturalLanguageCommandIntent(env, text) {
  if (!shouldClassifyNaturalLanguageCommand(text)) return null;
  try {
    const result = await callGoogleDecision(env, {
      system: `你是 QQ Bot 自然语言操作解析器。只输出 JSON，不回答用户问题。格式：{"intent":"none|ai_on|ai_off|status|help|schedule_list|rule_monitor_on|rule_monitor_off|rule_monitor_status|rule_strictness|join_assist_on|join_assist_off|welcome_on|welcome_off|welcome_text|memory_on|memory_off|memory_list|memory_remember|memory_forget|model_set|interject_rate|mute_guard_on|mute_guard_off|mute_guard_status|manual_rule_check|affinity_query|affinity_context_on|affinity_context_off|affinity_context_status|appeal_create|appeal_status","confidence":0到1,"value":"参数"}。只有明确要求执行操作时才识别；讨论、假设、引用、抱怨、询问功能原理一律 none。manual_rule_check 的 value 必须保留用户解释的具体违规原因；没有原因时输出 none。不要输出 ! 指令。`,
      prompt: String(text || "").slice(0, 2000),
      maxOutputTokens: 180
    });
    const parsed = JSON.parse(String(result.text || "").match(/\{[\s\S]*\}/)?.[0] || "{}");
    if (Number(parsed.confidence || 0) < 0.9 || !parsed.intent || parsed.intent === "none") return null;
    const value = String(parsed.value || "").trim();
    const commandByIntent = {
      ai_on: "!开启ai", ai_off: "!关闭ai", status: "!status", help: "!帮助",
      schedule_list: "!排程 列表",
      rule_monitor_on: "!群规监控 开", rule_monitor_off: "!群规监控 关", rule_monitor_status: "!群规监控 状态",
      join_assist_on: "!入群辅助 开", join_assist_off: "!入群辅助 关",
      welcome_on: "!自动欢迎 开", welcome_off: "!自动欢迎 关",
      memory_on: "!记忆开", memory_off: "!记忆关", memory_list: "!你记住了什么",
      mute_guard_on: "!违规禁言保护 开", mute_guard_off: "!违规禁言保护 关", mute_guard_status: "!违规禁言保护 状态",
      affinity_query: "!好感度", affinity_context_on: "!好感度注入 开", affinity_context_off: "!好感度注入 关", affinity_context_status: "!好感度注入 状态"
    };
    let commandText = commandByIntent[parsed.intent] || "";
    if (parsed.intent === "rule_strictness" && value) commandText = `!群规严格度 ${value}`;
    if (parsed.intent === "welcome_text" && value) commandText = `!欢迎词 ${value}`;
    if (parsed.intent === "memory_remember" && value) commandText = `!记住 ${value}`;
    if (parsed.intent === "memory_forget" && value) commandText = `!忘记 ${value}`;
    if (parsed.intent === "model_set" && value) commandText = `!模型 ${value}`;
    if (parsed.intent === "interject_rate" && value) commandText = `!设置插话率 ${Math.max(0, Math.min(100, Number(value.replace(/\D/g, "")) || 0))}`;
    if (parsed.intent === "appeal_create" && value) commandText = `!申诉 ${value}`;
    if (parsed.intent === "appeal_status" && value) commandText = `!申诉状态 ${value}`;
    if (parsed.intent === "manual_rule_check" && value) commandText = `!检查 ${value}`;
    if (parsed.intent === "affinity_query" && value) commandText = `!好感度 ${value}`;
    return commandText ? { commandText, intent: parsed.intent, confidence: Number(parsed.confidence || 0), parser: "gemma_json" } : null;
  } catch (error) {
    console.warn("Natural language command classifier unavailable:", error?.message || error);
    return null;
  }
}




function qqaiActivityPendingKey(groupId, userId) {
  return `ops:natural_activity_pending:${opsSafeId(groupId || "private")}:${opsSafeId(userId)}`;
}


function qqaiPollPendingKey(groupId, userId) {
  return `ops:natural_poll_pending:${opsSafeId(groupId || "private")}:${opsSafeId(userId)}`;
}



function qqaiCollaborationCandidate(text) {
  const source = String(text || "").trim();
  if (!source || /^[!！/]/.test(source)) return false;
  // This is only a cheap gate deciding whether to call the intent model. It never executes an operation.
  return /活动|活動|报名|報名|候补|候補|投票|票选|票選|参加|參加|退出|名单|名單|选项|選項/i.test(source);
}



async function classifyCollaborationNaturalIntent(env, text, defaultGroupId = "") {
  const source = String(text || "").trim();
  if (!qqaiCollaborationCandidate(source)) return null;
  try {
    const result = await callGoogleDecision(env, {
      system: `你是 QQ 群活动与投票的意图解析器。只输出 JSON，不回答用户。\n格式：{"intent":"none|activity_list|activity_join|activity_leave|activity_create|activity_roster|activity_announce|poll_list|poll_vote|poll_create|poll_close","confidence":0到1,"target":"活动或投票名称/编号","title":"新标题","description":"说明","options":["选项"],"optionIndexes":[1],"capacity":0,"waitlistEnabled":true,"startAtText":"","deadlineText":"","groupIds":["群号"],"announceMode":"none|all"}。\n必须判断完整语义，而不是看到关键词就执行。只有用户明确要求机器人现在执行、查看、报名、取消、投票、建立、通知或结束时才识别。以下都必须输出 none：叙述别人做了什么、讨论功能、引用聊天、假设、抱怨、反问、玩笑、包含“管理员会禁言/有人在投票”等非操作语句。\n建立活动、建立投票、发送活动通知、结束投票属于高影响操作；仍要识别，但系统之后会要求二次确认。投票 optionIndexes 使用从 1 开始的序号。没有明确目标或必要参数时输出 none。`,
      prompt: source.slice(0, 2500),
      maxOutputTokens: 360
    });
    const parsed = JSON.parse(String(result.text || "").match(/\{[\s\S]*\}/)?.[0] || "{}");
    const confidence = Number(parsed.confidence || 0);
    const allowed = new Set(["activity_list","activity_join","activity_leave","activity_create","activity_roster","activity_announce","poll_list","poll_vote","poll_create","poll_close"]);
    if (!allowed.has(String(parsed.intent || "")) || confidence < 0.93) return null;
    const intent = String(parsed.intent);
    const target = String(parsed.target || "").trim().slice(0, 200);
    const title = String(parsed.title || "").trim().slice(0, 200);
    const options = (Array.isArray(parsed.options) ? parsed.options : []).map(v => String(v || "").trim()).filter(Boolean).slice(0, 20);
    const optionIndexes = [...new Set((Array.isArray(parsed.optionIndexes) ? parsed.optionIndexes : []).map(v => Number(v)).filter(v => Number.isInteger(v) && v > 0 && v <= 20))];
    if (["activity_join","activity_leave","activity_roster","activity_announce","poll_vote","poll_close"].includes(intent) && !target) return null;
    if (intent === "activity_create" && !title) return null;
    if (intent === "poll_create" && (!title || options.length < 2)) return null;
    if (intent === "poll_vote" && !optionIndexes.length) return null;
    const groupIds = [...new Set((Array.isArray(parsed.groupIds) ? parsed.groupIds : []).map(v => String(v || "").replace(/\D/g, "")).filter(v => /^\d{5,}$/.test(v)))].slice(0, 30);
    if (!groupIds.length && defaultGroupId) groupIds.push(String(defaultGroupId));
    return {
      intent, confidence, parser: "gemma_collaboration_json", target, title,
      description: String(parsed.description || "").trim().slice(0, 8000),
      options, optionIndexes,
      capacity: Math.max(0, Math.min(100000, Number(parsed.capacity || 0))),
      waitlistEnabled: parsed.waitlistEnabled !== false,
      startAt: parsed.startAtText ? qqaiNaturalFutureDateTime(String(parsed.startAtText), Date.now()) : 0,
      deadline: parsed.deadlineText ? qqaiNaturalFutureDateTime(String(parsed.deadlineText), Date.now()) : 0,
      groupIds,
      announceMode: parsed.announceMode === "all" ? "all" : "none"
    };
  } catch (error) {
    console.warn("Collaboration intent classifier unavailable:", error?.message || error);
    return null;
  }
}



function qqaiParseFixedActivityCreate(text, defaultGroupId = "") {
  const source = String(text || "").trim();
  const match = source.match(/^[!！](?:活动|活動)\s*(?:建立|创建|創建)\s+([\s\S]+)$/i);
  if (!match) return null;
  const parts = match[1].split(/\s*\|\s*/).map(v => v.trim());
  const title = parts.shift() || "";
  const capacity = Math.max(0, Math.min(100000, Number((parts[0] || "").match(/\d+/)?.[0] || 0)));
  const waitlistEnabled = !/(?:不|关闭|關閉|无|無)\s*(?:候补|候補)/i.test(parts[1] || "");
  const startAt = parts[2] ? qqaiNaturalFutureDateTime(parts[2], Date.now()) : 0;
  const signupDeadline = parts[3] ? qqaiNaturalFutureDateTime(parts[3], Date.now()) : 0;
  return { title, description: parts[4] || "", groupIds: defaultGroupId ? [String(defaultGroupId)] : [], capacity, waitlistEnabled, startAt, signupDeadline, announceOnCreate: false, announceMode: "none", status: "active" };
}



async function opsResolvePoll(env, { query, groupId, userId, role }) {
  const raw = String(query || "").trim();
  const rows = (await opsListRecords(env, "poll", { groupId, qq: userId, role, limit: 100 })).filter(item => item.status === "active");
  if (!raw) return rows.length === 1 ? { poll: rows[0] } : { poll: null, ambiguous: rows };
  const direct = rows.find(item => String(item.id) === raw);
  if (direct) return { poll: direct };
  const normalized = raw.toLowerCase().replace(/[「」『』\s]/g, "");
  const exact = rows.find(item => String(item.title || "").toLowerCase().replace(/[「」『』\s]/g, "") === normalized);
  if (exact) return { poll: exact };
  const matches = rows.filter(item => String(item.title || "").toLowerCase().includes(raw.toLowerCase()) || raw.toLowerCase().includes(String(item.title || "").toLowerCase()));
  return matches.length === 1 ? { poll: matches[0] } : { poll: null, ambiguous: matches };
}



function qqaiExtractActivityTitle(text) {
  const source = String(text || "").trim();
  const named = source.match(/(?:名称|名稱|名字|标题|標題|名为|名為|叫)\s*(?:是|为|為|：|:)?\s*[「『\"“]?([^，。；;\n」』\"”]{1,80})/i);
  if (named) return named[1].trim().replace(/(?:的)?(?:活动|活動)$/i, "").trim();
  const after = source.match(/(?:建立|创建|創建|举办|舉辦|办|辦|开|開)\s*(?:一个|一個|个|個)?\s*(?:叫\s*)?[「『\"“]?([^，。；;\n」』\"”]{1,60}?)[」』\"”]?\s*(?:的)?活动/i);
  if (after) return after[1].trim().replace(/^(?:一个|一個|个|個)\s*/, "").replace(/(?:的)?(?:活动|活動)$/i, "").trim();
  const generic = source.match(/(?:建立|创建|創建|举办|舉辦|办|辦|开|開)\s*(?:一个|一個|个|個)?\s*活动\s*[「『\"“]?([^，。；;\n」』\"”]{1,80})/i);
  if (generic) return generic[1].trim();
  return "";
}



function qqaiParseNaturalActivityCreate(text, defaultGroupId, now = Date.now()) {
  const source = String(text || "").trim();
  if (!/(?:建立|创建|創建|举办|舉辦|办|辦|开|開)\s*(?:一个|一個|个|個)?[^。\n]{0,30}(?:活动|活動)/i.test(source)) return null;
  const title = qqaiExtractActivityTitle(source);
  const capacityMatch = source.match(/(?:限|最多|上限|名额|名額)\s*(\d{1,6})\s*人?/i);
  const capacity = capacityMatch ? Math.max(0, Math.min(100000, Number(capacityMatch[1]))) : 0;
  const waitlistEnabled = !/(?:不|不要|关闭|關閉|不开|不開)\s*(?:开放|開放|要)?\s*候补/i.test(source) && /候补|候補/i.test(source);
  const noMentionAll = /(?:不|不要|无需|無需)\s*(?:@|艾特|通知)?\s*(?:全体|全體)/i.test(source);
  const mentionAll = !noMentionAll && /@\s*(?:全体|全體)|艾特全体|艾特全體|通知全体|通知全體/i.test(source);
  const announceOnCreate = mentionAll || noMentionAll || /(?:立即|马上|馬上)?\s*(?:发布|發佈|发送|發送|通知|公告)/i.test(source);
  const groupIds = [];
  const groupBlock = source.match(/(?:群号|群號|群组|群組|目标群|目標群)\s*[:：]?\s*((?:\d{5,}[,，、和与與\s]*)+)/i);
  if (groupBlock) groupIds.push(...[...groupBlock[1].matchAll(/\d{5,}/g)].map(m => m[0]));
  if (!groupIds.length && defaultGroupId) groupIds.push(String(defaultGroupId));
  let signupDeadline = 0;
  const deadlineText = source.match(/(?:报名|報名)?\s*(?:截止|截至)\s*([^，。；;\n]+)/i)?.[1] || "";
  if (deadlineText) signupDeadline = qqaiNaturalFutureDateTime(deadlineText, now);
  let startAt = 0;
  const startText = source.match(/(?:活动|活動)?\s*(?:开始|開始|时间|時間)\s*(?:是|为|為|：|:)?\s*([^，。；;\n]+)/i)?.[1] || "";
  if (startText) startAt = qqaiNaturalFutureDateTime(startText, now);
  if (!startAt) startAt = qqaiNaturalFutureDateTime(source, now);
  const description = source.match(/(?:说明|說明|内容|內容|备注|備註)\s*(?:是|为|為|：|:)?\s*([\s\S]+)/i)?.[1]?.trim() || "";
  return {
    title,
    description,
    groupIds: [...new Set(groupIds)],
    capacity,
    waitlistEnabled,
    signupDeadline,
    startAt,
    announceOnCreate,
    announceMode: mentionAll ? "all" : "none",
    status: "active"
  };
}



async function opsActivityContextGroup(env, activity, userId, preferredGroupId = "") {
  if (!activity) return "";
  const groups = [...new Set((activity.groupIds || [activity.groupId]).map(value => String(value || "").replace(/\D/g, "")).filter(Boolean))];
  const preferred = String(preferredGroupId || "").replace(/\D/g, "");
  if (preferred && groups.includes(preferred)) return preferred;
  const saved = String(await dbGet(env, `private_default_group:${userId}`) || "").replace(/\D/g, "");
  if (saved && groups.includes(saved)) return saved;
  for (const groupId of groups) {
    const member = await opsGetGroupMember(env, groupId, userId);
    if (member) return groupId;
  }
  return "";
}



async function opsResolveActivity(env, { query, groupId = "", userId = "", role = "member", privateMode = false }) {
  const raw = String(query || "").trim();
  if (raw && /^[a-z0-9:_-]+$/i.test(raw)) {
    const exact = await readJson(env, opsRecordKey("activity", raw), null);
    if (exact) {
      const contextGroupId = privateMode ? await opsActivityContextGroup(env, exact, userId, groupId) : String(groupId || "");
      if (contextGroupId && (exact.groupIds || [exact.groupId]).map(String).includes(contextGroupId)) {
        const contextRole = await resolvePortalRole(env, userId, contextGroupId);
        const view = await opsEffectiveCapability(env, { groupId: contextGroupId, qq: userId, role: contextRole, capability: "activity.view" });
        if (view.allowed) return { activity: exact, contextGroupId };
      }
    }
  }
  let rows = [];
  if (privateMode) {
    const ids = await readJson(env, opsIndexKey("activity"), []);
    for (const id of ids.slice(-500).reverse()) {
      const item = await readJson(env, opsRecordKey("activity", id), null);
      if (!item || item.deletedAt) continue;
      const contextGroupId = await opsActivityContextGroup(env, item, userId, groupId);
      if (contextGroupId) {
        const contextRole = await resolvePortalRole(env, userId, contextGroupId);
        const view = await opsEffectiveCapability(env, { groupId: contextGroupId, qq: userId, role: contextRole, capability: "activity.view" });
        if (view.allowed) rows.push({ item, contextGroupId });
      }
      if (rows.length >= 100) break;
    }
  } else {
    rows = (await opsListRecords(env, "activity", { groupId, qq: userId, role, limit: 100 })).map(item => ({ item, contextGroupId: String(groupId) }));
  }
  const active = rows.filter(row => row.item.status === "active");
  if (!raw) return active.length === 1 ? { activity: active[0].item, contextGroupId: active[0].contextGroupId } : { activity: null, contextGroupId: "", ambiguous: active };
  const normalized = raw.toLowerCase().replace(/[「」『』\s]/g, "");
  const exactTitle = active.find(row => String(row.item.title || "").toLowerCase().replace(/[「」『』\s]/g, "") === normalized);
  if (exactTitle) return { activity: exactTitle.item, contextGroupId: exactTitle.contextGroupId };
  const matches = active.filter(row => String(row.item.title || "").toLowerCase().includes(raw.toLowerCase()) || raw.toLowerCase().includes(String(row.item.title || "").toLowerCase()));
  return matches.length === 1 ? { activity: matches[0].item, contextGroupId: matches[0].contextGroupId } : { activity: null, contextGroupId: "", ambiguous: matches };
}




async function opsHandleActivityCommand(env, { groupId, userId, userName, role, text, isPrivate = false, naturalIntent = null }) {
  const originalText = String(text || "").trim();
  const confirmationText = /^(?:确认建立活动|確認建立活動|取消建立活动|取消建立活動|确认建立投票|確認建立投票|取消建立投票|取消建立投票|确认结束投票|確認結束投票|取消结束投票|取消結束投票)$/i.test(originalText);
  if (!naturalIntent && !confirmationText && !/^[!！]/.test(originalText)) return { handled: false };
  let normalized = originalText;
  if (naturalIntent) {
    const map = { activity_list: "!活动", activity_join: `!报名 ${naturalIntent.target}`, activity_leave: `!取消报名 ${naturalIntent.target}`, activity_roster: `!活动名单 ${naturalIntent.target}`, activity_announce: `!活动通知 ${naturalIntent.target} ${naturalIntent.announceMode === "all" ? "全体" : "不全体"}`, poll_list: "!投票", poll_vote: `!投票 选择 ${naturalIntent.target || ""} ${(naturalIntent.optionIndexes || []).join(",")}`, poll_close: `!投票 结束 ${naturalIntent.target}` };
    normalized = map[naturalIntent.intent] || originalText;
  }
  const looksActivity = /活动|活動|报名|報名|候补|候補|参加|參加|退出报名|退出報名|投票/i.test(normalized);
  const preferredGroupId = String(groupId || (isPrivate ? await dbGet(env, `private_default_group:${userId}`) : "") || "").replace(/\D/g, "");
  const effectiveRole = isPrivate && preferredGroupId ? await resolvePortalRole(env, userId, preferredGroupId) : role;
  const pendingKey = qqaiActivityPendingKey(preferredGroupId || "private", userId);

  if (/^(?:确认建立活动|確認建立活動|确认创建活动|確認創建活動)$/i.test(normalized)) {
    const pending = await readJson(env, pendingKey, null);
    if (!pending || Date.now() > Number(pending.expiresAt || 0)) {
      await dbDel(env, pendingKey);
      return { handled: true, text: "没有等待确认的活动建立操作，或确认已过期。" };
    }
    const payload = pending.payload || {};
    const targetGroups = [...new Set((payload.groupIds || []).map(value => String(value || "").replace(/\D/g, "")).filter(Boolean))];
    if (!targetGroups.length) return { handled: true, text: "没有可用的目标群，请先在 Portal 设置私聊默认群，或在群聊中建立。" };
    for (const targetGroupId of targetGroups) {
      const targetRole = await resolvePortalRole(env, userId, targetGroupId);
      const manage = await opsEffectiveCapability(env, { groupId: targetGroupId, qq: userId, role: targetRole, capability: "activity.manage" });
      if (!manage.allowed) return { handled: true, text: `你没有群 ${targetGroupId} 的活动管理权限。` };
    }
    if (targetGroups.length > 1) {
      const crossRole = await resolvePortalRole(env, userId, targetGroups[0]);
      const cross = await opsEffectiveCapability(env, { groupId: targetGroups[0], qq: userId, role: crossRole, capability: "activity.cross_group" });
      if (!cross.allowed) return { handled: true, text: "你没有跨独立群统整活动的权限。" };
    }
    if (payload.announceMode === "all") {
      for (const targetGroupId of targetGroups) {
        const targetRole = await resolvePortalRole(env, userId, targetGroupId);
        const mentionAll = await opsEffectiveCapability(env, { groupId: targetGroupId, qq: userId, role: targetRole, capability: "activity.mention_all" });
        if (!mentionAll.allowed) return { handled: true, text: `你没有群 ${targetGroupId} 的活动通知 @全体权限。` };
      }
    }
    const item = await opsSaveRecord(env, {
      type: "activity",
      groupId: targetGroups[0],
      actorId: userId,
      actorName: userName,
      data: { ...payload, groupId: targetGroups[0], groupIds: targetGroups }
    });
    await dbDel(env, pendingKey);
    let announceResult = null;
    if (payload.announceOnCreate) announceResult = await opsAnnounceActivity(env, item, { actorId: userId, mode: payload.announceMode || "none" });
    return { handled: true, text: `活动已建立。\n编号：${item.id}\n名称：${item.title}\n名额：${item.capacity || "不限"}\n候补：${item.waitlistEnabled ? "开启" : "关闭"}${announceResult ? `\n通知：${announceResult.message}` : ""}` };
  }

  if (/^(?:取消建立活动|取消建立活動|取消创建活动|取消創建活動)$/i.test(normalized)) {
    await dbDel(env, pendingKey);
    return { handled: true, text: "已取消等待中的活动建立操作。" };
  }

  const pollPendingKey = qqaiPollPendingKey(preferredGroupId || "private", userId);
  if (/^(?:确认建立投票|確認建立投票)$/i.test(normalized)) {
    const pending = await readJson(env, pollPendingKey, null);
    if (!pending || pending.action !== "create" || Date.now() > Number(pending.expiresAt || 0)) { await dbDel(env, pollPendingKey); return { handled: true, text: "没有等待确认的投票建立操作，或确认已过期。" }; }
    const targetRole = await resolvePortalRole(env, userId, preferredGroupId);
    const gate = await opsEffectiveCapability(env, { groupId: preferredGroupId, qq: userId, role: targetRole, capability: "poll.manage" });
    if (!gate.allowed) return { handled: true, text: "你没有建立投票的权限。" };
    const item = await opsSaveRecord(env, { type: "poll", groupId: preferredGroupId, actorId: userId, actorName: userName, data: pending.payload });
    await dbDel(env, pollPendingKey);
    return { handled: true, text: `投票已建立。\n编号：${item.id}\n标题：${item.title}\n选项：\n${item.options.map((v,i)=>`${i+1}. ${v}`).join("\n")}` };
  }
  if (/^(?:取消建立投票|取消建立投票)$/i.test(normalized)) { await dbDel(env, pollPendingKey); return { handled: true, text: "已取消等待中的投票建立操作。" }; }
  if (/^(?:确认结束投票|確認結束投票)$/i.test(normalized)) {
    const pending = await readJson(env, pollPendingKey, null);
    if (!pending || pending.action !== "close" || Date.now() > Number(pending.expiresAt || 0)) { await dbDel(env, pollPendingKey); return { handled: true, text: "没有等待确认的结束投票操作，或确认已过期。" }; }
    const poll = await readJson(env, opsRecordKey("poll", pending.pollId), null);
    if (!poll) return { handled: true, text: "找不到投票。" };
    const targetRole = await resolvePortalRole(env, userId, preferredGroupId);
    const gate = await opsEffectiveCapability(env, { groupId: preferredGroupId, qq: userId, role: targetRole, capability: "poll.manage" });
    if (!gate.allowed) return { handled: true, text: "你没有结束投票的权限。" };
    poll.status = "closed"; poll.closedAt = Date.now(); poll.closedBy = userId; await dbPut(env, opsRecordKey("poll", poll.id), JSON.stringify(poll)); await dbDel(env, pollPendingKey);
    return { handled: true, text: `投票“${poll.title}”已结束。` };
  }
  if (/^(?:取消结束投票|取消結束投票)$/i.test(normalized)) { await dbDel(env, pollPendingKey); return { handled: true, text: "已取消结束投票。" }; }

  let pollMatch = normalized.match(/^[!！](?:投票)(?:\s+列表)?$/i);
  if (pollMatch) {
    const gate = await opsEffectiveCapability(env, { groupId: preferredGroupId, qq: userId, role: effectiveRole, capability: "poll.view" });
    if (!gate.allowed) return { handled: true, text: "你没有查看投票的权限。" };
    const rows = (await opsListRecords(env, "poll", { groupId: preferredGroupId, qq: userId, role: effectiveRole, limit: 100 })).filter(item => item.status === "active");
    if (!rows.length) return { handled: true, text: "目前没有进行中的投票。" };
    return { handled: true, text: `进行中的投票：\n${rows.slice(0,20).map(item => `${item.id}｜${item.title}｜${(item.options||[]).map((o,i)=>`${i+1}.${o}`).join(" / ")}`).join("\n")}\n\n固定指令：!投票 选择 编号 选项序号` };
  }

  pollMatch = normalized.match(/^[!！]投票\s*(?:建立|创建|創建)\s+([\s\S]+)$/i);
  if (pollMatch || naturalIntent?.intent === "poll_create") {
    const title = naturalIntent?.intent === "poll_create" ? naturalIntent.title : String(pollMatch[1] || "").split(/\s*\|\s*/)[0].trim();
    const options = naturalIntent?.intent === "poll_create" ? naturalIntent.options : String(pollMatch[1] || "").split(/\s*\|\s*/).slice(1).map(v=>v.trim()).filter(Boolean);
    if (!preferredGroupId) return { handled: true, text: "请先选择目标群，或直接在目标群中建立投票。" };
    if (!title || options.length < 2) return { handled: true, text: "格式：!投票 建立 标题 | 选项一 | 选项二（至少两个选项）。" };
    const targetRole = await resolvePortalRole(env, userId, preferredGroupId);
    const gate = await opsEffectiveCapability(env, { groupId: preferredGroupId, qq: userId, role: targetRole, capability: "poll.manage" });
    if (!gate.allowed) return { handled: true, text: "你没有建立投票的权限。" };
    const payload = { title, description: naturalIntent?.description || "", options, multiple: false, allowChange: true, deadline: naturalIntent?.deadline || 0, status: "active" };
    await dbPut(env, pollPendingKey, JSON.stringify({ action: "create", payload, createdAt: Date.now(), expiresAt: Date.now() + 2 * 60 * 1000 }));
    return { handled: true, text: `我理解为建立投票：\n标题：${title}\n选项：\n${options.map((v,i)=>`${i+1}. ${v}`).join("\n")}\n\n回复“确认建立投票”执行，回复“取消建立投票”放弃。` };
  }

  pollMatch = normalized.match(/^[!！]投票\s*(?:选择|選擇|投|投给|投給)\s+([^\s]+)\s+([\d,，、\s]+)$/i);
  if (pollMatch) {
    const resolved = await opsResolvePoll(env, { query: pollMatch[1], groupId: preferredGroupId, userId, role: effectiveRole });
    if (!resolved.poll) return { handled: true, text: "找不到投票，或名称不够明确。" };
    const indexes = [...new Set([...String(pollMatch[2]).matchAll(/\d+/g)].map(m=>Number(m[0])-1).filter(v=>v>=0))];
    const gate = await opsEffectiveCapability(env, { groupId: preferredGroupId, qq: userId, role: effectiveRole, capability: "poll.vote" });
    if (!gate.allowed) return { handled: true, text: "你没有参与投票的权限。" };
    const result = await opsVotePoll(env, resolved.poll, { userId, optionIndexes: indexes });
    return { handled: true, text: `${resolved.poll.title}：${result.message}` };
  }

  pollMatch = normalized.match(/^[!！]投票\s*(?:结束|結束|关闭|關閉)\s+(.+)$/i);
  if (pollMatch) {
    const resolved = await opsResolvePoll(env, { query: pollMatch[1], groupId: preferredGroupId, userId, role: effectiveRole });
    if (!resolved.poll) return { handled: true, text: "找不到要结束的投票。" };
    const targetRole = await resolvePortalRole(env, userId, preferredGroupId);
    const gate = await opsEffectiveCapability(env, { groupId: preferredGroupId, qq: userId, role: targetRole, capability: "poll.manage" });
    if (!gate.allowed) return { handled: true, text: "你没有结束投票的权限。" };
    await dbPut(env, pollPendingKey, JSON.stringify({ action: "close", pollId: resolved.poll.id, createdAt: Date.now(), expiresAt: Date.now() + 2 * 60 * 1000 }));
    return { handled: true, text: `即将结束投票“${resolved.poll.title}”。回复“确认结束投票”执行，回复“取消结束投票”放弃。` };
  }

  let match = normalized.match(/^[!！](?:活动|活動)(?:\s+列表)?$/i);
  if (match) {
    let rows = [];
    if (isPrivate) {
      const ids = await readJson(env, opsIndexKey("activity"), []);
      for (const id of ids.slice(-500).reverse()) {
        const item = await readJson(env, opsRecordKey("activity", id), null);
        if (!item || item.deletedAt || item.status !== "active") continue;
        const contextGroupId = await opsActivityContextGroup(env, item, userId, preferredGroupId);
        if (!contextGroupId) continue;
        const contextRole = await resolvePortalRole(env, userId, contextGroupId);
        const view = await opsEffectiveCapability(env, { groupId: contextGroupId, qq: userId, role: contextRole, capability: "activity.view" });
        if (!view.allowed) continue;
        rows.push(item);
        if (rows.length >= 30) break;
      }
    } else if (preferredGroupId) {
      const view = await opsEffectiveCapability(env, { groupId: preferredGroupId, qq: userId, role: effectiveRole, capability: "activity.view" });
      if (!view.allowed) return { handled: true, text: "你没有查看活动的权限。" };
      rows = await opsListRecords(env, "activity", { groupId: preferredGroupId, qq: userId, role: effectiveRole, limit: 100 });
    }
    if (!rows.length) return { handled: true, text: isPrivate && !preferredGroupId ? "没有找到你可访问的活动。可先在 Portal 设置私聊默认群。" : "目前没有可报名活动。" };
    const lines = [];
    for (const item of rows.slice(0, 20)) {
      const summary = await opsActivitySummary(env, item, { viewerId: userId, canManage: false });
      lines.push(`${item.id}｜${item.title}｜正式 ${summary.confirmedCount}${item.capacity ? `/${item.capacity}` : ""}｜候补 ${summary.waitlistCount}`);
    }
    return { handled: true, text: `可报名活动：\n${lines.join("\n")}\n\n可直接说“报名 活动名称”或“取消报名 活动名称”。` };
  }

  match = normalized.match(/^[!！](?:报名|報名)(?:\s+(.+))?$/i);
  if (match) {
    const query = String(match[1] || "").trim();
    const resolved = await opsResolveActivity(env, { query, groupId: preferredGroupId, userId, role: effectiveRole, privateMode: isPrivate });
    if (!resolved.activity) {
      const names = (resolved.ambiguous || []).slice(0, 8).map(row => `${row.item?.title || row.title}（${row.item?.id || row.id}）`);
      return { handled: true, text: names.length ? `找到多个可能的活动，请说完整名称或编号：\n${names.join("\n")}` : "找不到可报名的活动。" };
    }
    const sourceGroupId = resolved.contextGroupId || preferredGroupId;
    const sourceRole = await resolvePortalRole(env, userId, sourceGroupId);
    const capability = await opsEffectiveCapability(env, { groupId: sourceGroupId, qq: userId, role: sourceRole, capability: "activity.join" });
    if (!capability.allowed) return { handled: true, text: "你没有活动报名权限。" };
    const result = await opsJoinActivity(env, resolved.activity, { userId, userName, sourceGroupId });
    return { handled: true, text: `${resolved.activity.title}：${result.message}` };
  }

  match = normalized.match(/^[!！](?:取消报名|取消報名)(?:\s+(.+))?$/i);
  if (match) {
    const query = String(match[1] || "").trim();
    const resolved = await opsResolveActivity(env, { query, groupId: preferredGroupId, userId, role: effectiveRole, privateMode: isPrivate });
    if (!resolved.activity) return { handled: true, text: "找不到要取消的活动；请提供完整名称或编号。" };
    const sourceGroupId = resolved.contextGroupId || preferredGroupId;
    const sourceRole = await resolvePortalRole(env, userId, sourceGroupId);
    const capability = await opsEffectiveCapability(env, { groupId: sourceGroupId, qq: userId, role: sourceRole, capability: "activity.join" });
    if (!capability.allowed) return { handled: true, text: "你没有活动报名／取消权限。" };
    const result = await opsLeaveActivity(env, resolved.activity, userId);
    return { handled: true, text: `${resolved.activity.title}：${result.message}` };
  }

  match = normalized.match(/^[!！](?:活动名单|活動名單)\s+(.+)$/i);
  if (match) {
    const resolved = await opsResolveActivity(env, { query: match[1], groupId: preferredGroupId, userId, role: effectiveRole, privateMode: isPrivate });
    if (!resolved.activity) return { handled: true, text: "找不到活动。" };
    const targetGroupId = resolved.contextGroupId || preferredGroupId;
    const targetRole = await resolvePortalRole(env, userId, targetGroupId);
    const capability = await opsEffectiveCapability(env, { groupId: targetGroupId, qq: userId, role: targetRole, capability: "activity.manage" });
    if (!capability.allowed) return { handled: true, text: "你没有查看完整活动名单的权限。" };
    const summary = await opsActivitySummary(env, resolved.activity, { viewerId: userId, canManage: true });
    const confirmed = summary.participants.filter(item => item.status === "confirmed").map((item, index) => `${index + 1}. ${item.userName}（${item.userId}）｜来源群 ${item.sourceGroupId}`);
    const waitlist = summary.participants.filter(item => item.status === "waitlist").map((item, index) => `${index + 1}. ${item.userName}（${item.userId}）`);
    return { handled: true, text: `【${resolved.activity.title}】\n正式报名：\n${confirmed.join("\n") || "无"}\n\n候补：\n${waitlist.join("\n") || "无"}` };
  }

  match = normalized.match(/^[!！](?:活动通知|活動通知)\s+(.+?)(?:\s+(全体|全體|不全体|不全體))?$/i);
  if (match) {
    const resolved = await opsResolveActivity(env, { query: match[1], groupId: preferredGroupId, userId, role: effectiveRole, privateMode: isPrivate });
    if (!resolved.activity) return { handled: true, text: "找不到要通知的活动。" };
    const mode = /^(?:全体|全體)$/.test(String(match[2] || "").trim()) ? "all" : "none";
    const result = await opsAnnounceActivity(env, resolved.activity, { actorId: userId, mode });
    return { handled: true, text: result.message };
  }

  const createPayload = naturalIntent?.intent === "activity_create" ? { title: naturalIntent.title, description: naturalIntent.description, groupIds: naturalIntent.groupIds.length ? naturalIntent.groupIds : (preferredGroupId ? [preferredGroupId] : []), capacity: naturalIntent.capacity, waitlistEnabled: naturalIntent.waitlistEnabled, signupDeadline: naturalIntent.deadline, startAt: naturalIntent.startAt, announceOnCreate: false, announceMode: naturalIntent.announceMode, status: "active" } : qqaiParseFixedActivityCreate(normalized, preferredGroupId);
  if (createPayload) {
    if (!createPayload.title) return { handled: true, text: "请补充活动名称，例如：建立一个叫“周末游戏夜”的活动，限 20 人，可以候补。" };
    if (!createPayload.groupIds.length) return { handled: true, text: "私聊建立活动前，请先在 Portal 设置默认群；或直接在目标群里 @我 建立。" };
    for (const targetGroupId of createPayload.groupIds) {
      const targetRole = await resolvePortalRole(env, userId, targetGroupId);
      const manage = await opsEffectiveCapability(env, { groupId: targetGroupId, qq: userId, role: targetRole, capability: "activity.manage" });
      if (!manage.allowed) return { handled: true, text: `你没有群 ${targetGroupId} 的活动管理权限。` };
    }
    if (createPayload.groupIds.length > 1) {
      const targetRole = await resolvePortalRole(env, userId, createPayload.groupIds[0]);
      const cross = await opsEffectiveCapability(env, { groupId: createPayload.groupIds[0], qq: userId, role: targetRole, capability: "activity.cross_group" });
      if (!cross.allowed) return { handled: true, text: "你没有跨独立群统整活动的权限。" };
    }
    if (createPayload.announceMode === "all") {
      for (const targetGroupId of createPayload.groupIds) {
        const targetRole = await resolvePortalRole(env, userId, targetGroupId);
        const mentionAll = await opsEffectiveCapability(env, { groupId: targetGroupId, qq: userId, role: targetRole, capability: "activity.mention_all" });
        if (!mentionAll.allowed) return { handled: true, text: `你没有群 ${targetGroupId} 的活动通知 @全体权限。可以改说“不 @全体”。` };
      }
    }
    await dbPut(env, pendingKey, JSON.stringify({ payload: createPayload, createdAt: Date.now(), expiresAt: Date.now() + 2 * 60 * 1000 }));
    const startText = createPayload.startAt ? new Date(createPayload.startAt).toLocaleString("zh-CN", { timeZone: "Asia/Taipei", hour12: false }) : "未设置";
    const deadlineText = createPayload.signupDeadline ? new Date(createPayload.signupDeadline).toLocaleString("zh-CN", { timeZone: "Asia/Taipei", hour12: false }) : "未设置";
    return { handled: true, text: `我理解为：\n建立活动：${createPayload.title}\n目标群：${createPayload.groupIds.join("、")}\n人数上限：${createPayload.capacity || "不限"}\n候补：${createPayload.waitlistEnabled ? "开启" : "关闭"}\n开始时间：${startText}\n报名截止：${deadlineText}\n建立后通知：${createPayload.announceOnCreate ? (createPayload.announceMode === "all" ? "发送并 @全体" : "发送但不 @全体") : "不发送"}\n\n回复“确认建立活动”执行，回复“取消建立活动”放弃。确认有效期 2 分钟。` };
  }

  return { handled: false, text: looksActivity ? "" : undefined };
}


async function opsProcessAutomations(env, now = Date.now()) {
  // 到期活动／投票自动关闭；临时权限、临时群规与维护模式自动失效。
  for (const type of ["activity", "poll", "temp_rule", "handoff"]) {
    const ids = await readJson(env, opsIndexKey(type), []);
    for (const id of ids.slice(-2000)) {
      const item = await readJson(env, opsRecordKey(type, id), null);
      if (!item || item.deletedAt) continue;
      const expiry = Number(item.signupDeadline || item.deadline || item.expiresAt || 0);
      if (expiry && now >= expiry && item.status === "active") {
        item.status = type === "temp_rule" ? "expired" : "closed";
        item.closedAt = now;
        if (type === "handoff" && item.mode === "portal" && item.targetQq && Array.isArray(item.capabilities)) {
          for (const capability of item.capabilities) {
            const current = await readJson(env, opsPermissionKey(item.groupId, item.targetQq, capability), null);
            if (current?.handoff) await dbDel(env, opsPermissionKey(item.groupId, item.targetQq, capability));
          }
          item.revokedAt = now;
          item.revokedBy = "system:expiry";
        }
        await dbPut(env, opsRecordKey(type, id), JSON.stringify(item));
      }
    }
  }
  const groups = await readJson(env, "known_groups", []);
  for (const raw of groups.slice(-1000)) {
    const groupId = String(raw?.group_id || raw?.groupId || raw?.id || raw || "");
    if (!groupId) continue;
    const settings = await opsGetSettings(env, groupId);
    if (settings.maintenanceMode && settings.maintenanceUntil > 0 && now >= settings.maintenanceUntil) {
      await opsSaveSettings(env, groupId, { maintenanceMode: false, maintenanceUntil: 0 });
      await writeSystemAudit(env, { type: "ops_maintenance", groupId, actorId: "system", action: "auto_expired" });
    }
    await opsSendDailyDigest(env, groupId, now).catch(error => console.warn("营运摘要发送失败", groupId, error));
    const dateKey = opsTaipeiDateKey(now);
    const cleanupKey = `ops:retention:done:${groupId}:${dateKey}`;
    const p = taipeiParts(now);
    if (p.hour === "03" && !(await dbGet(env, cleanupKey))) {
      await opsRetentionCleanup(env, groupId, now).catch(error => console.warn("营运资料清理失败", groupId, error));
      await dbPut(env, cleanupKey, String(now));
    }
    if (settings.anomalyDetectionEnabled) {
      const audits = await readJson(env, `audit:system:group:${groupId}`, []);
      const recent = audits.filter(item => now - Date.parse(item.at || 0) <= 60000);
      const failures = recent.filter(item => /failed|error|residual|tripped/i.test(`${item.type || ""} ${item.action || ""} ${item.result || ""}`));
      if (failures.length >= settings.fuseFailureThreshold * 2) {
        await writeSystemAudit(env, { type: "ops_anomaly", groupId, actorId: "system", action: "high_failure_burst", count: failures.length });
      }
    }
  }
}

export { OPS_CAPABILITIES, OPS_RECORD_TYPES, OPS_REMOVED_RECORD_TYPES, classifyCollaborationNaturalIntent, classifyNaturalLanguageCommandIntent, normalizeNaturalLanguageCommandText, opsActiveRuleRecords, opsActivityAnnouncementText, opsActivityContextGroup, opsActivityParticipants, opsActivitySummary, opsAnalytics, opsAnnounceActivity, opsCapabilityDef, opsCleanupThinking, opsConsumeQuota, opsCreateScheduleFromSpec, opsDeleteRecord, opsDependencyCheck, opsEffectiveCapability, opsExecuteHandoff, opsFuseAllows, opsFuseState, opsGetGroupMember, opsGetRecord, opsGetSettings, opsHandleActivityCommand, opsHandleMemberLeave, opsImpactPreview, opsIndexKey, opsInviteActivityParticipant, opsJoinActivity, opsLeaveActivity, opsListRecords, opsMemberSummary, opsMinutesOfDay, opsModelMetrics, opsNextScheduleRuns, opsParticipantsKey, opsPermissionKey, opsPollVotesKey, opsPreviewMessage, opsProcessAutomations, opsPromoteActivityWaitlist, opsPublishAnnouncement, opsPurgeRemovedRecordTypes, opsQuietState, opsRecordAutomationResult, opsRecordKey, opsRecordQualityFeedback, opsRemovedType, opsRequire, opsResetFuse, opsResolveActivity, opsResolveDigestRecipients, opsResolvePoll, opsRestoreSnapshot, opsRetentionCleanup, opsRoleRank, opsRuleConflictCheck, opsRuleExceptionMatch, opsRuleSandbox, opsSafeId, opsSaveRecord, opsSaveSettings, opsSchedulePreview, opsSendDailyDigest, opsSendDraftNow, opsSettingsKey, opsSnapshotConfig, opsTaipeiDateKey, opsTaskAction, opsTaskCenter, opsTypeDef, opsVersionKey, opsVotePoll, opsWelcomePreview, qqaiActivityPendingKey, qqaiChineseNumber, qqaiCollaborationCandidate, qqaiExtractActivityTitle, qqaiNaturalFutureDateTime, qqaiNaturalScheduleCommand, qqaiNaturalTimeOfDay, qqaiParseFixedActivityCreate, qqaiParseNaturalActivityCreate, qqaiPollPendingKey, shouldClassifyNaturalLanguageCommand };
