import assert from "node:assert/strict";
import {
  accountMoneyEstimate,
  extractOpenAiText,
  normalizeMessages,
  normalizeUsage
} from "./src/ai/provider-client.js";

assert.deepEqual(normalizeMessages({ system: "s", text: "u" }), [
  { role: "system", content: "s" },
  { role: "user", content: "u" }
]);

assert.equal(extractOpenAiText({ choices: [{ message: { content: "hello" } }] }), "hello");
assert.equal(extractOpenAiText({ output_text: "responses style" }), "responses style");

assert.deepEqual(normalizeUsage("openai_api", { usage: { prompt_tokens: 12, completion_tokens: 5 } }), {
  inputTokens: 12,
  outputTokens: 5,
  money: 0,
  requests: 1,
  provider: "openai_api"
});

assert.equal(accountMoneyEstimate({
  metadata: { inputMoneyPerMillion: "2", outputMoneyPerMillion: "6" }
}, { inputTokens: 1_000_000, outputTokens: 500_000 }), 5);

console.log("verify-ai-provider-client: ok");
