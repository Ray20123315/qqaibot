import { readUserValue, persistUserValue, deleteUserValue } from "./user-persistence.js";

function clean(value, max = 180) {
  return String(value ?? "").trim().slice(0, max);
}

function storageRequired(error) {
  return String(error?.code || error?.message || "").includes("USER_STORAGE_REQUIRED");
}

function settingKey(name) {
  const key = clean(name, 80).toLowerCase().replace(/[^a-z0-9._-]+/g, "_");
  if (!key) throw new Error("USER_SETTING_KEY_REQUIRED");
  return `preferences:${key}`;
}

async function readUserSetting(env, principalId, name, fallback = null) {
  const principal = clean(principalId);
  if (!principal) return Object.freeze({ available: false, reason: "principal_missing", value: fallback });
  try {
    const result = await readUserValue(env, principal, "settings", settingKey(name));
    return Object.freeze({
      available: true,
      reason: "user_storage",
      connectorId: result.connectorId,
      value: result.value === null || result.value === undefined ? fallback : result.value
    });
  } catch (error) {
    if (storageRequired(error)) {
      return Object.freeze({ available: false, reason: "user_storage_required", value: fallback });
    }
    throw error;
  }
}

async function writeUserSetting(env, principalId, name, value) {
  const principal = clean(principalId);
  if (!principal) return Object.freeze({ saved: false, reason: "principal_missing" });
  try {
    const result = await persistUserValue(env, principal, "settings", settingKey(name), value);
    return Object.freeze({ saved: true, reason: "user_storage", connectorId: result.connectorId, value });
  } catch (error) {
    if (storageRequired(error)) return Object.freeze({ saved: false, reason: "user_storage_required", value });
    throw error;
  }
}

async function deleteUserSetting(env, principalId, name) {
  const principal = clean(principalId);
  if (!principal) return Object.freeze({ deleted: false, reason: "principal_missing" });
  try {
    const result = await deleteUserValue(env, principal, "settings", settingKey(name));
    return Object.freeze({ deleted: true, reason: "user_storage", connectorId: result.connectorId });
  } catch (error) {
    if (storageRequired(error)) return Object.freeze({ deleted: false, reason: "user_storage_required" });
    throw error;
  }
}

export { deleteUserSetting, readUserSetting, settingKey, writeUserSetting };
