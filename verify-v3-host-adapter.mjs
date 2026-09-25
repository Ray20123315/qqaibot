import assert from "node:assert/strict";
import { definePlugin } from "./src/plugins/api.js";
import { createPluginHost } from "./src/plugins/runtime.js";
import { createV3HostAdapter } from "./src/v3/host/adapter.js";

const db = new Map();
const onebotCalls = [];
const seen = { rich: null, redacted: null, deniedRan: false, resolved: null };
const richPlugin = definePlugin({
  manifest: {
    id: "test.rich",
    name: "Rich",
    version: "1.0.0",
    apiVersion: "1",
    capabilities: ["message.read","message.send","media.read","media.send","storage","onebot.call","ai.chat","network"]
  },
  async onGroupMessage(ctx, message) {
    seen.rich = message;
    assert.equal(Object.prototype.hasOwnProperty.call(ctx, "env"), false);
    await ctx.storage.set("last", message.messageId);
    await ctx.reply([{ kind: "text", text: "ok" }, { kind: "image", media: { url: "https://example.com/out.png" } }]);
    const login = await ctx.onebot.call("get_login_info", {});
    assert.equal(login.ok, true);
    const ai = await ctx.ai.chat("hello");
    assert.equal(ai.text, "AI:hello");
    const response = await ctx.network.fetch("https://example.com/data");
    assert.equal(response.status, 200);
    seen.resolved = await ctx.media.resolve(1);
  }
});
const redactedPlugin = definePlugin({
  manifest: {
    id: "test.redacted",
    name: "Redacted",
    version: "1.0.0",
    apiVersion: "1",
    capabilities: ["message.read"]
  },
  async onGroupMessage(ctx, message) {
    seen.redacted = message;
    assert.equal(ctx.event.payload, message);
  }
});
const deniedPlugin = definePlugin({
  manifest: { id: "test.denied", name: "Denied", version: "1.0.0", apiVersion: "1", capabilities: [] },
  async onGroupMessage() { seen.deniedRan = true; }
});

const adapter = createV3HostAdapter({}, {
  plugins: [richPlugin, redactedPlugin, deniedPlugin],
  logger: { info(){}, warn(){}, error(){}, debug(){} },
  dependencies: {
    dbGet: async key => db.has(key) ? db.get(key) : null,
    dbPut: async (key, value) => { db.set(key, value); },
    dbDel: async key => { db.delete(key); },
    onebotCall: async (action, params) => { onebotCalls.push({ action, params }); return action === "get_login_info" ? { ok: true } : { message_id: 123 }; },
    aiChat: async input => ({ text: `AI:${typeof input === "string" ? input : input.text}`, model: "test" }),
    aiVision: async () => ({ text: "vision", model: "test" }),
    safeFetch: async url => String(url).endsWith(".png")
      ? new Response(new Uint8Array([1,2,3]), { status: 200, headers: { "content-type": "image/png" } })
      : new Response("ok", { status: url.includes("example.com") ? 200 : 500 })
  }
});
await adapter.start();
const result = await adapter.dispatchOneBotEvent({
  post_type: "message",
  message_type: "group",
  message_id: 700,
  group_id: 800,
  user_id: 900,
  self_id: 1000,
  message: [
    { type: "text", data: { text: "hello" } },
    { type: "image", data: { file: "secret-file", url: "https://example.com/in.png", path: "C:/NapCat/in.png", file_size: 55 } },
    { type: "image", data: { file: "marketface", emoji_id: "e1", emoji_package_id: "p1", key: "secret-key", summary: "猫" } }
  ]
});
assert.equal(result.handled, true);
assert.equal(result.eventName, "group_message");
assert.equal(seen.deniedRan, false, "plugins without message.read must not receive message hooks");
assert.equal(seen.rich.parts[1].media.url, "https://example.com/in.png");
assert.equal(seen.rich.parts[2].emojiId, "e1");
assert.equal(seen.redacted.parts[1].media.url, "");
assert.equal(seen.redacted.parts[1].media.file, "");
assert.equal(seen.redacted.parts[1].media.path, "");
assert.equal(seen.redacted.parts[2].emojiId, "");
assert.equal(seen.redacted.parts[2].key, "");
assert.equal(seen.redacted.parts[2].summary, "猫");
assert.equal(seen.resolved.kind, "image");
assert.equal(seen.resolved.size, 3);
assert.equal(seen.resolved.source, "direct:url");
assert.equal(onebotCalls[0].action, "send_group_msg");
assert.deepEqual(onebotCalls[0].params.message.map(x => x.type), ["text","image"]);
assert(onebotCalls.some(x => x.action === "get_login_info"));
assert.deepEqual(await adapter.host.runCommand("missing"), { handled: false });
const storedKey = [...db.keys()].find(key => key.includes("plugin:test.rich:data:last"));
assert(storedKey, "plugin storage must stay namespaced");

const rawPlugin = definePlugin({
  manifest: { id: "test.raw", name: "Raw", version: "1.0.0", apiVersion: "1", capabilities: ["onebot.call"] },
  commands: [{ name: "raw", async run(ctx) { return ctx.onebot.call("set_group_kick", { group_id: 1, user_id: 2 }); } }]
});
const rawAdapter = createV3HostAdapter({}, { plugins: [rawPlugin], dependencies: { onebotCall: async () => ({ ok: true }) } });
await rawAdapter.start();
await assert.rejects(() => rawAdapter.runCommand("raw"), /PLUGIN_ONEBOT_ACTION_DENIED:set_group_kick/);

const mediaBypassPlugin = definePlugin({
  manifest: { id: "test.media-bypass", name: "MediaBypass", version: "1.0.0", apiVersion: "1", capabilities: ["message.send"] },
  commands: [{ name: "media-bypass", async run(ctx) { return ctx.reply({ kind: "image", media: { url: "https://example.com/x.png" } }); } }]
});
const bypassAdapter = createV3HostAdapter({}, { plugins: [mediaBypassPlugin], dependencies: { onebotCall: async () => ({ ok: true }) } });
await bypassAdapter.start();
await assert.rejects(() => bypassAdapter.runCommand("media-bypass", {}, { message: result.message }), /PLUGIN_CAPABILITY_DENIED:test\.media-bypass:media\.send/);

const mediaReadDeniedPlugin = definePlugin({
  manifest: { id: "test.media-read-denied", name: "MediaReadDenied", version: "1.0.0", apiVersion: "1", capabilities: ["message.read"] },
  commands: [{ name: "media-read-denied", async run(ctx) { return ctx.media.resolve(1); } }]
});
const mediaReadDeniedAdapter = createV3HostAdapter({}, { plugins: [mediaReadDeniedPlugin], dependencies: { onebotCall: async () => ({ ok: true }) } });
await mediaReadDeniedAdapter.start();
await assert.rejects(() => mediaReadDeniedAdapter.runCommand("media-read-denied", {}, { message: result.message }), /PLUGIN_CAPABILITY_DENIED:test\.media-read-denied:media\.read/);

// Low-level runtime also fails closed if the host forgets to supply a canonical message.
let leaked = "unset";
const failClosed = createPluginHost();
failClosed.register(definePlugin({
  manifest: { id: "test.failclosed", name: "FailClosed", version: "1.0.0", apiVersion: "1", capabilities: ["message.read"] },
  async onMessage(ctx, payload) { leaked = payload; assert.equal(ctx.message, null); }
}));
await failClosed.start();
await failClosed.dispatch("group_message", { group_id: 1, user_id: 2, message: { raw: "secret" } });
assert.equal(leaked, null);

await adapter.stop();
await rawAdapter.stop();
await bypassAdapter.stop();
await mediaReadDeniedAdapter.stop();
await failClosed.stop();
console.log("verify-v3-host-adapter: ok");
