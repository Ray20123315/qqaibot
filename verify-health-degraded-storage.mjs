import assert from "node:assert/strict";
import { buildHealthState } from "./src/health/runtime.js";

function unavailableDb() {
  return {
    prepare() {
      return {
        bind() { return this; },
        async first() { throw new Error("D1 quota exhausted"); },
        async run() { throw new Error("D1 quota exhausted"); },
        async all() { throw new Error("D1 quota exhausted"); }
      };
    }
  };
}

const result = await buildHealthState({
  DB: unavailableDb(),
  GEMINI_CHAT_MODELS: "gemma-4-26b-a4b-it,gemma-4-31b-it"
});

assert.equal(result.ok, false);
assert.equal(result.bindings.db, true);
assert.equal(result.privateChat, false);
assert.equal(result.privateSchedule, false);
assert.equal(result.privateAppeal, true);

const d1 = result.checks.find(item => item.name === "D1 数据库");
assert.equal(d1?.status, "error");

const cron = result.checks.find(item => item.name === "Cron 定时任务");
assert.equal(cron?.status, "warning");
assert.equal(cron?.detail?.storageUnavailable, true);
assert.equal(cron?.detail?.errorCode, "D1_STORAGE_UNAVAILABLE");

console.log("verify-health-degraded-storage: ok");
