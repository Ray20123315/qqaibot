import assert from "node:assert/strict";
import fs from "node:fs";
import { handleV3PluginManagerApi, injectV3PluginManagerClient, normalizePortalPluginSettings } from "./src/v3/portal/plugin-manager.js";
import { releaseV3Runtime } from "./src/v3/runtime/runtime.js";

const auth = {
  getSession: async () => ({ qq: "42", role: "developer" }),
  isDeveloper: () => true
};

const disabledEnv = {};
let storageReads = 0;
let response = await handleV3PluginManagerApi(
  new Request("https://example.com/api/portal/v3/plugins"),
  disabledEnv,
  null,
  { ...auth, runtimeOverrides: { dependencies: { dbGet: async () => { storageReads += 1; return null; } } } }
);
assert.equal(response.status, 200);
let payload = await response.json();
assert.equal(payload.ok, true);
assert.equal(payload.runtimeEnabled, false);
assert.equal(payload.pluginCount, 0);
assert.equal(storageReads, 0, "disabled Plugin Manager list must not start V3 or read V3 storage");

response = await handleV3PluginManagerApi(
  new Request("https://example.com/api/portal/v3/plugins"),
  {},
  null,
  { getSession: async () => ({ qq: "7" }), isDeveloper: () => false }
);
assert.equal(response.status, 403);
assert.equal((await response.json()).code, "PLUGIN_MANAGER_DEVELOPER_REQUIRED");

const env = {
  V3_RUNTIME_ENABLED: "true",
  V3_BILIBILI_ENABLED: "true",
  V3_BILIBILI_UIDS: "123",
  V3_PLUGIN_ADMIN_IDS: "42",
  V3_BILIBILI_POLL_INTERVAL_MS: "120000"
};
const db = new Map();
const dependencies = {
  dbGet: async key => db.has(key) ? db.get(key) : null,
  dbPut: async (key, value) => { db.set(key, value); },
  dbDel: async key => { db.delete(key); },
  onebotCall: async () => ({ ok: true }),
  safeFetch: async () => { throw new Error("provider must not be called by manager read/update"); }
};
const options = { ...auth, runtimeOverrides: { dependencies, logger: { info(){}, warn(){}, error(){}, debug(){} } } };

response = await handleV3PluginManagerApi(new Request("https://example.com/api/portal/v3/plugins"), env, null, options);
assert.equal(response.status, 200);
payload = await response.json();
assert.equal(payload.runtimeEnabled, true);
assert.equal(payload.bilibiliEnabled, true);
assert.equal(payload.pluginCount, 1);
assert.equal(payload.plugins[0].id, "official.bilibili-live");
assert.equal(payload.plugins[0].settings.pollintervalms, 120000);
assert.equal(payload.plugins[0].surface.writableSettings, true);

response = await handleV3PluginManagerApi(
  new Request("https://example.com/api/portal/v3/plugins/official.bilibili-live/settings", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ settings: { unknown: 1 } })
  }),
  env,
  null,
  options
);
assert.equal(response.status, 400);
assert.equal((await response.json()).code, "PLUGIN_MANAGER_SETTING_UNKNOWN");

response = await handleV3PluginManagerApi(
  new Request("https://example.com/api/portal/v3/plugins/official.bilibili-live/settings", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ settings: { pollintervalms: 180000 } })
  }),
  env,
  null,
  options
);
assert.equal(response.status, 200);
payload = await response.json();
assert.equal(payload.plugin.settings.pollintervalms, 180000);
assert.equal(payload.plugin.status.state, "OK");

response = await handleV3PluginManagerApi(
  new Request("https://example.com/api/portal/v3/plugins/official.bilibili-live"),
  env,
  null,
  options
);
assert.equal(response.status, 200);
payload = await response.json();
assert.equal(payload.plugin.id, "official.bilibili-live");
assert.equal(payload.plugin.settings.pollintervalms, 180000);
assert.throws(() => normalizePortalPluginSettings(payload.plugin, { pollintervalms: 999999999 }), /PLUGIN_MANAGER_SETTING_RANGE/);

await releaseV3Runtime(env);

const html = '<!doctype html><html><head></head><body><div id="app" class="hidden"><nav id="nav"><button data-view="overview">總覽</button></nav><main><div class="content"><section id="v-overview" class="view active"></section></div></main></div></body></html>';
const injected = injectV3PluginManagerClient(html);
assert.match(injected, /id="v3PluginManagerNav"/);
assert.match(injected, /id="v-v3plugins"/);
assert.match(injected, /qqai-v3-plugin-manager-style/);
assert.match(injected, /qqai-v3-plugin-manager-client/);
assert.equal(injectV3PluginManagerClient(injected), injected, "Portal injection must be idempotent");

const workerSource = fs.readFileSync("worker.js", "utf8");
assert.match(workerSource, /handleV3PluginManagerApi/);
assert.match(workerSource, /injectV3PluginManagerClient/);
assert.match(workerSource, /const v3PluginManagerResponse = await handleV3PluginManagerApi\(request, env, url\)/);

console.log("verify-v3-portal-plugin-manager: ok");
