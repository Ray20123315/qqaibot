import { resolveCanonicalPrincipal } from "./resource-tickets.js";
import { deleteUserValue, persistUserValue, readUserValue } from "./user-persistence.js";

function clean(value, max = 220) {
  return String(value ?? "").trim().slice(0, max);
}

function isQqOpenEvent(body = {}) {
  return String(body?.__qqai_platform || "").trim().toLowerCase() === "qq-open";
}

function qqOpenPrincipalFromBody(body = {}) {
  if (!isQqOpenEvent(body)) return "";
  const id = clean(body?.__qqai_principal_id || body?.user_id || body?.userId, 180);
  return id ? `qqopen:${id}` : "";
}

async function canonicalQqOpenPrincipal(env, body = {}) {
  const principal = qqOpenPrincipalFromBody(body);
  return principal ? resolveCanonicalPrincipal(env, principal) : "";
}

function parseHistoryValue(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string" || !value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function storageRequired(error) {
  return String(error?.code || error?.message || "").includes("USER_STORAGE_REQUIRED");
}

async function readQqOpenPrivateHistory(env, body, sessionKey, limit = 40) {
  const principalId = await canonicalQqOpenPrincipal(env, body);
  if (!principalId) return Object.freeze({ enabled: false, reason: "principal_missing", history: [] });
  try {
    const result = await readUserValue(env, principalId, "chat_history", sessionKey);
    const bounded = Math.max(2, Math.min(200, Number(limit || 40)));
    return Object.freeze({
      enabled: true,
      reason: "user_storage",
      principalId,
      connectorId: result.connectorId,
      history: Object.freeze(parseHistoryValue(result.value).slice(-bounded))
    });
  } catch (error) {
    if (storageRequired(error)) {
      return Object.freeze({ enabled: false, reason: "user_storage_required", principalId, history: [] });
    }
    throw error;
  }
}

async function persistQqOpenPrivateHistory(env, body, sessionKey, history) {
  const principalId = await canonicalQqOpenPrincipal(env, body);
  if (!principalId) return Object.freeze({ saved: false, reason: "principal_missing" });
  try {
    const result = await persistUserValue(env, principalId, "chat_history", sessionKey, Array.isArray(history) ? history : []);
    return Object.freeze({ saved: true, reason: "user_storage", principalId, connectorId: result.connectorId });
  } catch (error) {
    if (storageRequired(error)) return Object.freeze({ saved: false, reason: "user_storage_required", principalId });
    throw error;
  }
}

async function clearQqOpenPrivateHistory(env, bodyOrPrincipal, sessionKey) {
  const principalId = typeof bodyOrPrincipal === "string"
    ? clean(bodyOrPrincipal)
    : await canonicalQqOpenPrincipal(env, bodyOrPrincipal);
  if (!principalId) return Object.freeze({ cleared: false, reason: "principal_missing" });
  try {
    const result = await deleteUserValue(env, principalId, "chat_history", sessionKey);
    return Object.freeze({ cleared: true, reason: "user_storage", principalId, connectorId: result.connectorId });
  } catch (error) {
    if (storageRequired(error)) return Object.freeze({ cleared: false, reason: "user_storage_required", principalId });
    throw error;
  }
}

function allowPlatformUserContentPersistence(body = {}) {
  return !isQqOpenEvent(body);
}

export {
  allowPlatformUserContentPersistence,
  canonicalQqOpenPrincipal,
  clearQqOpenPrivateHistory,
  isQqOpenEvent,
  parseHistoryValue,
  persistQqOpenPrivateHistory,
  qqOpenPrincipalFromBody,
  readQqOpenPrivateHistory
};
