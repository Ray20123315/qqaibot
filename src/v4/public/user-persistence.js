import {
  listStorageConnectorsForPrincipal,
  storageDelete,
  storageGet,
  storagePut
} from "./storage-registry.js";

const USER_PERSISTENCE_POLICY = Object.freeze({
  controlPlane: "platform_d1",
  userContent: "user_storage_required",
  fallback: "none"
});

function clean(value, max = 220) {
  return String(value ?? "").trim().slice(0, max);
}

async function selectUserStorageConnector(env, principalId, purpose) {
  const principal = clean(principalId);
  const targetPurpose = clean(purpose, 40).toLowerCase();
  if (!principal || !targetPurpose) return null;
  const connectors = await listStorageConnectorsForPrincipal(env, principal);
  return connectors.find(connector => connector.enabled !== false && Array.isArray(connector.purposes) && connector.purposes.includes(targetPurpose)) || null;
}

async function userPersistenceState(env, principalId) {
  const connectors = await listStorageConnectorsForPrincipal(env, principalId);
  const enabled = connectors.filter(connector => connector.enabled !== false);
  const purposes = [...new Set(enabled.flatMap(connector => Array.isArray(connector.purposes) ? connector.purposes : []))];
  return Object.freeze({
    policy: USER_PERSISTENCE_POLICY,
    connected: enabled.length > 0,
    connectorCount: enabled.length,
    purposes: Object.freeze(purposes),
    connectors: Object.freeze(enabled)
  });
}

async function requireUserStorageConnector(env, principalId, purpose) {
  const connector = await selectUserStorageConnector(env, principalId, purpose);
  if (!connector) {
    const error = new Error(`USER_STORAGE_REQUIRED:${clean(purpose, 40)}`);
    error.code = "USER_STORAGE_REQUIRED";
    error.purpose = clean(purpose, 40);
    throw error;
  }
  return connector;
}

async function persistUserValue(env, principalId, purpose, logicalKey, value, options = {}) {
  const connector = await requireUserStorageConnector(env, principalId, purpose);
  await storagePut(env, connector.id, `${clean(purpose, 40)}:${clean(logicalKey, 180)}`, value, options);
  return Object.freeze({ ok: true, connectorId: connector.id, purpose: clean(purpose, 40) });
}

async function readUserValue(env, principalId, purpose, logicalKey, options = {}) {
  const connector = await requireUserStorageConnector(env, principalId, purpose);
  const value = await storageGet(env, connector.id, `${clean(purpose, 40)}:${clean(logicalKey, 180)}`, options);
  return Object.freeze({ ok: true, connectorId: connector.id, purpose: clean(purpose, 40), value });
}

async function deleteUserValue(env, principalId, purpose, logicalKey, options = {}) {
  const connector = await requireUserStorageConnector(env, principalId, purpose);
  await storageDelete(env, connector.id, `${clean(purpose, 40)}:${clean(logicalKey, 180)}`, options);
  return Object.freeze({ ok: true, connectorId: connector.id, purpose: clean(purpose, 40) });
}

export {
  USER_PERSISTENCE_POLICY,
  deleteUserValue,
  persistUserValue,
  readUserValue,
  requireUserStorageConnector,
  selectUserStorageConnector,
  userPersistenceState
};
