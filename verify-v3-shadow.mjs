import assert from "node:assert/strict";
import fs from "node:fs";
import { rawEventHasMedia, runV3ShadowEvent, deterministicSample, shadowEnabled } from "./src/v3/shadow/runtime.js";
import { shadowDiagnosticsPlugin } from "./src/plugins/official/shadow-diagnostics.js";

assert.equal(shadowEnabled({}), false, "shadow mode must default off");
assert.deepEqual(shadowDiagnosticsPlugin.manifest.capabilities, ["message.read", "media.read"]);
assert.equal(shadowDiagnosticsPlugin.manifest.capabilities.includes("message.send"), false);
assert.equal(shadowDiagnosticsPlugin.manifest.capabilities.includes("storage"), false);

const secretText = "SECRET_MESSAGE_TEXT_123";
const secretUrl = "https://secret.example/image.png?token=abc";
const secretPath = "C:/NapCat/secret.silk";
const secretMfaceKey = "MFACE_SECRET_KEY";
const event = {
  post_type: "message",
  message_type: "group",
  message_id: 991,
  group_id: 2002,
  user_id: 3003,
  self_id: 4004,
  time: 1700000000,
  message: [
    { type: "text", data: { text: secretText } },
    { type: "image", data: { file: "img-1", url: secretUrl, file_size: 123 } },
    { type: "record", data: { file: "audio-1", path: secretPath } },
    { type: "image", data: { file: "marketface", emoji_id: "e1", emoji_package_id: "p1", key: secretMfaceKey, summary: "cat" } }
  ]
};
assert.equal(rawEventHasMedia(event), true);
assert.equal(deterministicSample(event, 1), true);
assert.equal(deterministicSample(event, 0), false);
assert.equal(deterministicSample(event, 0.5), deterministicSample(event, 0.5), "sampling must be stable");

const disabledLogs = [];
const disabled = await runV3ShadowEvent({}, event, { logger: { info: (...args) => disabledLogs.push(args.join(" ")) } });
assert.equal(disabled.enabled, false);
assert.equal(disabledLogs.length, 0);

const logs = [];
const result = await runV3ShadowEvent({}, event, {
  force: true,
  logger: { info: (...args) => logs.push(args.join(" ")), warn() {}, error() {}, debug() {} }
});
assert.equal(result.enabled, true);
assert.equal(result.sampled, true);
assert.equal(result.diagnostic.eventName, "group_message");
assert.equal(result.diagnostic.summaries.length >= 1, true);
const summary = result.diagnostic.summaries.find(item => item?.type === "message");
assert(summary, "message summary missing");
assert.deepEqual(summary.kinds, ["text", "image", "audio", "mface"]);
assert.equal(summary.hasMedia, true);
assert.equal(logs.length, 1);
const log = logs[0];
for (const secret of [secretText, secretUrl, secretPath, secretMfaceKey, "img-1", "audio-1"]) {
  assert.equal(log.includes(secret), false, `shadow log leaked secret/media reference: ${secret}`);
}
assert.match(log, /\[v3-shadow\]/);
assert.match(log, /group_message/);
assert.match(log, /mface/);

const wrapper = fs.readFileSync("src/games/werewolf.js", "utf8");
assert.match(wrapper, /runV3ShadowEvent/);
assert.match(wrapper, /shadowEnabled\(env\)/);
assert.match(wrapper, /async function handleLegacyWerewolfOneBotEvent/);
assert.match(wrapper, /return handleLegacyWerewolfOneBotEvent\(env, body\)/);
assert.match(wrapper, /catch/);

console.log("verify-v3-shadow: ok");
