import { AI_MEDIA_LIMITS } from "../../config/runtime.js";
import { cleanMediaRef } from "../message/core.js";
import { normalizeOneBotMessage } from "../message/onebot.js";
import { directMediaSource, isHttpUrl, planMediaResolution } from "./core.js";

const DEFAULT_MEDIA_RESOLVER_LIMITS = Object.freeze({
  image: AI_MEDIA_LIMITS.imageBytes,
  audio: AI_MEDIA_LIMITS.audioBytes,
  video: AI_MEDIA_LIMITS.videoBytes,
  file: AI_MEDIA_LIMITS.videoBytes,
  mface: AI_MEDIA_LIMITS.imageBytes,
  forwardNodes: AI_MEDIA_LIMITS.forwardNodes
});

class MediaResolutionError extends Error {
  constructor(code, stage, kind, message = code, details = {}) {
    super(message);
    this.name = "MediaResolutionError";
    this.code = String(code || "MEDIA_RESOLUTION_ERROR");
    this.stage = String(stage || "unknown");
    this.kind = String(kind || "unknown");
    this.details = Object.freeze({ ...details });
  }
}

function unwrapOneBotResult(value) {
  if (value && typeof value === "object" && Object.prototype.hasOwnProperty.call(value, "data") && value.data !== undefined) return value.data;
  return value;
}

function mediaLimit(kind, limits = {}) {
  const fallback = DEFAULT_MEDIA_RESOLVER_LIMITS[kind] || AI_MEDIA_LIMITS.videoBytes;
  const value = Number(limits?.[kind] ?? fallback);
  return Number.isFinite(value) ? Math.max(1024, Math.min(64 * 1024 * 1024, Math.trunc(value))) : fallback;
}

function allowedMime(kind, mimeType) {
  const mime = String(mimeType || "").split(";", 1)[0].trim().toLowerCase();
  if (!mime) return true;
  if (kind === "image" || kind === "mface") return mime.startsWith("image/");
  if (kind === "audio") return mime.startsWith("audio/") || mime === "application/octet-stream";
  if (kind === "video") return mime.startsWith("video/") || mime === "application/octet-stream";
  return true;
}

function estimatedBase64Bytes(value) {
  const text = String(value || "").replace(/\s+/g, "");
  if (!text) return 0;
  const padding = text.endsWith("==") ? 2 : text.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor(text.length * 3 / 4) - padding);
}

function bytesToBase64(bytes) {
  const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || 0);
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < input.length; index += chunk) {
    binary += String.fromCharCode(...input.subarray(index, Math.min(input.length, index + chunk)));
  }
  return btoa(binary);
}

async function readResponseBytes(response, maxBytes) {
  if (!response?.ok) throw new MediaResolutionError("MEDIA_HTTP_ERROR", "download", "unknown", `HTTP_${Number(response?.status || 0)}`, { status: Number(response?.status || 0) });
  const declared = Number(response.headers?.get?.("content-length") || 0);
  if (declared && declared > maxBytes) throw new MediaResolutionError("MEDIA_TOO_LARGE", "download", "unknown", "declared media size exceeds limit", { declared, maxBytes });
  if (!response.body?.getReader) {
    const buffer = new Uint8Array(await response.arrayBuffer());
    if (buffer.byteLength > maxBytes) throw new MediaResolutionError("MEDIA_TOO_LARGE", "download", "unknown", "media size exceeds limit", { size: buffer.byteLength, maxBytes });
    return buffer;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = value instanceof Uint8Array ? value : new Uint8Array(value || 0);
      total += chunk.byteLength;
      if (total > maxBytes) {
        try { await reader.cancel("media size limit"); } catch {}
        throw new MediaResolutionError("MEDIA_TOO_LARGE", "download", "unknown", "streamed media size exceeds limit", { size: total, maxBytes });
      }
      chunks.push(chunk);
    }
  } finally {
    try { reader.releaseLock?.(); } catch {}
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

function sourceFromOneBot(value, kind) {
  const data = unwrapOneBotResult(value);
  if (!data || typeof data !== "object") return null;
  const base64 = String(data.base64 || data.data?.base64 || "").replace(/^base64:\/\//i, "");
  const mimeType = String(data.mime_type || data.mimeType || data.content_type || "");
  if (base64) return { type: "base64", value: base64, mimeType };
  for (const candidate of [data.url, data.file_url, data.download_url, data.file]) {
    if (isHttpUrl(candidate)) return { type: "url", value: String(candidate), mimeType };
    if (/^base64:\/\//i.test(String(candidate || ""))) return { type: "base64", value: String(candidate).replace(/^base64:\/\//i, ""), mimeType };
  }
  return null;
}

function matchingPartFromMessage(rawMessage, originalPart) {
  const parts = normalizeOneBotMessage(rawMessage);
  const wantedKind = originalPart.kind === "mface" ? new Set(["mface", "image"]) : new Set([originalPart.kind]);
  const originalFile = String(originalPart?.media?.file || "");
  return parts.find(part => wantedKind.has(part.kind) && originalFile && String(part?.media?.file || "") === originalFile)
    || parts.find(part => wantedKind.has(part.kind))
    || null;
}

async function downloadSource(source, kind, { safeFetch, limits, timeoutMs = 20000 } = {}) {
  const maxBytes = mediaLimit(kind, limits);
  if (!source) throw new MediaResolutionError("MEDIA_SOURCE_MISSING", "source", kind);
  if (source.type === "base64") {
    const base64 = String(source.value || "").replace(/^base64:\/\//i, "");
    const size = estimatedBase64Bytes(base64);
    if (size > maxBytes) throw new MediaResolutionError("MEDIA_TOO_LARGE", "decode", kind, "inline media exceeds limit", { size, maxBytes });
    const mimeType = String(source.mimeType || "application/octet-stream");
    if (!allowedMime(kind, mimeType)) throw new MediaResolutionError("MEDIA_MIME_REJECTED", "decode", kind, "media MIME rejected", { mimeType });
    return Object.freeze({ base64, mimeType, size, sourceType: "base64" });
  }
  if (source.type !== "url" || !isHttpUrl(source.value)) throw new MediaResolutionError("MEDIA_SOURCE_UNSUPPORTED", "source", kind);
  if (typeof safeFetch !== "function") throw new MediaResolutionError("MEDIA_FETCH_UNAVAILABLE", "download", kind);
  let response;
  try {
    response = await safeFetch(String(source.value), { signal: AbortSignal.timeout(Math.max(1000, Math.min(30000, Number(timeoutMs || 20000)))) });
  } catch (error) {
    throw new MediaResolutionError("MEDIA_FETCH_FAILED", "download", kind, String(error?.message || error).slice(0, 240));
  }
  if (!response?.ok) throw new MediaResolutionError("MEDIA_HTTP_ERROR", "download", kind, `HTTP_${Number(response?.status || 0)}`, { status: Number(response?.status || 0) });
  const mimeType = String(response.headers?.get?.("content-type") || source.mimeType || "application/octet-stream").split(";", 1)[0].trim().toLowerCase();
  if (!allowedMime(kind, mimeType)) throw new MediaResolutionError("MEDIA_MIME_REJECTED", "download", kind, "media MIME rejected", { mimeType });
  let bytes;
  try {
    bytes = await readResponseBytes(response, maxBytes);
  } catch (error) {
    if (error instanceof MediaResolutionError) throw new MediaResolutionError(error.code, error.stage, kind, error.message, error.details);
    throw error;
  }
  return Object.freeze({ base64: bytesToBase64(bytes), mimeType, size: bytes.byteLength, sourceType: "url" });
}

function normalizeForwardNodes(value, maxNodes = AI_MEDIA_LIMITS.forwardNodes) {
  const data = unwrapOneBotResult(value);
  const rows = Array.isArray(data) ? data : Array.isArray(data?.messages) ? data.messages : Array.isArray(data?.message) ? data.message : [];
  return Object.freeze(rows.slice(0, Math.max(1, Math.min(AI_MEDIA_LIMITS.forwardNodes, Number(maxNodes || AI_MEDIA_LIMITS.forwardNodes)))).map(row => Object.freeze({
    userId: String(row?.user_id ?? row?.sender?.user_id ?? ""),
    nickname: String(row?.nickname ?? row?.sender?.nickname ?? row?.name ?? ""),
    time: Number(row?.time || 0) || null,
    parts: Object.freeze(normalizeOneBotMessage(row?.message ?? row?.content ?? []))
  })));
}

async function resolveForwardPart(part, { onebotCall, limits } = {}) {
  if (!part?.forwardId) throw new MediaResolutionError("FORWARD_ID_MISSING", "plan", "forward");
  if (typeof onebotCall !== "function") throw new MediaResolutionError("ONEBOT_UNAVAILABLE", "onebot", "forward");
  const value = await onebotCall("get_forward_msg", { message_id: String(part.forwardId) }, 15000);
  const nodes = normalizeForwardNodes(value, limits?.forwardNodes);
  if (!nodes.length) throw new MediaResolutionError("FORWARD_EMPTY", "onebot", "forward");
  return Object.freeze({ kind: "forward", forwardId: String(part.forwardId), nodes, nodeCount: nodes.length, source: "onebot:get_forward_msg" });
}

async function refreshThroughMessage(part, context, onebotCall) {
  const messageId = String(context?.messageId || "");
  if (!messageId || typeof onebotCall !== "function") return null;
  const value = unwrapOneBotResult(await onebotCall("get_msg", { message_id: messageId }, 15000));
  const matched = matchingPartFromMessage(value?.message ?? value?.raw_message ?? "", part);
  return matched ? directMediaSource(matched.media || {}) : null;
}

async function resolveBinaryPart(part, context = {}, deps = {}) {
  const kind = String(part?.kind || "");
  const attempts = [];
  const direct = directMediaSource(part?.media || {});
  if (direct) {
    attempts.push({ stage: "direct", ok: true, sourceType: direct.type });
    const data = await downloadSource(direct, kind, deps);
    return Object.freeze({ kind, ...data, source: `direct:${direct.type}`, attempts: Object.freeze(attempts) });
  }

  const plan = planMediaResolution(part);
  attempts.push({ stage: "plan", ok: plan.strategy !== "none", strategy: plan.strategy, action: plan.action || "" });
  if (plan.strategy === "onebot") {
    if (typeof deps.onebotCall !== "function") throw new MediaResolutionError("ONEBOT_UNAVAILABLE", "onebot", kind);
    try {
      const refreshed = await deps.onebotCall(plan.action, plan.params, 15000);
      const source = sourceFromOneBot(refreshed, kind);
      attempts.push({ stage: "onebot_refresh", ok: Boolean(source), action: plan.action, sourceType: source?.type || "" });
      if (source) {
        const data = await downloadSource(source, kind, deps);
        return Object.freeze({ kind, ...data, source: `onebot:${plan.action}`, attempts: Object.freeze(attempts) });
      }
    } catch (error) {
      attempts.push({ stage: "onebot_refresh", ok: false, action: plan.action, errorCode: String(error?.code || error?.message || "ONEBOT_ERROR").slice(0, 120) });
    }
  }

  if (kind === "file" && part?.media?.fileId && context?.groupId && typeof deps.onebotCall === "function") {
    try {
      const value = await deps.onebotCall("get_group_file_url", {
        group_id: String(context.groupId), file_id: String(part.media.fileId), busid: context.busid || undefined
      }, 15000);
      const source = sourceFromOneBot(value, kind);
      attempts.push({ stage: "group_file_url", ok: Boolean(source), action: "get_group_file_url", sourceType: source?.type || "" });
      if (source) {
        const data = await downloadSource(source, kind, deps);
        return Object.freeze({ kind, ...data, source: "onebot:get_group_file_url", attempts: Object.freeze(attempts) });
      }
    } catch (error) {
      attempts.push({ stage: "group_file_url", ok: false, action: "get_group_file_url", errorCode: String(error?.code || error?.message || "ONEBOT_ERROR").slice(0, 120) });
    }
  }

  try {
    const source = await refreshThroughMessage(part, context, deps.onebotCall);
    attempts.push({ stage: "message_refresh", ok: Boolean(source), action: context?.messageId ? "get_msg" : "", sourceType: source?.type || "" });
    if (source) {
      const data = await downloadSource(source, kind, deps);
      return Object.freeze({ kind, ...data, source: "onebot:get_msg", attempts: Object.freeze(attempts) });
    }
  } catch (error) {
    attempts.push({ stage: "message_refresh", ok: false, action: "get_msg", errorCode: String(error?.code || error?.message || "ONEBOT_ERROR").slice(0, 120) });
  }

  const ref = cleanMediaRef(part?.media || {});
  const hasLocalOnly = Boolean(ref.path || (ref.file && (/^[/\\]/.test(ref.file) || /^[A-Za-z]:[\\/]/.test(ref.file))));
  throw new MediaResolutionError(hasLocalOnly ? "MEDIA_LOCAL_PATH_UNREACHABLE" : "MEDIA_UNRESOLVED", "resolve", kind, hasLocalOnly ? "NapCat local path is not reachable from Cloudflare" : "no resolvable media source", { attempts });
}

async function resolveMediaPart(part, context = {}, deps = {}) {
  if (!part || typeof part !== "object") throw new MediaResolutionError("MEDIA_PART_INVALID", "plan", "unknown");
  if (part.kind === "forward") return resolveForwardPart(part, deps);
  if (!["image", "audio", "video", "file", "mface"].includes(part.kind)) throw new MediaResolutionError("MEDIA_KIND_UNSUPPORTED", "plan", String(part.kind || "unknown"));
  return resolveBinaryPart(part, context, deps);
}

async function tryResolveMediaPart(part, context = {}, deps = {}) {
  try {
    return Object.freeze({ ok: true, value: await resolveMediaPart(part, context, deps), error: null });
  } catch (error) {
    const normalized = error instanceof MediaResolutionError ? error : new MediaResolutionError("MEDIA_RESOLUTION_ERROR", "unknown", String(part?.kind || "unknown"), String(error?.message || error).slice(0, 240));
    return Object.freeze({ ok: false, value: null, error: Object.freeze({ code: normalized.code, stage: normalized.stage, kind: normalized.kind, message: normalized.message, details: normalized.details }) });
  }
}

async function resolveMessageMedia(message, deps = {}, options = {}) {
  const parts = Array.isArray(message?.parts) ? message.parts : [];
  const results = [];
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    if (!["image", "audio", "video", "file", "mface", "forward"].includes(part?.kind)) continue;
    const result = await tryResolveMediaPart(part, { messageId: message?.messageId, groupId: message?.groupId, ...options }, deps);
    results.push(Object.freeze({ index, kind: part.kind, ...result }));
  }
  return Object.freeze(results);
}

export {
  DEFAULT_MEDIA_RESOLVER_LIMITS,
  MediaResolutionError,
  allowedMime,
  bytesToBase64,
  downloadSource,
  estimatedBase64Bytes,
  mediaLimit,
  normalizeForwardNodes,
  readResponseBytes,
  resolveMediaPart,
  resolveMessageMedia,
  sourceFromOneBot,
  tryResolveMediaPart,
  unwrapOneBotResult
};
