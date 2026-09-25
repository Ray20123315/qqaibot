import { isDeveloperId } from "../core/identity.js";
import { dbGet, dbPut } from "../data/store.js";

const PORTAL_MAINTENANCE_KEY = "portal:maintenance:global";
const PORTAL_MAINTENANCE_DEFAULT_TITLE = "系统维护中";
const PORTAL_MAINTENANCE_DEFAULT_MESSAGE = "QQAIbot 控制台正在维护，请稍后再试。";

function maintenanceText(value, fallback, maxLength) {
  const text = String(value ?? "").trim();
  return (text || fallback).slice(0, maxLength);
}

function normalizePortalMaintenanceState(value = {}) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const now = Date.now();
  const until = Math.max(0, Number(source.until || source.endAt || 0));
  const enabled = source.enabled === true && (!until || until > now);
  return Object.freeze({
    enabled,
    title: maintenanceText(source.title, PORTAL_MAINTENANCE_DEFAULT_TITLE, 120),
    message: maintenanceText(source.message, PORTAL_MAINTENANCE_DEFAULT_MESSAGE, 1200),
    until,
    startedAt: Math.max(0, Number(source.startedAt || 0)),
    updatedAt: Math.max(0, Number(source.updatedAt || 0)),
    updatedBy: String(source.updatedBy || "").slice(0, 80)
  });
}

async function getPortalMaintenanceState(env) {
  const raw = await dbGet(env, PORTAL_MAINTENANCE_KEY);
  if (!raw) return normalizePortalMaintenanceState({});
  try {
    return normalizePortalMaintenanceState(JSON.parse(raw));
  } catch {
    return normalizePortalMaintenanceState({});
  }
}

async function setPortalMaintenanceState(env, input = {}, actorId = "") {
  const previous = await getPortalMaintenanceState(env);
  const now = Date.now();
  const enabled = input.enabled === true;
  const until = Math.max(0, Number(input.until || input.endAt || 0));
  if (enabled && until && until <= now) {
    throw Object.assign(new Error("MAINTENANCE_UNTIL_INVALID"), { code: "MAINTENANCE_UNTIL_INVALID" });
  }
  const next = {
    enabled,
    title: maintenanceText(input.title, previous.title, 120),
    message: maintenanceText(input.message, previous.message, 1200),
    until,
    startedAt: enabled ? (previous.enabled ? previous.startedAt || now : now) : 0,
    updatedAt: now,
    updatedBy: String(actorId || "").slice(0, 80)
  };
  await dbPut(env, PORTAL_MAINTENANCE_KEY, JSON.stringify(next));
  return normalizePortalMaintenanceState(next);
}

function portalMaintenanceViewerCanBypass(env, session) {
  if (session?.systemAdmin === true) return true;
  const qq = String(session?.qq || "").replace(/\D/g, "");
  return Boolean(qq && isDeveloperId(env, qq));
}

function maintenanceHeaders(extra = {}) {
  return {
    "Cache-Control": "no-store, max-age=0",
    "X-Robots-Tag": "noindex, nofollow",
    "Retry-After": "60",
    ...extra
  };
}

function portalMaintenanceJsonResponse(state) {
  return new Response(JSON.stringify({
    ok: false,
    maintenance: true,
    code: "PORTAL_MAINTENANCE",
    message: state.message,
    title: state.title,
    until: state.until || 0
  }), {
    status: 503,
    headers: maintenanceHeaders({ "Content-Type": "application/json; charset=utf-8" })
  });
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

function renderPortalMaintenancePage(state, origin = "") {
  const title = escapeHtml(state.title || PORTAL_MAINTENANCE_DEFAULT_TITLE);
  const message = escapeHtml(state.message || PORTAL_MAINTENANCE_DEFAULT_MESSAGE);
  const untilText = state.until ? new Date(state.until).toLocaleString("zh-CN", { timeZone: "Asia/Taipei" }) : "";
  const developerUrl = escapeHtml(String(origin || "").replace(/\/$/, "") + "/portal?developer=1");
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${title} · QQAIbot</title><style>html,body{margin:0;min-height:100%;font-family:Inter,"Noto Sans SC","Microsoft YaHei",system-ui,sans-serif;background:#070a12;color:#eef2ff}body{display:grid;place-items:center;min-height:100vh;padding:24px;box-sizing:border-box;background:radial-gradient(circle at 50% 10%,rgba(90,105,255,.16),transparent 36%),#070a12}.shell{width:min(720px,100%);border:1px solid rgba(148,163,184,.18);background:rgba(15,20,35,.86);backdrop-filter:blur(20px);border-radius:24px;padding:34px;box-sizing:border-box;box-shadow:0 28px 80px rgba(0,0,0,.38)}.mark{width:54px;height:54px;border-radius:17px;display:grid;place-items:center;background:#eef2ff;color:#0b1020;font-weight:900;letter-spacing:-1px;margin-bottom:24px}h1{font-size:30px;margin:0 0 12px}p{color:#aeb8d2;line-height:1.8;margin:0}.meta{margin-top:18px;padding:14px 16px;border-radius:14px;background:rgba(255,255,255,.04);color:#cbd5e1;font-size:14px}.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:24px}.btn{display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:0 17px;border-radius:12px;text-decoration:none;font-weight:700;border:1px solid rgba(148,163,184,.22);color:#e5e7eb;background:rgba(255,255,255,.04)}.btn.primary{background:#eef2ff;color:#111827}.note{font-size:12px;color:#7f8aa6;margin-top:20px}</style></head><body><main class="shell"><div class="mark">AI</div><h1>${title}</h1><p>${message}</p>${untilText ? `<div class="meta">预计恢复时间：${escapeHtml(untilText)}</div>` : ""}<div class="actions"><a class="btn primary" href="">重新检查</a><a class="btn" href="${developerUrl}">开发者入口</a></div><div class="note">开发者与系统管理员完成登录后仍可进入控制台进行维护；普通用户与 Portal 后端请求会暂时阻止。</div></main></body></html>`;
}

function portalMaintenanceHtmlResponse(state, origin = "") {
  return new Response(renderPortalMaintenancePage(state, origin), {
    status: 503,
    headers: maintenanceHeaders({
      "Content-Type": "text/html; charset=utf-8",
      "Strict-Transport-Security": "max-age=31536000",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin"
    })
  });
}

export {
  PORTAL_MAINTENANCE_DEFAULT_MESSAGE,
  PORTAL_MAINTENANCE_DEFAULT_TITLE,
  PORTAL_MAINTENANCE_KEY,
  getPortalMaintenanceState,
  normalizePortalMaintenanceState,
  portalMaintenanceHtmlResponse,
  portalMaintenanceJsonResponse,
  portalMaintenanceViewerCanBypass,
  renderPortalMaintenancePage,
  setPortalMaintenanceState
};
