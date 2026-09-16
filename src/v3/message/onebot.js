import { cleanMediaRef, createCanonicalMessage, freezePart } from "./core.js";

function decodeCqValue(value) {
  return String(value ?? "")
    .replace(/&#44;/g, ",")
    .replace(/&#91;/g, "[")
    .replace(/&#93;/g, "]")
    .replace(/&amp;/g, "&");
}

function encodeCqValue(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/\[/g, "&#91;")
    .replace(/\]/g, "&#93;")
    .replace(/,/g, "&#44;");
}

function parseCqAttributes(raw) {
  const attrs = {};
  if (!raw) return attrs;
  for (const token of String(raw).split(",")) {
    const index = token.indexOf("=");
    if (index <= 0) continue;
    attrs[token.slice(0, index)] = decodeCqValue(token.slice(index + 1));
  }
  return attrs;
}

function parseCqMessage(input) {
  const raw = String(input ?? "");
  const segments = [];
  const re = /\[CQ:([a-zA-Z0-9_]+)(?:,([^\]]*))?\]/g;
  let cursor = 0;
  let match;
  while ((match = re.exec(raw))) {
    if (match.index > cursor) segments.push({ type: "text", data: { text: decodeCqValue(raw.slice(cursor, match.index)) } });
    segments.push({ type: match[1], data: parseCqAttributes(match[2] || "") });
    cursor = re.lastIndex;
  }
  if (cursor < raw.length) segments.push({ type: "text", data: { text: decodeCqValue(raw.slice(cursor)) } });
  if (!segments.length && raw) segments.push({ type: "text", data: { text: decodeCqValue(raw) } });
  return segments;
}

function normalizeMedia(data = {}) {
  return cleanMediaRef({
    file: data.file,
    fileId: data.file_id,
    url: data.url,
    path: data.path,
    name: data.name,
    mimeType: data.mime_type,
    size: data.file_size
  });
}

function isMarketFaceImage(data = {}) {
  return Boolean(data.emoji_id || data.emoji_package_id || data.key || String(data.file || "").toLowerCase() === "marketface");
}

function normalizeForwardContent(content) {
  if (!Array.isArray(content)) return [];
  return content.map(item => {
    const message = Array.isArray(item) || typeof item === "string"
      ? item
      : item?.message ?? item?.content ?? [];
    return Object.freeze({
      userId: String(item?.user_id ?? item?.userId ?? item?.sender?.user_id ?? ""),
      nickname: String(item?.nickname ?? item?.sender?.nickname ?? item?.name ?? ""),
      parts: Object.freeze(normalizeOneBotMessage(message))
    });
  });
}

function normalizeOneBotSegment(segment) {
  if (!segment || typeof segment !== "object") return freezePart({ kind: "unknown", onebotType: "invalid", data: segment });
  const type = String(segment.type || "").trim().toLowerCase();
  const data = segment.data && typeof segment.data === "object" ? segment.data : {};
  if (type === "text") return freezePart({ kind: "text", text: String(data.text ?? "") });
  if (type === "at") {
    const qq = String(data.qq ?? "");
    return freezePart({ kind: "mention", userId: qq === "all" ? "" : qq, all: qq === "all" });
  }
  if (type === "reply") return freezePart({ kind: "reply", messageId: String(data.id ?? "") });
  if (type === "face") return freezePart({
    kind: "face",
    faceId: String(data.id ?? ""),
    raw: data.raw ?? null,
    resultId: data.resultId === undefined ? "" : String(data.resultId),
    chainCount: Number.isFinite(Number(data.chainCount)) ? Number(data.chainCount) : null
  });
  if (type === "mface" || (type === "image" && isMarketFaceImage(data))) return freezePart({
    kind: "mface",
    emojiId: String(data.emoji_id ?? ""),
    packageId: String(data.emoji_package_id ?? ""),
    key: String(data.key ?? ""),
    summary: String(data.summary ?? data.name ?? ""),
    media: normalizeMedia(data)
  });
  if (type === "image") return freezePart({ kind: "image", summary: String(data.summary ?? ""), subType: data.sub_type ?? null, media: normalizeMedia(data) });
  if (type === "record" || type === "audio") return freezePart({ kind: "audio", media: normalizeMedia(data) });
  if (type === "video") return freezePart({ kind: "video", thumb: String(data.thumb ?? ""), media: normalizeMedia(data) });
  if (type === "file") return freezePart({ kind: "file", media: normalizeMedia(data) });
  if (type === "forward") return freezePart({ kind: "forward", forwardId: String(data.id ?? ""), nodes: normalizeForwardContent(data.content) });
  return freezePart({ kind: "unknown", onebotType: type || "unknown", data: { ...data } });
}

function normalizeOneBotMessage(message) {
  const segments = typeof message === "string" ? parseCqMessage(message) : Array.isArray(message) ? message : [];
  return segments.map(normalizeOneBotSegment);
}

function fromOneBotEvent(body = {}) {
  const scope = body.message_type === "group" ? "group" : body.message_type === "private" ? "private" : "unknown";
  return createCanonicalMessage({
    messageId: body.message_id,
    scope,
    groupId: body.group_id,
    userId: body.user_id,
    selfId: body.self_id,
    time: body.time
  }, normalizeOneBotMessage(body.message ?? body.raw_message ?? ""));
}

function outboundMediaFile(media, { allowLocalPath = false } = {}) {
  const ref = cleanMediaRef(media);
  if (ref.base64) return `base64://${ref.base64}`;
  if (/^https?:\/\//i.test(ref.url)) return ref.url;
  if (/^https?:\/\//i.test(ref.file) || /^base64:\/\//i.test(ref.file)) return ref.file;
  if (ref.file && !/^[/\\]|^[a-zA-Z]:[\\/]/.test(ref.file)) return ref.file;
  if (allowLocalPath && ref.path) return ref.path;
  if (allowLocalPath && ref.file) return ref.file;
  return "";
}

function mediaSegment(type, part, options) {
  const file = outboundMediaFile(part.media, options);
  if (!file) throw new Error(`V3_MEDIA_NO_SENDABLE_SOURCE:${type}`);
  const data = { file };
  if (part.media?.name) data.name = part.media.name;
  if (type === "image") {
    if (part.summary) data.summary = part.summary;
    if (part.subType !== null && part.subType !== undefined && part.subType !== "") data.sub_type = part.subType;
  }
  if (type === "video" && part.thumb) data.thumb = part.thumb;
  return { type, data };
}

function toOneBotSegment(part, options = {}) {
  switch (part?.kind) {
    case "text": return { type: "text", data: { text: String(part.text ?? "") } };
    case "mention": return { type: "at", data: { qq: part.all ? "all" : String(part.userId ?? "") } };
    case "reply": return { type: "reply", data: { id: String(part.messageId ?? "") } };
    case "face": return { type: "face", data: { id: String(part.faceId ?? "") } };
    case "mface": {
      if (part.emojiId && part.packageId) {
        const data = { emoji_id: String(part.emojiId), emoji_package_id: String(part.packageId) };
        if (part.key) data.key = String(part.key);
        if (part.summary) data.summary = String(part.summary);
        return { type: "mface", data };
      }
      if (part.media) return mediaSegment("image", part, options);
      throw new Error("V3_MFACE_MISSING_IDENTITY");
    }
    case "image": return mediaSegment("image", part, options);
    case "audio": return mediaSegment("record", part, options);
    case "video": return mediaSegment("video", part, options);
    case "file": return mediaSegment("file", part, options);
    case "forward": {
      if (!part.forwardId) throw new Error("V3_FORWARD_MISSING_ID");
      return { type: "forward", data: { id: String(part.forwardId) } };
    }
    case "unknown": return { type: String(part.onebotType || "unknown"), data: { ...(part.data || {}) } };
    default: throw new Error(`V3_MESSAGE_PART_UNRENDERABLE:${String(part?.kind || "")}`);
  }
}

function toOneBotSegments(messageOrParts, options = {}) {
  const parts = Array.isArray(messageOrParts) ? messageOrParts : messageOrParts?.parts;
  if (!Array.isArray(parts)) throw new Error("V3_MESSAGE_PARTS_REQUIRED");
  return parts.map(part => toOneBotSegment(part, options));
}

function toCqString(messageOrParts, options = {}) {
  return toOneBotSegments(messageOrParts, options).map(segment => {
    if (segment.type === "text") return encodeCqValue(segment.data?.text ?? "");
    const attrs = Object.entries(segment.data || {}).map(([key, value]) => `${key}=${encodeCqValue(value)}`).join(",");
    return `[CQ:${segment.type}${attrs ? `,${attrs}` : ""}]`;
  }).join("");
}

export {
  decodeCqValue,
  encodeCqValue,
  fromOneBotEvent,
  isMarketFaceImage,
  normalizeOneBotMessage,
  normalizeOneBotSegment,
  outboundMediaFile,
  parseCqAttributes,
  parseCqMessage,
  toCqString,
  toOneBotSegment,
  toOneBotSegments
};
