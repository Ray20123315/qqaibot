const SAFE_FALLBACK_KINDS = Object.freeze(new Set(["unavailable", "denied"]));
const USER_TARGET_ACTIONS = Object.freeze(new Set([
  "send_private_msg",
  "get_group_member_info",
  "set_group_ban",
  "set_group_kick"
]));
const MESSAGE_ID_BOUND_ACTIONS = Object.freeze(new Set(["delete_msg", "get_msg"]));

function clean(value) {
  return String(value ?? "").trim();
}

function classifyOfficialCapabilityError(error) {
  const message = clean(error?.message || error);
  if (/QQ_OPEN_LEGACY_ACTION_UNSUPPORTED|QQ_OPEN_ACTION_UNSUPPORTED|_UNAVAILABLE\b/i.test(message)) {
    return Object.freeze({ kind: "unavailable", message });
  }
  if (/QQ_OPEN_API_403|\b403\b|11253|permission|forbidden|權限|权限|無權限|无权限|未授權|未授权/i.test(message)) {
    return Object.freeze({ kind: "denied", message });
  }
  if (/timeout|timed out|abort|socket|network|fetch failed|QQ_OPEN_API_5\d\d|QQ_OPEN_LEGACY_ACTION_5\d\d/i.test(message)) {
    return Object.freeze({ kind: "unknown", message });
  }
  return Object.freeze({ kind: "failed", message });
}

function shouldFallbackToOneBot(value) {
  const kind = typeof value === "string" ? value : value?.kind;
  return SAFE_FALLBACK_KINDS.has(String(kind || ""));
}

function numericIdentity(value) {
  const text = clean(value);
  return /^\d{5,20}$/.test(text) ? text : "";
}

function prepareOneBotFallbackPayload(actionPayload = {}, {
  oneBotGroupId = "",
  officialGroupId = "",
  reason = ""
} = {}) {
  const action = clean(actionPayload?.action);
  const params = actionPayload?.params && typeof actionPayload.params === "object" ? { ...actionPayload.params } : {};
  const mappedGroup = numericIdentity(oneBotGroupId);
  const originalGroup = clean(params.group_id || params.group || officialGroupId);
  const isGroupAction = Boolean(originalGroup) || /^set_group_|^get_group_/.test(action) || action === "send_group_msg";

  if (MESSAGE_ID_BOUND_ACTIONS.has(action)) {
    throw new Error("QQ_HYBRID_FALLBACK_MESSAGE_ID_UNSAFE");
  }
  if (isGroupAction) {
    if (!mappedGroup) throw new Error("QQ_HYBRID_FALLBACK_GROUP_MAPPING_REQUIRED");
    params.group_id = Number(mappedGroup);
    if (Object.prototype.hasOwnProperty.call(params, "group")) delete params.group;
  }
  if (USER_TARGET_ACTIONS.has(action)) {
    const user = numericIdentity(params.user_id || params.qq);
    if (!user) throw new Error("QQ_HYBRID_FALLBACK_IDENTITY_REQUIRED");
    params.user_id = Number(user);
    if (Object.prototype.hasOwnProperty.call(params, "qq")) delete params.qq;
  }
  if (action === "send_private_msg" && !numericIdentity(params.user_id)) {
    throw new Error("QQ_HYBRID_FALLBACK_IDENTITY_REQUIRED");
  }
  return Object.freeze({
    action,
    params: Object.freeze(params),
    __qqai_hybrid_fallback: Object.freeze({
      from: "qq-open",
      to: "onebot",
      reason: clean(reason).slice(0, 80)
    })
  });
}

export {
  MESSAGE_ID_BOUND_ACTIONS,
  SAFE_FALLBACK_KINDS,
  USER_TARGET_ACTIONS,
  classifyOfficialCapabilityError,
  numericIdentity,
  prepareOneBotFallbackPayload,
  shouldFallbackToOneBot
};
