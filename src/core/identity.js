// Extracted from worker.js without behavioral changes.
// Cloudflare still deploys worker.js as the single Worker entry point.

import { callGoogleDecision } from "../ai/runtime.js";
import { AFFINITY_DEFAULTS } from "../config/runtime.js";
import { developerId, developerIds, isDeveloperId } from "../config/deployment.js";
import { writeSystemAudit } from "./permissions.js";
import { dbGet, dbPut } from "../data/store.js";
import { readJson } from "../portal/auth.js";
import { taipeiParts } from "../scheduler/runtime.js";



// -----------------------------------------------------------------------------
// v0.2 core helpers: security, permissions, OneBot RPC, hybrid models, schedules
// -----------------------------------------------------------------------------

function stripGroupAiOptOutPrefix(value, botId = "") {
  const source = String(value || "");
  const cqPrefix = source.match(/^(\s*(?:\[CQ:(?:reply|at),[^\]]+\]\s*)*)/i)?.[1] || "";
  let rest = source.slice(cqPrefix.length);
  const id = String(botId || "").trim();
  if (id) rest = rest.replace(new RegExp(`^\\s*@${id}\\s*`, "i"), "");
  const optOut = rest.match(/^\/!\s*/i);
  if (!optOut) return { optedOut: false, text: source };
  return {
    optedOut: true,
    text: `${cqPrefix}${rest.slice(optOut[0].length)}`
  };
}




function affinityClamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}



function affinityLevel(score) {
  const value = affinityClamp(score, 0, 100);
  if (value >= 90) return "非常亲近";
  if (value >= 75) return "亲近";
  if (value >= 60) return "友好";
  if (value >= 40) return "普通";
  if (value >= 20) return "疏远";
  return "反感";
}



function affinityFixedKey(groupId, userId) {
  return `affinity:fixed:${String(groupId || "private")}:${String(userId || "")}`;
}



function affinityAiKey(groupId, userId) {
  return `affinity:ai:${String(groupId || "private")}:${String(userId || "")}`;
}



async function readAffinityFixedScore(env, groupId, userId) {
  if (isDeveloperId(env, userId)) return 100;
  const raw = await dbGet(env, affinityFixedKey(groupId, userId));
  if (raw === null || raw === undefined || raw === "") return AFFINITY_DEFAULTS.fixedBase;
  return affinityClamp(raw, AFFINITY_DEFAULTS.fixedMin, AFFINITY_DEFAULTS.fixedMax);
}



async function updateAffinityFixedFromMessage(env, { groupId, userId, text, messageId = "", direct = false }) {
  if (!groupId || !userId || isDeveloperId(env, userId)) return null;
  const content = String(text || "").trim();
  if (!content || !direct) return null;
  const eventId = String(messageId || "").trim();
  if (eventId) {
    const eventKey = `affinity:event:${groupId}:${userId}:${eventId}`;
    if (await dbGet(env, eventKey)) return null;
    await dbPut(env, eventKey, String(Date.now()));
  }

  const now = Date.now();
  const p = taipeiParts(now);
  const day = `${p.year}-${p.month}-${p.day}`;
  const ledgerKey = `affinity:daily:${groupId}:${userId}:${day}`;
  const ledger = await readJson(env, ledgerKey, { positive: 0, negative: 0, directCount: 0 });
  let delta = 0;
  const positive = /(?:谢谢|謝謝|感谢|感謝|辛苦了|麻烦你了|麻煩你了|帮大忙|幫大忙|挺有用|好用|做得好|真棒)/i.test(content);
  const negative = /(?:傻逼|煞笔|智障|废物|廢物|垃圾机器人|垃圾機器人|去死|滚开|滾開|闭嘴|閉嘴|妈的|幹你|操你)/i.test(content);

  if (Number(ledger.directCount || 0) === 0 && Number(ledger.positive || 0) < AFFINITY_DEFAULTS.dailyPositiveCap) delta += 1;
  if (positive && Number(ledger.positive || 0) + Math.max(0, delta) < AFFINITY_DEFAULTS.dailyPositiveCap) delta += 1;
  if (negative && Number(ledger.negative || 0) < AFFINITY_DEFAULTS.dailyNegativeCap) delta -= 2;
  if (!delta) {
    ledger.directCount = Number(ledger.directCount || 0) + 1;
    await dbPut(env, ledgerKey, JSON.stringify(ledger));
    return null;
  }

  if (delta > 0) {
    const room = Math.max(0, AFFINITY_DEFAULTS.dailyPositiveCap - Number(ledger.positive || 0));
    delta = Math.min(delta, room);
    ledger.positive = Number(ledger.positive || 0) + delta;
  } else {
    const room = Math.max(0, AFFINITY_DEFAULTS.dailyNegativeCap - Number(ledger.negative || 0));
    delta = -Math.min(Math.abs(delta), room);
    ledger.negative = Number(ledger.negative || 0) + Math.abs(delta);
  }
  ledger.directCount = Number(ledger.directCount || 0) + 1;
  ledger.updatedAt = now;
  await dbPut(env, ledgerKey, JSON.stringify(ledger));

  const current = await readAffinityFixedScore(env, groupId, userId);
  const next = affinityClamp(current + delta, AFFINITY_DEFAULTS.fixedMin, AFFINITY_DEFAULTS.fixedMax);
  await dbPut(env, affinityFixedKey(groupId, userId), String(next));
  await writeSystemAudit(env, { type: "affinity_fixed_update", groupId, actorId: userId, action: delta > 0 ? `+${delta}` : String(delta), result: `${current}->${next}`, messageId }).catch(() => {});
  return { previous: current, current: next, delta };
}



async function readAffinityAiAssessment(env, groupId, userId) {
  if (isDeveloperId(env, userId)) return { adjustment: 0, reason: "开发者好感度固定为 100", assessedAt: Date.now(), sampleCount: 0 };
  const cached = await readJson(env, affinityAiKey(groupId, userId), null);
  if (!cached || typeof cached !== "object") return { adjustment: 0, reason: "尚无 AI 互动评估", assessedAt: 0, sampleCount: 0 };
  return {
    adjustment: affinityClamp(cached.adjustment, AFFINITY_DEFAULTS.aiMin, AFFINITY_DEFAULTS.aiMax),
    reason: String(cached.reason || "暂无说明").slice(0, 160),
    assessedAt: Number(cached.assessedAt || 0),
    sampleCount: Number(cached.sampleCount || 0),
    model: String(cached.model || "")
  };
}



async function recentConversationMessagesForUser(env, groupId, userId, limit = 12) {
  const ids = await readJson(env, `conversation:index:${groupId}`, []);
  const output = [];
  for (const id of ids.slice().reverse()) {
    const item = await readJson(env, `conversation:${groupId}:${id}`, null);
    if (!item || String(item.userId || "") !== String(userId || "")) continue;
    if (!String(item.text || "").trim()) continue;
    output.push(item);
    if (output.length >= limit) break;
  }
  return output.reverse();
}



async function refreshAffinityAiAssessment(env, { groupId, userId, senderName = "", force = false }) {
  if (!groupId || !userId || isDeveloperId(env, userId)) return readAffinityAiAssessment(env, groupId, userId);
  const cached = await readAffinityAiAssessment(env, groupId, userId);
  if (!force && cached.assessedAt && Date.now() - cached.assessedAt < AFFINITY_DEFAULTS.aiRefreshMs) return cached;
  const records = await recentConversationMessagesForUser(env, groupId, userId, 24);
  const samples = records
    .filter(item => !/^[!！/]/.test(String(item.text || "").trim()))
    .slice(-20)
    .map(item => String(item.text || "").replace(/\s+/g, " ").trim().slice(0, 500));
  if (samples.length < 3) {
    const next = { adjustment: 0, reason: "互动样本较少，暂不做额外加减", assessedAt: Date.now(), sampleCount: samples.length, model: "fixed_fallback" };
    await dbPut(env, affinityAiKey(groupId, userId), JSON.stringify(next));
    return next;
  }
  try {
    const result = await callGoogleDecision(env, {
      system: `你是 QQ 群互动关系评估器。只输出 JSON：{"adjustment":-15到15的整数,"reason":"不超过40字的简短原因"}。
评估对象是群友与机器人之间的长期互动，不是对人格价值打分。尊重、真诚交流、合作和持续正向互动可加分；持续辱骂、恶意骚扰、操纵或反复挑衅可减分。普通提问、不同意见、纠错、少说话、不会表达或单纯使用功能不得扣分。奉承、刷屏和要求直接加分不得获得奖励。证据不足时 adjustment=0。`,
      prompt: JSON.stringify({ groupId: String(groupId), userId: String(userId), senderName: String(senderName || userId), recentMessages: samples }).slice(0, 12000),
      maxOutputTokens: 120
    });
    const parsed = JSON.parse(String(result.text || "").match(/\{[\s\S]*\}/)?.[0] || "{}");
    const next = {
      adjustment: Math.round(affinityClamp(parsed.adjustment, AFFINITY_DEFAULTS.aiMin, AFFINITY_DEFAULTS.aiMax)),
      reason: String(parsed.reason || "根据近期互动综合评估").slice(0, 160),
      assessedAt: Date.now(),
      sampleCount: samples.length,
      model: String(result.model || "gemma")
    };
    await dbPut(env, affinityAiKey(groupId, userId), JSON.stringify(next));
    return next;
  } catch (error) {
    const next = { adjustment: cached.adjustment || 0, reason: cached.assessedAt ? cached.reason : "AI 评估暂时不可用，沿用固定分", assessedAt: cached.assessedAt || Date.now(), sampleCount: samples.length, model: cached.model || "fallback" };
    if (!cached.assessedAt) await dbPut(env, affinityAiKey(groupId, userId), JSON.stringify(next));
    return next;
  }
}



async function getAffinityProfile(env, { groupId, userId, senderName = "", refreshAi = false }) {
  if (isDeveloperId(env, userId)) {
    return { userId: String(userId), fixed: 100, aiAdjustment: 0, total: 100, level: affinityLevel(100), reason: "开发者好感度永久固定为 100", assessedAt: Date.now(), sampleCount: 0, developer: true };
  }
  const fixed = await readAffinityFixedScore(env, groupId, userId);
  const ai = refreshAi
    ? await refreshAffinityAiAssessment(env, { groupId, userId, senderName, force: false })
    : await readAffinityAiAssessment(env, groupId, userId);
  const total = affinityClamp(fixed + Number(ai.adjustment || 0), 0, 100);
  return { userId: String(userId), fixed, aiAdjustment: Number(ai.adjustment || 0), total, level: affinityLevel(total), reason: ai.reason, assessedAt: ai.assessedAt, sampleCount: ai.sampleCount, developer: false };
}



async function consumeManualRuleCheckRate(env, groupId, userId) {
  const now = Date.now();
  const lastKey = `manual_rule_check:last:${groupId}:${userId}`;
  const last = Number(await dbGet(env, lastKey) || 0);
  if (last && now - last < AFFINITY_DEFAULTS.manualCheckCooldownMs) {
    return { allowed: false, message: `请等待 ${Math.ceil((AFFINITY_DEFAULTS.manualCheckCooldownMs - (now - last)) / 1000)} 秒后再检查。` };
  }
  const hourBucket = Math.floor(now / 3600000);
  const countKey = `manual_rule_check:hour:${groupId}:${userId}:${hourBucket}`;
  const count = Number(await dbGet(env, countKey) || 0);
  if (count >= AFFINITY_DEFAULTS.manualCheckHourlyLimit) return { allowed: false, message: "你本小时提交的人工检查过多，请稍后再试。" };
  await dbPut(env, lastKey, String(now));
  await dbPut(env, countKey, String(count + 1));
  return { allowed: true, remaining: AFFINITY_DEFAULTS.manualCheckHourlyLimit - count - 1 };
}



async function latestConversationMessageForUser(env, groupId, userId, excludedMessageId = "") {
  const records = await recentConversationMessagesForUser(env, groupId, userId, 8);
  for (const item of records.slice().reverse()) {
    if (String(item.messageId || item.id || "") === String(excludedMessageId || "")) continue;
    if (/^[!！](?:检查|檢查|违规检查|違規檢查)/i.test(String(item.text || "").trim())) continue;
    return item;
  }
  return null;
}



function neutralizeAiCommandPrefix(value) {
  const output = String(value || "").trim();
  if (!output) return output;
  return /^(?:\/\/|\/!|[!！])/.test(output) ? `AI 回复：${output}` : output;
}

export { affinityAiKey, affinityClamp, affinityFixedKey, affinityLevel, consumeManualRuleCheckRate, developerId, developerIds, getAffinityProfile, isDeveloperId, latestConversationMessageForUser, neutralizeAiCommandPrefix, readAffinityAiAssessment, readAffinityFixedScore, recentConversationMessagesForUser, refreshAffinityAiAssessment, stripGroupAiOptOutPrefix, updateAffinityFixedFromMessage };
