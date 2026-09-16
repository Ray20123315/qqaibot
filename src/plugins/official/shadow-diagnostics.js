import { definePlugin } from "../api.js";

const SHADOW_MEDIA_KINDS = new Set(["image", "audio", "video", "file", "mface"]);

function summarizeMessage(message) {
  const parts = Array.isArray(message?.parts) ? message.parts : [];
  const kinds = parts.map(part => String(part?.kind || "unknown"));
  const counts = {};
  for (const kind of kinds) counts[kind] = (counts[kind] || 0) + 1;
  return Object.freeze({
    type: "message",
    schemaVersion: Number(message?.schemaVersion || 0),
    messageId: String(message?.messageId || ""),
    scope: String(message?.scope || "unknown"),
    groupId: String(message?.groupId || ""),
    userId: String(message?.userId || ""),
    partCount: parts.length,
    kinds: Object.freeze(kinds),
    counts: Object.freeze(counts),
    hasMedia: kinds.some(kind => SHADOW_MEDIA_KINDS.has(kind)),
    hasForward: kinds.includes("forward"),
    hasReply: kinds.includes("reply"),
    hasMention: kinds.includes("mention")
  });
}

function summarizeEvent(type, payload = {}) {
  return Object.freeze({
    type,
    postType: String(payload?.post_type || ""),
    eventType: String(payload?.notice_type || payload?.request_type || payload?.meta_event_type || ""),
    subType: String(payload?.sub_type || ""),
    groupId: String(payload?.group_id || ""),
    userId: String(payload?.user_id || "")
  });
}

const shadowDiagnosticsPlugin = definePlugin({
  manifest: {
    id: "official.shadow-diagnostics",
    name: "QQAI Shadow Diagnostics",
    version: "1.0.0",
    apiVersion: "1",
    description: "Read-only diagnostic plugin for validating QQAI v3 against mirrored OneBot events.",
    author: "QQAI",
    official: true,
    capabilities: ["message.read", "media.read"]
  },
  onMessage(_ctx, message) {
    return summarizeMessage(message);
  },
  onNotice(_ctx, payload) {
    return summarizeEvent("notice", payload);
  },
  onRequest(_ctx, payload) {
    return summarizeEvent("request", payload);
  }
});

export { SHADOW_MEDIA_KINDS, shadowDiagnosticsPlugin, summarizeEvent, summarizeMessage };
