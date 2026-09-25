import { callOneBotAction, writeSystemAudit } from "../../core/permissions.js";
import { fetchPublicUrl } from "../../security/network.js";
import { runV3MultimodalAi } from "../ai/runtime.js";
import { fromOneBotEvent, toOneBotSegments } from "../message/onebot.js";

const CANARY_MEDIA_KINDS = Object.freeze(["image", "audio", "mface", "video", "file", "forward"]);

function truthy(value) {
  return ["1", "true", "yes", "on", "enabled"].includes(String(value || "").trim().toLowerCase());
}

function idSet(value) {
  return new Set(String(value || "").split(",").map(item => item.trim()).filter(item => /^\d+$/.test(item)));
}

function multimodalCanaryConfig(env = {}) {
  const mode = String(env.V3_MULTIMODAL_CANARY_MODE || "observe").trim().toLowerCase();
  return Object.freeze({
    enabled: truthy(env.V3_MULTIMODAL_CANARY_ENABLED),
    mode: mode === "reply" ? "reply" : "observe",
    groups: idSet(env.V3_MULTIMODAL_CANARY_GROUPS),
    users: idSet(env.V3_MULTIMODAL_CANARY_USERS)
  });
}

function canaryEligible(message, config) {
  if (!config.enabled || !message || message.scope !== "group") return false;
  if (!message.groupId || !config.groups.has(String(message.groupId))) return false;
  if (config.users.size && !config.users.has(String(message.userId))) return false;
  if (message.selfId && message.userId === message.selfId) return false;
  const mentioned = message.parts.some(part => part?.kind === "mention" && !part.all && String(part.userId || "") === String(message.selfId || ""));
  if (!mentioned) return false;
  return message.parts.some(part => CANARY_MEDIA_KINDS.includes(part?.kind));
}

function diagnosticSummary(message, aiResult = null, error = null, mode = "observe") {
  const kinds = (message?.parts || []).map(part => String(part?.kind || "unknown"));
  return Object.freeze({
    mode,
    groupId: String(message?.groupId || ""),
    userId: String(message?.userId || ""),
    messageId: String(message?.messageId || ""),
    kinds,
    mediaKinds: kinds.filter(kind => CANARY_MEDIA_KINDS.includes(kind)),
    model: String(aiResult?.model || ""),
    compileIssues: (aiResult?.compile?.issues || []).map(issue => String(issue?.code || "")).filter(Boolean).slice(0, 12),
    errorCode: String(error?.code || ""),
    errorStage: String(error?.stage || ""),
    ok: !error && Boolean(aiResult?.text)
  });
}

async function runV3MultimodalCanary(env, body = {}, dependencies = {}) {
  const config = multimodalCanaryConfig(env);
  if (!config.enabled || body?.post_type !== "message" || body?.message_type !== "group") return { handled: false, eligible: false, mode: config.mode };
  const message = fromOneBotEvent(body);
  if (!canaryEligible(message, config)) return { handled: false, eligible: false, mode: config.mode };

  const onebotCall = dependencies.onebotCall || ((action, params, timeoutMs) => callOneBotAction(env, { action, params }, timeoutMs));
  const safeFetch = dependencies.safeFetch || ((url, options) => fetchPublicUrl(url, options, 3));
  const audit = dependencies.audit || (entry => writeSystemAudit(env, entry));
  const aiRun = dependencies.aiRun || ((currentMessage, input) => runV3MultimodalAi(env, currentMessage, input, {
    onebotCall,
    safeFetch
  }));

  try {
    const aiResult = await aiRun(message, {
      prompt: "請理解這則 QQ 群訊息中的文字、圖片、語音、QQ 表情與合併轉發內容，直接回答使用者問題；不要描述內部解析流程。",
      strictMedia: false,
      maxOutputTokens: 1200,
      temperature: 0.35
    });
    await audit({ type: "v3_multimodal_canary", ...diagnosticSummary(message, aiResult, null, config.mode) }).catch(() => null);
    if (config.mode !== "reply") return { handled: false, eligible: true, observed: true, mode: config.mode, result: aiResult };
    const text = String(aiResult?.text || "").trim().slice(0, 12000);
    if (!text) return { handled: false, eligible: true, observed: true, mode: config.mode, result: aiResult };
    const segments = toOneBotSegments([
      ...(message.messageId ? [{ kind: "reply", messageId: message.messageId }] : []),
      { kind: "text", text }
    ]);
    await onebotCall("send_group_msg", { group_id: String(message.groupId), message: segments, auto_escape: false }, 15000);
    return { handled: true, eligible: true, observed: true, mode: config.mode, result: aiResult };
  } catch (error) {
    await audit({ type: "v3_multimodal_canary_failed", ...diagnosticSummary(message, null, error, config.mode) }).catch(() => null);
    return { handled: false, eligible: true, observed: false, mode: config.mode, error: { code: String(error?.code || ""), stage: String(error?.stage || ""), message: String(error?.message || error).slice(0, 240) } };
  }
}

export { CANARY_MEDIA_KINDS, canaryEligible, diagnosticSummary, multimodalCanaryConfig, runV3MultimodalCanary, truthy };