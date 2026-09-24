import { PLUGIN_AUTHOR_KEY_ID_PATTERN, normalizeEd25519PublicJwk } from "./distribution.js";

const PLUGIN_AUTHOR_TRUST_KEY = "plugin_trust:authors:v1";
const PLUGIN_AUTHOR_TRUST_SCHEMA_VERSION = 1;

function normalizePluginIdScope(values) {
  const rows = Array.isArray(values) ? values : [];
  return Object.freeze([...new Set(rows.map(value => String(value || "").trim().toLowerCase()).filter(Boolean))].sort());
}

function normalizeAuthorTrustRecord(input, { now = Date.now(), actorId = "" } = {}) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const keyId = String(source.keyId || source.key_id || "").trim().toLowerCase();
  if (!PLUGIN_AUTHOR_KEY_ID_PATTERN.test(keyId)) throw new Error("PLUGIN_AUTHOR_KEY_ID_INVALID");
  const status = String(source.status || "trusted").trim().toLowerCase();
  if (!["trusted", "revoked"].includes(status)) throw new Error("PLUGIN_AUTHOR_STATUS_INVALID");
  return Object.freeze({
    keyId,
    label: String(source.label || source.name || keyId).trim().slice(0, 120),
    status,
    publicKeyJwk: normalizeEd25519PublicJwk(source.publicKeyJwk || source.public_key_jwk || {}),
    pluginIds: normalizePluginIdScope(source.pluginIds || source.plugin_ids),
    createdAt: Number(source.createdAt || now),
    updatedAt: Number(now),
    updatedBy: String(actorId || source.updatedBy || "")
  });
}

function normalizeTrustState(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    schemaVersion: PLUGIN_AUTHOR_TRUST_SCHEMA_VERSION,
    updatedAt: Number(source.updatedAt || 0) || null,
    authors: source.authors && typeof source.authors === "object" && !Array.isArray(source.authors) ? { ...source.authors } : {}
  };
}

function createPluginAuthorTrustStore(storageAdapter, { nowProvider = Date.now } = {}) {
  if (!storageAdapter || typeof storageAdapter.get !== "function" || typeof storageAdapter.put !== "function") throw new Error("PLUGIN_AUTHOR_TRUST_STORAGE_INVALID");
  let cached = null;

  async function read() {
    if (cached) return cached;
    const raw = await storageAdapter.get(PLUGIN_AUTHOR_TRUST_KEY);
    if (raw === null || raw === undefined || raw === "") { cached = normalizeTrustState(null); return cached; }
    try { cached = normalizeTrustState(typeof raw === "string" ? JSON.parse(raw) : raw); }
    catch { cached = normalizeTrustState(null); }
    return cached;
  }

  async function write(next) {
    const frozen = Object.freeze({
      schemaVersion: PLUGIN_AUTHOR_TRUST_SCHEMA_VERSION,
      updatedAt: Number(next.updatedAt || nowProvider()),
      authors: Object.freeze({ ...(next.authors || {}) })
    });
    await storageAdapter.put(PLUGIN_AUTHOR_TRUST_KEY, JSON.stringify(frozen));
    cached = frozen;
    return frozen;
  }

  async function list() {
    const state = await read();
    return Object.freeze(Object.values(state.authors || {}).sort((a,b)=>String(a.keyId).localeCompare(String(b.keyId))));
  }

  async function get(keyId) {
    const state = await read();
    return state.authors?.[String(keyId || "").trim().toLowerCase()] || null;
  }

  async function trust(input, actorId = "") {
    const now = Number(nowProvider());
    const existing = await get(input?.keyId || input?.key_id);
    const record = normalizeAuthorTrustRecord({ ...input, createdAt: existing?.createdAt || now }, { now, actorId });
    const state = await read();
    await write({ ...state, updatedAt: now, authors: { ...(state.authors || {}), [record.keyId]: record } });
    return record;
  }

  async function revoke(keyId, actorId = "") {
    const state = await read();
    const id = String(keyId || "").trim().toLowerCase();
    const existing = state.authors?.[id];
    if (!existing) throw new Error("PLUGIN_AUTHOR_KEY_NOT_FOUND:" + id);
    const now = Number(nowProvider());
    const record = Object.freeze({ ...existing, status: "revoked", updatedAt: now, updatedBy: String(actorId || "") });
    await write({ ...state, updatedAt: now, authors: { ...(state.authors || {}), [id]: record } });
    return record;
  }

  async function remove(keyId) {
    const state = await read();
    const id = String(keyId || "").trim().toLowerCase();
    if (!state.authors?.[id]) return false;
    const authors = { ...(state.authors || {}) };
    delete authors[id];
    await write({ ...state, updatedAt: Number(nowProvider()), authors });
    return true;
  }

  async function requireTrusted(keyId, pluginId) {
    const record = await get(keyId);
    if (!record) throw new Error("PLUGIN_AUTHOR_KEY_UNTRUSTED:" + String(keyId || ""));
    if (record.status !== "trusted") throw new Error("PLUGIN_AUTHOR_KEY_REVOKED:" + record.keyId);
    if (record.pluginIds?.length && !record.pluginIds.includes(String(pluginId || "").trim().toLowerCase())) {
      throw new Error("PLUGIN_AUTHOR_KEY_SCOPE_DENIED:" + record.keyId);
    }
    return record;
  }

  return Object.freeze({ get, list, read, remove, requireTrusted, revoke, trust });
}

export {
  PLUGIN_AUTHOR_TRUST_KEY,
  PLUGIN_AUTHOR_TRUST_SCHEMA_VERSION,
  createPluginAuthorTrustStore,
  normalizeAuthorTrustRecord,
  normalizePluginIdScope
};
