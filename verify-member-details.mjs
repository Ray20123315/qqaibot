import assert from "node:assert/strict";
import fs from "node:fs";
import {
  SENSITIVE_KEY_RE,
  formatFullMemberDetailsReport,
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

const report = formatFullMemberDetailsReport({
  groupId: "808882936",
  targetId: "10002",
  identitySummary: { nickname: "测试成员", role: "member", sex: "unknown", age: 0, groupLevel: "12", qqLevel: 34 },
  operationalState: { muteLock: null, relationship: null, messageStats: { retainedRecordCount: 2, directInteractionCount: 1, imageMessageCount: 0 } },
  liveSources: { groupMemberInfo: { ok: true, value: { nickname: "raw-name" } }, strangerInfo: { ok: true, value: { uid: "raw-uid" } }, honors: { ok: true, rows: [] } },
  storedSources: { snapshot: { rawFields: ["nickname"] }, profile: null, cachedMember: { qq: "10002" } },
  disclosure: { includes: "仅显示整理后的资料。", excludes: "原始结构化资料不回传。" }
});
assert.match(report, /【资料来源状态】/);
assert.match(report, /OneBot 群成员：已取得/);
assert.doesNotMatch(report, /OneBot 即时原始资料|D1 已保存完整资料|raw-name|raw-uid|rawFields|\{\s*"/);

const workerSource = fs.readFileSync("worker.js", "utf8");
assert.match(workerSource, /fullMemberDetailsMatch/, "member_full_details command integration must exist");
assert.match(workerSource, /reply_kind: "member_full_details"/);
const helpSource = fs.readFileSync("src/help/commands.js", "utf8");
assert.match(workerSource + "\n" + helpSource, /!详细资料 \[@成员\]/, "help must document the privileged full-detail command");
assert.match(workerSource, /permissions: permissionSet/);
assert.match(workerSource, /if \(result\.ok\) return new Response\(null, \{ status: 204 \}\);/, "!撤回 success must stay silent");
assert.doesNotMatch(workerSource, /已尝试撤回该消息。/, "!撤回 must not emit a success notification");

console.log("verify-member-details: ok");
