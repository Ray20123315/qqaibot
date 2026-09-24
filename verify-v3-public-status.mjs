import assert from "node:assert/strict";
import { definePlugin } from "./src/plugins/api.js";
import { createPluginHost } from "./src/plugins/runtime.js";
import { buildV3PublicStatus, v3PublicStatusResponse } from "./src/v3/public/status.js";

const publicPlugin = definePlugin({
  manifest: { id: "test.live", name: "Live", version: "1.0.0", apiVersion: "1", publicStatus: true, capabilities: [] },
  surface: {
    async status() { return { state: "OK", secretDebug: "internal" }; },
    async publicStatus() { return { state: "OK", provider: "test", stale: false, rows: [{ uid: "1", live: true, title: "Now", url: "https://example.com/live" }] }; }
  }
});
const privatePlugin = definePlugin({
  manifest: { id: "test.private", name: "Private", version: "1.0.0", apiVersion: "1", capabilities: [] },
  surface: { async publicStatus() { return { leaked: true }; } }
});
const failingPlugin = definePlugin({
  manifest: { id: "test.fail", name: "Fail", version: "1.0.0", apiVersion: "1", publicStatus: true, capabilities: [] },
  surface: { async publicStatus() { throw new Error("sensitive provider error"); } }
});
const host = createPluginHost();
host.register(publicPlugin);
host.register(privatePlugin);
host.register(failingPlugin);
await host.start();
const adapter = { listPlugins: host.listPlugins, getPluginPublicStatus: host.getPluginPublicStatus };
const payload = await buildV3PublicStatus(adapter, { now: 1700000000000 });
assert.equal(payload.schemaVersion, 1);
assert.equal(payload.plugins.length, 2, "non-opted-in plugin must be excluded");
assert.equal(payload.live.active, true);
assert.equal(payload.live.activeCount, 1);
assert.equal(payload.live.entries[0].title, "Now");
assert.equal(payload.plugins.find(x => x.plugin.id === "test.fail").status.unavailable, true);
assert.equal(JSON.stringify(payload).includes("sensitive provider error"), false, "public payload must not expose plugin errors");
await assert.rejects(() => host.getPluginPublicStatus("test.private"), /PLUGIN_PUBLIC_STATUS_DISABLED/);
const response = await v3PublicStatusResponse(adapter, { now: 1700000000000 });
assert.equal(response.status, 200);
assert.match(response.headers.get("content-type"), /application\/json/);
assert.match(response.headers.get("cache-control"), /no-store/);
await host.stop();
console.log("verify-v3-public-status: ok");
