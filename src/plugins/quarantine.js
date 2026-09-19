import { normalizeSignedPluginDistribution, verifyDistributionArtifact, verifyDistributionSignature } from "./distribution.js";

const PLUGIN_QUARANTINE_KEY = "plugin_quarantine:registry:v1";
const PLUGIN_QUARANTINE_SCHEMA_VERSION = 1;

function normalizeState(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    schemaVersion: PLUGIN_QUARANTINE_SCHEMA_VERSION,
    updatedAt: Number(source.updatedAt || 0) || null,
    entries: source.entries && typeof source.entries === "object" && !Array.isArray(source.entries) ? { ...source.entries } : {}
  };
}

function safeDistributionMetadata(distribution) {
  const normalized = normalizeSignedPluginDistribution(distribution);
  return Object.freeze({
    schemaVersion: normalized.schemaVersion,
    descriptor: normalized.descriptor,
    artifact: normalized.artifact,
    publisher: normalized.publisher,
    repositoryUrl: normalized.repositoryUrl,
    signature: normalized.signature
  });
}

function createPluginQuarantine(storageAdapter, {
  trustStore,
  fetchArtifact,
  nowProvider = Date.now,
  idProvider = () => crypto.randomUUID()
} = {}) {
  if (!storageAdapter || typeof storageAdapter.get !== "function" || typeof storageAdapter.put !== "function") throw new Error("PLUGIN_QUARANTINE_STORAGE_INVALID");
  if (!trustStore || typeof trustStore.requireTrusted !== "function") throw new Error("PLUGIN_QUARANTINE_TRUST_STORE_REQUIRED");
  if (typeof fetchArtifact !== "function") throw new Error("PLUGIN_QUARANTINE_FETCH_REQUIRED");
  let cached = null;

  async function read() {
    if (cached) return cached;
    const raw = await storageAdapter.get(PLUGIN_QUARANTINE_KEY);
    if (raw === null || raw === undefined || raw === "") { cached = normalizeState(null); return cached; }
    try { cached = normalizeState(typeof raw === "string" ? JSON.parse(raw) : raw); }
    catch { cached = normalizeState(null); }
    return cached;
  }

  async function write(next) {
    const frozen = Object.freeze({
      schemaVersion: PLUGIN_QUARANTINE_SCHEMA_VERSION,
      updatedAt: Number(next.updatedAt || nowProvider()),
      entries: Object.freeze({ ...(next.entries || {}) })
    });
    await storageAdapter.put(PLUGIN_QUARANTINE_KEY, JSON.stringify(frozen));
    cached = frozen;
    return frozen;
  }

  async function list() {
    const state = await read();
    return Object.freeze(Object.values(state.entries || {}).sort((a,b)=>Number(b.updatedAt||0)-Number(a.updatedAt||0)));
  }

  async function get(id) {
    const state = await read();
    return state.entries?.[String(id || "")] || null;
  }

  async function verifyAndQuarantine(input, actorId = "") {
    const distribution = normalizeSignedPluginDistribution(input);
    const author = await trustStore.requireTrusted(distribution.signature.keyId, distribution.descriptor.id);
    const signature = await verifyDistributionSignature(distribution, author.publicKeyJwk);
    if (!signature.ok) throw new Error("PLUGIN_SIGNATURE_INVALID");

    const fetched = await fetchArtifact(distribution.artifact.url, {
      maxBytes: distribution.artifact.sizeBytes,
      mediaType: distribution.artifact.mediaType
    });
    const bytes = fetched?.bytes instanceof Uint8Array ? fetched.bytes : new Uint8Array(fetched?.bytes || []);
    if (fetched?.mediaType && String(fetched.mediaType).toLowerCase() !== distribution.artifact.mediaType) {
      throw new Error("PLUGIN_ARTIFACT_MEDIA_TYPE_MISMATCH");
    }
    const integrity = await verifyDistributionArtifact(distribution, bytes);
    const now = Number(nowProvider());
    const id = String(idProvider());
    const record = Object.freeze({
      id,
      pluginId: distribution.descriptor.id,
      version: distribution.descriptor.version,
      state: "verified",
      distribution: safeDistributionMetadata(distribution),
      author: Object.freeze({ keyId: author.keyId, label: author.label }),
      verification: Object.freeze({
        signatureVerified: true,
        artifactVerified: true,
        hash: integrity.hash,
        sizeBytes: integrity.sizeBytes,
        verifiedAt: now
      }),
      createdAt: now,
      updatedAt: now,
      updatedBy: String(actorId || "")
    });
    const state = await read();
    await write({ ...state, updatedAt: now, entries: { ...(state.entries || {}), [id]: record } });
    return record;
  }

  async function approve(id, actorId = "") {
    const state = await read();
    const key = String(id || "");
    const existing = state.entries?.[key];
    if (!existing) throw new Error("PLUGIN_QUARANTINE_NOT_FOUND:" + key);
    if (!["verified", "approved"].includes(existing.state)) throw new Error("PLUGIN_QUARANTINE_STATE_INVALID");
    const now = Number(nowProvider());
    const record = Object.freeze({ ...existing, state: "approved", approvedAt: now, updatedAt: now, updatedBy: String(actorId || "") });
    await write({ ...state, updatedAt: now, entries: { ...(state.entries || {}), [key]: record } });
    return record;
  }

  async function reject(id, actorId = "", reason = "") {
    const state = await read();
    const key = String(id || "");
    const existing = state.entries?.[key];
    if (!existing) throw new Error("PLUGIN_QUARANTINE_NOT_FOUND:" + key);
    const now = Number(nowProvider());
    const record = Object.freeze({
      ...existing,
      state: "rejected",
      rejectionReason: String(reason || "").trim().slice(0, 240),
      rejectedAt: now,
      updatedAt: now,
      updatedBy: String(actorId || "")
    });
    await write({ ...state, updatedAt: now, entries: { ...(state.entries || {}), [key]: record } });
    return record;
  }

  async function remove(id) {
    const state = await read();
    const key = String(id || "");
    if (!state.entries?.[key]) return false;
    const entries = { ...(state.entries || {}) };
    delete entries[key];
    await write({ ...state, updatedAt: Number(nowProvider()), entries });
    return true;
  }

  return Object.freeze({ approve, get, list, read, reject, remove, verifyAndQuarantine });
}

export {
  PLUGIN_QUARANTINE_KEY,
  PLUGIN_QUARANTINE_SCHEMA_VERSION,
  createPluginQuarantine,
  safeDistributionMetadata
};
