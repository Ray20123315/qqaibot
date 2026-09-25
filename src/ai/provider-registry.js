import { dbDel, dbGet, dbPut } from "../data/store.js";

const AI_PROVIDER_TYPES = Object.freeze([
  "google_gemini",
  "google_gemma",
  "deepseek",
  "openai_api",
  "codex_bridge",
  "cloudflare_workers_ai",
  "cloudflare_ai_gateway",
  "openai_compatible"
]);

const AI_PROVIDER_TASKS = Object.freeze([
  "chat",
  "decision",
  "summary",
  "vision",
  "tts",
  "code",
  "image"
]);

const PROVIDER_ACCOUNT_INDEX_KEY = "ai_provider_account:index";
const PROVIDER_ROUTE_PREFIX = "ai_provider_route:";
const PROVIDER_ACCOUNT_PREFIX = "ai_provider_account:";
const PROVIDER_USAGE_PREFIX = "ai_provider_usage:";

function cleanId(value, fallback = "") {
  const raw = String(value || fallback).trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return raw.slice(0, 80);
}

function finiteNonNegative(value, fallback = null) {
  if (value === "" || value === null || value === undefined) return fallback;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function normalizeProviderType(value) {
  const raw = String(value || "").trim().toLowerCase();
  return AI_PROVIDER_TYPES.includes(raw) ? raw : "";
}

function normalizeTaskKinds(value) {
  const source = Array.isArray(value) ? value : String(value || "").split(/[,\s]+/);
  return [...new Set(source.map(v => String(v || "").trim().toLowerCase()).filter(v => AI_PROVIDER_TASKS.includes(v)))];
}

function normalizeQuota(input = {}) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  return Object.freeze({
    dailyMoney: finiteNonNegative(source.dailyMoney),
    monthlyMoney: finiteNonNegative(source.monthlyMoney),
    dailyInputTokens: finiteNonNegative(source.dailyInputTokens),
    dailyOutputTokens: finiteNonNegative(source.dailyOutputTokens),
    monthlyInputTokens: finiteNonNegative(source.monthlyInputTokens),
    monthlyOutputTokens: finiteNonNegative(source.monthlyOutputTokens),
    remainingMoneyReported: finiteNonNegative(source.remainingMoneyReported),
    remainingTokensReported: finiteNonNegative(source.remainingTokensReported),
    resetAt: source.resetAt ? String(source.resetAt).slice(0, 80) : "",
    note: String(source.note || "").slice(0, 500)
  });
}

function normalizeProviderAccount(input = {}, previous = null) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const old = previous && typeof previous === "object" ? previous : {};
  const provider = normalizeProviderType(source.provider ?? old.provider);
  if (!provider) throw new Error("AI_PROVIDER_TYPE_INVALID");
  const generatedId = provider + "-" + crypto.randomUUID().slice(0, 8);
  const id = cleanId(source.id ?? old.id ?? generatedId);
  if (!id) throw new Error("AI_PROVIDER_ACCOUNT_ID_INVALID");
  const tasks = normalizeTaskKinds(source.tasks ?? old.tasks ?? []);
  return Object.freeze({
    schemaVersion: 1,
    id,
    provider,
    label: String(source.label ?? old.label ?? id).trim().slice(0, 120) || id,
    enabled: source.enabled === undefined ? old.enabled !== false : source.enabled !== false,
    tasks: Object.freeze(tasks),
    endpoint: String(source.endpoint ?? old.endpoint ?? "").trim().slice(0, 1000),
    model: String(source.model ?? old.model ?? "").trim().slice(0, 180),
    accountId: String(source.accountId ?? old.accountId ?? "").trim().slice(0, 180),
    gatewayId: String(source.gatewayId ?? old.gatewayId ?? "").trim().slice(0, 180),
    billingMode: String(source.billingMode ?? old.billingMode ?? "unknown").trim().toLowerCase().slice(0, 60),
    currency: String(source.currency ?? old.currency ?? "").trim().toUpperCase().slice(0, 12),
    quota: normalizeQuota(source.quota ?? old.quota ?? {}),
    secretEnv: String(source.secretEnv ?? old.secretEnv ?? "").trim().replace(/[^A-Z0-9_]/gi, "").slice(0, 120),
    hasEncryptedSecret: Boolean(source.encryptedSecret ?? old.encryptedSecret),
    encryptedSecret: source.encryptedSecret ?? old.encryptedSecret ?? null,
    metadata: source.metadata && typeof source.metadata === "object" && !Array.isArray(source.metadata)
      ? Object.fromEntries(Object.entries(source.metadata).slice(0, 40).map(([key, value]) => [String(key).slice(0, 80), String(value ?? "").slice(0, 500)]))
      : (old.metadata || {}),
    createdAt: Number(old.createdAt || source.createdAt || Date.now()),
    updatedAt: Date.now()
  });
}

function safeProviderAccount(account) {
  if (!account) return null;
  const { encryptedSecret, ...safe } = account;
  return Object.freeze({ ...safe, hasSecret: Boolean(account.encryptedSecret || account.secretEnv) });
}

function providerEncryptionMaterial(env = {}) {
  const material = String(env.AI_PROVIDER_ENCRYPTION_KEY || env.PORTAL_AUTH_SECRET || "").trim();
  if (material.length < 24) throw Object.assign(new Error("AI_PROVIDER_ENCRYPTION_KEY_REQUIRED"), { code: "AI_PROVIDER_ENCRYPTION_KEY_REQUIRED" });
  return material;
}

function bytesToBase64Url(bytes) {
  let binary = "";
  for (const value of bytes) binary += String.fromCharCode(value);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value) {
  const raw = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = raw + "=".repeat((4 - raw.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

async function providerEncryptionKey(env) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(providerEncryptionMaterial(env)));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function encryptProviderSecret(env, value) {
  const secret = String(value || "");
  if (!secret) return null;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new Uint8Array(await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await providerEncryptionKey(env),
    new TextEncoder().encode(secret)
  ));
  return Object.freeze({ version: 1, iv: bytesToBase64Url(iv), data: bytesToBase64Url(data) });
}

async function decryptProviderSecret(env, payload) {
  if (!payload?.iv || !payload?.data) return "";
  const clear = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64UrlToBytes(payload.iv) },
    await providerEncryptionKey(env),
    base64UrlToBytes(payload.data)
  );
  return new TextDecoder().decode(clear);
}

async function readJsonValue(env, key, fallback) {
  const raw = await dbGet(env, key);
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
}

async function listProviderAccountIds(env) {
  const list = await readJsonValue(env, PROVIDER_ACCOUNT_INDEX_KEY, []);
  return Array.isArray(list) ? [...new Set(list.map(cleanId).filter(Boolean))].slice(0, 100) : [];
}

async function getProviderAccount(env, id, { includeSecret = false } = {}) {
  const key = cleanId(id);
  if (!key) return null;
  const raw = await readJsonValue(env, PROVIDER_ACCOUNT_PREFIX + key, null);
  if (!raw) return null;
  const account = normalizeProviderAccount(raw, raw);
  if (!includeSecret) return safeProviderAccount(account);
  let secret = "";
  if (account.secretEnv) secret = String(env?.[account.secretEnv] || "");
  else if (account.encryptedSecret) secret = await decryptProviderSecret(env, account.encryptedSecret);
  return Object.freeze({ ...account, secret });
}

async function listProviderAccounts(env) {
  const ids = await listProviderAccountIds(env);
  const accounts = [];
  for (const id of ids) {
    const account = await getProviderAccount(env, id);
    if (account) accounts.push(account);
  }
  return accounts;
}

async function upsertProviderAccount(env, input = {}) {
  const requestedId = cleanId(input.id);
  const previousRaw = requestedId ? await readJsonValue(env, PROVIDER_ACCOUNT_PREFIX + requestedId, null) : null;
  let encryptedSecret = previousRaw?.encryptedSecret || null;
  if (Object.prototype.hasOwnProperty.call(input, "secret")) {
    encryptedSecret = input.secret ? await encryptProviderSecret(env, input.secret) : null;
  }
  const account = normalizeProviderAccount({ ...input, encryptedSecret }, previousRaw);
  await dbPut(env, PROVIDER_ACCOUNT_PREFIX + account.id, JSON.stringify(account));
  const ids = await listProviderAccountIds(env);
  if (!ids.includes(account.id)) {
    ids.push(account.id);
    await dbPut(env, PROVIDER_ACCOUNT_INDEX_KEY, JSON.stringify(ids.slice(-100)));
  }
  return safeProviderAccount(account);
}

async function deleteProviderAccount(env, id) {
  const key = cleanId(id);
  if (!key) return false;
  await dbDel(env, PROVIDER_ACCOUNT_PREFIX + key);
  const ids = (await listProviderAccountIds(env)).filter(item => item !== key);
  await dbPut(env, PROVIDER_ACCOUNT_INDEX_KEY, JSON.stringify(ids));
  for (const task of AI_PROVIDER_TASKS) {
    const route = await readProviderRoute(env, task);
    if (route.includes(key)) await writeProviderRoute(env, task, route.filter(item => item !== key));
  }
  return true;
}

async function readProviderRoute(env, task) {
  const kind = String(task || "").trim().toLowerCase();
  if (!AI_PROVIDER_TASKS.includes(kind)) throw new Error("AI_PROVIDER_TASK_INVALID");
  const route = await readJsonValue(env, PROVIDER_ROUTE_PREFIX + kind, []);
  return Array.isArray(route) ? [...new Set(route.map(cleanId).filter(Boolean))].slice(0, 100) : [];
}

async function writeProviderRoute(env, task, accountIds = []) {
  const kind = String(task || "").trim().toLowerCase();
  if (!AI_PROVIDER_TASKS.includes(kind)) throw new Error("AI_PROVIDER_TASK_INVALID");
  const known = new Set(await listProviderAccountIds(env));
  const route = [...new Set((Array.isArray(accountIds) ? accountIds : []).map(cleanId).filter(id => known.has(id)))].slice(0, 100);
  await dbPut(env, PROVIDER_ROUTE_PREFIX + kind, JSON.stringify(route));
  return route;
}

function taipeiDayKey(now = Date.now()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(now));
}

function taipeiMonthKey(now = Date.now()) {
  return taipeiDayKey(now).slice(0, 7);
}

function usageKey(accountId, period, value) {
  return PROVIDER_USAGE_PREFIX + cleanId(accountId) + ":" + period + ":" + value;
}

function normalizeUsage(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  return {
    inputTokens: finiteNonNegative(source.inputTokens ?? source.prompt_tokens ?? source.promptTokenCount, 0),
    outputTokens: finiteNonNegative(source.outputTokens ?? source.completion_tokens ?? source.candidatesTokenCount, 0),
    money: finiteNonNegative(source.money ?? source.cost, 0),
    requests: Math.max(0, Math.trunc(finiteNonNegative(source.requests, 1) ?? 1))
  };
}

async function readUsage(env, accountId, period, value) {
  const raw = await readJsonValue(env, usageKey(accountId, period, value), null);
  return normalizeUsage(raw || { requests: 0 });
}

async function recordProviderUsage(env, accountId, usage = {}, now = Date.now()) {
  const normalized = normalizeUsage(usage);
  const day = taipeiDayKey(now);
  const month = taipeiMonthKey(now);
  const results = {};
  for (const [period, value] of [["day", day], ["month", month]]) {
    const current = await readUsage(env, accountId, period, value);
    const next = {
      inputTokens: current.inputTokens + normalized.inputTokens,
      outputTokens: current.outputTokens + normalized.outputTokens,
      money: current.money + normalized.money,
      requests: current.requests + normalized.requests,
      updatedAt: now
    };
    await dbPut(env, usageKey(accountId, period, value), JSON.stringify(next));
    results[period] = next;
  }
  return Object.freeze({ day, month, ...results });
}

function quotaAllows(account, dayUsage, monthUsage, estimated = {}) {
  const quota = normalizeQuota(account?.quota || {});
  const estimate = normalizeUsage(estimated);
  const checks = [
    [quota.dailyMoney, dayUsage.money + estimate.money, "daily_money"],
    [quota.monthlyMoney, monthUsage.money + estimate.money, "monthly_money"],
    [quota.dailyInputTokens, dayUsage.inputTokens + estimate.inputTokens, "daily_input_tokens"],
    [quota.dailyOutputTokens, dayUsage.outputTokens + estimate.outputTokens, "daily_output_tokens"],
    [quota.monthlyInputTokens, monthUsage.inputTokens + estimate.inputTokens, "monthly_input_tokens"],
    [quota.monthlyOutputTokens, monthUsage.outputTokens + estimate.outputTokens, "monthly_output_tokens"]
  ];
  for (const [limit, value, reason] of checks) {
    if (limit !== null && value > limit) return Object.freeze({ ok: false, reason, limit, projected: value });
  }
  return Object.freeze({ ok: true, reason: "" });
}

async function providerQuotaState(env, accountId, estimated = {}, now = Date.now()) {
  const account = await getProviderAccount(env, accountId);
  if (!account) return Object.freeze({ ok: false, reason: "account_not_found" });
  const day = taipeiDayKey(now);
  const month = taipeiMonthKey(now);
  const dayUsage = await readUsage(env, account.id, "day", day);
  const monthUsage = await readUsage(env, account.id, "month", month);
  const decision = quotaAllows(account, dayUsage, monthUsage, estimated);
  return Object.freeze({
    ...decision,
    account,
    day,
    month,
    dayUsage,
    monthUsage,
    quota: account.quota
  });
}

async function providerRegistryState(env) {
  const accounts = await listProviderAccounts(env);
  const routes = {};
  for (const task of AI_PROVIDER_TASKS) routes[task] = await readProviderRoute(env, task);
  const quotaStates = {};
  for (const account of accounts) quotaStates[account.id] = await providerQuotaState(env, account.id);
  return Object.freeze({ schemaVersion: 1, accounts: Object.freeze(accounts), routes: Object.freeze(routes), quotaStates: Object.freeze(quotaStates) });
}

export {
  AI_PROVIDER_TASKS,
  AI_PROVIDER_TYPES,
  deleteProviderAccount,
  decryptProviderSecret,
  encryptProviderSecret,
  getProviderAccount,
  listProviderAccounts,
  normalizeProviderAccount,
  normalizeProviderType,
  normalizeQuota,
  normalizeTaskKinds,
  normalizeUsage,
  providerQuotaState,
  providerRegistryState,
  quotaAllows,
  readProviderRoute,
  recordProviderUsage,
  safeProviderAccount,
  upsertProviderAccount,
  writeProviderRoute
};
