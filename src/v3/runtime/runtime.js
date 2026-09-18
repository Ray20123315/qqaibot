import { createBilibiliLivePlugin } from "../../plugins/official/index.js";
import { createV3HostAdapter } from "../host/adapter.js";
import { buildV3PublicStatus, v3PublicStatusResponse } from "../public/status.js";

const V3_RUNTIME_CACHE = new WeakMap();

function normalizeExtraPlugins(value) {
  return Object.freeze((Array.isArray(value) ? value : []).filter(Boolean));
}

function createOfficialV3Plugins(options = {}) {
  const source = options && typeof options === "object" ? options : {};
  const plugins = [];
  if (source.bilibili && source.bilibili !== false) {
    if (typeof source.bilibili !== "object") throw new Error("V3_BILIBILI_OPTIONS_INVALID");
    plugins.push(createBilibiliLivePlugin(source.bilibili));
  }
  return Object.freeze(plugins);
}

function createV3Runtime(env, options = {}) {
  if (!env || typeof env !== "object") throw new Error("V3_RUNTIME_ENV_REQUIRED");
  const source = options && typeof options === "object" ? options : {};
  const plugins = Object.freeze([
    ...createOfficialV3Plugins(source.official || {}),
    ...normalizeExtraPlugins(source.plugins)
  ]);
  const adapter = createV3HostAdapter(env, {
    plugins,
    logger: source.logger || console,
    dependencies: source.dependencies || {},
    allowedOneBotActions: source.allowedOneBotActions
  });
  let startPromise = null;
  let stopped = false;

  async function start() {
    if (stopped) throw new Error("V3_RUNTIME_STOPPED");
    if (!startPromise) startPromise = Promise.resolve(adapter.start());
    await startPromise;
    return api;
  }

  async function ensureStarted() {
    await start();
    return adapter;
  }

  async function stop() {
    if (stopped) return;
    if (startPromise) await startPromise;
    await adapter.stop();
    stopped = true;
  }

  const api = Object.freeze({
    adapter,
    dispatchOneBotEvent: async body => (await ensureStarted()).dispatchOneBotEvent(body),
    getPluginPublicStatus: async id => (await ensureStarted()).getPluginPublicStatus(id),
    getPluginSurface: async (id, eventContext = {}) => (await ensureStarted()).getPluginSurface(id, eventContext),
    listPlugins: () => adapter.listPlugins(),
    publicStatus: async statusOptions => buildV3PublicStatus(await ensureStarted(), statusOptions || {}),
    publicStatusResponse: async statusOptions => v3PublicStatusResponse(await ensureStarted(), statusOptions || {}),
    runCommand: async (name, input = {}, eventContext = {}) => (await ensureStarted()).runCommand(name, input, eventContext),
    runDuePluginJobs: async runOptions => (await ensureStarted()).runDuePluginJobs(runOptions || {}),
    start,
    stop,
    updatePluginSettings: async (id, input = {}, eventContext = {}) => (await ensureStarted()).updatePluginSettings(id, input, eventContext)
  });
  return api;
}

async function getV3Runtime(env, options = {}) {
  if (!env || typeof env !== "object") throw new Error("V3_RUNTIME_ENV_REQUIRED");
  let runtime = V3_RUNTIME_CACHE.get(env);
  if (!runtime) {
    runtime = createV3Runtime(env, options);
    V3_RUNTIME_CACHE.set(env, runtime);
  }
  await runtime.start();
  return runtime;
}

async function releaseV3Runtime(env) {
  const runtime = env && typeof env === "object" ? V3_RUNTIME_CACHE.get(env) : null;
  if (!runtime) return false;
  V3_RUNTIME_CACHE.delete(env);
  await runtime.stop();
  return true;
}

export { createOfficialV3Plugins, createV3Runtime, getV3Runtime, normalizeExtraPlugins, releaseV3Runtime };
