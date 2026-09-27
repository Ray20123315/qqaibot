import assert from "node:assert/strict";
import { buildConnectivityReply, createQqOpenActionDispatcher, createQqOpenApiClient, createGatewayState, createHeartbeatPayload, createIdentifyPayload, createResumePayload, fromQqOpenEvent, qqOpenIntents, qqOpenReconnectDelay, reduceGatewayPayload } from "./src/v4/index.js";
import { createInitialCommandRegistry } from "./src/v4/commands/catalog.js";

const group = fromQqOpenEvent({ t:"GROUP_MESSAGE_CREATE", s:42, d:{ id:"msg-1", group_openid:"group-A", timestamp:"2026-09-27T08:00:00Z", content:" hello ", author:{ member_openid:"member-A", member_role:"admin", username:"Ray" }, attachments:[{content_type:"image/png",url:"https://example.com/a.png",filename:"a.png"}] } });
assert.equal(group.platform, "qq-open");
assert.equal(group.scope, "group");
assert.equal(group.groupId, "group-A");
assert.equal(group.userId, "member-A");
assert.equal(group.senderRole, "admin");
assert.deepEqual(group.parts.map(x=>x.kind), ["text","image"]);
assert.match(group.text, /\[图片\]/);

const c2c = fromQqOpenEvent({ t:"C2C_MESSAGE_CREATE", d:{ id:"c2c-1", content:"hi", author:{ user_openid:"user-A" } } });
assert.equal(c2c.scope, "private");
assert.equal(c2c.userId, "user-A");
assert.equal(fromQqOpenEvent({ t:"FRIEND_ADD", d:{} }), null);

const identify = createIdentifyPayload({ accessToken:"abc", intents:1 << 25 });
assert.equal(identify.d.token, "QQBot abc");
assert.deepEqual(identify.d.shard, [0,1]);
assert.deepEqual(createHeartbeatPayload(42), { op:1, d:42 });
assert.equal(createResumePayload({ accessToken:"abc", sessionId:"s1", seq:42 }).op, 6);
let gateway = createGatewayState();
gateway = reduceGatewayPayload(gateway, { op:10, d:{heartbeat_interval:45000} });
assert.equal(gateway.heartbeatInterval, 45000);
gateway = reduceGatewayPayload(gateway, { op:0, s:1, t:"READY", d:{session_id:"session-1"} });
assert.equal(gateway.ready, true);
assert.equal(gateway.resumeEligible, true);
gateway = reduceGatewayPayload(gateway, { op:11 }, 1234);
assert.equal(gateway.lastAckAt, 1234);

const requests = [];
let tokenCalls = 0;
const fakeFetch = async (url, options={}) => {
  requests.push({url:String(url), options});
  if (String(url).endsWith("/app/getAppAccessToken")) { tokenCalls += 1; return new Response(JSON.stringify({access_token:"token-1",expires_in:"7200"}), {status:200}); }
  return new Response(JSON.stringify({ok:true}), {status:200});
};
const api = createQqOpenApiClient({ appId:"1905687174", clientSecret:"secret", fetchImpl:fakeFetch, now:()=>1000 });
await api.getMenu();
await api.sendGroupMessage("group/A", { content:"hello", msg_type:0 });
await api.deleteGroupMessage("group/A", "m/1", { hideTip:true });
await api.uploadGroupFile("group/A", { file_type:1, url:"https://example.com/a.png", srv_send_msg:false });
await api.uploadC2CFile("user/A", { file_type:2, url:"https://example.com/a.mp4", srv_send_msg:false });
await api.getGroupMembers("group/A", { cursor:"next/1", limit:20 });
await api.getGroupMember("group/A", "member/A");
await api.removeGroupMembers("group/A", { member_openids:["member/A"], add_to_member_blacklist:true });
await api.getGroupBlacklist("group/A", { limit:20 });
await api.updateGroupBlacklist("group/A", { op:"add", member_openids:["member/A"] });
await api.getGroupJoinRequests("group/A", { limit:20 });
await api.reviewGroupJoinRequest("group/A", "member/A", { op:"approve", join_request_id:"req-1" });
await api.getGroupMuteSetting("group/A");
await api.setGroupMuteSetting("group/A", { mutes:[{ op:"add", member_openid:"member/A", mute_expire_at:"2026-09-28T00:00:00+08:00" }] });
assert.equal(tokenCalls, 1, "token should be cached");
assert.equal(requests[1].options.headers.Authorization, "QQBot token-1");
assert.match(requests[2].url, /\/v2\/groups\/group%2FA\/messages$/);
assert.match(requests[3].url, /group%2FA\/messages\/m%2F1\?hidetip=true$/);
assert(requests.some(x => /\/v2\/groups\/group%2FA\/files$/.test(x.url) && x.options.method === "POST"));
assert(requests.some(x => /\/v2\/users\/user%2FA\/files$/.test(x.url) && x.options.method === "POST"));
assert(requests.some(x => /\/v2\/groups\/group%2FA\/members\?cursor=next%2F1&limit=20$/.test(x.url)));
assert(requests.some(x => /\/v2\/groups\/group%2FA\/members\/member%2FA$/.test(x.url)));
assert(requests.some(x => /\/v2\/groups\/group%2FA\/batch_remove_members$/.test(x.url) && x.options.method === "POST"));
assert(requests.some(x => /\/v2\/groups\/group%2FA\/member_blacklist/.test(x.url)));
assert(requests.some(x => /\/v2\/groups\/group%2FA\/join_request_list/.test(x.url)));
assert(requests.some(x => /\/v2\/groups\/group%2FA\/approval_join_request\/member%2FA$/.test(x.url)));
assert(requests.some(x => /\/v2\/groups\/group%2FA\/restrict_chat_setting$/.test(x.url)));

const registry = createInitialCommandRegistry();
assert(registry.size >= 20);
assert.equal(registry.resolve("!禁言 @123 10分钟").id, "group.mute");
const groupPanel = registry.buildPanel("group");
assert(groupPanel.panel.items.length <= 20);
assert(groupPanel.panel.items.some(item => item.name === "!禁言" && item.only_admin === true));
const groupPanels = registry.buildPanels("group", { maxItemsPerPanel: 7 });
assert(groupPanels.length >= 2);
assert(groupPanels.every(panel => panel.panel.items.length <= 7));
assert(groupPanels.flatMap(panel => panel.panel.items).some(item => item.name === "!禁言" && item.only_admin === true));
const menu = registry.buildMenu();
assert(menu.items.length <= 10);
assert(menu.items.some(item => item.send_message === "!codex"));

const replyCalls = [];
const replyDispatcher = createQqOpenActionDispatcher({
  api: {
    sendGroupMessage: async (groupOpenid, body) => { replyCalls.push({ kind:"group", groupOpenid, body }); return { id:"reply-group" }; },
    sendC2CMessage: async (openid, body) => { replyCalls.push({ kind:"c2c", openid, body }); return { id:"reply-c2c" }; }
  }
});
await replyDispatcher.dispatch("message.reply", { message: group, content: "pong" });
await replyDispatcher.dispatch("message.reply", { message: c2c, content: "pong2" });
assert.deepEqual(replyCalls[0], { kind:"group", groupOpenid:"group-A", body:{ content:"pong", msg_type:0, msg_seq:1, msg_id:"msg-1" } });
assert.deepEqual(replyCalls[1], { kind:"c2c", openid:"user-A", body:{ content:"pong2", msg_type:0, msg_seq:1, msg_id:"c2c-1" } });

const pingMessage = fromQqOpenEvent({ t:"C2C_MESSAGE_CREATE", d:{ id:"p1", content:"!qqping", author:{ user_openid:"u1" } } });
const echoMessage = fromQqOpenEvent({ t:"GROUP_AT_MESSAGE_CREATE", d:{ id:"p2", group_openid:"g1", content:"<@!123> !qqecho hello", author:{ member_openid:"u2" } } });
assert.equal(buildConnectivityReply(pingMessage), "QQ Open V4 已连接并可回话。");
assert.equal(buildConnectivityReply(echoMessage), "QQ Open V4 echo：hello");
assert.equal(qqOpenIntents({}), 1 << 25);
assert.equal(qqOpenIntents({ QQ_OPEN_INTENTS:String(1 << 25) }), 1 << 25);
assert.throws(() => qqOpenIntents({ QQ_OPEN_INTENTS:"bad" }), /QQ_OPEN_INVALID_INTENTS/);
assert.equal(qqOpenReconnectDelay(0), 5000);
assert.equal(qqOpenReconnectDelay(1), 5000);
assert.equal(qqOpenReconnectDelay(2), 10000);
assert.equal(qqOpenReconnectDelay(3), 20000);
assert.equal(qqOpenReconnectDelay(4), 40000);
assert.equal(qqOpenReconnectDelay(5), 60000);

console.log("verify-v4-qqopen connectivity action dispatcher: ok");
console.log("verify-v4-qqopen: ok");
