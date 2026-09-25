import assert from "node:assert/strict";
import { definePlugin } from "./src/plugins/api.js";
import { createCanonicalMessage } from "./src/v3/message/core.js";
import { createV3HostAdapter, defaultAiTts } from "./src/v3/host/adapter.js";
import { base64ToBytes, extractInteractionAudio, pcmL16ToWavBase64, synthesizeGeminiTts } from "./src/v3/ai/tts.js";

const pcm = Buffer.from([0x01, 0x00, 0x02, 0x00, 0x03, 0x00, 0x04, 0x00]).toString("base64");
const wav = pcmL16ToWavBase64(pcm, { sampleRate: 24000, channels: 1 });
const wavBytes = base64ToBytes(wav);
assert.equal(String.fromCharCode(...wavBytes.slice(0, 4)), "RIFF");
assert.equal(String.fromCharCode(...wavBytes.slice(8, 12)), "WAVE");
assert.equal(wavBytes.length, 52);

const extracted = extractInteractionAudio({
  steps: [{
    type: "model_output",
    content: [{ type: "audio", data: pcm, mime_type: "audio/l16", sample_rate: 24000, channels: 1 }]
  }]
});
assert.equal(extracted.mimeType, "audio/l16");
assert.equal(extracted.sampleRate, 24000);

const requests = [];
const synth = await synthesizeGeminiTts({ text: "你好，這是 QQAI 語音測試。", voice: "Kore" }, {
  models: ["gemini-3.1-flash-tts-preview"],
  apiKeys: ["tts-secret"],
  fetchImpl: async (url, init) => {
    requests.push({ url, init });
    return new Response(JSON.stringify({
      steps: [{
        type: "model_output",
        content: [{ type: "audio", data: pcm, mime_type: "audio/l16", sample_rate: 24000, channels: 1 }]
      }]
    }), { status: 200, headers: { "content-type": "application/json" } });
  }
});
assert.equal(requests.length, 1);
assert.equal(requests[0].url, "https://generativelanguage.googleapis.com/v1beta/interactions");
assert.equal(requests[0].url.includes("tts-secret"), false, "TTS API key must not be placed in URL");
assert.equal(requests[0].init.headers["x-goog-api-key"], "tts-secret");
assert.equal(requests[0].init.headers["Api-Revision"], "2026-05-20");
const requestBody = JSON.parse(requests[0].init.body);
assert.equal(requestBody.response_format.type, "audio");
assert.equal(requestBody.response_format.mime_type, "audio/wav");
assert.deepEqual(requestBody.generation_config.speech_config, [{ voice: "Kore" }]);
assert.equal(synth.audio.mimeType, "audio/wav");
assert.equal(synth.audio.converted, true);
assert.equal(synth.part.kind, "audio");
assert.equal(synth.part.media.mimeType, "audio/wav");
assert.ok(synth.part.media.base64.length > pcm.length);

const defaultResult = await defaultAiTts({}, "default path", {
  models: ["gemini-3.1-flash-tts-preview"],
  apiKeys: ["default-secret"],
  fetchImpl: async () => new Response(JSON.stringify({
    steps: [{ type: "model_output", content: [{ type: "audio", data: wav, mime_type: "audio/wav", sample_rate: 24000, channels: 1 }] }]
  }), { status: 200, headers: { "content-type": "application/json" } })
});
assert.equal(defaultResult.audio.mimeType, "audio/wav");
assert.equal(defaultResult.audio.converted, false);

const message = createCanonicalMessage({ messageId: "9001", scope: "group", groupId: "123", userId: "456", selfId: "789" }, [
  { kind: "text", text: "請用語音回答" }
]);

const plugin = definePlugin({
  manifest: {
    id: "test.tts-output",
    name: "TTS Output Test",
    version: "1.0.0",
    apiVersion: "1",
    capabilities: ["message.read", "message.send", "media.send", "ai.tts"]
  },
  commands: [{
    name: "tts-output-test",
    async run(ctx) {
      const result = await ctx.ai.tts({ text: "hello" });
      await ctx.reply([result.part]);
      return result.model;
    }
  }]
});

const actions = [];
const host = createV3HostAdapter({}, {
  plugins: [plugin],
  logger: { info() {}, warn() {}, error() {}, debug() {} },
  dependencies: {
    aiTts: async () => synth,
    onebotCall: async (action, params) => {
      actions.push({ action, params });
      if (action === "can_send_record") return { data: { yes: true } };
      if (action === "send_group_msg") return { data: { message_id: 1 } };
      throw new Error(`unexpected action ${action}`);
    },
    dbGet: async () => null,
    dbPut: async () => {},
    dbDel: async () => {}
  }
});
await host.start();
const first = await host.runCommand("tts-output-test", {}, { message, groupId: "123", userId: "456" });
assert.equal(first.handled, true);
assert.equal(first.result, "gemini-3.1-flash-tts-preview");
assert.equal(actions[0].action, "can_send_record");
assert.equal(actions[1].action, "send_group_msg");
assert.equal(actions[1].params.message[0].type, "record");
assert.ok(String(actions[1].params.message[0].data.file).startsWith("base64://"));
await host.runCommand("tts-output-test", {}, { message, groupId: "123", userId: "456" });
assert.equal(actions.filter(item => item.action === "can_send_record").length, 1, "record capability should be cached after positive probe");
assert.equal(actions.filter(item => item.action === "send_group_msg").length, 2);
await host.stop();

const blockedActions = [];
const blockedHost = createV3HostAdapter({}, {
  plugins: [plugin],
  logger: { info() {}, warn() {}, error() {}, debug() {} },
  dependencies: {
    aiTts: async () => synth,
    onebotCall: async action => {
      blockedActions.push(action);
      if (action === "can_send_record") return { data: { yes: false } };
      if (action === "send_group_msg") throw new Error("send should not be reached");
      return null;
    },
    dbGet: async () => null,
    dbPut: async () => {},
    dbDel: async () => {}
  }
});
await blockedHost.start();
await assert.rejects(
  () => blockedHost.runCommand("tts-output-test", {}, { message, groupId: "123", userId: "456" }),
  /PLUGIN_AUDIO_SEND_UNAVAILABLE/
);
assert.deepEqual(blockedActions, ["can_send_record"]);
await blockedHost.stop();

const deniedPlugin = definePlugin({
  manifest: { id: "test.tts-denied", name: "TTS Denied", version: "1.0.0", apiVersion: "1", capabilities: ["message.read"] },
  commands: [{ name: "tts-denied", async run(ctx) { return ctx.ai.tts("no"); } }]
});
const deniedHost = createV3HostAdapter({}, {
  plugins: [deniedPlugin],
  dependencies: { dbGet: async () => null, dbPut: async () => {}, dbDel: async () => {}, onebotCall: async () => null }
});
await deniedHost.start();
await assert.rejects(() => deniedHost.runCommand("tts-denied", {}, { message }), /PLUGIN_CAPABILITY_DENIED:test\.tts-denied:ai\.tts/);
await deniedHost.stop();

console.log("verify-v3-tts-output: ok");
