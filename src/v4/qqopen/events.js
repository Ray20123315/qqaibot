import { createCanonicalMessage } from "../../v3/message/core.js";

const QQ_OPEN_MESSAGE_EVENTS = Object.freeze(new Set([
  "C2C_MESSAGE_CREATE",
  "GROUP_AT_MESSAGE_CREATE",
  "GROUP_MESSAGE_CREATE",
  "AT_MESSAGE_CREATE",
  "DIRECT_MESSAGE_CREATE"
]));

function cleanString(value) { return String(value ?? "").trim(); }
function eventType(payload) { return cleanString(payload?.t || payload?.type).toUpperCase(); }
function eventData(payload) { return payload?.d && typeof payload.d === "object" ? payload.d : payload && typeof payload === "object" ? payload : {}; }
function timestampSeconds(value) {
  if (value === undefined || value === null || value === "") return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric > 1e12 ? Math.floor(numeric / 1000) : Math.floor(numeric);
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : null;
}
function normalizeRole(value) {
  const role = cleanString(value).toLowerCase();
  if (["owner", "admin", "member"].includes(role)) return role;
  return "member";
}
function authorId(data) {
  const author = data?.author && typeof data.author === "object" ? data.author : {};
  return cleanString(author.member_openid || author.user_openid || author.openid || author.id || data.member_openid || data.user_openid);
}
function senderName(data) {
  const author = data?.author && typeof data.author === "object" ? data.author : {};
  return cleanString(author.member_name || author.username || author.nickname || data.member_name || data.nickname);
}
function senderRole(data) {
  const author = data?.author && typeof data.author === "object" ? data.author : {};
  return normalizeRole(author.member_role || data.member_role || author.role);
}
function scopeFor(type, data) {
  if (type.startsWith("GROUP_")) return "group";
  if (type === "C2C_MESSAGE_CREATE" || type === "DIRECT_MESSAGE_CREATE") return "private";
  if (data.group_openid) return "group";
  return "unknown";
}
function attachmentKind(attachment = {}) {
  const contentType = cleanString(attachment.content_type || attachment.contentType || attachment.type).toLowerCase();
  if (contentType.startsWith("image/") || contentType === "image") return "image";
  if (contentType.startsWith("audio/") || ["audio", "voice", "record"].includes(contentType)) return "audio";
  if (contentType.startsWith("video/") || contentType === "video") return "video";
  return "file";
}
function attachmentPart(attachment = {}) {
  const kind = attachmentKind(attachment);
  const url = kind === "audio"
    ? cleanString(attachment.voice_wav_url || attachment.voiceWavUrl || attachment.url)
    : cleanString(attachment.url);
  return {
    kind,
    media: {
      fileId: cleanString(attachment.file_id || attachment.fileId || attachment.id),
      url,
      name: cleanString(attachment.filename || attachment.name),
      mimeType: cleanString(attachment.content_type || attachment.contentType || attachment.type),
      size: attachment.size ?? attachment.file_size ?? null
    }
  };
}
function normalizeAttachments(data) {
  const rows = Array.isArray(data?.attachments) ? data.attachments : [];
  const parts = [];
  for (const attachment of rows) {
    parts.push(attachmentPart(attachment));
    const asr = cleanString(attachment?.asr_refer_text || attachment?.asrReferText);
    if (asr) parts.push({ kind: "text", text: `【语音转写参考】${asr}` });
  }
  return parts;
}
function normalizeMentions(data) {
  const rows = Array.isArray(data?.mentions) ? data.mentions : [];
  const seen = new Set();
  const parts = [];
  for (const mention of rows) {
    const id = cleanString(mention?.member_openid || mention?.user_openid || mention?.openid || mention?.id);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    parts.push({ kind: "mention", userId: id, all: false, name: cleanString(mention?.username || mention?.nickname) });
  }
  return parts;
}
function normalizeReference(data) {
  const ref = data?.message_reference || data?.messageReference || data?.referenced_message || null;
  const id = cleanString(ref?.message_id || ref?.messageId || ref?.id);
  return id ? [{ kind: "reply", messageId: id }] : [];
}
function arkSummary(data) {
  const ark = data?.ark_data && typeof data.ark_data === "object" ? data.ark_data : null;
  if (!ark) return "";
  const fields = ark.fields && typeof ark.fields === "object" ? ark.fields : {};
  return [
    cleanString(ark.ark_name || ark.ark_type) ? `【卡片：${cleanString(ark.ark_name || ark.ark_type)}】` : "【卡片】",
    cleanString(ark.prompt),
    cleanString(fields.title),
    cleanString(fields.desc),
    cleanString(fields.address)
  ].filter(Boolean).join(" ");
}
function quotedElementParts(data) {
  const rows = Array.isArray(data?.msg_elements) ? data.msg_elements : [];
  const parts = [];
  let count = 0;
  for (const row of rows) {
    if (!row || typeof row !== "object" || count >= 8) continue;
    count += 1;
    const author = senderName(row) || authorId(row) || "未知成员";
    const body = cleanString(row.content) || arkSummary(row);
    if (body) parts.push({ kind: "text", text: `\n【引用 ${author}】${body}` });
    const attachments = Array.isArray(row.attachments) ? row.attachments : [];
    for (const attachment of attachments.slice(0, 8)) parts.push(attachmentPart(attachment));
  }
  return parts;
}
function normalizeQqOpenMessageParts(data) {
  const parts = [];
  parts.push(...normalizeReference(data));
  parts.push(...normalizeMentions(data));
  const content = String(data?.content ?? "");
  if (content) parts.push({ kind: "text", text: content });
  else {
    const card = arkSummary(data);
    if (card) parts.push({ kind: "text", text: card });
  }
  parts.push(...quotedElementParts(data));
  parts.push(...normalizeAttachments(data));
  return parts;
}
function fromQqOpenEvent(payload = {}) {
  const type = eventType(payload);
  if (!QQ_OPEN_MESSAGE_EVENTS.has(type)) return null;
  const data = eventData(payload);
  const scope = scopeFor(type, data);
  const groupId = scope === "group" ? cleanString(data.group_openid || data.group_id || data.guild_id || data.channel_id) : "";
  return createCanonicalMessage({
    platform: "qq-open",
    messageId: cleanString(data.id || data.message_id || payload.id),
    scope,
    groupId,
    userId: authorId(data),
    selfId: cleanString(data.self_openid || data.bot_openid),
    senderRole: senderRole(data),
    senderName: senderName(data),
    time: timestampSeconds(data.timestamp || data.time)
  }, normalizeQqOpenMessageParts(data));
}

export { QQ_OPEN_MESSAGE_EVENTS, fromQqOpenEvent, normalizeQqOpenMessageParts };
