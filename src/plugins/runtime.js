import { listBundledPlugins } from "./bundled/index.js";

const PLUGIN_EXECUTION_MODES = Object.freeze({
  TRUSTED_BUNDLED: "trusted_bundled",
  SANDBOXED_EXTERNAL: "sandboxed_external",
});

const EXTERNAL_PLUGIN_LIMITS = Object.freeze({
  maxCodeBytes: 128 * 1024,
  maxRequestBytes: 64 * 1024,
  maxResponseBytes: 64 * 1024,
  maxActions: 16,
  maxReplyChars: 4000,
  cpuMs: 20,
  subRequests: 1,
});

const EXTERNAL_ACTION_TYPES = new Set(["reply", "log", "metric"]);
const PLUGIN_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{1,63}$/;
const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const EVENT_PATTERN = /^[a-z][a-z0-9._:-]{0,63}$/;
const PORTAL_VIEW_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;
const PORTAL_API_PREFIX_PATTERN = /^\/[a-z0-9][a-z0-9/_-]{0,95}$/;
const PORTAL_LOCALE_PATTERN = /^[a-z]{2,3}(?:-[A-Z0-9]{2,8})?$/;
const textEncoder = new TextEncoder();

function uniqueStrings(values, { maxItems = 64, pattern = null } = {}) {
  const output = [];
  const seen = new Set();
  for (const raw of Array.isArray(values) ? values : []) {
    const value = String(raw || "").trim().toLowerCase();
    if (!value || seen.has(value) || (pattern && !pattern.test(value))) continue;
    seen.add(value);
    output.push(value);
    if (output.length >= maxItems) break;
  }
  return output;
}

function normalizePortalMetadata(value) {
  const source = value && typeof value === "object" ? value : {};
  const views = uniqueStrings(source.views, { maxItems: 32, pattern: PORTAL_VIEW_PATTERN });
  const defaultView = String(source.defaultView || "").trim().toLowerCase();
  return Object.freeze({
    category: String(source.category || "other").trim().toLowerCase().slice(0, 48),
    icon: String(source.icon || "◇").trim().slice(0, 8),
    defaultView: PORTAL_VIEW_PATTERN.test(defaultView) && views.includes(defaultView) ? defaultView : (views[0] || ""),
    views,
    order: Math.max(0, Math.min(9999, Number(source.order || 0) || 0)),
    legacyBridge: source.legacyBridge === true,
    developerOnly: source.developerOnly === true,
    defaultEnabled: source.defaultEnabled !== false,
    apiPrefixes: uniqueStrings(source.apiPrefixes, { maxItems: 32, pattern: PORTAL_API_PREFIX_PATTERN })
  });
}

function normalizePluginTranslations(value) {
  const source = value && typeof value === "object" ? value : {};
  const out = {};
  for (const [locale, raw] of Object.entries(source)) {
    if (!PORTAL_LOCALE_PATTERN.test(locale)) continue;
    const row = raw && typeof raw === "object" ? raw : {};
    const name = String(row.name || "").trim().slice(0, 120);
    const description = String(row.description || "").trim().slice(0, 500);
    if (!name && !description) continue;
    out[locale] = Object.freeze({ name, description });
  }
  return Object.freeze(out);
}

function normalizePluginManifest(value) {
  const source = value && typeof value === "object" ? value : {};
  const mode = String(source.mode || "").trim().toLowerCase();
  return Object.freeze({
    schemaVersion: 1,
    id: String(source.id || "").trim().toLowerCase(),
    name: String(source.name || source.id || "").trim().slice(0, 120),
    version: String(source.version || "").trim(),
    mode,
    events: uniqueStrings(source.events, { maxItems: 64, pattern: EVENT_PATTERN }),
    capabilities: uniqueStrings(source.capabilities, { maxItems: 32, pattern: /^[a-z][a-z0-9._:-]{0,63}$/ }),
    author: String(source.author || "").trim().slice(0, 120),
    description: String(source.description || "").trim().slice(0, 500),
    portal: normalizePortalMetadata(source.portal),
    i18n: normalizePluginTranslations(source.i18n),
  });
}

function validatePluginManifest(value, { expectedMode = "" } = {}) {
  const manifest = normalizePluginManifest(value);
  const errors = [];
  if (!PLUGIN_ID_PATTERN.test(manifest.id)) errors.push("manifest.id must match /^[a-z0-9][a-z0-9._-]{1,63}$/");
  if (!SEMVER_PATTERN.test(manifest.version)) errors.push("manifest.version must be SemVer");
  if (!Object.values(PLUGIN_EXECUTION_MODES).includes(manifest.mode)) errors.push("manifest.mode is not supported");
  if (expectedMode && manifest.mode !== expectedMode) errors.push(`manifest.mode must be ${expectedMode}`);
  if (!manifest.events.length) errors.push("manifest.events must declare at least one event");
  if (manifest.mode === PLUGIN_EXECUTION_MODES.SANDBOXED_EXTERNAL && manifest.capabilities.length) {
    errors.push("sandboxed_external capabilities must be empty until an explicit host capability is implemented");
  }
  return { ok: errors.length === 0, errors, manifest };
}

function sanitizeJson(value, fallback = null) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return fallback;
  }
}

function byteLength(value) {
  return textEncoder.encode(String(value || "")).byteLength;
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(String(value || "")));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function normalizeExternalAction(value) {
  const source = value && typeof value === "object" ? value : {};
  const type = String(source.type || "").trim().toLowerCase();
  if (!EXTERNAL_ACTION_TYPES.has(type)) return null;
  if (type === "reply") {
    const text = String(source.text || "").trim();
    if (!text) return null;
    return Object.freeze({ type, text: text.slice(0, EXTERNAL_PLUGIN_LIMITS.maxReplyChars), scope: "same_event" });
  }
  if (type === "log") {
    const level = ["debug", "info", "warn", "error"].includes(String(source.level || "").toLowerCase())
      ? String(source.level).toLowerCase()
      : "info";
    return Object.freeze({ type, level, message: String(source.message || "").slice(0, 2000) });
  }
  const name = String(source.name || "").trim().toLowerCase().replace(/[^a-z0-9._:-]/g, "").slice(0, 80);
  if (!name) return null;
  const numericValue = Number(source.value ?? 1);
  return Object.freeze({ type, name, value: Number.isFinite(numericValue) ? numericValue : 1 });
}

function normalizePluginResult(value, { external = false } = {}) {
  const source = value && typeof value === "object" ? value : {};
  const rawActions = Array.isArray(source.actions) ? source.actions : [];
  const actions = [];
  for (const item of rawActions.slice(0, EXTERNAL_PLUGIN_LIMITS.maxActions)) {
    const action = external ? normalizeExternalAction(item) : sanitizeJson(item, null);
    if (action) actions.push(action);
  }
  return Object.freeze({
    ok: source.ok !== false,
    handled: Boolean(source.handled || actions.length),
    actions,
    data: sanitizeJson(source.data, null),
  });
}

function validateTrustedBundledDefinition(definition) {
  const manifestCheck = validatePluginManifest(definition?.manifest, { expectedMode: PLUGIN_EXECUTION_MODES.TRUSTED_BUNDLED });
  const errors = [...manifestCheck.errors];
  if (typeof definition?.handler !== "function") errors.push("trusted bundled plugin must export handler(payload, context)");
  return { ok: errors.length === 0, errors, manifest: manifestCheck.manifest };
}

function validateSandboxedExternalDefinition(definition) {
  const manifestCheck = validatePluginManifest(definition?.manifest, { expectedMode: PLUGIN_EXECUTION_MODES.SANDBOXED_EXTERNAL });
  const errors = [...manifestCheck.errors];
  const code = String(definition?.code || "");
  if (!code.trim()) errors.push("sandboxed external plugin code is required");
  if (byteLength(code) > EXTERNAL_PLUGIN_LIMITS.maxCodeBytes) errors.push(`sandboxed external plugin exceeds ${EXTERNAL_PLUGIN_LIMITS.maxCodeBytes} bytes`);
  return { ok: errors.length === 0, errors, manifest: manifestCheck.manifest, code };
}

async function executeTrustedBundledPlugin(definition, payload, context = {}) {
  const check = validateTrustedBundledDefinition(definition);
  if (!check.ok) return { ok: false, code: "PLUGIN_INVALID", errors: check.errors, manifest: check.manifest };
  const safePayload = sanitizeJson(payload, {});
  const result = await definition.handler(safePayload, context);
  return { ...normalizePluginResult(result), mode: PLUGIN_EXECUTION_MODES.TRUSTED_BUNDLED, manifest: check.manifest };
}

const SANDBOX_WRAPPER_SOURCE = `
import * as pluginModule from "./plugin.js";

function getHandler() {
  if (typeof pluginModule.onEvent === "function") return pluginModule.onEvent;
  if (typeof pluginModule.default === "function") return pluginModule.default;
  if (pluginModule.default && typeof pluginModule.default.onEvent === "function") return pluginModule.default.onEvent.bind(pluginModule.default);
  return null;
}

export default {
  async fetch(request, env) {
    if (request.method !== "POST") return Response.json({ ok: false, error: "METHOD_NOT_ALLOWED" }, { status: 405 });
    const handler = getHandler();
    if (!handler) return Response.json({ ok: false, error: "PLUGIN_HANDLER_MISSING" }, { status: 400 });
    let payload = {};
    try { payload = await request.json(); } catch { return Response.json({ ok: false, error: "INVALID_JSON" }, { status: 400 }); }
    const result = await handler(payload, Object.freeze({ plugin: env.QQAI_PLUGIN }));
    return Response.json({ ok: true, result: result ?? null });
  }
};
`;

async function externalWorkerId(manifest, code) {
  const digest = await sha256Hex(`${manifest.id}\n${manifest.version}\n${code}`);
  return `qqai-plugin:${manifest.id}:${manifest.version}:${digest.slice(0, 24)}`;
}

async function executeSandboxedExternalPlugin(definition, payload, env) {
  const check = validateSandboxedExternalDefinition(definition);
  if (!check.ok) return { ok: false, code: "PLUGIN_INVALID", errors: check.errors, manifest: check.manifest };
  if (!env?.PLUGIN_LOADER || typeof env.PLUGIN_LOADER.get !== "function") {
    return {
      ok: false,
      code: "PLUGIN_SANDBOX_UNAVAILABLE",
      message: "PLUGIN_LOADER Worker Loader binding is not configured. Dynamic Workers currently require the Workers Paid plan.",
      manifest: check.manifest,
    };
  }

  const safePayload = sanitizeJson(payload, {});
  const requestBody = JSON.stringify(safePayload);
  if (byteLength(requestBody) > EXTERNAL_PLUGIN_LIMITS.maxRequestBytes) {
    return { ok: false, code: "PLUGIN_INPUT_TOO_LARGE", manifest: check.manifest };
  }

  const id = await externalWorkerId(check.manifest, check.code);
  const worker = env.PLUGIN_LOADER.get(id, async () => ({
    compatibilityDate: "2026-09-19",
    mainModule: "qqai-plugin-host.js",
    modules: {
      "qqai-plugin-host.js": SANDBOX_WRAPPER_SOURCE,
      "plugin.js": check.code,
    },
    env: {
      QQAI_PLUGIN: {
        id: check.manifest.id,
        version: check.manifest.version,
        mode: PLUGIN_EXECUTION_MODES.SANDBOXED_EXTERNAL,
      },
    },
    globalOutbound: null,
    limits: {
      cpuMs: EXTERNAL_PLUGIN_LIMITS.cpuMs,
      subRequests: EXTERNAL_PLUGIN_LIMITS.subRequests,
    },
  }));

  const request = new Request("https://plugin.invalid/qqai/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: requestBody,
  });
  let response;
  try {
    const entrypoint = worker.getEntrypoint(null, {
      limits: {
        cpuMs: EXTERNAL_PLUGIN_LIMITS.cpuMs,
        subRequests: EXTERNAL_PLUGIN_LIMITS.subRequests,
      },
    });
    response = await entrypoint.fetch(request);
  } catch (error) {
    return { ok: false, code: "PLUGIN_SANDBOX_EXECUTION_FAILED", error: String(error?.message || error).slice(0, 1000), manifest: check.manifest };
  }

  const responseText = await response.text();
  if (byteLength(responseText) > EXTERNAL_PLUGIN_LIMITS.maxResponseBytes) {
    return { ok: false, code: "PLUGIN_OUTPUT_TOO_LARGE", manifest: check.manifest };
  }
  let envelope;
  try { envelope = JSON.parse(responseText); } catch {
    return { ok: false, code: "PLUGIN_OUTPUT_INVALID_JSON", status: response.status, manifest: check.manifest };
  }
  if (!response.ok || envelope?.ok !== true) {
    return { ok: false, code: String(envelope?.error || "PLUGIN_REJECTED"), status: response.status, manifest: check.manifest };
  }
  return { ...normalizePluginResult(envelope.result, { external: true }), mode: PLUGIN_EXECUTION_MODES.SANDBOXED_EXTERNAL, manifest: check.manifest, sandboxId: id };
}

async function executeSelfMadePlugin(definition, payload, { env = null, trustedContext = {} } = {}) {
  const mode = String(definition?.manifest?.mode || "").trim().toLowerCase();
  if (mode === PLUGIN_EXECUTION_MODES.TRUSTED_BUNDLED) return executeTrustedBundledPlugin(definition, payload, trustedContext);
  if (mode === PLUGIN_EXECUTION_MODES.SANDBOXED_EXTERNAL) return executeSandboxedExternalPlugin(definition, payload, env);
  return { ok: false, code: "PLUGIN_MODE_UNSUPPORTED" };
}

async function applyExternalPluginActions(result, host = {}) {
  const applied = [];
  for (const action of Array.isArray(result?.actions) ? result.actions : []) {
    if (action.type === "reply" && typeof host.reply === "function") {
      await host.reply(action.text, { scope: "same_event" });
      applied.push({ type: "reply", ok: true });
    } else if (action.type === "log" && typeof host.log === "function") {
      await host.log(action.level, action.message);
      applied.push({ type: "log", ok: true });
    } else if (action.type === "metric" && typeof host.metric === "function") {
      await host.metric(action.name, action.value);
      applied.push({ type: "metric", ok: true });
    } else {
      applied.push({ type: action.type, ok: false, reason: "HOST_CAPABILITY_NOT_PROVIDED" });
    }
  }
  return applied;
}

function portalPluginCatalog() {
  return listBundledPlugins()
    .map(definition => validateTrustedBundledDefinition(definition))
    .filter(result => result.ok && result.manifest.portal?.views?.length)
    .map(result => Object.freeze({
      id: result.manifest.id,
      name: result.manifest.name,
      version: result.manifest.version,
      description: result.manifest.description,
      author: result.manifest.author,
      portal: result.manifest.portal,
      i18n: result.manifest.i18n
    }))
    .sort((a, b) => Number(a.portal.order || 0) - Number(b.portal.order || 0) || a.id.localeCompare(b.id));
}

function portalPluginStateKey(pluginId) {
  return `portal_plugin_enabled:${String(pluginId || "").trim().toLowerCase()}`;
}

function portalPluginById(pluginId) {
  const id = String(pluginId || "").trim().toLowerCase();
  return portalPluginCatalog().find(plugin => plugin.id === id) || null;
}

function portalPluginForView(viewName) {
  const view = String(viewName || "").trim().toLowerCase();
  return portalPluginCatalog().find(plugin => plugin.portal.views.includes(view)) || null;
}

function portalPluginForApiPath(pathname) {
  const path = String(pathname || "").trim().toLowerCase();
  const matches = portalPluginCatalog().flatMap(plugin =>
    (plugin.portal.apiPrefixes || [])
      .filter(prefix => path === prefix || path.startsWith(prefix.endsWith("/") ? prefix : prefix + "/"))
      .map(prefix => ({ plugin, prefix }))
  );
  matches.sort((a, b) => b.prefix.length - a.prefix.length);
  return matches[0]?.plugin || null;
}

async function readPortalPluginEnabled(env, pluginId) {
  const plugin = portalPluginById(pluginId);
  if (!plugin) return null;
  const fallback = plugin.portal.defaultEnabled !== false;
  if (!env?.DB) return fallback;
  try {
    const row = await env.DB.prepare("SELECT value FROM kv_store WHERE key = ?")
      .bind(portalPluginStateKey(plugin.id))
      .first();
    if (!row) return fallback;
    return String(row.value || "").toLowerCase() === "true";
  } catch (error) {
    console.error("plugin state read failed", { pluginId: plugin.id, error: String(error?.message || error).slice(0, 300) });
    return fallback;
  }
}

async function setPortalPluginEnabled(env, pluginId, enabled) {
  const plugin = portalPluginById(pluginId);
  if (!plugin) return { ok: false, code: "PLUGIN_NOT_FOUND", message: "找不到這個插件。" };
  if (!env?.DB) return { ok: false, code: "PLUGIN_STATE_STORAGE_UNAVAILABLE", message: "D1 尚未綁定，無法保存插件狀態。" };
  try {
    await env.DB.prepare("INSERT INTO kv_store (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
      .bind(portalPluginStateKey(plugin.id), enabled ? "true" : "false")
      .run();
    return { ok: true, pluginId: plugin.id, enabled: Boolean(enabled) };
  } catch (error) {
    console.error("plugin state write failed", { pluginId: plugin.id, error: String(error?.message || error).slice(0, 300) });
    return { ok: false, code: "PLUGIN_STATE_STORAGE_UNAVAILABLE", message: "插件狀態無法寫入 D1，設定沒有變更。" };
  }
}

async function portalPluginCatalogState(env, { developer = false } = {}) {
  const catalog = portalPluginCatalog();
  const rows = [];
  for (const plugin of catalog) {
    if (plugin.portal.developerOnly && !developer) continue;
    const enabled = await readPortalPluginEnabled(env, plugin.id);
    if (!developer && !enabled) continue;
    rows.push(Object.freeze({ ...plugin, enabled: Boolean(enabled) }));
  }
  return rows;
}

function pluginExecutionStatus(env) {
  return Object.freeze({
    trustedBundled: { available: true, requiresRebuild: true, registered: listBundledPlugins().length },
    sandboxedExternal: {
      available: Boolean(env?.PLUGIN_LOADER && typeof env.PLUGIN_LOADER.get === "function"),
      isolation: "cloudflare_dynamic_worker",
      outboundNetwork: "blocked",
      coreBindingsShared: false,
      paidPlanRequired: true,
    },
  });
}

export {
  EXTERNAL_PLUGIN_LIMITS,
  PLUGIN_EXECUTION_MODES,
  SANDBOX_WRAPPER_SOURCE,
  applyExternalPluginActions,
  executeSandboxedExternalPlugin,
  executeSelfMadePlugin,
  executeTrustedBundledPlugin,
  normalizePluginManifest,
  normalizePluginResult,
  pluginExecutionStatus,
  portalPluginById,
  portalPluginCatalog,
  portalPluginCatalogState,
  portalPluginForApiPath,
  portalPluginForView,
  portalPluginStateKey,
  readPortalPluginEnabled,
  setPortalPluginEnabled,
  validatePluginManifest,
  validateSandboxedExternalDefinition,
  validateTrustedBundledDefinition,
};
