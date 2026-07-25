// Extracted from worker.js without behavioral changes.
// Cloudflare still deploys worker.js as the single Worker entry point.

import { callGeminiGenerate, callGoogleDecision, notifyDeveloper, parseList, taipeiDateKey } from "../ai/runtime.js";
import { DEFAULTS } from "../config/runtime.js";
import { appendIndex, callOneBotAction, removeFromIndex, writeSystemAudit } from "../core/permissions.js";
import { dbDel, dbGet, dbPut } from "../data/store.js";
import { getAppealEligibleGroupsForUser } from "../group/runtime.js";
import { retractModerationProposalMessage } from "../moderation/runtime.js";
import { parseDurationSeconds, runOneBotGroupOperation } from "../onebot/messages.js";
import { opsFuseAllows, opsGetSettings, opsQuietState, opsRecordAutomationResult } from "../operations/runtime.js";
import { readJson, sendPortalVerificationMessage } from "../portal/auth.js";
import { getFeatureFlag, isGroupWhitelisted, numericId } from "../security/network.js";



function parseScheduleRequest(text, now = Date.now()) {
  const raw = String(text || "").trim();
  let m = raw.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}:\d{2})\s+([\s\S]+)$/);
  if (m) {
    const at = parseTaipeiDateTime(`${m[1]} ${m[2]}`);
    if (!at || at <= now) return { ok: false, message: "单次排程时间必须晚于现在。" };
    return { ok: true, type: "once", nextRunAt: at, content: m[3].trim(), timezone: "Asia/Taipei" };
  }
  m = raw.match(/^每天\s+(\d{1,2}:\d{2})\s+([\s\S]+)$/);
  if (m) return { ok: true, type: "daily", timeOfDay: m[1], nextRunAt: nextTaipeiTime(m[1], now), content: m[2].trim(), timezone: "Asia/Taipei" };
  m = raw.match(/^每周([一二三四五六日天])\s+(\d{1,2}:\d{2})\s+([\s\S]+)$/);
  if (m) return { ok: true, type: "weekly", weekday: "一二三四五六日".indexOf(m[1]) + 1 || 7, timeOfDay: m[2], nextRunAt: nextTaipeiWeekday(m[1], m[2], now), content: m[3].trim(), timezone: "Asia/Taipei" };
  m = raw.match(/^每月(\d{1,2})日\s+(\d{1,2}:\d{2})\s+([\s\S]+)$/);
  if (m) return { ok: true, type: "monthly", dayOfMonth: Math.min(28, Math.max(1, Number(m[1]))), timeOfDay: m[2], nextRunAt: nextTaipeiMonthly(Number(m[1]), m[2], now), content: m[3].trim(), timezone: "Asia/Taipei" };
  m = raw.match(/^每隔\s*(\d+)\s*(分钟|分鐘|分|小时|小時|时|時|天)\s+([\s\S]+)$/);
  if (m) {
    const seconds = parseDurationSeconds(`${m[1]}${m[2]}`);
    if (seconds < DEFAULTS.scheduleMinIntervalMinutes * 60) return { ok: false, message: `重复排程最短间隔为 ${DEFAULTS.scheduleMinIntervalMinutes} 分钟。` };
    return { ok: true, type: "interval", intervalMs: seconds * 1000, nextRunAt: now + seconds * 1000, content: m[3].trim(), timezone: "Asia/Taipei" };
  }
  return { ok: false, message: "格式示例：!排程 2026-07-22 18:00 内容；!排程 每天 18:00 内容；!排程 每周一 18:00 内容；!排程 每隔 2小时 内容" };
}



function parseTaipeiDateTime(value) {
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]) - 8, Number(m[5]));
}



function taipeiParts(ms = Date.now()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, weekday: "short" }).formatToParts(new Date(ms));
  return Object.fromEntries(parts.map(p => [p.type, p.value]));
}



function nextTaipeiTime(time, now = Date.now()) {
  const p = taipeiParts(now); const [h, min] = time.split(":").map(Number);
  let target = parseTaipeiDateTime(`${p.year}-${p.month}-${p.day} ${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`);
  if (target <= now) target += 86400000;
  return target;
}



function nextTaipeiWeekday(char, time, now = Date.now()) {
  const targetDay = ({ 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 7, 天: 7 })[char] || 1;
  const weekdayMap = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  const p = taipeiParts(now); const current = weekdayMap[p.weekday] || 1;
  let days = (targetDay - current + 7) % 7;
  let target = nextTaipeiTime(time, now + days * 86400000 - (days ? 1 : 0));
  if (days && target < now + days * 86400000 - 3600000) target += 86400000;
  return target;
}



function nextTaipeiMonthly(day, time, now = Date.now()) {
  const p = taipeiParts(now); const [h, min] = time.split(":").map(Number); const safeDay = Math.min(28, Math.max(1, day));
  let y = Number(p.year), mo = Number(p.month);
  let target = parseTaipeiDateTime(`${y}-${String(mo).padStart(2, "0")}-${String(safeDay).padStart(2, "0")} ${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`);
  if (target <= now) { mo++; if (mo > 12) { mo = 1; y++; } target = parseTaipeiDateTime(`${y}-${String(mo).padStart(2, "0")}-${String(safeDay).padStart(2, "0")} ${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`); }
  return target;
}



async function reviewScheduleWithGemma(env, content) {
  try {
    const result = await callGoogleDecision(env, {
      system: "你是排程安全审查器。判断是否明显违法、骚扰、洗版、冒充、泄露隐私、恶意群管理或其他滥用。只输出JSON：{\"decision\":\"allow|uncertain|reject\",\"reason\":\"简短原因\"}。不确定就uncertain。",
      prompt: String(content).slice(0, 4000),
      maxOutputTokens: 120
    });
    const json = JSON.parse(result.text.match(/\{[\s\S]*\}/)?.[0] || "{}");
    const provider = String(result.provider || (String(result.model || "").toLowerCase().startsWith("gemma-") ? "gemma" : "gemini"));
    return ["allow", "uncertain", "reject"].includes(json.decision)
      ? { ...json, provider, model: String(result.model || ""), reviewedAt: Date.now() }
      : { decision: "uncertain", reason: "无法稳定判断", provider, model: String(result.model || ""), reviewedAt: Date.now() };
  } catch (error) {
    console.warn("Gemma schedule review unavailable:", error);
    return { decision: "uncertain", reason: "审查服务暂时不可用", provider: "unavailable", model: "", reviewedAt: Date.now() };
  }
}



function parseManagementScheduleAction(content) {
  const text = String(content || "").trim();
  const m = text.match(/^[!！](禁言|解禁|踢出|撤回|全员禁言|全員禁言|解除全员禁言|解除全員禁言|改群名|改名片|关闭ai|關閉ai|开启ai|開啟ai|记忆开|記憶開|记忆关|記憶關)(?:\s|$)/i);
  return m ? { command: m[1], raw: text } : null;
}




function extractScheduleMentionIds(content) {
  return [...new Set([...String(content || "").matchAll(/@(\d{5,})/g)].map(match => match[1]))].slice(0, 50);
}



function buildScheduledGroupMessage(content, mentionIds = []) {
  const text = String(content || "");
  const allowed = new Set((Array.isArray(mentionIds) ? mentionIds : []).map(String));
  const segments = [];
  let last = 0;
  for (const match of text.matchAll(/@(\d{5,})/g)) {
    const id = String(match[1] || "");
    if (!allowed.has(id)) continue;
    if (match.index > last) segments.push({ type: "text", data: { text: text.slice(last, match.index) } });
    segments.push({ type: "at", data: { qq: id } });
    last = Number(match.index || 0) + match[0].length;
  }
  if (last < text.length) segments.push({ type: "text", data: { text: text.slice(last) } });
  return segments.length ? segments : text;
}



function scheduleSpecFromRecord(item) {
  if (item?.scheduleSpec) return String(item.scheduleSpec);
  const content = String(item?.content || "");
  if (item?.type === "once" && item.nextRunAt) {
    const p = taipeiParts(Number(item.nextRunAt));
    return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute} ${content}`;
  }
  if (item?.type === "daily") return `每天 ${item.timeOfDay || "00:00"} ${content}`;
  if (item?.type === "weekly") return `每周${"一二三四五六日"[Math.max(0, Number(item.weekday || 1) - 1)] || "一"} ${item.timeOfDay || "00:00"} ${content}`;
  if (item?.type === "monthly") return `每月${Number(item.dayOfMonth || 1)}日 ${item.timeOfDay || "00:00"} ${content}`;
  if (item?.type === "interval") return `每隔 ${Math.max(1, Math.round(Number(item.intervalMs || 60000) / 60000))}分钟 ${content}`;
  return content;
}



async function deleteScheduleRecord(env, id) {
  await dbDel(env, `schedule:${id}`);
  await removeFromIndex(env, "schedule:index", id);
}



async function reviseScheduleRecord(env, { id, actorId, canManage = false, canDirectManage = false, scheduleText, scopeGroupId = "", allowCrossGroup = false }) {
  const item = await readJson(env, `schedule:${id}`, null);
  if (!item) return { ok: false, message: "找不到该排程。" };
  if (scopeGroupId && String(item.groupId || "") !== String(scopeGroupId) && !allowCrossGroup) return { ok: false, message: "该排程不属于当前群组。" };
  if (String(item.creatorId || "") !== String(actorId || "") && !canManage) return { ok: false, message: "你没有编辑该排程的权限。" };
  const parsed = parseScheduleRequest(String(scheduleText || ""), Date.now());
  if (!parsed.ok) return parsed;
  const review = await reviewScheduleWithGemma(env, JSON.stringify(parsed));
  if (review.decision === "reject") return { ok: false, message: `排程已拒绝：${review.reason || "内容不符合要求"}` };
  const managementAction = parseManagementScheduleAction(parsed.content);
  const status = managementAction ? (canDirectManage ? "active" : "pending_owner") : (review.decision === "allow" ? "active" : "pending_owner");
  for (const key of ["timeOfDay", "weekday", "dayOfMonth", "intervalMs"]) delete item[key];
  Object.assign(item, parsed, {
    scheduleSpec: String(scheduleText || "").trim(),
    mentionIds: extractScheduleMentionIds(parsed.content),
    managementAction,
    review,
    status,
    enabled: status === "active",
    skipNextRun: false,
    failureCount: 0,
    updatedAt: Date.now(),
    updatedBy: String(actorId || "")
  });
  await dbPut(env, `schedule:${id}`, JSON.stringify(item));
  return { ok: true, schedule: item, message: status === "active" ? `排程 ${id} 已更新。` : `排程 ${id} 已更新并送交审核。` };
}



async function skipScheduleOnce(env, id, actorId, canManage = false, scopeGroupId = "", allowCrossGroup = false) {
  const item = await readJson(env, `schedule:${id}`, null);
  if (!item) return { ok: false, message: "找不到该排程。" };
  if (scopeGroupId && String(item.groupId || "") !== String(scopeGroupId) && !allowCrossGroup) return { ok: false, message: "该排程不属于当前群组。" };
  if (String(item.creatorId || "") !== String(actorId || "") && !canManage) return { ok: false, message: "你没有操作该排程的权限。" };
  if (item.type === "once") return { ok: false, message: "单次排程不能暂停一次；请编辑时间或取消。" };
  if (!item.enabled || item.status !== "active") return { ok: false, message: "只有执行中的重复排程可以暂停一次。" };
  item.skipNextRun = true;
  item.skipRequestedAt = Date.now();
  item.skipRequestedBy = String(actorId || "");
  await dbPut(env, `schedule:${id}`, JSON.stringify(item));
  return { ok: true, schedule: item, message: `排程 ${id} 将跳过下一次执行，之后自动恢复。` };
}



async function createScheduleRecord(env, data) {
  const id = `sch_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`;
  const record = { id, enabled: true, createdAt: new Date().toISOString(), lastRunAt: null, lastResult: null, failureCount: 0, reviewerIds: [], votes: {}, approvalRule: "single", ...data };
  record.originalNextRunAt = Number(record.originalNextRunAt || record.nextRunAt || 0);
  record.scheduleSpec = String(record.scheduleSpec || scheduleSpecFromRecord(record));
  record.mentionIds = Array.isArray(record.mentionIds) ? record.mentionIds : extractScheduleMentionIds(record.content);
  await dbPut(env, `schedule:${id}`, JSON.stringify(record));
  await appendIndex(env, "schedule:index", id, 5000);
  return record;
}



async function listUserSchedules(env, userId, groupId = "") {
  const ids = await readJson(env, "schedule:index", []); const result = [];
  for (const id of ids.slice(-1000)) {
    const item = await readJson(env, `schedule:${id}`, null);
    if (item && item.creatorId === userId && (!groupId || item.groupId === groupId) && !["deleted"].includes(item.status)) result.push(item);
  }
  return result.sort((a, b) => Number(a.nextRunAt || Infinity) - Number(b.nextRunAt || Infinity));
}



async function countActiveSchedulesForUser(env, userId) {
  const list = await listUserSchedules(env, userId);
  return list.filter(x => x.enabled && ["active", "pending_owner", "pending_review"].includes(x.status)).length;
}



function formatScheduleLine(item) {
  const time = item.nextRunAt ? new Date(item.nextRunAt).toLocaleString("zh-CN", { timeZone: "Asia/Taipei" }) : "无下次时间";
  return `${item.id}｜${item.status}｜${time}｜${String(item.content || "").slice(0, 60)}`;
}



async function cancelSchedule(env, id, actorId, canManage = false, scopeGroupId = "", allowCrossGroup = false) {
  const item = await readJson(env, `schedule:${id}`, null);
  if (!item) return { ok: false, message: "找不到该排程。" };
  if (scopeGroupId && String(item.groupId || "") !== String(scopeGroupId) && !allowCrossGroup) return { ok: false, message: "该排程不属于当前群组。" };
  if (String(item.creatorId || "") !== String(actorId || "") && !canManage) return { ok: false, message: "你没有取消该排程的权限。" };
  item.enabled = false; item.status = "cancelled"; item.cancelledAt = new Date().toISOString(); item.cancelledBy = actorId;
  await dbPut(env, `schedule:${id}`, JSON.stringify(item));
  return { ok: true, message: `排程 ${id} 已取消。` };
}



function scheduleApprovalReached(record) {
  const reviewers = record.reviewerIds || [];
  const approvals = reviewers.filter(id => record.votes?.[id] === "approve").length;
  const rejects = reviewers.filter(id => record.votes?.[id] === "reject").length;
  if (rejects > 0 && record.approvalRule === "all") return { done: true, approved: false };
  if (record.approvalRule === "all") return { done: approvals === reviewers.length && reviewers.length > 0, approved: approvals === reviewers.length && reviewers.length > 0 };
  if (record.approvalRule === "majority") return { done: approvals > reviewers.length / 2 || rejects >= Math.ceil(reviewers.length / 2), approved: approvals > reviewers.length / 2 };
  return { done: approvals >= 1 || rejects >= 1, approved: approvals >= 1 };
}



async function voteSchedule(env, id, reviewerId, vote) {
  const item = await readJson(env, `schedule:${id}`, null);
  if (!item || !(item.reviewerIds || []).includes(reviewerId)) return { ok: false, message: "没有该审核任务。" };
  item.votes ||= {}; item.votes[reviewerId] = vote;
  const state = scheduleApprovalReached(item);
  if (state.done) { item.status = state.approved ? "active" : "rejected"; item.enabled = Boolean(state.approved); item.reviewedAt = new Date().toISOString(); }
  await dbPut(env, `schedule:${id}`, JSON.stringify(item));
  return { ok: true, item };
}



async function executeManagementSchedule(env, record) {
  const raw = record.managementAction?.raw || "";
  const target = raw.match(/@(\d{5,})|\b(\d{5,})\b/)?.slice(1).find(Boolean);
  if (/^[!！]禁言/.test(raw) && target) return runOneBotGroupOperation(env, "set_group_ban", { group_id: numericId(record.groupId), user_id: numericId(target), duration: parseDurationSeconds(raw) }, { actorId: record.creatorId, groupId: record.groupId, targetId: target, action: "排程禁言" });
  if (/^[!！]解禁/.test(raw) && target) return runOneBotGroupOperation(env, "set_group_ban", { group_id: numericId(record.groupId), user_id: numericId(target), duration: 0 }, { actorId: record.creatorId, groupId: record.groupId, targetId: target, action: "排程解禁" });
  if (/^[!！]踢出/.test(raw) && target) return runOneBotGroupOperation(env, "set_group_kick", { group_id: numericId(record.groupId), user_id: numericId(target), reject_add_request: false }, { actorId: record.creatorId, groupId: record.groupId, targetId: target, action: "排程踢出" });
  if (/^[!！]全[员員]禁言/.test(raw)) return runOneBotGroupOperation(env, "set_group_whole_ban", { group_id: numericId(record.groupId), enable: true }, { actorId: record.creatorId, groupId: record.groupId, action: "排程全员禁言" });
  if (/^[!！]解除全[员員]禁言/.test(raw)) return runOneBotGroupOperation(env, "set_group_whole_ban", { group_id: numericId(record.groupId), enable: false }, { actorId: record.creatorId, groupId: record.groupId, action: "排程解除全员禁言" });
  if (/^[!！]撤回/.test(raw) && target) return runOneBotGroupOperation(env, "delete_msg", { message_id: numericId(target) }, { actorId: record.creatorId, groupId: record.groupId, targetId: target, action: "排程撤回" });
  if (/^[!！]改群名/.test(raw)) { const value = raw.replace(/^[!！]改群名\s*/, "").trim(); if (!value) return { ok: false, error: "缺少新群名" }; return runOneBotGroupOperation(env, "set_group_name", { group_id: numericId(record.groupId), group_name: value.slice(0, 60) }, { actorId: record.creatorId, groupId: record.groupId, action: "排程改群名" }); }
  if (/^[!！]改名片/.test(raw) && target) { const value = raw.replace(/^[!！]改名片\s*/, "").replace(new RegExp(`@?${target}`), "").trim(); if (!value) return { ok: false, error: "缺少新名片" }; return runOneBotGroupOperation(env, "set_group_card", { group_id: numericId(record.groupId), user_id: numericId(target), card: value.slice(0, 60) }, { actorId: record.creatorId, groupId: record.groupId, targetId: target, action: "排程改名片" }); }
  if (/^[!！](关闭|關閉)ai/i.test(raw)) { await dbPut(env, `ai_off:${record.groupId}`, "true"); return { ok: true }; }
  if (/^[!！](开启|開啟)ai/i.test(raw)) { await dbDel(env, `ai_off:${record.groupId}`); return { ok: true }; }
  if (/^[!！](记忆开|記憶開)/.test(raw)) { await dbDel(env, `memo:${record.groupId}`); return { ok: true }; }
  if (/^[!！](记忆关|記憶關)/.test(raw)) { await dbPut(env, `memo:${record.groupId}`, "false"); return { ok: true }; }
  return { ok: false, error: "不支持的管理排程动作" };
}



function computeNextScheduleRun(record, after = Date.now()) {
  if (record.type === "once") return null;
  if (record.type === "interval") return after + Number(record.intervalMs || 3600000);
  if (record.type === "daily") return nextTaipeiTime(record.timeOfDay, after + 60000);
  if (record.type === "weekly") return nextTaipeiWeekday("一二三四五六日"[Number(record.weekday || 1) - 1], record.timeOfDay, after + 60000);
  if (record.type === "monthly") return nextTaipeiMonthly(record.dayOfMonth, record.timeOfDay, after + 60000);
  return null;
}



async function processDueSchedules(env, now = Date.now()) {
  const ids = await readJson(env, "schedule:index", []);
  for (const id of ids.slice(-5000)) {
    const item = await readJson(env, `schedule:${id}`, null);
    if (!item || !item.enabled || item.status !== "active" || Number(item.nextRunAt || Infinity) > now) continue;
    const scheduleFuse = await opsFuseAllows(env, item.groupId, "schedule");
    if (!scheduleFuse.allowed) {
      item.status = "paused";
      item.enabled = false;
      item.lastResult = "paused_by_automation_fuse";
      await dbPut(env, `schedule:${id}`, JSON.stringify(item));
      continue;
    }
    if (!(await isGroupWhitelisted(env, item.groupId))) { item.status = "paused"; item.lastResult = "群不在白名单"; await dbPut(env, `schedule:${id}`, JSON.stringify(item)); continue; }
    if (!item.managementAction && item.ignoreQuietHours !== true) {
      const opsSettings = await opsGetSettings(env, item.groupId);
      const quietState = opsQuietState(opsSettings, now);
      if (quietState.quiet && opsSettings.quietPolicy !== "send") {
        if (opsSettings.quietPolicy === "defer") {
          item.lastResult = "deferred_by_quiet_hours";
          item.nextRunAt = quietState.resumeAt;
          await dbPut(env, `schedule:${id}`, JSON.stringify(item));
          continue;
        }
        if (opsSettings.quietPolicy === "admin_only") {
          await sendPortalVerificationMessage(env, item.creatorId, `排程 ${id} 在群安静时段到期，已暂缓群内发送。内容：${String(item.content || "").slice(0, 500)}`).catch(() => {});
          item.lastResult = "quiet_hours_admin_only";
          item.nextRunAt = quietState.resumeAt;
          await dbPut(env, `schedule:${id}`, JSON.stringify(item));
          continue;
        }
        if (opsSettings.quietPolicy === "skip") {
          item.lastResult = "skipped_by_quiet_hours";
          if (item.type === "once") {
            item.enabled = false;
            item.status = "completed";
            item.nextRunAt = null;
            item.lastRunAt = new Date(now).toISOString();
            item.lastResult = "skipped_by_quiet_hours";
            await dbPut(env, `schedule:${id}`, JSON.stringify(item));
            await writeSystemAudit(env, { type: "schedule_quiet_skipped", groupId: item.groupId, actorId: item.creatorId, action: "once_skipped_kept", scheduleId: id });
          } else {
            item.nextRunAt = computeNextScheduleRun(item, now);
            await dbPut(env, `schedule:${id}`, JSON.stringify(item));
          }
          continue;
        }
      }
    }
    if (item.skipNextRun && item.type !== "once") {
      item.skipNextRun = false;
      item.lastResult = "skipped_once";
      item.lastSkippedAt = new Date(now).toISOString();
      item.nextRunAt = computeNextScheduleRun(item, now);
      await dbPut(env, `schedule:${id}`, JSON.stringify(item));
      await writeSystemAudit(env, { type: "schedule_skipped_once", groupId: item.groupId, actorId: item.skipRequestedBy || item.creatorId, action: "skip_once", scheduleId: id, nextRunAt: item.nextRunAt });
      continue;
    }
    // 每个重复排程的执行周期都建立自己的补发宽限起点；重试期间保留同一原始到期时间。
    if (Number(item.failureCount || 0) === 0 || !Number(item.originalNextRunAt || 0)) {
      item.originalNextRunAt = Number(item.nextRunAt || now);
    }
    try {
      let result;
      if (item.managementAction) result = await executeManagementSchedule(env, item);
      else {
        let message = String(item.content || "");
        if (/^(AI生成|AI生成：|AI:)/i.test(message)) {
          const prompt = message.replace(/^(AI生成|AI生成：|AI:)/i, "").trim();
          const generated = await callGeminiGenerate(env, { models: parseList(env.GEMINI_CHAT_MODELS, ["gemini-3.5-flash", "gemini-3.1-flash-lite"]), system: "生成适合QQ群发送的简体中文内容，不讨论模型身份。", contents: [{ role: "user", parts: [{ text: prompt }] }], maxOutputTokens: 500, temperature: 0.8, useSearch: false });
          message = generated.text;
        }
        const outboundMessage = /^(AI生成|AI生成：|AI:)/i.test(String(item.content || ""))
          ? message
          : buildScheduledGroupMessage(message, item.mentionIds || extractScheduleMentionIds(item.content));
        await callOneBotAction(env, { action: "send_group_msg", params: { group_id: numericId(item.groupId), message: outboundMessage, auto_escape: false } }, 15000);
        result = { ok: true };
      }
      if (!result?.ok) throw new Error(result?.error || "执行失败");
      item.lastRunAt = new Date(now).toISOString(); item.lastResult = "success"; item.failureCount = 0;
      await opsRecordAutomationResult(env, item.groupId, "schedule", true).catch(() => {});
      const next = computeNextScheduleRun(item, now);
      if (next) {
        item.nextRunAt = next;
        item.originalNextRunAt = next;
      } else {
        item.enabled = false;
        item.status = "completed";
        item.nextRunAt = null;
      }
    } catch (error) {
      item.failureCount = Number(item.failureCount || 0) + 1; item.lastResult = String(error?.message || error);
      const opsSettings = await opsGetSettings(env, item.groupId);
      const fuseState = await opsRecordAutomationResult(env, item.groupId, "schedule", false, item.lastResult).catch(() => null);
      const retryMax = opsSettings.scheduleRetryEnabled ? Number(opsSettings.scheduleRetryMax || 0) : 0;
      const graceDeadline = Number(item.originalNextRunAt || item.nextRunAt || now) + Number(opsSettings.scheduleRetryGraceMinutes || 30) * 60000;
      if (item.failureCount > retryMax || now >= graceDeadline || fuseState?.paused) {
        item.status = "paused";
        item.enabled = false;
        await notifyDeveloper(env, `【排程已暂停】\n编号：${id}\n原因：${item.lastResult}`);
      } else {
        const backoff = [30000, 120000, 300000, 600000][Math.min(item.failureCount - 1, 3)] || 600000;
        item.nextRunAt = Math.min(now + backoff, graceDeadline);
        item.lastResult = `retry_${item.failureCount}:${item.lastResult}`;
      }
    }
    await dbPut(env, `schedule:${id}`, JSON.stringify(item));
    if (item.status === "completed") {
      await writeSystemAudit(env, { type: "schedule_completed", groupId: item.groupId, actorId: item.creatorId, action: "completed_and_kept", scheduleId: id, content: String(item.content || "").slice(0, 500) }).catch(() => {});
    }
  }
  await processActiveSpeaking(env, now);
}



async function processActiveSpeaking(env, now = Date.now()) {
  const groups = await readJson(env, "active_speaking:groups", []);
  for (const groupId of groups) {
    if (!(await getFeatureFlag(env, `active_speaking:${groupId}`, false)) || !(await isGroupWhitelisted(env, groupId))) continue;
    const opsSettings = await opsGetSettings(env, groupId);
    if (opsSettings.maintenanceMode || opsSettings.emergencyLock || opsQuietState(opsSettings, now).quiet) continue;
    const config = await readJson(env, `active_speaking:config:${groupId}`, { quietMinutes: 60, startHour: 9, endHour: 23, maxDaily: 3 });
    const p = taipeiParts(now); const hour = Number(p.hour); if (hour < config.startHour || hour >= config.endHour) continue;
    const lastMessage = Number(await dbGet(env, `group_last_message:${groupId}`) || 0); if (now - lastMessage < config.quietMinutes * 60000) continue;
    const dayKey = taipeiDateKey(new Date(now)); const countKey = `active_speaking:count:${groupId}:${dayKey}`; const count = Number(await dbGet(env, countKey) || 0); if (count >= config.maxDaily) continue;
    const lastSpeak = Number(await dbGet(env, `active_speaking:last:${groupId}`) || 0); if (now - lastSpeak < config.quietMinutes * 60000) continue;
    const stateKey = `active_speaking:state:${groupId}`;
    try {
      const result = await callGeminiGenerate(env, { models: parseList(env.GEMINI_CHAT_MODELS, ["gemini-3.1-flash-lite", "gemini-3.5-flash"]), system: "生成一句自然的QQ群开场话题，简体中文，不提AI身份，不引用私人记忆，不@任何人。", contents: [{ role: "user", parts: [{ text: "群里有一段时间没人说话，请自然开启一个轻松话题。" }] }], maxOutputTokens: 120, temperature: 0.9, useSearch: false });
      const sent = await callOneBotAction(env, { action: "send_group_msg", params: { group_id: numericId(groupId), message: result.text, auto_escape: false } }, 12000);
      const messageId = String(sent?.message_id || sent?.data?.message_id || "");
      await dbPut(env, countKey, String(count + 1));
      await dbPut(env, `active_speaking:last:${groupId}`, String(now));
      await dbPut(env, stateKey, JSON.stringify({ ok: true, at: now, source: "automatic", model: result.model || "Gemini", messageId, preview: String(result.text || "").slice(0, 180) }));
      await writeSystemAudit(env, { type: "active_speaking", groupId, actorId: "system", action: "automatic_sent", model: result.model || "Gemini", messageId });
    } catch (error) {
      const message = String(error?.message || error).slice(0, 500);
      await dbPut(env, stateKey, JSON.stringify({ ok: false, at: now, source: "automatic", error: message }));
      await writeSystemAudit(env, { type: "active_speaking", groupId, actorId: "system", action: "automatic_failed", error: message }).catch(() => {});
    }
  }
}



function sleepMs(ms) {
  return new Promise(resolve => setTimeout(resolve, Math.max(0, Number(ms || 0))));
}



async function listOneBotGroups(env, noCache = true) {
  const data = await callOneBotAction(env, { action: "get_group_list", params: { no_cache: Boolean(noCache) } }, 20000);
  const rows = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
  const seen = new Set();
  return rows.map(group => ({
    groupId: String(group?.group_id || group?.groupId || group?.id || "").replace(/\D/g, ""),
    groupName: String(group?.group_name || group?.groupName || group?.name || "")
  })).filter(group => group.groupId && !seen.has(group.groupId) && seen.add(group.groupId)).slice(0, 500);
}



async function performGroupCheckin(env, groupId, actorId = "system") {
  const normalizedGroupId = String(groupId || "").replace(/\D/g, "");
  if (!normalizedGroupId) return { ok: false, error: "群号无效", attempts: [] };
  const params = { group_id: numericId(normalizedGroupId) };
  const attempts = [];
  let lastError = "未知错误";
  for (const action of ["set_group_sign", "send_group_sign"]) {
    try {
      const data = await callOneBotAction(env, { action, params }, 8000);
      attempts.push({ action, ok: true, at: Date.now() });
      await writeSystemAudit(env, { type: "group_checkin", groupId: normalizedGroupId, actorId: String(actorId), action, result: "ok" });
      return { ok: true, action, data, attempts };
    } catch (error) {
      lastError = String(error?.message || error);
      attempts.push({ action, ok: false, error: lastError.slice(0, 300), at: Date.now() });
    }
  }
  if (!String(actorId).startsWith("system:midnight_rush:")) {
    await writeSystemAudit(env, { type: "group_checkin", groupId: normalizedGroupId, actorId: String(actorId), action: "failed", error: lastError.slice(0, 500) }).catch(() => {});
  }
  return { ok: false, error: lastError, attempts };
}



async function performManualGroupCheckins(env, { targetGroupId = "", actorId = "manual" } = {}) {
  let groups = [];
  try {
    groups = await listOneBotGroups(env, true);
  } catch (error) {
    return { total: 0, success: 0, failed: [{ groupId: targetGroupId || "all", error: String(error?.message || error) }] };
  }
  if (targetGroupId) groups = groups.filter(group => group.groupId === String(targetGroupId));
  const failed = [];
  let success = 0;
  const concurrency = Math.max(1, Math.min(20, Number(env.AUTO_CHECKIN_CONCURRENCY || DEFAULTS.autoCheckinConcurrency)));
  for (let index = 0; index < groups.length; index += concurrency) {
    const batch = groups.slice(index, index + concurrency);
    const results = await Promise.all(batch.map(async group => ({ group, result: await performGroupCheckin(env, group.groupId, actorId) })));
    for (const item of results) {
      if (item.result.ok) success++;
      else failed.push({ groupId: item.group.groupId, groupName: item.group.groupName, error: item.result.error });
    }
  }
  return { total: groups.length, success, failed };
}



async function checkinDoneForDay(env, groupId, dayKey) {
  const raw = await dbGet(env, `auto_checkin_done:${groupId}:${dayKey}`);
  if (!raw) return false;
  if (raw === "true" || raw === "1") return true;
  try { return JSON.parse(raw)?.ok === true; } catch { return false; }
}



async function claimAutomaticCheckinWindow(env, dayKey, owner, now = Date.now()) {
  const key = `auto_checkin_window_lock:${dayKey}`;
  const current = await readJson(env, key, null);
  const heartbeatAge = now - Number(current?.heartbeatAt || current?.startedAt || 0);
  if (current?.owner && current.owner !== owner && heartbeatAge >= 0 && heartbeatAge < 15000) return false;
  await dbPut(env, key, JSON.stringify({ owner, startedAt: Number(current?.startedAt || now), heartbeatAt: now, expiresAt: now + 180000 }));
  const confirmed = await readJson(env, key, null);
  return confirmed?.owner === owner;
}



async function heartbeatAutomaticCheckinWindow(env, dayKey, owner) {
  const key = `auto_checkin_window_lock:${dayKey}`;
  const current = await readJson(env, key, null);
  if (current?.owner !== owner) return false;
  await dbPut(env, key, JSON.stringify({ ...current, heartbeatAt: Date.now(), expiresAt: Date.now() + 180000 }));
  return true;
}



async function runAutomaticGroupCheckins(env, now = Date.now()) {
  const parts = taipeiParts(now);
  const hour = Number(parts.hour);
  const minute = Number(parts.minute);
  if (!((hour === 23 && minute === 59) || (hour === 0 && (minute === 0 || minute === 1)))) return;

  const dayKey = hour === 23 ? taipeiDateKey(new Date(now + 2 * 60 * 1000)) : taipeiDateKey(new Date(now));
  const midnightAt = parseTaipeiDateTime(`${dayKey} 00:00`);
  const windowEndAt = midnightAt + 2 * 60 * 1000 - 1;
  if (!Number.isFinite(midnightAt) || now > windowEndAt) return;

  const owner = `cron:${crypto.randomUUID()}`;
  if (!(await claimAutomaticCheckinWindow(env, dayKey, owner, now))) return;

  let groups = [];
  try {
    // 23:59 先取得群列表并保持任务，午夜零秒立即开始；不会把 23:59 的旧日期打卡误记成隔日成功。
    groups = await listOneBotGroups(env, true);
  } catch (error) {
    console.warn("自动群打卡无法取得群列表", error);
    await dbDel(env, `auto_checkin_window_lock:${dayKey}`);
    return;
  }

  while (Date.now() < midnightAt) {
    if (!(await heartbeatAutomaticCheckinWindow(env, dayKey, owner))) return;
    await sleepMs(Math.min(5000, Math.max(0, midnightAt - Date.now())));
  }
  const retryIntervalMs = Math.max(500, Math.min(5000, Number(env.AUTO_CHECKIN_RETRY_INTERVAL_MS || DEFAULTS.autoCheckinRetryIntervalMs)));
  const concurrency = Math.max(1, Math.min(30, Number(env.AUTO_CHECKIN_CONCURRENCY || DEFAULTS.autoCheckinConcurrency)));
  const attempts = new Map();

  try {
    while (Date.now() <= windowEndAt) {
      if (!(await heartbeatAutomaticCheckinWindow(env, dayKey, owner))) return;
      const pending = [];
      for (const group of groups) {
        if (!(await checkinDoneForDay(env, group.groupId, dayKey))) pending.push(group);
      }
      if (!pending.length) break;

      for (let index = 0; index < pending.length && Date.now() <= windowEndAt; index += concurrency) {
        const batch = pending.slice(index, index + concurrency);
        const results = await Promise.all(batch.map(async group => {
          const attempt = Number(attempts.get(group.groupId) || 0) + 1;
          attempts.set(group.groupId, attempt);
          const result = await performGroupCheckin(env, group.groupId, `system:midnight_rush:${attempt}`);
          return { group, result, attempt };
        }));
        for (const item of results) {
          const timestamp = Date.now();
          if (item.result.ok) {
            await dbPut(env, `auto_checkin_done:${item.group.groupId}:${dayKey}`, JSON.stringify({ ok: true, scheduledAt: now, executedAt: timestamp, dayKey, attempt: item.attempt, result: item.result }));
          } else {
            await dbPut(env, `auto_checkin_attempt:${item.group.groupId}:${dayKey}`, JSON.stringify({ ok: false, scheduledAt: now, lastAttemptAt: timestamp, dayKey, attempt: item.attempt, error: item.result.error, result: item.result }));
          }
        }
      }
      if (Date.now() <= windowEndAt) await sleepMs(retryIntervalMs);
    }
  } finally {
    const current = await readJson(env, `auto_checkin_window_lock:${dayKey}`, null);
    if (current?.owner === owner) await dbDel(env, `auto_checkin_window_lock:${dayKey}`);
  }
}



async function cleanupExpiredModerationProposals(env, now = Date.now()) {
  if (!env.DB) return;
  try {
    const rows = await env.DB.prepare("SELECT key, value FROM kv_store WHERE key LIKE 'moderation:proposal:op_%'").all();
    for (const row of rows.results || []) {
      let proposal = null;
      try { proposal = JSON.parse(row.value); } catch {}
      if (!proposal || proposal.status !== "pending" || now <= Number(proposal.expiresAt || 0)) continue;
      proposal.status = "expired";
      proposal.expiredAt = now;
      await retractModerationProposalMessage(env, proposal, "expired");
      await dbPut(env, row.key, JSON.stringify(proposal));
    }
  } catch (error) {
    console.warn("moderation expiry cleanup failed", error);
  }
}



async function cleanupTransientState(env) {
  if (!env.DB) return;
  try {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const rows = await env.DB.prepare("SELECT key, value FROM kv_store WHERE key LIKE 'outbound_pending:%' OR key LIKE 'outbound:%' OR key LIKE 'notice:not_whitelisted:%'").all();
    for (const row of rows.results || []) {
      let at = Number(row.value || 0); try { at = Number(JSON.parse(row.value)?.at || at); } catch {}
      if (at && at < cutoff) await dbDel(env, row.key);
    }
  } catch (error) { console.warn("cleanup failed", error); }
}



async function createAppealFromText(env, applicantId, text) {
  const groupId = String(text.match(/\b(\d{5,})\b/)?.[1] || await dbGet(env, `private_default_group:${applicantId}`) || "");
  if (!groupId) return { ok: false, message: "请提供群号，例如：!申诉 808882936 禁言 详细内容" };
  if (!(await isGroupWhitelisted(env, groupId))) return { ok: false, message: "该群不属于可使用 AI 的白名单群。" };
  const eligibleGroups = await getAppealEligibleGroupsForUser(env, applicantId);
  const eligibility = eligibleGroups.find(group => String(group.groupId) === String(groupId));
  if (!eligibility) return { ok: false, message: `你不是该群当前成员，且系统没有记录到你在退出后 ${DEFAULTS.appealFormerMemberDays} 天内的申诉资格。` };
  const rest = text.replace(groupId, "").trim(); const type = rest.split(/\s+/)[0] || "其他"; const content = rest.slice(type.length).trim();
  if (!content) return { ok: false, message: "请填写完整申诉内容。" };
  const id = `app_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`;
  const appeal = { id, anonymousLabel: `匿名申诉-${id.slice(-6)}`, applicantId: String(applicantId), groupId, type, content, applicantMembership: eligibility.former ? "former" : "current", eligibilitySnapshot: eligibility, status: "pending_owner", createdAt: new Date().toISOString(), reviewerIds: [], votes: {}, approvalRule: "single", result: "", againstAdmin: /管理|群主|开发者|開發者/i.test(type + content), recommendedReviewerRole: /管理|群主|开发者|開發者/i.test(type + content) ? "owner" : "developer_choice" };
  await dbPut(env, `appeal:${id}`, JSON.stringify(appeal)); await appendIndex(env, "appeal:index", id, 5000); await appendIndex(env, `appeal:user:${applicantId}`, id, 200);
  return { ok: true, appeal };
}



function sanitizeAppealForReviewer(appeal, viewerIsDeveloper = false) {
  const copy = { ...appeal };
  if (!viewerIsDeveloper) {
    delete copy.applicantId;
    if (copy.eligibilitySnapshot && typeof copy.eligibilitySnapshot === "object") {
      copy.eligibilitySnapshot = { ...copy.eligibilitySnapshot };
      delete copy.eligibilitySnapshot.card;
      delete copy.eligibilitySnapshot.qq;
      delete copy.eligibilitySnapshot.userId;
    }
  }
  return copy;
}



function appealApprovalReached(record) {
  const reviewers = record.reviewerIds || []; const approvals = reviewers.filter(id => record.votes?.[id] === "approve").length; const rejects = reviewers.filter(id => record.votes?.[id] === "reject").length;
  if (record.approvalRule === "all") return { done: approvals === reviewers.length || rejects > 0, approved: approvals === reviewers.length && reviewers.length > 0 };
  if (record.approvalRule === "majority") return { done: approvals > reviewers.length / 2 || rejects >= Math.ceil(reviewers.length / 2), approved: approvals > reviewers.length / 2 };
  return { done: approvals >= 1 || rejects >= 1, approved: approvals >= 1 };
}



async function voteAppeal(env, id, reviewerId, vote, note = "") {
  const item = await readJson(env, `appeal:${id}`, null);
  if (!item || !(item.reviewerIds || []).includes(reviewerId)) return { ok: false, message: "没有该审核案件。" };
  item.votes ||= {}; item.voteNotes ||= {}; item.votes[reviewerId] = vote; item.voteNotes[reviewerId] = note;
  const state = appealApprovalReached(item); if (state.done) { item.status = state.approved ? "approved" : "rejected"; item.result = note || (state.approved ? "申诉通过" : "申诉驳回"); item.reviewedAt = new Date().toISOString(); }
  await dbPut(env, `appeal:${id}`, JSON.stringify(item));
  return { ok: true, item };
}



async function processConflictSignal(env, { groupId, userId, senderName, text, botId }) {
  const rough = /滚|闭嘴|垃圾|废物|智障|傻逼|妈的|操你|去死|有病|恶心|人身攻击|吵架/i.test(text);
  const state = await readJson(env, `conflict:${groupId}`, { stage: 0, updatedAt: 0, participants: [] });
  if (!rough && Date.now() - Number(state.updatedAt || 0) > 10 * 60 * 1000) return null;
  let conflict = rough;
  try {
    const logs = (await readJson(env, `recent_logs:${groupId}`, [])).slice(-12).join("\n");
    const result = await callGoogleDecision(env, {
      system: "判断QQ群最近对话是否正在发生真实持续争吵或人身攻击。只输出JSON：{\"conflict\":true/false,\"severity\":0-3}。玩笑互呛应为false。",
      prompt: logs,
      maxOutputTokens: 80
    });
    const obj = JSON.parse(result.text.match(/\{[\s\S]*\}/)?.[0] || "{}"); conflict = Boolean(obj.conflict);
  } catch {}
  if (!conflict) { if (state.stage) await dbDel(env, `conflict:${groupId}`); return null; }
  state.stage = Math.min(3, Number(state.stage || 0) + 1); state.updatedAt = Date.now(); state.participants = [...new Set([...(state.participants || []), userId])];
  await dbPut(env, `conflict:${groupId}`, JSON.stringify(state));
  if (state.stage === 1) return { replyText: "先停一下，语气已经有点冲了。把事情说清楚就好，别继续针对人。" };
  if (state.stage === 2) return { replyText: "已经提醒过一次了，请停止人身攻击和持续争吵。继续下去会通知管理处理。" };
  let adminMentions = [];
  try {
    const members = await callOneBotAction(env, { action: "get_group_member_list", params: { group_id: numericId(groupId), no_cache: false } }, 12000);
    adminMentions = (Array.isArray(members) ? members : []).filter(m => ["owner", "admin"].includes(m.role)).map(m => String(m.user_id)).filter(id => id && id !== botId);
  } catch {}
  await notifyDeveloper(env, `【群冲突升级】\n群号：${groupId}\n参与QQ：${state.participants.join('、')}\n已进行两次劝阻，请决定是否交给其他管理。`);
  return { replyText: "群内冲突持续，已经两次劝阻无效，请人工处理。", mentionIds: adminMentions };
}

export { appealApprovalReached, buildScheduledGroupMessage, cancelSchedule, checkinDoneForDay, claimAutomaticCheckinWindow, cleanupExpiredModerationProposals, cleanupTransientState, computeNextScheduleRun, countActiveSchedulesForUser, createAppealFromText, createScheduleRecord, deleteScheduleRecord, executeManagementSchedule, extractScheduleMentionIds, formatScheduleLine, heartbeatAutomaticCheckinWindow, listOneBotGroups, listUserSchedules, nextTaipeiMonthly, nextTaipeiTime, nextTaipeiWeekday, parseManagementScheduleAction, parseScheduleRequest, parseTaipeiDateTime, performGroupCheckin, performManualGroupCheckins, processActiveSpeaking, processConflictSignal, processDueSchedules, reviewScheduleWithGemma, reviseScheduleRecord, runAutomaticGroupCheckins, sanitizeAppealForReviewer, scheduleApprovalReached, scheduleSpecFromRecord, skipScheduleOnce, sleepMs, taipeiParts, voteAppeal, voteSchedule };
