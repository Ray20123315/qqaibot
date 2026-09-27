function clean(value) {
  return String(value ?? "").trim();
}

function normalizeMsgSeq(value) {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : 1;
}

function createQqOpenActionDispatcher({ api } = {}) {
  if (!api || typeof api !== "object") throw new Error("QQ_OPEN_ACTION_API_REQUIRED");

  async function dispatch(action, payload = {}) {
    const name = clean(action).toLowerCase();
    if (!["message.reply", "message.send"].includes(name)) {
      throw new Error(`QQ_OPEN_ACTION_UNSUPPORTED:${name || "empty"}`);
    }

    const source = payload?.message && typeof payload.message === "object" ? payload.message : {};
    const scope = clean(payload.scope || source.scope).toLowerCase();
    const content = String(payload.content ?? "");
    if (!content.trim()) throw new Error("QQ_OPEN_ACTION_EMPTY_CONTENT");

    const groupId = clean(payload.groupId || source.groupId);
    const userId = clean(payload.userId || source.userId);
    const replyToMessageId = clean(payload.replyToMessageId || source.messageId);
    const body = {
      content,
      msg_type: 0,
      msg_seq: normalizeMsgSeq(payload.msgSeq)
    };
    if (replyToMessageId) body.msg_id = replyToMessageId;

    let data;
    if (scope === "group") {
      if (!groupId) throw new Error("QQ_OPEN_ACTION_GROUP_OPENID_REQUIRED");
      if (typeof api.sendGroupMessage !== "function") throw new Error("QQ_OPEN_ACTION_GROUP_SEND_UNAVAILABLE");
      data = await api.sendGroupMessage(groupId, body);
    } else if (scope === "private" || scope === "c2c") {
      if (!userId) throw new Error("QQ_OPEN_ACTION_USER_OPENID_REQUIRED");
      if (typeof api.sendC2CMessage !== "function") throw new Error("QQ_OPEN_ACTION_C2C_SEND_UNAVAILABLE");
      data = await api.sendC2CMessage(userId, body);
    } else {
      throw new Error(`QQ_OPEN_ACTION_SCOPE_UNSUPPORTED:${scope || "unknown"}`);
    }

    return Object.freeze({
      ok: true,
      platform: "qq-open",
      action: name,
      scope,
      data
    });
  }

  return Object.freeze({ dispatch });
}

export { createQqOpenActionDispatcher, normalizeMsgSeq };
