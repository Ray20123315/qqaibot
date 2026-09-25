import assert from "node:assert/strict";
import { definePlugin } from "./src/plugins/api.js";
import { PLUGIN_CAPABILITIES } from "./src/plugins/constants.js";
import { createV3HostAdapter } from "./src/v3/host/adapter.js";
import { compileCanonicalMessageToGemini, MultimodalCompileError } from "./src/v3/ai/multimodal.js";
import { MultimodalAiError, runV3MultimodalAi } from "./src/v3/ai/runtime.js";
import { createCanonicalMessage } from "./src/v3/message/core.js";

const image64 = Buffer.from("image-bytes").toString("base64");
const mface64 = Buffer.from("market-face").toString("base64");
const audio64 = Buffer.from("audio-bytes").toString("base64");

const message = createCanonicalMessage({ messageId: "9001", scope: "group", groupId: "123", userId: "456", selfId: "789" }, [
  { kind: "text", text: "請幫我理解這些內容 " },
  { kind: "face", faceId: "14" },
  { kind: "image", summary: "截圖", media: { base64: image64, mimeType: "image/png", size: 11 } },
  { kind: "mface", emojiId: "e1", packageId: "p1", summary: "開心", media: { base64: mface64, mimeType: "image/webp", size: 11 } },
  { kind: "audio", media: { file: "voice-token" } },
  { kind: "forward", forwardId: "", nodes: [
    { userId: "111", nickname: "Alice", parts: [{ kind: "text", text: "轉發文字" }, { kind: "face", faceId: "66" }] }
  ] }
]);

const onebotCalls = [];
const compiled = await compileCanonicalMessageToGemini(message, {
  async onebotCall(action, params) {
    onebotCalls.push({ action, params });
    if (action === "get_record") return { base64: audio64, mime_type: "audio/mpeg" };
    throw new Error(`unexpected onebot action ${action}`);
  },
  async safeFetch() { throw new Error("safeFetch should not be used for inline fixtures"); }
}, { prompt: "逐項說明", strictMedia: true });

assert.equal(compiled.contents.length, 1);
assert.equal(compiled.contents[0].role, "user");
assert.equal(compiled.stats.mediaParts, 3);
assert.equal(compiled.issues.length, 0);
assert.equal(onebotCalls.length, 1);
assert.equal(onebotCalls[0].action, "get_record");
assert.ok(compiled.parts.some(part => String(part.text || "").includes("face_id=14")), "native QQ face must survive as semantic text");
assert.ok(compiled.parts.some(part => String(part.text || "").includes("QQ 商城表情：開心")), "market-face summary must survive alongside pixels");
assert.ok(compiled.parts.some(part => part.inlineData?.mimeType === "image/png" && part.inlineData.data === image64));
assert.ok(compiled.parts.some(part => part.inlineData?.mimeType === "image/webp" && part.inlineData.data === mface64));
assert.ok(compiled.parts.some(part => part.inlineData?.mimeType === "audio/mpeg" && part.inlineData.data === audio64));
assert.ok(compiled.parts.some(part => String(part.text || "").includes("轉發 1/1｜Alice")));
assert.ok(compiled.parts.some(part => String(part.text || "").includes("face_id=66")));
assert.ok(compiled.parts.some(part => String(part.text || "").includes("逐項說明")));

const localOnly = createCanonicalMessage({ messageId: "2", scope: "group", groupId: "123", userId: "456" }, [
  { kind: "image", media: { path: "C:\\NapCat\\cache\\x.jpg", file: "C:\\NapCat\\cache\\x.jpg" } }
]);
const localOnlyDeps = {
  async onebotCall() { throw new Error("NapCat returned no remote media source"); }
};
const degraded = await compileCanonicalMessageToGemini(localOnly, localOnlyDeps, { strictMedia: false });
assert.equal(degraded.stats.mediaParts, 0);
assert.ok(degraded.issues.some(issue => issue.code === "MEDIA_LOCAL_PATH_UNREACHABLE"));
assert.ok(degraded.parts.some(part => String(part.text || "").includes("圖片無法解析")));
await assert.rejects(
  () => compileCanonicalMessageToGemini(localOnly, localOnlyDeps, { strictMedia: true }),
  error => error instanceof MultimodalCompileError && error.code === "MULTIMODAL_MEDIA_RESOLVE_FAILED"
);

let capturedRequest = null;
const aiResult = await runV3MultimodalAi({ GEMINI_VISION_MODELS: "vision-test" }, message, { prompt: "回答問題", maxOutputTokens: 321 }, {
  fallbackModels: ["fallback"],
  getApiKeys: () => ["test-key"],
  getModels: () => ["vision-test"],
  async onebotCall(action) {
    if (action === "get_record") return { base64: audio64, mime_type: "audio/mpeg" };
    throw new Error(`unexpected ${action}`);
  },
  async modelCall(_env, request) {
    capturedRequest = request;
    return { text: "模型完成", model: "vision-test", usage: { promptTokenCount: 1 }, finishReason: "STOP" };
  }
});
assert.equal(aiResult.text, "模型完成");
assert.equal(aiResult.model, "vision-test");
assert.equal(aiResult.compile.stats.mediaParts, 3);
assert.equal(capturedRequest.keyProvider, "gemini_vision");
assert.deepEqual(capturedRequest.apiKeys, ["test-key"]);
assert.equal(capturedRequest.maxOutputTokens, 321);
assert.ok(capturedRequest.contents[0].parts.some(part => part.inlineData?.mimeType === "audio/mpeg"));

await assert.rejects(
  () => runV3MultimodalAi({ GEMINI_VISION_MODELS: "vision-test" }, createCanonicalMessage({ scope: "group" }, [{ kind: "image", media: { base64: image64, mimeType: "image/png", size: 11 } }]), {}, {
    fallbackModels: ["fallback"],
    getApiKeys: () => ["test-key"],
    getModels: () => ["vision-test"],
    async modelCall() { throw new Error("provider down"); }
  }),
  error => error instanceof MultimodalAiError && error.stage === "model" && error.code === "MULTIMODAL_MODEL_FAILED"
);

assert.ok(PLUGIN_CAPABILITIES.includes("ai.multimodal"));

const pluginResults = [];
const plugin = definePlugin({
  manifest: {
    id: "test.multimodal",
    name: "Multimodal Test",
    version: "1.0.0",
    apiVersion: "1",
    capabilities: ["message.read", "media.read", "ai.multimodal"]
  },
  async onGroupMessage(ctx) {
    const result = await ctx.ai.multimodal({ prompt: "插件問題" });
    pluginResults.push(result);
    return result;
  }
});
const host = createV3HostAdapter({}, {
  plugins: [plugin],
  dependencies: {
    dbGet: async () => null,
    dbPut: async () => {},
    dbDel: async () => {},
    onebotCall: async () => { throw new Error("unused"); },
    safeFetch: async () => { throw new Error("unused"); },
    aiMultimodal: async (currentMessage, input) => ({ text: `${currentMessage.parts[0].kind}:${input.prompt}`, model: "stub" })
  },
  logger: { info() {}, warn() {}, error() {}, debug() {} }
});
await host.start();
await host.dispatchOneBotEvent({ post_type: "message", message_type: "group", message_id: 1, group_id: 123, user_id: 456, message: [{ type: "image", data: { file: "abc", url: "https://example.com/a.png" } }] });
assert.equal(pluginResults[0].text, "image:插件問題");
await host.stop();

const deniedPlugin = definePlugin({
  manifest: {
    id: "test.multimodal-denied",
    name: "Multimodal Denied",
    version: "1.0.0",
    apiVersion: "1",
    capabilities: ["message.read", "ai.multimodal"]
  },
  async onGroupMessage(ctx) { return ctx.ai.multimodal({ prompt: "nope" }); }
});
const deniedHost = createV3HostAdapter({}, {
  plugins: [deniedPlugin],
  dependencies: {
    dbGet: async () => null,
    dbPut: async () => {},
    dbDel: async () => {},
    aiMultimodal: async () => ({ text: "unexpected" })
  },
  logger: { info() {}, warn() {}, error() {}, debug() {} }
});
await deniedHost.start();
await assert.rejects(
  () => deniedHost.dispatchOneBotEvent({ post_type: "message", message_type: "group", group_id: 123, user_id: 456, message: [{ type: "text", data: { text: "x" } }] }),
  /PLUGIN_CAPABILITY_DENIED:test\.multimodal-denied:media\.read/
);
await deniedHost.stop();

console.log("verify-v3-ai-multimodal: ok");