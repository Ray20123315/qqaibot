import assert from "node:assert/strict";
import { definePlugin } from "./src/plugins/api.js";
import { QQAI_PLUGIN_API_VERSION } from "./src/plugins/constants.js";
import { normalizePluginManifest } from "./src/plugins/manifest.js";
import { createPluginHost } from "./src/plugins/runtime.js";
import { createPluginStorage, pluginStorageDatabaseKey } from "./src/plugins/storage.js";
import { helloPlugin } from "./src/plugins/official/hello.js";

assert.equal(QQAI_PLUGIN_API_VERSION, "1");
assert.throws(() => normalizePluginManifest({ id: "xx", name: "X", version: "1.0.0", apiVersion: "999" }), /PLUGIN_API_VERSION_UNSUPPORTED/);
assert.throws(() => normalizePluginManifest({ id: "valid.id", name: "X", version: "1.0.0", apiVersion: "1", capabilities: ["secrets.read"] }), /UNKNOWN_CAPABILITY/);

const db = new Map();
const storageAdapter = {
  async get(key) { return db.has(key) ? db.get(key) : null; },
  async put(key, value) { db.set(key, value); },
  async del(key) { db.delete(key); }
};
const storageA = createPluginStorage(storageAdapter, "official.hello");
const storageB = createPluginStorage(storageAdapter, "third.party");
await storageA.set("same:key", { ok: true });
await storageB.set("same:key", { ok: false });
assert.deepEqual(await storageA.get("same:key"), { ok: true });
assert.deepEqual(await storageB.get("same:key"), { ok: false });
assert.notEqual(pluginStorageDatabaseKey("official.hello", "same:key"), pluginStorageDatabaseKey("third.party", "same:key"));

const sent = [];
const events = [];
const host = createPluginHost({
  storageAdapter,
  services: {
    "message.reply": async request => { sent.push(request); return { messageId: "1" }; },
    "message.send": async request => { sent.push(request); return { messageId: "2" }; },
    "ai.chat": async request => ({ text: `echo:${request.input}` })
  },
  logger: { info() {}, warn() {}, error() {}, debug() {} }
});
host.register(helloPlugin);
host.register(definePlugin({
  manifest: {
    id: "test.events",
    name: "Event Test",
    version: "1.0.0",
    apiVersion: "1",
    capabilities: ["message.read", "storage"]
  },
  async onMessage(ctx) {
    assert.equal(Object.prototype.hasOwnProperty.call(ctx, "env"), false, "plugin context must not expose raw env");
    events.push(`generic:${ctx.event.name}`);
    await ctx.storage.set("last", ctx.event.name);
  },
  async onGroupMessage(ctx) {
    events.push(`group:${ctx.groupId}`);
  }
}));

await host.start();
const hello = await host.runCommand("plugin-hello", {});
assert.equal(hello.handled, true);
assert.equal(hello.pluginId, "official.hello");
assert.equal(sent.length, 1);
assert.equal(sent[0].message, "QQAI Plugin API v1 is ready.");

await host.dispatch("group_message", { group_id: 123, user_id: 456, message: { text: "hi" } });
assert.deepEqual(events, ["generic:group_message", "group:123"]);
assert.equal(await createPluginStorage(storageAdapter, "test.events").get("last"), "group_message");

const denied = definePlugin({
  manifest: { id: "test.denied", name: "Denied", version: "1.0.0", apiVersion: "1", capabilities: [] },
  commands: [{ name: "denied", async run(ctx) { return ctx.ai.chat("nope"); } }]
});
const deniedHost = createPluginHost({ services: { "ai.chat": async () => ({ text: "unexpected" }) } });
deniedHost.register(denied);
await deniedHost.start();
await assert.rejects(() => deniedHost.runCommand("denied"), /PLUGIN_CAPABILITY_DENIED:test\.denied:ai\.chat/);

assert.throws(() => definePlugin({
  manifest: { id: "test.commands", name: "Commands", version: "1.0.0", apiVersion: "1", capabilities: [] },
  commands: [
    { name: "same", async run() {} },
    { name: "other", aliases: ["same"], async run() {} }
  ]
}), /PLUGIN_COMMAND_DUPLICATE:same/);

await host.stop();
console.log("verify-plugin-platform: ok");
