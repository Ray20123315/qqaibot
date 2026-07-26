// Extracted from worker.js without behavioral changes.
// Cloudflare still deploys worker.js as the single Worker entry point.

import { AI_MEDIA_LIMITS, DEFAULTS, VERSION } from "../config/runtime.js";
import { completeTextAtBoundary } from "../ai/conversation-quality.js";
import { neutralizeAiCommandPrefix } from "../core/identity.js";
import { appendIndex, callOneBotAction, writeSystemAudit } from "../core/permissions.js";
import { dbDel, dbGet, dbPut } from "../data/store.js";
import { getLiveGroupMemberList, sendGroupSelectedMentions } from "../group/runtime.js";
import { readJson, upsertGroupMember } from "../portal/auth.js";
import { fetchMediaAsBase64, numericId } from "../security/network.js";



async function runOneBotGroupOperation(env, action, params, audit) {
  if (!env.ONEBOT_ACCESS_TOKEN) return { ok: false, error: "尚未配置 ONEBOT_ACCESS_TOKEN" };
  try {
    const data = await callOneBotAction(env, { action, params }, 20000);
    await writeSystemAudit(env, { type: "group_operation", ...audit, params });
    return { ok: true, data };
  } catch (error) {
    await writeSystemAudit(env, { type: "group_operation_failed", ...audit, params, error: String(error.message || error) });
    return { ok: false, error: String(error.message || error) };
  }
}



async function purgeLegacyBotRepliesFromRecentLogs(env, groupId, botId) {
  const gid = String(groupId || "");
  const bid = String(botId || "");
  if (!gid || !bid) return;
  const doneKey = `cleanup:v027:recent_logs_bot_replies:${gid}`;
  if (await dbGet(env, doneKey)) return;
  const key = `recent_logs:${gid}`;
  const logs = await readJson(env, key, []);
  if (Array.isArray(logs) && logs.length) {
    const marker = `(QQ:${bid})]:`;
    const cleaned = logs.filter(line => !String(line || "").includes(marker));
    if (cleaned.length !== logs.length) await dbPut(env, key, JSON.stringify(cleaned.slice(-DEFAULTS.groupContextMaximumMessages)));
  }
  await dbPut(env, doneKey, String(Date.now()));
}



async function appendPortalConversationRecord(env, data) {
  const groupId = String(data.groupId || "");
  const messageId = String(data.messageId || `conv_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`);
  if (!groupId || !messageId) return null;
  const key = `conversation:${groupId}:${messageId}`;
  const existing = await readJson(env, key, null);
  const files = (Array.isArray(data.files) ? data.files : []).slice(0, 20).map(normalizeFileDescriptor);
  const media = (Array.isArray(data.media) ? data.media : []).slice(0, 20).map(item => ({ type: String(item?.type || ""), url: String(item?.url || "").slice(0, 2000), file: String(item?.file || "").slice(0, 1000) }));
  const forwardSnapshots = (Array.isArray(data.forwardSnapshots) ? data.forwardSnapshots : []).slice(0, AI_MEDIA_LIMITS.forwardBundles).map(item => ({
    id: String(item?.id || ""),
    text: String(item?.text || "").slice(0, AI_MEDIA_LIMITS.forwardTextChars),
    nodes: (Array.isArray(item?.nodes) ? item.nodes : []).slice(0, AI_MEDIA_LIMITS.forwardNodes).map(node => ({ senderName: String(node?.senderName || ""), senderId: String(node?.senderId || ""), text: String(node?.text || "").slice(0, 4000), time: Number(node?.time || 0) || 0 })),
    media: (Array.isArray(item?.media) ? item.media : []).slice(0, 20),
    error: String(item?.error || "").slice(0, 500),
    truncated: Boolean(item?.truncated)
  }));
  const item = {
    ...(existing || {}),
    id: messageId,
    messageId,
    groupId,
    userId: String(data.userId || existing?.userId || ""),
    senderName: String(data.senderName || existing?.senderName || data.userId || "").slice(0, 160),
    senderRole: String(data.senderRole || existing?.senderRole || "member"),
    text: String(data.text || existing?.text || "").slice(0, 8000),
    mentions: [...new Set((Array.isArray(data.mentions) ? data.mentions : existing?.mentions || []).map(String))].slice(0, 100),
    replyId: String(data.replyId || existing?.replyId || ""),
    files,
    media,
    forwardIds: [...new Set((Array.isArray(data.forwardIds) ? data.forwardIds : existing?.forwardIds || []).map(String))].slice(0, AI_MEDIA_LIMITS.forwardBundles),
    forwardSnapshots,
    createdAt: Number(existing?.createdAt || data.createdAt || Date.now()),
    updatedAt: Date.now(),
    source: "group_member"
  };
  await dbPut(env, key, JSON.stringify(item));
  await appendIndex(env, `conversation:index:${groupId}`, messageId, AI_MEDIA_LIMITS.conversationRecords);
  return item;
}



async function updatePortalConversationRecord(env, groupId, messageId, patch) {
  const key = `conversation:${String(groupId || "")}:${String(messageId || "")}`;
  const item = await readJson(env, key, null);
  if (!item) return null;
  const next = { ...item, ...patch, updatedAt: Date.now() };
  await dbPut(env, key, JSON.stringify(next));
  return next;
}



async function sendGroupRoleMentions(env, { groupId, roles, text, replyId = "", actionKey = "members" }) {
  const members = await getLiveGroupMemberList(env, groupId);
  const roleSet = new Set((roles || []).map(String));
  const recipients = members.filter(item => roleSet.has(item.role) && !item.isRobot).map(item => item.qq);
  if (!recipients.length) throw new Error("没有找到符合角色的群成员");
  return sendGroupSelectedMentions(env, { groupId, qqs: recipients, text, replyId, actionKey });
}



async function recordStructuredMessage(env, item) {
  const record = {
    messageId: String(item.messageId || ""), groupId: String(item.groupId || ""),
    senderId: String(item.senderId || item.userId || ""), senderName: String(item.senderName || item.senderId || item.userId || ""),
    text: String(item.text || ""), mentions: item.mentions || [], replyId: item.replyId || "",
    source: item.source || "human", createdAt: Date.now()
  };
  if (record.messageId) await dbPut(env, `message:${record.groupId}:${record.messageId}`, JSON.stringify(record));
  // 指令回覆、白名單提示、權限提示與其他系統訊息只保留引用辨識所需的 message metadata，
  // 不加入 recent_logs，也不成為模仿、摘要、衝突判斷或後續 AI 聊天的語料。
  if (record.groupId && item.includeInRecentLogs !== false) {
    const key = `recent_logs:${record.groupId}`;
    const logs = await readJson(env, key, []);
    logs.push(`[${record.senderName}(QQ:${record.senderId})]: ${record.text}`);
    await dbPut(env, key, JSON.stringify(logs.slice(-200)));
  }
  return record;
}



function extractOutboundMediaTypes(message) {
  const types = new Set();
  const scan = value => {
    const text = String(value || "");
    if (/\[CQ:image,/i.test(text)) types.add("image");
    if (/\[CQ:record,/i.test(text)) types.add("record");
    if (/\[CQ:video,/i.test(text)) types.add("video");
  };
  if (typeof message === "string") scan(message);
  else if (Array.isArray(message)) for (const part of message) {
    if (["image", "record", "video"].includes(part?.type)) types.add(part.type);
    if (part?.type === "text") scan(part.data?.text);
  }
  return [...types].sort();
}



function decodeCqValue(value) {
  return String(value || "")
    .replace(/&#44;/g, ",")
    .replace(/&#91;/g, "[")
    .replace(/&#93;/g, "]")
    .replace(/&amp;/g, "&");
}



function parseCqAttributes(raw) {
  const attrs = {};
  for (const item of String(raw || "").split(",")) {
    const index = item.indexOf("=");
    if (index <= 0) continue;
    attrs[item.slice(0, index).trim()] = decodeCqValue(item.slice(index + 1));
  }
  return attrs;
}



function extractMediaDescriptor(message, type) {
  if (Array.isArray(message)) {
    const part = message.find(item => item?.type === type);
    return { url: String(part?.data?.url || "") || null, file: String(part?.data?.file || "") || null };
  }
  const match = String(message || "").match(new RegExp(`\\[CQ:${type},([^\\]]+)\\]`, "i"));
  if (!match) return { url: null, file: null };
  const attrs = parseCqAttributes(match[1]);
  return { url: attrs.url || null, file: attrs.file || null };
}



function normalizeFileDescriptor(data) {
  const item = data && typeof data === "object" ? data : {};
  return {
    name: String(item.name || item.file_name || item.filename || item.file || "").slice(0, 240),
    file: String(item.file || item.file_id || item.id || "").slice(0, 1000),
    url: String(item.url || item.file_url || "").slice(0, 2000),
    size: Math.max(0, Number(item.size || item.file_size || 0) || 0),
    busid: String(item.busid || item.bus_id || "").slice(0, 120)
  };
}



function safeAttachmentFilename(value, fallback = "attachment") {
  const cleaned = String(value || fallback)
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[\\/:*?"<>|]/g, "_")
    .trim()
    .slice(0, 180);
  return cleaned || fallback;
}



function guessAttachmentMime(name, type = "") {
  const lower = String(name || "").toLowerCase();
  const kind = String(type || "").toLowerCase();
  if (kind === "image") {
    if (/\.gif$/i.test(lower)) return "image/gif";
    if (/\.png$/i.test(lower)) return "image/png";
    if (/\.webp$/i.test(lower)) return "image/webp";
    if (/\.bmp$/i.test(lower)) return "image/bmp";
    return "image/jpeg";
  }
  if (kind === "video") return /\.webm$/i.test(lower) ? "video/webm" : "video/mp4";
  if (kind === "record" || kind === "audio") {
    if (/\.ogg$/i.test(lower)) return "audio/ogg";
    if (/\.wav$/i.test(lower)) return "audio/wav";
    if (/\.m4a$/i.test(lower)) return "audio/mp4";
    return "audio/mpeg";
  }
  if (/\.pdf$/i.test(lower)) return "application/pdf";
  if (/\.txt$/i.test(lower)) return "text/plain; charset=utf-8";
  if (/\.json$/i.test(lower)) return "application/json";
  if (/\.zip$/i.test(lower)) return "application/zip";
  return "application/octet-stream";
}



function allMediaDescriptors(message, wantedType) {
  const type = String(wantedType || "").toLowerCase();
  if (Array.isArray(message)) {
    return message
      .filter(part => String(part?.type || "").toLowerCase() === type)
      .map(part => ({
        type,
        url: String(part?.data?.url || part?.data?.file_url || ""),
        file: String(part?.data?.file || part?.data?.file_id || ""),
        name: String(part?.data?.name || part?.data?.file_name || part?.data?.file || "")
      }));
  }
  const result = [];
  const regex = new RegExp(`\\[CQ:${type},([^\\]]+)\\]`, "gi");
  for (const match of String(message || "").matchAll(regex)) {
    const attrs = parseCqAttributes(match[1]);
    result.push({
      type,
      url: String(attrs.url || attrs.file_url || ""),
      file: String(attrs.file || attrs.file_id || ""),
      name: String(attrs.name || attrs.file_name || attrs.file || "")
    });
  }
  return result;
}



async function refreshConversationAttachmentDescriptor(env, record, source, index) {
  const list = source === "files" ? (record.files || []) : (record.media || []);
  const descriptor = list[index];
  if (!descriptor) throw new Error("找不到附件记录");
  const type = source === "files" ? "file" : String(descriptor.type || "").toLowerCase();
  let freshUrl = "";

  if (source === "media" && descriptor.file) {
    try {
      if (type === "image") {
        const data = await callOneBotAction(env, { action: "get_image", params: { file: descriptor.file } }, 15000);
        freshUrl = String(data?.url || data?.file_url || "").trim();
      } else if (type === "record" || type === "audio") {
        const data = await callOneBotAction(env, { action: "get_record", params: { file: descriptor.file, out_format: "mp3" } }, 15000);
        freshUrl = String(data?.url || data?.file_url || "").trim();
      }
    } catch {}
  }

  if (!/^https?:\/\//i.test(freshUrl) && record.messageId) {
    try {
      const data = await callOneBotAction(env, { action: "get_msg", params: { message_id: numericId(record.messageId) } }, 15000);
      if (source === "media") {
        const candidates = allMediaDescriptors(data?.message || data?.raw_message || "", type);
        const sameFile = candidates.find(item => descriptor.file && item.file === descriptor.file);
        const candidate = sameFile || candidates[index] || candidates[0];
        freshUrl = String(candidate?.url || "").trim();
        if (candidate?.file && !descriptor.file) descriptor.file = candidate.file;
      } else {
        const freshFiles = extractFileDescriptors(data?.message || data?.raw_message || "");
        const sameFile = freshFiles.find(item => descriptor.file && item.file === descriptor.file);
        const candidate = sameFile || freshFiles[index] || freshFiles[0];
        freshUrl = String(candidate?.url || "").trim();
      }
    } catch {}
  }

  if (!/^https?:\/\//i.test(freshUrl) && source === "files" && descriptor.file) {
    try {
      const data = await callOneBotAction(env, {
        action: "get_group_file_url",
        params: {
          group_id: numericId(record.groupId),
          group: String(record.groupId),
          file_id: descriptor.file,
          busid: descriptor.busid || undefined
        }
      }, 15000);
      freshUrl = String(data?.url || data?.file_url || "").trim();
    } catch {}
  }

  if (!/^https?:\/\//i.test(freshUrl)) throw new Error("NapCat 无法刷新附件直链；附件可能已过期或资源缓存已清理");

  const nextList = list.map((item, i) => i === index ? { ...item, url: freshUrl, refreshedAt: Date.now() } : item);
  if (source === "files") await updatePortalConversationRecord(env, record.groupId, record.messageId, { files: nextList });
  else await updatePortalConversationRecord(env, record.groupId, record.messageId, { media: nextList });
  return { ...descriptor, url: freshUrl };
}



async function fetchConversationAttachmentResponse(env, record, source, index, download = false) {
  const list = source === "files" ? (record.files || []) : (record.media || []);
  let descriptor = list[index];
  if (!descriptor) return new Response("找不到附件。", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });

  const type = source === "files" ? "file" : String(descriptor.type || "").toLowerCase();
  const filename = safeAttachmentFilename(descriptor.name || descriptor.file || `${type || "attachment"}-${record.messageId}`);
  const maxBytes = type === "image" ? 16 * 1024 * 1024
    : (type === "record" || type === "audio") ? 24 * 1024 * 1024
    : type === "video" ? 100 * 1024 * 1024
    : 100 * 1024 * 1024;

  const tryFetch = async value => {
    const remoteUrl = String(value || "").trim();
    if (!/^https?:\/\//i.test(remoteUrl)) return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort("timeout"), 20000);
    try {
      const response = await fetch(remoteUrl, {
        redirect: "follow",
        headers: {
          "Accept": "*/*",
          "User-Agent": `QQAIbot/${VERSION} attachment-proxy`
        },
        signal: controller.signal
      });
      if (!response.ok) {
        try { await response.body?.cancel(); } catch {}
        return null;
      }
      const length = Number(response.headers.get("Content-Length") || 0);
      if (length > maxBytes) {
        try { await response.body?.cancel(); } catch {}
        throw new Error(`附件超过 Portal 代理上限 ${Math.round(maxBytes / 1024 / 1024)} MiB`);
      }
      return response;
    } finally {
      clearTimeout(timer);
    }
  };

  let response = await tryFetch(descriptor.url);
  if (!response) {
    try {
      descriptor = await refreshConversationAttachmentDescriptor(env, record, source, index);
      response = await tryFetch(descriptor.url);
    } catch (error) {
      return new Response(`附件加载失败：${String(error?.message || error)}。请确认 NapCat 在线后重试。`, {
        status: 410,
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }
      });
    }
  }
  if (!response) {
    return new Response("附件加载失败：来源服务器拒绝访问或链接已过期。", {
      status: 410,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }
    });
  }

  const headers = new Headers();
  const contentType = response.headers.get("Content-Type") || guessAttachmentMime(filename, type);
  headers.set("Content-Type", contentType);
  headers.set("Cache-Control", "private, no-store, max-age=0");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Content-Disposition", `${download ? "attachment" : "inline"}; filename="attachment"; filename*=UTF-8''${encodeURIComponent(filename)}`);
  const contentLength = response.headers.get("Content-Length");
  if (contentLength) headers.set("Content-Length", contentLength);
  return new Response(response.body, { status: 200, headers });
}



function extractFileDescriptors(message) {
  if (Array.isArray(message)) return message.filter(item => item?.type === "file").map(item => normalizeFileDescriptor(item.data || {}));
  const rows = [];
  const regex = /\[CQ:file,([^\]]+)\]/gi;
  for (const match of String(message || "").matchAll(regex)) rows.push(normalizeFileDescriptor(parseCqAttributes(match[1])));
  return rows;
}



function detectLiteralPseudoElementLabels(value) {
  const source = String(value || "");
  const labels = [];
  const regex = /[\[［](聊天记录|聊天紀錄|聊天記錄|转发消息|轉發消息|轉發訊息|合并转发|合併轉發|图片|圖片|语音|語音|视频|影片|文件|附件)[\]］]/gi;
  for (const match of source.matchAll(regex)) labels.push(match[0]);
  return [...new Set(labels)].slice(0, 12);
}



function extractForwardIds(message) {
  const ids = [];
  if (Array.isArray(message)) {
    for (const part of message) {
      if (part?.type !== "forward") continue;
      const id = String(part.data?.id || part.data?.message_id || part.data?.res_id || "").trim();
      if (id) ids.push(id);
    }
  } else {
    const regex = /\[CQ:forward,([^\]]+)\]/gi;
    for (const match of String(message || "").matchAll(regex)) {
      const attrs = parseCqAttributes(match[1]);
      const id = String(attrs.id || attrs.message_id || attrs.res_id || "").trim();
      if (id) ids.push(id);
    }
  }
  return [...new Set(ids)].slice(0, AI_MEDIA_LIMITS.forwardBundles);
}



function oneBotContentText(content, depth = 0) {
  if (depth > 3) return "[嵌套内容过深]";
  if (typeof content === "string") return content
    .replace(/\[CQ:at,[^\]]*qq=(\d+|all)[^\]]*\]/gi, (_, qq) => qq === "all" ? "@全体成员" : `@${qq}`)
    .replace(/\[CQ:image,[^\]]+\]/gi, "[图片]")
    .replace(/\[CQ:record,[^\]]+\]/gi, "[语音]")
    .replace(/\[CQ:video,[^\]]+\]/gi, "[视频]")
    .replace(/\[CQ:file,[^\]]+\]/gi, "[文件]")
    .replace(/\[CQ:forward,[^\]]+\]/gi, "[嵌套转发]")
    .replace(/\[CQ:reply,[^\]]+\]/gi, "")
    .replace(/\[CQ:[^\]]+\]/g, "")
    .replace(/\s+/g, " ").trim();
  if (!Array.isArray(content)) return "";
  return content.map(part => {
    const type = String(part?.type || "");
    const data = part?.data || {};
    if (type === "text") return String(data.text || "");
    if (type === "at") return String(data.qq) === "all" ? "@全体成员" : `@${data.qq || ""}`;
    if (type === "image") return "[图片]";
    if (type === "record") return "[语音]";
    if (type === "video") return "[视频]";
    if (type === "file") return `[文件：${data.name || data.file_name || data.file || "未命名"}]`;
    if (type === "forward") return "[嵌套转发]";
    if (type === "reply") return "";
    if (type === "face") return `[表情${data.id ? ` ${data.id}` : ""}]`;
    if (type === "json") return "[卡片消息]";
    if (type === "node") return oneBotContentText(data.content || data.message || [], depth + 1);
    return type ? `[${type}]` : "";
  }).join("").replace(/\s+/g, " ").trim();
}



function collectOneBotMedia(content, depth = 0, output = []) {
  if (depth > 3 || output.length >= 20) return output;
  if (typeof content === "string") {
    for (const type of ["image", "record", "video"]) {
      const regex = new RegExp(`\\[CQ:${type},([^\\]]+)\\]`, "gi");
      for (const match of String(content).matchAll(regex)) {
        const attrs = parseCqAttributes(match[1]);
        output.push({ type, url: String(attrs.url || ""), file: String(attrs.file || "") });
        if (output.length >= 20) break;
      }
    }
    return output;
  }
  if (!Array.isArray(content)) return output;
  for (const part of content) {
    const type = String(part?.type || "");
    const data = part?.data || {};
    if (["image", "record", "video"].includes(type)) output.push({ type, url: String(data.url || ""), file: String(data.file || "") });
    if (type === "node") collectOneBotMedia(data.content || data.message || [], depth + 1, output);
    if (output.length >= 20) break;
  }
  return output;
}



function normalizeForwardNodeList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.messages)) return payload.messages;
  if (Array.isArray(payload?.data?.messages)) return payload.data.messages;
  if (Array.isArray(payload?.message)) return payload.message;
  return [];
}



async function getForwardMessageSnapshot(env, forwardId) {
  const id = String(forwardId || "").trim();
  if (!id) return null;
  const cacheKey = `forward_snapshot:${id}`;
  const cached = await readJson(env, cacheKey, null);
  if (cached && Date.now() - Number(cached.cachedAt || 0) < 10 * 60 * 1000) return cached;
  const payload = await callOneBotAction(env, { action: "get_forward_msg", params: { message_id: id } }, 20000);
  const source = normalizeForwardNodeList(payload);
  const nodes = [];
  const media = [];
  let totalChars = 0;
  let truncated = source.length > AI_MEDIA_LIMITS.forwardNodes;
  for (const raw of source.slice(0, AI_MEDIA_LIMITS.forwardNodes)) {
    const sender = raw?.sender || raw?.data?.sender || {};
    const senderName = String(sender.nickname || sender.card || raw?.name || raw?.nickname || "未知成员").slice(0, 120);
    const senderId = String(sender.user_id || sender.uin || raw?.uin || raw?.user_id || "").slice(0, 40);
    const content = raw?.content ?? raw?.message ?? raw?.data?.content ?? raw?.data?.message ?? [];
    let nodeText = oneBotContentText(content).slice(0, 4000);
    if (totalChars + nodeText.length > AI_MEDIA_LIMITS.forwardTextChars) {
      nodeText = nodeText.slice(0, Math.max(0, AI_MEDIA_LIMITS.forwardTextChars - totalChars));
      truncated = true;
    }
    totalChars += nodeText.length;
    const nodeMedia = collectOneBotMedia(content).slice(0, 10);
    media.push(...nodeMedia);
    nodes.push({ senderName, senderId, text: nodeText, media: nodeMedia, time: Number(raw?.time || raw?.data?.time || 0) || 0 });
    if (totalChars >= AI_MEDIA_LIMITS.forwardTextChars) break;
  }
  const text = nodes.map((node, index) => `${index + 1}. ${node.senderName}${node.senderId ? `（QQ:${node.senderId}）` : ""}：${node.text || "[无文字内容]"}`).join("\n").slice(0, AI_MEDIA_LIMITS.forwardTextChars);
  const snapshot = { id, nodes, text, media: media.slice(0, 20), truncated, cachedAt: Date.now() };
  await dbPut(env, cacheKey, JSON.stringify(snapshot));
  return snapshot;
}



function formatForwardContext(snapshots) {
  const blocks = [];
  for (const item of Array.isArray(snapshots) ? snapshots : []) {
    if (item?.error) blocks.push(`【合并转发 ${item.id || ""} 读取失败】${item.error}`);
    else blocks.push(`【合并转发内容${item?.truncated ? "（已截断）" : ""}】\n${String(item?.text || "[无可读取文字]").slice(0, AI_MEDIA_LIMITS.forwardTextChars)}`);
  }
  return blocks.join("\n\n").slice(0, AI_MEDIA_LIMITS.forwardTextChars);
}



async function decodeInlineMedia(value, maxBytes, allowedPrefixes) {
  const text = String(value || "");
  let mimeType = "application/octet-stream";
  let base64 = "";
  if (text.startsWith("base64://")) {
    base64 = text.slice(9);
  } else {
    const match = text.match(/^data:([^;,]+);base64,(.+)$/s);
    if (!match) return null;
    mimeType = match[1].toLowerCase();
    base64 = match[2];
  }
  if (!allowedPrefixes.some(prefix => mimeType.startsWith(prefix)) && mimeType !== "application/octet-stream") throw new Error(`不支持的媒体类型：${mimeType}`);
  const estimated = Math.floor(base64.length * 3 / 4);
  if (estimated > maxBytes) throw new Error("媒体文件过大");
  return { base64, mimeType, size: estimated };
}



async function resolveOneBotMediaAsBase64(env, descriptor, kind, maxBytes, allowedPrefixes) {
  const url = String(descriptor?.url || "").trim();
  const file = String(descriptor?.file || "").trim();
  for (const value of [url, file]) {
    if (!value) continue;
    const inline = await decodeInlineMedia(value, maxBytes, allowedPrefixes);
    if (inline) return inline;
    if (/^https?:\/\//i.test(value)) return fetchMediaAsBase64(value, maxBytes, allowedPrefixes);
  }
  if (file && kind === "image") {
    const data = await callOneBotAction(env, { action: "get_image", params: { file } }, 15000);
    const remoteUrl = String(data?.url || "").trim();
    if (/^https?:\/\//i.test(remoteUrl)) return fetchMediaAsBase64(remoteUrl, maxBytes, allowedPrefixes);
    throw new Error("get_image 未返回公网 URL");
  }
  if (file && kind === "record") {
    const data = await callOneBotAction(env, { action: "get_record", params: { file, out_format: "mp3" } }, 15000);
    const remoteUrl = String(data?.url || "").trim();
    if (/^https?:\/\//i.test(remoteUrl)) return fetchMediaAsBase64(remoteUrl, maxBytes, allowedPrefixes);
    throw new Error("get_record 未返回公网 URL");
  }
  throw new Error("媒体只有 NapCat 本机路径，Cloudflare 无法直接读取");
}



function extractMessageText(message) {
  if (typeof message === "string") return message
    .replace(/\[CQ:at,[^\]]*qq=(\d+|all)[^\]]*\]/g, "@$1")
    .replace(/\[CQ:image,[^\]]+\]/g, "[图片]")
    .replace(/\[CQ:record,[^\]]+\]/g, "[语音]")
    .replace(/\[CQ:video,[^\]]+\]/g, "[视频]")
    .replace(/\[CQ:file,[^\]]+\]/g, "[文件]")
    .replace(/\[CQ:forward,[^\]]+\]/g, "[转发消息]")
    .replace(/\[CQ:face,[^\]]*id=([^,\]]+)[^\]]*\]/g, "[表情:$1]")
    .replace(/\[CQ:face,[^\]]+\]/g, "[表情]")
    .replace(/\[CQ:reply,[^\]]+\]/g, "")
    .replace(/\[CQ:[^\]]+\]/g, "")
    .trim();
  if (!Array.isArray(message)) return "";
  return message.map(part => part?.type === "text" ? String(part.data?.text || "") : part?.type === "at" ? `@${part.data?.qq || ""}` : part?.type === "image" ? "[图片]" : part?.type === "record" ? "[语音]" : part?.type === "video" ? "[视频]" : part?.type === "file" ? `[文件：${part.data?.name || part.data?.file_name || part.data?.file || "未命名"}]` : part?.type === "forward" ? "[转发消息]" : part?.type === "face" ? `[表情:${String(part.data?.id || part.data?.face_id || "").trim() || "未知"}]` : "").join("").trim();
}



function eventMentionedQqs(body) {
  const ids = [];
  const message = body?.message;
  if (Array.isArray(message)) {
    for (const part of message) {
      if (String(part?.type || "").toLowerCase() !== "at") continue;
      const value = part?.data?.qq ?? part?.data?.user_id ?? part?.data?.target_id ?? part?.data?.id;
      if (value !== undefined && value !== null && String(value).trim()) ids.push(String(value).trim());
    }
  }
  const raw = String(body?.raw_message || (typeof message === "string" ? message : ""));
  for (const match of raw.matchAll(/\[CQ:at,[^\]]*qq=([^,\]]+)[^\]]*\]/gi)) ids.push(String(match[1] || "").trim());
  return [...new Set(ids.filter(Boolean))];
}



function qqaiTruthyRobotFlag(value) {
  if (value === true || value === 1) return true;
  return ["1", "true", "yes", "bot", "robot"].includes(String(value ?? "").trim().toLowerCase());
}



function eventSenderDisplayName(body) {
  return String(body?.sender?.card || body?.sender?.nickname || body?.sender?.name || body?.nickname || "").trim();
}



function eventSenderRobotHint(body) {
  return [
    body?.sender?.is_robot, body?.sender?.isRobot, body?.sender?.robot, body?.sender?.bot,
    body?.is_robot, body?.isRobot, body?.robot, body?.bot
  ].some(qqaiTruthyRobotFlag);
}



function looksLikeRobotDisplayName(value) {
  const name = String(value || "").trim();
  if (!name) return false;
  if (/^(?:Q群管家|QQ群管家|QQ群管家|群机器人|群機器人|QQ机器人|QQ機器人)$/i.test(name)) return true;
  if (/(?:机器人|機器人|自动管家|自動管家|智能管家|群管家)$/i.test(name)) return true;
  return /(?:^|[\s_\-])(bot|robot)(?:$|[\s_\-])/i.test(name);
}



function botInteractionAllowKey(groupId, userId) {
  return `bot_interaction_allow:${String(groupId || "")}:${String(userId || "")}`;
}



function botSenderCacheKey(groupId, userId) {
  return `bot_sender_cache:${String(groupId || "")}:${String(userId || "")}`;
}



async function cacheBotSenderClassification(env, groupId, userId, isRobot, source = "unknown") {
  const ttlMs = isRobot ? 7 * 24 * 60 * 60 * 1000 : 6 * 60 * 60 * 1000;
  await dbPut(env, botSenderCacheKey(groupId, userId), JSON.stringify({ isRobot: Boolean(isRobot), source, at: Date.now(), expiresAt: Date.now() + ttlMs }));
}



async function isGroupRobotInteractionAllowed(env, groupId, userId) {
  return await dbGet(env, botInteractionAllowKey(groupId, userId)) === "true";
}



async function isIgnoredGroupRobotSender(env, body, { probe = false } = {}) {
  if (!body || body.message_type !== "group" || !["message", "message_sent"].includes(String(body.post_type || ""))) return false;
  const groupId = String(body.group_id || "");
  const userId = String(body.user_id || "");
  const selfId = String(body.self_id || "");
  if (!groupId || !userId || userId === selfId) return false;
  if (await isGroupRobotInteractionAllowed(env, groupId, userId)) return false;

  const senderName = eventSenderDisplayName(body);
  if (eventSenderRobotHint(body) || looksLikeRobotDisplayName(senderName)) {
    await cacheBotSenderClassification(env, groupId, userId, true, eventSenderRobotHint(body) ? "event_flag" : "display_name").catch(() => {});
    return true;
  }

  const cachedRaw = await dbGet(env, botSenderCacheKey(groupId, userId));
  if (cachedRaw) {
    try {
      const cached = JSON.parse(cachedRaw);
      if (Number(cached?.expiresAt || 0) > Date.now()) return Boolean(cached?.isRobot);
    } catch {}
  }

  const members = await readJson(env, `group_members:${groupId}`, []);
  const cachedMember = members.find(item => String(item?.qq || item?.user_id || "") === userId);
  if (cachedMember && (qqaiTruthyRobotFlag(cachedMember.isRobot) || qqaiTruthyRobotFlag(cachedMember.is_robot))) {
    await cacheBotSenderClassification(env, groupId, userId, true, "member_cache").catch(() => {});
    return true;
  }

  if (!probe) return false;
  try {
    const member = await callOneBotAction(env, {
      action: "get_group_member_info",
      params: { group_id: numericId(groupId), user_id: numericId(userId), no_cache: false }
    }, 5000);
    const robot = qqaiTruthyRobotFlag(member?.is_robot) || qqaiTruthyRobotFlag(member?.isRobot) || looksLikeRobotDisplayName(member?.card || member?.nickname || senderName);
    await cacheBotSenderClassification(env, groupId, userId, robot, "member_probe").catch(() => {});
    if (robot) {
      await upsertGroupMember(env, groupId, {
        qq: userId,
        name: String(member?.card || member?.nickname || senderName || userId),
        role: String(member?.role || body?.sender?.role || "member"),
        isRobot: true,
        groupName: String(body?.group_name || groupId)
      }).catch(() => {});
    }
    return robot;
  } catch {
    await cacheBotSenderClassification(env, groupId, userId, false, "probe_unavailable").catch(() => {});
    return false;
  }
}



async function filterRobotMentionIds(env, groupId, ids) {
  const output = [];
  for (const id of [...new Set((ids || []).map(String).filter(Boolean))].slice(0, 12)) {
    if (await isGroupRobotInteractionAllowed(env, groupId, id)) {
      output.push(id);
      continue;
    }
    const ignored = await isIgnoredGroupRobotSender(env, {
      post_type: "message", message_type: "group", group_id: groupId, user_id: id, self_id: "",
      sender: {}
    }, { probe: true });
    if (!ignored) output.push(id);
  }
  return output;
}



async function auditIgnoredRobotMessage(env, body, source = "bot_sender_guard") {
  const groupId = String(body?.group_id || "");
  const userId = String(body?.user_id || "");
  if (!groupId || !userId) return;
  const throttleKey = `bot_sender_audit:${groupId}:${userId}`;
  const lastAt = Number(await dbGet(env, throttleKey) || 0);
  if (lastAt && Date.now() - lastAt < 5 * 60 * 1000) return;
  await dbPut(env, throttleKey, String(Date.now()));
  await writeSystemAudit(env, {
    type: "bot_message_ignored", groupId, actorId: userId, action: source,
    senderName: eventSenderDisplayName(body), messageId: String(body?.message_id || ""),
    mentionedBot: eventHasBotMention(body)
  });
}



function eventHasBotMention(body) {
  const selfId = String(body?.self_id || "");
  return Boolean(selfId && eventMentionedQqs(body).includes(selfId));
}



function eventPlainText(body) {
  const message = body?.message;
  const text = extractMessageText(message || body?.raw_message || "");
  return String(text || "").replace(/@(?:all|\d{5,})/gi, " ").replace(/\s+/g, " ").trim();
}



async function hasOutboundMessageMarker(env, messageId) {
  if (!messageId) return false;
  const raw = await dbGet(env, `outbound:${messageId}`);
  if (!raw) return false;
  try {
    const item = JSON.parse(raw);
    return Date.now() - Number(item?.at || 0) < 10 * 60 * 1000;
  } catch {
    return true;
  }
}



async function normalizeQuotedMessageSource(env, obj, botId, messageId) {
  if (!obj || typeof obj !== "object") return obj;
  const result = { ...obj };
  const senderId = String(result.senderId || "");
  const selfId = String(botId || result.selfId || "");
  const source = String(result.source || "unknown");

  // 新版由 Worker 自己写入的 AI 记录会固定使用 senderName=QQAI；这是可信来源。
  if (source === "ai" && String(result.senderName || "") === "QQAI") return result;
  if (source === "owner-human") return result;

  const outbound = await hasOutboundMessageMarker(env, messageId || result.messageId);
  if (outbound) {
    result.source = "ai";
    result.sourceConfidence = "outbound-message-id";
    return result;
  }

  // 同 QQ 模式的关键规则：账号相同不等于消息来自 AI。
  // 没有 Worker outbound 证据时，自身账号消息必须视为人工发言。
  if (senderId && selfId && senderId === selfId) {
    result.source = "owner-human";
    result.sourceConfidence = "same-account-without-outbound-proof";
    return result;
  }

  if (!["ai", "human", "owner-human"].includes(source)) result.source = "human";
  return result;
}



async function getQuotedMessage(env, groupId, messageId, botId = "") {
  const cacheKey = `message:${groupId}:${messageId}`;
  const cached = await dbGet(env, cacheKey);
  if (cached) {
    try {
      const obj = JSON.parse(cached);
      if (obj && typeof obj === "object") {
        const normalized = await normalizeQuotedMessageSource(env, obj, botId, messageId);
        if (JSON.stringify(normalized) !== JSON.stringify(obj)) await dbPut(env, cacheKey, JSON.stringify(normalized));
        return normalized;
      }
    } catch {
      return { messageId, groupId, senderId: "", senderName: "", text: cached, source: "unknown" };
    }
  }
  try {
    const data = await callOneBotAction(env, { action: "get_msg", params: { message_id: numericId(messageId) } }, 12000);
    const senderId = String(data?.sender?.user_id || data?.user_id || "");
    const selfId = String(botId || data?.self_id || "");
    const outbound = await hasOutboundMessageMarker(env, messageId);
    let source = "human";
    let sourceConfidence = "external-sender";
    if (data?.source === "ai" || outbound) {
      source = "ai";
      sourceConfidence = data?.source === "ai" ? "onebot-source" : "outbound-message-id";
    } else if (senderId && selfId && senderId === selfId) {
      source = "owner-human";
      sourceConfidence = "same-account-without-outbound-proof";
    }
    const obj = {
      messageId: String(messageId), groupId: String(groupId || data?.group_id || ""), senderId,
      senderName: String(data?.sender?.card || data?.sender?.nickname || senderId),
      text: extractMessageText(data?.message || data?.raw_message || ""),
      message: data?.message || null,
      source,
      sourceConfidence,
      selfId,
      createdAt: Number(data?.time || 0) * 1000 || Date.now()
    };
    await dbPut(env, `message:${obj.groupId}:${messageId}`, JSON.stringify(obj));
    return obj;
  } catch (error) {
    return null;
  }
}



function parseDurationSeconds(text) {
  const input = String(text || "").trim();
  const m = input.match(/(\d+(?:\.\d+)?)\s*(分钟|分鐘|分|小时|小時|时|時|天)?/);
  const value = Math.max(1, Number(m?.[1] || 10));
  const unit = m?.[2] || "分";
  const seconds = unit === "天" ? value * 86400 : /小时|小時|时|時/.test(unit) ? value * 3600 : value * 60;
  return Math.round(Math.min(seconds, 30 * 86400));
}



function formatDuration(seconds) {
  if (seconds % 86400 === 0) return `${seconds / 86400}天`;
  if (seconds % 3600 === 0) return `${seconds / 3600}小时`;
  return `${Math.round(seconds / 60)}分钟`;
}



function sanitizeAiReply(text) {
  const cleaned = neutralizeAiCommandPrefix(String(text || "")
    .replace(/\[CQ:[^\]]+\]/g, "")
    // 模型偶尔会复述解析器或历史上下文的内部标签；这些都不是用户可见内容。
    .replace(/\s*(?:\[不支持的元素类型\]|【不支持的元素类型】|\[unsupported element type\])\s*/gi, "")
    .replace(/【历史助手回复，仅供理解事实，禁止延续语气】/g, "")
    .replace(/【歷史助手回覆，僅供理解事實，禁止延續語氣】/g, "")
    .replace(/\*\*/g, "")
    .replace(/^#+\s*/gm, "")
    .replace(/\s{2,}/g, " ")
    .trim());
  return completeTextAtBoundary(cleaned, DEFAULTS.replyHardChars);
}


function getTaipeiTimeContext(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Taipei",
    year: "numeric", month: "2-digit", day: "2-digit",
    weekday: "long", hour: "2-digit", minute: "2-digit", second: "2-digit",
    hourCycle: "h23"
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map(part => [part.type, part.value]));
  const hour = Number(parts.hour || 0);
  const dayPart = hour < 5 ? "凌晨" : hour < 8 ? "早上" : hour < 12 ? "上午" : hour < 14 ? "中午" : hour < 18 ? "下午" : hour < 23 ? "晚上" : "深夜";
  const display = `${parts.year}/${parts.month}/${parts.day} ${parts.weekday || ""} ${parts.hour}:${parts.minute}:${parts.second}`.replace(/\s+/g, " ").trim();
  return { display, dayPart, hour, dateKey: `${parts.year}-${parts.month}-${parts.day}` };
}



function isExplicitCurrentTimeQuestion(value) {
  const text = String(value || "").replace(/\s+/g, "");
  return /(?:现在|現在|目前|此刻|当地|當地)?(?:几点|幾點|时间|時間|日期|几号|幾號|星期几|星期幾|礼拜几|禮拜幾|今天几号|今天幾號)|(?:几点了|幾點了|现在是什么时候|現在是什麼時候)/i.test(text);
}



function isStandaloneCurrentTimeQuestion(value) {
  const text = String(value || "").replace(/[\s，,。.!！?？]/g, "");
  return /^(?:请问|請問)?(?:现在|現在|目前|此刻|当地|當地)?(?:几点|幾點|几点了|幾點了|时间|時間|日期|几号|幾號|星期几|星期幾|礼拜几|禮拜幾|今天几号|今天幾號)(?:吗|嗎|呢)?$/i.test(text);
}



function isExplicitRoleplayRequest(value) {
  const text = String(value || "");
  return /(?:请|請|可以|能不能|来|來)?(?:扮演|角色扮演|模仿|學|学|装成|裝成|变成|變成|用.+语气|用.+語氣|叫一声|叫一聲|学猫叫|學貓叫)/i.test(text);
}



function neutralizeUnconfiguredPersonaText(value) {
  let text = String(value || "");
  text = text
    .replace(/[（(][^）)]{0,180}(?:蹦|跳|蹭|摸|摇|搖|眯|抱|扑|撲|尾巴|耳朵|脑袋|腦袋|手心|动作|動作)[^）)]{0,180}[）)]/g, "")
    .replace(/本喵/g, "我")
    .replace(/喵呜|喵嗚|喵嗷|喵～|喵~|喵!/g, "")
    .replace(/^\s*[~～]+\s*/, "")
    .replace(/([呀哦啦呢吧啊])喵(?=[！？!?.。]|$)/g, "$1")
    .replace(/猫娘\s*AI|貓娘\s*AI|猫娘|貓娘/g, "")
    .replace(/\b主人\b/g, "你")
    .replace(/[🐱🐈🐾😽😸😺]/gu, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([，。！？!?])/g, "$1")
    .trim();
  return text;
}



function prepareConversationHistory(history, { allowRoleplay = false } = {}) {
  const out = [];
  for (const item of Array.isArray(history) ? history : []) {
    const role = item?.role === "model" ? "model" : "user";
    const parts = [];
    for (const part of Array.isArray(item?.parts) ? item.parts : []) {
      if (part?.text) {
        let value = String(part.text);
        if (role === "model" && !allowRoleplay) value = neutralizeUnconfiguredPersonaText(value);
        // 不再把“历史助手回复”标签写进每一条 assistant 历史，避免模型原样复述内部标签。
        value = value
          .replace(/【历史助手回复，仅供理解事实，禁止延续语气】/g, "")
          .replace(/【歷史助手回覆，僅供理解事實，禁止延續語氣】/g, "");
        if (value.trim()) parts.push({ text: value.trim() });
      } else if (part?.inlineData) {
        parts.push({ text: `[历史媒体：${part.inlineData.mimeType || "未知类型"}]` });
      }
    }
    if (parts.length) out.push({ role, parts });
  }
  return out;
}



function removeUnsupportedCurrentTimeClaims(value) {
  const source = String(value || "");
  const chunks = source.match(/[^。！？!?\n]+[。！？!?]?|\n+/g) || [source];
  const unsafe = /(?:这个点|這個點|这么晚|這麼晚|大半夜|半夜|凌晨了|天都要亮|天快亮|还不睡|還不睡|不睡觉|不睡覺|该睡觉|該睡覺|快去睡|熬夜|修仙|熊猫眼|熊貓眼)/i;
  const kept = chunks.filter(chunk => !unsafe.test(chunk));
  return kept.join("").replace(/\n{3,}/g, "\n\n").trim();
}



function applyConversationOutputGuards(value, { allowRoleplay = false, explicitTimeQuestion = false, standaloneTimeQuestion = false, currentTime = "", userText = "" } = {}) {
  let text = String(value || "").trim();
  if (!allowRoleplay) text = neutralizeUnconfiguredPersonaText(text);
  if (explicitTimeQuestion) {
    const prefix = `【Asia/Taipei/Shanghai（亚洲/台北/上海时间）是：${currentTime}】`;
    if (standaloneTimeQuestion) return prefix;
    text = text.replace(/^【Asia\/Taipei\/Shanghai（亚洲\/台北\/上海时间）是：[^】]+】\s*/, "");
    text = `${prefix}${text ? `\n${text}` : ""}`;
  } else if (!isExplicitCurrentTimeQuestion(userText)) {
    text = removeUnsupportedCurrentTimeClaims(text);
  }
  return text || (explicitTimeQuestion ? `【Asia/Taipei/Shanghai（亚洲/台北/上海时间）是：${currentTime}】` : "收到。");
}



function extractTextMentionIds(text) {
  return [...new Set([...String(text || "").matchAll(/@(\d{5,})/g)].map(m => m[1]))];
}



function removeTextMentionTokens(text) {
  return String(text || "").replace(/@\d{5,}\s*/g, "").replace(/\s{2,}/g, " ").trim();
}



function buildReplyPlan({ isGroup, isAutoInterject, botMentioned, quotedMessageId, messageId, userId, selfId, selectedMentionIds = [], senderDnd, text }) {
  if (!isGroup) return { mode: "plain", text, mentionIds: [], replyId: "" };
  const mentionIds = [...new Set((selectedMentionIds || []).map(String))]
    .filter(id => id && id !== String(selfId || "") && !(senderDnd && id === String(userId || "")));
  let replyId = "";
  let mode = mentionIds.length ? "mention_targets" : "plain";

  if (!isAutoInterject && (quotedMessageId || botMentioned)) {
    // 保留原有 OneBot 引用回复语义；QQ 批量复制产生的“不支持的元素类型”只是复制占位文本。
    replyId = String(messageId || "");
    mode = mentionIds.length ? "reply_targets" : "reply_only";
  }
  return { mode, text, mentionIds, replyId, quoteMessageId: replyId };
}



function thinkingIndicatorRegistryKey({ isGroup, groupId, userId }) {
  return `thinking_active:${isGroup ? `group:${String(groupId || "")}` : `private:${String(userId || "")}`}:${String(userId || "")}`;
}



async function registerThinkingIndicator(env, target, messageId) {
  const id = String(messageId || "").trim();
  if (!id) return;
  const key = thinkingIndicatorRegistryKey(target);
  const rows = await readJson(env, key, []);
  const next = [...new Set([...(Array.isArray(rows) ? rows : []).map(String), id])].slice(-12);
  await dbPut(env, key, JSON.stringify(next));
}



async function clearRegisteredThinkingIndicators(env, target, extraIds = []) {
  const key = thinkingIndicatorRegistryKey(target);
  const stored = await readJson(env, key, []);
  const ids = [...new Set([...(Array.isArray(stored) ? stored : []), ...(Array.isArray(extraIds) ? extraIds : [])].map(String).filter(Boolean))];
  if (!ids.length) return { ok: true, cleared: 0, failed: [] };
  const failed = [];
  let cleared = 0;
  for (const id of ids) {
    try {
      await callOneBotAction(env, { action: "delete_msg", params: { message_id: numericId(id) } }, 10000);
      cleared += 1;
    } catch (error) {
      failed.push({ id, error: String(error?.message || error).slice(0, 500) });
    }
  }
  if (failed.length) await dbPut(env, key, JSON.stringify(failed.map(item => item.id).slice(-12)));
  else await dbDel(env, key);
  if (failed.length) await writeSystemAudit(env, {
    type: "thinking_indicator_residual", groupId: String(target?.groupId || ""), actorId: String(target?.userId || ""),
    action: "registry_cleanup_failed", failed
  }).catch(() => {});
  return { ok: failed.length === 0, cleared, failed };
}



async function sendThinkingIndicator(env, { isGroup, groupId, userId, text }) {
  const action = isGroup ? "send_group_msg" : "send_private_msg";
  const params = isGroup
    ? { group_id: numericId(groupId), message: [{ type: "text", data: { text: String(text || "正在思考...") } }], auto_escape: false }
    : { user_id: numericId(userId), message: String(text || "正在思考..."), auto_escape: false };
  const data = await callOneBotAction(env, { action, params }, 12000);
  const messageId = String(data?.message_id || data?.messageId || data || "");
  if (messageId) await registerThinkingIndicator(env, { isGroup, groupId, userId }, messageId);
  return messageId;
}



function flattenGeminiContents(contents) {
  const result = [];
  for (const item of contents || []) {
    const role = item.role === "model" ? "assistant" : "user";
    const text = (item.parts || []).map(p => p.text || (p.inlineData ? `[${p.inlineData.mimeType || "媒体"}]` : "")).filter(Boolean).join("\n");
    if (text) result.push({ role, content: text });
  }
  return result;
}

export { allMediaDescriptors, appendPortalConversationRecord, applyConversationOutputGuards, auditIgnoredRobotMessage, botInteractionAllowKey, botSenderCacheKey, buildReplyPlan, cacheBotSenderClassification, clearRegisteredThinkingIndicators, collectOneBotMedia, decodeCqValue, decodeInlineMedia, detectLiteralPseudoElementLabels, eventHasBotMention, eventMentionedQqs, eventPlainText, eventSenderDisplayName, eventSenderRobotHint, extractFileDescriptors, extractForwardIds, extractMediaDescriptor, extractMessageText, extractOutboundMediaTypes, extractTextMentionIds, fetchConversationAttachmentResponse, filterRobotMentionIds, flattenGeminiContents, formatDuration, formatForwardContext, getForwardMessageSnapshot, getQuotedMessage, getTaipeiTimeContext, guessAttachmentMime, hasOutboundMessageMarker, isExplicitCurrentTimeQuestion, isExplicitRoleplayRequest, isGroupRobotInteractionAllowed, isIgnoredGroupRobotSender, isStandaloneCurrentTimeQuestion, looksLikeRobotDisplayName, neutralizeUnconfiguredPersonaText, normalizeFileDescriptor, normalizeForwardNodeList, normalizeQuotedMessageSource, oneBotContentText, parseCqAttributes, parseDurationSeconds, prepareConversationHistory, purgeLegacyBotRepliesFromRecentLogs, qqaiTruthyRobotFlag, recordStructuredMessage, refreshConversationAttachmentDescriptor, registerThinkingIndicator, removeTextMentionTokens, removeUnsupportedCurrentTimeClaims, resolveOneBotMediaAsBase64, runOneBotGroupOperation, safeAttachmentFilename, sanitizeAiReply, sendGroupRoleMentions, sendThinkingIndicator, thinkingIndicatorRegistryKey, updatePortalConversationRecord };
