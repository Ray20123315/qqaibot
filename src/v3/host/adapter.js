import { VERSION } from "../../config/runtime.js";
import { createPluginLifecycleRegistry } from "../../plugins/lifecycle.js";
import { callGeminiGenerate, effectiveRuntimeModels, geminiVisionApiKeys, googleApiKeysFor, parseList } from "../../ai/runtime.js";
import { callProviderRoute } from "../../ai/provider-client.js";
import { isDeveloperId, recentConversationMessagesForUser } from "../../core/identity.js";
import { callOneBotAction } from "../../core/permissions.js";
import { dbDel, dbGet, dbPut } from "../../data/store.js";
import { createPluginHost } from "../../plugins/runtime.js";
import { fetchPublicUrl } from "../../security/network.js";
import { parseAiCommandCodexOverride } from "../ai/codex-command.js";
import { callCodexBridgeWebSocket } from "../ai/codex-bridge.js";
import { runV3MultimodalAi } from "../ai/runtime.js";
import { synthesizeGeminiTts } from "../ai/tts.js";
import { fromOneBotEvent, toOneBotSegments } from "../message/onebot.js";
import { resolveMediaPart } from "../media/resolver.js";
import { createPluginScheduler } from "../scheduler/runtime.js";

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
  "ocr_image",
  "send_poke",
  "set_msg_emoji_like",
  "fetch_custom_face",
  "get_ai_characters",
  "send_group_ai_record",
  "set_group_sign",
  "send_group_sign"
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

function codexContentText(value) {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  if (typeof value.text === "string") return value.text;
  if (Array.isArray(value.parts)) {
    return value.parts.map(part => typeof part === "string" ? part : String(part?.text || "")).filter(Boolean).join("\n");
  }
  return "";
}

function pluginCodexMessages(source = {}) {
  const messages = [];
  const system = String(source.system || "").trim();
  if (system) messages.push({ role: "system", content: system.slice(0, 12000) });

  if (Array.isArray(source.contents) && source.contents.length) {
    for (const item of source.contents.slice(-40)) {
      const content = codexContentText(item).trim();
      if (!content) continue;
      const rawRole = String(item?.role || "user").toLowerCase();
      const role = rawRole === "assistant" || rawRole === "model" ? "assistant" : rawRole === "system" ? "system" : "user";
      messages.push({ role, content: content.slice(0, 50000) });
    }
  } else {
    const text = String(source.text || "").trim();
    if (text) messages.push({ role: "user", content: text.slice(0, 50000) });
  }
  return messages;
}

async function promptContextHash(value) {
  const bytes = new TextEncoder().encode(String(value || ""));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
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

function hasOutboundAudio(parts) {
  return parts.some(part => part?.kind === "audio");
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

function ttsApiKeys(env) {
  return [...new Set([
    ...parseList(env?.GEMINI_TTS_API_KEYS),
    ...parseList(env?.GEMINI_TTS_API_KEY),
    ...googleApiKeysFor(env || {}, "gemini_chat")
  ].map(String).map(value => value.trim()).filter(Boolean))];
}

function oneBotCapabilityValue(value) {
  const data = value && typeof value === "object" && Object.prototype.hasOwnProperty.call(value, "data") ? value.data : value;
  if (typeof data === "boolean") return data;
  if (!data || typeof data !== "object") return null;
  for (const key of ["yes", "ok", "supported", "can_send_record", "canSendRecord"]) {
    if (typeof data[key] === "boolean") return data[key];
  }
  return null;
}

async function defaultAiChat(env, input, context = {}) {
  const source = typeof input === "string" ? { text: input } : (input && typeof input === "object" ? input : {});
  const override = context?.aiProviderOverride && typeof context.aiProviderOverride === "object" ? context.aiProviderOverride : null;
  if (override?.provider === "codex") {
    const actorId = String(context?.eventContext?.message?.userId || context?.eventContext?.userId || "");
    if (!actorId || !isDeveloperId(env, actorId)) throw new Error("PLUGIN_CODEX_DEVELOPER_REQUIRED");
    const messages = pluginCodexMessages(source);
    if (!messages.length) throw new Error("PLUGIN_AI_CHAT_INPUT_REQUIRED");
    const pluginId = String(context?.plugin?.id || "plugin").slice(0, 96);
    const message = context?.eventContext?.message || {};
    const scope = String(message.scope || "private");
    const peer = scope === "group" ? String(message.groupId || "") : String(message.userId || actorId);
    const sessionKey = `qqaibot:plugin:${pluginId}:${scope}:${peer}:developer:${actorId}`;
    const systemText = messages.filter(item => item.role === "system").map(item => item.content).join("\n\n");
    const result = await callCodexBridgeWebSocket(env, { model: override.model || "gpt-6-luna" }, {
      task: "chat",
      model: String(override.model || "gpt-6-luna"),
      messages,
      reasoningEffort: String(override.reasoningEffort || "none"),
      originalPromptOnly: false,
      sessionKey,
      contextHash: await promptContextHash(systemText),
      maxOutputTokens: clampNumber(source.maxOutputTokens, 1000, 1, 4096),
      timeoutMs: clampNumber(source.timeoutMs, 45000, 3000, 120000)
    });
    return safeAiResult(result);
  }

  try {
    const routed = await callProviderRoute(env, "chat", source);
    if (routed?.text) return safeAiResult(routed);
  } catch (error) {
    console.warn("[v3-host] configured chat providers unavailable; falling back to legacy route", String(error?.message || error).slice(0, 240));
  }
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

async function defaultAiTts(env, input, dependencies = {}) {
  const models = Array.isArray(dependencies.models) && dependencies.models.length
    ? dependencies.models
    : await effectiveRuntimeModels(env, "tts");
  const apiKeys = Array.isArray(dependencies.apiKeys) && dependencies.apiKeys.length
    ? dependencies.apiKeys
    : ttsApiKeys(env);
  return synthesizeGeminiTts(input, {
    models,
    apiKeys,
    fetchImpl: dependencies.fetchImpl || fetch
  });
}

function createV3HostAdapter(env, {
  plugins = [],
  logger = console,
  dependencies = {},
  allowedOneBotActions = DEFAULT_PLUGIN_ONEBOT_ACTIONS,
  defaultEnabledPluginIds = null
} = {}) {
  if (!env || typeof env !== "object") throw new Error("V3_HOST_ENV_REQUIRED");
  const onebotCall = dependencies.onebotCall || ((action, params, timeoutMs) => callOneBotAction(env, { action, params }, timeoutMs));
  const safeFetch = dependencies.safeFetch || ((url, options) => fetchPublicUrl(url, options, 3));
  const deps = {
    dbGet: dependencies.dbGet || (key => dbGet(env, key)),
    dbPut: dependencies.dbPut || ((key, value) => dbPut(env, key, value)),
    dbDel: dependencies.dbDel || (key => dbDel(env, key)),
    onebotCall,
    safeFetch,
    aiChat: dependencies.aiChat || ((input, context) => defaultAiChat(env, input, context)),
    aiVision: dependencies.aiVision || (input => defaultAiVision(env, input)),
    aiMultimodal: dependencies.aiMultimodal || ((message, input) => runV3MultimodalAi(env, message, input, { onebotCall, safeFetch })),
    aiTts: dependencies.aiTts || (input => defaultAiTts(env, input)),
    schedulerCreate: dependencies.schedulerCreate || null
  };
  const onebotAllowlist = new Set((allowedOneBotActions || []).map(value => String(value || "").trim()).filter(Boolean));
  const storageAdapter = Object.freeze({ get: deps.dbGet, put: deps.dbPut, del: deps.dbDel });
  const pluginScheduler = dependencies.scheduler || createPluginScheduler(storageAdapter, dependencies.schedulerOptions || {});
  const pluginLifecycle = dependencies.pluginLifecycle || createPluginLifecycleRegistry(storageAdapter, {
    qqaiVersion: String(dependencies.qqaiVersion || VERSION),
    nowProvider: dependencies.lifecycleNowProvider || Date.now,
    persist: dependencies.lifecyclePersist !== false
  });
  let lifecycleRecords = new Map();
  let adapterStarted = false;
  let recordCapability = null;

  async function ensureRecordCapability(parts) {
    if (!hasOutboundAudio(parts)) return;
    if (recordCapability === false) throw new Error("PLUGIN_AUDIO_SEND_UNAVAILABLE");
    if (recordCapability === true) return;
    try {
      const probe = await deps.onebotCall("can_send_record", {}, 5000);
      const supported = oneBotCapabilityValue(probe);
      if (supported === false) {
        recordCapability = false;
        throw new Error("PLUGIN_AUDIO_SEND_UNAVAILABLE");
      }
      if (supported === true) recordCapability = true;
    } catch (error) {
      if (String(error?.message || error) === "PLUGIN_AUDIO_SEND_UNAVAILABLE") throw error;
      logger?.warn?.("[v3-host] can_send_record probe failed; attempting real send", String(error?.message || error).slice(0, 240));
    }
  }

  async function sendParts(plugin, value, fallbackMessage, explicitTarget = null) {
    const targetEnvelope = explicitTarget && typeof explicitTarget === "object" && !Array.isArray(explicitTarget) ? explicitTarget : {};
    const messageValue = Object.prototype.hasOwnProperty.call(targetEnvelope, "message") ? targetEnvelope.message : value;
    const parts = normalizePluginMessage(messageValue);
    if (hasOutboundMedia(parts) && !plugin.capabilities.includes("media.send")) {
      throw new Error(`PLUGIN_CAPABILITY_DENIED:${plugin.id}:media.send`);
    }
    await ensureRecordCapability(parts);
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
    "ai.chat": async ({ input, plugin, eventContext }) => deps.aiChat(input, { plugin, eventContext, aiProviderOverride: eventContext?.aiProviderOverride || null }),
    "ai.vision": async ({ input }) => deps.aiVision(input),
    "ai.multimodal": async ({ input, eventContext }) => {
      const message = eventContext?.message;
      if (!message || !Array.isArray(message.parts)) throw new Error("PLUGIN_MULTIMODAL_MESSAGE_REQUIRED");
      return deps.aiMultimodal(message, input);
    },
    "ai.tts": async ({ input }) => deps.aiTts(input),
    "scheduler.create": async ({ plugin, input }) => typeof deps.schedulerCreate === "function"
      ? deps.schedulerCreate({ plugin, input })
      : pluginScheduler.create(plugin.id, input),
    "scheduler.list": async ({ plugin, input }) => pluginScheduler.list(plugin.id, input || {}),
    "scheduler.get": async ({ plugin, id }) => pluginScheduler.get(plugin.id, id),
    "scheduler.cancel": async ({ plugin, id }) => pluginScheduler.cancel(plugin.id, id),
    "member.recent_messages": async ({ input, eventContext }) => {
      const source = input && typeof input === "object" ? input : {};
      const message = eventContext?.message || {};
      const groupId = String(source.groupId || message.groupId || "");
      const userId = String(source.userId || message.userId || "");
      const limit = clampNumber(source.limit, 30, 1, 80);
      if (!groupId || !userId) throw new Error("PLUGIN_MEMBER_RECENT_TARGET_REQUIRED");
      return recentConversationMessagesForUser(env, groupId, userId, limit);
    },
    "network.fetch": async ({ input }) => {
      const source = typeof input === "string" ? { url: input } : (input && typeof input === "object" ? input : {});
      const url = String(source.url || "").trim();
      if (!url) throw new Error("PLUGIN_NETWORK_URL_REQUIRED");
      const init = source.init && typeof source.init === "object" ? { ...source.init } : {};
      delete init.cf;
      return deps.safeFetch(url, init);
    }
  };

  const host = createPluginHost({ services, storageAdapter, logger });
  for (const plugin of plugins) host.register(plugin);

  function lifecycleMap(snapshot) {
    return new Map(Object.entries(snapshot?.plugins || {}));
  }

  async function applyLifecycleRecord(record, actorId = "") {
    if (!record) return null;
    host.setCapabilityGrants(record.id, record.grantedPermissions || []);
    lifecycleRecords.set(record.id, record);
    if (!adapterStarted) return record;
    if (record.state === "enabled") {
      try {
        await host.activate(record.id);
        return record;
      } catch (error) {
        const blocked = await pluginLifecycle.markRuntimeBlocked(record.id, String(error?.message || error), actorId);
        lifecycleRecords.set(record.id, blocked);
        try { await host.deactivate(record.id); } catch {}
        logger?.error?.("[v3-host] plugin activation blocked", record.id, String(error?.message || error).slice(0, 240));
        return blocked;
      }
    }
    try { await host.deactivate(record.id); } catch (error) {
      logger?.warn?.("[v3-host] plugin deactivation failed", record.id, String(error?.message || error).slice(0, 240));
    }
    return record;
  }

  async function start() {
    if (adapterStarted) return;
    const defaults = Array.isArray(defaultEnabledPluginIds) ? defaultEnabledPluginIds : plugins.map(plugin => plugin.manifest.id);
    const snapshot = await pluginLifecycle.reconcile(plugins, { defaultEnabledPluginIds: defaults });
    lifecycleRecords = lifecycleMap(snapshot);
    for (const plugin of plugins) {
      const record = lifecycleRecords.get(plugin.manifest.id);
      host.setCapabilityGrants(plugin.manifest.id, record?.grantedPermissions || []);
    }
    await host.start({ enabledPluginIds: [] });
    adapterStarted = true;
    for (const record of lifecycleRecords.values()) {
      if (record.available && record.state === "enabled") await applyLifecycleRecord(record);
    }
  }

  async function stop() {
    if (!adapterStarted) return;
    await host.stop();
    adapterStarted = false;
  }

  function listPlugins() {
    return host.listPlugins().map(plugin => Object.freeze({ ...plugin, lifecycle: lifecycleRecords.get(plugin.id) || null }));
  }

  function getPluginLifecycle(pluginId) {
    return lifecycleRecords.get(String(pluginId || "")) || null;
  }

  async function setPluginEnabled(pluginId, enabled, eventContext = {}) {
    if (!adapterStarted) await start();
    const actorId = String(eventContext?.userId || eventContext?.actorId || "");
    const record = await pluginLifecycle.setEnabled(pluginId, Boolean(enabled), actorId);
    return applyLifecycleRecord(record, actorId);
  }

  async function setPluginPermissions(pluginId, permissions = [], eventContext = {}) {
    if (!adapterStarted) await start();
    const actorId = String(eventContext?.userId || eventContext?.actorId || "");
    const record = await pluginLifecycle.setGrantedPermissions(pluginId, permissions, actorId);
    return applyLifecycleRecord(record, actorId);
  }

  async function setPluginChannelPreference(pluginId, channel = "stable", eventContext = {}) {
    if (!adapterStarted) await start();
    const actorId = String(eventContext?.userId || eventContext?.actorId || "");
    const record = await pluginLifecycle.setChannelPreference(pluginId, channel, actorId);
    lifecycleRecords.set(record.id, record);
    return record;
  }

  async function dispatchOneBotEvent(body = {}) {
    const postType = String(body?.post_type || "");
    if (postType === "message" || postType === "message_sent") {
      let message = fromOneBotEvent(body);
      let aiProviderOverride = null;
      const codexOverride = parseAiCommandCodexOverride(message.text);
      if (codexOverride.matched) {
        const notice = async text => {
          const parts = message.scope === "group"
            ? [{ type: "at", data: { qq: String(message.userId || "") } }, { type: "text", data: { text: ` ${text}` } }]
            : [{ type: "text", data: { text } }];
          const action = message.scope === "group" ? "send_group_msg" : "send_private_msg";
          const params = message.scope === "group"
            ? { group_id: message.groupId, message: parts, auto_escape: false }
            : { user_id: message.userId, message: parts, auto_escape: false };
          await deps.onebotCall(action, params, 15000);
        };
        if (!isDeveloperId(env, message.userId)) {
          await notice("只有开发者可以使用 --codex 强制模型。");
          return { handled: true, eventName: message.scope === "group" ? "group_message" : "private_message", message, results: [{ consume: true, action: "codex_override_denied" }] };
        }
        if (!codexOverride.ok) {
          await notice(codexOverride.message || "Codex 参数格式无效。");
          return { handled: true, eventName: message.scope === "group" ? "group_message" : "private_message", message, results: [{ consume: true, action: "codex_override_invalid" }] };
        }
        aiProviderOverride = Object.freeze({
          provider: "codex",
          model: codexOverride.model,
          reasoningEffort: codexOverride.reasoningEffort
        });
        message = Object.freeze({ ...message, text: codexOverride.text });
      }
      const eventName = message.scope === "group" ? "group_message" : message.scope === "private" ? "private_message" : "message";
      const results = await host.dispatch(eventName, message, { message, groupId: message.groupId, userId: message.userId, aiProviderOverride });
      return { handled: true, eventName, message, results };
    }
    if (postType === "notice") return { handled: true, eventName: "notice", message: null, results: await host.dispatch("notice", body) };
    if (postType === "request") return { handled: true, eventName: "request", message: null, results: await host.dispatch("request", body) };
    return { handled: false, eventName: "", message: null, results: [] };
  }

  async function runDuePluginJobs(options = {}) {
    return pluginScheduler.runDue(async (pluginId, event) => {
      if (!host.isActive(pluginId)) return Object.freeze({ skipped: "plugin_inactive", pluginId });
      const dispatched = await host.dispatchTo(pluginId, "cron", event, { pluginId });
      if (!dispatched.handled) throw new Error(`PLUGIN_CRON_HANDLER_MISSING:${pluginId}`);
      return dispatched.results;
    }, options);
  }

  return Object.freeze({
    dispatchOneBotEvent,
    getPluginLifecycle,
    getPluginPublicStatus: host.getPluginPublicStatus,
    getPluginSurface: host.getPluginSurface,
    host,
    listPlugins,
    pluginLifecycle,
    pluginScheduler,
    register: host.register,
    runCommand: host.runCommand,
    runDuePluginJobs,
    setPluginChannelPreference,
    setPluginEnabled,
    setPluginPermissions,
    start,
    stop,
    updatePluginSettings: host.updatePluginSettings
  });
}

export {
  DEFAULT_PLUGIN_ONEBOT_ACTIONS,
  createV3HostAdapter,
  defaultAiChat,
  defaultAiTts,
  defaultAiVision,
  hasOutboundAudio,
  hasOutboundMedia,
  normalizePluginMessage,
  oneBotCapabilityValue,
  resolveTarget,
  safeAiResult,
  ttsApiKeys
};
