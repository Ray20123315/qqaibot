import { isDeveloperId } from "../core/identity.js";
import { dbGet, dbPut } from "../data/store.js";
import { getPortalSession, jsonResponse, readCookie } from "./auth.js";

const PORTAL_MAINTENANCE_KEY = "portal_maintenance:global";
const PORTAL_MAINTENANCE_API = "/api/portal/maintenance";
const PORTAL_MAINTENANCE_LOGIN_QUERY = "maintenance_login";

function normalizeMaintenanceState(value = {}) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return Object.freeze({
    enabled: source.enabled === true,
    message: String(source.message || "系统正在维护中，请稍后再试。").trim().slice(0, 500) || "系统正在维护中，请稍后再试。",
    updatedAt: Math.max(0, Number(source.updatedAt || 0)),
    updatedBy: String(source.updatedBy || "").slice(0, 64)
  });
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

function maintenanceHtml(state) {
  const message = String(state?.message || "系统正在维护中，请稍后再试。")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark light"><title>QQAI 系统维护</title><style>
  :root{font-family:Inter,"Noto Sans SC","Microsoft YaHei",system-ui,sans-serif;color-scheme:dark;background:#070914;color:#f7f8ff}
  *{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:radial-gradient(circle at 50% 12%,#17204a 0,#0c1025 34%,#070914 68%);padding:24px}
  .shell{width:min(720px,100%);border:1px solid rgba(255,255,255,.11);border-radius:28px;background:rgba(12,16,37,.88);box-shadow:0 30px 90px rgba(0,0,0,.45);padding:42px}
  .mark{width:54px;height:54px;border-radius:17px;display:grid;place-items:center;background:#fff;color:#0b1022;font-weight:900;letter-spacing:-.04em;margin-bottom:28px}
  .eyebrow{font-size:12px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#9da8d6}.title{font-size:clamp(30px,6vw,52px);line-height:1.04;margin:10px 0 14px}.desc{color:#b8bfda;line-height:1.8;font-size:16px;white-space:pre-wrap}
  .status{display:flex;gap:10px;align-items:center;margin:28px 0;padding:14px 16px;border-radius:14px;background:rgba(255,255,255,.05);color:#dfe3f6}.dot{width:9px;height:9px;border-radius:99px;background:#f5b642;box-shadow:0 0 20px #f5b642}
  .actions{display:flex;gap:10px;flex-wrap:wrap}.btn{appearance:none;border:1px solid rgba(255,255,255,.14);border-radius:12px;padding:11px 15px;background:rgba(255,255,255,.06);color:#fff;text-decoration:none;font:inherit;font-weight:750}.btn.primary{background:#fff;color:#10152d}
  .foot{margin-top:22px;color:#6f789d;font-size:12px}
  @media(max-width:600px){.shell{padding:28px 22px;border-radius:22px}.actions{display:grid}.btn{text-align:center}}
  </style></head><body><main class="shell"><div class="mark">AI</div><div class="eyebrow">QQAI Maintenance</div><h1 class="title">系统维护中</h1><div class="desc">${message}</div><div class="status"><span class="dot"></span><span>一般使用者暂时无法进入控制台或使用控制台后端功能。</span></div><div class="actions"><a class="btn primary" href="/portal?${PORTAL_MAINTENANCE_LOGIN_QUERY}=1">开发者／系统管理员登录</a><button class="btn" onclick="location.reload()">重新检查</button></div><div class="foot">已登录的 System Admin 与 Developer 可继续进入后台进行维护。</div></main></body></html>`;
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
  if (!state.enabled) return null;

  const { allowed } = await canBypassPortalMaintenance(request, env);
  if (allowed) return null;

  if (isMaintenanceWebSurface(target) && request.method === "GET") {
    if (target.searchParams.get(PORTAL_MAINTENANCE_LOGIN_QUERY) === "1") return null;
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
    return jsonResponse({
      ok: false,
      code: "PORTAL_MAINTENANCE",
      maintenance: true,
      message: state.message
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
  const previous = await readPortalMaintenanceState(env);
  const next = normalizeMaintenanceState({
    enabled: body.enabled,
    message: body.message === undefined ? previous.message : body.message,
    updatedAt: Date.now(),
    updatedBy: session?.systemAdmin ? "system-admin" : String(session?.qq || "")
  });
  await dbPut(env, PORTAL_MAINTENANCE_KEY, JSON.stringify(next));
  return jsonResponse({
    ok: true,
    state: next,
    message: next.enabled ? "系统维护模式已开启。一般使用者将看到维护页面。" : "系统维护模式已关闭。"
  });
}

export {
  PORTAL_MAINTENANCE_API,
  PORTAL_MAINTENANCE_KEY,
  PORTAL_MAINTENANCE_LOGIN_QUERY,
  canBypassPortalMaintenance,
  handlePortalMaintenanceApi,
  handlePortalMaintenanceGate,
  maintenanceHtml,
  maintenancePrivileged,
  normalizeMaintenanceState,
  readPortalMaintenanceState
};
