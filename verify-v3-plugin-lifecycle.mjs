import assert from "node:assert/strict";
import { definePlugin } from "./src/plugins/api.js";
import { PLUGIN_LIFECYCLE_REGISTRY_KEY, createPluginLifecycleRegistry, pluginCompatibility } from "./src/plugins/lifecycle.js";
import { createV3Runtime } from "./src/v3/runtime/runtime.js";

const map = new Map();
const reads = [];
const storage = {
  async get(key) { reads.push(key); return map.has(key) ? map.get(key) : null; },
  async put(key, value) { map.set(key, value); },
  async del(key) { map.delete(key); }
};

const lifecyclePlugin = definePlugin({
  manifest: { id: "test.lifecycle", name: "Lifecycle Test", version: "1.0.0", apiVersion: "1", minQQAI: "2.0.0", maxQQAI: "4.0.0", capabilities: ["storage"] }
});
const futurePlugin = definePlugin({
  manifest: { id: "test.future", name: "Future", version: "1.0.0", apiVersion: "1", minQQAI: "99.0.0", capabilities: [] }
});

const registry = createPluginLifecycleRegistry(storage, { qqaiVersion: "3.0.0", nowProvider: () => 1000 });
let snapshot = await registry.reconcile([lifecyclePlugin, futurePlugin]);
assert.equal(snapshot.plugins["test.lifecycle"].state, "enabled");
assert.deepEqual(snapshot.plugins["test.lifecycle"].grantedPermissions, ["storage"]);
assert.equal(snapshot.plugins["test.future"].state, "blocked");
assert.equal(snapshot.plugins["test.future"].blockReason, "PLUGIN_REQUIRES_NEWER_QQAI");
assert.equal(map.has(PLUGIN_LIFECYCLE_REGISTRY_KEY), true);
assert(reads.every(key => key === PLUGIN_LIFECYCLE_REGISTRY_KEY), "lifecycle persistence must use one exact key");

await registry.setEnabled("test.lifecycle", false, "42");
assert.equal((await registry.get("test.lifecycle")).state, "disabled");
const secondRegistry = createPluginLifecycleRegistry(storage, { qqaiVersion: "3.0.0", nowProvider: () => 2000 });
snapshot = await secondRegistry.reconcile([lifecyclePlugin, futurePlugin]);
assert.equal(snapshot.plugins["test.lifecycle"].state, "disabled");

let record = await secondRegistry.setGrantedPermissions("test.lifecycle", [], "42");
assert.equal(record.state, "disabled");
record = await secondRegistry.setEnabled("test.lifecycle", true, "42");
assert.equal(record.state, "blocked");
assert.equal(record.blockReason, "PLUGIN_PERMISSIONS_MISSING");
record = await secondRegistry.setGrantedPermissions("test.lifecycle", ["storage"], "42");
assert.equal(record.state, "enabled");
await assert.rejects(() => secondRegistry.setGrantedPermissions("test.lifecycle", ["network"], "42"), /PLUGIN_PERMISSION_NOT_REQUESTED/);
assert.equal(pluginCompatibility(lifecyclePlugin.manifest, "3.0.0").ok, true);
assert.equal(pluginCompatibility(futurePlugin.manifest, "3.0.0").ok, false);

let loads = 0, unloads = 0, commands = 0;
const runtimePlugin = definePlugin({
  manifest: { id: "test.runtime-life", name: "Runtime Lifecycle", version: "1.0.0", apiVersion: "1", capabilities: ["storage"] },
  commands: [{
    name: "runtime-life",
    async run(ctx) { commands += 1; await ctx.storage.set("last", commands); return commands; }
  }],
  async onLoad() { loads += 1; },
  async onUnload() { unloads += 1; }
});
const runtimeDb = new Map();
const runtime = createV3Runtime({}, {
  plugins: [runtimePlugin],
  dependencies: {
    qqaiVersion: "3.0.0",
    dbGet: async key => runtimeDb.has(key) ? runtimeDb.get(key) : null,
    dbPut: async (key, value) => { runtimeDb.set(key, value); },
    dbDel: async key => { runtimeDb.delete(key); },
    onebotCall: async () => ({ ok: true }),
    safeFetch: async () => { throw new Error("network unexpected"); }
  },
  logger: { info(){}, warn(){}, error(){}, debug(){} }
});
await runtime.start();
assert.equal(loads, 1);
assert.equal(runtime.listPlugins()[0].active, true);
assert.equal(runtime.listPlugins()[0].lifecycle.state, "enabled");
let result = await runtime.runCommand("runtime-life");
assert.equal(result.handled, true);
assert.equal(commands, 1);

record = await runtime.setPluginEnabled("test.runtime-life", false, { userId: "42" });
assert.equal(record.state, "disabled");
assert.equal(unloads, 1);
assert.equal(runtime.listPlugins()[0].active, false);
result = await runtime.runCommand("runtime-life");
assert.equal(result.handled, false);
assert.equal(result.inactive, true);

record = await runtime.setPluginEnabled("test.runtime-life", true, { userId: "42" });
assert.equal(record.state, "enabled");
assert.equal(loads, 2);

record = await runtime.setPluginPermissions("test.runtime-life", [], { userId: "42" });
assert.equal(record.state, "blocked");
assert.equal(runtime.listPlugins()[0].active, false);
result = await runtime.runCommand("runtime-life");
assert.equal(result.handled, false);

record = await runtime.setPluginPermissions("test.runtime-life", ["storage"], { userId: "42" });
assert.equal(record.state, "enabled");
assert.equal(runtime.listPlugins()[0].active, true);
assert.equal(loads, 3);
result = await runtime.runCommand("runtime-life");
assert.equal(result.handled, true);
assert.equal(commands, 2);

assert.equal(runtimeDb.has(PLUGIN_LIFECYCLE_REGISTRY_KEY), true);
await runtime.stop();
assert.equal(unloads, 3);
console.log("verify-v3-plugin-lifecycle: ok");
