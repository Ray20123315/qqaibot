import assert from "node:assert/strict";
import {
  AUTO_CHECKIN_CONTINUE_JOB_NAME,
  AUTO_CHECKIN_JOB_NAME,
  createAutoCheckinPlugin,
  nextTaipeiMidnight,
  normalizeSettings
} from "./src/plugins/official/auto-checkin.js";

const defaults = normalizeSettings();
assert.equal(defaults.enabled, true);
assert.equal(defaults.batchSize, 20);
assert.equal(normalizeSettings({ batchSize: 99 }).batchSize, 20);
assert.equal(
  new Date(nextTaipeiMidnight(Date.parse("2026-09-25T15:59:50Z"), 20)).toISOString(),
  "2026-09-25T16:00:20.000Z"
);

const storage = new Map();
const jobs = [];
const calls = [];
const groups = Array.from({ length: 21 }, (_, i) => ({ group_id: String(1000 + i), group_name: "G" + i }));
const ctx = {
  storage: {
    async get(key, fallback = null) { return storage.has(key) ? storage.get(key) : fallback; },
    async set(key, value) { storage.set(key, value); return value; }
  },
  scheduler: {
    async list() { return jobs.filter(job => job.status === "active"); },
    async create(input) {
      const job = { id: "job-" + (jobs.length + 1), status: "active", ...input };
      jobs.push(job);
      return job;
    },
    async cancel(id) {
      const job = jobs.find(row => row.id === id);
      if (job) job.status = "cancelled";
      return job || null;
    }
  },
  onebot: {
    async call(action, params) {
      calls.push({ action, params });
      if (action === "get_group_list") return { data: groups };
      if (action === "set_group_sign" && String(params.group_id) === "1001") throw new Error("primary unsupported");
      if (["set_group_sign","send_group_sign"].includes(action)) return { ok: true };
      throw new Error("unexpected action " + action);
    }
  }
};

const plugin = createAutoCheckinPlugin();
await plugin.onLoad(ctx);
assert.equal(jobs.filter(job => job.name === AUTO_CHECKIN_JOB_NAME && job.status === "active").length, 1);
await plugin.onLoad(ctx);
assert.equal(jobs.filter(job => job.name === AUTO_CHECKIN_JOB_NAME && job.status === "active").length, 1, "onLoad must be idempotent");

const first = await plugin.onCron(ctx, { name: AUTO_CHECKIN_JOB_NAME, payload: { offset: 0 } });
assert.equal(first.processed, 20);
assert.equal(first.nextOffset, 20);
assert.equal(first.success, 20);
assert.equal(first.failed, 0);
assert(calls.some(call => call.action === "send_group_sign" && String(call.params.group_id) === "1001"));
assert(calls.filter(call => call.action !== "get_group_list").length <= 40, "one batch must stay under the 50-subrequest free-plan ceiling");
assert.equal(jobs.filter(job => job.name === AUTO_CHECKIN_CONTINUE_JOB_NAME && job.status === "active").length, 1);

const second = await plugin.onCron(ctx, { name: AUTO_CHECKIN_CONTINUE_JOB_NAME, payload: { offset: 20 } });
assert.equal(second.processed, 1);
assert.equal(second.nextOffset, null);

await plugin.surface.updateSettings(ctx, { enabled: false });
assert.equal(jobs.filter(job => job.name === AUTO_CHECKIN_JOB_NAME && job.status === "active").length, 0);

console.log("verify-v3-auto-checkin: ok");
