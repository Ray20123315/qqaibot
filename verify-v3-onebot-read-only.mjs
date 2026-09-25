import assert from "node:assert/strict";
import {
  oneBotReadOnlyActionAllowed,
  oneBotReadOnlyMode,
  wrapOneBotHubForReadOnly
} from "./src/onebot/read-only.js";

assert.equal(oneBotReadOnlyMode({ ONEBOT_READ_ONLY: "true" }), true);
assert.equal(oneBotReadOnlyMode({ ONEBOT_READ_ONLY: "false" }), false);
assert.equal(oneBotReadOnlyActionAllowed("get_login_info"), true);
assert.equal(oneBotReadOnlyActionAllowed("get_group_member_info"), true);
assert.equal(oneBotReadOnlyActionAllowed("send_private_msg"), false);
assert.equal(oneBotReadOnlyActionAllowed("set_group_ban"), false);
assert.equal(oneBotReadOnlyActionAllowed("delete_msg"), false);

const calls = [];
const stub = {
  async fetch(input, init) {
    calls.push({ input: String(input?.url || input), init });
    return new Response(JSON.stringify({ ok: true, data: { user_id: 12345678, nickname: "QQAI" } }), {
      headers: { "Content-Type": "application/json" }
    });
  }
};
const env = { ONEBOT_READ_ONLY: "true" };
const hub = wrapOneBotHubForReadOnly(env, stub);

const status = await hub.fetch("https://onebot-hub/status");
assert.equal(status.status, 200);
assert.equal(calls.length, 1);

const read = await hub.fetch("https://onebot-hub/rpc", {
  method: "POST",
  body: JSON.stringify({ action: "get_login_info", params: {} })
});
assert.equal(read.status, 200);
assert.equal(calls.length, 2);

for (const action of ["send_private_msg", "set_group_ban", "delete_msg"]) {
  const blocked = await hub.fetch("https://onebot-hub/rpc", {
    method: "POST",
    body: JSON.stringify({ action, params: {} })
  });
  assert.equal(blocked.status, 403);
  const body = await blocked.json();
  assert.equal(body.error, "ONEBOT_READ_ONLY_ACTION_BLOCKED");
}
assert.equal(calls.length, 2, "blocked actions must never reach the production OneBotHub stub");

const directWrite = await hub.fetch("https://onebot-hub/moderation/expiry", { method: "POST", body: "{}" });
assert.equal(directWrite.status, 403);
assert.equal(calls.length, 2, "non-RPC direct writes must be blocked");

console.log("verify-v3-onebot-read-only: ok");
