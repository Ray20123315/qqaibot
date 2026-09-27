function clean(value) {
  return String(value == null ? "" : value).trim();
}

function hybridPrimaryTransport(env = {}) {
  const value = clean(env.QQ_HYBRID_PRIMARY || "qq-open").toLowerCase();
  if (["qq-open", "qqopen", "official"].includes(value)) return "qq-open";
  if (["onebot", "napcat", "legacy"].includes(value)) return "onebot";
  return "qq-open";
}

function parseGroupMap(env = {}) {
  const raw = clean(env.QQ_HYBRID_GROUP_MAP);
  if (!raw) return Object.freeze({ oneBotToQqOpen: Object.freeze({}), qqOpenToOneBot: Object.freeze({}) });
  let parsed;
  try { parsed = JSON.parse(raw); } catch { throw new Error("QQ_HYBRID_GROUP_MAP_INVALID_JSON"); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("QQ_HYBRID_GROUP_MAP_INVALID");
  const oneBotToQqOpen = {};
  const qqOpenToOneBot = {};
  for (const [oneBotIdValue, qqOpenIdValue] of Object.entries(parsed)) {
    const oneBotId = clean(oneBotIdValue);
    const qqOpenId = clean(qqOpenIdValue);
    if (!oneBotId || !qqOpenId) continue;
    if (!/^\d+$/.test(oneBotId)) throw new Error("QQ_HYBRID_GROUP_MAP_ONEBOT_ID_INVALID");
    oneBotToQqOpen[oneBotId] = qqOpenId;
    qqOpenToOneBot[qqOpenId] = oneBotId;
  }
  return Object.freeze({
    oneBotToQqOpen: Object.freeze(oneBotToQqOpen),
    qqOpenToOneBot: Object.freeze(qqOpenToOneBot)
  });
}

function qqOpenGroupForOneBot(env = {}, oneBotGroupId) {
  const id = clean(oneBotGroupId);
  if (!id) return "";
  return clean(parseGroupMap(env).oneBotToQqOpen[id]);
}

function oneBotGroupForQqOpen(env = {}, qqOpenGroupId) {
  const id = clean(qqOpenGroupId);
  if (!id) return "";
  return clean(parseGroupMap(env).qqOpenToOneBot[id]);
}

function isAuxiliaryOneBotMessage(env = {}, body = {}) {
  if (hybridPrimaryTransport(env) !== "qq-open") return false;
  if (clean(body.__qqai_platform).toLowerCase() === "qq-open") return false;
  const postType = clean(body.post_type).toLowerCase();
  if (!["message", "message_sent"].includes(postType)) return false;
  const messageType = clean(body.message_type).toLowerCase();
  return ["group", "private"].includes(messageType);
}

function hybridObservationRow(body = {}, { mappedQqOpenGroupId = "", text = "", mentions = [], mediaTypes = [] } = {}) {
  const scope = clean(body.message_type).toLowerCase() === "group" ? "group" : "private";
  const sender = body.sender && typeof body.sender === "object" ? body.sender : {};
  return Object.freeze({
    source: "onebot-auxiliary",
    scope,
    oneBotGroupId: scope === "group" ? clean(body.group_id) : "",
    qqOpenGroupId: scope === "group" ? clean(mappedQqOpenGroupId) : "",
    userId: clean(body.user_id || body.sender_id),
    messageId: clean(body.message_id),
    senderName: clean(sender.card || sender.nickname || sender.name || body.nickname || body.user_id),
    senderRole: clean(sender.role || "member"),
    text: String(text || "").slice(0, 4000),
    mentions: Object.freeze([...new Set((mentions || []).map(clean).filter(Boolean))].slice(0, 32)),
    mediaTypes: Object.freeze([...new Set((mediaTypes || []).map(clean).filter(Boolean))].slice(0, 16)),
    observedAt: Date.now()
  });
}

function hybridStatus(env = {}) {
  const map = parseGroupMap(env);
  return Object.freeze({
    primary: hybridPrimaryTransport(env),
    oneBotRole: hybridPrimaryTransport(env) === "qq-open" ? "auxiliary_observation" : "primary",
    mappedGroups: Object.keys(map.oneBotToQqOpen).length
  });
}

export {
  hybridObservationRow,
  hybridPrimaryTransport,
  hybridStatus,
  isAuxiliaryOneBotMessage,
  oneBotGroupForQqOpen,
  parseGroupMap,
  qqOpenGroupForOneBot
};
