import { normalizeSignedPluginDistribution, verifyDistributionArtifact, verifyDistributionSignature } from "./distribution.js";
import { deterministicScanPluginArtifact } from "./security-center.js";

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
  securityCenter = null,
  scanArtifact = deterministicScanPluginArtifact,
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
    const scan = typeof scanArtifact === "function"
      ? await scanArtifact(bytes, { mediaType: distribution.artifact.mediaType, descriptor: distribution.descriptor })
      : Object.freeze({ findings: Object.freeze([]), findingCount: 0, riskLevel: "none", overrideAllowed: false, blocked: false, scanner: "none" });
    const securityRecord = securityCenter && typeof securityCenter.report === "function"
      ? await securityCenter.report({
          pluginId: distribution.descriptor.id,
          version: distribution.descriptor.version,
          hash: integrity.hash,
          authorKeyId: author.keyId,
          repositoryUrl: distribution.repositoryUrl,
          trustStatus: distribution.descriptor.trustStatus || "uncertified",
          releaseChannel: distribution.descriptor.releaseChannel || "stable",
          findings: scan.findings || []
        })
      : null;
    const security = Object.freeze({
      recordId: String(securityRecord?.id || ""),
      scanner: String(scan?.scanner || "qqai-deterministic-v1"),
      findingCount: Number(scan?.findingCount || 0),
      riskLevel: String(scan?.riskLevel || "none"),
      overrideAllowed: scan?.overrideAllowed === true,
      blocked: scan?.blocked === true,
      findings: Object.freeze([...(scan?.findings || [])])
    });
    const now = Number(nowProvider());
    const id = String(idProvider());
    const record = Object.freeze({
      id,
      pluginId: distribution.descriptor.id,
      version: distribution.descriptor.version,
      state: security.blocked ? "blocked" : security.findingCount ? "risky" : "verified",
      distribution: safeDistributionMetadata(distribution),
      author: Object.freeze({ keyId: author.keyId, label: author.label }),
      verification: Object.freeze({
        signatureVerified: true,
        artifactVerified: true,
        hash: integrity.hash,
        sizeBytes: integrity.sizeBytes,
        verifiedAt: now
      }),
      security,
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
    if (!["verified", "approved"].includes(existing.state)) throw new Error(existing.state === "blocked" ? "PLUGIN_SECURITY_OVERRIDE_FORBIDDEN" : "PLUGIN_QUARANTINE_STATE_INVALID");
    const now = Number(nowProvider());
    const record = Object.freeze({ ...existing, state: "approved", approvedAt: now, updatedAt: now, updatedBy: String(actorId || "") });
    await write({ ...state, updatedAt: now, entries: { ...(state.entries || {}), [key]: record } });
    return record;
  }

  async function acceptRisk(id, actorId = "") {
    const state = await read();
    const key = String(id || "");
    const existing = state.entries?.[key];
    if (!existing) throw new Error("PLUGIN_QUARANTINE_NOT_FOUND:" + key);
    if (existing.state !== "risky" && existing.state !== "approved_with_risk") {
      if (existing.state === "blocked") throw new Error("PLUGIN_SECURITY_OVERRIDE_FORBIDDEN");
      throw new Error("PLUGIN_QUARANTINE_STATE_INVALID");
    }
    if (existing.security?.overrideAllowed !== true || existing.security?.blocked === true) throw new Error("PLUGIN_SECURITY_OVERRIDE_FORBIDDEN");
    if (securityCenter && existing.security?.recordId && typeof securityCenter.acceptRisk === "function") {
      await securityCenter.acceptRisk(existing.security.recordId, actorId);
    }
    const now = Number(nowProvider());
    const record = Object.freeze({
      ...existing,
      state: "approved_with_risk",
      acceptedRiskAt: now,
      acceptedRiskBy: String(actorId || ""),
      updatedAt: now,
      updatedBy: String(actorId || "")
    });
    await write({ ...state, updatedAt: now, entries: { ...(state.entries || {}), [key]: record } });
    return record;
  }

  async function applySecurityReview(id, summary = {}, { actorId = "scheduled", reviewer = "qqai-hourly" } = {}) {
    const state = await read();
    const key = String(id || "");
    const existing = state.entries?.[key];
    if (!existing) throw new Error("PLUGIN_QUARANTINE_NOT_FOUND:" + key);
    const findings = Object.freeze([...(summary?.findings || [])]);
    const nextSignature = JSON.stringify(findings.map(f => [f.code, f.severity, f.summaryZh, f.impacts]));
    const previousSignature = JSON.stringify((existing.security?.findings || []).map(f => [f.code, f.severity, f.summaryZh, f.impacts]));
    const findingsUnchanged = nextSignature === previousSignature;
    const blocked = summary?.blocked === true;
    const warning = Number(summary?.findingCount || findings.length) > 0;
    const preserveRiskAcceptance = existing.state === "approved_with_risk" && findingsUnchanged && summary?.overrideAllowed === true && !blocked;
    let nextState = existing.state;
    if (blocked) nextState = "blocked";
    else if (warning) nextState = preserveRiskAcceptance ? "approved_with_risk" : "risky";
    else if (["approved", "approved_with_risk"].includes(existing.state)) nextState = "approved";
    else nextState = "verified";
    const now = Number(nowProvider());
    const security = Object.freeze({
      ...(existing.security || {}),
      findingCount: Number(summary?.findingCount || findings.length),
      riskLevel: String(summary?.riskLevel || "none"),
      overrideAllowed: summary?.overrideAllowed === true,
      blocked,
      findings,
      reviewedAt: now,
      reviewer: String(reviewer || "")
    });
    const record = Object.freeze({
      ...existing,
      state: nextState,
      security,
      updatedAt: now,
      updatedBy: String(actorId || ""),
      ...(!preserveRiskAcceptance ? { acceptedRiskAt: null, acceptedRiskBy: "" } : {})
    });
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

  return Object.freeze({ acceptRisk, applySecurityReview, approve, get, list, read, reject, remove, verifyAndQuarantine });
}

export {
  PLUGIN_QUARANTINE_KEY,
  PLUGIN_QUARANTINE_SCHEMA_VERSION,
  createPluginQuarantine,
  safeDistributionMetadata
};
