import { QQAI_PLUGIN_API_VERSION } from "./constants.js";

const PLUGIN_LIFECYCLE_REGISTRY_KEY = "plugin_lifecycle:registry:v1";
const PLUGIN_LIFECYCLE_SCHEMA_VERSION = 1;
const PLUGIN_LIFECYCLE_STATES = Object.freeze(["enabled", "disabled", "blocked"]);

function parseSemver(value) {
  const match = String(value || "").trim().match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/);
  if (!match) return null;
  return Object.freeze({ major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]), prerelease: String(match[4] || "") });
}

function compareSemver(left, right) {
  const a = parseSemver(left), b = parseSemver(right);
  if (!a || !b) return null;
  for (const key of ["major", "minor", "patch"]) if (a[key] !== b[key]) return a[key] < b[key] ? -1 : 1;
  if (a.prerelease === b.prerelease) return 0;
  if (!a.prerelease) return 1;
  if (!b.prerelease) return -1;
  return a.prerelease.localeCompare(b.prerelease);
}

function manifestOf(candidate) {
  return candidate?.manifest && typeof candidate.manifest === "object" ? candidate.manifest : (candidate || {});
}

function normalizePermissions(values, requested = null) {
  const allow = requested ? new Set((Array.isArray(requested) ? requested : []).map(String)) : null;
  return Object.freeze([...new Set((Array.isArray(values) ? values : []).map(value => String(value || "").trim()).filter(Boolean))]
    .filter(value => !allow || allow.has(value)).sort());
}

function pluginCompatibility(manifest, qqaiVersion) {
  const apiCompatible = String(manifest?.apiVersion || "") === QQAI_PLUGIN_API_VERSION;
  let qqaiCompatible = true;
  let reason = "";
  const current = String(qqaiVersion || "").trim();
  if (!parseSemver(current)) { qqaiCompatible = false; reason = "QQAI_VERSION_INVALID"; }
  const min = String(manifest?.minQQAI || "").trim();
  const max = String(manifest?.maxQQAI || "").trim();
  if (qqaiCompatible && min) {
    const cmp = compareSemver(current, min);
    if (cmp === null) { qqaiCompatible = false; reason = "PLUGIN_MIN_QQAI_INVALID"; }
    else if (cmp < 0) { qqaiCompatible = false; reason = "PLUGIN_REQUIRES_NEWER_QQAI"; }
  }
  if (qqaiCompatible && max) {
    const cmp = compareSemver(current, max);
    if (cmp === null) { qqaiCompatible = false; reason = "PLUGIN_MAX_QQAI_INVALID"; }
    else if (cmp > 0) { qqaiCompatible = false; reason = "PLUGIN_REQUIRES_OLDER_QQAI"; }
  }
  if (!apiCompatible) reason = "PLUGIN_API_VERSION_UNSUPPORTED";
  return Object.freeze({
    ok: apiCompatible && qqaiCompatible,
    apiCompatible,
    qqaiCompatible,
    apiVersion: String(manifest?.apiVersion || ""),
    supportedApiVersion: QQAI_PLUGIN_API_VERSION,
    qqaiVersion: current,
    minQQAI: min,
    maxQQAI: max,
    reason
  });
}

function normalizeStoredRegistry(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const rows = source.plugins && typeof source.plugins === "object" && !Array.isArray(source.plugins) ? source.plugins : {};
  return { schemaVersion: PLUGIN_LIFECYCLE_SCHEMA_VERSION, updatedAt: Number(source.updatedAt || 0) || null, plugins: { ...rows } };
}

function recordComparable(value) {
  const clone = { ...(value || {}) };
  delete clone.updatedAt;
  return clone;
}

function desiredRecord(existing, manifest, { qqaiVersion, defaultEnabled = true, now = Date.now(), available = true } = {}) {
  const requestedPermissions = normalizePermissions(manifest?.capabilities || []);
  const previous = existing && typeof existing === "object" ? existing : {};
  const desiredState = ["enabled", "disabled"].includes(previous.desiredState) ? previous.desiredState : (defaultEnabled ? "enabled" : "disabled");
  const grantedPermissions = previous.id ? normalizePermissions(previous.grantedPermissions, requestedPermissions) : requestedPermissions;
  const compatibility = pluginCompatibility(manifest, qqaiVersion);
  const grantedSet = new Set(grantedPermissions);
  const missingPermissions = Object.freeze(requestedPermissions.filter(value => !grantedSet.has(value)));
  let state = desiredState, blockReason = "";
  if (!available) { state = "blocked"; blockReason = "PLUGIN_BUNDLE_UNAVAILABLE"; }
  else if (!compatibility.ok) { state = "blocked"; blockReason = compatibility.reason || "PLUGIN_INCOMPATIBLE"; }
  else if (desiredState === "enabled" && missingPermissions.length) { state = "blocked"; blockReason = "PLUGIN_PERMISSIONS_MISSING"; }
  const next = {
    id: String(manifest?.id || previous.id || ""),
    installed: true,
    available: Boolean(available),
    official: manifest?.official === true,
    version: String(manifest?.version || previous.version || ""),
    apiVersion: String(manifest?.apiVersion || previous.apiVersion || ""),
    state,
    desiredState,
    requestedPermissions,
    grantedPermissions,
    missingPermissions,
    compatibility,
    blockReason,
    discoveredAt: Number(previous.discoveredAt || now),
    updatedAt: Number(previous.updatedAt || now),
    updatedBy: String(previous.updatedBy || "")
  };
  if (JSON.stringify(recordComparable(previous)) !== JSON.stringify(recordComparable(next))) next.updatedAt = now;
  return Object.freeze(next);
}

function createPluginLifecycleRegistry(storageAdapter, { qqaiVersion = "0.0.0", nowProvider = Date.now } = {}) {
  if (!storageAdapter || typeof storageAdapter.get !== "function" || typeof storageAdapter.put !== "function") throw new Error("PLUGIN_LIFECYCLE_STORAGE_INVALID");
  let cached = null;

  async function read() {
    if (cached) return cached;
    const raw = await storageAdapter.get(PLUGIN_LIFECYCLE_REGISTRY_KEY);
    if (raw === null || raw === undefined || raw === "") {
      cached = normalizeStoredRegistry(null);
      return cached;
    }
    try { cached = normalizeStoredRegistry(typeof raw === "string" ? JSON.parse(raw) : raw); }
    catch { cached = normalizeStoredRegistry(null); }
    return cached;
  }

  async function write(next) {
    const frozen = Object.freeze({
      schemaVersion: PLUGIN_LIFECYCLE_SCHEMA_VERSION,
      updatedAt: Number(next.updatedAt || nowProvider()),
      plugins: Object.freeze({ ...(next.plugins || {}) })
    });
    await storageAdapter.put(PLUGIN_LIFECYCLE_REGISTRY_KEY, JSON.stringify(frozen));
    cached = frozen;
    return frozen;
  }

  async function reconcile(candidates = [], { defaultEnabledPluginIds = null } = {}) {
    const current = await read();
    const list = (Array.isArray(candidates) ? candidates : []).filter(Boolean);
    const ids = list.map(candidate => String(manifestOf(candidate)?.id || "")).filter(Boolean);
    const defaults = Array.isArray(defaultEnabledPluginIds) ? new Set(defaultEnabledPluginIds.map(String)) : new Set(ids);
    const now = Number(nowProvider());
    const plugins = {};
    let changed = false;
    for (const candidate of list) {
      const manifest = manifestOf(candidate);
      const id = String(manifest?.id || "");
      if (!id) continue;
      const previous = current.plugins?.[id] || null;
      const record = desiredRecord(previous, manifest, { qqaiVersion, defaultEnabled: defaults.has(id), now, available: true });
      plugins[id] = record;
      if (!previous || JSON.stringify(previous) !== JSON.stringify(record)) changed = true;
    }
    for (const [id, previous] of Object.entries(current.plugins || {})) {
      if (plugins[id]) continue;
      const manifest = {
        id, version: previous.version, apiVersion: previous.apiVersion,
        minQQAI: previous.compatibility?.minQQAI || "", maxQQAI: previous.compatibility?.maxQQAI || "",
        official: previous.official === true, capabilities: previous.requestedPermissions || []
      };
      const record = desiredRecord(previous, manifest, { qqaiVersion, defaultEnabled: false, now, available: false });
      plugins[id] = record;
      if (JSON.stringify(previous) !== JSON.stringify(record)) changed = true;
    }
    const next = { schemaVersion: PLUGIN_LIFECYCLE_SCHEMA_VERSION, updatedAt: changed || !current.updatedAt ? now : current.updatedAt, plugins };
    if (changed || !current.updatedAt) return write(next);
    cached = Object.freeze({ ...next, plugins: Object.freeze({ ...plugins }) });
    return cached;
  }

  async function get(pluginId) {
    const state = await read();
    return state.plugins?.[String(pluginId || "")] || null;
  }

  async function list() {
    const state = await read();
    return Object.freeze(Object.values(state.plugins || {}).sort((a, b) => String(a.id).localeCompare(String(b.id))));
  }

  async function updateRecord(pluginId, mutate, actorId = "") {
    const current = await read();
    const id = String(pluginId || "");
    const previous = current.plugins?.[id];
    if (!previous) throw new Error("PLUGIN_LIFECYCLE_NOT_FOUND:" + id);
    const now = Number(nowProvider());
    const draft = mutate({ ...previous }, now) || { ...previous };
    draft.updatedAt = now;
    draft.updatedBy = String(actorId || "");
    const plugins = { ...(current.plugins || {}), [id]: Object.freeze(draft) };
    return (await write({ schemaVersion: PLUGIN_LIFECYCLE_SCHEMA_VERSION, updatedAt: now, plugins })).plugins[id];
  }

  async function setEnabled(pluginId, enabled, actorId = "") {
    return updateRecord(pluginId, record => {
      record.desiredState = enabled ? "enabled" : "disabled";
      const missing = Array.isArray(record.missingPermissions) ? record.missingPermissions : [];
      if (!record.available) { record.state = "blocked"; record.blockReason = "PLUGIN_BUNDLE_UNAVAILABLE"; }
      else if (record.compatibility?.ok !== true) { record.state = "blocked"; record.blockReason = record.compatibility?.reason || "PLUGIN_INCOMPATIBLE"; }
      else if (enabled && missing.length) { record.state = "blocked"; record.blockReason = "PLUGIN_PERMISSIONS_MISSING"; }
      else { record.state = enabled ? "enabled" : "disabled"; record.blockReason = ""; }
      return record;
    }, actorId);
  }

  async function setGrantedPermissions(pluginId, permissions = [], actorId = "") {
    return updateRecord(pluginId, record => {
      const requested = Array.isArray(record.requestedPermissions) ? record.requestedPermissions : [];
      const unknown = (Array.isArray(permissions) ? permissions : []).map(String).filter(value => !requested.includes(value));
      if (unknown.length) throw new Error("PLUGIN_PERMISSION_NOT_REQUESTED:" + unknown[0]);
      record.grantedPermissions = normalizePermissions(permissions, requested);
      const granted = new Set(record.grantedPermissions);
      record.missingPermissions = Object.freeze(requested.filter(value => !granted.has(value)));
      if (!record.available) { record.state = "blocked"; record.blockReason = "PLUGIN_BUNDLE_UNAVAILABLE"; }
      else if (record.compatibility?.ok !== true) { record.state = "blocked"; record.blockReason = record.compatibility?.reason || "PLUGIN_INCOMPATIBLE"; }
      else if (record.desiredState === "enabled" && record.missingPermissions.length) { record.state = "blocked"; record.blockReason = "PLUGIN_PERMISSIONS_MISSING"; }
      else { record.state = record.desiredState === "enabled" ? "enabled" : "disabled"; record.blockReason = ""; }
      return record;
    }, actorId);
  }

  async function markRuntimeBlocked(pluginId, reason, actorId = "") {
    return updateRecord(pluginId, record => {
      record.state = "blocked";
      record.blockReason = "PLUGIN_RUNTIME_BLOCKED:" + String(reason || "unknown").slice(0, 240);
      return record;
    }, actorId);
  }

  return Object.freeze({ get, list, markRuntimeBlocked, read, reconcile, setEnabled, setGrantedPermissions });
}

export {
  PLUGIN_LIFECYCLE_REGISTRY_KEY,
  PLUGIN_LIFECYCLE_SCHEMA_VERSION,
  PLUGIN_LIFECYCLE_STATES,
  compareSemver,
  createPluginLifecycleRegistry,
  normalizePermissions,
  parseSemver,
  pluginCompatibility
};
