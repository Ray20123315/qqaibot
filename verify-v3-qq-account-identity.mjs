import assert from "node:assert/strict";
import fs from "node:fs";
import { normalizePortalAccountIdentity, resolvePortalAccountIdentity } from "./src/portal/account-identity.js";

const admin = normalizePortalAccountIdentity({ systemAdmin: true, username: "ops.root", role: "developer" });
assert.equal(admin.kind, "system_admin");
assert.equal(admin.qq, "");
assert.equal(admin.displayName, "ops.root");

const session = { qq: "12345678", groupId: "99887766", role: "admin" };
const calls = [];
const live = await resolvePortalAccountIdentity({}, session, {
  callOneBotAction: async payload => {
    calls.push(payload);
    if (payload.action === "get_group_member_info") return { user_id: 12345678, nickname: "昵称", card: "群名片", role: "admin" };
    throw new Error("unexpected action");
  }
});
assert.equal(live.qq, "12345678");
assert.equal(live.nickname, "昵称");
assert.equal(live.card, "群名片");
assert.equal(live.displayName, "群名片");
assert.equal(live.source, "onebot_group_member_info");
assert.equal(live.live, true);
assert.equal(calls[0].action, "get_group_member_info");

const stranger = await resolvePortalAccountIdentity({}, { qq: "22334455", role: "member" }, {
  callOneBotAction: async payload => {
    assert.equal(payload.action, "get_stranger_info");
    return { data: { user_id: "22334455", nickname: "陌生人昵称" } };
  }
});
assert.equal(stranger.qq, "22334455");
assert.equal(stranger.nickname, "陌生人昵称");
assert.equal(stranger.source, "onebot_stranger_info");

const source = fs.readFileSync("src/portal/runtime.js", "utf8");
assert.match(source, /account,\s*quota:/, "\/me must return normalized account data");
assert.match(source, /renderPortalIdentity\(window\.__qqaiPortalAccount,session\)/, "Portal identity widget must render account payload");
assert.doesNotMatch(source, /<b>QQ '\+esc\(session\.qq\)/, "legacy QQ-only identity rendering must be removed");

console.log("verify-v3-qq-account-identity: ok");
