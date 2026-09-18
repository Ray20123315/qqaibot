import assert from "node:assert/strict";
import { definePlugin } from "./src/plugins/api.js";
import { normalizePluginManifest } from "./src/plugins/manifest.js";
import { createPluginHost } from "./src/plugins/runtime.js";
import { createBilibiliLivePlugin } from "./src/plugins/official/bilibili-live.js";

assert.throws(() => normalizePluginManifest({ id: "test.invalid-setting", name: "Invalid", version: "1.0.0", apiVersion: "1", settings: { mode: { type: "wat" } } }), /PLUGIN_SETTING_INVALID_TYPE/);
assert.throws(() => normalizePluginManifest({ id: "test.invalid-select", name: "Invalid", version: "1.0.0", apiVersion: "1", settings: { mode: { type: "select", options: [] } } }), /PLUGIN_SETTING_SELECT_OPTIONS_REQUIRED/);

const db = new Map();
const storageAdapter = {
  async get(key) { return db.has(key) ? db.get(key) : null; },
  async put(key, value) { db.set(key, value); },
  async del(key) { db.delete(key); }
};
let lastActor = "";
const plugin = definePlugin({
  manifest: {
    id: "test.surface", name: "Surface Test", version: "1.0.0", apiVersion: "1", capabilities: ["storage"],
    settings: {
      enabled: { type: "boolean", label: "Enabled" },
      token: { type: "string", label: "Token", secret: true },
      mode: { type: "select", options: ["auto", { value: "manual", label: "Manual" }] }
    }
  },
  surface: {
    async readSettings(ctx) { return ctx.storage.get("settings", { enabled: true, token: "secret", mode: "auto" }); },
    async updateSettings(ctx, input) { lastActor = ctx.userId; await ctx.storage.set("settings", input); },
    async status() { return { state: "OK", detail: "ready" }; }
  }
});
const host = createPluginHost({ storageAdapter });
host.register(plugin);
await host.start();
const listed = host.listPlugins()[0];
assert.equal(listed.surface.readableSettings, true);
assert.equal(listed.surface.writableSettings, true);
assert.equal(listed.surface.hasStatus, true);
assert.equal(listed.settings.mode.type, "select");
assert.deepEqual(listed.settings.mode.options.map(x => x.value), ["auto", "manual"]);
let surface = await host.getPluginSurface("test.surface", { userId: "42" });
assert.equal(surface.settings.token, "[redacted]");
assert.equal(surface.status.state, "OK");
surface = await host.updatePluginSettings("test.surface", { enabled: false, token: "next", mode: "manual" }, { userId: "42" });
assert.equal(lastActor, "42");
assert.equal(surface.settings.enabled, false);
assert.equal(surface.settings.token, "[redacted]");

const biliStorage = new Map();
const biliJobs = [];
const bili = createBilibiliLivePlugin({ creators: [{ uid: "123", label: "Alpha" }], pollIntervalMs: 120000, adminUserIds: ["42"] });
function biliCtx(userId = "42") {
  return {
    userId,
    storage: {
      async get(key, fallback = null) { return biliStorage.has(key) ? biliStorage.get(key) : fallback; },
      async set(key, value) { biliStorage.set(key, value); return value; },
      async delete(key) { biliStorage.delete(key); }
    },
    scheduler: {
      async list() { return biliJobs.filter(x => x.status === "active"); },
      async create(input) { const job = { id: "job-" + (biliJobs.length + 1), status: "active", ...input }; biliJobs.push(job); return job; },
      async cancel(id) { const job = biliJobs.find(x => x.id === id); if (job) job.status = "cancelled"; return job || null; }
    },
    network: { async fetch() { throw new Error("unexpected provider call"); } }
  };
}
await bili.onLoad(biliCtx());
const initial = await bili.surface.readSettings(biliCtx());
assert.equal(initial.pollintervalms, 120000);
const status = await bili.surface.status(biliCtx());
assert.equal(status.state, "OK");
assert.equal(status.creatorCount, 1);
await assert.rejects(() => bili.surface.updateSettings(biliCtx("7"), { pollintervalms: 180000 }), /BILIBILI_LIVE_ADMIN_REQUIRED/);
await bili.surface.updateSettings(biliCtx("42"), { pollintervalms: 180000 });
assert.equal((await bili.surface.readSettings(biliCtx())).pollintervalms, 180000);
assert.equal(biliJobs.filter(x => x.status === "active").length, 1);
assert.equal(biliJobs.find(x => x.status === "active").intervalMs, 180000);

await host.stop();
console.log("verify-v3-plugin-surface: ok");
