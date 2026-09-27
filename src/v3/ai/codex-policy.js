import { envInteger } from "../../config/deployment.js";

const CODEX_PUBLIC_DEFAULT_DAILY_REQUESTS = 5;
const CODEX_PUBLIC_DEFAULT_MAX_OUTPUT_TOKENS = 1536;

function taipeiDateKey(now = Date.now()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date(Number(now) || Date.now()));
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function publicCodexQuotaConfig(env = {}) {
  return Object.freeze({
    dailyRequests: envInteger(env.CODEX_PUBLIC_DAILY_REQUESTS, CODEX_PUBLIC_DEFAULT_DAILY_REQUESTS, 1, 1000),
    maxOutputTokens: envInteger(env.CODEX_PUBLIC_MAX_OUTPUT_TOKENS, CODEX_PUBLIC_DEFAULT_MAX_OUTPUT_TOKENS, 256, 8192)
  });
}

function publicCodexQuotaKey(userId, now = Date.now()) {
  const id = String(userId || "").replace(/\D/g, "");
  if (!id) throw new Error("CODEX_PUBLIC_USER_ID_REQUIRED");
  return `codex_public_quota:${taipeiDateKey(now)}:user:${id}`;
}

function quotaStorageError(cause) {
  const error = new Error("CODEX_PUBLIC_QUOTA_STORAGE_UNAVAILABLE");
  error.code = "CODEX_PUBLIC_QUOTA_STORAGE_UNAVAILABLE";
  if (cause) error.cause = cause;
  return error;
}

async function readPublicCodexQuota(env, userId, now = Date.now()) {
  if (!env?.DB) throw quotaStorageError();
  const config = publicCodexQuotaConfig(env);
  const key = publicCodexQuotaKey(userId, now);
  try {
    const row = await env.DB.prepare("SELECT value FROM kv_store WHERE key = ?").bind(key).first();
    const used = Math.max(0, Math.trunc(Number(row?.value || 0)));
    return Object.freeze({
      ok: used < config.dailyRequests,
      date: taipeiDateKey(now),
      used,
      remaining: Math.max(0, config.dailyRequests - used),
      limit: config.dailyRequests,
      maxOutputTokens: config.maxOutputTokens
    });
  } catch (error) {
    throw quotaStorageError(error);
  }
}

async function consumePublicCodexQuota(env, userId, now = Date.now()) {
  if (!env?.DB) throw quotaStorageError();
  const config = publicCodexQuotaConfig(env);
  const key = publicCodexQuotaKey(userId, now);
  try {
    const row = await env.DB.prepare(`INSERT INTO kv_store (key, value) VALUES (?, '1')
      ON CONFLICT(key) DO UPDATE SET value = CAST(COALESCE(kv_store.value, '0') AS INTEGER) + 1
      WHERE CAST(COALESCE(kv_store.value, '0') AS INTEGER) < ?
      RETURNING CAST(value AS INTEGER) AS used`).bind(key, config.dailyRequests).first();
    const used = Math.max(0, Math.trunc(Number(row?.used || 0)));
    if (!used) {
      const state = await readPublicCodexQuota(env, userId, now);
      return Object.freeze({ ...state, ok: false, code: "CODEX_PUBLIC_DAILY_QUOTA_EXHAUSTED" });
    }
    return Object.freeze({
      ok: true,
      date: taipeiDateKey(now),
      used,
      remaining: Math.max(0, config.dailyRequests - used),
      limit: config.dailyRequests,
      maxOutputTokens: config.maxOutputTokens
    });
  } catch (error) {
    if (String(error?.code || error?.message || "") === "CODEX_PUBLIC_QUOTA_STORAGE_UNAVAILABLE") throw error;
    throw quotaStorageError(error);
  }
}

async function refundPublicCodexQuota(env, userId, now = Date.now()) {
  if (!env?.DB) return false;
  const key = publicCodexQuotaKey(userId, now);
  try {
    const result = await env.DB.prepare(`UPDATE kv_store
      SET value = CAST(MAX(0, CAST(COALESCE(value, '0') AS INTEGER) - 1) AS TEXT)
      WHERE key = ?`).bind(key).run();
    return Number(result?.meta?.changes || 0) > 0;
  } catch {
    return false;
  }
}

export {
  CODEX_PUBLIC_DEFAULT_DAILY_REQUESTS,
  CODEX_PUBLIC_DEFAULT_MAX_OUTPUT_TOKENS,
  consumePublicCodexQuota,
  publicCodexQuotaConfig,
  publicCodexQuotaKey,
  readPublicCodexQuota,
  refundPublicCodexQuota,
  taipeiDateKey
};