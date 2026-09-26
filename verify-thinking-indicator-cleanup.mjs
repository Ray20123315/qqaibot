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

const phaseStart = worker.indexOf("const replaceThinkingStatus = async phase =>");
const phaseEnd = worker.indexOf("let finalReply =", phaseStart);
assert(phaseStart >= 0 && phaseEnd > phaseStart, "search thinking phase block missing");
const phaseBlock = worker.slice(phaseStart, phaseEnd);
assert.match(phaseBlock, /thinkingPhase = \["searching", "organizing", "thinking"\]/, "search phase should remain observable internally");
assert.doesNotMatch(phaseBlock, /sendThinkingIndicator\(/, "search phase changes must not send a new QQ status message");
assert.doesNotMatch(phaseBlock, /clearRegisteredThinkingIndicators\(/, "search phase changes must not recall the current status message");

assert.match(worker, /const searchLikeQuestion = explicitQuestion && semanticQuestion && searchRequirement\(eventPlainText\(body\)\)\.needed;/, "explicit search questions must be detected at the transport deadline");
assert.match(worker, /const internalTimeoutMs = toolTask \|\| searchLikeQuestion \? 60000 : 32000;/, "explicit search questions must receive the longer internal deadline");
assert.match(worker, /remainingBeforeExplicitRetry >= 8000/, "explicit 204 retry must not restart when the deadline is nearly exhausted");

const aiRuntime = fs.readFileSync("src/ai/runtime.js", "utf8");
assert.match(aiRuntime, /sharedSearchResult = result;/, "successful shared search state must be retained");
assert.match(aiRuntime, /sharedSearchResult\?\.performed/, "search fallback must require an actually performed grounded search");
assert.match(aiRuntime, /finish\("search_fallback"/, "grounded search context must be sendable if synthesis providers fail");
assert.match(aiRuntime, /SEARCH_CONTEXT_FALLBACK/, "search fallback must be explicitly tagged");

console.log("verify-thinking-indicator-cleanup: ok");
