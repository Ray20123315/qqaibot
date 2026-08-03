// Deployment-facing configuration helpers.
// Keep credentials in Cloudflare Secrets; this module only normalizes public runtime values.

function envString(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || String(fallback ?? "").trim();
}

function envBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") return Boolean(fallback);
  const text = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on", "enable", "enabled", "开", "開", "开启", "開啟"].includes(text)) return true;
  if (["0", "false", "no", "off", "disable", "disabled", "关", "關", "关闭", "關閉"].includes(text)) return false;
  return Boolean(fallback);
}

function envNumber(value, fallback = 0, min = -Number.MAX_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value);
  const safe = Number.isFinite(parsed) ? parsed : Number(fallback);
  return Math.max(min, Math.min(max, Number.isFinite(safe) ? safe : 0));
}

function envInteger(value, fallback = 0, min = -Number.MAX_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER) {
  return Math.trunc(envNumber(value, fallback, min, max));
}

function envList(value, fallback = []) {
  const source = Array.isArray(value) ? value : String(value ?? "").split(/[\n,;]+/g);
  const list = source.map(item => String(item || "").trim()).filter(Boolean);
  if (list.length) return [...new Set(list)];
  return [...new Set((Array.isArray(fallback) ? fallback : [fallback]).map(item => String(item || "").trim()).filter(Boolean))];
}

function normalizeQqId(value) {
  const id = String(value ?? "").replace(/\D/g, "");
  return /^\d{5,20}$/.test(id) ? id : "";
}

function developerIds(env = {}) {
  const values = [
    ...envList(env?.DEVELOPER_IDS),
    ...envList(env?.ROOT_QQ_IDS),
    ...envList(env?.DEVELOPER_ID)
  ];
  return [...new Set(values.map(normalizeQqId).filter(Boolean))];
}

function developerId(env = {}) {
  return developerIds(env)[0] || "";
}

function isDeveloperId(env, qq) {
  const id = normalizeQqId(qq);
  return Boolean(id && developerIds(env).includes(id));
}

function normalizePublicBaseUrl(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  try {
    const url = new URL(text.includes("://") ? text : `https://${text}`);
    if (!/^https?:$/.test(url.protocol)) return "";
    url.pathname = url.pathname.replace(/\/+$/, "");
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

function publicBaseUrl(env = {}, requestOrigin = "") {
  return normalizePublicBaseUrl(env?.PUBLIC_BASE_URL) || normalizePublicBaseUrl(requestOrigin);
}

function publicPortalUrl(env = {}, requestOrigin = "") {
  const base = publicBaseUrl(env, requestOrigin);
  return base ? `${base}/` : "";
}

function publicLiveUrl(env = {}, requestOrigin = "") {
  const base = publicBaseUrl(env, requestOrigin);
  return base ? `${base}/live` : "";
}

function deploymentPublicConfig(env = {}, requestOrigin = "") {
  return Object.freeze({
    developerIds: developerIds(env),
    publicBaseUrl: publicBaseUrl(env, requestOrigin),
    botDisplayName: envString(env?.BOT_DISPLAY_NAME, "QQAI"),
    autoCheckinEnabled: envBoolean(env?.AUTO_CHECKIN_ENABLED, true),
    autoCheckinRetryIntervalMs: envInteger(env?.AUTO_CHECKIN_RETRY_INTERVAL_MS, 1000, 500, 5000),
    autoCheckinConcurrency: envInteger(env?.AUTO_CHECKIN_CONCURRENCY, 12, 1, 30),
    deployNotifyWorkerName: envString(env?.DEPLOY_NOTIFY_WORKER_NAME, "qqai"),
    deployNotifyBranch: envString(env?.DEPLOY_NOTIFY_BRANCH, "main")
  });
}

export {
  deploymentPublicConfig,
  developerId,
  developerIds,
  envBoolean,
  envInteger,
  envList,
  envNumber,
  envString,
  isDeveloperId,
  normalizePublicBaseUrl,
  normalizeQqId,
  publicBaseUrl,
  publicLiveUrl,
  publicPortalUrl
};
