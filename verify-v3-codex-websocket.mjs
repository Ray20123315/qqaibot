import assert from "node:assert/strict";
import fs from "node:fs";

import { callCodexBridge } from "./src/ai/provider-client.js";
import {
  CODEX_BRIDGE_PATH,
  CODEX_BRIDGE_PROTOCOL,
  normalizeCodexBridgeRequest,
  usesWorkerCodexWebSocket
} from "./src/v3/ai/codex-bridge.js";
import { verifyCodexBridgeAccess } from "./src/security/network.js";

assert.equal(CODEX_BRIDGE_PATH, "/v3/codex-bridge");
assert.equal(CODEX_BRIDGE_PROTOCOL, "qqai-codex-bridge-v1");
assert.equal(usesWorkerCodexWebSocket({ provider: "codex_bridge", endpoint: "" }), true);
assert.equal(usesWorkerCodexWebSocket({ provider: "codex_bridge", endpoint: "worker://codex" }), true);
assert.equal(usesWorkerCodexWebSocket({ provider: "codex_bridge", endpoint: "https://bridge.example" }), false);

const normalized = normalizeCodexBridgeRequest({ model: "gpt-codex" }, {
  task: "chat",
  messages: [{ role: "user", content: "hello" }],
  maxOutputTokens: 2000,
  timeoutMs: 40000,
  reasoningEffort: "high",
  originalPromptOnly: true,
  sessionKey: "qqaibot:group:123:developer:456:group",
  contextHash: "ctx-123"
});
assert.equal(normalized.protocol, CODEX_BRIDGE_PROTOCOL);
assert.equal(normalized.type, "request");
assert.equal(normalized.messages[0].content, "hello");
assert.equal(normalized.maxOutputTokens, 2000);
assert.equal(normalized.reasoningEffort, "high");
assert.equal(normalized.originalPromptOnly, true);
assert.equal(normalized.sessionKey, "qqaibot:group:123:developer:456:group");
assert.equal(normalized.contextHash, "ctx-123");

assert.equal(verifyCodexBridgeAccess(new Request("https://qqai.test/v3/codex-bridge", {
  headers: { Authorization: "Bearer bridge-test-token" }
}), { CODEX_BRIDGE_ACCESS_TOKEN: "bridge-test-token" }), true);
assert.equal(verifyCodexBridgeAccess(new Request("https://qqai.test/v3/codex-bridge"), {
  CODEX_BRIDGE_ACCESS_TOKEN: "bridge-test-token"
}), false);
assert.equal(verifyCodexBridgeAccess(new Request("https://qqai.test/v3/codex-bridge", {
  headers: { Authorization: "Bearer onebot-token" }
}), { CODEX_BRIDGE_ACCESS_TOKEN: "bridge-test-token", ONEBOT_ACCESS_TOKEN: "onebot-token" }), false);

let wsRequest = null;
const wsEnv = {
  ONEBOT_HUB: {
    idFromName(name) { assert.equal(name, "default"); return "default-id"; },
    get(id) {
      assert.equal(id, "default-id");
      return {
        async fetch(url, init) {
          assert.equal(String(url), "https://onebot-hub/v3/codex/chat");
          wsRequest = JSON.parse(init.body);
          return Response.json({
            ok: true,
            result: {
              text: "local codex reply",
              model: "codex-local",
              usage: { inputTokens: 12, outputTokens: 7 },
              allowance: { remaining: 99 }
            }
          });
        }
      };
    }
  }
};
const wsResult = await callCodexBridge({
  provider: "codex_bridge",
  endpoint: "",
  model: "gpt-codex",
  metadata: { transport: "worker_ws" }
}, "", {
  task: "chat",
  messages: [{ role: "user", content: "test local ws" }],
  maxOutputTokens: 300
}, async () => { throw new Error("HTTP fetch must not run for worker WS transport"); }, wsEnv);
assert.equal(wsRequest.protocol, CODEX_BRIDGE_PROTOCOL);
assert.equal(wsRequest.messages[0].content, "test local ws");
assert.equal(wsResult.text, "local codex reply");
assert.equal(wsResult.model, "codex-local");
assert.equal(wsResult.usage.inputTokens, 12);
assert.equal(wsResult.usage.outputTokens, 7);

let httpUrl = "";
let httpPayload = null;
const httpResult = await callCodexBridge({
  provider: "codex_bridge",
  endpoint: "https://bridge.example",
  model: "codex-http"
}, "bridge-secret", {
  task: "chat",
  messages: [{ role: "user", content: "legacy http" }]
}, async (url, init) => {
  httpUrl = String(url);
  httpPayload = JSON.parse(init.body);
  assert.equal(init.headers.Authorization, "Bearer bridge-secret");
  return Response.json({ text: "http reply", model: "codex-http", usage: { prompt_tokens: 3, completion_tokens: 2 } });
}, null);
assert.equal(httpUrl, "https://bridge.example/v1/qqai/chat");
assert.equal(httpPayload.protocol, CODEX_BRIDGE_PROTOCOL);
assert.equal(httpResult.text, "http reply");

const worker = fs.readFileSync("worker.js", "utf8");
assert.match(worker, /url\.pathname === CODEX_BRIDGE_PATH/);
assert.match(worker, /verifyCodexBridgeAccess\(request, env\)/);
assert.match(worker, /acceptWebSocket\(server, \["codex"\]\)/);
assert.match(worker, /sendCodexBridgeRequest/);
assert.match(worker, /CODEX_BRIDGE_INTERNAL_CHAT_PATH/);
assert.match(worker, /CODEX_BRIDGE_NOT_CONNECTED/);
assert.match(worker, /parseCodexCommand\(cleanMessage\)/);
assert.match(worker, /只有开发者可以使用 !codex/);
assert.match(worker, /reasoningEffort: codexCommand\.reasoningEffort/);
assert.match(worker, /originalPromptOnly: codexCommand\.originalPromptOnly/);
assert.match(worker, /group_persona:\$\{currentGroupId\}/);
assert.match(worker, /group_rules:\$\{currentGroupId\}/);
assert.match(worker, /qqaibot:\$\{codexSessionScope\}:developer:\$\{userId\}:\$\{codexSessionMode\}/);
assert.match(worker, /sessionKey: codexSessionKey/);
assert.match(worker, /payload\.type === "quota" \|\| payload\.type === "quota\.response"/);
assert.match(worker, /url\.pathname === "\/v3\/codex\/quota"/);
assert.match(worker, /type: "quota\.request"/);
assert.match(worker, /kind: "quota"/);
assert.match(worker, /requestCodexQuota\(18000\)/);
assert.match(worker, /Object\.defineProperty\(v3PluginBody, "__qqai_codex_executor"/);
assert.match(worker, /this\.sendCodexBridgeRequest\(payload, timeoutMs\)/);
assert.match(worker, /state\.storage\.put\("codex:quota"/);
assert.match(worker, /state\.storage\.get\("codex:quota"/);
assert.match(worker, /quota: this\.codexQuota/);
assert.match(worker, /5 小时额度/);
assert.match(worker, /每周额度/);
assert.match(worker, /if \(isDeveloper\)/);

const statusStart = worker.indexOf("if (['!status', '!配额', '!配額'");
const statusEnd = worker.indexOf("// 第二段到此結束", statusStart);
assert(statusStart >= 0 && statusEnd > statusStart, "!status command block missing");
const statusBlock = worker.slice(statusStart, statusEnd);
assert.match(statusBlock, /getOneBotHub\(env\)\.fetch\("https:\/\/onebot-hub\/v3\/codex\/quota", \{ method: "POST" \}\)/, "!status must trigger exactly one on-demand Codex quota read");
assert.match(statusBlock, /getOneBotHub\(env\)\.fetch\("https:\/\/onebot-hub\/status"\)/, "!status must read the persisted Codex quota through OneBotHub status");
assert.doesNotMatch(statusBlock, /this\.codexQuota/, "!status runs in QQAIWorker scope and must not access OneBotHub instance fields");
assert.doesNotMatch(statusBlock, /this\.restoreCodexSocket/, "!status must not call OneBotHub instance methods from QQAIWorker scope");

assert.doesNotMatch(worker, /CODEX_BRIDGE.*(?:shell|filesystem|file_read|exec_command)/i);

const hostAdapter = fs.readFileSync("src/v3/host/adapter.js", "utf8");
assert.match(hostAdapter, /parseAiCommandCodexOverride\(message\.text\)/);
assert.match(hostAdapter, /PLUGIN_CODEX_DEVELOPER_REQUIRED/);
assert.match(hostAdapter, /eventContext\?\.codexExecutor/);
assert.match(hostAdapter, /deps\.aiChat\(input, \{ plugin, eventContext, aiProviderOverride:/);
assert.doesNotMatch(hostAdapter, /callCodexBridgeWebSocket/, "V3 plugin Codex override must not call the same OneBotHub through its binding");

const portal = fs.readFileSync("src/portal/runtime.js", "utf8");
assert.match(portal, /id="codexQuotaStatus"/);
assert.match(portal, /id="codexQuotaGrid"/);
assert.match(portal, /renderCodexQuota\(r\.codexBridge\)/);
assert.match(portal, /getOneBotHub\(env\)\.fetch\("https:\/\/onebot-hub\/status"\)/);
assert.match(portal, /codexBridge,/);
assert.match(portal, /5 小時額度/);
assert.match(portal, /每週額度/);
assert.match(portal, /Developer 執行 !配額 \/ !status 後才會查詢/);
assert.doesNotMatch(portal, /onebot-hub\/v3\/codex\/quota/, "opening Portal must not trigger a Codex quota read");

console.log("V3 local Codex WebSocket bridge checks passed.");
