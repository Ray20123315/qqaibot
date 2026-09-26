import assert from "node:assert/strict";
import fs from "node:fs";
import {
  AI_COMMAND_TOOL_COMMANDS,
  buildAiCommandToolCommand,
  shouldClassifyNaturalLanguageCommand
} from "./src/operations/runtime.js";

assert.ok(Object.keys(AI_COMMAND_TOOL_COMMANDS).length >= 20, "smart command router should expose a meaningful allowlist");
assert.equal(buildAiCommandToolCommand("status"), "!status");
assert.equal(buildAiCommandToolCommand("ai_off"), "!关闭ai");
assert.equal(buildAiCommandToolCommand("rule_strictness", "高"), "!群规严格度 高");
assert.equal(buildAiCommandToolCommand("recall_message", "", { hasQuote: true, actorRole: "admin" }), "!撤回");
assert.equal(buildAiCommandToolCommand("recall_message", "", { hasQuote: true, actorRole: "member" }), "!协助撤回");
assert.equal(buildAiCommandToolCommand("recall_message", "", { hasQuote: false, actorRole: "admin" }), "");
assert.equal(buildAiCommandToolCommand("member_details", "@123456", { targetQqs: ["123456"] }), "!详细资料 @123456");
assert.equal(buildAiCommandToolCommand("member_details", "@999999", { targetQqs: ["123456"] }), "", "router must reject hallucinated member targets");
assert.equal(
  buildAiCommandToolCommand("read_web", "https://example.com/a", { sourceText: "帮我读 https://example.com/a" }),
  "!读网页 https://example.com/a"
);
assert.equal(
  buildAiCommandToolCommand("read_web", "https://example.com/b", { sourceText: "帮我读 https://example.com/a" }),
  "",
  "router must not invent a URL"
);
assert.equal(buildAiCommandToolCommand("not_registered", "anything"), "");
assert.equal(shouldClassifyNaturalLanguageCommand("帮我查看一下详细资料"), true);
assert.equal(shouldClassifyNaturalLanguageCommand("今天天气不错"), false);

const worker = fs.readFileSync("worker.js", "utf8");
assert.match(worker, /classifyNaturalLanguageCommandIntent\(env, naturalSourceText, \{/);
assert.match(worker, /applyNaturalLanguageCommand\(normalizedNatural\)/);
assert.match(worker, /targetQqs: mentionedQqs\.filter/);
assert.match(worker, /if \(result\.ok\) return new Response\(null, \{ status: 204 \}\);/);
assert.doesNotMatch(worker, /已尝试撤回该消息。/);

const help = fs.readFileSync("src/help/commands.js", "utf8");
assert.match(help, /智能指令调用/);
assert.match(help, /实际执行仍经过原指令权限、Portal 开关与确认流程/);
assert.match(help, /成功后静默，不额外发送通知/);

console.log("verify-smart-command-routing: ok");
