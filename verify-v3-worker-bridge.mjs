import assert from "node:assert/strict";
import fs from "node:fs";
import { releaseV3Runtime } from "./src/v3/runtime/runtime.js";
import { handleV3RuntimeFetch, parseCreatorJson, runV3RuntimeScheduled, v3BilibiliCreators, v3RuntimeEnabled, v3RuntimeOptionsFromEnv } from "./src/v3/runtime/bridge.js";

assert.equal(v3RuntimeEnabled({}), true, "V3 runtime defaults on unless explicitly disabled");
assert.equal(v3RuntimeEnabled({ V3_RUNTIME_ENABLED: "true" }), true);
assert.deepEqual(parseCreatorJson('[{"uid":"123","label":"A"}]'), [{ uid: "123", label: "A" }]);
assert.deepEqual(parseCreatorJson('{"uid":"456"}'), [{ uid: "456" }]);
assert.throws(() => parseCreatorJson("{bad"), /V3_BILIBILI_CREATORS_INVALID_JSON/);
assert.deepEqual(v3BilibiliCreators({ V3_BILIBILI_UIDS: "123,456" }), [{ uid: "123" }, { uid: "456" }]);
const options = v3RuntimeOptionsFromEnv({
  V3_RUNTIME_ENABLED: "true",
  V3_BILIBILI_ENABLED: "true",
  V3_BILIBILI_UIDS: "123",
  V3_BILIBILI_POLL_INTERVAL_MS: "1"
});
assert.equal(options.official.bilibili.pollIntervalMs, 1800000, "poll interval must clamp to thirty-minute minimum");
assert.equal(options.official.bilibili.creators[0].uid, "123");
const maxPollOptions = v3RuntimeOptionsFromEnv({
  V3_RUNTIME_ENABLED: "true",
  V3_BILIBILI_ENABLED: "true",
  V3_BILIBILI_UIDS: "123",
  V3_BILIBILI_POLL_INTERVAL_MS: "999999999"
});
assert.equal(maxPollOptions.official.bilibili.pollIntervalMs, 21600000, "poll interval must clamp to six-hour maximum");

const disabledOfficial = Object.freeze({
  entertainment: false,
  activity: false,
  poll: false,
  memberSpeechAnalysis: false,
  qqInteractions: false,
  autoCheckin: false
});

const disabledEnv = { V3_RUNTIME_ENABLED: "false" };
let response = await handleV3RuntimeFetch(new Request("https://example.com/api/v3/status"), disabledEnv);
assert.equal(response.status, 404);
assert.equal((await response.json()).code, "V3_RUNTIME_DISABLED");
const disabledCron = await runV3RuntimeScheduled(disabledEnv, 1700000000000);
assert.equal(disabledCron.enabled, false);

const enabledEnv = {};
const db = new Map();
const reads = [];
const deps = {
  dbGet: async key => { reads.push(key); return db.has(key) ? db.get(key) : null; },
  dbPut: async (key, value) => { db.set(key, value); },
  dbDel: async key => { db.delete(key); },
  onebotCall: async () => ({ ok: true }),
  safeFetch: async () => { throw new Error("network must not be called"); }
};
response = await handleV3RuntimeFetch(new Request("https://example.com/api/v3/status"), enabledEnv, null, { official: disabledOfficial, dependencies: deps, logger: { info(){}, warn(){}, error(){}, debug(){} } });
assert.equal(response.status, 200);
const payload = await response.json();
assert.equal(payload.schemaVersion, 1);
assert.equal(payload.plugins.length, 0);
assert.equal(payload.live.active, false);
const cron = await runV3RuntimeScheduled(enabledEnv, 1700000000000, { official: disabledOfficial, dependencies: deps, logger: { info(){}, warn(){}, error(){}, debug(){} } });
assert.equal(cron.enabled, true);
assert.equal(cron.jobs, 0);
assert(db.has("plugin_scheduler:due"), "first enabled empty cron should persist repaired empty due index");
reads.length = 0;
await runV3RuntimeScheduled(enabledEnv, 1700000060000, { official: disabledOfficial, dependencies: deps });
assert.deepEqual(reads, ["plugin_scheduler:due"], "steady-state empty V3 cron must read only due index");
await releaseV3Runtime(enabledEnv);

const degradedEnv = {};
const d1Failure = () => Object.assign(new Error("D1 quota exhausted"), { code: "D1_STORAGE_UNAVAILABLE" });
const degradedDeps = {
  ...deps,
  dbGet: async () => { throw d1Failure(); },
  dbPut: async () => { throw d1Failure(); },
  dbDel: async () => { throw d1Failure(); }
};
response = await handleV3RuntimeFetch(
  new Request("https://example.com/api/v3/status"),
  degradedEnv,
  null,
  { official: disabledOfficial, dependencies: degradedDeps, logger: { info(){}, warn(){}, error(){}, debug(){} } }
);
assert.equal(response.status, 200, "public V3 status must stay observable when D1 storage is unavailable");
const degradedPayload = await response.json();
assert.equal(degradedPayload.schemaVersion, 1);
assert.equal(degradedPayload.degraded?.storageUnavailable, true);
assert.equal(degradedPayload.degraded?.code, "D1_STORAGE_UNAVAILABLE");
assert.equal(degradedPayload.live?.stale, true);
assert.equal(JSON.stringify(degradedPayload).includes("D1 quota exhausted"), false, "public degraded payload must not expose storage error text");

const recoveredDb = new Map();
const recoveredDeps = {
  ...deps,
  dbGet: async key => recoveredDb.has(key) ? recoveredDb.get(key) : null,
  dbPut: async (key, value) => { recoveredDb.set(key, value); },
  dbDel: async key => { recoveredDb.delete(key); }
};
response = await handleV3RuntimeFetch(
  new Request("https://example.com/api/v3/status"),
  degradedEnv,
  null,
  { official: disabledOfficial, dependencies: recoveredDeps, logger: { info(){}, warn(){}, error(){}, debug(){} } }
);
assert.equal(response.status, 200, "failed runtime initialization must be evicted so the next request can recover");
const recoveredPayload = await response.json();
assert.equal(recoveredPayload.schemaVersion, 1);
assert.equal("degraded" in recoveredPayload, false);
await releaseV3Runtime(degradedEnv);

const worker = fs.readFileSync("worker.js", "utf8");
assert.match(worker, /handleV3RuntimeFetch/);
assert.match(worker, /runV3RuntimeScheduled/);
assert.match(worker, /const v3RuntimeResponse = await handleV3RuntimeFetch\(request, env, url\)/);
assert.match(worker, /ctx\.waitUntil\(runV3RuntimeScheduled\(env, scheduledTime\)/);

console.log("verify-v3-worker-bridge: ok");
