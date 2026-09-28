import { dbDel, dbGet, dbPut } from "../../data/store.js";

const STORAGE_CONNECTOR_TYPES = Object.freeze(["cloudflare_d1", "cloudflare_kv"]);
const STORAGE_PURPOSES = Object.freeze(["settings", "memory", "chat_history", "plugin_data", "files_metadata"]);
const STORAGE_INDEX_KEY = "v4_storage_connector:index";
const STORAGE_PREFIX = "v4_storage_connector:";
const CLOUDFLARE_API_ROOT = "https://api.cloudflare.com/client/v4";

function clean(value, max = 180) {
  return String(value ?? "").trim().slice(0, max);
}

function cleanId(value, fallback = "") {
  const raw = String(value || fallback).trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return raw.slice(0, 80);
}

function normalizeStorageType(value) {
  const type = clean(value, 40).toLowerCase();
  return STORAGE_CONNECTOR_TYPES.includes(type) ? type : "";
}

function normalizeStoragePurposes(value) {
  const rows = Array.isArray(value) ? value : String(value || "").split(/[,\s]+/);
  return Object.freeze([...new Set(rows.map(item => clean(item, 40).toLowerCase()).filter(item => STORAGE_PURPOSES.includes(item)))]);
}

function storageEncryptionMaterial(env = {}) {
  const material = clean(env.STORAGE_CONNECTOR_ENCRYPTION_KEY || env.AI_PROVIDER_ENCRYPTION_KEY || env.PORTAL_AUTH_SECRET, 4096);
  if (material.length < 24) throw Object.assign(new Error("STORAGE_CONNECTOR_ENCRYPTION_KEY_REQUIRED"), { code: "STORAGE_CONNECTOR_ENCRYPTION_KEY_REQUIRED" });
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

async function storageEncryptionKey(env) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(storageEncryptionMaterial(env)));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function encryptStorageToken(env, value) {
  const token = String(value || "");
  if (!token) return null;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await storageEncryptionKey(env),
    new TextEncoder().encode(token)
  ));
  return Object.freeze({ version: 1, iv: bytesToBase64Url(iv), data: bytesToBase64Url(encrypted) });
}

async function decryptStorageToken(env, payload) {
  if (!payload?.iv || !payload?.data) return "";
  const clear = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64UrlToBytes(payload.iv) },
    await storageEncryptionKey(env),
    base64UrlToBytes(payload.data)
  );
  return new TextDecoder().decode(clear);
}

function normalizeStorageConnector(input = {}, previous = null) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const old = previous && typeof previous === "object" ? previous : {};
  const type = normalizeStorageType(source.type ?? old.type);
  if (!type) throw new Error("STORAGE_CONNECTOR_TYPE_INVALID");
  const generatedId = type.replace("cloudflare_", "") + "-" + crypto.randomUUID().slice(0, 8);
  const id = cleanId(source.id ?? old.id ?? generatedId);
  const ownerPrincipalId = clean(source.ownerPrincipalId ?? old.ownerPrincipalId);
  if (!id || !ownerPrincipalId) throw new Error("STORAGE_CONNECTOR_IDENTITY_REQUIRED");
  const accountId = clean(source.accountId ?? old.accountId, 64);
  const resourceId = clean(source.resourceId ?? old.resourceId, 96);
  if (!accountId || !resourceId) throw new Error("STORAGE_CONNECTOR_RESOURCE_REQUIRED");
  return Object.freeze({
    schemaVersion: 1,
    id,
    type,
    label: clean(source.label ?? old.label ?? id, 120) || id,
    ownerPrincipalId,
    accountId,
    resourceId,
    purposes: normalizeStoragePurposes(source.purposes ?? old.purposes ?? ["settings", "memory"]),
    enabled: source.enabled === undefined ? old.enabled !== false : source.enabled !== false,
    encryptedToken: source.encryptedToken ?? old.encryptedToken ?? null,
    hasEncryptedToken: Boolean(source.encryptedToken ?? old.encryptedToken),
    createdAt: Number(old.createdAt || source.createdAt || Date.now()),
    updatedAt: Date.now()
  });
}

function safeStorageConnector(connector) {
  if (!connector) return null;
  const { encryptedToken, ...safe } = connector;
  return Object.freeze({ ...safe, hasToken: Boolean(connector.encryptedToken) });
}

async function readJson(env, key, fallback) {
  const raw = await dbGet(env, key);
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
}

async function listStorageConnectorIds(env) {
  const ids = await readJson(env, STORAGE_INDEX_KEY, []);
  return Array.isArray(ids) ? [...new Set(ids.map(cleanId).filter(Boolean))].slice(0, 200) : [];
}

async function getStorageConnector(env, id, { includeSecret = false } = {}) {
  const key = cleanId(id);
  if (!key) return null;
  const raw = await readJson(env, STORAGE_PREFIX + key, null);
  if (!raw) return null;
  const connector = normalizeStorageConnector(raw, raw);
  if (!includeSecret) return safeStorageConnector(connector);
  const token = connector.encryptedToken ? await decryptStorageToken(env, connector.encryptedToken) : "";
  return Object.freeze({ ...connector, token });
}

async function listStorageConnectors(env) {
  const output = [];
  for (const id of await listStorageConnectorIds(env)) {
    const connector = await getStorageConnector(env, id);
    if (connector) output.push(connector);
  }
  return Object.freeze(output);
}

async function listStorageConnectorsForPrincipal(env, principalId) {
  const principal = clean(principalId);
  if (!principal) return Object.freeze([]);
  return Object.freeze((await listStorageConnectors(env)).filter(item => item.ownerPrincipalId === principal));
}

async function upsertStorageConnector(env, input = {}) {
  const requestedId = cleanId(input.id);
  const previous = requestedId ? await readJson(env, STORAGE_PREFIX + requestedId, null) : null;
  let encryptedToken = previous?.encryptedToken || null;
  if (Object.prototype.hasOwnProperty.call(input, "token")) {
    encryptedToken = input.token ? await encryptStorageToken(env, input.token) : null;
  }
  const connector = normalizeStorageConnector({ ...input, encryptedToken }, previous);
  await dbPut(env, STORAGE_PREFIX + connector.id, JSON.stringify(connector));
  const ids = await listStorageConnectorIds(env);
  if (!ids.includes(connector.id)) {
    ids.push(connector.id);
    await dbPut(env, STORAGE_INDEX_KEY, JSON.stringify(ids.slice(-200)));
  }
  return safeStorageConnector(connector);
}

async function deleteStorageConnector(env, id, ownerPrincipalId = "") {
  const key = cleanId(id);
  if (!key) return false;
  const existing = await getStorageConnector(env, key);
  if (!existing) return false;
  if (ownerPrincipalId && existing.ownerPrincipalId !== clean(ownerPrincipalId)) throw new Error("STORAGE_CONNECTOR_OWNER_MISMATCH");
  await dbDel(env, STORAGE_PREFIX + key);
  await dbPut(env, STORAGE_INDEX_KEY, JSON.stringify((await listStorageConnectorIds(env)).filter(item => item !== key)));
  return true;
}

function namespacedStorageKey(ownerPrincipalId, logicalKey) {
  const owner = clean(ownerPrincipalId, 180);
  const key = clean(logicalKey, 240);
  if (!owner || !key) throw new Error("STORAGE_KEY_REQUIRED");
  return `qqaibot:v4:${owner}:${key}`;
}

async function cloudflareRequest(connector, path, {
  method = "GET",
  body,
  contentType = "application/json",
  fetchImpl = fetch
} = {}) {
  const token = clean(connector?.token, 4096);
  if (!token) throw new Error("STORAGE_CONNECTOR_TOKEN_REQUIRED");
  const response = await fetchImpl(CLOUDFLARE_API_ROOT + path, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "Content-Type": contentType })
    },
    body: body === undefined ? undefined : (contentType === "application/json" ? JSON.stringify(body) : body)
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`STORAGE_CONNECTOR_HTTP_${response.status}`);
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
}

function d1Path(connector) {
  return `/accounts/${encodeURIComponent(connector.accountId)}/d1/database/${encodeURIComponent(connector.resourceId)}/query`;
}

function kvNamespacePath(connector) {
  return `/accounts/${encodeURIComponent(connector.accountId)}/storage/kv/namespaces/${encodeURIComponent(connector.resourceId)}`;
}

async function testStorageConnector(env, id, { fetchImpl = fetch } = {}) {
  const connector = await getStorageConnector(env, id, { includeSecret: true });
  if (!connector) throw new Error("STORAGE_CONNECTOR_NOT_FOUND");
  if (connector.type === "cloudflare_d1") {
    const data = await cloudflareRequest(connector, d1Path(connector), {
      method: "POST",
      body: { sql: "SELECT 1 AS ok", params: [] },
      fetchImpl
    });
    return Object.freeze({ ok: Boolean(data?.success !== false), type: connector.type });
  }
  if (connector.type === "cloudflare_kv") {
    const data = await cloudflareRequest(connector, kvNamespacePath(connector), { fetchImpl });
    return Object.freeze({ ok: Boolean(data?.success !== false), type: connector.type });
  }
  throw new Error("STORAGE_CONNECTOR_TYPE_UNSUPPORTED");
}

async function storagePut(env, id, logicalKey, value, { fetchImpl = fetch } = {}) {
  const connector = await getStorageConnector(env, id, { includeSecret: true });
  if (!connector?.enabled) throw new Error("STORAGE_CONNECTOR_UNAVAILABLE");
  const key = namespacedStorageKey(connector.ownerPrincipalId, logicalKey);
  const encoded = typeof value === "string" ? value : JSON.stringify(value);
  if (connector.type === "cloudflare_kv") {
    await cloudflareRequest(connector, `${kvNamespacePath(connector)}/values/${encodeURIComponent(key)}`, {
      method: "PUT",
      body: encoded,
      contentType: "application/octet-stream",
      fetchImpl
    });
    return true;
  }
  if (connector.type === "cloudflare_d1") {
    await cloudflareRequest(connector, d1Path(connector), {
      method: "POST",
      body: { batch: [
        { sql: "CREATE TABLE IF NOT EXISTS qqaibot_kv (tenant_key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL)", params: [] },
        { sql: "INSERT INTO qqaibot_kv (tenant_key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(tenant_key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at", params: [key, encoded, Date.now()] }
      ] },
      fetchImpl
    });
    return true;
  }
  throw new Error("STORAGE_CONNECTOR_TYPE_UNSUPPORTED");
}

async function storageGet(env, id, logicalKey, { fetchImpl = fetch } = {}) {
  const connector = await getStorageConnector(env, id, { includeSecret: true });
  if (!connector?.enabled) throw new Error("STORAGE_CONNECTOR_UNAVAILABLE");
  const key = namespacedStorageKey(connector.ownerPrincipalId, logicalKey);
  if (connector.type === "cloudflare_kv") {
    try {
      return await cloudflareRequest(connector, `${kvNamespacePath(connector)}/values/${encodeURIComponent(key)}`, { fetchImpl });
    } catch (error) {
      if (String(error?.message || "").includes("HTTP_404")) return null;
      throw error;
    }
  }
  if (connector.type === "cloudflare_d1") {
    const data = await cloudflareRequest(connector, d1Path(connector), {
      method: "POST",
      body: { batch: [
        { sql: "CREATE TABLE IF NOT EXISTS qqaibot_kv (tenant_key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL)", params: [] },
        { sql: "SELECT value FROM qqaibot_kv WHERE tenant_key = ? LIMIT 1", params: [key] }
      ] },
      fetchImpl
    });
    const batch = Array.isArray(data?.result) ? data.result : [];
    const rows = batch.at(-1)?.results || [];
    return rows[0]?.value ?? null;
  }
  throw new Error("STORAGE_CONNECTOR_TYPE_UNSUPPORTED");
}

async function storageDelete(env, id, logicalKey, { fetchImpl = fetch } = {}) {
  const connector = await getStorageConnector(env, id, { includeSecret: true });
  if (!connector?.enabled) throw new Error("STORAGE_CONNECTOR_UNAVAILABLE");
  const key = namespacedStorageKey(connector.ownerPrincipalId, logicalKey);
  if (connector.type === "cloudflare_kv") {
    await cloudflareRequest(connector, `${kvNamespacePath(connector)}/values/${encodeURIComponent(key)}`, { method: "DELETE", fetchImpl });
    return true;
  }
  if (connector.type === "cloudflare_d1") {
    await cloudflareRequest(connector, d1Path(connector), {
      method: "POST",
      body: { sql: "DELETE FROM qqaibot_kv WHERE tenant_key = ?", params: [key] },
      fetchImpl
    });
    return true;
  }
  throw new Error("STORAGE_CONNECTOR_TYPE_UNSUPPORTED");
}

export {
  CLOUDFLARE_API_ROOT,
  STORAGE_CONNECTOR_TYPES,
  STORAGE_PURPOSES,
  deleteStorageConnector,
  getStorageConnector,
  listStorageConnectors,
  listStorageConnectorsForPrincipal,
  namespacedStorageKey,
  normalizeStorageConnector,
  normalizeStoragePurposes,
  normalizeStorageType,
  safeStorageConnector,
  storageDelete,
  storageGet,
  storagePut,
  testStorageConnector,
  upsertStorageConnector
};
