import { deleteUserValue, persistUserValue, readUserValue } from "./user-persistence.js";

function clean(value, max = 220) {
  return String(value ?? "").trim().slice(0, max);
}

function storageRequired(error) {
  return String(error?.code || error?.message || "").includes("USER_STORAGE_REQUIRED");
}

function memoryKey(groupId) {
  const scope = clean(groupId || "private", 180).replace(/[^a-zA-Z0-9._:-]+/g, "_") || "private";
  return `manual:${scope}`;
}

function parseMemoryList(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string" || !value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function readUserMemoryList(env, principalId, groupId) {
  const principal = clean(principalId);
  if (!principal) return Object.freeze({ available: false, reason: "principal_missing", memories: [] });
  try {
    const result = await readUserValue(env, principal, "memory", memoryKey(groupId));
    return Object.freeze({
      available: true,
      reason: "user_storage",
      connectorId: result.connectorId,
      memories: Object.freeze(parseMemoryList(result.value))
    });
  } catch (error) {
    if (storageRequired(error)) return Object.freeze({ available: false, reason: "user_storage_required", memories: [] });
    throw error;
  }
}

async function writeUserMemoryList(env, principalId, groupId, memories) {
  const principal = clean(principalId);
  if (!principal) return Object.freeze({ saved: false, reason: "principal_missing" });
  try {
    const result = await persistUserValue(env, principal, "memory", memoryKey(groupId), Array.isArray(memories) ? memories : []);
    return Object.freeze({ saved: true, reason: "user_storage", connectorId: result.connectorId });
  } catch (error) {
    if (storageRequired(error)) return Object.freeze({ saved: false, reason: "user_storage_required" });
    throw error;
  }
}

async function deleteUserMemoryList(env, principalId, groupId) {
  const principal = clean(principalId);
  if (!principal) return Object.freeze({ deleted: false, reason: "principal_missing" });
  try {
    const result = await deleteUserValue(env, principal, "memory", memoryKey(groupId));
    return Object.freeze({ deleted: true, reason: "user_storage", connectorId: result.connectorId });
  } catch (error) {
    if (storageRequired(error)) return Object.freeze({ deleted: false, reason: "user_storage_required" });
    throw error;
  }
}

export {
  deleteUserMemoryList,
  memoryKey,
  parseMemoryList,
  readUserMemoryList,
  writeUserMemoryList
};
