import { developerIds, envBoolean, envInteger, envList } from "../../config/deployment.js";
import { VERSION } from "../../config/runtime.js";
import { createPluginLifecycleRegistry } from "../../plugins/lifecycle.js";
import { createV3Runtime, getV3Runtime } from "./runtime.js";

const V3_PUBLIC_STATUS_PATH = "/api/v3/status";
const V3_BILIBILI_MIN_POLL_MS = 30 * 60_000;
const V3_BILIBILI_MAX_POLL_MS = 6 * 60 * 60_000;

function v3RuntimeEnabled(env = {}) {
  return envBoolean(env?.V3_RUNTIME_ENABLED, true);
}

function v3BilibiliEnabled(env = {}) {
  return v3RuntimeEnabled(env) && envBoolean(env?.V3_BILIBILI_ENABLED, false);
}

function parseCreatorJson(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return [];
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch { throw new Error("V3_BILIBILI_CREATORS_INVALID_JSON"); }
  const rows = Array.isArray(parsed) ? parsed : (parsed && typeof parsed === "object" ? [parsed] : []);
  if (!rows.length && parsed !== null) throw new Error("V3_BILIBILI_CREATORS_INVALID");
  return rows.slice(0, 20);
}

function v3BilibiliCreators(env = {}) {
  const jsonRows = parseCreatorJson(env?.V3_BILIBILI_CREATORS_JSON);
  if (jsonRows.length) return jsonRows;
  return envList(env?.V3_BILIBILI_UIDS || env?.V3_BILIBILI_UID).slice(0, 20).map(uid => ({ uid }));
}

function v3RuntimeOptionsFromEnv(env = {}, overrides = {}) {
  const source = overrides && typeof overrides === "object" ? overrides : {};
  const official = { adminUserIds: envList(env?.V3_PLUGIN_ADMIN_IDS, developerIds(env)) };
  if (v3BilibiliEnabled(env)) {
    official.bilibili = {
      creators: v3BilibiliCreators(env),
      pollIntervalMs: envInteger(env?.V3_BILIBILI_POLL_INTERVAL_MS, 30 * 60_000, V3_BILIBILI_MIN_POLL_MS, V3_BILIBILI_MAX_POLL_MS),
      adminUserIds: envList(env?.V3_PLUGIN_ADMIN_IDS, developerIds(env))
    };
  }
  return {
    ...source,
    official: source.official === undefined ? official : source.official
  };
}

function createV3VolatileLifecycleRegistry() {
  const values = new Map();
  const storage = Object.freeze({
    get: async key => values.has(key) ? values.get(key) : null,
    put: async (key, value) => { values.set(key, value); },
    del: async key => { values.delete(key); }
  });
  return createPluginLifecycleRegistry(storage, { qqaiVersion: VERSION, persist: false });
}

function v3StorageDegradedRuntimeOptions(env = {}, runtimeOverrides = {}) {
  const options = v3RuntimeOptionsFromEnv(env, runtimeOverrides);
  return {
    ...options,
    dependencies: {
      ...(options.dependencies || {}),
      pluginLifecycle: createV3VolatileLifecycleRegistry()
    }
  };
}

async function withV3StorageDegradedRuntime(env, runtimeOverrides = {}, callback) {
  const runtime = createV3Runtime(env, v3StorageDegradedRuntimeOptions(env, runtimeOverrides));
  try {
    await runtime.start();
    return await callback(runtime);
  } finally {
    await runtime.stop().catch(() => {});
  }
}

async function dispatchV3RuntimeResult(runtime, body = {}, extra = {}) {
  const result = await runtime.dispatchOneBotEvent(body || {});
  const results = Array.isArray(result?.results) ? result.results : [];
  const consumed = results.some(item => item && typeof item === "object" && item.consume === true);
  return Object.freeze({ enabled: true, ...result, results: Object.freeze(results), consumed, ...extra });
}

function disabledResponse() {
  return new Response(JSON.stringify({ ok: false, code: "V3_RUNTIME_DISABLED" }), {
    status: 404,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}

function v3RuntimeStorageUnavailable(error) {
  return String(error?.code || "") === "D1_STORAGE_UNAVAILABLE";
}

function degradedPublicStatusResponse(code = "D1_STORAGE_UNAVAILABLE") {
  const payload = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    plugins: [],
    live: { active: false, activeCount: 0, stale: true, entries: [], rows: [] },
    degraded: { unavailable: true, storageUnavailable: code === "D1_STORAGE_UNAVAILABLE", code }
  };
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store, max-age=0" }
  });
}

async function handleV3RuntimeFetch(request, env, url = null, runtimeOverrides = {}) {
  const target = url instanceof URL ? url : new URL(request.url);
  if (target.pathname !== V3_PUBLIC_STATUS_PATH) return null;
  if (request.method !== "GET") {
    return new Response(JSON.stringify({ ok: false, code: "METHOD_NOT_ALLOWED" }), {
      status: 405,
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Allow": "GET" }
    });
  }
  if (!v3RuntimeEnabled(env)) return disabledResponse();
  try {
    const runtime = await getV3Runtime(env, v3RuntimeOptionsFromEnv(env, runtimeOverrides));
    return await runtime.publicStatusResponse();
  } catch (error) {
    if (v3RuntimeStorageUnavailable(error)) return degradedPublicStatusResponse();
    throw error;
  }
}

async function dispatchV3RuntimeEvent(env, body = {}, runtimeOverrides = {}) {
  if (!v3RuntimeEnabled(env)) return Object.freeze({ enabled: false, handled: false, consumed: false, results: Object.freeze([]) });
  try {
    const runtime = await getV3Runtime(env, v3RuntimeOptionsFromEnv(env, runtimeOverrides));
    return await dispatchV3RuntimeResult(runtime, body);
  } catch (error) {
    if (v3RuntimeStorageUnavailable(error)) {
      try {
        return await withV3StorageDegradedRuntime(env, runtimeOverrides, runtime => dispatchV3RuntimeResult(runtime, body, {
          degraded: true,
          code: "D1_STORAGE_UNAVAILABLE",
          lifecycleStorage: "volatile"
        }));
      } catch (fallbackError) {
        if (!v3RuntimeStorageUnavailable(fallbackError)) throw fallbackError;
        return Object.freeze({
          enabled: true,
          handled: false,
          consumed: false,
          degraded: true,
          code: "D1_STORAGE_UNAVAILABLE",
          lifecycleStorage: "volatile",
          results: Object.freeze([])
        });
      }
    }
    throw error;
  }
}

async function runV3RuntimeScheduled(env, scheduledTime = Date.now(), runtimeOverrides = {}) {
  if (!v3RuntimeEnabled(env)) return Object.freeze({ enabled: false, jobs: 0, results: Object.freeze([]) });
  const runtime = await getV3Runtime(env, v3RuntimeOptionsFromEnv(env, runtimeOverrides));
  const results = await runtime.runDuePluginJobs({ now: Number(scheduledTime || Date.now()) });
  return Object.freeze({ enabled: true, jobs: results.length, results });
}

export {
  V3_BILIBILI_MAX_POLL_MS,
  V3_BILIBILI_MIN_POLL_MS,
  V3_PUBLIC_STATUS_PATH,
  degradedPublicStatusResponse,
  dispatchV3RuntimeEvent,
  handleV3RuntimeFetch,
  parseCreatorJson,
  runV3RuntimeScheduled,
  v3StorageDegradedRuntimeOptions,
  withV3StorageDegradedRuntime,
  v3BilibiliCreators,
  v3BilibiliEnabled,
  v3RuntimeEnabled,
  v3RuntimeOptionsFromEnv,
  v3RuntimeStorageUnavailable
};
