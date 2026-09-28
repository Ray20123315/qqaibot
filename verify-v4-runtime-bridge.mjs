import assert from "node:assert/strict";
import fs from "node:fs";
import { createCanonicalMessage } from "./src/v3/message/core.js";
import {
  countQqOpenLegacyMessages,
  legacyMessageParts,
  qqOpenJoinRequestToLegacyBody,
  qqOpenLegacyAction,
  qqOpenMessageToLegacyBody,
  sendQqOpenLegacyMessage
} from "./src/v4/qqopen/legacy-bridge.js";

const group = createCanonicalMessage({
  platform: "qq-open",
  messageId: "m-open-1",
  scope: "group",
  groupId: "group-open-A",
  userId: "member-open-B",
  senderRole: "admin",
  senderName: "Tester",
  time: 123
}, [
  { kind: "text", text: "<@!bot-open-Z> 你好" },
  { kind: "image", media: { fileId: "img-1", url: "https://example.com/a.jpg", name: "a.jpg", mimeType: "image/jpeg" } }
]);

const body = qqOpenMessageToLegacyBody(group, { t: "GROUP_AT_MESSAGE_CREATE", d: {} }, { botUserId: "bot-open-Z" });
assert.equal(body.__qqai_platform, "qq-open");
assert.equal(body.__qqai_explicit_question, true);
assert.equal(body.group_id, "group-open-A");
assert.equal(body.user_id, "member-open-B");
assert.equal(body.self_id, "bot-open-Z");
assert.equal(body.sender.role, "admin");
assert(body.message.some(part => part.type === "image" && part.data.url === "https://example.com/a.jpg"));
assert(body.message.some(part => part.type === "text" && part.data.text === "你好"));

const join = qqOpenJoinRequestToLegacyBody({
  t: "GROUP_JOIN_REQUEST",
  d: { group_openid: "g-open", member_openid: "u-open", join_request_id: "jr-open", comment: "hi" }
}, { botUserId: "bot-open" });
assert.equal(join.post_type, "request");
assert.equal(join.flag, "jr-open");
assert.equal(join.user_id, "u-open");

const calls = [];
const api = {
  sendGroupMessage: async (id, payload) => { calls.push(["sendGroupMessage", id, payload]); return { id: "sent-g" }; },
  sendC2CMessage: async (id, payload) => { calls.push(["sendC2CMessage", id, payload]); return { id: "sent-c" }; },
  uploadGroupFile: async (id, payload) => { calls.push(["uploadGroupFile", id, payload]); return { file_info: "fi-g" }; },
  uploadC2CFile: async (id, payload) => { calls.push(["uploadC2CFile", id, payload]); return { file_info: "fi-c" }; },
  deleteGroupMessage: async (groupId, messageId) => { calls.push(["deleteGroupMessage", groupId, messageId]); return { ok: true }; },
  deleteC2CMessage: async (userId, messageId) => { calls.push(["deleteC2CMessage", userId, messageId]); return { ok: true }; },
  getGroupInfo: async id => ({ group_openid: id, name: "G" }),
  getGroupMember: async (groupId, userId) => ({ member_openid: userId, member_name: "M", role: "admin" }),
  getGroupMembers: async () => ({ members: [{ member_openid: "u1", member_name: "M1", role: "member" }] }),
  setGroupMuteSetting: async (groupId, payload) => { calls.push(["mute", groupId, payload]); return { ok: true }; },
  removeGroupMembers: async (groupId, payload) => { calls.push(["remove", groupId, payload]); return { ok: true }; },
  reviewGroupJoinRequest: async (groupId, userId, payload) => { calls.push(["join", groupId, userId, payload]); return { ok: true }; }
};

const sent = await sendQqOpenLegacyMessage(
  api,
  { scope: "group", groupId: "g1", userId: "u1", messageId: "origin" },
  "[CQ:at,qq=u2] hello [CQ:image,url=https://example.com/x.png]",
  { replyMessageId: "origin" }
);
assert.equal(sent.ok, true);
assert(calls.some(row => row[0] === "sendGroupMessage" && String(row[2].content || "").includes("<@u2>")));
assert(calls.some(row => row[0] === "uploadGroupFile" && row[2].file_type === 1));
assert(calls.some(row => row[0] === "sendGroupMessage" && row[2].msg_type === 7 && row[2].content === " "));

await qqOpenLegacyAction(api, "set_group_ban", { group_id: "g1", user_id: "u2", duration: 60 }, {});
assert(calls.some(row => row[0] === "mute" && row[2].mutes[0].member_openid === "u2"));

await qqOpenLegacyAction(api, "set_group_kick", { group_id: "g1", user_id: "u2", reject_add_request: true }, {});
assert(calls.some(row => row[0] === "remove" && row[2].add_to_member_blacklist === true));

await qqOpenLegacyAction(api, "set_group_add_request", { flag: "jr1", approve: false, reason: "no" }, {}, {
  getCachedJoinRequest: id => id === "jr1" ? { flag: "jr1", group_id: "g1", user_id: "u2" } : null
});
assert(calls.some(row => row[0] === "join" && row[3].op === "decline"));


assert.equal(countQqOpenLegacyMessages("hello"), 1);
assert.equal(countQqOpenLegacyMessages("hello[CQ:image,url=https://example.com/x.png]"), 2);

const reservations = [];
await qqOpenLegacyAction(api, "send_private_msg", { user_id:"u-private", message:"one[CQ:image,url=https://example.com/x.png]" }, {
  scope:"private", userId:"u-private", messageId:"origin-private"
}, {
  reserveReplySequences: async (messageId, scope, count) => {
    reservations.push({ messageId, scope, count });
    return { start:3, count };
  }
});
assert.deepEqual(reservations[0], { messageId:"origin-private", scope:"private", count:2 });
assert(calls.some(row => row[0] === "sendC2CMessage" && row[2].msg_seq === 3));
assert(calls.some(row => row[0] === "sendC2CMessage" && row[2].msg_type === 7 && row[2].msg_seq === 4));

await qqOpenLegacyAction(api, "delete_msg", { message_id:"private-sent" }, {
  scope:"private", userId:"u-private", messageId:"origin-private"
}, { getCachedMessage: () => null });
assert(calls.some(row => row[0] === "deleteC2CMessage" && row[1] === "u-private" && row[2] === "private-sent"));

assert.deepEqual(legacyMessageParts("a[CQ:at,qq=u2]b").map(item => item.type), ["text", "at", "text"]);
await assert.rejects(
  () => qqOpenLegacyAction(api, "set_group_name", { group_id: "g1", group_name: "x" }, {}),
  /QQ_OPEN_LEGACY_ACTION_UNSUPPORTED/
);

const worker = fs.readFileSync("worker.js", "utf8");
const runtime = fs.readFileSync("src/v4/qqopen/runtime.js", "utf8");
const hostAdapter = fs.readFileSync("src/v3/host/adapter.js", "utf8");
assert.match(hostAdapter, /reply_to_message_id/);
assert.match(hostAdapter, /replyToSource: true/);

const permissions = fs.readFileSync("src/core/permissions.js", "utf8");
const deployment = fs.readFileSync("src/config/deployment.js", "utf8");
const network = fs.readFileSync("src/security/network.js", "utf8");

assert.match(worker, /qqopen-do/);
assert.match(worker, /\/v4\/qqopen\/process/);
assert.match(worker, /QQAI_EVENT_PLATFORM = "qq-open"/);
assert.match(worker, /qqOpenPluginEnvironment\(\)/);
assert.match(worker, /v3_plugin_qqopen_event_failed/);
assert.match(worker, /dispatchV3RuntimeEvent\(pluginEnv, pluginBody\)/);
assert.match(worker, /body\.__qqai_principal_id \|\| userId/);
assert.match(worker, /qqOpenIngress \? true : await getFeatureFlag\(env, 'private_chat_enabled'/);
assert.match(runtime, /sendApplicationReplies/);
assert(!runtime.includes("reply_plan?.mentionIds"), "QQ Open runtime must not inject raw OpenID mentions into AI replies");
assert.match(runtime, /replyMessageId: message\.messageId/);
assert.match(runtime, /qqOpenLegacyAction/);
assert.match(runtime, /lastInboundUserId/);
assert.match(runtime, /group_join_request/);
assert.match(runtime, /qqOpenDeliveryKey/);
assert.match(runtime, /reserveReplySequences/);
assert.match(runtime, /QQ_OPEN_PASSIVE_REPLY_LIMIT/);
assert.match(runtime, /qqOpenClosePolicy/);
assert.match(runtime, /syncQqOpenDiscovery/);
assert.match(runtime, /api\.getGatewayBot/);
assert.match(runtime, /QQ_OPEN_DISCOVERY_SYNC/);
assert.match(permissions, /QQ_OPEN_GATEWAY_NOT_BOUND/);
assert.match(permissions, /api\/v4\/qqopen\/legacy-action/);
assert.match(deployment, /QQ_OPEN_DEVELOPER_OPENIDS/);
assert.match(network, /QQAI_QQOPEN_GROUP_ID/);

console.log("verify-v4-runtime-bridge: ok");
