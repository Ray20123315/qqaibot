import { callOneBotAction } from "../core/permissions.js";
import { numericId } from "../security/network.js";

function cleanQq(value) {
  return String(value ?? "").replace(/\D/g, "");
}

function oneBotData(value) {
  return value?.data && typeof value.data === "object" ? value.data : (value && typeof value === "object" ? value : {});
}

function normalizePortalAccountIdentity(session = {}, live = {}, source = "portal_session") {
  if (session?.systemAdmin === true) {
    const username = String(session.username || "admin").trim() || "admin";
    return Object.freeze({
      kind: "system_admin",
      qq: "",
      username,
      nickname: "",
      card: "",
      displayName: username,
      groupRole: "developer",
      source: "system_admin",
      live: false
    });
  }
  const raw = oneBotData(live);
  const qq = cleanQq(raw.user_id ?? raw.userId ?? raw.qq ?? session.qq);
  const nickname = String(raw.nickname ?? raw.nick ?? raw.name ?? "").trim();
  const card = String(raw.card ?? raw.card_name ?? "").trim();
  const groupRole = String(raw.role ?? session.role ?? "member").trim() || "member";
  return Object.freeze({
    kind: "qq",
    qq,
    username: "",
    nickname,
    card,
    displayName: card || nickname || (qq ? `QQ ${qq}` : "QQ 使用者"),
    groupRole,
    source: String(source || "portal_session"),
    live: source !== "portal_session"
  });
}

async function resolvePortalAccountIdentity(env, session = {}, dependencies = {}) {
  const fallback = normalizePortalAccountIdentity(session);
  if (session?.systemAdmin === true || !fallback.qq) return fallback;
  const callAction = dependencies.callOneBotAction || ((payload, timeoutMs) => callOneBotAction(env, payload, timeoutMs));
  const groupId = cleanQq(session.groupId);
  if (groupId) {
    try {
      const member = await callAction({
        action: "get_group_member_info",
        params: { group_id: numericId(groupId), user_id: numericId(fallback.qq), no_cache: false }
      }, 8000);
      const normalized = normalizePortalAccountIdentity(session, member, "onebot_group_member_info");
      if (normalized.nickname || normalized.card) return normalized;
    } catch {}
  }
  try {
    const stranger = await callAction({
      action: "get_stranger_info",
      params: { user_id: numericId(fallback.qq), no_cache: false }
    }, 8000);
    return normalizePortalAccountIdentity(session, stranger, "onebot_stranger_info");
  } catch {
    return fallback;
  }
}

export { cleanQq, normalizePortalAccountIdentity, oneBotData, resolvePortalAccountIdentity };
