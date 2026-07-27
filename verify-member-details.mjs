import assert from "node:assert/strict";
import fs from "node:fs";
import {
  SENSITIVE_KEY_RE,
  memberDetailAllowed,
  sanitizeMemberDetailValue
} from "./src/members/details.js";

const env = { DEVELOPER_ID: "90001" };

assert.equal(memberDetailAllowed(env, { actorId: "10001", targetId: "10001", actorRole: "member", permissions: {} }), true, "members may inspect their own full details");
assert.equal(memberDetailAllowed(env, { actorId: "10001", targetId: "10002", actorRole: "member", permissions: {} }), false, "ordinary members may not inspect another member's hidden details");
assert.equal(memberDetailAllowed(env, { actorId: "10001", targetId: "10002", actorRole: "admin", permissions: {} }), true, "QQ admins may inspect a member for group management");
assert.equal(memberDetailAllowed(env, { actorId: "10001", targetId: "10002", actorRole: "owner", permissions: {} }), true, "group owners may inspect a member");
assert.equal(memberDetailAllowed(env, { actorId: "10001", targetId: "10002", actorRole: "member", permissions: { groupOps: true } }), true, "delegated group operations permission grants access");
assert.equal(memberDetailAllowed(env, { actorId: "90001", targetId: "10002", actorRole: "member", permissions: {} }), true, "configured developer may inspect a member");

const raw = {
  nickname: "测试成员",
  access_token: "do-not-leak",
  cookie: "sid=secret",
  nested: {
    password: "password-value",
    harmless: "visible",
    privateKey: "key-value",
    SessionId: "session-value"
  },
  array: [{ authorization: "Bearer token" }, { area: "Taipei" }]
};
const sanitized = sanitizeMemberDetailValue(raw);
assert.equal(sanitized.nickname, "测试成员");
assert.equal(sanitized.access_token, "[已遮罩]");
assert.equal(sanitized.cookie, "[已遮罩]");
assert.equal(sanitized.nested.password, "[已遮罩]");
assert.equal(sanitized.nested.privateKey, "[已遮罩]");
assert.equal(sanitized.nested.SessionId, "[已遮罩]");
assert.equal(sanitized.nested.harmless, "visible");
assert.equal(sanitized.array[0].authorization, "[已遮罩]");
assert.equal(sanitized.array[1].area, "Taipei");
assert.equal(SENSITIVE_KEY_RE.test("refresh_token"), true);
assert.equal(SENSITIVE_KEY_RE.test("nickname"), false);

const workerSource = fs.readFileSync("worker.js", "utf8");
assert.match(workerSource, /fullMemberDetailsMatch/, "member_full_details command integration must exist");
assert.match(workerSource, /reply_kind: "member_full_details"/);
assert.match(workerSource, /!详细资料 \[@成员\]/, "help must document the privileged full-detail command");
assert.match(workerSource, /permissions: permissionSet/);

console.log("verify-member-details: ok");
