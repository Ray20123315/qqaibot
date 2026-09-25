import assert from "node:assert/strict";
import {
  BILIBILI_LIVE_API,
  createBilibiliLivePlugin,
  normalizeConfig,
  normalizeProviderRecord,
  buildEffectiveState,
  transitionFor
} from "./src/plugins/official/bilibili-live.js";

const config = normalizeConfig({
  creators: [
    { uid: "123", label: "Alpha" },
    { uid: "456", label: "Beta", mode: "force_offline" }
  ],
  pollIntervalMs: 120000
});
assert.equal(config.creators.length, 2);
assert.equal(config.pollIntervalMs, 1800000, "polling must clamp to the 30-minute safety minimum");

const live = normalizeProviderRecord("123", {
  uid: 123,
  live_status: 1,
  room_id: 99,
  title: "Live",
  uname: "Alpha",
  cover_from_user: "http://img.example/live.jpg",
  online: 88,
  live_time: 1700000000
}, 1000);
assert.equal(live.live, true);
assert.equal(live.cover, "https://img.example/live.jpg");
assert.equal(transitionFor({ live: false, rotating: false }, live), "went_live");
const forced = buildEffectiveState(config.creators[1], { ...live, uid: "456", live: true }, { ok: false });
assert.equal(forced.live, false);
assert.equal(forced.source, "force_offline");
assert.equal(forced.providerLive, true);
assert.equal(forced.stale, true);

const storage = new Map();
const jobs = [];
let failProvider = false;
let providerCalls = 0;
const plugin = createBilibiliLivePlugin({
  creators: [
    { uid: "123", label: "Alpha" },
    { uid: "456", label: "Beta" }
  ],
  pollIntervalMs: 120000,
  adminUserIds: ["42"]
});

function makeCtx(userId = "") {
  return {
    userId,
    storage: {
      async get(key, fallback = null) { return storage.has(key) ? storage.get(key) : fallback; },
      async set(key, value) { storage.set(key, value); return value; },
      async delete(key) { storage.delete(key); }
    },
    scheduler: {
      async list() { return jobs.filter(job => job.status === "active"); },
      async create(input) {
        const job = { id: `job-${jobs.length + 1}`, status: "active", ...input };
        jobs.push(job);
        return job;
      },
      async cancel(id) {
        const job = jobs.find(row => row.id === id);
        if (job) job.status = "cancelled";
        return job || null;
      }
    },
    network: {
      async fetch(input) {
        providerCalls += 1;
        if (failProvider) return new Response("provider down", { status: 503 });
        const url = String(input?.url || input || "");
        assert(url.startsWith(BILIBILI_LIVE_API));
        assert(url.includes("uids%5B%5D=123"));
        assert(url.includes("uids%5B%5D=456"));
        return new Response(JSON.stringify({
          code: 0,
          data: {
            "123": {
              uid: 123,
              live_status: 1,
              room_id: 100,
              title: "Game",
              uname: "Alpha",
              online: 12,
              cover_from_user: "http://img.example/alpha.jpg",
              live_time: 1700000000
            },
            "456": {
              uid: 456,
              live_status: 0,
              room_id: 200,
              title: "Offline",
              uname: "Beta",
              online: 0
            }
          }
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
    }
  };
}

await plugin.onLoad(makeCtx());
assert.equal(jobs.length, 1, "onLoad must create exactly one polling job");
assert.equal(jobs[0].name, "live-poll");
assert.equal(jobs[0].intervalMs, 120000);
await plugin.onLoad(makeCtx());
assert.equal(jobs.filter(job => job.status === "active").length, 1, "onLoad must not duplicate an existing job");

const cronResult = await plugin.onCron(makeCtx(), { name: "live-poll", payload: { task: "poll" } });
assert.equal(cronResult.ok, true);
assert.equal(providerCalls, 1, "one batch request should cover all configured creators");
assert.equal(cronResult.effective.find(row => row.uid === "123").live, true);
assert.equal(cronResult.effective.find(row => row.uid === "456").live, false);
assert.equal(storage.get("health").ok, true);
assert.equal(storage.get("snapshot").byUid["123"].transition, "initialized");

const statusCommand = plugin.commands.find(command => command.name === "bili-live-status");
const status = await statusCommand.run(makeCtx(), {});
assert.equal(status.rows.length, 2);
assert.equal(status.rows.find(row => row.uid === "123").cover, "https://img.example/alpha.jpg");

const modeCommand = plugin.commands.find(command => command.name === "bili-live-mode");
await assert.rejects(
  () => modeCommand.run(makeCtx("7"), { args: ["123", "force_offline"] }),
  /BILIBILI_LIVE_ADMIN_REQUIRED/
);
const changed = await modeCommand.run(makeCtx("42"), { args: ["123", "force_offline"] });
assert.equal(changed.effective.find(row => row.uid === "123").live, false);
assert.equal(changed.effective.find(row => row.uid === "123").providerLive, true);

// Provider failure must keep the last valid snapshot instead of flipping the creator offline.
failProvider = true;
const refreshCommand = plugin.commands.find(command => command.name === "bili-live-refresh");
const failed = await refreshCommand.run(makeCtx("42"), {});
assert.equal(failed.ok, false);
assert.equal(failed.stale, true);
assert.equal(failed.effective.find(row => row.uid === "123").title, "Game");
assert.equal(storage.get("health").consecutiveFailures, 1);
assert(storage.get("health").nextPollNotBefore > storage.get("health").lastAttemptAt);
assert.equal(storage.get("snapshot").byUid["123"].title, "Game");
const callsAfterFailure = providerCalls;
const backoffCron = await plugin.onCron(makeCtx(), { name: "live-poll", payload: { task: "poll" } });
assert.equal(backoffCron.skipped, "provider_backoff");
assert.equal(providerCalls, callsAfterFailure, "cron backoff must avoid another provider request");

// FORCE mode remains effective even while the provider is stale.
assert.equal(failed.effective.find(row => row.uid === "123").source, "force_offline");
assert.equal(failed.effective.find(row => row.uid === "123").live, false);

console.log("verify-v3-bilibili-live-plugin: ok");
