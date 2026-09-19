import { normalizePluginManifest, PLUGIN_ID_PATTERN } from "./manifest.js";
import { compareSemver, pluginCompatibility } from "./lifecycle.js";

const PLUGIN_PACKAGE_LOCK_KEY = "plugin_packages:lock:v1";
const PLUGIN_PACKAGE_SCHEMA_VERSION = 1;
const PLUGIN_PACKAGE_STAGE_TTL_MS = 15 * 60 * 1000;
const PACKAGE_INTEGRITY_PATTERN = /^sha256:([0-9a-f]{64})$/i;
const PACKAGE_ENTRY_PATTERN = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._\/-]{1,240}$/;

function bytesFrom(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  if (typeof value === "string") return new TextEncoder().encode(value);
  throw new Error("PLUGIN_PACKAGE_ARTIFACT_REQUIRED");
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", bytesFrom(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function normalizeDependencyMap(value, label) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const entries = Object.entries(source);
  if (entries.length > 32) throw new Error("PLUGIN_PACKAGE_DEPENDENCY_LIMIT:" + label);
  const result = {};
  for (const [rawId, rawRange] of entries) {
    const id = String(rawId || "").trim().toLowerCase();
    if (!PLUGIN_ID_PATTERN.test(id)) throw new Error("PLUGIN_PACKAGE_DEPENDENCY_ID_INVALID:" + id);
    const range = String(rawRange || "*").trim().slice(0, 80) || "*";
    if (!versionRangeSyntaxValid(range)) throw new Error("PLUGIN_PACKAGE_DEPENDENCY_RANGE_INVALID:" + id);
    result[id] = range;
  }
  return Object.freeze(result);
}

function normalizePackageIntegrity(value) {
  const text = String(value || "").trim().toLowerCase();
  const match = text.match(PACKAGE_INTEGRITY_PATTERN);
  if (!match) throw new Error("PLUGIN_PACKAGE_INTEGRITY_INVALID");
  return "sha256:" + match[1];
}

function normalizePluginPackageDescriptor(input) {
  const source = input && typeof input === "object" ? input : {};
  const manifest = normalizePluginManifest(source.manifest || source);
  const entry = String(source.entry || "dist/index.js").trim();
  if (!PACKAGE_ENTRY_PATTERN.test(entry)) throw new Error("PLUGIN_PACKAGE_ENTRY_INVALID");
  const integrity = normalizePackageIntegrity(source.integrity);
  return Object.freeze({
    schemaVersion: PLUGIN_PACKAGE_SCHEMA_VERSION,
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    apiVersion: manifest.apiVersion,
    minQQAI: manifest.minQQAI || "",
    maxQQAI: manifest.maxQQAI || "",
    entry,
    integrity,
    official: manifest.official === true,
    requestedPermissions: Object.freeze([...(manifest.capabilities || [])]),
    dependencies: normalizeDependencyMap(source.dependencies, "dependencies"),
    optionalDependencies: normalizeDependencyMap(source.optionalDependencies, "optionalDependencies")
  });
}

function versionRangeSyntaxValid(range) {
  const text = String(range || "*").trim();
  if (!text || text === "*") return true;
  return /^(?:\^|~|>=|<=|>|<|=)?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(text);
}

function nextCaretUpper(version) {
  const parts = String(version).split(/[+-]/)[0].split(".").map(Number);
  const [major, minor, patch] = parts;
  if (major > 0) return `${major + 1}.0.0`;
  if (minor > 0) return `0.${minor + 1}.0`;
  return `0.0.${patch + 1}`;
}

function versionSatisfies(version, range) {
  const text = String(range || "*").trim();
  if (!text || text === "*") return true;
  const operators = [">=", "<=", ">", "<", "=", "^", "~"];
  const op = operators.find(prefix => text.startsWith(prefix)) || "=";
  const target = op === "=" && !text.startsWith("=") ? text : text.slice(op.length);
  const cmp = compareSemver(version, target);
  if (cmp === null) return false;
  if (op === "=") return cmp === 0;
  if (op === ">=") return cmp >= 0;
  if (op === "<=") return cmp <= 0;
  if (op === ">") return cmp > 0;
  if (op === "<") return cmp < 0;
  if (op === "^") return cmp >= 0 && compareSemver(version, nextCaretUpper(target)) < 0;
  if (op === "~") {
    const [major, minor] = target.split(".").map(Number);
    return cmp >= 0 && compareSemver(version, `${major}.${minor + 1}.0`) < 0;
  }
  return false;
}

async function verifyPluginPackageIntegrity(descriptor, artifact) {
  const normalized = normalizePluginPackageDescriptor(descriptor);
  const actual = await sha256Hex(artifact);
  const expected = normalized.integrity.slice("sha256:".length);
  if (actual !== expected) throw new Error("PLUGIN_PACKAGE_INTEGRITY_MISMATCH");
  return Object.freeze({ ok: true, algorithm: "sha256", hash: actual, integrity: normalized.integrity });
}

function installedVersionMap(packages = {}) {
  const result = {};
  for (const [id, record] of Object.entries(packages || {})) {
    if (record?.state !== "installed" || !record?.descriptor?.version) continue;
    result[id] = String(record.descriptor.version);
  }
  return result;
}

function validateDependencies(descriptor, packages = {}, { targetId = "", targetVersion = "" } = {}) {
  const versions = installedVersionMap(packages);
  if (targetId && targetVersion) versions[targetId] = targetVersion;
  const missing = [], incompatible = [];
  for (const [id, range] of Object.entries(descriptor.dependencies || {})) {
    const version = versions[id];
    if (!version) { missing.push(Object.freeze({ id, range })); continue; }
    if (!versionSatisfies(version, range)) incompatible.push(Object.freeze({ id, range, version }));
  }
  return Object.freeze({ ok: !missing.length && !incompatible.length, missing: Object.freeze(missing), incompatible: Object.freeze(incompatible) });
}

function reverseDependencyProblems(packages = {}, targetId, targetVersion = null, { excluding = null } = {}) {
  const problems = [];
  for (const [id, record] of Object.entries(packages || {})) {
    if (id === excluding || record?.state !== "installed") continue;
    const range = record?.descriptor?.dependencies?.[targetId];
    if (!range) continue;
    if (!targetVersion || !versionSatisfies(targetVersion, range)) {
      problems.push(Object.freeze({ id, range, currentTargetVersion: targetVersion || null }));
    }
  }
  return Object.freeze(problems);
}

function normalizeLock(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    schemaVersion: PLUGIN_PACKAGE_SCHEMA_VERSION,
    updatedAt: Number(source.updatedAt || 0) || null,
    packages: source.packages && typeof source.packages === "object" && !Array.isArray(source.packages) ? { ...source.packages } : {},
    staged: source.staged && typeof source.staged === "object" && !Array.isArray(source.staged) ? { ...source.staged } : {},
    history: Array.isArray(source.history) ? source.history.slice(-50) : []
  };
}

function createPluginPackageRegistry(storageAdapter, { qqaiVersion = "0.0.0", trustedCandidateIds = [], nowProvider = Date.now, transactionIdProvider = () => crypto.randomUUID() } = {}) {
  if (!storageAdapter || typeof storageAdapter.get !== "function" || typeof storageAdapter.put !== "function") throw new Error("PLUGIN_PACKAGE_STORAGE_INVALID");
  const trusted = new Set((Array.isArray(trustedCandidateIds) ? trustedCandidateIds : []).map(value => String(value || "").trim().toLowerCase()).filter(Boolean));
  let cached = null;

  async function read() {
    if (cached) return cached;
    const raw = await storageAdapter.get(PLUGIN_PACKAGE_LOCK_KEY);
    if (raw === null || raw === undefined || raw === "") { cached = normalizeLock(null); return cached; }
    try { cached = normalizeLock(typeof raw === "string" ? JSON.parse(raw) : raw); }
    catch { cached = normalizeLock(null); }
    return cached;
  }

  async function write(next) {
    const frozen = Object.freeze({
      schemaVersion: PLUGIN_PACKAGE_SCHEMA_VERSION,
      updatedAt: Number(next.updatedAt || nowProvider()),
      packages: Object.freeze({ ...(next.packages || {}) }),
      staged: Object.freeze({ ...(next.staged || {}) }),
      history: Object.freeze((next.history || []).slice(-50))
    });
    await storageAdapter.put(PLUGIN_PACKAGE_LOCK_KEY, JSON.stringify(frozen));
    cached = frozen;
    return frozen;
  }

  function assertTrusted(id) {
    if (!trusted.has(String(id || ""))) throw new Error("PLUGIN_PACKAGE_CANDIDATE_NOT_BUNDLED:" + String(id || ""));
  }

  function validateCompatibility(descriptor) {
    const compatibility = pluginCompatibility(descriptor, qqaiVersion);
    if (!compatibility.ok) throw new Error("PLUGIN_PACKAGE_INCOMPATIBLE:" + (compatibility.reason || "unknown"));
    return compatibility;
  }

  async function list() {
    const state = await read();
    return Object.freeze(Object.values(state.packages || {}).filter(row => row?.state === "installed").sort((a, b) => String(a.id).localeCompare(String(b.id))));
  }

  async function get(pluginId) {
    const state = await read();
    const record = state.packages?.[String(pluginId || "")] || null;
    return record?.state === "installed" ? record : null;
  }

  async function stagePreparedInstall(descriptor, integrity, actorId = "") {
    const compatibility = validateCompatibility(descriptor);
    const state = await read();
    const dependencyCheck = validateDependencies(descriptor, state.packages, { targetId: descriptor.id, targetVersion: descriptor.version });
    if (!dependencyCheck.ok) throw new Error("PLUGIN_PACKAGE_DEPENDENCY_UNSATISFIED");
    const current = state.packages?.[descriptor.id]?.state === "installed" ? state.packages[descriptor.id] : null;
    const reverseProblems = current ? reverseDependencyProblems(state.packages, descriptor.id, descriptor.version, { excluding: descriptor.id }) : [];
    if (reverseProblems.length) throw new Error("PLUGIN_PACKAGE_REVERSE_DEPENDENCY_UNSATISFIED");
    const now = Number(nowProvider());
    const id = String(transactionIdProvider());
    const transaction = Object.freeze({
      id,
      type: current ? "update" : "install",
      pluginId: descriptor.id,
      descriptor,
      previous: current,
      integrity,
      compatibility,
      dependencyCheck,
      status: "staged",
      actorId: String(actorId || ""),
      createdAt: now,
      expiresAt: now + PLUGIN_PACKAGE_STAGE_TTL_MS
    });
    const staged = { ...(state.staged || {}), [id]: transaction };
    await write({ ...state, staged, updatedAt: now });
    return transaction;
  }

  async function stageInstall(input, { artifact, actorId = "" } = {}) {
    const descriptor = normalizePluginPackageDescriptor(input);
    assertTrusted(descriptor.id);
    const integrity = await verifyPluginPackageIntegrity(descriptor, artifact);
    return stagePreparedInstall(descriptor, integrity, actorId);
  }

  async function stageTrustedInstall(input, { verifiedHash, actorId = "" } = {}) {
    const descriptor = normalizePluginPackageDescriptor(input);
    assertTrusted(descriptor.id);
    const hash = String(verifiedHash || "").trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(hash)) throw new Error("PLUGIN_PACKAGE_TRUSTED_HASH_INVALID");
    if (descriptor.integrity !== "sha256:" + hash) throw new Error("PLUGIN_PACKAGE_TRUSTED_HASH_MISMATCH");
    const integrity = Object.freeze({
      ok: true,
      algorithm: "sha256",
      hash,
      integrity: descriptor.integrity,
      scope: "bundled-source",
      preverified: true
    });
    return stagePreparedInstall(descriptor, integrity, actorId);
  }

  async function stageUninstall(pluginId, { actorId = "" } = {}) {
    const state = await read();
    const id = String(pluginId || "");
    const current = state.packages?.[id]?.state === "installed" ? state.packages[id] : null;
    if (!current) throw new Error("PLUGIN_PACKAGE_NOT_INSTALLED:" + id);
    const reverseProblems = reverseDependencyProblems(state.packages, id, null, { excluding: id });
    if (reverseProblems.length) throw new Error("PLUGIN_PACKAGE_DEPENDENTS_EXIST:" + reverseProblems[0].id);
    const now = Number(nowProvider());
    const txId = String(transactionIdProvider());
    const transaction = Object.freeze({
      id: txId, type: "uninstall", pluginId: id, descriptor: null, previous: current,
      integrity: null, compatibility: null, dependencyCheck: null, status: "staged",
      actorId: String(actorId || ""), createdAt: now, expiresAt: now + PLUGIN_PACKAGE_STAGE_TTL_MS
    });
    await write({ ...state, staged: { ...(state.staged || {}), [txId]: transaction }, updatedAt: now });
    return transaction;
  }

  async function commit(transactionId, { actorId = "" } = {}) {
    const state = await read();
    const id = String(transactionId || "");
    const transaction = state.staged?.[id];
    if (!transaction) throw new Error("PLUGIN_PACKAGE_STAGE_NOT_FOUND:" + id);
    const now = Number(nowProvider());
    if (now > Number(transaction.expiresAt || 0)) throw new Error("PLUGIN_PACKAGE_STAGE_EXPIRED:" + id);
    const packages = { ...(state.packages || {}) };
    if (transaction.type === "install" || transaction.type === "update") {
      assertTrusted(transaction.pluginId);
      validateCompatibility(transaction.descriptor);
      const deps = validateDependencies(transaction.descriptor, packages, { targetId: transaction.pluginId, targetVersion: transaction.descriptor.version });
      if (!deps.ok) throw new Error("PLUGIN_PACKAGE_DEPENDENCY_UNSATISFIED");
      const reverseProblems = transaction.type === "update"
        ? reverseDependencyProblems(packages, transaction.pluginId, transaction.descriptor.version, { excluding: transaction.pluginId })
        : [];
      if (reverseProblems.length) throw new Error("PLUGIN_PACKAGE_REVERSE_DEPENDENCY_UNSATISFIED");
      packages[transaction.pluginId] = Object.freeze({
        id: transaction.pluginId,
        state: "installed",
        descriptor: transaction.descriptor,
        integrityVerified: true,
        verifiedHash: transaction.integrity?.hash || "",
        installedAt: Number(transaction.previous?.installedAt || now),
        updatedAt: now,
        updatedBy: String(actorId || transaction.actorId || "")
      });
    } else if (transaction.type === "uninstall") {
      const reverseProblems = reverseDependencyProblems(packages, transaction.pluginId, null, { excluding: transaction.pluginId });
      if (reverseProblems.length) throw new Error("PLUGIN_PACKAGE_DEPENDENTS_EXIST:" + reverseProblems[0].id);
      delete packages[transaction.pluginId];
    } else {
      throw new Error("PLUGIN_PACKAGE_STAGE_TYPE_INVALID");
    }
    const staged = { ...(state.staged || {}) };
    delete staged[id];
    const historyRecord = Object.freeze({ ...transaction, status: "committed", committedAt: now, committedBy: String(actorId || transaction.actorId || "") });
    await write({ ...state, packages, staged, history: [...(state.history || []), historyRecord].slice(-50), updatedAt: now });
    return Object.freeze({ transaction: historyRecord, package: packages[transaction.pluginId] || null });
  }

  async function rollback(transactionId, { actorId = "" } = {}) {
    const state = await read();
    const id = String(transactionId || "");
    const transaction = [...(state.history || [])].reverse().find(row => row?.id === id && row?.status === "committed");
    if (!transaction) throw new Error("PLUGIN_PACKAGE_HISTORY_NOT_FOUND:" + id);
    const packages = { ...(state.packages || {}) };
    const now = Number(nowProvider());
    if (transaction.previous) {
      assertTrusted(transaction.pluginId);
      const previousDescriptor = transaction.previous.descriptor;
      validateCompatibility(previousDescriptor);
      const deps = validateDependencies(previousDescriptor, packages, { targetId: transaction.pluginId, targetVersion: previousDescriptor.version });
      if (!deps.ok) throw new Error("PLUGIN_PACKAGE_ROLLBACK_DEPENDENCY_UNSATISFIED");
      const reverseProblems = reverseDependencyProblems(packages, transaction.pluginId, previousDescriptor.version, { excluding: transaction.pluginId });
      if (reverseProblems.length) throw new Error("PLUGIN_PACKAGE_ROLLBACK_REVERSE_DEPENDENCY_UNSATISFIED");
      packages[transaction.pluginId] = Object.freeze({ ...transaction.previous, updatedAt: now, updatedBy: String(actorId || "") });
    } else {
      const reverseProblems = reverseDependencyProblems(packages, transaction.pluginId, null, { excluding: transaction.pluginId });
      if (reverseProblems.length) throw new Error("PLUGIN_PACKAGE_DEPENDENTS_EXIST:" + reverseProblems[0].id);
      delete packages[transaction.pluginId];
    }
    const rollbackRecord = Object.freeze({
      id: String(transactionIdProvider()), type: "rollback", pluginId: transaction.pluginId,
      rolledBackTransactionId: id, status: "committed", actorId: String(actorId || ""), committedAt: now
    });
    await write({ ...state, packages, history: [...(state.history || []), rollbackRecord].slice(-50), updatedAt: now });
    return Object.freeze({ transaction: rollbackRecord, package: packages[transaction.pluginId] || null });
  }

  async function cancelStaged(transactionId) {
    const state = await read();
    const id = String(transactionId || "");
    if (!state.staged?.[id]) return false;
    const staged = { ...(state.staged || {}) };
    delete staged[id];
    await write({ ...state, staged, updatedAt: Number(nowProvider()) });
    return true;
  }

  return Object.freeze({ cancelStaged, commit, get, list, read, rollback, stageInstall, stageTrustedInstall, stageUninstall });
}

export {
  PACKAGE_ENTRY_PATTERN,
  PACKAGE_INTEGRITY_PATTERN,
  PLUGIN_PACKAGE_LOCK_KEY,
  PLUGIN_PACKAGE_SCHEMA_VERSION,
  PLUGIN_PACKAGE_STAGE_TTL_MS,
  createPluginPackageRegistry,
  normalizeDependencyMap,
  normalizePackageIntegrity,
  normalizePluginPackageDescriptor,
  reverseDependencyProblems,
  sha256Hex,
  validateDependencies,
  verifyPluginPackageIntegrity,
  versionRangeSyntaxValid,
  versionSatisfies
};
