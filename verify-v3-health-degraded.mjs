import assert from "node:assert/strict";
import { runHealthChecks } from "./src/health/runtime.js";

const env = {
  DB: {
    prepare(sql) {
      if (String(sql).includes("SELECT 1 AS ok")) {
        return { async first() { return { ok: 1 }; } };
      }
      throw new Error("D1_QUOTA_EXHAUSTED");
    }
  }
};

const state = await runHealthChecks(env, { mode: "quick" });
assert.equal(typeof state, "object");
assert.equal(Array.isArray(state.checks), true);
assert.equal(state.checks.some(item => item.name === "Cron 定时任务" && item.status === "warning"), true);
assert.equal(state.persistence?.ok, false, "health snapshot persistence failure must be reported, not thrown");

console.log("verify-v3-health-degraded: ok");
