import assert from "node:assert/strict";
import { definePlugin } from "./src/plugins/api.js";
import { createV3HostAdapter } from "./src/v3/host/adapter.js";
import { PLUGIN_SCHEDULER_DUE_KEY, createPluginScheduler } from "./src/v3/scheduler/runtime.js";

function memoryStorage(map = new Map()) {
  return {
    map,
    adapter: {
      async get(key) { return map.has(key) ? map.get(key) : null; },
      async put(key, value) { map.set(key, value); },
      async del(key) { map.delete(key); }
    }
  };
}

async function rejectsWithCode(fn, code) {
  await assert.rejects(fn, error => error?.code === code);
}

let now = 1_800_000_000_000;
const directDb = memoryStorage();
const scheduler = createPluginScheduler(directDb.adapter, { nowProvider: () => now });

await rejectsWithCode(
  () => scheduler.create("plugin.a", { name: "too-fast", intervalMs: 30_000 }),
  "PLUGIN_SCHEDULER_INTERVAL_OUT_OF_RANGE"
);
await rejectsWithCode(
  () => scheduler.create("plugin.a", { name: "huge", delayMs: 1000, payload: { text: "x".repeat(20_000) } }),
  "PLUGIN_SCHEDULER_PAYLOAD_TOO_LARGE"
);

const onceA = await scheduler.create("plugin.a", { name: "once", delayMs: 1000, payload: { owner: "a" } });
const intervalB = await scheduler.create("plugin.b", { name: "poll", intervalMs: 60_000, delayMs: 1000, payload: { owner: "b" } });
assert.equal((await scheduler.list("plugin.a")).length, 1);
assert.equal((await scheduler.list("plugin.b")).length, 1);
assert.equal(await scheduler.get("plugin.a", intervalB.id), null, "plugins must not read another plugin job");
await rejectsWithCode(() => scheduler.cancel("plugin.a", intervalB.id), "PLUGIN_SCHEDULER_JOB_NOT_FOUND");

const directEvents = [];
const directRun = await scheduler.runDue(async (pluginId, event) => {
  directEvents.push({ pluginId, event });
  return `${pluginId}:${event.name}`;
}, { now: now + 1500 });
assert.equal(directRun.length, 2);
assert.deepEqual(directEvents.map(item => item.pluginId).sort(), ["plugin.a", "plugin.b"]);
assert.equal((await scheduler.get("plugin.a", onceA.id)).status, "completed");
const intervalAfter = await scheduler.get("plugin.b", intervalB.id);
assert.equal(intervalAfter.status, "active");
assert.equal(intervalAfter.runCount, 1);
assert.equal(intervalAfter.nextRunAt, now + 61_000);
const dueAfterRun = JSON.parse(directDb.map.get(PLUGIN_SCHEDULER_DUE_KEY));
assert.equal(dueAfterRun.some(row => row.id === onceA.id), false, "completed jobs must leave due index");
assert.equal(dueAfterRun.find(row => row.id === intervalB.id).nextRunAt, now + 61_000);

const retry = await scheduler.create("plugin.a", { name: "retry", delayMs: 2000, payload: { retry: true } });
const retryResult = await scheduler.runDue(async (pluginId, event) => {
  if (event.jobId === retry.id) throw new Error("temporary failure");
  return pluginId;
}, { now: now + 2500 });
const retryRow = retryResult.find(item => item.id === retry.id);
assert.equal(retryRow.ok, false);
const retryAfter = await scheduler.get("plugin.a", retry.id);
assert.equal(retryAfter.failureCount, 1);
assert.equal(retryAfter.status, "active");
assert.equal(retryAfter.nextRunAt, now + 62_500);

// Empty cron ticks must read the due index only, not every future job record.
{
  const map = new Map();
  const reads = [];
  const adapter = {
    async get(key) { reads.push(key); return map.has(key) ? map.get(key) : null; },
    async put(key, value) { map.set(key, value); },
    async del(key) { map.delete(key); }
  };
  const farFuture = now + 24 * 60 * 60 * 1000;
  map.set(PLUGIN_SCHEDULER_DUE_KEY, JSON.stringify(Array.from({ length: 200 }, (_, index) => ({ id: "future-" + index, nextRunAt: farFuture + index }))));
  for (let index = 0; index < 200; index += 1) {
    map.set("plugin_scheduler:job:future-" + index, JSON.stringify({ id: "future-" + index, pluginId: "plugin.future", enabled: true, status: "active", nextRunAt: farFuture + index }));
  }
  const dueOnly = createPluginScheduler(adapter, { nowProvider: () => now });
  const result = await dueOnly.runDue(async () => { throw new Error("must not execute"); }, { now });
  assert.equal(result.length, 0);
  assert.equal(reads.filter(key => key === PLUGIN_SCHEDULER_DUE_KEY).length, 1);
  assert.equal(reads.some(key => key.startsWith("plugin_scheduler:job:")), false, "empty tick must not read future job rows");
  assert.equal(reads.includes("plugin_scheduler:index"), false, "existing due index must avoid global index reads");
}

// Missing due index gets a one-time repair from the legacy global index, then future empty ticks stay cheap.
{
  const map = new Map();
  const reads = [];
  const adapter = {
    async get(key) { reads.push(key); return map.has(key) ? map.get(key) : null; },
    async put(key, value) { map.set(key, value); },
    async del(key) { map.delete(key); }
  };
  map.set("plugin_scheduler:index", JSON.stringify(["repair-1"]));
  map.set("plugin_scheduler:job:repair-1", JSON.stringify({ id: "repair-1", pluginId: "plugin.repair", enabled: true, status: "active", nextRunAt: now + 60000 }));
  const repaired = createPluginScheduler(adapter, { nowProvider: () => now });
  await repaired.runDue(async () => null, { now });
  assert(map.has(PLUGIN_SCHEDULER_DUE_KEY), "first run must persist repaired due index");
  reads.length = 0;
  await repaired.runDue(async () => null, { now });
  assert.deepEqual(reads, [PLUGIN_SCHEDULER_DUE_KEY], "second empty tick must read only due index");
}

// Host integration: only the owning plugin receives its cron event.
now = 1_900_000_000_000;
const hostDb = memoryStorage();
const hostScheduler = createPluginScheduler(hostDb.adapter, { nowProvider: () => now });
const cronEvents = [];
const foreignCronEvents = [];

const scheduledPlugin = definePlugin({
  manifest: {
    id: "test.scheduler-owner",
    name: "Scheduler Owner",
    version: "1.0.0",
    apiVersion: "1",
    capabilities: ["scheduler"]
  },
  commands: [
    {
      name: "schedule-test",
      async run(ctx) {
        const created = await ctx.scheduler.create({ name: "heartbeat", delayMs: 1000, payload: { value: 42 } });
        const rows = await ctx.scheduler.list();
        const loaded = await ctx.scheduler.get(created.id);
        return { created, rows, loaded };
      }
    },
    {
      name: "cancel-test",
      async run(ctx, input) {
        return ctx.scheduler.cancel(input.id);
      }
    }
  ],
  async onCron(ctx, event) {
    cronEvents.push({ event, pluginId: ctx.plugin.id });
    const rows = await ctx.scheduler.list();
    return { name: event.name, visibleJobs: rows.length };
  }
});

const unrelatedPlugin = definePlugin({
  manifest: {
    id: "test.scheduler-unrelated",
    name: "Scheduler Unrelated",
    version: "1.0.0",
    apiVersion: "1",
    capabilities: ["scheduler"]
  },
  async onCron(ctx, event) {
    foreignCronEvents.push({ event, pluginId: ctx.plugin.id });
  }
});

const adapter = createV3HostAdapter({}, {
  plugins: [scheduledPlugin, unrelatedPlugin],
  logger: { info() {}, warn() {}, error() {}, debug() {} },
  dependencies: {
    scheduler: hostScheduler,
    dbGet: hostDb.adapter.get,
    dbPut: hostDb.adapter.put,
    dbDel: hostDb.adapter.del,
    onebotCall: async () => ({ ok: true })
  }
});
await adapter.start();
const command = await adapter.runCommand("schedule-test");
assert.equal(command.handled, true);
assert.equal(command.result.rows.length, 1);
assert.equal(command.result.loaded.pluginId, "test.scheduler-owner");
const ownerJobId = command.result.created.id;
assert.equal(await hostScheduler.get("test.scheduler-unrelated", ownerJobId), null);

const due = await adapter.runDuePluginJobs({ now: now + 1500 });
assert.equal(due.length, 1);
assert.equal(due[0].ok, true);
assert.equal(cronEvents.length, 1);
assert.equal(cronEvents[0].pluginId, "test.scheduler-owner");
assert.equal(cronEvents[0].event.payload.value, 42);
assert.equal(foreignCronEvents.length, 0, "cron events must not broadcast to unrelated plugins");
assert.equal((await hostScheduler.get("test.scheduler-owner", ownerJobId)).status, "completed");

const cancellable = await hostScheduler.create("test.scheduler-owner", { name: "cancel-me", delayMs: 5000 });
const cancelled = await adapter.runCommand("cancel-test", { id: cancellable.id });
assert.equal(cancelled.result.status, "cancelled");

const deniedPlugin = definePlugin({
  manifest: { id: "test.scheduler-denied", name: "Denied", version: "1.0.0", apiVersion: "1", capabilities: [] },
  commands: [{ name: "scheduler-denied", async run(ctx) { return ctx.scheduler.create({ delayMs: 1000 }); } }]
});
const deniedAdapter = createV3HostAdapter({}, {
  plugins: [deniedPlugin],
  dependencies: {
    scheduler: createPluginScheduler(memoryStorage().adapter, { nowProvider: () => now }),
    dbGet: async () => null,
    dbPut: async () => {},
    dbDel: async () => {},
    onebotCall: async () => ({ ok: true })
  }
});
await deniedAdapter.start();
await assert.rejects(() => deniedAdapter.runCommand("scheduler-denied"), /PLUGIN_CAPABILITY_DENIED:test\.scheduler-denied:scheduler/);
await deniedAdapter.stop();
await adapter.stop();

console.log("verify-v3-plugin-scheduler: ok");
