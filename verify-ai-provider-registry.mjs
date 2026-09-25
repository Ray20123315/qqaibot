import assert from "node:assert/strict";
import {
  AI_PROVIDER_TASKS,
  AI_PROVIDER_TYPES,
  normalizeProviderAccount,
  normalizeQuota,
  normalizeTaskKinds,
  normalizeUsage,
  quotaAllows,
  safeProviderAccount
} from "./src/ai/provider-registry.js";

assert(AI_PROVIDER_TYPES.includes("codex_bridge"));
assert(AI_PROVIDER_TYPES.includes("cloudflare_workers_ai"));
assert(AI_PROVIDER_TYPES.includes("cloudflare_ai_gateway"));
assert(AI_PROVIDER_TASKS.includes("vision") && AI_PROVIDER_TASKS.includes("tts"));

const account = normalizeProviderAccount({
  id: "CF-main",
  provider: "cloudflare_ai_gateway",
  label: "Cloudflare 主帳號",
  tasks: ["chat", "vision", "chat", "invalid"],
  endpoint: "https://example.invalid",
  model: "model-a",
  quota: { dailyMoney: 3.5, dailyInputTokens: 10000, remainingMoneyReported: 8.2 },
  encryptedSecret: { version: 1, iv: "x", data: "y" }
});
assert.equal(account.id, "cf-main");
assert.deepEqual(account.tasks, ["chat", "vision"]);
assert.equal(account.quota.dailyMoney, 3.5);
assert.equal(safeProviderAccount(account).hasSecret, true);
assert.equal(Object.prototype.hasOwnProperty.call(safeProviderAccount(account), "encryptedSecret"), false);

assert.deepEqual(normalizeTaskKinds("chat,tts chat"), ["chat", "tts"]);
assert.equal(normalizeQuota({ dailyMoney: -1 }).dailyMoney, null);
assert.deepEqual(normalizeUsage({ prompt_tokens: 10, completion_tokens: 4, cost: 0.2 }), {
  inputTokens: 10,
  outputTokens: 4,
  money: 0.2,
  requests: 1
});

const day = { inputTokens: 900, outputTokens: 10, money: 0.9, requests: 3 };
const month = { inputTokens: 900, outputTokens: 10, money: 0.9, requests: 3 };
assert.equal(quotaAllows({ quota: { dailyInputTokens: 1000 } }, day, month, { inputTokens: 100 }).ok, true);
assert.equal(quotaAllows({ quota: { dailyInputTokens: 1000 } }, day, month, { inputTokens: 101 }).reason, "daily_input_tokens");
assert.equal(quotaAllows({ quota: { dailyMoney: 1 } }, day, month, { money: 0.11 }).reason, "daily_money");

console.log("verify-ai-provider-registry: ok");
