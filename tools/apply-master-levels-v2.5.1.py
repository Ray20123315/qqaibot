from pathlib import Path
import json
import re


def must_replace(source: str, before: str, after: str, label: str) -> str:
    if before not in source:
        raise RuntimeError(f"Missing anchor: {label}")
    return source.replace(before, after, 1)


def must_regex(source: str, pattern: str, after: str, label: str) -> str:
    next_source, count = re.subn(pattern, after, source, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError(f"Missing regex anchor: {label}")
    return next_source


# Master relationship level model
path = Path("src/moderation/partner-bindings.js")
source = path.read_text()
source = must_replace(source, '''const PARTNER_REQUEST_TTL_MS = 10 * 60 * 1000;
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
''', '''const PARTNER_REQUEST_TTL_MS = 10 * 60 * 1000;
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
''', "master level constants")
source = must_replace(source, '''  const validMasterPair = mode !== "master" || Boolean(masterId && memberId && masterId !== memberId && relationshipRole);
  return {
''', '''  const validMasterPair = mode !== "master" || Boolean(masterId && memberId && masterId !== memberId && relationshipRole);
  const level = mode === "master" ? normalizeMasterLevel(source.level, inferMasterLevelFromLegacyPermissions(source.permissions)) : 0;
  return {
''', "binding level normalization")
source = must_replace(source, '''    memberId,
    permissions: mode === "master" ? normalizeMasterPermissions(source.permissions) : null,
''', '''    memberId,
    level,
    permissions: mode === "master" ? masterPermissionsForLevel(level) : null,
''', "binding level output")
source = must_replace(source, '  const common = { active: true, groupId: group, mode: request.mode === "master" ? "master" : "partner", permissions: request.mode === "master" ? { ...MASTER_RELATIONSHIP_DEFAULTS } : null, createdAt: now, requestId: request.id };\n', '  const common = { active: true, groupId: group, mode: request.mode === "master" ? "master" : "partner", level: request.mode === "master" ? MASTER_RELATIONSHIP_DEFAULT_LEVEL : 0, permissions: request.mode === "master" ? masterPermissionsForLevel(MASTER_RELATIONSHIP_DEFAULT_LEVEL) : null, createdAt: now, requestId: request.id };\n', "consent level defaults")
source = must_replace(source, '''      userIds: [binding.masterId, binding.memberId],
      permissions: binding.permissions,
''', '''      userIds: [binding.masterId, binding.memberId],
      level: binding.level,
      permissions: binding.permissions,
''', "list relationship level")
source = must_replace(source, '  const common = { active: true, groupId: group, mode: "master", masterId: master, memberId: member, permissions: { ...MASTER_RELATIONSHIP_DEFAULTS }, createdAt: now, requestId, direct: true, createdBy: actor };\n', '  const common = { active: true, groupId: group, mode: "master", masterId: master, memberId: member, level: MASTER_RELATIONSHIP_DEFAULT_LEVEL, permissions: masterPermissionsForLevel(MASTER_RELATIONSHIP_DEFAULT_LEVEL), createdAt: now, requestId, direct: true, createdBy: actor };\n', "direct level defaults")
source = must_regex(source, r'async function updateMasterBindingPermissions\(env, groupId, userId, patch, updatedBy = ""\) \{.*?\n\}\nasync function clearPartnerBinding', '''async function updateMasterBindingLevel(env, groupId, userId, requestedLevel, updatedBy = "") {
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
async function clearPartnerBinding''', "replace permission updater")
source = must_replace(source, '''export {
  MASTER_RELATIONSHIP_DEFAULTS,
  PARTNER_REQUEST_TTL_MS,
''', '''export {
  MASTER_RELATIONSHIP_DEFAULT_LEVEL,
  MASTER_RELATIONSHIP_DEFAULTS,
  MASTER_RELATIONSHIP_LEVELS,
  MASTER_RELATIONSHIP_MAX_LEVEL,
  PARTNER_REQUEST_TTL_MS,
''', "export level constants")
source = must_replace(source, '''  listGroupBindings,
  normalizeMasterPermissions,
  partnerBindingKey,
  updateMasterBindingPermissions
''', '''  listGroupBindings,
  masterPermissionsForLevel,
  normalizeMasterLevel,
  normalizeMasterPermissions,
  partnerBindingKey,
  updateMasterBindingLevel,
  updateMasterBindingPermissions
''', "export level helpers")
path.write_text(source)

# Portal level control
path = Path("src/portal/community-suite.js")
source = path.read_text()
source = must_replace(source, 'import { MASTER_RELATIONSHIP_DEFAULTS, listGroupBindings, updateMasterBindingPermissions } from "../moderation/partner-bindings.js";\n', 'import { MASTER_RELATIONSHIP_LEVELS, listGroupBindings, updateMasterBindingLevel } from "../moderation/partner-bindings.js";\n', "portal level imports")
source = must_replace(source, '''  if (request.method === "GET" && path === "/members/relationships/policies") {
    const relationships = await listGroupBindings(env, groupId);
    return jsonResponse({ ok: true, relationships });
  }
''', '''  if (request.method === "GET" && path === "/members/relationships/policies") {
    const relationships = await listGroupBindings(env, groupId);
    return jsonResponse({ ok: true, relationships, levels: Object.values(MASTER_RELATIONSHIP_LEVELS) });
  }
''', "portal policy levels")
source = must_replace(source, '''    const result = await updateMasterBindingPermissions(env, groupId, userId, body?.permissions || {}, authed.qq);
    if (!result.ok) return jsonResponse(result, 400);
    await writeSystemAudit(env, { type: "portal_master_permissions", groupId, actorId: authed.qq, targetId: result.binding.memberId, action: "update", permissions: result.binding.permissions }).catch(() => {});
    return jsonResponse({ ok: true, message: "主人关系权限已更新。", relationship: result.binding });
''', '''    const result = await updateMasterBindingLevel(env, groupId, userId, body?.level, authed.qq);
    if (!result.ok) return jsonResponse(result, 400);
    await writeSystemAudit(env, { type: "portal_master_level", groupId, actorId: authed.qq, targetId: result.binding.memberId, action: "update", level: result.binding.level, permissions: result.binding.permissions }).catch(() => {});
    return jsonResponse({ ok: true, message: `主人关系等级已更新为 Lv.${result.binding.level}。任何等级都不提供踢出权限。`, relationship: result.binding });
''', "portal policy update")
source = must_replace(source, '    <div class="section-head compact"><div><h3>主人关系权限</h3><p>踢出默认关闭；可分别限制禁言、解禁、撤回、改名及最大禁言时长。</p></div><button id="suitePolicyRefresh" class="btn ghost">刷新权限</button></div>\n', '    <div class="section-head compact"><div><h3>主人关系等级</h3><p>等级越高自动解锁更多功能：Lv.1 禁言、Lv.2 解禁、Lv.3 撤回、Lv.4 改名。任何等级都没有踢出权限。</p></div><button id="suitePolicyRefresh" class="btn ghost">刷新等级</button></div>\n', "portal policy card")
source = must_replace(source, '  var selected=new Set(),suiteMembers=[],suiteProfiles={},suiteRelationships=[],suiteStickers=[],suiteDecisions=[];\n', '  var selected=new Set(),suiteMembers=[],suiteProfiles={},suiteRelationships=[],suiteStickers=[],suiteDecisions=[],suiteMasterLevels=[];\n', "portal level state")
old_client = '''  async function loadPolicies(){var r=await call('/members/relationships/policies');if(!r.ok){e('suitePolicyList').innerHTML='<div class="empty">'+esc(r.message||'读取失败')+'</div>';return}suiteRelationships=r.relationships||[];var masters=suiteRelationships.filter(function(x){return x.mode==='master'});e('suitePolicyList').innerHTML=masters.map(function(x){var p=x.permissions||{},id=x.masterId||((x.userIds||[])[0]);return'<div class="item suite-policy-row" data-user-id="'+esc(id)+'"><div><div class="member-name">主人 QQ '+esc(x.masterId)+' → 所属成员 QQ '+esc(x.memberId)+'</div><div class="member-meta">踢出默认关闭；设置对关系双方同时生效。</div></div><div class="suite-policy-controls"><label><input class="pol-mute" type="checkbox" '+(p.mute!==false?'checked':'')+'>禁言</label><label><input class="pol-unmute" type="checkbox" '+(p.unmute!==false?'checked':'')+'>解禁</label><label><input class="pol-recall" type="checkbox" '+(p.recall!==false?'checked':'')+'>撤回</label><label><input class="pol-rename" type="checkbox" '+(p.rename!==false?'checked':'')+'>改名</label><label><input class="pol-kick" type="checkbox" '+(p.kick===true?'checked':'')+'>踢出</label><input class="pol-max" type="number" min="1" max="2592000" value="'+esc(p.maxMuteSeconds||1800)+'" title="最大禁言秒数"><button class="btn suite-policy-save">保存</button></div></div>'}).join('')||'<div class="empty">当前没有主人关系</div>'}
  async function savePolicy(button){var row=button.closest('.suite-policy-row'),r=await call('/members/relationships/policy','POST',{userId:row.dataset.userId,permissions:{mute:row.querySelector('.pol-mute').checked,unmute:row.querySelector('.pol-unmute').checked,recall:row.querySelector('.pol-recall').checked,rename:row.querySelector('.pol-rename').checked,kick:row.querySelector('.pol-kick').checked,maxMuteSeconds:Number(row.querySelector('.pol-max').value||1800)}});toastMessage(r.message||'操作完成');if(r.ok)loadPolicies()}
'''
new_client = '''  function levelOptions(selectedLevel){return suiteMasterLevels.map(function(level){return'<option value="'+esc(level.level)+'" '+(Number(level.level)===Number(selectedLevel)?'selected':'')+'>'+esc(level.label)+'｜'+esc(level.unlock)+'｜禁言上限 '+esc(level.maxMuteSeconds)+' 秒</option>'}).join('')}
  async function loadPolicies(){var r=await call('/members/relationships/policies');if(!r.ok){e('suitePolicyList').innerHTML='<div class="empty">'+esc(r.message||'读取失败')+'</div>';return}suiteRelationships=r.relationships||[];suiteMasterLevels=r.levels||[];var masters=suiteRelationships.filter(function(x){return x.mode==='master'});e('suitePolicyList').innerHTML=masters.map(function(x){var p=x.permissions||{},id=x.masterId||((x.userIds||[])[0]),level=Number(x.level||1),unlocked=[p.mute?'禁言':'',p.unmute?'解禁':'',p.recall?'撤回':'',p.rename?'改名':''].filter(Boolean).join('、');return'<div class="item suite-policy-row" data-user-id="'+esc(id)+'"><div><div class="member-name">主人 QQ '+esc(x.masterId)+' → 所属成员 QQ '+esc(x.memberId)+'</div><div class="member-meta">当前 Lv.'+esc(level)+'｜已解锁 '+esc(unlocked||'无')+'｜禁言上限 '+esc(p.maxMuteSeconds||60)+' 秒｜踢出永久不可用</div></div><div class="suite-policy-controls"><select class="pol-level">'+levelOptions(level)+'</select><button class="btn suite-policy-save">保存等级</button></div></div>'}).join('')||'<div class="empty">当前没有主人关系</div>'}
  async function savePolicy(button){var row=button.closest('.suite-policy-row'),r=await call('/members/relationships/policy','POST',{userId:row.dataset.userId,level:Number(row.querySelector('.pol-level').value||1)});toastMessage(r.message||'操作完成');if(r.ok)loadPolicies()}
'''
source = must_replace(source, old_client, new_client, "portal level client")
source = source.replace("window.__qqaiCommunitySuite={version:'2.5.0'", "window.__qqaiCommunitySuite={version:'2.5.1'", 1)
path.write_text(source)

# Worker commands and hard kick prohibition
path = Path("worker.js")
source = path.read_text()
source = must_replace(source, 'import { MASTER_RELATIONSHIP_DEFAULTS, clearPartnerBinding, createMasterBindingRequest, createPartnerBindingRequest, decidePartnerBindingRequest, getBindingRequest, getPartnerBinding } from "./src/moderation/partner-bindings.js";\n', 'import { MASTER_RELATIONSHIP_DEFAULTS, MASTER_RELATIONSHIP_MAX_LEVEL, clearPartnerBinding, createMasterBindingRequest, createPartnerBindingRequest, decidePartnerBindingRequest, getBindingRequest, getPartnerBinding } from "./src/moderation/partner-bindings.js";\n', "worker level import")
source = must_replace(source, '          ? `[CQ:at,qq=${pending.masterId}] 已成为主人；[CQ:at,qq=${pending.memberId}] 已成为所属成员。主人可直接禁言、解除主人禁言、踢出、修改群名片及撤回所属成员的消息；其他来源的处罚不能由主人解除。`\n', '          ? `[CQ:at,qq=${pending.masterId}] 已成为主人；[CQ:at,qq=${pending.memberId}] 已成为所属成员。关系从 Lv.1 开始，仅解锁短时禁言；提升等级后可依序解锁解禁、撤回与修改群名片。任何等级都没有踢出权限。`\n', "approval level message")
source = must_replace(source, '''            ? `${atSender}你是主人；所属成员是 ${otherName}（QQ:${binding.memberId}）。可使用「!主人功能」查看权限。`
            : `${atSender}你的主人是 ${otherName}（QQ:${binding.masterId}）。主人只可直接管理你，不能解除其他来源的处罚。`);
''', '''            ? `${atSender}你是主人；所属成员是 ${otherName}（QQ:${binding.memberId}），当前等级 Lv.${binding.level || 1}。可使用「!主人功能」查看权限。`
            : `${atSender}你的主人是 ${otherName}（QQ:${binding.masterId}），当前等级 Lv.${binding.level || 1}。主人只可使用该等级已解锁能力，且任何等级都不能踢出你。`);
''', "relationship status level")
source = must_regex(source, r'      if \(/\^\[!！\]\(\?:主人功能\|主人权限\|主人權限\)\$\/i\.test\(cleanMessage\)\) \{.*?\n      \}\n\n      const masterMuteCommand', '''      if (/^[!！](?:主人功能|主人权限|主人權限)$/i.test(cleanMessage)) {
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

      const masterMuteCommand''', "master feature level output")
source = must_regex(source, r'      if \(/\^\[!！\]\(\?:主人踢出\|踢出所属成员\|踢出所屬成員\)\$\/i\.test\(cleanMessage\)\) \{.*?\n      \}\n\n      const masterRenameCommand', '''      if (/^[!！](?:主人踢出|踢出所属成员|踢出所屬成員)$/i.test(cleanMessage)) {
        return jsonReply(`${atSender}主人关系任何等级都没有踢出权限。`);
      }

      const masterRenameCommand''', "remove master kick execution")
path.write_text(source)

# Permanent tests and release metadata
path = Path("verify-community-suite.mjs")
verify = path.read_text()
verify = must_replace(verify, "import { MASTER_RELATIONSHIP_DEFAULTS } from './src/moderation/partner-bindings.js';\n", "import { MASTER_RELATIONSHIP_DEFAULT_LEVEL, MASTER_RELATIONSHIP_LEVELS, masterPermissionsForLevel } from './src/moderation/partner-bindings.js';\n", "verify level import")
verify = must_replace(verify, '''assert(MASTER_RELATIONSHIP_DEFAULTS.kick === false, 'Master kick permission must default to disabled');
assert(MASTER_RELATIONSHIP_DEFAULTS.maxMuteSeconds === 1800, 'Master mute must default to a 30 minute maximum');
''', '''assert(MASTER_RELATIONSHIP_DEFAULT_LEVEL === 1, 'New master relationships must start at level 1');
assert(Object.keys(MASTER_RELATIONSHIP_LEVELS).length === 4, 'Master relationships must have four levels');
assert(masterPermissionsForLevel(1).mute && !masterPermissionsForLevel(1).unmute, 'Level 1 must only unlock mute');
assert(masterPermissionsForLevel(2).unmute && !masterPermissionsForLevel(2).recall, 'Level 2 must unlock unmute');
assert(masterPermissionsForLevel(3).recall && !masterPermissionsForLevel(3).rename, 'Level 3 must unlock recall');
assert(masterPermissionsForLevel(4).rename, 'Level 4 must unlock rename');
assert(Object.values(MASTER_RELATIONSHIP_LEVELS).every(level => level.kick === false), 'No master level may grant kick permission');
assert(masterPermissionsForLevel(1).maxMuteSeconds === 60 && masterPermissionsForLevel(4).maxMuteSeconds === 7200, 'Mute limits must scale with master level');
''', "verify level assertions")
verify = must_replace(verify, "assert(worker.includes('主人权限未开放踢出'), 'Worker must enforce master kick permission');\n", "assert(worker.includes('主人关系任何等级都没有踢出权限'), 'Worker must permanently reject master kick commands');\nassert(!worker.includes('master_member_kicked'), 'Master relationship code must not execute kick actions');\n", "verify no kick")
verify = must_replace(verify, "assert(suite.includes('listAiDecisionLogs'), 'Decision replay must use the permanent AI decision log');\n", "assert(suite.includes('listAiDecisionLogs'), 'Decision replay must use the permanent AI decision log');\nassert(suite.includes('pol-level'), 'Portal must configure master relationships by level');\nassert(!suite.includes('pol-kick'), 'Portal must not expose a master kick permission');\n", "verify portal levels")
path.write_text(verify)

path = Path("verify-master-bindings.mjs")
verify = path.read_text()
verify = must_replace(verify, "assert(worker.includes('!主人踢出'), 'Master must be able to kick the sole subordinate member');\n", "assert(worker.includes('主人关系任何等级都没有踢出权限'), 'Master kick commands must be permanently denied at every level');\n", "master binding no kick test")
path.write_text(verify)

pkg_path = Path("package.json")
pkg = json.loads(pkg_path.read_text())
pkg["version"] = "2.5.1"
pkg_path.write_text(json.dumps(pkg, ensure_ascii=False, indent=2) + "\n")

config_path = Path("src/config/runtime.js")
config = config_path.read_text()
config = must_replace(config, 'const VERSION = "2.5.0";', 'const VERSION = "2.5.1";', "runtime version")
config_path.write_text(config)

release_path = Path("release-notes.json")
notes = json.loads(release_path.read_text())
notes["version"] = "2.5.1"
notes["added"] = [
    "主人关系改为四级成长制：Lv.1 禁言、Lv.2 解禁、Lv.3 撤回、Lv.4 修改群名片",
    "主人等级同时控制最大禁言时长：60 秒、10 分钟、30 分钟、2 小时",
    "Portal 主人关系权限改为等级选择，并显示每级解锁内容与当前上限"
]
notes["fixed"] = [
    "彻底移除主人关系的踢出执行路径与网页开关；任何等级都不会获得踢出权限",
    "旧主人关系会依据原有安全能力自动推算等级，新关系统一从 Lv.1 开始"
]
release_path.write_text(json.dumps(notes, ensure_ascii=False, indent=2) + "\n")

for verify_path in Path('.').glob('verify-*.mjs'):
    text = verify_path.read_text()
    if '2.5.0' in text:
        verify_path.write_text(text.replace('2.5.0', '2.5.1'))

print('Master relationship levels v2.5.1 applied')
