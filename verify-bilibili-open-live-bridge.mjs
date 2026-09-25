import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { bodyMd5, makePacket, normalizedTypeForCommand, parseJsonBody, signedHeaders, splitPackets } from "./tools/bilibili-open-live-bridge.mjs";

assert.equal(bodyMd5("hello"), "5d41402abc4b2a76b9719d911017c592");

const authBody = JSON.stringify({ roomid: 123, protover: 1 });
const packet = makePacket(7, authBody, 1);
const rows = splitPackets(new Uint8Array(packet));
assert.equal(rows.length, 1);
assert.equal(rows[0].operation, 7);
assert.equal(rows[0].version, 1);
assert.equal(parseJsonBody(rows[0]).roomid, 123);

const headers = signedHeaders('{"code":"abc","app_id":1}', "access-key", "access-secret", { nonce: "fixed-nonce", timestamp: "1700000000" });
const canonical = Object.entries(headers).filter(([key]) => key.startsWith("x-bili-")).sort(([a],[b]) => a.localeCompare(b)).map(([key,value]) => key + ":" + value).join("\n");
assert.equal(headers.Authorization, createHmac("sha256", "access-secret").update(canonical).digest("hex"));
assert.equal(headers["x-bili-signature-version"], "1.0");

assert.equal(normalizedTypeForCommand("LIVE_OPEN_PLATFORM_LIVE_START"), "live_start");
assert.equal(normalizedTypeForCommand("LIVE_OPEN_PLATFORM_LIVE_END"), "live_end");
assert.equal(normalizedTypeForCommand("LIVE_OPEN_PLATFORM_DM"), "");

console.log("verify-bilibili-open-live-bridge: ok");
