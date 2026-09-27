function clean(value) { return String(value == null ? "" : value).trim(); }

function eventType(payload) {
  return clean(payload && (payload.t || payload.type)).toUpperCase();
}

function eventData(payload) {
  return payload && payload.d && typeof payload.d === "object" ? payload.d : {};
}

function cleanQqOpenText(value) {
  return String(value == null ? "" : value)
    .replace(/<@!?[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toLegacyPart(part) {
  if (!part || typeof part !== "object") return null;
  if (part.kind === "text") return { type: "text", data: { text: cleanQqOpenText(part.text) } };
  if (part.kind === "mention") return { type: "at", data: { qq: clean(part.userId) } };
  if (part.kind === "reply") return { type: "reply", data: { id: clean(part.messageId) } };
  const media = part.media || {};
  if (part.kind === "image") return { type: "image", data: { file: clean(media.fileId || media.url), url: clean(media.url), name: clean(media.name) } };
  if (part.kind === "audio") return { type: "record", data: { file: clean(media.fileId || media.url), url: clean(media.url), name: clean(media.name) } };
  if (part.kind === "video") return { type: "video", data: { file: clean(media.fileId || media.url), url: clean(media.url), name: clean(media.name) } };
  if (part.kind === "file") return { type: "file", data: { file: clean(media.fileId || media.url), url: clean(media.url), name: clean(media.name), size: Number(media.size || 0) || 0 } };
  return null;
}

function legacyRaw(parts) {
  return parts.map(function(part) {
    const data = part.data || {};
    if (part.type === "text") return String(data.text || "");
    if (part.type === "at") return "[CQ:at,qq=" + clean(data.qq) + "]";
    if (part.type === "reply") return "[CQ:reply,id=" + clean(data.id) + "]";
    if (["image", "record", "video", "file"].includes(part.type)) {
      const attrs = [];
      if (data.file) attrs.push("file=" + data.file);
      if (data.url) attrs.push("url=" + data.url);
      if (data.name) attrs.push("name=" + data.name);
      return "[CQ:" + part.type + "," + attrs.join(",") + "]";
    }
    return "";
  }).join("");
}

function qqOpenMessageToLegacyBody(message, payload, options) {
  if (!message) return null;
  const type = eventType(payload || {});
  const botUserId = clean(options && options.botUserId);
  const parts = (Array.isArray(message.parts) ? message.parts : []).map(toLegacyPart).filter(Boolean);
  const explicit = message.scope === "private" || ["GROUP_AT_MESSAGE_CREATE", "AT_MESSAGE_CREATE", "DIRECT_MESSAGE_CREATE", "C2C_MESSAGE_CREATE"].includes(type);
  return {
    time: Number(message.time || Math.floor(Date.now() / 1000)),
    self_id: botUserId || clean(message.selfId),
    post_type: "message",
    message_type: message.scope === "group" ? "group" : "private",
    sub_type: "normal",
    message_id: clean(message.messageId),
    user_id: clean(message.userId),
    group_id: message.scope === "group" ? clean(message.groupId) : undefined,
    message: parts,
    raw_message: legacyRaw(parts),
    sender: {
      user_id: clean(message.userId),
      nickname: clean(message.senderName || message.userId),
      card: clean(message.senderName),
      role: clean(message.senderRole || "member")
    },
    __qqai_platform: "qq-open",
    __qqai_explicit_question: explicit,
    __qqai_qqopen_event_type: type,
    __qqai_principal_id: clean(message.userId),
    __qqai_qqopen_raw_group_openid: clean(message.groupId),
    __qqai_qqopen_raw_user_openid: clean(message.userId)
  };
}

function qqOpenJoinRequestToLegacyBody(payload, options) {
  if (eventType(payload || {}) !== "GROUP_JOIN_REQUEST") return null;
  const data = eventData(payload || {});
  const groupId = clean(data.group_openid || data.group_id);
  const userId = clean(data.member_openid || data.user_openid || data.openid || (data.author && (data.author.member_openid || data.author.user_openid)));
  const flag = clean(data.join_request_id || data.request_id || data.id);
  if (!groupId || !userId || !flag) return null;
  return {
    time: Math.floor(Date.now() / 1000),
    self_id: clean(options && options.botUserId),
    post_type: "request",
    request_type: "group",
    sub_type: "add",
    group_id: groupId,
    user_id: userId,
    flag: flag,
    comment: String(data.comment || data.message || data.reason || "").slice(0, 1000),
    __qqai_platform: "qq-open",
    __qqai_qqopen_event_type: "GROUP_JOIN_REQUEST",
    __qqai_qqopen_join_request_id: flag
  };
}

function decodeCq(value) {
  return String(value || "").replace(/&#44;/g, ",").replace(/&#91;/g, "[").replace(/&#93;/g, "]").replace(/&amp;/g, "&");
}

function parseAttrs(raw) {
  const out = {};
  String(raw || "").split(",").forEach(function(item) {
    const i = item.indexOf("=");
    if (i > 0) out[item.slice(0, i).trim()] = decodeCq(item.slice(i + 1));
  });
  return out;
}

function legacyMessageParts(value) {
  if (Array.isArray(value)) return value.map(function(part) { return { type: clean(part && part.type), data: part && part.data || {} }; }).filter(function(part) { return part.type; });
  const source = String(value == null ? "" : value);
  const out = [];
  const re = /\[CQ:([a-zA-Z0-9_]+),([^\]]*)\]/g;
  let cursor = 0;
  for (const match of source.matchAll(re)) {
    if (match.index > cursor) out.push({ type: "text", data: { text: source.slice(cursor, match.index) } });
    out.push({ type: String(match[1] || "").toLowerCase(), data: parseAttrs(match[2]) });
    cursor = match.index + match[0].length;
  }
  if (cursor < source.length) out.push({ type: "text", data: { text: source.slice(cursor) } });
  return out;
}

function uploadType(type) {
  if (type === "image") return 1;
  if (type === "video") return 2;
  if (type === "record" || type === "audio") return 3;
  return 4;
}

function uploadSource(data) {
  const file = clean(data && data.file);
  const url = clean(data && data.url) || (/^https?:\/\//i.test(file) ? file : "");
  if (url) return { url: url };
  if (/^base64:\/\//i.test(file)) return { file_data: file.slice(9) };
  if (/^data:[^;,]+;base64,/i.test(file)) return { file_data: file.replace(/^data:[^;,]+;base64,/i, "") };
  return null;
}

function countQqOpenLegacyMessages(value) {
  const parts = legacyMessageParts(value);
  let text = "";
  let media = 0;
  for (const part of parts) {
    const type = String(part.type || "").toLowerCase();
    const data = part.data || {};
    if (type === "text") text += String(data.text || "");
    else if (type === "at") text += clean(data.qq) === "all" ? "@全体成员" : "<@" + clean(data.qq) + ">";
    else if (["image", "record", "audio", "video", "file"].includes(type)) media += 1;
  }
  return (text.trim() ? 1 : 0) + media;
}

async function sendQqOpenLegacyMessage(api, target, value, options) {
  const parts = legacyMessageParts(value);
  const text = [];
  const media = [];
  parts.forEach(function(part) {
    const type = String(part.type || "").toLowerCase();
    const data = part.data || {};
    if (type === "text") text.push(String(data.text || ""));
    else if (type === "at") text.push(clean(data.qq) === "all" ? "@全体成员" : "<@" + clean(data.qq) + ">");
    else if (["image", "record", "audio", "video", "file"].includes(type)) media.push({ type: type, data: data });
  });
  const results = [];
  let seq = Math.max(1, Number(options && options.msgSeq || 1));
  const replyMessageId = clean(options && options.replyMessageId || target && target.messageId);
  const content = text.join("").trim();
  if (content) {
    const body = { content: content, msg_type: 0, msg_seq: seq++ };
    if (replyMessageId) body.msg_id = replyMessageId;
    const result = target.scope === "group"
      ? await api.sendGroupMessage(clean(target.groupId), body)
      : await api.sendC2CMessage(clean(target.userId), body);
    results.push({ kind: "text", result: result });
  }
  for (const item of media) {
    const source = uploadSource(item.data);
    if (!source) { results.push({ kind: item.type, skipped: true, error: "QQ_OPEN_MEDIA_SOURCE_UNAVAILABLE" }); continue; }
    const uploadBody = Object.assign({ file_type: uploadType(item.type), srv_send_msg: false }, source);
    const uploaded = target.scope === "group"
      ? await api.uploadGroupFile(clean(target.groupId), uploadBody)
      : await api.uploadC2CFile(clean(target.userId), uploadBody);
    const fileInfo = clean(uploaded && (uploaded.file_info || uploaded.fileInfo));
    if (!fileInfo) throw new Error("QQ_OPEN_MEDIA_FILE_INFO_MISSING");
    const sendBody = { msg_type: 7, msg_seq: seq++, media: { file_info: fileInfo } };
    if (replyMessageId) sendBody.msg_id = replyMessageId;
    const sent = target.scope === "group"
      ? await api.sendGroupMessage(clean(target.groupId), sendBody)
      : await api.sendC2CMessage(clean(target.userId), sendBody);
    results.push({ kind: item.type, result: sent, upload: uploaded });
  }
  const sentRows = results.filter(function(item) { return item.result; });
  const last = sentRows.length ? sentRows[sentRows.length - 1].result : null;
  return { ok: true, results: results, data: last, messageId: clean(last && (last.id || last.message_id)), nextMsgSeq: seq };
}

function normalizeMember(member, fallbackId) {
  member = member || {};
  const id = clean(member.member_openid || member.user_openid || member.openid || member.id || fallbackId);
  const name = clean(member.member_name || member.nickname || member.username || member.name || id);
  const role = clean(member.member_role || member.role || "member").toLowerCase();
  return { user_id: id, nickname: name, card: name, role: ["owner", "admin", "member"].includes(role) ? role : "member", raw: member };
}

async function qqOpenLegacyAction(api, action, params, context, helpers) {
  params = params || {};
  context = context || {};
  helpers = helpers || {};
  const name = clean(action);
  const groupId = clean(params.group_id || params.group || context.groupId);
  const userId = clean(params.user_id || params.qq || context.userId);
  const messageId = clean(params.message_id || context.messageId);
  const scope = clean(params.message_type || context.scope) === "group" || groupId ? "group" : "private";

  if (["send_group_msg", "send_private_msg", "send_msg"].includes(name)) {
    const target = { scope: scope, groupId: groupId, userId: userId, messageId: messageId };
    if (name === "send_group_msg") target.scope = "group";
    if (name === "send_private_msg") target.scope = "private";
    const replyMessageId = clean(params.reply_to_message_id || target.messageId);
    let msgSeq = Math.max(1, Number(params.msg_seq || 1) || 1);
    if (replyMessageId && typeof helpers.reserveReplySequences === "function") {
      const needed = Math.max(1, countQqOpenLegacyMessages(params.message));
      const reservation = await helpers.reserveReplySequences(replyMessageId, target.scope, needed);
      msgSeq = Number(reservation?.start || msgSeq);
    }
    return (await sendQqOpenLegacyMessage(api, target, params.message, { replyMessageId, msgSeq })).data;
  }
  if (name === "delete_msg") {
    const cached = helpers.getCachedMessage && helpers.getCachedMessage(messageId);
    const g = clean(cached && cached.group_id || groupId);
    if (g) return api.deleteGroupMessage(g, messageId, { hideTip: false });
    const peer = clean(context.userId || userId);
    if (!peer || typeof api.deleteC2CMessage !== "function") throw new Error("QQ_OPEN_DELETE_MESSAGE_CONTEXT_MISSING");
    return api.deleteC2CMessage(peer, messageId);
  }
  if (name === "get_msg") {
    const cached = helpers.getCachedMessage && helpers.getCachedMessage(messageId);
    if (!cached) throw new Error("QQ_OPEN_MESSAGE_NOT_CACHED");
    return cached;
  }
  if (name === "get_login_info") return { user_id: clean(context.botUserId), nickname: "QQAI" };
  if (name === "get_status") return { online: true, good: true, platform: "qq-open" };
  if (name === "get_version_info") return { app_name: "QQAIBOT", app_version: "v4", protocol_version: "qq-open-v2" };
  if (name === "can_send_image" || name === "can_send_record") return { yes: true };
  if (name === "get_group_info") return api.getGroupInfo(groupId);
  if (name === "get_group_member_info") {
    const raw = await api.getGroupMember(groupId, userId);
    return Object.assign(normalizeMember(raw, userId), { group_id: groupId });
  }
  if (name === "get_group_member_list") {
    const raw = await api.getGroupMembers(groupId, { limit: 100 });
    const rows = Array.isArray(raw) ? raw : Array.isArray(raw && raw.members) ? raw.members : Array.isArray(raw && raw.items) ? raw.items : [];
    return rows.map(function(item) { return Object.assign(normalizeMember(item), { group_id: groupId }); });
  }
  if (name === "set_group_ban") {
    const duration = Math.max(0, Number(params.duration || 0) || 0);
    return api.setGroupMuteSetting(groupId, { mutes: [{ op: duration > 0 ? "add" : "del", member_openid: userId, mute_expire_at: duration > 0 ? new Date(Date.now() + duration * 1000).toISOString() : "" }] });
  }
  if (name === "set_group_kick") {
    return api.removeGroupMembers(groupId, { member_openids: [userId], add_to_member_blacklist: params.reject_add_request === true || params.add_to_blacklist === true });
  }
  if (name === "set_group_add_request") {
    const flag = clean(params.flag);
    const cached = helpers.getCachedJoinRequest && helpers.getCachedJoinRequest(flag);
    const g = clean(cached && cached.group_id || groupId);
    const u = clean(cached && cached.user_id || userId);
    if (!flag || !g || !u) throw new Error("QQ_OPEN_JOIN_REQUEST_CONTEXT_MISSING");
    const approve = params.approve !== false;
    const payload = { op: approve ? "approve" : "decline", join_request_id: flag };
    if (!approve) {
      payload.reject_reason = clean(params.reason).slice(0, 120);
      payload.add_to_member_blacklist = params.add_to_member_blacklist === true;
    }
    return api.reviewGroupJoinRequest(g, u, payload);
  }
  if (name === "get_image" || name === "get_record" || name === "get_group_file_url") {
    const source = clean(params.url || params.file_url || params.file);
    if (/^https?:\/\//i.test(source)) return { url: source, file: source };
    throw new Error("QQ_OPEN_MEDIA_URL_UNAVAILABLE");
  }

  throw new Error("QQ_OPEN_LEGACY_ACTION_UNSUPPORTED:" + name);
}

export {
  cleanQqOpenText,
  countQqOpenLegacyMessages,
  legacyMessageParts,
  qqOpenJoinRequestToLegacyBody,
  qqOpenLegacyAction,
  qqOpenMessageToLegacyBody,
  sendQqOpenLegacyMessage
};
