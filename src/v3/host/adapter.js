import { callGeminiGenerate, effectiveRuntimeModels, geminiVisionApiKeys, parseList } from "../../ai/runtime.js";
import { callOneBotAction } from "../../core/permissions.js";
import { dbDel, dbGet, dbPut } from "../../data/store.js";
import { createPluginHost } from "../../plugins/runtime.js";
import { fetchPublicUrl } from "../../security/network.js";
import { fromOneBotEvent, toOneBotSegments } from "../message/onebot.js";
import { resolveMediaPart } from "../media/resolver.js";

const DEFAULT_PLUGIN_ONEBOT_ACTIONS = Object.freeze([
  "get_login_info",
  "get_status",
  "get_version_info",
  "get_msg",
  "get_image",
  "get_record",
  "get_forward_msg",
  "can_send_image",
  "can_send_record",
  "get_group_info",
  "get_group_list",
  "get_group_member_info",
  "get_group_member_list",
  "ocr_image"
]);

function clampNumber(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function safeAiResult(result) {
  return Object.freeze({
    text: String(result?.text || ""),
    model: String(result?.model || ""),
    finishReason: String(result?.finishReason || result?.finish_reason || ""),
    usage: result?.usage || result?.usageMetadata || null
  });
}

function normalizePluginMessage(value) {
  if (typeof value === "string") return [{ kind: "text", text: value }];
  if (Array.isArray(value)) return value;
  if (value?.parts && Array.isArray(value.parts)) return value.parts;
  if (value?.kind) return [value];
  throw new Error("PLUGIN_MESSAGE_INVALID");
}

function hasOutboundMedia(parts) {
  return parts.some(part => ["image", "audio", "video", "file", "mface"].includes(part?.kind));
}

function resolveTarget(target, fallbackMessage = null) {
  const source = target && typeof target === "object" && !Array.isArray(target) ? target : {};
  const fallback = fallbackMessage && typeof fallbackMessage === "object" ? fallbackMessage : {};
  const scope = String(source.scope || fallback.scope || "");
  const groupId = String(source.groupId || source.group_id || fallback.groupId || "");
  const userId = String(source.userId || source.user_id || fallback.userId || "");
  if (scope === "group" || groupId) {
    if (!groupId) throw new Error("PLUGIN_MESSAGE_TARGET_GROUP_REQUIRED");
    return { scope: "group", groupId, userId: "" };
  }
  if (scope === "private" || userId) {
    if (!userId) throw new Error("PLUGIN_MESSAGE_TARGET_USER_REQUIRED");
    return { scope: "private", groupId: "", userId };
  }
  throw new Error("PLUGIN_MESSAGE_TARGET_REQUIRED");
}

async function defaultAiChat(env, input) {
  const source = typeof input === "string" ? { text: input } : (input && typeof input === "object" ? input : {});
  const text = String(source.text || "").slice(0, 30000);
  const contents = Array.isArray(source.contents) && source.contents.length
    ? source.contents
    : [{ role: "user", parts: [{ text }] }];
  if (!text && !Array.isArray(source.contents)) throw new Error("PLUGIN_AI_CHAT_INPUT_REQUIRED");
  const models = await effectiveRuntimeModels(env, "chat");
  const result = await callGeminiGenerate(env, {
    models,
    system: String(source.system || "You are a QQAI plugin assistant. Answer only the plugin task.").slice(0, 12000),
    contents,
    maxOutputTokens: clampNumber(source.maxOutputTokens, 1000, 1, 4096),
    temperature: clampNumber(source.temperature, 0.5, 0, 2),
    useSearch: false,
    requireSearch: false,
    timeoutMs: clampNumber(source.timeoutMs, 15000, 1000, 30000),
    maxAttempts: 2
  });
  return safeAiResult(result);
}

async function defaultAiVision(env, input) {
  const source = input && typeof input === "object" ? input : {};
  const images = (Array.isArray(source.images) ? source.images : []).slice(0, 4);
  if (!images.length) throw new Error("PLUGIN_AI_VISION_IMAGE_REQUIRED");
  const keys = geminiVisionApiKeys(env);
  if (!keys.length) throw new Error("PLUGIN_AI_VISION_UNAVAILABLE");
  const parts = [];
  for (const image of images) {
    const base64 = String(image?.base64 || "").replace(/^base64:\/\//i, "");
    const mimeType = String(image?.mimeType || image?.mime_type || "image/jpeg");
    if (!base64 || !/^image\//i.test(mimeType)) throw new Error("PLUGIN_AI_VISION_IMAGE_INVALID");
    if (base64.length > 12_000_000) throw new Error("PLUGIN_AI_VISION_IMAGE_TOO_LARGE");
    parts.push({ inlineData: { data: base64, mimeType } });
  }
  parts.push({ text: String(source.prompt || "Describe the image accurately.").slice(0, 12000) });
  const fallbackModels = await effectiveRuntimeModels(env, "chat");
  const models = parseList(env.GEMINI_VISION_MODELS, fallbackModels);
  const result = await callGeminiGenerate(env, {
    models,
    apiKeys: keys,
    keyProvider: "gemini_vision",
    system: String(source.system || "Analyze the provided image for the plugin task.").slice(0, 12000),
    contents: [{ role: "user", parts }],
    maxOutputTokens: clampNumber(source.maxOutputTokens, 1000, 1, 4096),
    temperature: clampNumber(source.temperature, 0.2, 0, 2),
    useSearch: false,
    requireSearch: false,
    timeoutMs: clampNumber(source.timeoutMs, 20000, 1000, 30000),
    maxAttempts: 2
  });
  return safeAiResult(result);
}

function createV3HostAdapter(env, {
  plugins = [],
  logger = console,
  dependencies = {},
  allowedOneBotActions = DEFAULT_PLUGIN_ONEBOT_ACTIONS
} = {}) {
  if (!env || typeof env !== "object") throw new Error("V3_HOST_ENV_REQUIRED");
  const deps = {
    dbGet: dependencies.dbGet || (key => dbGet(env, key)),
    dbPut: dependencies.dbPut || ((key, value) => dbPut(env, key, value)),
    dbDel: dependencies.dbDel || (key => dbDel(env, key)),
    onebotCall: dependencies.onebotCall || ((action, params, timeoutMs) => callOneBotAction(env, { action, params }, timeoutMs)),
    safeFetch: dependencies.safeFetch || ((url, options) => fetchPublicUrl(url, options, 3)),
    aiChat: dependencies.aiChat || (input => defaultAiChat(env, input)),
    aiVision: dependencies.aiVision || (input => defaultAiVision(env, input)),
    aiTts: dependencies.aiTts || null,
    schedulerCreate: dependencies.schedulerCreate || null
  };
  const onebotAllowlist = new Set((allowedOneBotActions || []).map(value => String(value || "").trim()).filter(Boolean));
  const storageAdapter = Object.freeze({ get: deps.dbGet, put: deps.dbPut, del: deps.dbDel });

  async function sendParts(plugin, value, fallbackMessage, explicitTarget = null) {
    const targetEnvelope = explicitTarget && typeof explicitTarget === "object" && !Array.isArray(explicitTarget) ? explicitTarget : {};
    const messageValue = Object.prototype.hasOwnProperty.call(targetEnvelope, "message") ? targetEnvelope.message : value;
    const parts = normalizePluginMessage(messageValue);
    if (hasOutboundMedia(parts) && !plugin.capabilities.includes("media.send")) {
      throw new Error(`PLUGIN_CAPABILITY_DENIED:${plugin.id}:media.send`);
    }
    const target = resolveTarget(targetEnvelope, fallbackMessage);
    const message = toOneBotSegments(parts);
    if (target.scope === "group") return deps.onebotCall("send_group_msg", { group_id: target.groupId, message, auto_escape: false }, 15000);
    return deps.onebotCall("send_private_msg", { user_id: target.userId, message, auto_escape: false }, 15000);
  }

  const services = {
    "message.reply": async ({ plugin, message, eventContext }) => sendParts(plugin, message, eventContext?.message || null),
    "message.send": async ({ plugin, target, eventContext }) => sendParts(plugin, target, eventContext?.message || null, target),
    "media.send": async ({ plugin, target, eventContext }) => {
      const envelope = target && typeof target === "object" && !Array.isArray(target) && Object.prototype.hasOwnProperty.call(target, "message")
        ? target
        : { message: target };
      return sendParts(plugin, envelope.message, eventContext?.message || null, envelope);
    },
    "media.resolve": async ({ index, eventContext }) => {
      const message = eventContext?.message;
      if (!message || !Array.isArray(message.parts)) throw new Error("PLUGIN_MEDIA_MESSAGE_REQUIRED");
      const partIndex = Number(index);
      if (!Number.isInteger(partIndex) || partIndex < 0 || partIndex >= message.parts.length) throw new Error("PLUGIN_MEDIA_INDEX_INVALID");
      const part = message.parts[partIndex];
      if (!["image", "audio", "video", "file", "mface", "forward"].includes(part?.kind)) throw new Error(`PLUGIN_MEDIA_PART_NOT_RESOLVABLE:${String(part?.kind || "unknown")}`);
      return resolveMediaPart(part, { messageId: message.messageId, groupId: message.groupId }, { onebotCall: deps.onebotCall, safeFetch: deps.safeFetch });
    },
    "onebot.call": async ({ action, params, timeoutMs }) => {
      const name = String(action || "").trim();
      if (!onebotAllowlist.has(name)) throw new Error(`PLUGIN_ONEBOT_ACTION_DENIED:${name || "missing"}`);
      return deps.onebotCall(name, params && typeof params === "object" ? params : {}, clampNumber(timeoutMs, 15000, 1000, 30000));
    },
    "ai.chat": async ({ input }) => deps.aiChat(input),
    "ai.vision": async ({ input }) => deps.aiVision(input),
    "network.fetch": async ({ input }) => {
      const source = typeof input === "string" ? { url: input } : (input && typeof input === "object" ? input : {});
      const url = String(source.url || "").trim();
      if (!url) throw new Error("PLUGIN_NETWORK_URL_REQUIRED");
      const init = source.init && typeof source.init === "object" ? { ...source.init } : {};
      delete init.cf;
      return deps.safeFetch(url, init);
    }
  };
  if (typeof deps.aiTts === "function") services["ai.tts"] = async ({ input }) => deps.aiTts(input);
  if (typeof deps.schedulerCreate === "function") services["scheduler.create"] = async ({ plugin, input }) => deps.schedulerCreate({ plugin, input });

  const host = createPluginHost({ services, storageAdapter, logger });
  for (const plugin of plugins) host.register(plugin);

  async function dispatchOneBotEvent(body = {}) {
    const postType = String(body?.post_type || "");
    if (postType === "message" || postType === "message_sent") {
      const message = fromOneBotEvent(body);
      const eventName = message.scope === "group" ? "group_message" : message.scope === "private" ? "private_message" : "message";
      const results = await host.dispatch(eventName, message, { message, groupId: message.groupId, userId: message.userId });
      return { handled: true, eventName, message, results };
    }
    if (postType === "notice") return { handled: true, eventName: "notice", message: null, results: await host.dispatch("notice", body) };
    if (postType === "request") return { handled: true, eventName: "request", message: null, results: await host.dispatch("request", body) };
    return { handled: false, eventName: "", message: null, results: [] };
  }

  return Object.freeze({
    dispatchOneBotEvent,
    host,
    listPlugins: host.listPlugins,
    register: host.register,
    runCommand: host.runCommand,
    start: host.start,
    stop: host.stop
  });
}

export {
  DEFAULT_PLUGIN_ONEBOT_ACTIONS,
  createV3HostAdapter,
  defaultAiChat,
  defaultAiVision,
  hasOutboundMedia,
  normalizePluginMessage,
  resolveTarget,
  safeAiResult
};
