const DEFAULT_QQ_OPEN_BASE_URL = "https://api.bot.qq.com";
function clean(value) { return String(value ?? "").trim(); }
function encodePath(value, label) { const text = clean(value); if (!text) throw new Error(`QQ_OPEN_${label}_REQUIRED`); return encodeURIComponent(text); }
function safeJson(text) { try { return text ? JSON.parse(text) : null; } catch { return null; } }
function withQuery(path, values = {}) { const params = new URLSearchParams(); for (const [key, value] of Object.entries(values || {})) { if (value === undefined || value === null || value === "") continue; params.set(key, String(value)); } const query = params.toString(); return query ? `${path}?${query}` : path; }
function createQqOpenApiClient({ appId, clientSecret, fetchImpl = fetch, baseUrl = DEFAULT_QQ_OPEN_BASE_URL, now = () => Date.now() } = {}) {
  const id = clean(appId); const secret = clean(clientSecret); const root = clean(baseUrl).replace(/\/+$/, "");
  if (!id) throw new Error("QQ_OPEN_APP_ID_REQUIRED");
  if (!secret) throw new Error("QQ_OPEN_CLIENT_SECRET_REQUIRED");
  if (typeof fetchImpl !== "function") throw new Error("QQ_OPEN_FETCH_REQUIRED");
  let token = ""; let tokenExpiresAt = 0;
  async function getAccessToken({ force = false } = {}) {
    if (!force && token && Number(now()) < tokenExpiresAt - 60_000) return token;
    const response = await fetchImpl(`${root}/app/getAppAccessToken`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ appId: id, clientSecret: secret }) });
    const text = await response.text(); const data = safeJson(text) || {};
    if (!response.ok || !data.access_token) throw new Error(`QQ_OPEN_TOKEN_${response.status}:${clean(data.message || data.msg || text).slice(0, 240)}`);
    token = clean(data.access_token); tokenExpiresAt = Number(now()) + Math.max(60, Number(data.expires_in || 7200)) * 1000; return token;
  }
  async function request(path, { method = "GET", body, headers = {}, retryAuth = true } = {}) {
    const accessToken = await getAccessToken();
    const response = await fetchImpl(`${root}${path}`, { method, headers: { Authorization: `QQBot ${accessToken}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
    if (response.status === 401 && retryAuth) { await getAccessToken({ force: true }); return request(path, { method, body, headers, retryAuth: false }); }
    const text = await response.text(); const data = safeJson(text);
    if (!response.ok) throw new Error(`QQ_OPEN_API_${response.status}:${clean(data?.message || data?.msg || text).slice(0, 300)}`);
    return data ?? text;
  }
  return Object.freeze({
    getAccessToken,
    request,
    getGateway: () => request("/gateway"),
    getGatewayBot: () => request("/gateway/bot"),
    getMenu: () => request("/v2/menu"),
    putMenu: menu => request("/v2/menu", { method: "PUT", body: menu }),
    listPanels: () => request("/v2/panels"),
    createPanel: panel => request("/v2/panels", { method: "POST", body: panel }),
    updatePanel: (panelId, panel) => request(`/v2/panels/${encodePath(panelId, "PANEL_ID")}`, { method: "PUT", body: panel }),
    deletePanel: panelId => request(`/v2/panels/${encodePath(panelId, "PANEL_ID")}`, { method: "DELETE" }),
    sendGroupMessage: (groupOpenid, message) => request(`/v2/groups/${encodePath(groupOpenid, "GROUP_OPENID")}/messages`, { method: "POST", body: message }),
    sendC2CMessage: (openid, message) => request(`/v2/users/${encodePath(openid, "OPENID")}/messages`, { method: "POST", body: message }),
    deleteGroupMessage: (groupOpenid, messageId, { hideTip = false } = {}) => request(`/v2/groups/${encodePath(groupOpenid, "GROUP_OPENID")}/messages/${encodePath(messageId, "MESSAGE_ID")}${hideTip ? "?hidetip=true" : ""}`, { method: "DELETE" }),\n    deleteC2CMessage: (openid, messageId) => request(`/v2/users/${encodePath(openid, "OPENID")}/messages/${encodePath(messageId, "MESSAGE_ID")}`, { method: "DELETE" }),
    uploadGroupFile: (groupOpenid, payload) => request(`/v2/groups/${encodePath(groupOpenid, "GROUP_OPENID")}/files`, { method: "POST", body: payload }),
    uploadC2CFile: (openid, payload) => request(`/v2/users/${encodePath(openid, "OPENID")}/files`, { method: "POST", body: payload }),
    getGroupInfo: groupOpenid => request(`/v2/groups/${encodePath(groupOpenid, "GROUP_OPENID")}/info`),
    getGroupBotState: groupOpenid => request(`/v2/groups/${encodePath(groupOpenid, "GROUP_OPENID")}/bot_state`),
    getGroupMembers: (groupOpenid, { cursor = "", limit = 20 } = {}) => request(withQuery(`/v2/groups/${encodePath(groupOpenid, "GROUP_OPENID")}/members`, { cursor, limit })),
    getGroupMember: (groupOpenid, memberOpenid) => request(`/v2/groups/${encodePath(groupOpenid, "GROUP_OPENID")}/members/${encodePath(memberOpenid, "MEMBER_OPENID")}`),
    removeGroupMembers: (groupOpenid, payload) => request(`/v2/groups/${encodePath(groupOpenid, "GROUP_OPENID")}/batch_remove_members`, { method: "POST", body: payload }),
    getGroupBlacklist: (groupOpenid, { cursor = "", limit = 20 } = {}) => request(withQuery(`/v2/groups/${encodePath(groupOpenid, "GROUP_OPENID")}/member_blacklist`, { cursor, limit })),
    updateGroupBlacklist: (groupOpenid, payload) => request(`/v2/groups/${encodePath(groupOpenid, "GROUP_OPENID")}/member_blacklist`, { method: "POST", body: payload }),
    getGroupJoinRequests: (groupOpenid, { cursor = "", limit = 20 } = {}) => request(withQuery(`/v2/groups/${encodePath(groupOpenid, "GROUP_OPENID")}/join_request_list`, { cursor, limit })),
    reviewGroupJoinRequest: (groupOpenid, memberOpenid, payload) => request(`/v2/groups/${encodePath(groupOpenid, "GROUP_OPENID")}/approval_join_request/${encodePath(memberOpenid, "MEMBER_OPENID")}`, { method: "POST", body: payload }),
    getGroupMuteSetting: groupOpenid => request(`/v2/groups/${encodePath(groupOpenid, "GROUP_OPENID")}/restrict_chat_setting`),
    setGroupMuteSetting: (groupOpenid, payload) => request(`/v2/groups/${encodePath(groupOpenid, "GROUP_OPENID")}/restrict_chat_setting`, { method: "POST", body: payload })
  });
}
export { DEFAULT_QQ_OPEN_BASE_URL, createQqOpenApiClient };
