import assert from "node:assert/strict";
import { buildConnectivityReply, createQqOpenActionDispatcher, createQqOpenApiClient, createGatewayState, createHeartbeatPayload, createIdentifyPayload, createResumePayload, fromQqOpenEvent, qqOpenClosePolicy, qqOpenDeliveryKey, qqOpenDeliverySequence, qqOpenIntents, qqOpenPassiveReplyPolicy, qqOpenReconnectDelay, qqOpenShard, reduceGatewayPayload, syncQqOpenDiscovery } from "./src/v4/index.js";
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
await api.deleteC2CMessage("user/A", "cm/1");
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
await api.putMenu({ items:[{ name:"帮助", type:"send_message", send_message:"!help" }] });
await api.listPanels({ scope:"c2c", limit:20 });
await api.updatePanel("panel/A", { items:[{ type:"command", name:"!help" }] });
assert.equal(tokenCalls, 1, "token should be cached");
assert.equal(requests[1].options.headers.Authorization, "QQBot token-1");
assert.match(requests[2].url, /\/v2\/groups\/group%2FA\/messages$/);
assert.match(requests[3].url, /group%2FA\/messages\/m%2F1\?hidetip=true$/);
assert(requests.some(x => /\/v2\/users\/user%2FA\/messages\/cm%2F1$/.test(x.url) && x.options.method === "DELETE"));
assert(requests.some(x => /\/v2\/groups\/group%2FA\/files$/.test(x.url) && x.options.method === "POST"));
assert(requests.some(x => /\/v2\/users\/user%2FA\/files$/.test(x.url) && x.options.method === "POST"));
assert(requests.some(x => /\/v2\/groups\/group%2FA\/members\?cursor=next%2F1&limit=20$/.test(x.url)));
assert(requests.some(x => /\/v2\/groups\/group%2FA\/members\/member%2FA$/.test(x.url)));
assert(requests.some(x => /\/v2\/groups\/group%2FA\/batch_remove_members$/.test(x.url) && x.options.method === "POST"));
assert(requests.some(x => /\/v2\/groups\/group%2FA\/member_blacklist/.test(x.url)));
assert(requests.some(x => /\/v2\/groups\/group%2FA\/join_request_list/.test(x.url)));
assert(requests.some(x => /\/v2\/groups\/group%2FA\/approval_join_request\/member%2FA$/.test(x.url)));
assert(requests.some(x => /\/v2\/groups\/group%2FA\/restrict_chat_setting$/.test(x.url)));
const menuPut = requests.find(x => /\/v2\/menu$/.test(x.url) && x.options.method === "PUT");
assert.deepEqual(JSON.parse(menuPut.options.body), { menu:{ items:[{ name:"帮助", type:"send_message", send_message:"!help" }] } });
assert(requests.some(x => /\/v2\/panels\?scope=c2c&limit=20$/.test(x.url) && x.options.method === "GET"));
const panelPut = requests.find(x => /\/v2\/panels\/panel%2FA$/.test(x.url) && x.options.method === "PUT");
assert.deepEqual(JSON.parse(panelPut.options.body), { panel:{ items:[{ type:"command", name:"!help" }] } });

const registry = createInitialCommandRegistry();
assert(registry.size >= 77);
assert.equal(registry.resolve("!禁言 @123 10分钟").id, "group.mute");
assert.equal(registry.resolve("!QQ语音角色").id, "qq.voice_roles");
assert.equal(registry.resolve("!QQ语音 角色 测试").id, "qq.voice_reply");
assert.equal(registry.resolve("!codexchat 测试").id, "ai.codexchat");
assert.equal(registry.resolve("!codexwork --export 测试").id, "ai.codexwork");

const groupPanel = registry.buildPanel("group");
assert(groupPanel.panel.items.length <= 20);
assert(groupPanel.panel.items.some(item => item.name === "!禁言" && item.only_admin === true));

const groupPanels = registry.buildPanels("group", { maxItemsPerPanel: 7 });
assert(groupPanels.length >= 2);
assert(groupPanels.every(panel => panel.panel.items.length <= 7));
assert(groupPanels.flatMap(panel => panel.panel.items).some(item => item.name === "!禁言" && item.only_admin === true));

const categorizedGroupPanels = registry.buildCategorizedPanels("group");
assert(categorizedGroupPanels.length <= 8);
assert(categorizedGroupPanels.every(panel => panel.panel.items.length <= 20));
assert(categorizedGroupPanels.some(panel => /\[基础与多模态\]/.test(panel.panel.remark)));
assert(categorizedGroupPanels.some(panel => /\[AI 管理\]/.test(panel.panel.remark)));
assert(categorizedGroupPanels.some(panel => /\[群操作\]/.test(panel.panel.remark)));
assert(categorizedGroupPanels.some(panel => /\[活动投票与排程\]/.test(panel.panel.remark)));
assert(categorizedGroupPanels.flatMap(panel => panel.panel.items).some(item => item.name === "!禁言" && item.only_admin === true));
assert(!categorizedGroupPanels.flatMap(panel => panel.panel.items).some(item => item.name === "!codexchat"));

const developerPanels = registry.buildCategorizedPanels("c2c", {
  permissions:["developer"],
  targetType:"specific",
  userOpenids:["dev-openid"]
});
assert.equal(developerPanels.length, 2);
assert(developerPanels.every(panel => JSON.stringify(panel.user_openids) === JSON.stringify(["dev-openid"])));
const developerPanelItems = developerPanels.flatMap(panel => panel.panel.items);
assert(developerPanelItems.some(item => item.name === "!codexchat"));
assert(developerPanelItems.some(item => item.name === "!codexwork"));
assert(developerPanelItems.some(item => item.name === "!群白名单"));
assert(developerPanelItems.some(item => item.name === "!重置"));

const menu = registry.buildMenu();
assert(menu.items.length <= 10);
assert(menu.items.every(item => item.type === "menu"));
assert(menu.items.every(item => item.sub_menu_items.length <= 5));
const menuCommands = new Set(menu.items.flatMap(item => item.sub_menu_items).map(item => item.send_message).filter(Boolean));
assert(menuCommands.has("!codex"));
assert(menuCommands.has("!翻译"));
assert(menuCommands.has("!QQ语音角色"));
assert(menuCommands.has("!QQ语音"));
for (const command of registry.list({ scope:"c2c" }).filter(command => command.permission === "member" && command.menu.enabled && command.panel.enabled)) {
  assert(menuCommands.has(command.menu.value), `C2C menu missing ${command.id}`);
}

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


const duplicatePayload = {
  t: "C2C_MESSAGE_CREATE",
  d: {
    id: "dup-msg",
    content: "",
    author: { user_openid: "openid-user" },
    message_scene: { ext: ["msg_idx=7", "trace=x"] },
    attachments: [{
      content_type: "audio",
      url: "https://example.com/original.amr",
      voice_wav_url: "https://example.com/voice.wav",
      asr_refer_text: "语音转写"
    }],
    msg_elements: [{
      content: "被引用的消息",
      author: { user_openid: "quoted-openid", username: "Quoted" }
    }],
    ark_data: { ark_type: "demo", ark_name: "卡片", prompt: "提示", fields: { title: "标题" } }
  }
};
const duplicateMessage = fromQqOpenEvent(duplicatePayload);
assert.equal(qqOpenDeliverySequence(duplicatePayload), "7");
assert.equal(qqOpenDeliveryKey(duplicatePayload, duplicateMessage), "C2C_MESSAGE_CREATE|dup-msg|7");
assert(duplicateMessage.parts.some(part => part.kind === "audio" && part.media.url === "https://example.com/voice.wav"));
assert(duplicateMessage.parts.some(part => part.kind === "text" && /语音转写参考.*语音转写/.test(part.text)));
assert(duplicateMessage.parts.some(part => part.kind === "text" && /引用 Quoted.*被引用的消息/.test(part.text)));
assert.equal(qqOpenDeliverySequence({ t:"C2C_MESSAGE_CREATE", d:{ id:"x", msg_seq:3 } }), "3");

assert.deepEqual(qqOpenPassiveReplyPolicy("group"), { maxReplies:5, ttlMs:300000 });
assert.deepEqual(qqOpenPassiveReplyPolicy("private"), { maxReplies:4, ttlMs:3600000 });
assert.deepEqual(qqOpenShard({}), [0,1]);
assert.deepEqual(qqOpenShard({ QQ_OPEN_SHARD_ID:"1", QQ_OPEN_SHARD_TOTAL:"3" }), [1,3]);
assert.throws(() => qqOpenShard({ QQ_OPEN_SHARD_ID:"3", QQ_OPEN_SHARD_TOTAL:"3" }), /QQ_OPEN_INVALID_SHARD/);

assert.equal(qqOpenClosePolicy(4006).mode, "identify");
assert.equal(qqOpenClosePolicy(4007).preserveSession, false);
assert.equal(qqOpenClosePolicy(4009).mode, "resume");
assert.equal(qqOpenClosePolicy(4009).preserveSession, true);
assert.equal(qqOpenClosePolicy(4014).retry, false);
assert.equal(qqOpenClosePolicy(4914).suspend, true);
assert.equal(qqOpenClosePolicy(4915).retry, false);
assert.equal(qqOpenClosePolicy(4901).mode, "identify");

const qqidPrivate = fromQqOpenEvent({ t:"C2C_MESSAGE_CREATE", d:{ id:"qid1", content:"!qqid", author:{ user_openid:"my-open-id" } } });
const qqidGroup = fromQqOpenEvent({ t:"GROUP_AT_MESSAGE_CREATE", d:{ id:"qid2", group_openid:"g", content:"<@!bot> !qqid", author:{ member_openid:"my-open-id" } } });
assert.equal(buildConnectivityReply(qqidPrivate), "你的 QQ OpenID：my-open-id");
assert.match(buildConnectivityReply(qqidGroup), /私聊机器人发送 !qqid/);

const discoveryCalls = [];
const discoveryApi = {
  putMenu: async menu => { discoveryCalls.push(["putMenu", menu]); return { ok:true }; },
  listPanels: async ({scope,cursor,limit}) => {
    discoveryCalls.push(["listPanels", scope, cursor, limit]);
    return {
      records: scope === "group"
        ? [{ panel_id:"old-v4", panel:{ remark:"QQAIBOT V4 GROUP 1" } }, { panel_id:"foreign", panel:{ remark:"OTHER BOT" } }]
        : [{ panel_id:"old-c2c", panel:{ remark:"QQAIBOT V4 C2C 1" } }],
      next_cursor:"",
      is_end:true
    };
  },
  deletePanel: async id => { discoveryCalls.push(["deletePanel", id]); return { ok:true }; },
  createPanel: async panel => { discoveryCalls.push(["createPanel", panel.scope, panel]); return { id:"new-" + discoveryCalls.length }; }
};
const firstDiscovery = await syncQqOpenDiscovery(discoveryApi, registry, { developerOpenids:["dev-openid"] });
assert.equal(firstDiscovery.ok, true);
assert.equal(firstDiscovery.changed, true);
assert(discoveryCalls.some(row => row[0] === "putMenu"));
assert(discoveryCalls.some(row => row[0] === "deletePanel" && row[1] === "old-v4"));
assert(discoveryCalls.some(row => row[0] === "deletePanel" && row[1] === "old-c2c"));
assert(!discoveryCalls.some(row => row[0] === "deletePanel" && row[1] === "foreign"));
assert(discoveryCalls.some(row => row[0] === "listPanels" && row[1] === "c2c"));
assert(discoveryCalls.some(row => row[0] === "listPanels" && row[1] === "group"));
assert(firstDiscovery.panels <= 10);
assert(firstDiscovery.categories.includes("basic"));
assert(firstDiscovery.categories.includes("group-ops"));
assert(firstDiscovery.categories.includes("ai-admin"));
assert(firstDiscovery.categories.includes("developer"));
assert(discoveryCalls.some(row => row[0] === "createPanel" && row[2]?.target_type === "specific" && row[2]?.user_openids?.includes("dev-openid")));
const syncedMenu = discoveryCalls.find(row => row[0] === "putMenu")?.[1];
assert(syncedMenu.items.every(item => item.type === "menu" && item.sub_menu_items?.length <= 5));
const callCountAfterFirst = discoveryCalls.length;
const secondDiscovery = await syncQqOpenDiscovery(discoveryApi, registry, { previousFingerprint:firstDiscovery.fingerprint, developerOpenids:["dev-openid"] });
assert.equal(secondDiscovery.changed, false);
assert.equal(discoveryCalls.length, callCountAfterFirst);

console.log("verify-v4-qqopen connectivity action dispatcher: ok");
console.log("verify-v4-qqopen: ok");
