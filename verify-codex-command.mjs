import assert from "node:assert/strict";
import {
  CODEX_COMMAND_DEFAULT_MODEL,
  CODEX_COMMAND_DEFAULT_REASONING,
  parseCodexCommand
} from "./src/v3/ai/codex-command.js";

assert.equal(CODEX_COMMAND_DEFAULT_MODEL, "gpt-6-luna");
assert.equal(CODEX_COMMAND_DEFAULT_REASONING, "none");
assert.equal(parseCodexCommand("hello"), null);

let parsed = parseCodexCommand("!codex 什麼是 Durable Object？");
assert.equal(parsed.ok, true);
assert.equal(parsed.model, "gpt-6-luna");
assert.equal(parsed.reasoningEffort, "none");
assert.equal(parsed.originalPromptOnly, false);
assert.equal(parsed.question, "什麼是 Durable Object？");

parsed = parseCodexCommand("!codex GPT-6 Luna 幫我分析這個錯誤");
assert.equal(parsed.model, "gpt-6-luna");
assert.equal(parsed.reasoningEffort, "none");
assert.equal(parsed.question, "幫我分析這個錯誤");

parsed = parseCodexCommand("!codex 高 幫我分析這個錯誤");
assert.equal(parsed.model, "gpt-6-luna");
assert.equal(parsed.reasoningEffort, "high");
assert.equal(parsed.question, "幫我分析這個錯誤");

parsed = parseCodexCommand("!codex 是 直接回答原始問題");
assert.equal(parsed.model, "gpt-6-luna");
assert.equal(parsed.reasoningEffort, "none");
assert.equal(parsed.originalPromptOnly, true);
assert.equal(parsed.question, "直接回答原始問題");

parsed = parseCodexCommand("!codex GPT-6 Luna 最大 否 最難的問題");
assert.equal(parsed.model, "gpt-6-luna");
assert.equal(parsed.reasoningEffort, "max");
assert.equal(parsed.originalPromptOnly, false);
assert.equal(parsed.question, "最難的問題");

parsed = parseCodexCommand("！codex gpt-6-sol 超高 是 寫一個測試計畫");
assert.equal(parsed.model, "gpt-6-sol");
assert.equal(parsed.reasoningEffort, "xhigh");
assert.equal(parsed.originalPromptOnly, true);
assert.equal(parsed.question, "寫一個測試計畫");

parsed = parseCodexCommand("!codex gpt-5.3-codex 低 測試");
assert.equal(parsed.model, "gpt-5.3-codex");
assert.equal(parsed.reasoningEffort, "low");
assert.equal(parsed.question, "測試");

parsed = parseCodexCommand("!codex");
assert.equal(parsed.ok, false);
assert.match(parsed.message, /GPT-6 Luna/);
assert.match(parsed.message, /無 \/ 低 \/ 中 \/ 高 \/ 超高 \/ 最大/);

console.log("Developer !codex command parser checks passed.");
