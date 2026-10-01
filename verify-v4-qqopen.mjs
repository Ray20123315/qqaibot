import assert from "node:assert/strict";
import fs from "node:fs";
import { buildConnectivityReply, createQqOpenActionDispatcher, createQqOpenApiClient, createGatewayState, createHeartbeatPayload, createIdentifyPayload, createResumePayload, fromQqOpenEvent, qqOpenClosePolicy, qqOpenDeliveryKey, qqOpenDeliverySequence, qqOpenIntents, qqOpenPassiveReplyPolicy, qqOpenReconnectDelay, qqOpenShard, reduceGatewayPayload, syncQqOpenDiscovery } from "./src/v4/index.js";
import { createInitialCommandRegistry } from "./src/v4/commands/catalog.js";
import { GROUP_PANEL_CATEGORY_META, assertGroupPanelCoverage, buildGroupCategoryKeyboard, buildGroupRootPanel, normalizeGroupPanelSlashInvocation, resolveGroupPanelInput } from "./src/v4/commands/group-panel.js";

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
assert.equal(registry.resolve("!你记住了什么").id, "memory.list");
assert.equal(registry.resolve("!活动通知 act_1").id, "event.notify");
assert.equal(registry.resolve("!指令开").id, "commands.on");
assert.equal(registry.resolve("!指令关").id, "commands.off");
assert.equal(registry.resolve("!确认op").id, "group.confirm");
assert.equal(registry.resolve("!取消op").id, "group.cancel");
assert.equal(registry.get("ai.codexchat").discoveryCategory, "developer");
assert.equal(registry.get("ai.codexwork").discoveryCategory, "developer");

const groupPanel = registry.buildPanel("group");
assert(groupPanel.panel.items.length <= 20);
assert(groupPanel.panel.items.some(item => item.name === "!禁言" && item.only_admin === true));

const groupPanels = registry.buildPanels("group", { maxItemsPerPanel: 7 });
assert(groupPanels.length >= 2);
assert(groupPanels.every(panel => panel.panel.items.length <= 7));
assert(groupPanels.flatMap(panel => panel.panel.items).some(item => item.name === "!禁言" && item.only_admin === true));

const allPermissions = ["member", "group_ops", "ai_admin", "owner", "developer"];
assert.equal(assertGroupPanelCoverage(registry), true);
const groupRootPanel = buildGroupRootPanel(registry);
assert.equal(groupRootPanel.scope, "group");
assert.equal(groupRootPanel.target_type, "all");
assert(groupRootPanel.panel.items.length > 0 && groupRootPanel.panel.items.length <= 20);
const groupRootNames = new Set(groupRootPanel.panel.items.map(item => item.name));
for (const name of ["!面板 基础","!面板 群聊","!面板 记忆","!面板 活动","!面板 群规","!面板 AI管理","!面板 群操作","!面板 群主","!面板 开发者"]) {
  assert(groupRootNames.has(name), `Group root panel missing ${name}`);
}
assert.equal(resolveGroupPanelInput("!面板 基础 help", registry)?.expanded, "!help");
assert.equal(resolveGroupPanelInput("！面板 群操作 禁言 @123456 10分钟", registry)?.expanded, "!禁言 @123456 10分钟");
assert.deepEqual(normalizeGroupPanelSlashInvocation("/!面板 基础"), { matched:true, text:"!面板 基础" });
assert.deepEqual(normalizeGroupPanelSlashInvocation("／！面板 开发者 codexwork --export 测试"), { matched:true, text:"！面板 开发者 codexwork --export 测试" });
assert.deepEqual(normalizeGroupPanelSlashInvocation("[CQ:at,qq=123] /!面板 群操作 禁言"), { matched:true, text:"[CQ:at,qq=123] !面板 群操作 禁言" });
assert.deepEqual(normalizeGroupPanelSlashInvocation("/!普通内容"), { matched:false, text:"/!普通内容" });
const workerSource = fs.readFileSync("worker.js", "utf8");
const panelSlashIndex = workerSource.indexOf("normalizeGroupPanelSlashInvocation(userMessage)");
const optOutIndex = workerSource.indexOf("stripGroupAiOptOutPrefix(userMessage, botId)");
assert(panelSlashIndex >= 0 && optOutIndex > panelSlashIndex, "panel slash normalization must run before /! AI opt-out stripping");
assert.equal(resolveGroupPanelInput("!面板 开发者 codexwork --export 测试", registry)?.expanded, "!codexwork --export 测试");
const groupRootHelp = resolveGroupPanelInput("!面板 基础", registry);
assert.equal(groupRootHelp?.matched, true);
assert.equal(groupRootHelp?.expanded, "");
assert.match(groupRootHelp?.message || "", /help/);
assert.match(groupRootHelp?.message || "", /status/);
assert(groupRootHelp?.keyboard?.content?.rows?.length > 0);
assert(groupRootHelp.keyboard.content.rows.length <= 5);
assert(groupRootHelp.keyboard.content.rows.every(row => row.buttons.length <= 2));
const basicKeyboard = buildGroupCategoryKeyboard(registry, "basic");
assert.equal(basicKeyboard.page, 1);
assert.equal(basicKeyboard.totalPages, 1);
const basicButtons = basicKeyboard.keyboard.content.rows.flatMap(row => row.buttons);

const helpButton = basicButtons.find(button => button.render_data.label === "help");
assert(helpButton);
assert.equal(helpButton.action.type, 2);
assert.equal(helpButton.action.enter, true);
assert.equal(helpButton.action.data, "!help");
assert.equal(helpButton.action.permission?.type, 2);
assert.equal(helpButton.action.enter, true);
assert.equal(helpButton.action.click_limit, 10);
assert(helpButton.action.unsupport_tips);
assert(helpButton.group_id);

const statusButton = basicButtons.find(button => button.render_data.label === "status");
assert(statusButton);
assert.equal(statusButton.action.type, 2);
assert.equal(statusButton.action.enter, true);
assert.equal(statusButton.action.data, "!status");

const codexButton = basicButtons.find(button => button.render_data.label === "codex");
assert(codexButton);
assert.equal(codexButton.action.type, 2);
assert.equal(codexButton.action.enter, false);
assert.equal(codexButton.action.data, "!codex ");
assert.equal(codexButton.action.click_limit, 10);

const modelButton = basicButtons.find(button => button.render_data.label === "模型");
assert(modelButton);
assert.equal(modelButton.action.type, 2);
assert.equal(modelButton.action.enter, false);
assert.equal(modelButton.action.data, "!模型 ");

const allCategoryCommands = new Set();
let nonEmptyCategoryCount = 0;
for (const meta of GROUP_PANEL_CATEGORY_META) {
  const commands = registry.list({ scope:"group" })
    .filter(command => command.panel.enabled && String(command.discoveryCategory || "other") === meta.key);
  if (!commands.length) continue;
  nonEmptyCategoryCount += 1;
  const first = buildGroupCategoryKeyboard(registry, meta.key, { page:1 });
  assert(first, `Category ${meta.label} must build a keyboard`);
  assert(first.keyboard.content.rows.length > 0 && first.keyboard.content.rows.length <= 5);
  assert(first.keyboard.content.rows.every(row => row.buttons.length > 0 && row.buttons.length <= 2));
  const seen = new Set();
  for (let page = 1; page <= first.totalPages; page += 1) {
    const view = buildGroupCategoryKeyboard(registry, meta.key, { page });
    assert(view, `Category ${meta.label} page ${page} missing`);
    assert.equal(view.page, page);
    assert(view.keyboard.content.rows.length <= 5);
    assert(view.keyboard.content.rows.every(row => row.buttons.length > 0 && row.buttons.length <= 2));
    const buttons = view.keyboard.content.rows.flatMap(row => row.buttons);
    for (const command of view.commands) {
      assert(!seen.has(command.id), `Duplicate command ${command.id} in category ${meta.label}`);
      seen.add(command.id);
      allCategoryCommands.add(command.id);
      const button = buttons.find(item => String(item.action.data || "").trim() === command.panel.command);
      assert(button, `Missing button for ${command.id} in ${meta.label}`);
      assert.equal(button.action.permission?.type, 2);
      assert.equal(button.action.click_limit, 10);
      if (command.panel.enter === true) {
        assert.equal(button.action.type, 2, `No-parameter command ${command.id} must send a QQ message`);
        assert.equal(button.action.enter, true);
        assert.equal(button.action.data, command.panel.command);
      } else {
        assert.equal(button.action.type, 2, `Parameterized command ${command.id} must prefill`);
        assert.equal(button.action.enter, false);
        assert.equal(button.action.data, `${command.panel.command} `);
      }
    }
    for (const button of buttons.filter(item => /^!面板\s/.test(item.action.data))) {
      assert.equal(button.action.type, 1, "Pagination must use immediate callback");
      assert.equal(button.action.click_limit, 10);
    }
  }
  assert.equal(seen.size, commands.length, `Category ${meta.label} did not expose every command`);
}
assert(nonEmptyCategoryCount >= 9, "Expected all group command categories to be represented");
const expectedGroupCommandIds = registry.list({ scope:"group" })
  .filter(command => command.panel.enabled)
  .map(command => command.id);
assert.equal(allCategoryCommands.size, expectedGroupCommandIds.length);
for (const id of expectedGroupCommandIds) assert(allCategoryCommands.has(id), `All-category keyboard coverage missing ${id}`);

const aiAdminKeyboard = buildGroupCategoryKeyboard(registry, "ai-admin", { page:1 });
assert(aiAdminKeyboard.totalPages >= 2);
const nextPageButton = aiAdminKeyboard.keyboard.content.rows.flatMap(row => row.buttons)
  .find(button => button.action.data === "!面板 AI管理 --page=2");
assert(nextPageButton);
assert.equal(nextPageButton.action.type, 1);
assert.equal(nextPageButton.action.click_limit, 10);
const aiAdminPage2 = resolveGroupPanelInput("!面板 AI管理 --page=2", registry);
assert.equal(aiAdminPage2?.matched, true);
assert.equal(aiAdminPage2?.expanded, "");
assert.equal(aiAdminPage2?.page, 2);
assert(aiAdminPage2?.keyboard?.content?.rows?.length > 0);

const requestCountBeforeCategoryPayloads = requests.length;
for (const meta of GROUP_PANEL_CATEGORY_META) {
  const view = buildGroupCategoryKeyboard(registry, meta.key, { page:1 });
  if (!view) continue;
  await api.sendGroupMessage("group/A", {
    msg_type:2,
    markdown:{content:`【${meta.label}】请选择子指令`},
    keyboard:view.keyboard
  });
}
const categoryKeyboardPosts = requests.slice(requestCountBeforeCategoryPayloads).filter(x =>
  /\/v2\/groups\/group%2FA\/messages$/.test(x.url)
  && x.options.method === "POST"
  && JSON.parse(x.options.body || "{}")?.keyboard
);
assert.equal(categoryKeyboardPosts.length, nonEmptyCategoryCount);
for (const post of categoryKeyboardPosts) {
  const body = JSON.parse(post.options.body);
  assert.equal(body.msg_type, 2);
  assert(body.markdown?.content);
  assert(body.keyboard?.content?.rows?.length > 0);
  assert(body.keyboard.content.rows.length <= 5);
  assert(body.keyboard.content.rows.every(row => row.buttons.length > 0 && row.buttons.length <= 2));
  for (const button of body.keyboard.content.rows.flatMap(row => row.buttons)) {
    assert([1,2].includes(button.action.type));
    assert.equal(button.action.permission.type, 2);
    assert.equal(button.action.click_limit, 10);
  }
}

const qqOpenRuntimeSource = fs.readFileSync("src/v4/qqopen/runtime.js", "utf8");
assert.match(qqOpenRuntimeSource, /qq_inline_keyboard/);
assert.match(qqOpenRuntimeSource, /normalizeInlineKeyboard/);
assert.match(qqOpenRuntimeSource, /keyboardCapabilityError/);
assert.match(qqOpenRuntimeSource, /msg_type:\s*2/);
assert.match(qqOpenRuntimeSource, /markdown:\s*\{\s*content/);
assert.match(qqOpenRuntimeSource, /permission:\s*\{\s*type/);
assert.match(qqOpenRuntimeSource, /click_limit/);
assert.match(qqOpenRuntimeSource, /unsupport_tips/);
assert.match(qqOpenRuntimeSource, /action\.enter/);
assert.match(qqOpenRuntimeSource, /group_id/);
assert.match(qqOpenRuntimeSource, /recordKeyboardFallback/);
assert.match(qqOpenRuntimeSource, /sessionIntents/);
assert.match(qqOpenRuntimeSource, /configuredIntents/);
assert.match(qqOpenRuntimeSource, /Number\(this\.persisted\.sessionIntents \|\| 0\) === configuredIntents/);
assert.match(qqOpenRuntimeSource, /if \(!canResume\) this\.persisted\.sessionIntents = configuredIntents/);
assert.match(workerSource, /qq_inline_keyboard/);

const developerPanels = registry.buildCategorizedPanels("c2c", {
  permissions:allPermissions,
  targetType:"specific",
  userOpenids:["dev-openid"]
});
assert(developerPanels.length > 2);
assert(developerPanels.every(panel => JSON.stringify(panel.user_openids) === JSON.stringify(["dev-openid"])));
const developerPanelItems = developerPanels.flatMap(panel => panel.panel.items);
const developerPanelNames = new Set(developerPanelItems.map(item => item.name));
assert(developerPanelNames.has("!help"));
assert(developerPanelNames.has("!codex"));
assert(developerPanelNames.has("!QQ语音"));
assert(developerPanelNames.has("!codexchat"));
assert(developerPanelNames.has("!codexwork"));
assert(developerPanelNames.has("!群白名单"));
assert(developerPanelNames.has("!重置"));
for (const command of registry.list({ scope:"c2c" }).filter(command => command.panel.enabled)) {
  assert(developerPanelNames.has(command.panel.command), `Developer all-command discovery missing ${command.id}`);
}

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
assert.equal(qqOpenIntents({}), (1 << 25) | (1 << 26));
assert.equal(qqOpenIntents({ QQ_OPEN_INTENTS:String((1 << 25) | (1 << 26)) }), (1 << 25) | (1 << 26));
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
assert(firstDiscovery.panels <= 20);
assert(firstDiscovery.categories.includes("basic"));
assert(firstDiscovery.categories.includes("group-root"));
assert(firstDiscovery.categories.includes("developer"));
assert.equal(firstDiscovery.panels, 1 + developerPanels.length, "discovery must create one group root panel plus Developer C2C panels");
const groupSyncPanels = discoveryCalls
  .filter(row => row[0] === "createPanel" && row[1] === "group" && row[2]?.target_type === "all")
  .map(row => row[2]);
assert.equal(groupSyncPanels.length, 1, "QQ client must receive one managed group panel");
const groupSyncNames = new Set(groupSyncPanels[0].panel.items.map(item => item.name));
for (const name of ["!面板 基础","!面板 群聊","!面板 记忆","!面板 活动","!面板 群规","!面板 AI管理","!面板 群操作","!面板 群主","!面板 开发者"]) {
  assert(groupSyncNames.has(name), `Synced group root panel missing ${name}`);
}
assert(!groupSyncNames.has("!群白名单"), "raw Developer commands must not replace the group root panel");

const developerSyncPanels = discoveryCalls
  .filter(row => row[0] === "createPanel" && row[2]?.target_type === "specific" && row[2]?.user_openids?.includes("dev-openid"))
  .map(row => row[2]);
assert(developerSyncPanels.length >= developerPanels.length);
const developerSyncNames = new Set(developerSyncPanels.flatMap(panel => panel.panel.items).map(item => item.name));
assert(developerSyncNames.has("!help"));
assert(developerSyncNames.has("!codex"));
assert(developerSyncNames.has("!codexchat"));
assert(developerSyncNames.has("!codexwork"));
const syncedMenu = discoveryCalls.find(row => row[0] === "putMenu")?.[1];
assert(syncedMenu.items.every(item => item.type === "menu" && item.sub_menu_items?.length <= 5));
const callCountAfterFirst = discoveryCalls.length;
const secondDiscovery = await syncQqOpenDiscovery(discoveryApi, registry, { previousFingerprint:firstDiscovery.fingerprint, developerOpenids:["dev-openid"] });
assert.equal(secondDiscovery.changed, false);
assert.equal(discoveryCalls.length, callCountAfterFirst);

console.log("verify-v4-qqopen connectivity action dispatcher: ok");
console.log("verify-v4-qqopen: ok");
