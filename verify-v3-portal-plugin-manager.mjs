import assert from "node:assert/strict";
import fs from "node:fs";
import { handleV3PluginManagerApi, injectV3PluginManagerClient, normalizePortalPluginSettings } from "./src/v3/portal/plugin-manager.js";
import { releaseV3Runtime } from "./src/v3/runtime/runtime.js";

const auth = {
  getSession: async () => ({ qq: "42", role: "developer" }),
  isDeveloper: () => true
};

const disabledEnv = { V3_RUNTIME_ENABLED: "false" };
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

response = await handleV3PluginManagerApi(
  new Request("https://example.com/api/portal/v3/plugins"),
  disabledEnv,
  null,
  { getSession: async () => ({ qq: "system-admin", systemAdmin: true, permissions: {} }), isDeveloper: () => false }
);
assert.equal(response.status, 200, "System Admin must be allowed to manage V3 plugins even without a QQ developer id");
assert.equal((await response.json()).runtimeEnabled, false);

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
assert.equal(payload.pluginCount, 7, "six default official plugins plus Bilibili should be visible");
const biliPlugin = payload.plugins.find(plugin => plugin.id === "official.bilibili-live");
assert.ok(biliPlugin, "Bilibili plugin must be present in the manager list");
assert.equal(biliPlugin.settings.pollintervalms, 1800000);
assert.equal(biliPlugin.surface.writableSettings, true);
assert.equal(biliPlugin.active, true);
assert.equal(biliPlugin.lifecycle.state, "enabled");
assert.deepEqual(biliPlugin.requestedPermissions, ["network", "scheduler", "storage"]);
assert.deepEqual(biliPlugin.grantedPermissions, ["network", "scheduler", "storage"]);
assert.deepEqual(biliPlugin.requiredPermissions, ["network", "scheduler", "storage"]);
assert.equal(biliPlugin.trustStatus, "official_beta");
assert.equal(biliPlugin.trustLabelZh, "官方 Beta");
assert.equal(biliPlugin.releaseChannel, "preview");
assert.equal(biliPlugin.releaseChannelLabelZh, "抢先体验版");
assert.equal(biliPlugin.channelPreference, "stable");
assert.equal(biliPlugin.permissionDisclosures.find(row => row.capability === "network").externalDestinations[0], "api.live.bilibili.com");

response = await handleV3PluginManagerApi(
  new Request("https://example.com/api/portal/v3/plugins/official.bilibili-live/state", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ enabled: false })
  }), env, null, options
);
assert.equal(response.status, 200);
payload = await response.json();
assert.equal(payload.plugin.lifecycle.state, "disabled");
assert.equal(payload.plugin.active, false);

response = await handleV3PluginManagerApi(
  new Request("https://example.com/api/portal/v3/plugins/official.bilibili-live/permissions", {
    method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ permissions: ["storage", "scheduler"] })
  }), env, null, options
);
assert.equal(response.status, 200);
payload = await response.json();
assert.equal(payload.plugin.lifecycle.state, "disabled");
assert.deepEqual(payload.plugin.lifecycle.missingPermissions, ["network"]);

response = await handleV3PluginManagerApi(
  new Request("https://example.com/api/portal/v3/plugins/official.bilibili-live/state", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ enabled: true })
  }), env, null, options
);
assert.equal(response.status, 200);
payload = await response.json();
assert.equal(payload.plugin.lifecycle.state, "blocked");
assert.equal(payload.plugin.active, false);

response = await handleV3PluginManagerApi(
  new Request("https://example.com/api/portal/v3/plugins/official.bilibili-live/permissions", {
    method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ permissions: ["network", "scheduler", "storage"] })
  }), env, null, options
);
assert.equal(response.status, 200);
payload = await response.json();
assert.equal(payload.plugin.lifecycle.state, "enabled");
assert.equal(payload.plugin.active, true);

response = await handleV3PluginManagerApi(
  new Request("https://example.com/api/portal/v3/plugins/official.bilibili-live/release-channel", {
    method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ channel: "preview" })
  }), env, null, options
);
assert.equal(response.status, 200);
payload = await response.json();
assert.equal(payload.plugin.channelPreference, "preview");
assert.equal(payload.lifecycle.channelPreference, "preview");

response = await handleV3PluginManagerApi(
  new Request("https://example.com/api/portal/v3/plugins/official.bilibili-live/release-channel", {
    method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ channel: "stable" })
  }), env, null, options
);
assert.equal(response.status, 200);
payload = await response.json();
assert.equal(payload.plugin.channelPreference, "stable");

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
    body: JSON.stringify({ settings: { pollintervalms: 3600000 } })
  }),
  env,
  null,
  options
);
assert.equal(response.status, 200);
payload = await response.json();
assert.equal(payload.plugin.settings.pollintervalms, 3600000);
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
assert.equal(payload.plugin.settings.pollintervalms, 3600000);
assert.throws(() => normalizePortalPluginSettings(payload.plugin, { pollintervalms: 999999999 }), /PLUGIN_MANAGER_SETTING_RANGE/);

await releaseV3Runtime(env);

const html = '<!doctype html><html><head></head><body><div id="app" class="hidden"><nav id="nav"><button data-view="overview">總覽</button></nav><main><div class="content"><section id="v-overview" class="view active"></section></div></main></div></body></html>';
const injected = injectV3PluginManagerClient(html);
assert.match(injected, /id="v3PluginManagerNav"/);
assert.match(injected, /id="v-v3plugins"/);
assert.match(injected, /qqai-v3-plugin-manager-style/);
assert.match(injected, /qqai-v3-plugin-manager-client/);
assert.match(injected, /qqai-v3-plugin-lifecycle-style/);
assert.match(injected, /data-v3-toggle/);
assert.match(injected, /data-v3-permission/);
assert.match(injected, /外部传输/);
assert.match(injected, /必要/);
assert.match(injected, /生命周期与权限/);
assert.match(injected, /function statusLabel/);
assert.match(injected, /ENABLED:'已启用'/);
assert.match(injected, /BLOCKED:'已阻止'/);
assert.match(injected, /插件 API/);
assert.doesNotMatch(injected, /生命週期與權限|外部傳輸|設定唯讀/);
assert.doesNotMatch(injected, /必要權限|被阻擋|未授權|啟用|切換|優先|保存設定|正在读取 V3 Runtime/);
assert.match(injected, /保存版本偏好/);
assert.match(injected, /data-v3-save-channel/);
assert.equal(injectV3PluginManagerClient(injected), injected, "Portal injection must be idempotent");

const workerSource = fs.readFileSync("worker.js", "utf8");
assert.match(workerSource, /handleV3PluginManagerApi/);
assert.match(workerSource, /injectV3PluginManagerClient/);
assert.match(workerSource, /const v3PluginManagerResponse = await handleV3PluginManagerApi\(request, env, url\)/);

const pluginManagerDoc = fs.readFileSync("docs/v3-portal-plugin-manager.md", "utf8");
assert.match(pluginManagerDoc, /System Admin or a configured Developer/);
assert.match(pluginManagerDoc, /standalone 插件 navigation group/);
assert.match(pluginManagerDoc, /Package metadata operations do not hot-load or unload JavaScript runtime code/);
assert.doesNotMatch(pluginManagerDoc, /developer-only/);
assert.doesNotMatch(pluginManagerDoc, /persistent enable\/disable lifecycle are intentionally the next platform layer/);

console.log("verify-v3-portal-plugin-manager: ok");