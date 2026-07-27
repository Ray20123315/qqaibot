// Extracted from worker.js without behavioral changes.
// Cloudflare still deploys worker.js as the single Worker entry point.

import { DEFAULTS } from "../config/runtime.js";
import { isDeveloperId } from "../core/identity.js";
import { callOneBotAction, getEffectivePermissions, getRuntimeRateLimitSeconds, normalizeModelPreference, writeSystemAudit } from "../core/permissions.js";
import { dbDel, dbGet, dbPut } from "../data/store.js";
import { toSimplifiedChinese } from "../i18n/commands.js";
import { normalizeRuleProxyMode, normalizeRuleStrictness, parseUnlimitedNonNegativeInteger } from "../moderation/runtime.js";
import { getFeatureFlag, numericId, setFeatureFlag } from "../security/network.js";





function simplifyJsonValue(value) {
  if (typeof value === "string") return toSimplifiedChinese(value);
  if (Array.isArray(value)) return value.map(simplifyJsonValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, simplifyJsonValue(item)]));
  return value;
}



function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(simplifyJsonValue(data)), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extraHeaders
    }
  });
}



function readCookie(request, name) {
  const raw = String(request.headers.get("Cookie") || "");
  for (const part of raw.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return "";
}



function portalSessionCookie(token, maxAgeSeconds = DEFAULTS.portalSessionCookieSeconds) {
  const hasLifetime = maxAgeSeconds !== null && maxAgeSeconds !== undefined;
  const seconds = hasLifetime ? Math.max(0, Number(maxAgeSeconds) || 0) : null;
  const maxAge = hasLifetime ? `; Max-Age=${seconds}` : "";
  const expires = hasLifetime ? `; Expires=${new Date(seconds === 0 ? 0 : Date.now() + seconds * 1000).toUTCString()}` : "";
  return `qqai_session=${encodeURIComponent(token || "")}; Path=/${maxAge}${expires}; HttpOnly; Secure; SameSite=Lax; Priority=High`;
}



function authStorageError(message, cause) {
  const error = new Error(message || "Portal authentication storage unavailable");
  error.code = "PORTAL_AUTH_STORAGE_UNAVAILABLE";
  if (cause) error.cause = cause;
  return error;
}



async function authDbRetry(label, operation, attempts = 3) {
  let lastError = null;
  for (let index = 0; index < attempts; index += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (index + 1 < attempts) await new Promise(resolve => setTimeout(resolve, 60 * (index + 1)));
    }
  }
  throw authStorageError(`${label} failed after ${attempts} attempts`, lastError);
}



async function authDbGetStrict(env, key) {
  if (!env?.DB) throw authStorageError("Missing D1 binding for Portal authentication");
  return authDbRetry(`auth read ${key}`, async () => {
    const result = await env.DB.prepare("SELECT value FROM kv_store WHERE key = ?").bind(key).first();
    return result ? result.value : null;
  });
}



async function authDbPutStrict(env, key, value) {
  if (!env?.DB) throw authStorageError("Missing D1 binding for Portal authentication");
  await authDbRetry(`auth write ${key}`, async () => {
    const result = await env.DB.prepare("INSERT INTO kv_store (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(key, value).run();
    if (result && result.success === false) throw new Error("D1 write reported failure");
    return result;
  });
}



async function authDbDelStrict(env, key) {
  if (!env?.DB) throw authStorageError("Missing D1 binding for Portal authentication");
  await authDbRetry(`auth delete ${key}`, async () => {
    const result = await env.DB.prepare("DELETE FROM kv_store WHERE key = ?").bind(key).run();
    if (result && result.success === false) throw new Error("D1 delete reported failure");
    return result;
  });
}



function randomBytes(length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}



function bytesToBase64Url(bytes) {
  let binary = "";
  for (const value of bytes) binary += String.fromCharCode(value);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}



function base64UrlToBytes(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}



function bytesToHex(bytes) {
  return Array.from(bytes, value => value.toString(16).padStart(2, "0")).join("");
}



function constantTimeEqual(left, right) {
  const a = typeof left === "string" ? new TextEncoder().encode(left) : new Uint8Array(left || []);
  const b = typeof right === "string" ? new TextEncoder().encode(right) : new Uint8Array(right || []);
  let mismatch = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) mismatch |= (a[index % Math.max(1, a.length)] || 0) ^ (b[index % Math.max(1, b.length)] || 0);
  return mismatch === 0;
}



function validatePortalPassword(password) {
  const value = String(password || "");
  if (value.length < 10) return { ok: false, message: "密码至少需要 10 个字符。" };
  if (value.length > 128) return { ok: false, message: "密码不能超过 128 个字符。" };
  if (/^\s+$/.test(value)) return { ok: false, message: "密码不能全部为空白字符。" };
  return { ok: true, value };
}



async function derivePortalPassword(password, salt, iterations = 120000) {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(String(password || "")), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, material, 256);
  return new Uint8Array(bits);
}



async function createPortalPasswordRecord(password) {
  const validation = validatePortalPassword(password);
  if (!validation.ok) throw Object.assign(new Error(validation.message), { code: "PASSWORD_POLICY" });
  const salt = randomBytes(16);
  const iterations = 120000;
  const hash = await derivePortalPassword(validation.value, salt, iterations);
  return { version: 1, algorithm: "PBKDF2-SHA-256", iterations, salt: bytesToBase64Url(salt), hash: bytesToBase64Url(hash), updatedAt: Date.now() };
}



function isValidPortalPasswordRecord(record) {
  if (!record || typeof record !== "object" || record.algorithm !== "PBKDF2-SHA-256") return false;
  const iterations = Number(record.iterations || 0);
  if (!Number.isInteger(iterations) || iterations < 10000 || iterations > 2000000) return false;
  if (typeof record.salt !== "string" || typeof record.hash !== "string") return false;
  try {
    const salt = base64UrlToBytes(record.salt);
    const hash = base64UrlToBytes(record.hash);
    return salt.length >= 16 && salt.length <= 64 && hash.length === 32;
  } catch {
    return false;
  }
}

async function verifyPortalPassword(password, record) {
  if (!isValidPortalPasswordRecord(record)) return false;
  try {
    const actual = await derivePortalPassword(String(password || ""), base64UrlToBytes(record.salt), Number(record.iterations));
    return constantTimeEqual(actual, base64UrlToBytes(record.hash));
  } catch {
    return false;
  }
}



function portalAuthEncryptionMaterial(env) {
  const secret = String(env.PORTAL_AUTH_SECRET || env.ONEBOT_ACCESS_TOKEN || env.ONEBOT_TOKEN || env.NAPCAT_ACCESS_TOKEN || "").trim();
  if (secret.length < 16) {
    const error = new Error("PORTAL_AUTH_SECRET must be configured with at least 16 characters before enabling 2FA");
    error.code = "PORTAL_AUTH_SECRET_MISSING";
    throw error;
  }
  return secret;
}



async function portalAuthEncryptionKey(env) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(portalAuthEncryptionMaterial(env)));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}



async function encryptPortalAuthSecret(env, value) {
  const iv = randomBytes(12);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await portalAuthEncryptionKey(env), new TextEncoder().encode(String(value || "")));
  return { version: 1, iv: bytesToBase64Url(iv), data: bytesToBase64Url(new Uint8Array(encrypted)) };
}



async function decryptPortalAuthSecret(env, payload) {
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: base64UrlToBytes(payload.iv) }, await portalAuthEncryptionKey(env), base64UrlToBytes(payload.data));
  return new TextDecoder().decode(decrypted);
}



const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";


function base32Encode(bytes) {
  let output = "", buffer = 0, bits = 0;
  for (const value of bytes) {
    buffer = (buffer << 8) | value;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(buffer >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(buffer << (5 - bits)) & 31];
  return output;
}



function base32Decode(value) {
  const clean = String(value || "").toUpperCase().replace(/[^A-Z2-7]/g, "");
  let buffer = 0, bits = 0;
  const output = [];
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index < 0) continue;
    buffer = (buffer << 5) | index;
    bits += 5;
    if (bits >= 8) {
      output.push((buffer >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(output);
}



async function generateTotpCode(secret, timestamp = Date.now(), stepSeconds = 30) {
  const counter = Math.floor(timestamp / 1000 / stepSeconds);
  const message = new Uint8Array(8);
  let value = BigInt(counter);
  for (let index = 7; index >= 0; index -= 1) { message[index] = Number(value & 255n); value >>= 8n; }
  const key = await crypto.subtle.importKey("raw", base32Decode(secret), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, message));
  const offset = signature[signature.length - 1] & 15;
  const binary = ((signature[offset] & 127) << 24) | (signature[offset + 1] << 16) | (signature[offset + 2] << 8) | signature[offset + 3];
  return String(binary % 1000000).padStart(6, "0");
}



async function verifyTotpCode(secret, code) {
  const normalized = String(code || "").replace(/\D/g, "");
  if (!/^\d{6}$/.test(normalized)) return false;
  const now = Date.now();
  for (const offset of [-30000, 0, 30000]) if (constantTimeEqual(await generateTotpCode(secret, now + offset), normalized)) return true;
  return false;
}



function generateBackupCodes(count = 10) {
  return Array.from({ length: count }, () => {
    const raw = bytesToHex(randomBytes(4)).toUpperCase();
    return `QQAI-${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
  });
}



function normalizeBackupCode(value) {
  const clean = String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return clean.startsWith("QQAI") ? `QQAI-${clean.slice(4, 8)}-${clean.slice(8, 12)}` : String(value || "").trim().toUpperCase();
}



async function hashBackupCode(env, code) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${portalAuthEncryptionMaterial(env)}:${normalizeBackupCode(code)}`));
  return bytesToBase64Url(new Uint8Array(digest));
}



async function readPortalAuthJson(env, key, fallback = null) {
  const raw = await authDbGetStrict(env, key);
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch (error) { throw authStorageError(`Invalid authentication record ${key}`, error); }
}



async function verifyPortalVerificationCode(env, qq, code, { consume = false } = {}) {
  const key = `portal_auth_code:${qq}`;
  const record = await readPortalAuthJson(env, key, null);
  if (!record) return { ok: false, message: "验证码不存在或已过期，请重新发送。" };
  if (Date.now() > Number(record.expiresAt || 0)) {
    await authDbDelStrict(env, key);
    return { ok: false, message: "验证码已过期，请重新发送。" };
  }
  if (!constantTimeEqual(String(record.code || ""), String(code || "").replace(/\D/g, ""))) {
    record.attempts = Number(record.attempts || 0) + 1;
    if (record.attempts >= 5) await authDbDelStrict(env, key);
    else await authDbPutStrict(env, key, JSON.stringify(record));
    return { ok: false, message: "验证码错误。" };
  }
  if (consume) await authDbDelStrict(env, key);
  return { ok: true, record };
}



async function readPasswordLoginGuard(env, qq) {
  return readPortalAuthJson(env, `portal_auth_guard:${qq}`, { failures: 0, lockUntil: 0 });
}



async function notePasswordLoginFailure(env, qq) {
  const key = `portal_auth_guard:${qq}`;
  const guard = await readPasswordLoginGuard(env, qq);
  guard.failures = Number(guard.failures || 0) + 1;
  guard.lastFailureAt = Date.now();
  if (guard.failures >= 5) { guard.lockUntil = Date.now() + 15 * 60 * 1000; guard.failures = 0; }
  await authDbPutStrict(env, key, JSON.stringify(guard));
  return guard;
}



async function clearPasswordLoginGuard(env, qq) {
  await authDbDelStrict(env, `portal_auth_guard:${qq}`).catch(() => {});
}



function generateSixDigitCode() {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return String(bytes[0] % 1000000).padStart(6, "0");
}



function getOneBotHub(env) {
  if (!env.ONEBOT_HUB) throw new Error("Missing Durable Object binding: ONEBOT_HUB");
  return env.ONEBOT_HUB.get(env.ONEBOT_HUB.idFromName("default"));
}



async function sendOneBotAction(env, actionPayload) {
  try {
    await callOneBotAction(env, actionPayload, 15000);
    return true;
  } catch (error) {
    console.warn("sendOneBotAction failed:", error);
    return false;
  }
}



function oneBotHttpActionUrl(env, action) {
  const raw = String(env.ONEBOT_HTTP_ACTION_URL || env.ONEBOT_HTTP_URL || env.NAPCAT_HTTP_URL || "").trim();
  if (!raw) return null;
  let url;
  try { url = new URL(raw); } catch { return null; }
  if (/\/(?:send_private_msg|send_msg)$/.test(url.pathname)) {
    url.pathname = url.pathname.replace(/\/(?:send_private_msg|send_msg)$/, "/" + action);
  } else {
    url.pathname = url.pathname.replace(/\/+$/, "") + "/" + action;
  }
  return url;
}



async function sendOneBotHttpAction(env, action, params, timeoutMs = 12000) {
  const url = oneBotHttpActionUrl(env, action);
  if (!url) throw new Error("NAPCAT_HTTP_NOT_CONFIGURED");
  const token = String(env.ONEBOT_ACCESS_TOKEN || env.NAPCAT_ACCESS_TOKEN || "").trim();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("NAPCAT_HTTP_TIMEOUT"), Math.max(1000, timeoutMs));
  try {
    const headers = { "Content-Type": "application/json" };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
      headers["X-Access-Token"] = token;
    }
    const response = await fetch(url.toString(), {
      method: "POST",
      headers,
      body: JSON.stringify(params || {}),
      signal: controller.signal
    });
    const data = await response.json().catch(() => null);
    const ok = response.ok && (data?.status === "ok" || Number(data?.retcode ?? 0) === 0);
    if (!ok) throw new Error(data?.message || data?.wording || `NAPCAT_HTTP_${response.status}`);
    return data?.data ?? data;
  } finally {
    clearTimeout(timer);
  }
}



async function sendPortalVerificationMessage(env, qq, message) {
  const userId = numericId(qq);
  message = toSimplifiedChinese(String(message || ""));
  const errors = [];
  const attempts = [
    { transport: "websocket:send_private_msg", payload: { action: "send_private_msg", params: { user_id: userId, message, auto_escape: false } } },
    { transport: "websocket:send_msg", payload: { action: "send_msg", params: { message_type: "private", user_id: userId, message, auto_escape: false } } }
  ];
  for (const attempt of attempts) {
    try {
      await callOneBotAction(env, attempt.payload, 12000);
      return { ok: true, transport: attempt.transport };
    } catch (error) {
      errors.push(`${attempt.transport}:${String(error?.message || error)}`);
    }
  }
  for (const action of ["send_private_msg", "send_msg"]) {
    try {
      const params = action === "send_msg"
        ? { message_type: "private", user_id: userId, message, auto_escape: false }
        : { user_id: userId, message, auto_escape: false };
      await sendOneBotHttpAction(env, action, params, 12000);
      return { ok: true, transport: `http:${action}` };
    } catch (error) {
      errors.push(`http:${action}:${String(error?.message || error)}`);
    }
  }
  return { ok: false, transport: "none", errors };
}





function extractGroupId(groupText) {
  const match = String(groupText || "").match(/\d{5,}/);
  return match ? match[0] : String(groupText || "default").trim();
}



async function readJson(env, key, fallback) {
  const raw = await dbGet(env, key);
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch (e) { return fallback; }
}



async function createPortalSession(env, data) {
  const token = crypto.randomUUID() + crypto.randomUUID();
  const qq = String(data.qq || "");
  const groupId = String(data.groupId || "");
  const role = groupId ? await resolvePortalRole(env, qq, groupId) : (isDeveloperId(env, qq) ? "developer" : "member");
  const permissions = groupId ? await getEffectivePermissions(env, groupId, qq, role, role === "developer") : {
    developer: isDeveloperId(env, qq), nativeAdmin: false, aiAdmin: isDeveloperId(env, qq), groupOps: isDeveloperId(env, qq), scheduleReviewer: isDeveloperId(env, qq), appealReviewer: isDeveloperId(env, qq)
  };
  const now = Date.now();
  const persistent = data.persistent !== false;
  const idleTtlMs = persistent ? DEFAULTS.portalSessionTtlMs : DEFAULTS.portalSessionTemporaryTtlMs;
  const absoluteTtlMs = persistent ? DEFAULTS.portalSessionAbsoluteTtlMs : DEFAULTS.portalSessionTemporaryAbsoluteTtlMs;
  const session = {
    qq,
    group: data.group || "",
    groupId,
    token,
    role,
    permissions,
    persistent,
    idleTtlMs,
    absoluteTtlMs,
    createdAt: now,
    lastActivityAt: now,
    expiresAt: now + idleTtlMs,
    absoluteExpiresAt: now + absoluteTtlMs,
    authenticatedAt: now,
    authMethod: String(data.authMethod || "qq_code")
  };
  const key = `portal_session:${token}`;
  await authDbPutStrict(env, key, JSON.stringify(session));
  const confirmed = await authDbGetStrict(env, key);
  if (!confirmed) throw authStorageError("Portal session write could not be verified");
  return session;
}



async function getPortalSession(env, token, { touch = true } = {}) {
  if (!token) return null;
  const raw = await authDbGetStrict(env, `portal_session:${token}`);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw);
    const now = Date.now();
    const persistent = session.persistent !== false;
    const idleTtlMs = Number(session.idleTtlMs || (persistent ? DEFAULTS.portalSessionTtlMs : DEFAULTS.portalSessionTemporaryTtlMs));
    const absoluteTtlMs = Number(session.absoluteTtlMs || (persistent ? DEFAULTS.portalSessionAbsoluteTtlMs : DEFAULTS.portalSessionTemporaryAbsoluteTtlMs));
    const absoluteExpiresAt = Number(session.absoluteExpiresAt || (Number(session.createdAt || now) + absoluteTtlMs));
    const idleExpiresAt = Number(session.expiresAt || 0);
    if ((idleExpiresAt && now > idleExpiresAt) || now > absoluteExpiresAt) {
      await authDbDelStrict(env, `portal_session:${token}`);
      return null;
    }
    session.persistent = persistent;
    session.idleTtlMs = idleTtlMs;
    session.absoluteTtlMs = absoluteTtlMs;
    session.absoluteExpiresAt = absoluteExpiresAt;
    if (touch) {
      session.lastActivityAt = now;
      session.expiresAt = Math.min(now + idleTtlMs, absoluteExpiresAt);
      await authDbPutStrict(env, `portal_session:${token}`, JSON.stringify(session));
    }
    return session;
  } catch (e) {
    return null;
  }
}



async function resolvePortalRole(env, qq, groupId) {
  if (isDeveloperId(env, qq)) return "developer";
  if (!groupId) return "member";
  try {
    const member = await callOneBotAction(env, { action: "get_group_member_info", params: { group_id: numericId(groupId), user_id: numericId(qq), no_cache: false } }, 8000);
    if (member?.role === "owner") return "owner";
    if (member?.role === "admin") return "admin";
  } catch {}
  const members = await readJson(env, `group_members:${groupId}`, []);
  const member = members.find(m => String(m.qq) === String(qq));
  if (member?.role === "owner") return "owner";
  if (member?.role === "admin") return "admin";
  return "member";
}





function hasAdminRole(role) {
  return ["developer", "owner", "admin"].includes(role);
}



async function upsertGroupMember(env, groupId, member) {
  const key = `group_members:${groupId}`;
  const list = await readJson(env, key, []);
  const idx = list.findIndex(x => String(x.qq) === String(member.qq));
  const active = member.active !== false;
  const next = {
    ...member,
    active,
    leftAt: active ? "" : String(member.leftAt || (idx >= 0 ? list[idx].leftAt : "") || new Date().toISOString()),
    firstSeenAt: member.firstSeenAt || (idx >= 0 ? list[idx].firstSeenAt : new Date().toISOString()),
    lastSeenAt: new Date().toISOString()
  };
  if (idx >= 0) list[idx] = { ...list[idx], ...next };
  else list.push(next);
  if (list.length > 1000) list.splice(0, list.length - 1000);
  await dbPut(env, key, JSON.stringify(list));
  const known = await readJson(env, "known_groups", []);
  const groupIdx = known.findIndex(x => String(x.group_id || x.groupId || x.id || x) === String(groupId));
  const groupRecord = { group_id: String(groupId), group_name: String(member.groupName || groupId), lastSeenAt: new Date().toISOString() };
  if (groupIdx >= 0) known[groupIdx] = { ...(typeof known[groupIdx] === "object" ? known[groupIdx] : {}), ...groupRecord };
  else known.push(groupRecord);
  if (known.length > 1000) known.splice(0, known.length - 1000);
  await dbPut(env, "known_groups", JSON.stringify(known));
}



async function markGroupMemberLeft(env, groupId, userId, details = {}) {
  const key = `group_members:${groupId}`;
  const list = await readJson(env, key, []);
  const idx = list.findIndex(item => String(item.qq) === String(userId));
  const now = new Date().toISOString();
  const previous = idx >= 0 ? list[idx] : { qq: String(userId), name: String(userId), role: "member", firstSeenAt: now };
  const next = {
    ...previous,
    qq: String(userId),
    active: false,
    leftAt: now,
    leaveReason: String(details.reason || "leave"),
    leaveOperatorId: String(details.operatorId || ""),
    groupName: String(details.groupName || previous.groupName || groupId),
    lastSeenAt: previous.lastSeenAt || now
  };
  if (idx >= 0) list[idx] = next; else list.push(next);
  if (list.length > 1000) list.splice(0, list.length - 1000);
  await dbPut(env, key, JSON.stringify(list));
  await writeSystemAudit(env, { type: "group_member_left", groupId: String(groupId), actorId: String(userId), action: next.leaveReason, eligibleUntil: new Date(Date.now() + Number(DEFAULTS.appealFormerMemberDays || 30) * 86400000).toISOString() });
  return next;
}



function getPublicNebulaSeed() {
  return {
    mode: "anonymous_public_mix",
    text_visible: false,
    clusters: ["humor", "knowledge", "daily", "events", "members"],
    particles: 1600
  };
}



async function isMemoryBanned(env, userId) {
  return await dbGet(env, `memory_banned:${userId}`) === "true";
}



async function getUserQuota(env, groupId, userId) {
  const explicit = await dbGet(env, `quota:deepseek:user:${userId}`);
  if (explicit !== null && explicit !== undefined && explicit !== "") return `${explicit} CNY/日`;
  return await dbGet(env, `quota:${groupId}:${userId}`) || "无限";
}



function commandChangesWebSettings(message) {
  const text = String(message || "").trim().toLowerCase();
  if (!/^[!！]/.test(text)) return false;
  if (/^[!！]指令(开|開|关|關)\b/.test(text)) return true;
  return [
    // AI 開關屬於緊急管理指令；即使 Portal 已關閉設定型 ! 指令，仍必須可用。
    "记忆开", "記憶開", "记忆关", "記憶關",
    "切换人格", "切換人格", "恢复人格", "恢復人格", "取消使用",
    "set群规", "set群規", "群规设置", "群規設定",
    "拉黑", "洗白",
    "免打扰", "免打擾", "取消免打扰", "取消免打擾",
    "set人格", "del人格",
    "记住", "記住", "忘记", "忘記",
    "禁记忆", "禁記憶", "解禁记忆", "解禁記憶",
    "banmemory", "unbanmemory",
    "群规监控", "群規監控", "ai群规代理", "ai群規代理", "群规严格度", "群規嚴格度",
    "授权ai踢出", "授權ai踢出", "撤回ai踢出授权", "撤回ai踢出授權",
    "入群辅助", "入群輔助", "授权ai拒绝入群", "授權ai拒絕入群",
    "撤回ai拒绝入群", "撤回ai拒絕入群", "设置处置冷却", "設定處置冷卻",
    "设置速率限制", "設定速率限制", "设置全局速率限制", "設定全域速率限制",
    "自动欢迎", "自動歡迎", "欢迎词", "歡迎詞",
    "好感度注入", "好感度给ai", "好感度給ai", "好感度上下文"
  ].some(cmd => text.startsWith("!" + cmd) || text.startsWith("！" + cmd));
}



async function writeMemoryAudit(env, entry) {
  const auditEntry = {
    id: crypto.randomUUID(),
    groupId: entry.groupId || "",
    userId: entry.userId || "",
    action: entry.action,
    before: entry.before,
    after: entry.after,
    at: new Date().toISOString()
  };
  const globalKey = "audit:memory:global";
  const groupKey = `audit:memory:group:${auditEntry.groupId || "private"}`;
  for (const key of [globalKey, groupKey]) {
    let logs = [];
    const raw = await dbGet(env, key);
    if (raw) {
      try { logs = JSON.parse(raw); } catch (e) { logs = []; }
    }
    logs.push(auditEntry);
    if (logs.length > 500) logs = logs.slice(-500);
    await dbPut(env, key, JSON.stringify(logs));
  }
}



async function writeSystemError(env, err, context = {}) {
  const logs = await readJson(env, "system_error_logs", []);
  logs.push({
    at: new Date().toISOString(),
    message: err?.message || String(err),
    stack: err?.stack || "",
    context
  });
  if (logs.length > 200) logs.splice(0, logs.length - 200);
  await dbPut(env, "system_error_logs", JSON.stringify(logs));
}



function buildGroupReplyMessage(eventBody, replyText) {
  const message = [];
  if (eventBody.message_id !== undefined && eventBody.message_id !== null) {
    message.push({ type: "reply", data: { id: String(eventBody.message_id) } });
  }
  if (eventBody.user_id !== undefined && eventBody.user_id !== null) {
    message.push({ type: "at", data: { qq: String(eventBody.user_id) } });
    message.push({ type: "text", data: { text: " " } });
  }
  message.push({ type: "text", data: { text: String(replyText).replace(new RegExp(`^\\[CQ:at,qq=${eventBody.user_id}\\]\\s*`), "") } });
  return message;
}



async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(String(value || ""));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, "0")).join("");
}



async function migratePortalMemories(env, key, rawList, ownerFallback) {
  const input = Array.isArray(rawList) ? rawList : [];
  const normalized = [];
  let changed = false;
  for (let i = 0; i < input.length; i++) {
    const raw = input[i];
    const item = typeof raw === "string"
      ? { text: raw, scope: "private", owner: ownerFallback, migrated: true }
      : raw && typeof raw === "object" ? { ...raw, text: String(raw.text || ""), owner: String(raw.owner || ownerFallback), scope: raw.scope || "private" } : null;
    if (!item || !item.text.trim()) { changed = true; continue; }
    if (!item.id) {
      item.id = `mem_legacy_${(await sha256Hex(`${key}|${i}|${item.text}`)).slice(0, 24)}`;
      changed = true;
    }
    normalized.push(item);
  }
  if (changed) await dbPut(env, key, JSON.stringify(normalized));
  return normalized;
}



async function upsertMemoryVector(env, item, groupId) {
  if (!env.VECTORIZE || !env.AI || !item?.text) return item;
  const values = await env.AI.run("@cf/baai/bge-m3", { text: [String(item.text)] });
  const vector = values?.data?.[0];
  if (!Array.isArray(vector)) return item;
  const vectorId = String(item.vectorId || `memory_${item.id}`);
  await env.VECTORIZE.upsert([{ id: vectorId, values: vector, metadata: {
    kind: "memory", groupId: String(groupId), subjectQq: String(item.subjectQq || item.owner || ""),
    owner: String(item.owner || ""), scope: String(item.scope || "private"), text: String(item.text), memoryId: String(item.id), updatedAt: Date.now()
  }}]);
  await dbDel(env, `memory_vector_tombstone:${vectorId}`);
  item.vectorId = vectorId;
  return item;
}



async function deleteMemoryVector(env, item) {
  const vectorId = String(item?.vectorId || (item?.id ? `memory_${item.id}` : ""));
  if (!vectorId) return false;
  await dbPut(env, `memory_vector_tombstone:${vectorId}`, "true");
  if (env.VECTORIZE?.deleteByIds) {
    try { await env.VECTORIZE.deleteByIds([vectorId]); return true; } catch (error) { console.warn("Vectorize memory delete failed", error); }
  }
  return false;
}



async function searchPortalVectors(env, { groupId, userId, permissions, query, limit = 20 }) {
  if (!env.VECTORIZE || !env.AI || !query) return [];
  const embedded = await env.AI.run("@cf/baai/bge-m3", { text: [String(query)] });
  const vector = embedded?.data?.[0];
  if (!Array.isArray(vector)) return [];
  const result = await env.VECTORIZE.query(vector, { topK: Math.max(1, Math.min(50, limit)), returnMetadata: "all", filter: { kind: "chat_log", groupId: String(groupId) } });
  return (result?.matches || []).filter(match => {
    const meta = match.metadata || {};
    if (meta.kind !== "chat_log" || String(meta.groupId || meta.group_id || "") !== String(groupId)) return false;
    if (permissions?.nativeAdmin || permissions?.aiAdmin || permissions?.developer) return true;
    return String(meta.qq || meta.userId || meta.author || "") === String(userId);
  }).map(match => ({ id: match.id, score: match.score, text: match.metadata?.text || "", qq: match.metadata?.qq || "", createdAt: match.metadata?.createdAt || null }));
}



const PORTAL_SETTING_DEFINITIONS = Object.freeze([
  { key: "dnd", label: "免打扰", command: "!免打扰 / !取消免打扰", minRole: "member", scope: "user", type: "boolean", defaultValue: false },
  { key: "custom_style", label: "个人回复风格", command: "!set人格 / !del人格", minRole: "member", scope: "user", type: "text", defaultValue: "" },
  { key: "model_preference", label: "模型偏好", command: "!模型", minRole: "member", scope: "user", type: "select", options: ["auto", "gemma_26b", "gemma_31b", "gemini", "deepseek", "deepseek_high", "deepseek_max"], defaultValue: "auto" },
  { key: "ai_on", label: "启用群 AI", command: "!开启ai / !关闭ai", minRole: "admin", scope: "group", type: "boolean", defaultValue: true },
  { key: "memory_on", label: "启用长期记忆", command: "!记忆开 / !记忆关", minRole: "admin", scope: "group", type: "boolean", defaultValue: true },
  { key: "commands_enabled", label: "启用设置型 ! 指令", command: "!指令开 / !指令关", minRole: "admin", scope: "group", type: "boolean", defaultValue: true },
  { key: "interject_rate", label: "随机插话率", command: "!设置插话率", minRole: "admin", scope: "group", type: "number", min: 0, max: 100, defaultValue: 25 },
  { key: "join_assist_enabled", label: "入群申请辅助", command: "!入群辅助 开/关", minRole: "admin", scope: "group", type: "boolean", defaultValue: true },
  { key: "join_ai_approve_enabled", label: "Gemma 审查后自动同意入群", command: "网页设置", minRole: "admin", scope: "group", type: "boolean", defaultValue: true },
  { key: "join_pattern_threshold", label: "重复申请方式自动同意门槛", command: "网页设置", minRole: "admin", scope: "group", type: "number", min: 1, defaultValue: 2 },
  { key: "group_persona", label: "群组人格", command: "!切换人格 / !恢复人格", minRole: "admin", scope: "group", type: "textarea", defaultValue: "" },
  { key: "keyword_filter", label: "群组关键字过滤", command: "网页设置", minRole: "admin", scope: "group", type: "textarea", defaultValue: "" },
  { key: "group_rules", label: "群规", command: "!set群规", minRole: "admin", scope: "group", type: "textarea", defaultValue: "" },
  { key: "welcome_enabled", label: "自动欢迎", command: "!自动欢迎 开/关", minRole: "owner", scope: "group", type: "boolean", defaultValue: false },
  { key: "welcome_text", label: "欢迎词", command: "!欢迎词", minRole: "owner", scope: "group", type: "textarea", defaultValue: DEFAULTS.welcomeText },
  { key: "rule_monitor_enabled", label: "群规持续监控", command: "!群规监控", minRole: "owner", scope: "group", type: "boolean", defaultValue: true },
  { key: "rule_proxy_mode", label: "AI 群规代理模式", command: "!AI群规代理（auto 仅群主）", minRole: "admin", scope: "group", type: "select", options: ["record", "warn", "mute", "auto"], defaultValue: "record" },
  { key: "rule_strictness", label: "群规判断严格度", command: "!群规严格度 智慧/宽松/低/中/高/严格", minRole: "admin", scope: "group", type: "select", options: ["smart", "loose", "low", "medium", "high", "strict"], optionLabels: { smart: "智慧（自动校准）", loose: "宽松", low: "低", medium: "中", high: "高", strict: "严格" }, defaultValue: "medium" },
  { key: "rule_proxy_mute_seconds", label: "AI 代理禁言秒数", command: "网页 / AI代理设置", minRole: "admin", scope: "group", type: "number", min: 0, defaultValue: 600 },
  { key: "rule_spam_window_seconds", label: "刷屏判定时间窗（秒）", command: "网页设置", minRole: "admin", scope: "group", type: "number", min: 5, max: 3600, defaultValue: DEFAULTS.ruleSpamWindowSeconds },
  { key: "rule_spam_threshold", label: "重复消息刷屏门槛（条）", command: "网页设置", minRole: "admin", scope: "group", type: "number", min: 2, max: 50, defaultValue: DEFAULTS.ruleSpamThreshold },
  { key: "rule_spam_keep_count", label: "刷屏撤回后保留条数", command: "网页设置", minRole: "admin", scope: "group", type: "number", min: 0, max: 49, defaultValue: DEFAULTS.ruleSpamKeepCount },
  { key: "rule_mute_guard_enabled", label: "违规禁言防提前解除", command: "!违规禁言保护 开/关", minRole: "owner", scope: "group", type: "boolean", defaultValue: true },
  { key: "rule_proxy_kick_authorized", label: "AI 踢出授权", command: "!授权AI踢出 / !撤回AI踢出授权", minRole: "owner", scope: "group", type: "boolean", defaultValue: false },
  { key: "join_reject_authorized", label: "AI 拒绝入群授权", command: "!授权AI拒绝入群 / !撤回AI拒绝入群", minRole: "owner", scope: "group", type: "boolean", defaultValue: false },
  { key: "moderation_cooldown_seconds", label: "同对象处置冷却秒数", command: "!设置处置冷却", minRole: "owner", scope: "group", type: "number", min: 0, defaultValue: 0 },
  { key: "interject_cooldown_seconds", label: "主动插话冷却秒数", command: "网页设置", minRole: "admin", scope: "group", type: "number", min: 0, defaultValue: 0 },
  { key: "newcomer_observation_days", label: "新人观察期（天）", command: "网页设置", minRole: "owner", scope: "group", type: "number", min: 0, max: 30, defaultValue: 0 },
  { key: "active_speaking", label: "主动发话", command: "开发者后台", minRole: "developer", scope: "group", type: "boolean", defaultValue: false },
  { key: "rate_limit_seconds", label: "群调用速率限制秒数", command: "!设置速率限制", minRole: "developer", scope: "group", type: "number", min: 0, defaultValue: 10 }
]);



function portalRoleRank(role) {
  return ({ member: 0, admin: 1, owner: 2, developer: 3 })[String(role || "member")] ?? 0;
}



async function readPortalSettingValue(env, definition, groupId, targetQq) {
  const qq = String(targetQq || "");
  switch (definition.key) {
    case "dnd": return await dbGet(env, `dnd:${groupId}:${qq}`) === "true";
    case "custom_style": return await dbGet(env, `custom_style:${groupId}:${qq}`) || "";
    case "model_preference": return await dbGet(env, `model_pref:${groupId}:${qq}`) || "auto";
    case "ai_on": return await dbGet(env, `ai_off:${groupId}`) !== "true";
    case "memory_on": return await dbGet(env, `memo:${groupId}`) !== "false";
    case "commands_enabled": return await dbGet(env, `web_command_off:${groupId}`) !== "true";
    case "interject_rate": return Number(await dbGet(env, `interject_rate:${groupId}`) || DEFAULTS.interjectRate);
    case "join_assist_enabled": return await dbGet(env, `join_assist_enabled:${groupId}`) !== "false";
    case "join_ai_approve_enabled": return await dbGet(env, `join_ai_approve_enabled:${groupId}`) !== "false";
    case "join_pattern_threshold": return Math.max(1, parseUnlimitedNonNegativeInteger(await dbGet(env, `join_pattern_auto_approve_threshold:${groupId}`), DEFAULTS.joinPatternAutoApproveThreshold));
    case "group_persona": return await dbGet(env, `group_persona:${groupId}`) || "";
    case "keyword_filter": return (await readJson(env, `keyword_filter:${groupId}`, [])).join("\n");
    case "group_rules": return await dbGet(env, `group_rules:${groupId}`) || "";
    case "welcome_enabled": return await dbGet(env, `welcome_enabled:${groupId}`) === "true";
    case "welcome_text": return await dbGet(env, `welcome_text:${groupId}`) || DEFAULTS.welcomeText;
    case "rule_monitor_enabled": return await dbGet(env, `rule_monitor_enabled:${groupId}`) !== "false";
    case "rule_proxy_mode": return normalizeRuleProxyMode(await dbGet(env, `rule_proxy_mode:${groupId}`) || DEFAULTS.ruleProxyMode);
    case "rule_strictness": return normalizeRuleStrictness(await dbGet(env, `rule_strictness:${groupId}`) || DEFAULTS.ruleStrictness);
    case "rule_proxy_mute_seconds": return parseUnlimitedNonNegativeInteger(await dbGet(env, `rule_proxy_mute_seconds:${groupId}`), DEFAULTS.ruleProxyMuteSeconds);
    case "rule_spam_window_seconds": return Math.max(5, Math.min(3600, parseUnlimitedNonNegativeInteger(await dbGet(env, `rule_spam_window_seconds:${groupId}`), DEFAULTS.ruleSpamWindowSeconds)));
    case "rule_spam_threshold": return Math.max(2, Math.min(50, parseUnlimitedNonNegativeInteger(await dbGet(env, `rule_spam_threshold:${groupId}`), DEFAULTS.ruleSpamThreshold)));
    case "rule_spam_keep_count": return Math.max(0, Math.min(49, parseUnlimitedNonNegativeInteger(await dbGet(env, `rule_spam_keep_count:${groupId}`), DEFAULTS.ruleSpamKeepCount)));
    case "rule_mute_guard_enabled": return await dbGet(env, `rule_mute_guard_enabled:${groupId}`) !== "false";
    case "rule_proxy_kick_authorized": return await dbGet(env, `rule_proxy_kick_authorized:${groupId}`) === "true";
    case "join_reject_authorized": return await dbGet(env, `join_reject_authorized:${groupId}`) === "true";
    case "moderation_cooldown_seconds": return parseUnlimitedNonNegativeInteger(await dbGet(env, `moderation_target_cooldown_seconds:${groupId}`), 0);
    case "interject_cooldown_seconds": return parseUnlimitedNonNegativeInteger(await dbGet(env, `interject_cooldown_seconds:${groupId}`), 0);
    case "newcomer_observation_days": return Math.max(0, Math.min(30, parseUnlimitedNonNegativeInteger(await dbGet(env, `newcomer_observation_days:${groupId}`), 0)));
    case "active_speaking": return await getFeatureFlag(env, `active_speaking:${groupId}`, false);
    case "rate_limit_seconds": return await getRuntimeRateLimitSeconds(env, groupId);
    default: return definition.defaultValue;
  }
}



async function writePortalSettingValue(env, definition, groupId, targetQq, value) {
  const qq = String(targetQq || "");
  switch (definition.key) {
    case "dnd": return value ? dbPut(env, `dnd:${groupId}:${qq}`, "true") : dbDel(env, `dnd:${groupId}:${qq}`);
    case "custom_style": return dbPut(env, `custom_style:${groupId}:${qq}`, String(value || "").slice(0, 1000));
    case "model_preference": { const pref = normalizeModelPreference(value) || "auto"; return dbPut(env, `model_pref:${groupId}:${qq}`, pref); }
    case "ai_on": return value ? dbDel(env, `ai_off:${groupId}`) : dbPut(env, `ai_off:${groupId}`, "true");
    case "memory_on": return dbPut(env, `memo:${groupId}`, value ? "true" : "false");
    case "commands_enabled": return value ? dbDel(env, `web_command_off:${groupId}`) : dbPut(env, `web_command_off:${groupId}`, "true");
    case "interject_rate": return dbPut(env, `interject_rate:${groupId}`, String(Math.max(0, Math.min(100, Number(value || 0)))));
    case "join_assist_enabled": return dbPut(env, `join_assist_enabled:${groupId}`, value ? "true" : "false");
    case "join_ai_approve_enabled": return dbPut(env, `join_ai_approve_enabled:${groupId}`, value ? "true" : "false");
    case "join_pattern_threshold": return dbPut(env, `join_pattern_auto_approve_threshold:${groupId}`, String(Math.max(1, parseUnlimitedNonNegativeInteger(value, DEFAULTS.joinPatternAutoApproveThreshold))));
    case "group_persona": return dbPut(env, `group_persona:${groupId}`, String(value || "").slice(0, 4000));
    case "keyword_filter": return dbPut(env, `keyword_filter:${groupId}`, JSON.stringify(String(value || "").split(/\n|,/).map(item => item.trim()).filter(Boolean).slice(0, 500)));
    case "group_rules": return dbPut(env, `group_rules:${groupId}`, String(value || "").slice(0, 10000));
    case "welcome_enabled": return dbPut(env, `welcome_enabled:${groupId}`, value ? "true" : "false");
    case "welcome_text": return dbPut(env, `welcome_text:${groupId}`, String(value || DEFAULTS.welcomeText).slice(0, 1000));
    case "rule_monitor_enabled": return dbPut(env, `rule_monitor_enabled:${groupId}`, value ? "true" : "false");
    case "rule_proxy_mode": return dbPut(env, `rule_proxy_mode:${groupId}`, normalizeRuleProxyMode(value));
    case "rule_strictness": return dbPut(env, `rule_strictness:${groupId}`, normalizeRuleStrictness(value));
    case "rule_proxy_mute_seconds": return dbPut(env, `rule_proxy_mute_seconds:${groupId}`, String(parseUnlimitedNonNegativeInteger(value, DEFAULTS.ruleProxyMuteSeconds)));
    case "rule_spam_window_seconds": return dbPut(env, `rule_spam_window_seconds:${groupId}`, String(Math.max(5, Math.min(3600, parseUnlimitedNonNegativeInteger(value, DEFAULTS.ruleSpamWindowSeconds)))));
    case "rule_spam_threshold": return dbPut(env, `rule_spam_threshold:${groupId}`, String(Math.max(2, Math.min(50, parseUnlimitedNonNegativeInteger(value, DEFAULTS.ruleSpamThreshold)))));
    case "rule_spam_keep_count": return dbPut(env, `rule_spam_keep_count:${groupId}`, String(Math.max(0, Math.min(49, parseUnlimitedNonNegativeInteger(value, DEFAULTS.ruleSpamKeepCount)))));
    case "rule_mute_guard_enabled": return dbPut(env, `rule_mute_guard_enabled:${groupId}`, value ? "true" : "false");
    case "rule_proxy_kick_authorized": return value ? dbPut(env, `rule_proxy_kick_authorized:${groupId}`, "true") : dbDel(env, `rule_proxy_kick_authorized:${groupId}`);
    case "join_reject_authorized": return value ? dbPut(env, `join_reject_authorized:${groupId}`, "true") : dbDel(env, `join_reject_authorized:${groupId}`);
    case "moderation_cooldown_seconds": return dbPut(env, `moderation_target_cooldown_seconds:${groupId}`, String(parseUnlimitedNonNegativeInteger(value, 0)));
    case "interject_cooldown_seconds": return dbPut(env, `interject_cooldown_seconds:${groupId}`, String(parseUnlimitedNonNegativeInteger(value, 0)));
    case "newcomer_observation_days": return dbPut(env, `newcomer_observation_days:${groupId}`, String(Math.max(0, Math.min(30, parseUnlimitedNonNegativeInteger(value, 0)))));
    case "active_speaking": return setFeatureFlag(env, `active_speaking:${groupId}`, Boolean(value));
    case "rate_limit_seconds": return dbPut(env, `runtime_rate_limit_seconds:group:${groupId}`, String(parseUnlimitedNonNegativeInteger(value, DEFAULTS.runtimeRateLimitSeconds)));
  }
}

export { BASE32_ALPHABET, PORTAL_SETTING_DEFINITIONS, authDbDelStrict, authDbGetStrict, authDbPutStrict, authDbRetry, authStorageError, base32Decode, base32Encode, base64UrlToBytes, buildGroupReplyMessage, bytesToBase64Url, bytesToHex, clearPasswordLoginGuard, commandChangesWebSettings, constantTimeEqual, createPortalPasswordRecord, createPortalSession, decryptPortalAuthSecret, deleteMemoryVector, derivePortalPassword, encryptPortalAuthSecret, extractGroupId, generateBackupCodes, generateSixDigitCode, generateTotpCode, getOneBotHub, getPortalSession, getPublicNebulaSeed, getUserQuota, hasAdminRole, hashBackupCode, isMemoryBanned, isValidPortalPasswordRecord, jsonResponse, markGroupMemberLeft, migratePortalMemories, normalizeBackupCode, notePasswordLoginFailure, oneBotHttpActionUrl, portalAuthEncryptionKey, portalAuthEncryptionMaterial, portalRoleRank, portalSessionCookie, randomBytes, readCookie, readJson, readPasswordLoginGuard, readPortalAuthJson, readPortalSettingValue, resolvePortalRole, searchPortalVectors, sendOneBotAction, sendOneBotHttpAction, sendPortalVerificationMessage, sha256Hex, simplifyJsonValue, upsertGroupMember, upsertMemoryVector, validatePortalPassword, verifyPortalPassword, verifyPortalVerificationCode, verifyTotpCode, writeMemoryAudit, writePortalSettingValue, writeSystemError };
