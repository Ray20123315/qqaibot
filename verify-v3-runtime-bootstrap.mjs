import assert from "node:assert/strict";
import { createOfficialV3Plugins, createV3Runtime, getV3Runtime, releaseV3Runtime } from "./src/v3/runtime/runtime.js";

const disabledOfficial = Object.freeze({
  entertainment: false,
  activity: false,
  poll: false,
  memberSpeechAnalysis: false,
  qqInteractions: false,
  autoCheckin: false
});
assert.equal(createOfficialV3Plugins({}).length, 6, "six low-risk official plugins should be bundled by default");
assert.equal(createOfficialV3Plugins(disabledOfficial).length, 0);
assert.equal(createOfficialV3Plugins({ ...disabledOfficial, bilibili: { creators: [{ uid: "123" }] } }).length, 1);
assert.throws(() => createOfficialV3Plugins({ ...disabledOfficial, bilibili: true }), /V3_BILIBILI_OPTIONS_INVALID/);

const env = {};
const db = new Map();
let providerCalls = 0;
const dependencies = {
  dbGet: async key => db.has(key) ? db.get(key) : null,
  dbPut: async (key, value) => { db.set(key, value); },
  dbDel: async key => { db.delete(key); },
  onebotCall: async () => ({ ok: true }),
  safeFetch: async url => {
    providerCalls += 1;
    assert(String(url).includes("api.live.bilibili.com"));
    return new Response(JSON.stringify({ code: 0, data: { "123": { uid: 123, live_status: 1, room_id: 99, title: "Runtime Live", uname: "Alpha", online: 8 } } }), { status: 200, headers: { "content-type": "application/json" } });
  }
};
const runtime = createV3Runtime(env, {
  official: { ...disabledOfficial, bilibili: { creators: [{ uid: "123", label: "Alpha" }], pollIntervalMs: 60000, adminUserIds: ["42"] } },
  dependencies,
  logger: { info(){}, warn(){}, error(){}, debug(){} }
});
await runtime.start();
await runtime.start();
assert.equal(runtime.listPlugins().length, 1);
assert.equal(runtime.listPlugins()[0].id, "official.bilibili-live");
const jobs = await runtime.adapter.pluginScheduler.list("official.bilibili-live", { includeTerminal: false });
assert.equal(jobs.length, 1, "idempotent start must create one polling job");
let status = await runtime.publicStatus({ now: 1700000000000 });
assert.equal(status.live.active, false);
await runtime.runDuePluginJobs({ now: Date.now() + 120000 });
assert.equal(providerCalls, 1);
status = await runtime.publicStatus({ now: 1700000000000 });
assert.equal(status.live.active, true);
assert.equal(status.live.entries[0].title, "Runtime Live");
const surface = await runtime.getPluginSurface("official.bilibili-live", { userId: "42" });
assert.equal(surface.status.state, "OK");

const cachedEnv = {};
const cachedA = await getV3Runtime(cachedEnv, { official: disabledOfficial, dependencies, logger: { info(){}, warn(){}, error(){}, debug(){} } });
const cachedB = await getV3Runtime(cachedEnv, { official: { bilibili: { creators: [{ uid: "999" }] } }, dependencies });
assert.equal(cachedA, cachedB, "one env must keep one runtime instance");
assert.equal(cachedB.listPlugins().length, 0, "later options must not mutate an existing runtime");
assert.equal(await releaseV3Runtime(cachedEnv), true);
assert.equal(await releaseV3Runtime(cachedEnv), false);
await runtime.stop();
console.log("verify-v3-runtime-bootstrap: ok");
