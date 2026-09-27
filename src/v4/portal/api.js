import { isDeveloperId } from "../../core/identity.js";
import { getPortalSession, jsonResponse, readCookie } from "../../portal/auth.js";
import { createQqOpenApiClient } from "../qqopen/api.js";
import { hybridStatus } from "../hybrid/ownership.js";
import { getQqOpenGateway, qqOpenConfigured, qqOpenEnabled } from "../qqopen/runtime.js";

const BASE = "/api/portal/v4/qqopen";

function clean(value) {
  return String(value ?? "").trim();
}

function limitNumber(value, fallback = 20, max = 100) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(max, Math.floor(n)));
}

function qqOpenPortalError(error, fallback = "QQ Open 操作失败。") {
  const raw = clean(error?.message || error);
  const permission = /11253|permission|forbidden|权限/i.test(raw);
  return {
    ok: false,
    code: permission ? "QQ_OPEN_PERMISSION_REQUIRED" : "QQ_OPEN_REQUEST_FAILED",
    message: permission ? "当前机器人没有这项 QQ 官方权限；请检查开放平台权限或内邀状态。" : fallback,
    detail: raw.slice(0, 320)
  };
}

async function authPortal(request, env) {
  const token = readCookie(request, "qqai_session");
  const session = await getPortalSession(env, token, { touch: false }).catch(() => null);
  if (!session) return { ok: false, response: jsonResponse({ ok: false, message: "请先登录 Portal。" }, 401) };
  const developer = Boolean(session.systemAdmin || isDeveloperId(env, session.qq));
  if (!developer) return { ok: false, response: jsonResponse({ ok: false, message: "此页面仅供开发者使用。" }, 403) };
  return { ok: true, session };
}

function checkMutationOrigin(request) {
  let origin = "";
  let requestOrigin = "";
  try {
    const url = new URL(request.url);
    requestOrigin = url.origin;
    origin = new URL(request.headers.get("Origin") || "").origin;
  } catch {}
  return origin && origin === requestOrigin;
}

function apiFor(env) {
  return createQqOpenApiClient({
    appId: env.QQ_OPEN_APP_ID,
    clientSecret: env.QQ_OPEN_CLIENT_SECRET
  });
}

async function readBody(request) {
  try { return await request.json(); } catch { return {}; }
}

async function handleV4QqOpenPortalApi(request, env, url = null) {
  const target = url instanceof URL ? url : new URL(request.url);
  if (!target.pathname.startsWith(BASE)) return null;

  const auth = await authPortal(request, env);
  if (!auth.ok) return auth.response;

  if (!["GET", "HEAD"].includes(String(request.method || "GET").toUpperCase()) && !checkMutationOrigin(request)) {
    return jsonResponse({ ok: false, message: "请从同一个后台页面执行操作。" }, 403);
  }

  const path = target.pathname.slice(BASE.length) || "/";
  if (request.method === "GET" && path === "/status") {
    let gateway = null;
    try {
      if (env.QQ_OPEN_GATEWAY) {
        const response = await getQqOpenGateway(env).fetch("https://qq-open-gateway/api/v4/qqopen/status");
        gateway = await response.json().catch(() => null);
      }
    } catch (error) {
      gateway = { connected: false, ready: false, lastError: clean(error?.message || error).slice(0, 240) };
    }
    return jsonResponse({
      ok: true,
      enabled: qqOpenEnabled(env),
      configured: qqOpenConfigured(env),
      gateway,
      hybrid: hybridStatus(env),
      media: {
        receive: ["text", "image", "video", "audio", "file", "emoji"],
        send: ["text", "markdown", "image", "video", "audio", "file"],
        uploadRequiredForRichMedia: true
      },
      groupManagement: {
        members: true,
        memberInfo: true,
        remove: true,
        blacklist: true,
        mute: true,
        joinRequests: true,
        note: "实际可用性仍取决于 QQ 开放平台给当前机器人的权限。"
      }
    });
  }

  if (request.method === "POST" && path === "/gateway/connect") {
    if (!env.QQ_OPEN_GATEWAY) return jsonResponse({ ok: false, message: "QQ Open Gateway 尚未绑定。" }, 503);
    const response = await getQqOpenGateway(env).fetch("https://qq-open-gateway/api/v4/qqopen/connect", { method: "POST" });
    const data = await response.json().catch(() => ({}));
    return jsonResponse(data, response.status);
  }

  if (request.method === "POST" && path === "/gateway/disconnect") {
    if (!env.QQ_OPEN_GATEWAY) return jsonResponse({ ok: false, message: "QQ Open Gateway 尚未绑定。" }, 503);
    const response = await getQqOpenGateway(env).fetch("https://qq-open-gateway/api/v4/qqopen/disconnect", { method: "POST" });
    const data = await response.json().catch(() => ({}));
    return jsonResponse(data, response.status);
  }

  if (!qqOpenConfigured(env)) return jsonResponse({ ok: false, message: "QQ Open AppID/AppSecret 尚未配置。" }, 409);
  const api = apiFor(env);

  try {
    if (request.method === "GET" && path === "/group/info") {
      const groupOpenid = clean(target.searchParams.get("group"));
      const [info, botState] = await Promise.all([
        api.getGroupInfo(groupOpenid),
        api.getGroupBotState(groupOpenid)
      ]);
      return jsonResponse({ ok: true, info, botState });
    }

    if (request.method === "GET" && path === "/group/members") {
      const groupOpenid = clean(target.searchParams.get("group"));
      const result = await api.getGroupMembers(groupOpenid, {
        cursor: clean(target.searchParams.get("cursor")),
        limit: limitNumber(target.searchParams.get("limit"), 20, 100)
      });
      return jsonResponse({ ok: true, result });
    }

    if (request.method === "GET" && path === "/group/blacklist") {
      const groupOpenid = clean(target.searchParams.get("group"));
      const result = await api.getGroupBlacklist(groupOpenid, {
        cursor: clean(target.searchParams.get("cursor")),
        limit: limitNumber(target.searchParams.get("limit"), 20, 100)
      });
      return jsonResponse({ ok: true, result });
    }

    if (request.method === "GET" && path === "/group/join-requests") {
      const groupOpenid = clean(target.searchParams.get("group"));
      const result = await api.getGroupJoinRequests(groupOpenid, {
        cursor: clean(target.searchParams.get("cursor")),
        limit: limitNumber(target.searchParams.get("limit"), 20, 100)
      });
      return jsonResponse({ ok: true, result });
    }

    if (request.method === "GET" && path === "/group/mutes") {
      const groupOpenid = clean(target.searchParams.get("group"));
      const result = await api.getGroupMuteSetting(groupOpenid);
      return jsonResponse({ ok: true, result });
    }

    if (request.method === "POST" && path === "/group/remove-members") {
      const body = await readBody(request);
      const groupOpenid = clean(body.groupOpenid);
      const memberOpenids = [...new Set((Array.isArray(body.memberOpenids) ? body.memberOpenids : []).map(clean).filter(Boolean))].slice(0, 20);
      if (!memberOpenids.length) return jsonResponse({ ok: false, message: "请选择要移出的成员。" }, 400);
      const result = await api.removeGroupMembers(groupOpenid, {
        member_openids: memberOpenids,
        add_to_member_blacklist: body.addToMemberBlacklist === true
      });
      return jsonResponse({ ok: true, result });
    }

    if (request.method === "POST" && path === "/group/blacklist") {
      const body = await readBody(request);
      const groupOpenid = clean(body.groupOpenid);
      const memberOpenids = [...new Set((Array.isArray(body.memberOpenids) ? body.memberOpenids : []).map(clean).filter(Boolean))].slice(0, 20);
      const op = clean(body.op).toLowerCase();
      if (!["add", "del"].includes(op) || !memberOpenids.length) return jsonResponse({ ok: false, message: "黑名单操作参数不完整。" }, 400);
      const result = await api.updateGroupBlacklist(groupOpenid, { op, member_openids: memberOpenids });
      return jsonResponse({ ok: true, result });
    }

    if (request.method === "POST" && path === "/group/join-request") {
      const body = await readBody(request);
      const groupOpenid = clean(body.groupOpenid);
      const memberOpenid = clean(body.memberOpenid);
      const op = clean(body.op).toLowerCase();
      const joinRequestId = clean(body.joinRequestId);
      if (!["approve", "decline"].includes(op) || !joinRequestId) return jsonResponse({ ok: false, message: "入群审批参数不完整。" }, 400);
      const payload = {
        op,
        join_request_id: joinRequestId
      };
      if (op === "decline") {
        payload.reject_reason = clean(body.rejectReason).slice(0, 120);
        payload.add_to_member_blacklist = body.addToMemberBlacklist === true;
      }
      const result = await api.reviewGroupJoinRequest(groupOpenid, memberOpenid, payload);
      return jsonResponse({ ok: true, result });
    }

    if (request.method === "POST" && path === "/group/mute") {
      const body = await readBody(request);
      const groupOpenid = clean(body.groupOpenid);
      const memberOpenid = clean(body.memberOpenid);
      const op = clean(body.op).toLowerCase();
      if (!["add", "update", "del"].includes(op) || !memberOpenid) return jsonResponse({ ok: false, message: "禁言参数不完整。" }, 400);
      const payload = {
        mutes: [{
          op,
          member_openid: memberOpenid,
          mute_expire_at: op === "del" ? "" : clean(body.muteExpireAt)
        }]
      };
      const result = await api.setGroupMuteSetting(groupOpenid, payload);
      return jsonResponse({ ok: true, result });
    }
  } catch (error) {
    return jsonResponse(qqOpenPortalError(error), 502);
  }

  return jsonResponse({ ok: false, message: "未知 QQ Open V4 Portal API。" }, 404);
}

export { BASE as V4_QQOPEN_PORTAL_BASE, handleV4QqOpenPortalApi };
