import { resolveQqOpenPrincipalForCanonical } from "./resource-tickets.js";

function clean(value, max = 220) {
  return String(value ?? "").trim().slice(0, max);
}

function numericId(value) {
  const text = clean(value, 32).replace(/\D/g, "");
  return /^\d{5,20}$/.test(text) ? text : "";
}

function principalKind(value) {
  const principal = clean(value);
  if (principal.startsWith("qqopen:")) return "qqopen";
  if (principal.startsWith("qq:")) return "qq";
  return "";
}

function principalValue(value) {
  const principal = clean(value);
  const index = principal.indexOf(":");
  return index >= 0 ? principal.slice(index + 1) : "";
}

async function qqOpenMembership(env, groupOpenid, principalId) {
  if (!env?.QQ_OPEN_GATEWAY) return false;
  const qqOpenPrincipal = principalKind(principalId) === "qqopen"
    ? principalId
    : await resolveQqOpenPrincipalForCanonical(env, principalId);
  if (!qqOpenPrincipal) return false;
  const memberOpenid = principalValue(qqOpenPrincipal);
  if (!memberOpenid) return false;
  const stub = env.QQ_OPEN_GATEWAY.get(env.QQ_OPEN_GATEWAY.idFromName("default"));
  const response = await stub.fetch("https://qq-open-gateway/api/v4/qqopen/legacy-action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "get_group_member_info",
      params: { group_id: clean(groupOpenid), user_id: memberOpenid },
      context: { platform: "qq-open", scope: "group", groupId: clean(groupOpenid), userId: memberOpenid }
    })
  });
  const data = await response.json().catch(() => null);
  return Boolean(response.ok && data?.ok === true && data?.data);
}

async function oneBotMembership(env, groupId, principalId) {
  if (!env?.ONEBOT_HUB) return false;
  if (principalKind(principalId) !== "qq") return false;
  const qq = numericId(principalValue(principalId));
  const group = numericId(groupId);
  if (!qq || !group) return false;
  const hub = env.ONEBOT_HUB.get(env.ONEBOT_HUB.idFromName("default"));
  const response = await hub.fetch("https://onebot-hub/rpc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "get_group_member_info",
      params: { group_id: Number(group), user_id: Number(qq), no_cache: true },
      timeoutMs: 8000
    })
  });
  const data = await response.json().catch(() => null);
  return Boolean(response.ok && data?.ok === true && data?.data);
}

function createLiveGroupMembershipResolver(env, {
  platform = "",
  groupId = "",
  currentPrincipalId = ""
} = {}) {
  const transport = clean(platform, 40).toLowerCase();
  const group = clean(groupId);
  const current = clean(currentPrincipalId);
  return async ({ principalId }) => {
    const principal = clean(principalId);
    if (!principal || !group) return false;
    if (current && principal === current) return true;
    if (transport === "qq-open" || principalKind(principal) === "qqopen" || !numericId(group)) {
      return qqOpenMembership(env, group, principal).catch(() => false);
    }
    return oneBotMembership(env, group, principal).catch(() => false);
  };
}

export {
  createLiveGroupMembershipResolver,
  oneBotMembership,
  principalKind,
  principalValue,
  qqOpenMembership
};
