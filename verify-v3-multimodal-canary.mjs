import assert from "node:assert/strict";
import fs from "node:fs";
import { canaryEligible, diagnosticSummary, multimodalCanaryConfig, runV3MultimodalCanary } from "./src/v3/canary/multimodal.js";
import { createCanonicalMessage } from "./src/v3/message/core.js";

function event({ groupId = 123, userId = 456, selfId = 789, segments = [] } = {}) {
  return {
    post_type: "message",
    message_type: "group",
    message_id: 9001,
    group_id: groupId,
    user_id: userId,
    self_id: selfId,
    message: segments
  };
}

const imageEvent = event({ segments: [
  { type: "at", data: { qq: "789" } },
  { type: "text", data: { text: "這是什麼？" } },
  { type: "image", data: { file: "image-token", url: "https://example.com/a.png" } }
] });

{
  let aiCalls = 0;
  const result = await runV3MultimodalCanary({}, imageEvent, { aiRun: async () => { aiCalls += 1; return { text: "unexpected" }; } });
  assert.equal(result.eligible, false);
  assert.equal(result.handled, false);
  assert.equal(aiCalls, 0, "disabled canary must not call AI");
}

{
  let aiCalls = 0;
  const result = await runV3MultimodalCanary({ V3_MULTIMODAL_CANARY_ENABLED: "true", V3_MULTIMODAL_CANARY_GROUPS: "999" }, imageEvent, {
    aiRun: async () => { aiCalls += 1; return { text: "unexpected" }; }
  });
  assert.equal(result.eligible, false);
  assert.equal(aiCalls, 0, "non-allowlisted group must not call AI");
}

{
  const noMention = event({ segments: [{ type: "image", data: { file: "x", url: "https://example.com/a.png" } }] });
  const result = await runV3MultimodalCanary({ V3_MULTIMODAL_CANARY_ENABLED: "1", V3_MULTIMODAL_CANARY_GROUPS: "123" }, noMention, {
    aiRun: async () => { throw new Error("must not run"); }
  });
  assert.equal(result.eligible, false, "explicit bot mention is required");
}

{
  const faceOnly = event({ segments: [{ type: "at", data: { qq: "789" } }, { type: "face", data: { id: "14" } }] });
  const result = await runV3MultimodalCanary({ V3_MULTIMODAL_CANARY_ENABLED: "1", V3_MULTIMODAL_CANARY_GROUPS: "123" }, faceOnly, {
    aiRun: async () => { throw new Error("must not run"); }
  });
  assert.equal(result.eligible, false, "native face is semantic context but must not trigger media canary by itself");
}

{
  const sent = [];
  const audits = [];
  const result = await runV3MultimodalCanary({
    V3_MULTIMODAL_CANARY_ENABLED: "true",
    V3_MULTIMODAL_CANARY_GROUPS: "123,777",
    V3_MULTIMODAL_CANARY_MODE: "observe"
  }, imageEvent, {
    aiRun: async (message, input) => {
      assert.equal(message.parts.some(part => part.kind === "image"), true);
      assert.match(input.prompt, /QQ 群訊息/);
      return { text: "觀察結果", model: "stub", compile: { issues: [], stats: { mediaParts: 1 } } };
    },
    onebotCall: async (...args) => { sent.push(args); },
    audit: async entry => { audits.push(entry); }
  });
  assert.equal(result.eligible, true);
  assert.equal(result.observed, true);
  assert.equal(result.handled, false, "observe mode must never claim the message");
  assert.equal(sent.length, 0, "observe mode must not send a QQ reply");
  assert.equal(audits[0].type, "v3_multimodal_canary");
  assert.equal(audits[0].ok, true);
}

{
  const sent = [];
  const result = await runV3MultimodalCanary({
    V3_MULTIMODAL_CANARY_ENABLED: "true",
    V3_MULTIMODAL_CANARY_GROUPS: "123",
    V3_MULTIMODAL_CANARY_MODE: "reply"
  }, imageEvent, {
    aiRun: async () => ({ text: "v3 回覆", model: "stub", compile: { issues: [] } }),
    onebotCall: async (action, params) => { sent.push({ action, params }); return { message_id: 1 }; },
    audit: async () => {}
  });
  assert.equal(result.handled, true);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].action, "send_group_msg");
  assert.equal(sent[0].params.group_id, "123");
  assert.equal(sent[0].params.message[0].type, "reply");
  assert.equal(sent[0].params.message[1].type, "text");
  assert.equal(sent[0].params.message[1].data.text, "v3 回覆");
}

{
  const audits = [];
  const result = await runV3MultimodalCanary({
    V3_MULTIMODAL_CANARY_ENABLED: "true",
    V3_MULTIMODAL_CANARY_GROUPS: "123",
    V3_MULTIMODAL_CANARY_MODE: "reply"
  }, imageEvent, {
    aiRun: async () => { const error = new Error("model down"); error.code = "MULTIMODAL_MODEL_FAILED"; error.stage = "model"; throw error; },
    audit: async entry => { audits.push(entry); }
  });
  assert.equal(result.handled, false, "AI failure must fall through to v2");
  assert.equal(result.eligible, true);
  assert.equal(result.error.code, "MULTIMODAL_MODEL_FAILED");
  assert.equal(audits[0].type, "v3_multimodal_canary_failed");
}

{
  const mfaceMessage = createCanonicalMessage({ scope: "group", groupId: "123", userId: "456", selfId: "789" }, [
    { kind: "mention", userId: "789", all: false },
    { kind: "mface", emojiId: "secret-emoji", packageId: "secret-package", key: "secret-key", summary: "開心", media: { url: "https://secret.example/emoji", base64: "SECRET_BASE64", path: "C:\\secret", file: "token" } }
  ]);
  const config = multimodalCanaryConfig({ V3_MULTIMODAL_CANARY_ENABLED: "1", V3_MULTIMODAL_CANARY_GROUPS: "123" });
  assert.equal(canaryEligible(mfaceMessage, config), true, "mface must qualify as multimodal canary input");
  const summary = diagnosticSummary(mfaceMessage, { text: "ok", model: "x", compile: { issues: [{ code: "MEDIA_X" }] } }, null, "observe");
  const serialized = JSON.stringify(summary);
  for (const secret of ["secret-emoji", "secret-package", "secret-key", "https://secret.example/emoji", "SECRET_BASE64", "C:\\secret", "token", "開心"]) {
    assert.equal(serialized.includes(secret), false, `diagnostic summary must not leak ${secret}`);
  }
  assert.ok(summary.mediaKinds.includes("mface"));
  assert.deepEqual(summary.compileIssues, ["MEDIA_X"]);
}

{
  const source = fs.readFileSync("src/games/werewolf.js", "utf8");
  const canaryIndex = source.indexOf("runV3MultimodalCanary(env, body)");
  const legacyIndex = source.lastIndexOf("return handleLegacyWerewolfOneBotEvent(env, body)");
  assert.ok(canaryIndex >= 0, "ingress wrapper must invoke multimodal canary");
  assert.ok(legacyIndex > canaryIndex, "legacy v2 handler must remain the fallback after canary");
  assert.match(source, /if \(canary\?\.handled\) return canary;/, "only a handled canary may short-circuit v2");
}

console.log("verify-v3-multimodal-canary: ok");