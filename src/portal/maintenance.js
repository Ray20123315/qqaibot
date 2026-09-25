import { isDeveloperId } from "../core/identity.js";
import { dbGet, dbPut } from "../data/store.js";
import { getPortalSession, jsonResponse, readCookie } from "./auth.js";

const PORTAL_MAINTENANCE_KEY = "portal_maintenance:global";
const PORTAL_MAINTENANCE_API = "/api/portal/maintenance";
const PORTAL_MAINTENANCE_TYPES = Object.freeze({
  data_update: Object.freeze({ title: "数据更新中", description: "系统正在进行数据库同步，请稍后再试。" }),
  data_maint: Object.freeze({ title: "数据维护中", description: "系统正在进行数据整理与备份，请稍候。" }),
  sys_update: Object.freeze({ title: "系统升级中", description: "我们正在部署新功能，敬请期待！" }),
  sys_maint: Object.freeze({ title: "系统维护中", description: "服务器正在进行例行维护，暂时无法提供服务。" })
});
const PORTAL_MAINTENANCE_DEFAULT_TYPE = "sys_maint";

function maintenanceType(value) {
  const type = String(value || "").trim();
  return Object.prototype.hasOwnProperty.call(PORTAL_MAINTENANCE_TYPES, type) ? type : PORTAL_MAINTENANCE_DEFAULT_TYPE;
}

function maintenanceEnd(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const timestamp = Date.parse(raw);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : "";
}

function normalizeMaintenanceState(value = {}) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const type = maintenanceType(source.type);
  const message = String(source.message ?? "").trim().slice(0, 500);
  return Object.freeze({
    enabled: source.enabled === true,
    type,
    message,
    end: maintenanceEnd(source.end),
    updatedAt: Math.max(0, Number(source.updatedAt || 0)),
    updatedBy: String(source.updatedBy || "").slice(0, 64)
  });
}

function maintenanceStateActive(state, now = Date.now()) {
  if (state?.enabled !== true) return false;
  if (!state.end) return true;
  const endAt = Date.parse(state.end);
  return !Number.isFinite(endAt) || endAt >= Number(now);
}

async function readPortalMaintenanceState(env) {
  const raw = await dbGet(env, PORTAL_MAINTENANCE_KEY);
  if (!raw) return normalizeMaintenanceState();
  try { return normalizeMaintenanceState(JSON.parse(raw)); }
  catch { return normalizeMaintenanceState(); }
}

function maintenancePrivileged(session, env) {
  if (!session) return false;
  return session.systemAdmin === true
    || session?.permissions?.developer === true
    || isDeveloperId(env, session.qq);
}

async function maintenanceSession(request, env) {
  const token = readCookie(request, "qqai_session");
  if (!token) return null;
  return getPortalSession(env, token, { touch: false }).catch(() => null);
}

async function canBypassPortalMaintenance(request, env) {
  const session = await maintenanceSession(request, env);
  return Object.freeze({ allowed: maintenancePrivileged(session, env), session });
}

function escapeMaintenanceHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function maintenanceEndText(value) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Taipei",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(date);
  } catch {
    return date.toISOString().replace("T", " ").slice(0, 16) + " UTC";
  }
}

function maintenanceHtml(state) {
  const normalized = normalizeMaintenanceState(state);
  const detail = PORTAL_MAINTENANCE_TYPES[normalized.type] || PORTAL_MAINTENANCE_TYPES[PORTAL_MAINTENANCE_DEFAULT_TYPE];
  const title = escapeMaintenanceHtml(detail.title);
  const message = escapeMaintenanceHtml(normalized.message || detail.description);
  const endText = escapeMaintenanceHtml(maintenanceEndText(normalized.end));
  const endBlock = endText
    ? `<div class="bg-gray-700/50 p-4 rounded-xl"><p class="text-sm text-gray-400">预计结束时间</p><p class="text-xl font-mono text-green-400 font-bold mt-1">${endText}</p></div>`
    : "";
  return `<!DOCTYPE html><html lang="zh-CN" class="dark"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${title}</title><script src="https://cdn.tailwindcss.com"></script><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css"><style>
    ::-webkit-scrollbar { width: 8px; height: 8px; }
    ::-webkit-scrollbar-track { background: #1f2937; }
    ::-webkit-scrollbar-thumb { background: #4b5563; border-radius: 4px; }
  </style></head><body class="bg-gray-900 text-white min-h-screen flex items-center justify-center p-4"><div class="max-w-md w-full text-center space-y-8 bg-gray-800 p-10 rounded-3xl shadow-2xl border border-gray-700"><div class="text-7xl text-yellow-500 animate-pulse"><i class="fas fa-tools"></i></div><div><h1 class="text-3xl font-bold text-white mb-2">${title}</h1><p class="text-gray-400 text-lg">${message}</p></div>${endBlock}</div></body></html>`;
}

function isMaintenanceWebSurface(url) {
  return ["/", "/portal", "/matrix"].includes(url.pathname);
}

function isMaintenanceProtectedApi(url) {
  return url.pathname.startsWith("/api/portal/");
}

async function handlePortalMaintenanceGate(request, env, url = null) {
  const target = url instanceof URL ? url : new URL(request.url);
  if (target.pathname === PORTAL_MAINTENANCE_API) return null;
  if (!isMaintenanceWebSurface(target) && !isMaintenanceProtectedApi(target)) return null;

  const state = await readPortalMaintenanceState(env);
  if (!maintenanceStateActive(state)) return null;

  const { allowed, session } = await canBypassPortalMaintenance(request, env);
  if (allowed) return null;

  // Match the reference backend-maintenance flow: public/login entry remains reachable.
  // Maintenance only replaces the authenticated backend for ordinary users.
  if (!session) return null;

  if (isMaintenanceWebSurface(target) && request.method === "GET") {
    return new Response(maintenanceHtml(state), {
      status: 503,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Retry-After": "300",
        "X-Robots-Tag": "noindex"
      }
    });
  }

  if (isMaintenanceProtectedApi(target)) {
    const detail = PORTAL_MAINTENANCE_TYPES[state.type] || PORTAL_MAINTENANCE_TYPES[PORTAL_MAINTENANCE_DEFAULT_TYPE];
    return jsonResponse({
      ok: false,
      code: "PORTAL_MAINTENANCE",
      maintenance: true,
      state: { type: state.type, end: state.end },
      message: state.message || detail.description
    }, 503, { "Retry-After": "300" });
  }
  return null;
}

async function handlePortalMaintenanceApi(request, env, url = null) {
  const target = url instanceof URL ? url : new URL(request.url);
  if (target.pathname !== PORTAL_MAINTENANCE_API) return null;

  const { allowed, session } = await canBypassPortalMaintenance(request, env);
  if (!allowed) {
    return jsonResponse({ ok: false, code: "MAINTENANCE_DEVELOPER_REQUIRED", message: "只有 System Admin 或 Developer 可以管理系统维护模式。" }, 403);
  }

  if (request.method === "GET") {
    const state = await readPortalMaintenanceState(env);
    return jsonResponse({ ok: true, state, bypass: true });
  }

  if (request.method !== "POST" && request.method !== "PUT") {
    return jsonResponse({ ok: false, code: "METHOD_NOT_ALLOWED" }, 405, { Allow: "GET, POST, PUT" });
  }
  let origin = "";
  try { origin = new URL(request.headers.get("Origin") || "").origin; } catch {}
  if (origin && origin !== target.origin) {
    return jsonResponse({ ok: false, code: "ORIGIN_INVALID", message: "请从当前 QQAI 控制台修改维护状态。" }, 403);
  }
  const body = await request.json().catch(() => ({}));
  if (typeof body.enabled !== "boolean") {
    return jsonResponse({ ok: false, code: "MAINTENANCE_ENABLED_REQUIRED", message: "enabled 必须是 boolean。" }, 400);
  }
  if (body.type !== undefined && !Object.prototype.hasOwnProperty.call(PORTAL_MAINTENANCE_TYPES, String(body.type || ""))) {
    return jsonResponse({ ok: false, code: "MAINTENANCE_TYPE_INVALID", message: "维护类型无效。" }, 400);
  }
  if (body.end !== undefined && String(body.end || "").trim() && !maintenanceEnd(body.end)) {
    return jsonResponse({ ok: false, code: "MAINTENANCE_END_INVALID", message: "预计结束时间格式无效。" }, 400);
  }

  const previous = await readPortalMaintenanceState(env);
  const next = normalizeMaintenanceState({
    enabled: body.enabled,
    type: body.type === undefined ? previous.type : body.type,
    message: body.message === undefined ? previous.message : body.message,
    end: body.end === undefined ? previous.end : body.end,
    updatedAt: Date.now(),
    updatedBy: session?.systemAdmin ? "system-admin" : String(session?.qq || "")
  });
  await dbPut(env, PORTAL_MAINTENANCE_KEY, JSON.stringify(next));
  return jsonResponse({
    ok: true,
    state: next,
    message: next.enabled
      ? "系统维护模式已开启。未登录时仍可进入登录页，一般账号登录后进入后台时会看到维护页面。"
      : "系统维护模式已关闭。"
  });
}

export {
  PORTAL_MAINTENANCE_API,
  PORTAL_MAINTENANCE_KEY,
  PORTAL_MAINTENANCE_TYPES,
  canBypassPortalMaintenance,
  handlePortalMaintenanceApi,
  handlePortalMaintenanceGate,
  maintenanceHtml,
  maintenancePrivileged,
  maintenanceStateActive,
  normalizeMaintenanceState,
  readPortalMaintenanceState
};
