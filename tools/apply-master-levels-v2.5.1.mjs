import fs from 'node:fs';

function mustReplace(source, before, after, label) {
  if (!source.includes(before)) throw new Error(`Missing anchor: ${label}`);
  return source.replace(before, after);
}

function mustReplaceRegex(source, pattern, after, label) {
  if (!pattern.test(source)) throw new Error(`Missing regex anchor: ${label}`);
  return source.replace(pattern, after);
}

function replaceVersionAssertions() {
  for (const file of fs.readdirSync('.').filter(name => /^verify-.*\.mjs$/.test(name))) {
    let source = fs.readFileSync(file, 'utf8');
    if (source.includes('2.5.0')) {
      source = source.replaceAll('2.5.0', '2.5.1');
      fs.writeFileSync(file, source);
    }
  }
}

// -----------------------------------------------------------------------------
// Master relationship level model
// -----------------------------------------------------------------------------
{
  const path = 'src/moderation/partner-bindings.js';
  let source = fs.readFileSync(path, 'utf8');
  source = mustReplace(source,
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
`,
`const PARTNER_REQUEST_TTL_MS = 10 * 60 * 1000;
const MASTER_RELATIONSHIP_DEFAULT_LEVEL = 1;
const MASTER_RELATIONSHIP_MAX_LEVEL = 4;
const MASTER_RELATIONSHIP_LEVELS = Object.freeze({
  1: Object.freeze({ level: 1, label: "Lv.1", mute: true, unmute: false, recall: false, rename: false, kick: false, maxMuteSeconds: 60, unlock: "禁言" }),
  2: Object.freeze({ level: 2, label: "Lv.2", mute: true, unmute: true, recall: false, rename: false, kick: false, maxMuteSeconds: 10 * 60, unlock: "禁言、解除主人禁言" }),
  3: Object.freeze({ level: 3, label: "Lv.3", mute: true, unmute: true, recall: true, rename: false, kick: false, maxMuteSeconds: 30 * 60, unlock: "禁言、解除主人禁言、撤回" }),
  4: Object.freeze({ level: 4, label: "Lv.4", mute: true, unmute: true, recall: true, rename: true, kick: false, maxMuteSeconds: 2 * 60 * 60, unlock: "禁言、解除主人禁言、撤回、修改群名片" })
});
const MASTER_RELATIONSHIP_DEFAULTS = MASTER_RELATIONSHIP_LEVELS[MASTER_RELATIONSHIP_DEFAULT_LEVEL];

function normalizeMasterLevel(value, fallback = MASTER_RELATIONSHIP_DEFAULT_LEVEL) {
  const parsed = Math.trunc(Number(value));
  if (Number.isFinite(parsed) && parsed >= 1 && parsed <= MASTER_RELATIONSHIP_MAX_LEVEL) return parsed;
  const safeFallback = Math.trunc(Number(fallback));
  return Number.isFinite(safeFallback) && safeFallback >= 1 && safeFallback <= MASTER_RELATIONSHIP_MAX_LEVEL ? safeFallback : MASTER_RELATIONSHIP_DEFAULT_LEVEL;
}

function inferMasterLevelFromLegacyPermissions(value) {
  const source = value && typeof value === "object" ? value : null;
  if (!source) return MASTER_RELATIONSHIP_MAX_LEVEL;
  if (source.rename === true) return 4;
  if (source.recall === true) return 3;
  if (source.unmute === true) return 2;
  return 1;
}

function masterPermissionsForLevel(value) {
  const level = normalizeMasterLevel(value);
  return { ...MASTER_RELATIONSHIP_LEVELS[level], kick: false };
}

function normalizeMasterPermissions(value, levelValue) {
  const fallback = levelValue === undefined || levelValue === null
    ? inferMasterLevelFromLegacyPermissions(value)
    : MASTER_RELATIONSHIP_DEFAULT_LEVEL;
  return masterPermissionsForLevel(normalizeMasterLevel(levelValue, fallback));
}
`, 'master level constants');

  source = mustReplace(source,
`  const validMasterPair = mode !== "master" || Boolean(masterId && memberId && masterId !== memberId && relationshipRole);
  return {
`,
`  const validMasterPair = mode !== "master" || Boolean(masterId && memberId && masterId !== memberId && relationshipRole);
  const level = mode === "master" ? normalizeMasterLevel(source.level, inferMasterLevelFromLegacyPermissions(source.permissions)) : 0;
  return {
`, 'binding level normalization');

  source = mustReplace(source,
`    memberId,
    permissions: mode === "master" ? normalizeMasterPermissions(source.permissions) : null,
`,
`    memberId,
    level,
    permissions: mode === "master" ? masterPermissionsForLevel(level) : null,
`, 'binding level output');

  source = mustReplace(source,
`  const common = { active: true, groupId: group, mode: request.mode === "master" ? "master" : "partner", permissions: request.mode === "master" ? { ...MASTER_RELATIONSHIP_DEFAULTS } : null, createdAt: now, requestId: request.id };
`,
`  const common = { active: true, groupId: group, mode: request.mode === "master" ? "master" : "partner", level: request.mode === "master" ? MASTER_RELATIONSHIP_DEFAULT_LEVEL : 0, permissions: request.mode === "master" ? masterPermissionsForLevel(MASTER_RELATIONSHIP_DEFAULT_LEVEL) : null, createdAt: now, requestId: request.id };
`, 'consent level defaults');

  source = mustReplace(source,
`      userIds: [binding.masterId, binding.memberId],
      permissions: binding.permissions,
`,
`      userIds: [binding.masterId, binding.memberId],
      level: binding.level,
      permissions: binding.permissions,
`, 'list relationship level');

  source = mustReplace(source,
`  const common = { active: true, groupId: group, mode: "master", masterId: master, memberId: member, permissions: { ...MASTER_RELATIONSHIP_DEFAULTS }, createdAt: now, requestId, direct: true, createdBy: actor };
`,
`  const common = { active: true, groupId: group, mode: "master", masterId: master, memberId: member, level: MASTER_RELATIONSHIP_DEFAULT_LEVEL, permissions: masterPermissionsForLevel(MASTER_RELATIONSHIP_DEFAULT_LEVEL), createdAt: now, requestId, direct: true, createdBy: actor };
`, 'direct level defaults');

  source = mustReplaceRegex(source,
/async function updateMasterBindingPermissions\(env, groupId, userId, patch, updatedBy = ""\) \{[\s\S]*?\n\}\n\nasync function clearPartnerBinding/,
`async function updateMasterBindingLevel(env, groupId, userId, requestedLevel, updatedBy = "") {
  const binding = await getPartnerBinding(env, groupId, userId);
  if (!binding || binding.mode !== "master") return { ok: false, message: "找不到有效的主人关系。" };
  const level = normalizeMasterLevel(requestedLevel, binding.level || MASTER_RELATIONSHIP_DEFAULT_LEVEL);
  const permissions = masterPermissionsForLevel(level);
  const [leftRaw, rightRaw] = await Promise.all([
    readJsonKey(env, partnerBindingKey(binding.groupId, binding.userId), null),
    readJsonKey(env, partnerBindingKey(binding.groupId, binding.partnerId), null)
  ]);
  if (!leftRaw || !rightRaw) return { ok: false, message: "主人关系资料不完整。" };
  const updatedAt = Date.now();
  await Promise.all([
    dbPut(env, partnerBindingKey(binding.groupId, binding.userId), JSON.stringify({ ...leftRaw, level, permissions, permissionsUpdatedAt: updatedAt, permissionsUpdatedBy: cleanId(updatedBy) })),
    dbPut(env, partnerBindingKey(binding.groupId, binding.partnerId), JSON.stringify({ ...rightRaw, level, permissions, permissionsUpdatedAt: updatedAt, permissionsUpdatedBy: cleanId(updatedBy) }))
  ]);
  const next = await getPartnerBinding(env, binding.groupId, binding.userId);
  return { ok: true, binding: next };
}

async function updateMasterBindingPermissions(env, groupId, userId, patch, updatedBy = "") {
  const requestedLevel = patch && typeof patch === "object" && patch.level !== undefined
    ? patch.level
    : inferMasterLevelFromLegacyPermissions(patch);
  return updateMasterBindingLevel(env, groupId, userId, requestedLevel, updatedBy);
}

async function clearPartnerBinding`, 'replace permission updater');

  source = mustReplace(source,
`export {
  MASTER_RELATIONSHIP_DEFAULTS,
  PARTNER_REQUEST_TTL_MS,
`,
`export {
  MASTER_RELATIONSHIP_DEFAULT_LEVEL,
  MASTER_RELATIONSHIP_DEFAULTS,
  MASTER_RELATIONSHIP_LEVELS,
  MASTER_RELATIONSHIP_MAX_LEVEL,
  PARTNER_REQUEST_TTL_MS,
`, 'export level constants');

  source = mustReplace(source,
`  listGroupBindings,
  normalizeMasterPermissions,
  partnerBindingKey,
  updateMasterBindingPermissions
`,
`  listGroupBindings,
  masterPermissionsForLevel,
  normalizeMasterLevel,
  normalizeMasterPermissions,
  partnerBindingKey,
  updateMasterBindingLevel,
  updateMasterBindingPermissions
`, 'export level helpers');
  fs.writeFileSync(path, source);
}

// -----------------------------------------------------------------------------
// Portal level control
// -----------------------------------------------------------------------------
{
  const path = 'src/portal/community-suite.js';
  let source = fs.readFileSync(path, 'utf8');
  source = mustReplace(source,
`import { MASTER_RELATIONSHIP_DEFAULTS, listGroupBindings, updateMasterBindingPermissions } from "../moderation/partner-bindings.js";
`,
`import { MASTER_RELATIONSHIP_LEVELS, listGroupBindings, updateMasterBindingLevel } from "../moderation/partner-bindings.js";
`, 'portal level imports');

  source = mustReplace(source,
`  if (request.method === "GET" && path === "/members/relationships/policies") {
    const relationships = await listGroupBindings(env, groupId);
    return jsonResponse({ ok: true, relationships });
  }
`,
`  if (request.method === "GET" && path === "/members/relationships/policies") {
    const relationships = await listGroupBindings(env, groupId);
    return jsonResponse({ ok: true, relationships, levels: Object.values(MASTER_RELATIONSHIP_LEVELS) });
  }
`, 'portal policy levels');

  source = mustReplace(source,
`    const result = await updateMasterBindingPermissions(env, groupId, userId, body?.permissions || {}, authed.qq);
    if (!result.ok) return jsonResponse(result, 400);
    await writeSystemAudit(env, { type: "portal_master_permissions", groupId, actorId: authed.qq, targetId: result.binding.memberId, action: "update", permissions: result.binding.permissions }).catch(() => {});
    return jsonResponse({ ok: true, message: "主人关系权限已更新。", relationship: result.binding });
`,
`    const result = await updateMasterBindingLevel(env, groupId, userId, body?.level, authed.qq);
    if (!result.ok) return jsonResponse(result, 400);
    await writeSystemAudit(env, { type: "portal_master_level", groupId, actorId: authed.qq, targetId: result.binding.memberId, action: "update", level: result.binding.level, permissions: result.binding.permissions }).catch(() => {});
    return jsonResponse({ ok: true, message: `主人关系等级已更新为 Lv.${result.binding.level}。任何等级都不提供踢出权限。`, relationship: result.binding });
`, 'portal policy update');

  source = mustReplace(source,
`    <div class="section-head compact"><div><h3>主人关系权限</h3><p>踢出默认关闭；可分别限制禁言、解禁、撤回、改名及最大禁言时长。</p></div><button id="suitePolicyRefresh" class="btn ghost">刷新权限</button></div>
`,
`    <div class="section-head compact"><div><h3>主人关系等级</h3><p>等级越高自动解锁更多功能：Lv.1 禁言、Lv.2 解禁、Lv.3 撤回、Lv.4 改名。任何等级都没有踢出权限。</p></div><button id="suitePolicyRefresh" class="btn ghost">刷新等级</button></div>
`, 'portal policy card');

  source = mustReplace(source,
`  var selected=new Set(),suiteMembers=[],suiteProfiles={},suiteRelationships=[],suiteStickers=[],suiteDecisions=[];
`,
`  var selected=new Set(),suiteMembers=[],suiteProfiles={},suiteRelationships=[],suiteStickers=[],suiteDecisions=[],suiteMasterLevels=[];
`, 'portal level state');

  source = mustReplace(source,
`  async function loadPolicies(){var r=await call('/members/relationships/policies');if(!r.ok){e('suitePolicyList').innerHTML='<div class="empty">'+esc(r.message||'读取失败')+'</div>';return}suiteRelationships=r.relationships||[];var masters=suiteRelationships.filter(function(x){return x.mode==='master'});e('suitePolicyList').innerHTML=masters.map(function(x){var p=x.permissions||{},id=x.masterId||((x.userIds||[])[0]);return'<div class="item suite-policy-row" data-user-id="'+esc(id)+'"><div><div class="member-name">主人 QQ '+esc(x.masterId)+' → 所属成员 QQ '+esc(x.memberId)+'</div><div class="member-meta">踢出默认关闭；设置对关系双方同时生效。</div></div><div class="suite-policy-controls"><label><input class="pol-mute" type="checkbox" '+(p.mute!==false?'checked':'')+'>禁言</label><label><input class="pol-unmute" type="checkbox" '+(p.unmute!==false?'checked':'')+'>解禁</label><label><input class="pol-recall" type="checkbox" '+(p.recall!==false?'checked':'')+'>撤回</label><label><input class="pol-rename" type="checkbox" '+(p.rename!==false?'checked':'')+'>改名</label><label><input class="pol-kick" type="checkbox" '+(p.kick===true?'checked':'')+'>踢出</label><input class="pol-max" type="number" min="1" max="2592000" value="'+esc(p.maxMuteSeconds||1800)+'" title="最大禁言秒数"><button class="btn suite-policy-save">保存</button></div></div>'}).join('')||'<div class="empty">当前没有主人关系</div>'}
  async function savePolicy(button){var row=button.closest('.suite-policy-row'),r=await call('/members/relationships/policy','POST',{userId:row.dataset.userId,permissions:{mute:row.querySelector('.pol-mute').checked,unmute:row.querySelector('.pol-unmute').checked,recall:row.querySelector('.pol-recall').checked,rename:row.querySelector('.pol-rename').checked,kick:row.querySelector('.pol-kick').checked,maxMuteSeconds:Number(row.querySelector('.pol-max').value||1800)}});toastMessage(r.message||'操作完成');if(r.ok)loadPolicies()}
`,
`  function levelOptions(selectedLevel){return suiteMasterLevels.map(function(level){return'<option value="'+esc(level.level)+'" '+(Number(level.level)===Number(selectedLevel)?'selected':'')+'>'+esc(level.label)+'｜'+esc(level.unlock)+'｜禁言上限 '+esc(level.maxMuteSeconds)+' 秒</option>'}).join('')}
  async function loadPolicies(){var r=await call('/members/relationships/policies');if(!r.ok){e('suitePolicyList').innerHTML='<div class="empty">'+esc(r.message||'读取失败')+'</div>';return}suiteRelationships=r.relationships||[];suiteMasterLevels=r.levels||[];var masters=suiteRelationships.filter(function(x){return x.mode==='master'});e('suitePolicyList').innerHTML=masters.map(function(x){var p=x.permissions||{},id=x.masterId||((x.userIds||[])[0]),level=Number(x.level||1),unlocked=[p.mute?'禁言':'',p.unmute?'解禁':'',p.recall?'撤回':'',p.rename?'改名':''].filter(Boolean).join('、');return'<div class="item suite-policy-row" data-user-id="'+esc(id)+'"><div><div class="member-name">主人 QQ '+esc(x.masterId)+' → 所属成员 QQ '+esc(x.memberId)+'</div><div class="member-meta">当前 Lv.'+esc(level)+'｜已解锁 '+esc(unlocked||'无')+'｜禁言上限 '+esc(p.maxMuteSeconds||60)+' 秒｜踢出永久不可用</div></div><div class="suite-policy-controls"><select class="pol-level">'+levelOptions(level)+'</select><button class="btn suite-policy-save">保存等级</button></div></div>'}).join('')||'<div class="empty">当前没有主人关系</div>'}
  async function savePolicy(button){var row=button.closest('.suite-policy-row'),r=await call('/members/relationships/policy','POST',{userId:row.dataset.userId,level:Number(row.querySelector('.pol-level').value||1)});toastMessage(r.message||'操作完成');if(r.ok)loadPolicies()}
`, 'portal level client');

  source = source.replace("window.__qqaiCommunitySuite={version:'2.5.0'", "window.__qqaiCommunitySuite={version:'2.5.1'");
  fs.writeFileSync(path, source);
}

// -----------------------------------------------------------------------------
// Group commands and hard kick prohibition
// -----------------------------------------------------------------------------
{
  const path = 'worker.js';
  let source = fs.readFileSync(path, 'utf8');
  source = mustReplace(source,
`import { MASTER_RELATIONSHIP_DEFAULTS, clearPartnerBinding, createMasterBindingRequest, createPartnerBindingRequest, decidePartnerBindingRequest, getBindingRequest, getPartnerBinding } from "./src/moderation/partner-bindings.js";
`,
`import { MASTER_RELATIONSHIP_DEFAULTS, MASTER_RELATIONSHIP_MAX_LEVEL, clearPartnerBinding, createMasterBindingRequest, createPartnerBindingRequest, decidePartnerBindingRequest, getBindingRequest, getPartnerBinding } from "./src/moderation/partner-bindings.js";
`, 'worker level import');

  source = mustReplace(source,
`          ? `[CQ:at,qq=${pending.masterId}] 已成为主人；[CQ:at,qq=${pending.memberId}] 已成为所属成员。主人可直接禁言、解除主人禁言、踢出、修改群名片及撤回所属成员的消息；其他来源的处罚不能由主人解除。`
`,
`          ? `[CQ:at,qq=${pending.masterId}] 已成为主人；[CQ:at,qq=${pending.memberId}] 已成为所属成员。关系从 Lv.1 开始，仅解锁短时禁言；提升等级后可依序解锁解禁、撤回与修改群名片。任何等级都没有踢出权限。`
`, 'approval level message');

  source = mustReplace(source,
`            ? `${atSender}你是主人；所属成员是 ${otherName}（QQ:${binding.memberId}）。可使用「!主人功能」查看权限。`
            : `${atSender}你的主人是 ${otherName}（QQ:${binding.masterId}）。主人只可直接管理你，不能解除其他来源的处罚。`);
`,
`            ? `${atSender}你是主人；所属成员是 ${otherName}（QQ:${binding.memberId}），当前等级 Lv.${binding.level || 1}。可使用「!主人功能」查看权限。`
            : `${atSender}你的主人是 ${otherName}（QQ:${binding.masterId}），当前等级 Lv.${binding.level || 1}。主人只可使用该等级已解锁能力，且任何等级都不能踢出你。`);
`, 'relationship status level');

  source = mustReplaceRegex(source,
/      if \(\/\^\[!！\]\(\?:主人功能\|主人权限\|主人權限\)\$\/i\.test\(cleanMessage\)\) \{[\s\S]*?\n      \}\n\n      const masterMuteCommand/,
`      if (/^[!！](?:主人功能|主人权限|主人權限)$/i.test(cleanMessage)) {
        const control = await resolveMasterControl();
        if (!control.ok) return jsonReply(`${atSender}${control.message}`);
        const permissions = control.binding.permissions || MASTER_RELATIONSHIP_DEFAULTS;
        const level = Math.max(1, Math.min(MASTER_RELATIONSHIP_MAX_LEVEL, Number(control.binding.level || 1)));
        const lines = [
          permissions.mute ? `!主人禁言 10分（实际最多 ${permissions.maxMuteSeconds} 秒）` : "禁言：未开放",
          permissions.unmute ? "!主人解除禁言" : "解禁：Lv.2 解锁",
          permissions.recall ? "回复所属成员消息后发送 !主人撤回" : "撤回：Lv.3 解锁",
          permissions.rename ? "!主人改名 新群名片" : "改名：Lv.4 解锁"
        ];
        const next = level < MASTER_RELATIONSHIP_MAX_LEVEL ? `下一等级：Lv.${level + 1}` : "已达到最高等级";
        return jsonReply(`${atSender}主人等级：Lv.${level}/${MASTER_RELATIONSHIP_MAX_LEVEL}\n${lines.join("\n")}\n${next}\n任何等级都没有踢出权限。主人只能解除自己造成的主人禁言，不能解除群规、自我禁言、对象禁言或管理防解除。`);
      }

      const masterMuteCommand`, 'master feature level output');

  source = mustReplaceRegex(source,
/      if \(\/\^\[!！\]\(\?:主人踢出\|踢出所属成员\|踢出所屬成員\)\$\/i\.test\(cleanMessage\)\) \{[\s\S]*?\n      \}\n\n      const masterRenameCommand/,
`      if (/^[!！](?:主人踢出|踢出所属成员|踢出所屬成員)$/i.test(cleanMessage)) {
        return jsonReply(`${atSender}主人关系任何等级都没有踢出权限。`);
      }

      const masterRenameCommand`, 'remove master kick execution');
  fs.writeFileSync(path, source);
}

// -----------------------------------------------------------------------------
// Permanent tests and release metadata
// -----------------------------------------------------------------------------
{
  let verify = fs.readFileSync('verify-community-suite.mjs', 'utf8');
  verify = mustReplace(verify,
`import { MASTER_RELATIONSHIP_DEFAULTS } from './src/moderation/partner-bindings.js';
`,
`import { MASTER_RELATIONSHIP_DEFAULT_LEVEL, MASTER_RELATIONSHIP_LEVELS, masterPermissionsForLevel } from './src/moderation/partner-bindings.js';
`, 'verify level import');
  verify = mustReplace(verify,
`assert(MASTER_RELATIONSHIP_DEFAULTS.kick === false, 'Master kick permission must default to disabled');
assert(MASTER_RELATIONSHIP_DEFAULTS.maxMuteSeconds === 1800, 'Master mute must default to a 30 minute maximum');
`,
`assert(MASTER_RELATIONSHIP_DEFAULT_LEVEL === 1, 'New master relationships must start at level 1');
assert(Object.keys(MASTER_RELATIONSHIP_LEVELS).length === 4, 'Master relationships must have four levels');
assert(masterPermissionsForLevel(1).mute && !masterPermissionsForLevel(1).unmute, 'Level 1 must only unlock mute');
assert(masterPermissionsForLevel(2).unmute && !masterPermissionsForLevel(2).recall, 'Level 2 must unlock unmute');
assert(masterPermissionsForLevel(3).recall && !masterPermissionsForLevel(3).rename, 'Level 3 must unlock recall');
assert(masterPermissionsForLevel(4).rename, 'Level 4 must unlock rename');
assert(Object.values(MASTER_RELATIONSHIP_LEVELS).every(level => level.kick === false), 'No master level may grant kick permission');
assert(masterPermissionsForLevel(1).maxMuteSeconds === 60 && masterPermissionsForLevel(4).maxMuteSeconds === 7200, 'Mute limits must scale with master level');
`, 'verify level assertions');
  verify = mustReplace(verify,
`assert(worker.includes('主人权限未开放踢出'), 'Worker must enforce master kick permission');
`,
`assert(worker.includes('主人关系任何等级都没有踢出权限'), 'Worker must permanently reject master kick commands');
assert(!worker.includes('master_member_kicked'), 'Master relationship code must not execute kick actions');
`, 'verify no kick');
  verify = mustReplace(verify,
`assert(suite.includes('listAiDecisionLogs'), 'Decision replay must use the permanent AI decision log');
`,
`assert(suite.includes('listAiDecisionLogs'), 'Decision replay must use the permanent AI decision log');
assert(suite.includes('pol-level'), 'Portal must configure master relationships by level');
assert(!suite.includes('pol-kick'), 'Portal must not expose a master kick permission');
`, 'verify portal levels');
  fs.writeFileSync('verify-community-suite.mjs', verify);

  let masterVerify = fs.readFileSync('verify-master-bindings.mjs', 'utf8');
  masterVerify = mustReplace(masterVerify,
`assert(worker.includes('!主人踢出'), 'Master must be able to kick the sole subordinate member');
`,
`assert(worker.includes('主人关系任何等级都没有踢出权限'), 'Master kick commands must be permanently denied at every level');
`, 'master binding no kick test');
  fs.writeFileSync('verify-master-bindings.mjs', masterVerify);

  const pkgPath = 'package.json';
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkg.version = '2.5.1';
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

  const configPath = 'src/config/runtime.js';
  let config = fs.readFileSync(configPath, 'utf8');
  config = mustReplace(config, 'const VERSION = "2.5.0";', 'const VERSION = "2.5.1";', 'runtime version');
  fs.writeFileSync(configPath, config);

  const releasePath = 'release-notes.json';
  const notes = JSON.parse(fs.readFileSync(releasePath, 'utf8'));
  notes.version = '2.5.1';
  notes.added = [
    '主人关系改为四级成长制：Lv.1 禁言、Lv.2 解禁、Lv.3 撤回、Lv.4 修改群名片',
    '主人等级同时控制最大禁言时长：60 秒、10 分钟、30 分钟、2 小时',
    'Portal 主人关系权限改为等级选择，并显示每级解锁内容与当前上限'
  ];
  notes.fixed = [
    '彻底移除主人关系的踢出执行路径与网页开关；任何等级都不会获得踢出权限',
    '旧主人关系会依据原有安全能力自动推算等级，新关系统一从 Lv.1 开始'
  ];
  fs.writeFileSync(releasePath, JSON.stringify(notes, null, 2) + '\n');
  replaceVersionAssertions();
}

console.log('Master relationship levels v2.5.1 applied');
