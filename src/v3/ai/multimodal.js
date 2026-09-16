import { resolveMediaPart } from "../media/resolver.js";

const DEFAULT_MULTIMODAL_LIMITS = Object.freeze({
  maxInlineBytes: 18 * 1024 * 1024,
  maxMediaParts: 6,
  maxTextChars: 40000,
  maxForwardNodes: 20,
  maxForwardDepth: 1
});

class MultimodalCompileError extends Error {
  constructor(code, stage, message = code, details = {}) {
    super(message);
    this.name = "MultimodalCompileError";
    this.code = String(code || "MULTIMODAL_COMPILE_ERROR");
    this.stage = String(stage || "compile");
    this.details = Object.freeze({ ...details });
  }
}

function clampInteger(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function compileLimits(options = {}) {
  return Object.freeze({
    maxInlineBytes: clampInteger(options.maxInlineBytes, DEFAULT_MULTIMODAL_LIMITS.maxInlineBytes, 1024, 19 * 1024 * 1024),
    maxMediaParts: clampInteger(options.maxMediaParts, DEFAULT_MULTIMODAL_LIMITS.maxMediaParts, 1, 12),
    maxTextChars: clampInteger(options.maxTextChars, DEFAULT_MULTIMODAL_LIMITS.maxTextChars, 1000, 100000),
    maxForwardNodes: clampInteger(options.maxForwardNodes, DEFAULT_MULTIMODAL_LIMITS.maxForwardNodes, 1, 80),
    maxForwardDepth: clampInteger(options.maxForwardDepth, DEFAULT_MULTIMODAL_LIMITS.maxForwardDepth, 0, 2)
  });
}

function mediaLabel(part = {}) {
  if (part.kind === "image") return part.summary ? `圖片：${part.summary}` : "圖片";
  if (part.kind === "audio") return "語音";
  if (part.kind === "video") return "影片";
  if (part.kind === "file") return `檔案：${String(part.media?.name || part.media?.file || "附件")}`;
  if (part.kind === "mface") return `QQ 商城表情：${String(part.summary || part.emojiId || "未命名")}`;
  return String(part.kind || "媒體");
}

function modelMimeType(kind, resolved = {}) {
  const raw = String(resolved.mimeType || "").split(";", 1)[0].trim().toLowerCase();
  if (kind === "image" || kind === "mface") return raw.startsWith("image/") ? raw : "";
  if (kind === "audio") {
    if (raw.startsWith("audio/")) return raw;
    if (raw === "application/octet-stream" && String(resolved.source || "").includes("get_record")) return "audio/mpeg";
    return "";
  }
  if (kind === "video") return raw.startsWith("video/") ? raw : "";
  if (kind === "file") {
    if (raw === "application/pdf" || raw.startsWith("text/") || ["application/json", "application/rtf", "application/x-javascript", "application/x-typescript", "application/x-python-code"].includes(raw)) return raw;
    return "";
  }
  return "";
}

function safeIssue(error, { index = -1, kind = "unknown", stage = "compile" } = {}) {
  return Object.freeze({
    index,
    kind: String(kind || "unknown"),
    stage: String(error?.stage || stage || "compile"),
    code: String(error?.code || "MULTIMODAL_COMPILE_ERROR"),
    message: String(error?.message || error || "multimodal compile failed").slice(0, 240)
  });
}

function createCompileState(options = {}) {
  return {
    limits: compileLimits(options),
    strictMedia: options.strictMedia === true,
    parts: [],
    issues: [],
    totalInlineBytes: 0,
    mediaParts: 0,
    textChars: 0,
    textLimitReported: false
  };
}

function appendText(state, value) {
  const text = String(value || "");
  if (!text) return;
  const remaining = state.limits.maxTextChars - state.textChars;
  if (remaining <= 0) {
    if (!state.textLimitReported) {
      state.textLimitReported = true;
      state.issues.push(Object.freeze({ index: -1, kind: "text", stage: "compile", code: "MULTIMODAL_TEXT_TRUNCATED", message: "text input exceeded compiler limit" }));
    }
    return;
  }
  const clipped = text.slice(0, remaining);
  state.parts.push(Object.freeze({ text: clipped }));
  state.textChars += clipped.length;
  if (clipped.length < text.length && !state.textLimitReported) {
    state.textLimitReported = true;
    state.issues.push(Object.freeze({ index: -1, kind: "text", stage: "compile", code: "MULTIMODAL_TEXT_TRUNCATED", message: "text input exceeded compiler limit" }));
  }
}

function appendInline(state, resolved, kind, index) {
  const mimeType = modelMimeType(kind, resolved);
  if (!mimeType) throw new MultimodalCompileError("MULTIMODAL_MIME_UNSUPPORTED", "compile", `unsupported model MIME for ${kind}`, { index, kind, mimeType: String(resolved?.mimeType || "") });
  const size = Math.max(0, Number(resolved?.size || 0));
  if (!resolved?.base64) throw new MultimodalCompileError("MULTIMODAL_MEDIA_EMPTY", "compile", `resolved ${kind} has no bytes`, { index, kind });
  if (state.mediaParts >= state.limits.maxMediaParts) throw new MultimodalCompileError("MULTIMODAL_MEDIA_COUNT_EXCEEDED", "compile", "too many inline media parts", { index, kind, maxMediaParts: state.limits.maxMediaParts });
  if (state.totalInlineBytes + size > state.limits.maxInlineBytes) throw new MultimodalCompileError("MULTIMODAL_INLINE_BUDGET_EXCEEDED", "compile", "inline media request budget exceeded", { index, kind, size, totalInlineBytes: state.totalInlineBytes, maxInlineBytes: state.limits.maxInlineBytes });
  state.parts.push(Object.freeze({ inlineData: Object.freeze({ mimeType, data: String(resolved.base64) }) }));
  state.mediaParts += 1;
  state.totalInlineBytes += size;
}

async function resolveAndAppendMedia(state, part, context, deps, index) {
  try {
    const resolved = await resolveMediaPart(part, context, deps);
    if (part.kind === "mface") appendText(state, `[${mediaLabel(part)}]\n`);
    appendInline(state, resolved, part.kind, index);
  } catch (error) {
    const issue = safeIssue(error, { index, kind: part.kind, stage: "media_resolve" });
    state.issues.push(issue);
    if (state.strictMedia) throw new MultimodalCompileError("MULTIMODAL_MEDIA_RESOLVE_FAILED", issue.stage, issue.message, issue);
    appendText(state, `[${mediaLabel(part)}無法解析]\n`);
  }
}

async function appendForward(state, part, context, deps, index, depth) {
  if (depth > state.limits.maxForwardDepth) {
    appendText(state, "[巢狀合併轉發已省略]\n");
    state.issues.push(Object.freeze({ index, kind: "forward", stage: "compile", code: "MULTIMODAL_FORWARD_DEPTH_EXCEEDED", message: "nested forward depth exceeded" }));
    return;
  }
  let nodes = Array.isArray(part.nodes) && part.nodes.length ? part.nodes : null;
  if (!nodes) {
    try {
      const resolved = await resolveMediaPart(part, context, deps);
      nodes = resolved.nodes;
    } catch (error) {
      const issue = safeIssue(error, { index, kind: "forward", stage: "media_resolve" });
      state.issues.push(issue);
      if (state.strictMedia) throw new MultimodalCompileError("MULTIMODAL_FORWARD_RESOLVE_FAILED", issue.stage, issue.message, issue);
      appendText(state, "[合併轉發無法展開]\n");
      return;
    }
  }
  const bounded = (Array.isArray(nodes) ? nodes : []).slice(0, state.limits.maxForwardNodes);
  appendText(state, `[合併轉發開始，共 ${bounded.length} 則]\n`);
  for (let nodeIndex = 0; nodeIndex < bounded.length; nodeIndex += 1) {
    const node = bounded[nodeIndex] || {};
    const sender = String(node.nickname || node.userId || "未知");
    appendText(state, `\n[轉發 ${nodeIndex + 1}/${bounded.length}｜${sender}]\n`);
    const childParts = Array.isArray(node.parts) ? node.parts : [];
    for (let childIndex = 0; childIndex < childParts.length; childIndex += 1) {
      await appendCanonicalPart(state, childParts[childIndex], { ...context, messageId: "" }, deps, childIndex, depth + 1);
    }
  }
  appendText(state, "\n[合併轉發結束]\n");
}

async function appendCanonicalPart(state, part, context, deps, index, depth = 0) {
  if (!part || typeof part !== "object") return;
  switch (part.kind) {
    case "text": appendText(state, part.text); return;
    case "mention": appendText(state, part.all ? "@all" : `@${String(part.userId || "")}`); return;
    case "reply": appendText(state, `[引用訊息:${String(part.messageId || "")}]`); return;
    case "face": appendText(state, `[QQ內建表情 face_id=${String(part.faceId || "未知")}]`); return;
    case "image":
    case "audio":
    case "video":
    case "file":
    case "mface": await resolveAndAppendMedia(state, part, context, deps, index); return;
    case "forward": await appendForward(state, part, context, deps, index, depth); return;
    case "unknown": appendText(state, `[未支援 QQ 訊息:${String(part.onebotType || "unknown")}]`); return;
    default: appendText(state, `[未知訊息:${String(part.kind || "unknown")}]`);
  }
}

async function compileCanonicalMessageToGemini(message, deps = {}, options = {}) {
  if (!message || typeof message !== "object" || !Array.isArray(message.parts)) throw new MultimodalCompileError("MULTIMODAL_MESSAGE_REQUIRED", "compile");
  const state = createCompileState(options);
  const context = { messageId: String(message.messageId || ""), groupId: String(message.groupId || "") };
  for (let index = 0; index < message.parts.length; index += 1) await appendCanonicalPart(state, message.parts[index], context, deps, index, 0);
  const prompt = String(options.prompt || "").trim();
  if (prompt) appendText(state, `\n\n[使用者要求]\n${prompt}`);
  if (!state.parts.length) appendText(state, prompt || "請理解並回應這則 QQ 訊息。");
  const parts = Object.freeze(state.parts.slice());
  return Object.freeze({
    contents: Object.freeze([{ role: "user", parts }]),
    parts,
    issues: Object.freeze(state.issues.slice()),
    stats: Object.freeze({
      partCount: parts.length,
      mediaParts: state.mediaParts,
      totalInlineBytes: state.totalInlineBytes,
      textChars: state.textChars
    })
  });
}

export {
  DEFAULT_MULTIMODAL_LIMITS,
  MultimodalCompileError,
  appendCanonicalPart,
  compileCanonicalMessageToGemini,
  compileLimits,
  mediaLabel,
  modelMimeType,
  safeIssue
};