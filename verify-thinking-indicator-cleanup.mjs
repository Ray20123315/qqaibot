import assert from "node:assert/strict";
import fs from "node:fs";
import {
  clearRegisteredThinkingIndicators,
  thinkingIndicatorRegistryKey
} from "./src/onebot/messages.js";

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

const rpcCalls = [];
const oneBotStub = {
  async fetch(url, init = {}) {
    const body = JSON.parse(String(init.body || "{}"));
    rpcCalls.push(body);
    return new Response(JSON.stringify({
      ok: false,
      error: "Timeout: NTEvent serviceAndMethod:NodeIKernelMsgService/recallMsg"
    }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  }
};

const env = {
  DB: new MemoryD1(),
  ONEBOT_HUB: {
    idFromName(name) { return String(name); },
    get() { return oneBotStub; }
  }
};
const target = { isGroup: true, groupId: "808882936", userId: "3569028262" };
const key = thinkingIndicatorRegistryKey(target);
env.DB.values.set(key, JSON.stringify(["111", "222"]));

const result = await clearRegisteredThinkingIndicators(env, target);
assert.equal(rpcCalls.length, 2, "each stored thinking id must be recalled at most once in this cleanup");
assert.deepEqual(rpcCalls.map(call => call.action), ["delete_msg", "delete_msg"]);
assert.equal(result.cleared, 0);
assert.equal(result.failed.length, 2);
assert.equal(result.forgotten, 2);
assert.equal(env.DB.values.has(key), false, "failed recall ids must not remain in the active registry for the next message");

const worker = fs.readFileSync("worker.js", "utf8");
const registeredStart = worker.indexOf("async retractRegisteredThinkingIndicators");
const registeredEnd = worker.indexOf("classifyToolTask(body)", registeredStart);
assert(registeredStart >= 0 && registeredEnd > registeredStart, "Durable Object thinking cleanup block missing");
const block = worker.slice(registeredStart, registeredEnd);
assert.match(block, /await dbDel\(this\.env, key\)/, "Durable Object must clear the thinking registry before recalls");
assert.doesNotMatch(block, /admin_group_recall_retry/, "thinking recall must not immediately retry merely because the bot is admin");
assert.doesNotMatch(block, /thinking_indicator_residual:/, "failed temporary recalls must not create a retryable residual record");
assert.doesNotMatch(block, /dbPut\(this\.env, key, JSON\.stringify\(failed/, "failed thinking ids must not be persisted for later retries");
assert.equal((block.match(/action: "delete_msg"/g) || []).length, 1, "Durable Object must have only one delete_msg attempt path for a thinking id");
assert.match(block, /recall_failed_not_retried/, "failed recalls must stay auditable as best-effort failures");

console.log("verify-thinking-indicator-cleanup: ok");
