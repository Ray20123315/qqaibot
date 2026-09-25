import assert from "node:assert/strict";
import fs from "node:fs";

import { checkRuntimeRateLimit, markRuntimeRateLimitCompletion } from "./src/core/permissions.js";

class MemoryD1 {
  constructor() { this.values = new Map(); }
  prepare(sql) {
    const db = this;
    return {
      bind(...args) {
        return {
          async first() {
            if (/SELECT value FROM kv_store WHERE key = \?/i.test(sql)) {
              const value = db.values.get(String(args[0]));
              return value === undefined ? null : { value };
            }
            throw new Error("Unsupported first SQL: " + sql);
          },
          async run() {
            if (/INSERT INTO kv_store/i.test(sql)) {
              db.values.set(String(args[0]), String(args[1]));
              return { success: true, meta: { changes: 1 } };
            }
            if (/DELETE FROM kv_store WHERE key = \?/i.test(sql)) {
              db.values.delete(String(args[0]));
              return { success: true, meta: { changes: 1 } };
            }
            throw new Error("Unsupported run SQL: " + sql);
          }
        };
      }
    };
  }
}

const env = { DB: new MemoryD1() };
const scope = { groupId: "12345", userId: "67890", isPrivate: false };

const initial = await checkRuntimeRateLimit(env, scope);
assert.equal(initial.allowed, true);
assert.equal(initial.completedAt, 0);
assert.equal(env.DB.values.has("runtime_rate_limit_last:group:12345:67890"), false, "checking an allowed request must not start cooldown");

const completedAt = Date.now();
const marked = await markRuntimeRateLimitCompletion(env, scope, completedAt);
assert.equal(marked.marked, true);
assert.equal(Number(env.DB.values.get("runtime_rate_limit_last:group:12345:67890")), completedAt);

const blocked = await checkRuntimeRateLimit(env, scope);
assert.equal(blocked.allowed, false);
assert(blocked.remaining >= 1 && blocked.remaining <= 10);
assert.equal(blocked.completedAt, completedAt);
assert.equal(blocked.notify, true);

const repeated = await checkRuntimeRateLimit(env, scope);
assert.equal(repeated.allowed, false);
assert.equal(repeated.notify, false, "cooldown notice must only be sent once per completed answer");

const worker = fs.readFileSync("worker.js", "utf8");
const receiveStart = worker.indexOf("async receiveUserQuestion");
const receiveEnd = worker.indexOf("async flushBufferedQuestion", receiveStart);
const receive = worker.slice(receiveStart, receiveEnd);
assert.match(receive, /generation_in_progress/);
assert.match(receive, /上一个问题还在生成中/);
assert.doesNotMatch(receive, /cancelActiveQuestion\(key, "cancelled_by_new_input"\)/);
assert.match(receive, /const bufferedContinuation = this\.inputBuffers\.has\(key\)/);

const runStart = worker.indexOf("async runQuestion");
const runEnd = worker.indexOf("async enqueueUserQuestion", runStart);
const run = worker.slice(runStart, runEnd);
const processIndex = run.indexOf("await this.processInboundEvent");
const completeIndex = run.indexOf("processingCompleted = true");
const markIndex = run.indexOf("markRuntimeRateLimitCompletion");
assert(processIndex >= 0 && completeIndex > processIndex && markIndex > completeIndex, "cooldown must be marked only after question processing completes");
assert.match(run, /processingCompleted && !controller\.signal\.aborted/);

console.log("Completion-based AI cooldown checks passed.");
