import assert from "node:assert/strict";
import {
  CODEX_COMMAND_DEFAULT_MODEL,
  CODEX_COMMAND_DEFAULT_REASONING,
  CODEX_PUBLIC_MODEL,
  CODEX_PUBLIC_REASONING,
  parseAiCommandCodexOverride,
  parseCodexChatCommand,
  parseCodexCommand,
  parseCodexWorkCommand
} from "./src/v3/ai/codex-command.js";

assert.equal(CODEX_COMMAND_DEFAULT_MODEL, "gpt-6-luna");
assert.equal(CODEX_COMMAND_DEFAULT_REASONING, "none");
assert.equal(CODEX_PUBLIC_MODEL, "gpt-6-luna");
assert.equal(CODEX_PUBLIC_REASONING, "none");

assert.equal(parseCodexCommand("hello"), null);
let parsed = parseCodexCommand("!codex 什麼是 Durable Object？");
assert.equal(parsed.ok, true);
assert.equal(parsed.mode, "public");
assert.equal(parsed.model, "gpt-6-luna");
assert.equal(parsed.reasoningEffort, "none");
assert.equal(parsed.question, "什麼是 Durable Object？");

parsed = parseCodexCommand("!codex GPT-6 Sol 高 這只是問題文字");
assert.equal(parsed.model, "gpt-6-luna", "public !codex must never let users select a model");
assert.equal(parsed.reasoningEffort, "none", "public !codex must always use no reasoning");
assert.equal(parsed.question, "GPT-6 Sol 高 這只是問題文字");

parsed = parseCodexChatCommand("!codexchat GPT-6 Sol 高 是 幫我分析");
assert.equal(parsed.ok, true);
assert.equal(parsed.mode, "chat");
assert.equal(parsed.model, "gpt-6-sol");
assert.equal(parsed.reasoningEffort, "high");
assert.equal(parsed.originalPromptOnly, true);
assert.equal(parsed.question, "幫我分析");

parsed = parseCodexWorkCommand("!codexwork --root docs --edit --export --model GPT-6 Sol --reasoning 高 修正 README");
assert.equal(parsed.ok, true);
assert.equal(parsed.mode, "work");
assert.equal(parsed.rootAlias, "docs");
assert.equal(parsed.edit, true);
assert.equal(parsed.exportFiles, true);
assert.equal(parsed.model, "gpt-6-sol");
assert.equal(parsed.reasoningEffort, "high");
assert.equal(parsed.question, "修正 README");

let override = parseAiCommandCodexOverride("!成员发言分析 @12345");
assert.equal(override.matched, false);

override = parseAiCommandCodexOverride("!成员发言分析 @12345 --codex");
assert.equal(override.matched, true);
assert.equal(override.ok, true);
assert.equal(override.mode, "public");
assert.equal(override.requiresDeveloper, false);
assert.equal(override.model, "gpt-6-luna");
assert.equal(override.reasoningEffort, "none");

override = parseAiCommandCodexOverride("!成员发言分析 @12345 --codex GPT-6 Sol");
assert.equal(override.ok, false, "public --codex cannot choose model or reasoning");

override = parseAiCommandCodexOverride("!成员发言分析 @12345 --codexchat GPT-6 Sol 超高");
assert.equal(override.ok, true);
assert.equal(override.mode, "chat");
assert.equal(override.requiresDeveloper, true);
assert.equal(override.model, "gpt-6-sol");
assert.equal(override.reasoningEffort, "xhigh");

override = parseAiCommandCodexOverride("!成员发言分析 @12345 --codexwork --root src --edit --export");
assert.equal(override.ok, true);
assert.equal(override.mode, "work");
assert.equal(override.requiresDeveloper, true);
assert.equal(override.work.rootAlias, "src");
assert.equal(override.work.edit, true);
assert.equal(override.work.exportFiles, true);

console.log("Public !codex, developer !codexchat, and bounded !codexwork parser checks passed.");