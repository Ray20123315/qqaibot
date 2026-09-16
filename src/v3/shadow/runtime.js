import { shadowDiagnosticsPlugin } from "../../plugins/official/shadow-diagnostics.js";
import { createV3HostAdapter } from "../host/adapter.js";

const SHADOW_HOSTS = new WeakMap();
const MEDIA_ONEBOT_TYPES = new Set(["image", "record", "audio", "video", "file", "mface", "forward"]);

function envBool(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on", "enabled"].includes(normalized)) return true;
  if (["0", "false", "no", "off", "disabled"].includes(normalized)) return false;
  return fallback;
}

function shadowEnabled(env) {
  return envBool(env?.V3_SHADOW_ENABLED, false);
}

function shadowSampleRate(env) {
  const value = Number(env?.V3_SHADOW_SAMPLE_RATE ?? 0.02);
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0.02;
}

function shadowCaptureAllMedia(env) {
  return envBool(env?.V3_SHADOW_CAPTURE_ALL_MEDIA, true);
}

function stableHash32(input) {
  const text = String(input || "");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function shadowEventKey(body = {}) {
  return [
    body.post_type,
    body.message_type,
    body.message_id,
    body.notice_type,
    body.request_type,
    body.group_id,
    body.user_id,
    body.time
  ].map(value => String(value ?? "")).join(":");
}

function deterministicSample(body, rate) {
  if (rate >= 1) return true;
  if (rate <= 0) return false;
  return stableHash32(shadowEventKey(body)) / 0x100000000 < rate;
}

function rawEventHasMedia(body = {}) {
  const message = body?.message;
  if (Array.isArray(message)) {
    return message.some(segment => MEDIA_ONEBOT_TYPES.has(String(segment?.type || "").trim().toLowerCase()));
  }
  const raw = String(body?.raw_message || message || "");
  return /\[CQ:(?:image|record|audio|video|file|mface|forward)\b/i.test(raw);
}

function readOnlyDependencies() {
  const blocked = async () => { throw new Error("V3_SHADOW_SIDE_EFFECT_BLOCKED"); };
  return Object.freeze({
    dbGet: async () => null,
    dbPut: blocked,
    dbDel: blocked,
    onebotCall: blocked,
    safeFetch: blocked,
    aiChat: blocked,
    aiVision: blocked,
    aiTts: null,
    schedulerCreate: null
  });
}

async function getShadowAdapter(env, logger) {
  if (!env || typeof env !== "object") throw new Error("V3_SHADOW_ENV_REQUIRED");
  let entry = SHADOW_HOSTS.get(env);
  if (!entry) {
    const adapter = createV3HostAdapter(env, {
      plugins: [shadowDiagnosticsPlugin],
      logger,
      dependencies: readOnlyDependencies(),
      allowedOneBotActions: []
    });
    entry = { adapter, startPromise: Promise.resolve(adapter.start()) };
    SHADOW_HOSTS.set(env, entry);
  }
  await entry.startPromise;
  return entry.adapter;
}

function safeShadowResult(dispatchResult, elapsedMs) {
  const summaries = Array.isArray(dispatchResult?.results)
    ? dispatchResult.results.filter(item => item && typeof item === "object").map(item => ({ ...item }))
    : [];
  return Object.freeze({
    version: 1,
    eventName: String(dispatchResult?.eventName || ""),
    handled: dispatchResult?.handled === true,
    elapsedMs: Math.max(0, Number(elapsedMs || 0)),
    summaries
  });
}

async function runV3ShadowEvent(env, body = {}, { logger = console, force = false } = {}) {
  if (!force && !shadowEnabled(env)) return Object.freeze({ enabled: false, sampled: false, diagnostic: null });
  const postType = String(body?.post_type || "");
  if (!force && !["message", "message_sent", "notice", "request"].includes(postType)) {
    return Object.freeze({ enabled: true, sampled: false, diagnostic: null });
  }
  const media = rawEventHasMedia(body);
  const sampled = force || (media && shadowCaptureAllMedia(env)) || deterministicSample(body, shadowSampleRate(env));
  if (!sampled) return Object.freeze({ enabled: true, sampled: false, diagnostic: null });

  const startedAt = Date.now();
  const adapter = await getShadowAdapter(env, logger);
  const dispatchResult = await adapter.dispatchOneBotEvent(body);
  const diagnostic = safeShadowResult(dispatchResult, Date.now() - startedAt);
  if (typeof logger?.info === "function") logger.info("[v3-shadow]", JSON.stringify(diagnostic));
  return Object.freeze({ enabled: true, sampled: true, diagnostic });
}

export {
  deterministicSample,
  envBool,
  rawEventHasMedia,
  runV3ShadowEvent,
  safeShadowResult,
  shadowCaptureAllMedia,
  shadowEnabled,
  shadowEventKey,
  shadowSampleRate,
  stableHash32
};
