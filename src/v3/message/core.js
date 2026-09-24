const MESSAGE_SCHEMA_VERSION = 1;

const MESSAGE_PART_KINDS = Object.freeze([
  "text",
  "mention",
  "reply",
  "image",
  "audio",
  "video",
  "file",
  "face",
  "mface",
  "forward",
  "unknown"
]);

function textValue(value) {
  return String(value ?? "");
}

function idValue(value) {
  if (value === undefined || value === null || value === "") return "";
  return String(value);
}

function numberOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function cleanMediaRef(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  const base64 = textValue(source.base64).replace(/^base64:\/\//i, "");
  return Object.freeze({
    file: textValue(source.file),
    fileId: textValue(source.fileId ?? source.file_id),
    url: textValue(source.url),
    path: textValue(source.path),
    name: textValue(source.name),
    mimeType: textValue(source.mimeType ?? source.mime_type),
    size: numberOrNull(source.size ?? source.file_size),
    base64
  });
}

function freezePart(part) {
  if (!part || typeof part !== "object") throw new Error("V3_MESSAGE_PART_INVALID");
  const kind = textValue(part.kind).trim().toLowerCase();
  if (!MESSAGE_PART_KINDS.includes(kind)) throw new Error(`V3_MESSAGE_PART_UNKNOWN:${kind}`);
  const out = { ...part, kind };
  if (["image", "audio", "video", "file"].includes(kind)) out.media = cleanMediaRef(part.media || part);
  if (kind === "mface" && part.media) out.media = cleanMediaRef(part.media);
  return Object.freeze(out);
}

function createCanonicalMessage(meta = {}, parts = []) {
  const scope = ["group", "private", "unknown"].includes(meta.scope) ? meta.scope : "unknown";
  const normalizedParts = Object.freeze((Array.isArray(parts) ? parts : []).map(freezePart));
  const message = {
    schemaVersion: MESSAGE_SCHEMA_VERSION,
    platform: "onebot",
    messageId: idValue(meta.messageId),
    scope,
    groupId: idValue(meta.groupId),
    userId: idValue(meta.userId),
    selfId: idValue(meta.selfId),
    senderRole: textValue(meta.senderRole || "member"),
    senderName: textValue(meta.senderName),
    time: numberOrNull(meta.time),
    parts: normalizedParts
  };
  return Object.freeze(message);
}

function canonicalPlainText(messageOrParts, { annotateMedia = true } = {}) {
  const parts = Array.isArray(messageOrParts) ? messageOrParts : messageOrParts?.parts;
  if (!Array.isArray(parts)) return "";
  const chunks = [];
  for (const part of parts) {
    if (!part) continue;
    if (part.kind === "text") chunks.push(textValue(part.text));
    else if (part.kind === "mention") chunks.push(part.all ? "@all" : `@${textValue(part.userId)}`);
    else if (part.kind === "face") chunks.push(`[表情:${textValue(part.faceId)}]`);
    else if (part.kind === "mface") chunks.push(`[商城表情:${textValue(part.summary || part.emojiId || "未知")}]`);
    else if (annotateMedia && part.kind === "image") chunks.push("[图片]");
    else if (annotateMedia && part.kind === "audio") chunks.push("[语音]");
    else if (annotateMedia && part.kind === "video") chunks.push("[视频]");
    else if (annotateMedia && part.kind === "file") chunks.push(`[文件:${textValue(part.media?.name || part.media?.file || "附件")}]`);
    else if (annotateMedia && part.kind === "forward") chunks.push("[合并转发]");
  }
  return chunks.join("").replace(/[ \t]+\n/g, "\n").trim();
}

function messageHasKind(messageOrParts, kind) {
  const parts = Array.isArray(messageOrParts) ? messageOrParts : messageOrParts?.parts;
  return Array.isArray(parts) && parts.some(part => part?.kind === kind);
}

function isMediaPart(part) {
  return ["image", "audio", "video", "file"].includes(part?.kind);
}

export {
  MESSAGE_PART_KINDS,
  MESSAGE_SCHEMA_VERSION,
  canonicalPlainText,
  cleanMediaRef,
  createCanonicalMessage,
  freezePart,
  isMediaPart,
  messageHasKind
};
