// Extracted from worker.js without behavioral changes.
// Cloudflare still deploys worker.js as the single Worker entry point.

import { DEFAULTS } from "../config/runtime.js";
import { developerId, developerIds, isDeveloperId } from "../config/deployment.js";
import { dbGet, dbPut } from "../data/store.js";
import { readJson } from "../portal/auth.js";



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




async function recentConversationMessagesForUser(env, groupId, userId, limit = 12) {
  const group = String(groupId || "");
  const user = String(userId || "");
  const boundedLimit = Math.max(1, Math.min(200, Number(limit) || 12));
  if (!group || !user) return [];
  const logs = await readJson(env, `recent_logs:${group}`, []);
  const marker = `(QQ:${user})]: `;
  const output = [];
  for (const line of (Array.isArray(logs) ? logs : []).slice().reverse()) {
    const text = String(line || "");
    const markerIndex = text.indexOf(marker);
    if (markerIndex < 0) continue;
    const prefix = text.slice(0, markerIndex);
    const senderName = prefix.startsWith("[") ? prefix.slice(1) : prefix;
    output.push({
      id: "",
      messageId: "",
      groupId: group,
      userId: user,
      senderName,
      senderRole: "member",
      text: text.slice(markerIndex + marker.length),
      mentions: [],
      replyId: "",
      files: [],
      media: [],
      forwardIds: [],
      forwardSnapshots: [],
      createdAt: 0,
      updatedAt: 0,
      source: "recent_logs"
    });
    if (output.length >= boundedLimit) break;
  }
  return output.reverse();
}


async function consumeManualRuleCheckRate(env, groupId, userId) {
  const now = Date.now();
  const lastKey = `manual_rule_check:last:${groupId}:${userId}`;
  const last = Number(await dbGet(env, lastKey) || 0);
  if (last && now - last < DEFAULTS.manualRuleCheckCooldownMs) {
    return { allowed: false, message: `请等待 ${Math.ceil((DEFAULTS.manualRuleCheckCooldownMs - (now - last)) / 1000)} 秒后再检查。` };
  }
  const hourBucket = Math.floor(now / 3600000);
  const countKey = `manual_rule_check:hour:${groupId}:${userId}:${hourBucket}`;
  const count = Number(await dbGet(env, countKey) || 0);
  if (count >= DEFAULTS.manualRuleCheckHourlyLimit) return { allowed: false, message: "你本小时提交的人工检查过多，请稍后再试。" };
  await dbPut(env, lastKey, String(now));
  await dbPut(env, countKey, String(count + 1));
  return { allowed: true, remaining: DEFAULTS.manualRuleCheckHourlyLimit - count - 1 };
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

export { consumeManualRuleCheckRate, developerId, developerIds, isDeveloperId, latestConversationMessageForUser, neutralizeAiCommandPrefix, recentConversationMessagesForUser, stripGroupAiOptOutPrefix };