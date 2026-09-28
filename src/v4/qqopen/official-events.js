function clean(value) {
  return String(value == null ? "" : value).trim();
}

function eventType(payload = {}) {
  return clean(payload?.t || payload?.type).toUpperCase();
}

function eventData(payload = {}) {
  return payload?.d && typeof payload.d === "object" ? payload.d : payload && typeof payload === "object" ? payload : {};
}

function toTimestampMs(value) {
  if (value === undefined || value === null || value === "") return Date.now();
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric > 1e12 ? Math.floor(numeric) : Math.floor(numeric * 1000);
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : Date.now();
}

const PUSH_PERMISSION_EVENTS = Object.freeze(new Set([
  "C2C_MSG_RECEIVE",
  "C2C_MSG_REJECT",
  "GROUP_MSG_RECEIVE",
  "GROUP_MSG_REJECT"
]));

const LIFECYCLE_EVENTS = Object.freeze(new Set([
  "FRIEND_ADD",
  "FRIEND_DEL",
  "GROUP_ADD_ROBOT",
  "GROUP_DEL_ROBOT",
  "GROUP_MEMBER_ADD",
  "GROUP_MEMBER_REMOVE"
]));

function normalizePushPermissionEvent(payload = {}) {
  const type = eventType(payload);
  if (!PUSH_PERMISSION_EVENTS.has(type)) return null;
  const data = eventData(payload);
  const group = type.startsWith("GROUP_");
  const targetId = clean(group ? data.group_openid : data.openid);
  if (!targetId) return null;
  return Object.freeze({
    kind: "push_permission",
    eventType: type,
    scope: group ? "group" : "c2c",
    targetId,
    operatorId: clean(group ? data.op_member_openid : data.openid),
    allowed: type.endsWith("_RECEIVE"),
    updatedAt: toTimestampMs(data.timestamp)
  });
}

function normalizeLifecycleEvent(payload = {}) {
  const type = eventType(payload);
  if (!LIFECYCLE_EVENTS.has(type)) return null;
  const data = eventData(payload);
  const friend = type.startsWith("FRIEND_");
  const robotGroup = type === "GROUP_ADD_ROBOT" || type === "GROUP_DEL_ROBOT";
  const memberGroup = type === "GROUP_MEMBER_ADD" || type === "GROUP_MEMBER_REMOVE";
  const groupId = clean(data.group_openid);
  const memberId = clean(data.member_openid);
  const userId = clean(friend ? data.openid : data.user_openid);
  const author = data.author && typeof data.author === "object" ? data.author : {};
  return Object.freeze({
    kind: "lifecycle",
    eventType: type,
    scope: friend ? "c2c" : "group",
    groupId,
    memberId,
    userId,
    unionOpenid: clean(author.union_openid),
    operatorId: clean(data.op_member_openid),
    scene: Number(data.scene || 0),
    sceneParam: clean(data.scene_param),
    active: type === "FRIEND_ADD" || type === "GROUP_ADD_ROBOT" || type === "GROUP_MEMBER_ADD",
    subject: friend ? "friend" : robotGroup ? "bot_group_membership" : memberGroup ? "group_member" : "unknown",
    updatedAt: toTimestampMs(data.timestamp)
  });
}

function lifecycleDeliveryKey(record) {
  if (!record) return "";
  const target = clean(record.groupId || record.userId || record.memberId);
  return [record.eventType, target, clean(record.memberId || record.userId), Number(record.updatedAt || 0)].join("|");
}

function interactionRequiresAck(typeValue) {
  const type = Number(typeValue || 0);
  return type === 11 || type === 12;
}

function tryJson(value) {
  const raw = clean(value);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function decodeBase64Json(value) {
  const raw = clean(value);
  if (!raw || raw.length > 4096) return null;
  try {
    const normalized = raw.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
    const decoded = typeof atob === "function"
      ? atob(padded)
      : "";
    if (!decoded) return null;
    const bytes = Uint8Array.from(decoded, char => char.charCodeAt(0));
    const text = new TextDecoder().decode(bytes);
    return tryJson(text);
  } catch {
    return null;
  }
}

function parseFeatureCommandMap(value) {
  const raw = clean(value);
  if (!raw) return Object.freeze({});
  let parsed;
  try { parsed = JSON.parse(raw); } catch { throw new Error("QQ_OPEN_FEATURE_COMMAND_MAP_INVALID_JSON"); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("QQ_OPEN_FEATURE_COMMAND_MAP_INVALID");
  const output = {};
  for (const [key, command] of Object.entries(parsed)) {
    const id = clean(key);
    const valueText = clean(command);
    if (id && valueText) output[id] = valueText;
  }
  return Object.freeze(output);
}

function commandFromCallback({ buttonData = "", featureId = "", featureMap = {} } = {}) {
  const raw = clean(buttonData);
  if (raw.startsWith("!") || raw.startsWith("！")) return raw;
  const parsed = tryJson(raw) || decodeBase64Json(raw);
  const fromJson = clean(parsed?.command || parsed?.message || parsed?.text);
  if (fromJson.startsWith("!") || fromJson.startsWith("！")) return fromJson;
  const mapped = clean(featureMap?.[clean(featureId)]);
  if (mapped.startsWith("!") || mapped.startsWith("！")) return mapped;
  return "";
}

function normalizeInteractionEvent(payload = {}, { featureMap = {} } = {}) {
  if (eventType(payload) !== "INTERACTION_CREATE") return null;
  const data = eventData(payload);
  const interactionData = data.data && typeof data.data === "object" ? data.data : {};
  const resolved = interactionData.resolved && typeof interactionData.resolved === "object" ? interactionData.resolved : {};
  const type = Number(data.type ?? interactionData.type ?? 0);
  const scene = clean(data.scene || (Number(data.chat_type) === 1 ? "group" : Number(data.chat_type) === 2 ? "c2c" : "guild")).toLowerCase();
  const userId = clean(data.user_openid || data.group_member_openid || resolved.user_id);
  const groupId = clean(data.group_openid);
  const authorize = resolved.authorize_data && typeof resolved.authorize_data === "object" ? resolved.authorize_data : null;
  const command = [11, 12].includes(type)
    ? commandFromCallback({ buttonData: resolved.button_data, featureId: resolved.feature_id, featureMap })
    : "";
  return Object.freeze({
    kind: "interaction",
    id: clean(data.id),
    type,
    scene,
    userId,
    groupId,
    guildId: clean(data.guild_id),
    channelId: clean(data.channel_id),
    timestamp: toTimestampMs(data.timestamp),
    requiresAck: interactionRequiresAck(type),
    command,
    resolved: Object.freeze({
      buttonData: clean(resolved.button_data),
      buttonId: clean(resolved.button_id),
      featureId: clean(resolved.feature_id),
      messageId: clean(resolved.message_id),
      feedbackOpt: clean(resolved.feedback_opt),
      checked: Number(resolved.checked || 0),
      action: clean(resolved.action),
      authorizeScope: clean(authorize?.scope),
      authorizeScene: clean(authorize?.opt_scene)
    })
  });
}

function interactionDeliveryKey(interaction) {
  const id = clean(interaction?.id);
  return id ? "INTERACTION_CREATE|" + id : "";
}

function interactionControlAction(interaction) {
  const type = Number(interaction?.type || 0);
  if (type === 13) return "feedback";
  if (type === 14) return "clear_session";
  if (type === 15) return "story";
  if (type === 16) return "switch_model";
  if ([18, 19, 20].includes(type)) return "authorization";
  return interaction?.command ? "command" : "observe";
}

export {
  LIFECYCLE_EVENTS,
  PUSH_PERMISSION_EVENTS,
  commandFromCallback,
  interactionControlAction,
  interactionDeliveryKey,
  lifecycleDeliveryKey,
  interactionRequiresAck,
  normalizeInteractionEvent,
  normalizeLifecycleEvent,
  normalizePushPermissionEvent,
  parseFeatureCommandMap
};
