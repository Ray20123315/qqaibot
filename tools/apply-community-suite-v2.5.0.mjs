import fs from 'node:fs';

function mustReplace(source, before, after, label) {
  if (!source.includes(before)) throw new Error(`Missing anchor: ${label}`);
  return source.replace(before, after);
}

function replaceAllVersionAssertions() {
  for (const file of fs.readdirSync('.').filter(name => /^verify-.*\.mjs$/.test(name))) {
    let source = fs.readFileSync(file, 'utf8');
    if (source.includes('2.4.2')) {
      source = source.replaceAll('2.4.2', '2.5.0');
      fs.writeFileSync(file, source);
    }
  }
}

// -----------------------------------------------------------------------------
// Relationship permission model
// -----------------------------------------------------------------------------
{
  const path = 'src/moderation/partner-bindings.js';
  let source = fs.readFileSync(path, 'utf8');
  source = mustReplace(source,
`const PARTNER_REQUEST_TTL_MS = 10 * 60 * 1000;
`,
`const PARTNER_REQUEST_TTL_MS = 10 * 60 * 1000;
const MASTER_RELATIONSHIP_DEFAULTS = Object.freeze({
  mute: true,
  unmute: true,
  recall: true,
  rename: true,
  kick: false,
  maxMuteSeconds: 30 * 60
});

function normalizeMasterPermissions(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    mute: source.mute !== false,
    unmute: source.unmute !== false,
    recall: source.recall !== false,
    rename: source.rename !== false,
    kick: source.kick === true,
    maxMuteSeconds: Math.max(1, Math.min(30 * 24 * 60 * 60, Math.trunc(Number(source.maxMuteSeconds || MASTER_RELATIONSHIP_DEFAULTS.maxMuteSeconds))))
  };
}
`, 'relationship defaults');

  source = mustReplace(source,
`    memberId,
    createdAt: Number(source.createdAt || 0),
`,
`    memberId,
    permissions: mode === "master" ? normalizeMasterPermissions(source.permissions) : null,
    createdAt: Number(source.createdAt || 0),
`, 'normalize relationship permissions');

  source = mustReplace(source,
`  const common = { active: true, groupId: group, mode: request.mode === "master" ? "master" : "partner", createdAt: now, requestId: request.id };
`,
`  const common = { active: true, groupId: group, mode: request.mode === "master" ? "master" : "partner", permissions: request.mode === "master" ? { ...MASTER_RELATIONSHIP_DEFAULTS } : null, createdAt: now, requestId: request.id };
`, 'consent relationship defaults');

  source = mustReplace(source,
`      userIds: [binding.masterId, binding.memberId],
      createdAt: binding.createdAt,
`,
`      userIds: [binding.masterId, binding.memberId],
      permissions: binding.permissions,
      createdAt: binding.createdAt,
`, 'list relationship permissions');

  source = mustReplace(source,
`  const common = { active: true, groupId: group, mode: "master", masterId: master, memberId: member, createdAt: now, requestId, direct: true, createdBy: actor };
`,
`  const common = { active: true, groupId: group, mode: "master", masterId: master, memberId: member, permissions: { ...MASTER_RELATIONSHIP_DEFAULTS }, createdAt: now, requestId, direct: true, createdBy: actor };
`, 'direct relationship defaults');

  source = mustReplace(source,
`async function clearPartnerBinding(env, groupId, userId) {
`,
`async function updateMasterBindingPermissions(env, groupId, userId, patch, updatedBy = "") {
  const binding = await getPartnerBinding(env, groupId, userId);
  if (!binding || binding.mode !== "master") return { ok: false, message: "找不到有效的主人关系。" };
  const permissions = normalizeMasterPermissions({ ...binding.permissions, ...(patch && typeof patch === "object" ? patch : {}) });
  const [leftRaw, rightRaw] = await Promise.all([
    readJsonKey(env, partnerBindingKey(binding.groupId, binding.userId), null),
    readJsonKey(env, partnerBindingKey(binding.groupId, binding.partnerId), null)
  ]);
  if (!leftRaw || !rightRaw) return { ok: false, message: "主人关系资料不完整。" };
  const updatedAt = Date.now();
  await Promise.all([
    dbPut(env, partnerBindingKey(binding.groupId, binding.userId), JSON.stringify({ ...leftRaw, permissions, permissionsUpdatedAt: updatedAt, permissionsUpdatedBy: cleanId(updatedBy) })),
    dbPut(env, partnerBindingKey(binding.groupId, binding.partnerId), JSON.stringify({ ...rightRaw, permissions, permissionsUpdatedAt: updatedAt, permissionsUpdatedBy: cleanId(updatedBy) }))
  ]);
  const next = await getPartnerBinding(env, binding.groupId, binding.userId);
  return { ok: true, binding: next };
}

async function clearPartnerBinding(env, groupId, userId) {
`, 'relationship permission updater');

  source = mustReplace(source,
`export {
  PARTNER_REQUEST_TTL_MS,
`,
`export {
  MASTER_RELATIONSHIP_DEFAULTS,
  PARTNER_REQUEST_TTL_MS,
`, 'export relationship defaults');

  source = mustReplace(source,
`  listGroupBindings,
  partnerBindingKey
`,
`  listGroupBindings,
  normalizeMasterPermissions,
  partnerBindingKey,
  updateMasterBindingPermissions
`, 'export relationship permission functions');
  fs.writeFileSync(path, source);
}

// -----------------------------------------------------------------------------
// Portal member console integration and permanent nav visibility
// -----------------------------------------------------------------------------
{
  const path = 'src/portal/members.js';
  let source = fs.readFileSync(path, 'utf8');
  source = mustReplace(source,
`import { numericId } from "../security/network.js";
`,
`import { numericId } from "../security/network.js";
import { handleCommunitySuiteApi, injectCommunitySuiteClient, listMemberProfileSummaries } from "./community-suite.js";
`, 'community suite import');

  source = mustReplace(source,
`    requestId: String(binding.requestId || "")
`,
`    requestId: String(binding.requestId || ""),
    permissions: binding.permissions || null
`, 'public relationship permissions');

  source = mustReplace(source,
`  if (!memberConsoleAllowed(authed)) return jsonResponse({ ok: false, message: "群友列表、历史消息与禁言操作仅限本群 QQ 管理员、群主、获授群操作权限者或开发者。" }, 403);

  if (request.method === "GET" && path === "/members") {
`,
`  if (!memberConsoleAllowed(authed)) return jsonResponse({ ok: false, message: "群友列表、历史消息与禁言操作仅限本群 QQ 管理员、群主、获授群操作权限者或开发者。" }, 403);
  const suiteResponse = await handleCommunitySuiteApi(request, env, url, path, body, authed, { listPortalMembers });
  if (suiteResponse) return suiteResponse;

  if (request.method === "GET" && path === "/members") {
`, 'community suite api delegation');

  source = mustReplace(source,
`      const relationships = (await listGroupBindings(env, groupId)).map(publicRelationship);
      const relationshipByUser = new Map();
`,
`      const relationships = (await listGroupBindings(env, groupId)).map(publicRelationship);
      const profiles = await listMemberProfileSummaries(env, groupId);
      const relationshipByUser = new Map();
`, 'member profile summaries');

  source = mustReplace(source,
`        relationship: relationshipByUser.get(String(item.qq)) || null,
        relationshipEligibility: {
`,
`        relationship: relationshipByUser.get(String(item.qq)) || null,
        memberProfile: profiles[item.qq] || null,
        relationshipEligibility: {
`, 'attach member profile summary');

  source = mustReplace(source,
`  const navAnchor = '<button data-view="logs">操作日志</button>';
  if (source.includes(navAnchor)) {
    source = source.replace(navAnchor, '<button data-view="members" id="memberConsoleNav">群友列表</button>' + navAnchor);
  }
`,
`  const navButton = '<button data-view="members" id="memberConsoleNav">群友列表</button>';
  if (!source.includes('id="memberConsoleNav"')) {
    const navFallbacks = [
      { anchor: '<button data-view="logs">操作日志</button>', value: navButton + '<button data-view="logs">操作日志</button>' },
      { anchor: '</nav>', value: navButton + '</nav>' },
      { anchor: '</aside>', value: '<nav>' + navButton + '</nav></aside>' }
    ];
    const match = navFallbacks.find(item => source.includes(item.anchor));
    if (match) source = source.replace(match.anchor, match.value);
    else source = navButton + source;
  }
`, 'robust member nav');

  source = source.replace(/\n  function sessionAllows\(\)\{[\s\S]*?\n  function syncNav\(\)\{[^\n]*\}\n/, '\n');
  if (source.includes('syncNav();if(isMembersView())')) source = source.replace('syncNav();if(isMembersView())', 'if(isMembersView())');
  if (!source.includes('window.qqaiLoadMembers=loadMembers;')) {
    source = mustReplace(source, `  async function showHistory(qq){\n`, `  window.qqaiLoadMembers=loadMembers;\n  async function showHistory(qq){\n`, 'expose member reload');
  }
  source = mustReplace(source,
`  return source.includes("</body>") ? source.replace("</body>", script + "\\n</body>") : source + script;
`,
`  const output = source.includes("</body>") ? source.replace("</body>", script + "\\n</body>") : source + script;
  return injectCommunitySuiteClient(output);
`, 'inject community client');
  fs.writeFileSync(path, source);
}

// -----------------------------------------------------------------------------
// Worker commands: sticker system + relationship permission enforcement
// -----------------------------------------------------------------------------
{
  const path = 'worker.js';
  let source = fs.readFileSync(path, 'utf8');
  source = mustReplace(source,
`import { clearPartnerBinding, createMasterBindingRequest, createPartnerBindingRequest, decidePartnerBindingRequest, getBindingRequest, getPartnerBinding } from "./src/moderation/partner-bindings.js";
`,
`import { MASTER_RELATIONSHIP_DEFAULTS, clearPartnerBinding, createMasterBindingRequest, createPartnerBindingRequest, decidePartnerBindingRequest, getBindingRequest, getPartnerBinding } from "./src/moderation/partner-bindings.js";
`, 'worker relationship defaults import');
  source = mustReplace(source,
`import { applySocialOutputPolicy, buildSocialDecision, buildSocialPromptBlock, capturePersonaContinuity, oneBotBotMentionCount, oneBotEventHasMedia, oneBotEventIsBareMention, oneBotEventIsPunctuationOnly, observeSocialStyle, shouldSendSocialBufferNotice, socialInputDelayMs, waitForSocialTyping } from "./src/social/runtime.js";
`,
`import { applySocialOutputPolicy, buildSocialDecision, buildSocialPromptBlock, capturePersonaContinuity, oneBotBotMentionCount, oneBotEventHasMedia, oneBotEventIsBareMention, oneBotEventIsPunctuationOnly, observeSocialStyle, shouldSendSocialBufferNotice, socialInputDelayMs, waitForSocialTyping } from "./src/social/runtime.js";
import { pickSticker, pickStickerForText, stickerCqMessage } from "./src/social/sticker-library.js";
`, 'worker sticker import');

  source = mustReplace(source,
`        return jsonReply(\`${'${atSender}'}已自我禁言 ${'${duration}'} 秒。只能由你本人私讯机器人发送「!解除禁言」静默解除，管理入口不能解除。\`);
      }

      // ⏳ Cloudflare 原生速率限制器`,
`        return jsonReply(\`${'${atSender}'}已自我禁言 ${'${duration}'} 秒。只能由你本人私讯机器人发送「!解除禁言」静默解除，管理入口不能解除。\`);
      }

      const stickerCommand = cleanMessage.match(/^[!！](?:表情|表情包|贴图|貼圖)(?:\\s+([\\s\\S]+))?$/i);
      if (stickerCommand) {
        if (!isGroup) return jsonReply("表情库目前按群组管理，请在群聊使用该指令。");
        const sticker = await pickSticker(env, currentGroupId, String(stickerCommand[1] || "").trim());
        if (!sticker) return jsonReply(\`${'${atSender}'}当前群没有可用表情，管理员可在 Portal「群友列表 → 表情库」添加。\`);
        return jsonReply(stickerCqMessage(sticker));
      }

      if (isGroup && explicitlyTriggered && !isCommandMessage && meaningfulText.length <= 16) {
        const sticker = await pickStickerForText(env, currentGroupId, meaningfulText);
        if (sticker && Math.random() < 0.35) return jsonReply(stickerCqMessage(sticker));
      }

      // ⏳ Cloudflare 原生速率限制器`, 'sticker command');

  source = mustReplace(source,
`        return { ok: true, binding, member };
`,
`        return { ok: true, binding: { ...binding, permissions: binding.permissions || { ...MASTER_RELATIONSHIP_DEFAULTS } }, member };
`, 'master control permissions');

  source = mustReplace(source,
`        return jsonReply(\`${'${atSender}'}主人可对唯一所属成员使用：
!主人禁言 10分
!主人解除禁言
!主人踢出
!主人改名 新群名片
回复所属成员消息后发送 !主人撤回
主人只能解除自己造成的主人禁言，不能解除群规、自我禁言、对象禁言或管理防解除。\`);
`,
`        const permissions = control.binding.permissions || MASTER_RELATIONSHIP_DEFAULTS;
        const lines = [
          permissions.mute ? \`!主人禁言 10分（上限 ${'${permissions.maxMuteSeconds}'} 秒）\` : "禁言：未开放",
          permissions.unmute ? "!主人解除禁言" : "解禁：未开放",
          permissions.kick ? "!主人踢出" : "踢出：未开放",
          permissions.rename ? "!主人改名 新群名片" : "改名：未开放",
          permissions.recall ? "回复所属成员消息后发送 !主人撤回" : "撤回：未开放"
        ];
        return jsonReply(\`${'${atSender}'}当前主人权限：\\n${'${lines.join("\\n")}'}\\n主人只能解除自己造成的主人禁言，不能解除群规、自我禁言、对象禁言或管理防解除。\`);
`, 'master features output');

  source = mustReplace(source,
`        if (!control.ok) return jsonReply(\`${'${atSender}'}${'${control.message}'}\`);
        const duration = Math.max(1, Math.min(MUTE_LOCK_MAX_SECONDS, parseDurationSeconds(String(masterMuteCommand[1] || "10分")) || 600));
`,
`        if (!control.ok) return jsonReply(\`${'${atSender}'}${'${control.message}'}\`);
        const masterPermissions = control.binding.permissions || MASTER_RELATIONSHIP_DEFAULTS;
        if (!masterPermissions.mute) return jsonReply(\`${'${atSender}'}主人权限未开放禁言。\`);
        const requestedDuration = Math.max(1, parseDurationSeconds(String(masterMuteCommand[1] || "10分")) || 600);
        const duration = Math.max(1, Math.min(MUTE_LOCK_MAX_SECONDS, Number(masterPermissions.maxMuteSeconds || 1800), requestedDuration));
`, 'master mute permission');

  source = mustReplace(source,
`        if (!control.ok) return jsonReply(\`${'${atSender}'}${'${control.message}'}\`);
        const lock = await getMuteLock(env, currentGroupId, control.binding.memberId);
`,
`        if (!control.ok) return jsonReply(\`${'${atSender}'}${'${control.message}'}\`);
        if (!(control.binding.permissions || MASTER_RELATIONSHIP_DEFAULTS).unmute) return jsonReply(\`${'${atSender}'}主人权限未开放解除禁言。\`);
        const lock = await getMuteLock(env, currentGroupId, control.binding.memberId);
`, 'master unmute permission');

  source = mustReplace(source,
`        if (!control.ok) return jsonReply(\`${'${atSender}'}${'${control.message}'}\`);
        try {
          await callOneBotAction(env, { action: "set_group_kick"`,
`        if (!control.ok) return jsonReply(\`${'${atSender}'}${'${control.message}'}\`);
        if (!(control.binding.permissions || MASTER_RELATIONSHIP_DEFAULTS).kick) return jsonReply(\`${'${atSender}'}主人权限未开放踢出。\`);
        try {
          await callOneBotAction(env, { action: "set_group_kick"`, 'master kick permission');

  source = mustReplace(source,
`        if (!control.ok) return jsonReply(\`${'${atSender}'}${'${control.message}'}\`);
        const card = String(masterRenameCommand[1] || "").trim().slice(0, 60);
`,
`        if (!control.ok) return jsonReply(\`${'${atSender}'}${'${control.message}'}\`);
        if (!(control.binding.permissions || MASTER_RELATIONSHIP_DEFAULTS).rename) return jsonReply(\`${'${atSender}'}主人权限未开放修改群名片。\`);
        const card = String(masterRenameCommand[1] || "").trim().slice(0, 60);
`, 'master rename permission');

  source = mustReplace(source,
`        if (!control.ok) return jsonReply(\`${'${atSender}'}${'${control.message}'}\`);
        if (!quotedMessageId) return jsonReply(\`${'${atSender}'}请先回复所属成员的消息，再发送「!主人撤回」。\`);
`,
`        if (!control.ok) return jsonReply(\`${'${atSender}'}${'${control.message}'}\`);
        if (!(control.binding.permissions || MASTER_RELATIONSHIP_DEFAULTS).recall) return jsonReply(\`${'${atSender}'}主人权限未开放撤回消息。\`);
        if (!quotedMessageId) return jsonReply(\`${'${atSender}'}请先回复所属成员的消息，再发送「!主人撤回」。\`);
`, 'master recall permission');
  fs.writeFileSync(path, source);
}

// -----------------------------------------------------------------------------
// Version, release notes and permanent checks
// -----------------------------------------------------------------------------
{
  const pkgPath = 'package.json';
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkg.version = '2.5.0';
  if (!pkg.scripts.check.includes('verify-community-suite.mjs')) pkg.scripts.check += ' && node verify-community-suite.mjs';
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

  const configPath = 'src/config/runtime.js';
  let config = fs.readFileSync(configPath, 'utf8');
  config = mustReplace(config, 'const VERSION = "2.4.2";', 'const VERSION = "2.5.0";', 'runtime version');
  fs.writeFileSync(configPath, config);

  const releasePath = 'release-notes.json';
  const notes = JSON.parse(fs.readFileSync(releasePath, 'utf8'));
  notes.version = '2.5.0';
  notes.notificationPolicy = 'portal-only-with-private-developer-failure-details';
  notes.added = [
    'Portal 群友列表新增自我诊断、群友标签与备注、批量管理、表情库、主人权限控制与 AI 决策回放',
    '群友列表支持批量禁言、解禁、标签、观察与违规分类，并可导出已选成员',
    '主人关系可分别控制禁言、解禁、撤回、改名、踢出与最大禁言时长；踢出默认关闭',
    '群聊新增 !表情 分类，并可对抱抱、疑惑、道歉等极短互动低概率发送已审核表情'
  ];
  notes.fixed = [
    '群友列表入口被注入脚本错误读取私有 session 后再次隐藏',
    'Portal 功能故障时无法一次看出前端、D1、OneBot、群友目录或权限层状态',
    '管理备注无法控制是否允许 AI 判断时参考，批量复核缺少统一分类入口'
  ];
  fs.writeFileSync(releasePath, JSON.stringify(notes, null, 2) + '\n');
  replaceAllVersionAssertions();
}

console.log('Community suite v2.5.0 patch applied');
