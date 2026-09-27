function clean(value) {
  return String(value == null ? "" : value).trim();
}

function eventData(payload = {}) {
  return payload?.d && typeof payload.d === "object" ? payload.d : {};
}

function messageSceneExtMap(data = {}) {
  const rows = Array.isArray(data?.message_scene?.ext)
    ? data.message_scene.ext
    : Array.isArray(data?.messageScene?.ext)
      ? data.messageScene.ext
      : [];
  const out = {};
  for (const row of rows) {
    const text = String(row || "");
    const index = text.indexOf("=");
    if (index <= 0) continue;
    out[text.slice(0, index)] = text.slice(index + 1);
  }
  return out;
}

function qqOpenDeliverySequence(payload = {}) {
  const data = eventData(payload);
  const direct = data.msg_seq ?? data.msgSeq;
  if (direct !== undefined && direct !== null && String(direct) !== "") return String(direct);
  const ext = messageSceneExtMap(data);
  if (ext.msg_idx) return String(ext.msg_idx);
  return "";
}

function qqOpenDeliveryKey(payload = {}, message = null) {
  const type = clean(payload?.t || payload?.type).toUpperCase();
  const data = eventData(payload);
  const messageId = clean(message?.messageId || data.id || data.message_id || payload.id);
  if (!messageId) return "";
  const seq = qqOpenDeliverySequence(payload);
  return [type || "MESSAGE", messageId, seq || "no-seq"].join("|");
}

function qqOpenPassiveReplyPolicy(scope) {
  if (String(scope || "") === "group") return Object.freeze({ maxReplies: 5, ttlMs: 5 * 60 * 1000 });
  return Object.freeze({ maxReplies: 4, ttlMs: 60 * 60 * 1000 });
}

function qqOpenShard(env = {}) {
  const rawId = String(env.QQ_OPEN_SHARD_ID ?? "").trim();
  const rawTotal = String(env.QQ_OPEN_SHARD_TOTAL ?? "").trim();
  if (!rawId && !rawTotal) return [0, 1];
  const id = Number(rawId || 0);
  const total = Number(rawTotal || 1);
  if (!Number.isInteger(id) || !Number.isInteger(total) || total < 1 || id < 0 || id >= total) {
    throw new Error("QQ_OPEN_INVALID_SHARD");
  }
  return [id, total];
}

function qqOpenClosePolicy(codeValue) {
  const code = Number(codeValue || 0);
  if ([4914, 4915, 4001, 4002, 4010, 4011, 4012, 4013, 4014].includes(code)) {
    return Object.freeze({ retry: false, preserveSession: false, suspend: true, mode: "fatal" });
  }
  if ([4006, 4007].includes(code) || (code >= 4900 && code <= 4913)) {
    return Object.freeze({ retry: true, preserveSession: false, suspend: false, mode: "identify" });
  }
  if ([4008, 4009].includes(code)) {
    return Object.freeze({ retry: true, preserveSession: true, suspend: false, mode: "resume" });
  }
  if (code >= 4000 && code < 5000) {
    return Object.freeze({ retry: true, preserveSession: false, suspend: false, mode: "identify" });
  }
  return Object.freeze({ retry: true, preserveSession: true, suspend: false, mode: "resume" });
}

export {
  messageSceneExtMap,
  qqOpenClosePolicy,
  qqOpenDeliveryKey,
  qqOpenDeliverySequence,
  qqOpenPassiveReplyPolicy,
  qqOpenShard
};
