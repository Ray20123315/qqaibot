from pathlib import Path
import json, re, sys

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else '.')

def read(rel): return (ROOT/rel).read_text(encoding='utf-8')
def write(rel, text):
    p=ROOT/rel; p.parent.mkdir(parents=True, exist_ok=True); p.write_text(text, encoding='utf-8')
def replace_once(text, old, new, label):
    count=text.count(old)
    if count != 1:
        raise AssertionError(f'{label}: expected 1 occurrence, got {count}')
    return text.replace(old,new,1)

# New deterministic political policy.
write('src/policy/political-topics.js', '''const POLITICAL_PATTERNS = Object.freeze([
  { category: "explicit_politics", pattern: /(?:政治(?:话题|話題|问题|問題|立场|立場|观点|觀點|制度|讨论|討論)?|建政|涉政|意识形态|意識形態|地缘政治|地緣政治|时政|時政)/i },
  { category: "election_party", pattern: /(?:选举|選舉|大选|大選|公投|政党|政黨|执政党|執政黨|在野党|在野黨|反对党|反對黨|竞选|競選|候选人|候選人|投票给|投票給)/i },
  { category: "government_office", pattern: /(?:总统|總統|国家主席|國家主席|总理|總理|首相|国家领导人|國家領導人|政府(?:政策|施政|改组|改組)?|国会|國會|议会|議會|立法院|国务院|國務院|外交部|国防部|國防部)/i },
  { category: "ideology", pattern: /(?:民主主义|民主主義|共产主义|共產主義|社会主义|社會主義|资本主义|資本主義|自由主义|自由主義|民族主义|民族主義|左派|右派|极左|極左|极右|極右|独裁|獨裁|威权|威權)/i },
  { category: "sovereignty_conflict", pattern: /(?:主权|主權|领土争议|領土爭議|台独|台獨|港独|港獨|藏独|藏獨|疆独|疆獨|两岸|兩岸|统一台湾|統一台灣|台湾独立|台灣獨立|南海争端|南海爭端)/i },
  { category: "sensitive_history", pattern: /(?:六四|天安门事件|天安門事件|文化大革命|文革|大跃进|大躍進|反右运动|反右運動)/i },
  { category: "public_policy", pattern: /(?:公共政策|政府法案|政治改革|宪政|憲政|外交政策|经济制裁|經濟制裁|国际制裁|國際制裁|政治新闻|政治新聞|政治人物|政治事件)/i }
]);

const FICTIONAL_CONTEXT_RE = /(?:游戏|遊戲|小说|小說|动漫|動漫|动画|動畫|漫画|漫畫|电影|電影|电视剧|電視劇|影集|角色|剧情|劇情|世界观|世界觀|设定|設定|虚构|虛構|架空|桌游|桌遊|剧本杀|劇本殺|狼人杀|狼人殺)/i;
function normalizePoliticalTopicText(value) {
  return String(value || "")
    .replace(/\[CQ:[^\]]+\]/gi, " ")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4000);
}

function classifyPoliticalTopic(value) {
  const text = normalizePoliticalTopicText(value);
  if (!text) return { blocked: false, category: "", matches: [], reason: "empty" };
  const matches = POLITICAL_PATTERNS.filter(item => item.pattern.test(text));
  if (!matches.length) return { blocked: false, category: "", matches: [], reason: "no_political_signal" };
  const categories = [...new Set(matches.map(item => item.category))];
  const fictionalOnly = FICTIONAL_CONTEXT_RE.test(text)
    && categories.every(category => category === "government_office" || category === "ideology");
  if (fictionalOnly) return { blocked: false, category: "fictional_context", matches: categories, reason: "fictional_or_game_context" };
  return {
    blocked: true,
    category: categories[0],
    matches: categories.slice(0, 6),
    reason: "deterministic_political_topic_filter"
  };
}

export { POLITICAL_PATTERNS, classifyPoliticalTopic, normalizePoliticalTopicText };
''')

# New shared paging helper.
write('src/data/pagination.js', '''const PORTAL_PAGE_SIZE_MAX = 100;
const PORTAL_PAGE_SIZE_DEFAULT = 50;

function positiveInteger(value, fallback) {
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizePortalPagination(pageValue, pageSizeValue, defaultPageSize = PORTAL_PAGE_SIZE_DEFAULT) {
  const page = positiveInteger(pageValue, 1);
  const fallback = Math.max(1, Math.min(PORTAL_PAGE_SIZE_MAX, positiveInteger(defaultPageSize, PORTAL_PAGE_SIZE_DEFAULT)));
  const pageSize = Math.max(1, Math.min(PORTAL_PAGE_SIZE_MAX, positiveInteger(pageSizeValue, fallback)));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

async function collectFilteredPage(values, options = {}) {
  const rows = Array.isArray(values) ? values : [];
  const paging = normalizePortalPagination(options.page, options.pageSize, options.defaultPageSize);
  const maxScan = Math.max(paging.pageSize + 1, positiveInteger(options.maxScan, rows.length || paging.pageSize + 1));
  const load = typeof options.load === "function" ? options.load : async value => value;
  const match = typeof options.match === "function" ? options.match : () => true;
  const select = typeof options.select === "function" ? options.select : async value => value;
  const items = [];
  let matched = 0;
  let scanned = 0;
  let hasMore = false;
  let scanLimitReached = false;

  for (let index = 0; index < rows.length; index += 1) {
    if (scanned >= maxScan) {
      scanLimitReached = true;
      hasMore = true;
      break;
    }
    scanned += 1;
    const loaded = await load(rows[index], index);
    if (!loaded || !await match(loaded, rows[index], index)) continue;
    if (matched < paging.offset) {
      matched += 1;
      continue;
    }
    if (items.length >= paging.pageSize) {
      hasMore = true;
      break;
    }
    items.push(await select(loaded, rows[index], index));
    matched += 1;
  }

  return {
    items,
    pageInfo: {
      page: paging.page,
      pageSize: paging.pageSize,
      returned: items.length,
      hasMore,
      previousPage: paging.page > 1 ? paging.page - 1 : null,
      nextPage: hasMore ? paging.page + 1 : null,
      scanned,
      scanLimitReached
    }
  };
}

export { PORTAL_PAGE_SIZE_DEFAULT, PORTAL_PAGE_SIZE_MAX, collectFilteredPage, normalizePortalPagination };
''')

# Worker changes.
w = read('worker.js')
w = replace_once(w,
'import { appendChatHistoryTurn, clearChatSessionHistory, dbDel, dbGet, dbPut, readChatHistory, withTimeout } from "./src/data/store.js";',
'import { appendChatHistoryTurn, clearChatSessionHistory, dbDel, dbGet, dbPut, readChatHistory, withTimeout } from "./src/data/store.js";\nimport { classifyPoliticalTopic } from "./src/policy/political-topics.js";',
'worker political import')
w = replace_once(w,
'    let sameQqSelfAsk = false;\n    let sameQqHumanOnly = false;',
'    let sameQqSelfAsk = false;\n    let sameQqHumanOnly = false;\n    let trustedSelfOperator = false;',
'worker trusted self declaration')
w = replace_once(w,
'      const isDeveloper = (env.DEVELOPER_ID ? userId === env.DEVELOPER_ID.toString() : false) || userId === "3569028262";',
'      let isDeveloper = (env.DEVELOPER_ID ? userId === env.DEVELOPER_ID.toString() : false) || userId === "3569028262";',
'worker mutable developer')
old_self='''        // Worker 自己通过 API 发出的消息必须继续按 Message ID／发送前指纹排除，避免形成回音循环。
        // // 与 ?? 保持既有人工同号行为；/! 虽是人工聊天别名，仍额外检查发送指纹。
        if (!explicitSelfChat || explicitSelfSlashBang) {
          const apiMessage = await isKnownOutboundMessage(env, {
            messageId: replyMessageId,
            isGroup,
            groupId: currentGroupId,
            peerId: String(body.target_id || body.peer_id || rawUserId || userId),
            text: explicitSelfSlashBang ? selfSlashBangRawText : cleanMessage,
            mediaTypes: [(imageUrl || imageFile) ? 'image' : '', (voiceUrl || voiceFile) ? 'record' : '', (videoUrl || videoFile) ? 'video' : ''].filter(Boolean)
          });
          if (apiMessage) return new Response(null, { status: 204 });
        }

        if (cleanMessage.startsWith('//')) {'''
new_self='''        // 任何同号输入都先按 Message ID／发送前指纹排除。人工从 QQ 客户端发出的消息没有
        // Worker 出站指纹，可以继续；机器人 API 自己发出的文字即使碰巧以 !、//、?? 或 /! 开头也会被拦下。
        const apiMessage = await isKnownOutboundMessage(env, {
          messageId: replyMessageId,
          isGroup,
          groupId: currentGroupId,
          peerId: String(body.target_id || body.peer_id || rawUserId || userId),
          text: explicitSelfSlashBang ? selfSlashBangRawText : cleanMessage,
          mediaTypes: [(imageUrl || imageFile) ? 'image' : '', (voiceUrl || voiceFile) ? 'record' : '', (videoUrl || videoFile) ? 'video' : ''].filter(Boolean)
        });
        if (apiMessage) return new Response(null, { status: 204 });
        trustedSelfOperator = explicitSelfChat || explicitSelfCommand;
        if (trustedSelfOperator) {
          isDeveloper = true;
          ctx.waitUntil(writeSystemAudit(env, {
            type: "self_account_operator_input",
            groupId: currentGroupId,
            actorId: eventSelfId,
            action: explicitSelfCommand ? "command" : explicitSelfSlashBang ? "slash_bang_chat" : cleanMessage.startsWith("//") ? "double_slash_chat" : "double_question_chat",
            postType: String(body.post_type || ""),
            messageId: replyMessageId
          }).catch(() => {}));
        }

        if (cleanMessage.startsWith('//')) {'''
w = replace_once(w, old_self, new_self, 'worker self block')
# Political assessment before any optional natural language model classifier.
w = replace_once(w,
'      let privateAccessChecked = false;\n\n      // 自我禁言只能由本人私讯解除。',
'      let privateAccessChecked = false;\n      const politicalTopic = !isCommandMessage && !aiReplyOptOut ? classifyPoliticalTopic(cleanMessage) : { blocked: false, category: "", matches: [], reason: "command_or_opt_out" };\n\n      // 自我禁言只能由本人私讯解除。',
'worker political assessment')
w = replace_once(w,
'        if (!isCommandMessage && !aiReplyOptOut) {',
'        if (!isCommandMessage && !aiReplyOptOut && !politicalTopic.blocked) {',
'worker private natural guard')
w = replace_once(w,
'      const naturalLanguageTrigger = !aiReplyOptOut && !isCommandMessage && (isPrivate || botMentioned || repliedToBot || sameQqSelfAsk);',
'      const naturalLanguageTrigger = !aiReplyOptOut && !isCommandMessage && !politicalTopic.blocked && (isPrivate || botMentioned || repliedToBot || sameQqSelfAsk);',
'worker general natural guard')
# Permission comment and effective trust (isDeveloper was promoted above).
w = replace_once(w,
'      // 權限拆分：AI 管理與真正群操作互不混用。\n      const permissionSet = await getEffectivePermissions(env, currentGroupId, userId, senderRole, isDeveloper);',
'      // 權限拆分：AI 管理與真正群操作互不混用。受信任同号输入只有在明确前缀和出站指纹检查后才会把 isDeveloper 提升为 true。\n      const permissionSet = await getEffectivePermissions(env, currentGroupId, userId, senderRole, isDeveloper);',
'worker permission comment')
# Political silent block after background rule monitor scheduling.
anchor='''      if (isGroup && !operationsHighRiskPaused && !isCommandMessage && !isSelfAccount && (cleanMessage.length > 0 || ((imageUrl || imageFile) && imageInspectionConfigured)) && await dbGet(env, `rule_monitor_enabled:${currentGroupId}`) !== "false") {
        // 在后台检查；群规文字优先，图片作为直接证据一并送入 Google 判断链。检查器会先即时确认机器人为群主／管理员。
        ctx.waitUntil(inspectMessageAgainstGroupRules(env, { groupId: currentGroupId, userId, senderName: senderCard, senderRole: isDeveloper ? "developer" : senderRole, text: cleanMessage || ((imageUrl || imageFile) ? "[图片]" : ""), messageId: replyMessageId, imageUrl, imageFile, mentionedQqs, quotedSenderId: String(quotedMessage?.senderId || "") }));
      }

      // 维护／紧急锁定时暂停主动插话，但保留群友主动 @Bot 的一般聊天。'''
replacement='''      if (isGroup && !operationsHighRiskPaused && !isCommandMessage && !isSelfAccount && (cleanMessage.length > 0 || ((imageUrl || imageFile) && imageInspectionConfigured)) && await dbGet(env, `rule_monitor_enabled:${currentGroupId}`) !== "false") {
        // 在后台检查；群规文字优先，图片作为直接证据一并送入 Google 判断链。检查器会先即时确认机器人为群主／管理员。
        ctx.waitUntil(inspectMessageAgainstGroupRules(env, { groupId: currentGroupId, userId, senderName: senderCard, senderRole: isDeveloper ? "developer" : senderRole, text: cleanMessage || ((imageUrl || imageFile) ? "[图片]" : ""), messageId: replyMessageId, imageUrl, imageFile, mentionedQqs, quotedSenderId: String(quotedMessage?.senderId || "") }));
      }

      // 政治相关普通聊天在确定性分类后静默终止。群规监控可在上方独立记录，
      // 但不会进入自然语言命令模型、社交规划、检索、记忆或一般聊天模型，也不会发送警告回覆。
      if (politicalTopic.blocked && !isCommandMessage) {
        const politicalTrigger = botMentioned ? "mention" : repliedToBot ? "reply_to_ai" : sameQqSelfAsk ? "self_ask" : isPrivate ? "private" : "none";
        ctx.waitUntil(writeAiDecisionLog(env, {
          ...aiDecisionBase,
          decision: "blocked",
          reason: "political_topic_filter",
          triggerType: politicalTrigger,
          policyCategory: politicalTopic.category,
          policyMatches: politicalTopic.matches,
          sendStatus: "not_applicable"
        }).catch(() => {}));
        ctx.waitUntil(writeSystemAudit(env, {
          type: "political_topic_filtered",
          groupId: currentGroupId,
          actorId: userId,
          action: "silent_block",
          category: politicalTopic.category,
          matches: politicalTopic.matches,
          messageId: replyMessageId
        }).catch(() => {}));
        return new Response(null, { status: 204 });
      }

      // 维护／紧急锁定时暂停主动插话，但保留群友主动 @Bot 的一般聊天。'''
w = replace_once(w, anchor, replacement, 'worker political silent block')
# Replace old political prompt.
old_policy='''1. 政治红线（智能求生欲）：严格遵守中国大陆平台（QQ）的审查底线，防范真正的封号风险。
- 【允许回答】：公开的国际地理、普通历史百科事实、外国元首名字等纯客观常识（例如问“法国现任总统是谁”、“大众汽车是哪国的”）。请用群友的口吻极简、客观地直接回答，绝对不要进行任何政治体制、意识形态的延伸讨论。
- 【绝对禁止】：任何涉及中国本土当代政治、国家领导人、敏感历史事件、领土争议、时政热点新闻评论或任何带有主观立场的敏感话题。
- 【严厉警告机制】：只有当群友故意聊起【绝对禁止】的严重违规话题时，你才必须立刻收起人设，切换为极度严肃的语气明确警告对方：“无法回答此类问题。您的发言已涉嫌违反平台政治敏感内容管理规范，请立即停止相关话题，否则将面临封禁风险”。'''
new_policy='''1. 政治内容静默规则：Worker 会在进入模型前确定性过滤现实政治话题。若因边界情况仍在输入中看到现实政治、政党选举、政府政策、政治人物、意识形态、主权争议或敏感政治事件，只能输出 [SKIP]；不得回答、评论、检索、转述，也不得发送警告或解释过滤原因。游戏、小说、影视或明确虚构设定不属于现实政治。'''
w = replace_once(w, old_policy, new_policy, 'worker prompt policy')
# Help same-account usage.
w = replace_once(w,
'                      `私聊申诉：!申诉 群号 类型 详细内容\\n`;',
'                      `私聊申诉：!申诉 群号 类型 详细内容\\n` +\n                      `同号人工控制：机器人 QQ 本人可直接发送 !指令；使用 //内容、??内容 或 /!内容 进行聊天。机器人 API 自发消息仍会被指纹拦截。\\n`;',
'worker help self account')
write('worker.js', w)

# Config version/default.
c=read('src/config/runtime.js')
c=replace_once(c,'const VERSION = "2.7.6";','const VERSION = "2.7.7";','config version')
c=replace_once(c,'  ruleStrictness: "medium",','  ruleStrictness: "smart",','config smart default')
write('src/config/runtime.js',c)

# Core AI decision page.
p=read('src/core/permissions.js')
p=replace_once(p,
'import { dbDel, dbGet, dbPut } from "../data/store.js";',
'import { collectFilteredPage } from "../data/pagination.js";\nimport { dbDel, dbGet, dbPut } from "../data/store.js";',
'permissions pagination import')
insert='''\n\nasync function listAiDecisionLogPage(env, { groupId = "", query = "", decision = "", triggerType = "", page = 1, pageSize = 50 } = {}) {
  const ids = await readJson(env, groupId ? `ai_decision_log:index:${groupId}` : "ai_decision_log:index", []);
  const q = String(query || "").trim().toLowerCase();
  const result = await collectFilteredPage(ids.slice().reverse(), {
    page,
    pageSize,
    defaultPageSize: 50,
    maxScan: DEFAULTS.aiDecisionLogLimit,
    load: id => readJson(env, `ai_decision_log:${id}`, null),
    match: item => {
      if (groupId && String(item.groupId || "") !== String(groupId)) return false;
      if (decision && String(item.decision || "") !== String(decision)) return false;
      if (triggerType && String(item.triggerType || "") !== String(triggerType)) return false;
      if (q && !JSON.stringify(item).toLowerCase().includes(q)) return false;
      return true;
    }
  });
  return { logs: result.items, pageInfo: result.pageInfo };
}
'''
p=replace_once(p,'\n\n\nasync function buildLongGroupConversationContext',insert+'\n\nasync function buildLongGroupConversationContext','permissions page insertion')
p=replace_once(p,
'export { PERMISSIONS, appendIndex, buildLongGroupConversationContext, callOneBotAction, checkRuntimeRateLimit, enrichAuditLogsForPortal, explicitProgramPermissionIndexKey, getEffectivePermissions, getRuntimeRateLimitSeconds, isKnownOutboundMessage, listAiDecisionLogs, listExplicitProgramPermissions, markOutboundPending, modelCapabilityLabel, modelHealthStatusLabel, modelHealthStatusRank, modelPreferenceLabel, normalizeFingerprintText, normalizeMemoryItems, normalizeModelPreference, normalizePermissionName, outboundFingerprint, permissionLabel, removeFromIndex, setExplicitPermission, updateAiDecisionLog, updateExplicitProgramPermissionIndex, writeAiDecisionLog, writeSystemAudit };',
'export { PERMISSIONS, appendIndex, buildLongGroupConversationContext, callOneBotAction, checkRuntimeRateLimit, enrichAuditLogsForPortal, explicitProgramPermissionIndexKey, getEffectivePermissions, getRuntimeRateLimitSeconds, isKnownOutboundMessage, listAiDecisionLogPage, listAiDecisionLogs, listExplicitProgramPermissions, markOutboundPending, modelCapabilityLabel, modelHealthStatusLabel, modelHealthStatusRank, modelPreferenceLabel, normalizeFingerprintText, normalizeMemoryItems, normalizeModelPreference, normalizePermissionName, outboundFingerprint, permissionLabel, removeFromIndex, setExplicitPermission, updateAiDecisionLog, updateExplicitProgramPermissionIndex, writeAiDecisionLog, writeSystemAudit };',
'permissions export')
write('src/core/permissions.js',p)

# Portal imports and endpoints/client.
r=read('src/portal/runtime.js')
r=replace_once(r,
'import { appendIndex, callOneBotAction, enrichAuditLogsForPortal, getEffectivePermissions, getRuntimeRateLimitSeconds, listAiDecisionLogs, listExplicitProgramPermissions, modelCapabilityLabel, modelHealthStatusLabel, modelHealthStatusRank, normalizeModelPreference, normalizePermissionName, removeFromIndex, setExplicitPermission, writeSystemAudit } from "../core/permissions.js";',
'import { appendIndex, callOneBotAction, enrichAuditLogsForPortal, getEffectivePermissions, getRuntimeRateLimitSeconds, listAiDecisionLogPage, listAiDecisionLogs, listExplicitProgramPermissions, modelCapabilityLabel, modelHealthStatusLabel, modelHealthStatusRank, normalizeModelPreference, normalizePermissionName, removeFromIndex, setExplicitPermission, writeSystemAudit } from "../core/permissions.js";\nimport { collectFilteredPage, normalizePortalPagination } from "../data/pagination.js";',
'portal imports')
old_conv='''    const ids = await readJson(env, `conversation:index:${groupId}`, []);
    const q = String(url.searchParams.get("q") || "").trim().toLowerCase();
    const violationOnly = url.searchParams.get("violation") === "1";
    const limit = Math.max(1, Math.min(1000, Number(url.searchParams.get("limit") || 300)));
    const botRuleState = await getBotGroupRole(env, groupId);
    const recordViolationAvailable = botCanRunRuleMonitor(botRuleState);
    const items = [];
    for (const id of ids.slice(-5000).reverse()) {
      const item = await readJson(env, `conversation:${groupId}:${id}`, null);
      if (!item || item.source !== "group_member") continue;
      if (q && !`${item.senderName || ""} ${item.userId || ""} ${item.text || ""} ${JSON.stringify(item.forwardSnapshots || [])}`.toLowerCase().includes(q)) continue;
      if (violationOnly && !item.violationActive) continue;
      const violation = item.violationId ? await readJson(env, `ruleviolation:${item.violationId}`, null) : null;
      items.push({ ...item, violation: violation ? { id: violation.id, type: violation.violationType, reason: violation.reason, actionTaken: violation.actionTaken, actionResult: violation.actionResult, humanVerdict: violation.humanVerdict } : null });
      if (items.length >= limit) break;
    }
    return jsonResponse({ ok: true, items, capabilities: {'''
new_conv='''    const ids = await readJson(env, `conversation:index:${groupId}`, []);
    const q = String(url.searchParams.get("q") || "").trim().toLowerCase();
    const violationOnly = url.searchParams.get("violation") === "1";
    const paging = normalizePortalPagination(url.searchParams.get("page"), url.searchParams.get("pageSize") || url.searchParams.get("limit"), 50);
    const botRuleState = await getBotGroupRole(env, groupId);
    const recordViolationAvailable = botCanRunRuleMonitor(botRuleState);
    const pageResult = await collectFilteredPage(ids.slice(-5000).reverse(), {
      page: paging.page,
      pageSize: paging.pageSize,
      defaultPageSize: 50,
      maxScan: 5000,
      load: id => readJson(env, `conversation:${groupId}:${id}`, null),
      match: item => {
        if (!item || item.source !== "group_member") return false;
        if (q && !`${item.senderName || ""} ${item.userId || ""} ${item.text || ""} ${JSON.stringify(item.forwardSnapshots || [])}`.toLowerCase().includes(q)) return false;
        if (violationOnly && !item.violationActive) return false;
        return true;
      },
      select: async item => {
        const violation = item.violationId ? await readJson(env, `ruleviolation:${item.violationId}`, null) : null;
        return { ...item, violation: violation ? { id: violation.id, type: violation.violationType, reason: violation.reason, actionTaken: violation.actionTaken, actionResult: violation.actionResult, humanVerdict: violation.humanVerdict } : null };
      }
    });
    return jsonResponse({ ok: true, items: pageResult.items, pageInfo: pageResult.pageInfo, capabilities: {'''
r=replace_once(r,old_conv,new_conv,'portal conversations endpoint')
old_ai='''    const logs = await listAiDecisionLogs(env, {
      groupId: requestedGroupId,
      query: url.searchParams.get("q") || "",
      decision: url.searchParams.get("decision") || "",
      triggerType: url.searchParams.get("triggerType") || "",
      limit: Number(url.searchParams.get("limit") || 300)
    });
    return jsonResponse({ ok: true, logs });'''
new_ai='''    const result = await listAiDecisionLogPage(env, {
      groupId: requestedGroupId,
      query: url.searchParams.get("q") || "",
      decision: url.searchParams.get("decision") || "",
      triggerType: url.searchParams.get("triggerType") || "",
      page: url.searchParams.get("page"),
      pageSize: url.searchParams.get("pageSize") || url.searchParams.get("limit") || 50
    });
    return jsonResponse({ ok: true, logs: result.logs, pageInfo: result.pageInfo });'''
r=replace_once(r,old_ai,new_ai,'portal AI endpoint')
# Smart option default static.
r=r.replace('<option value="smart">智慧（自动校准）</option><option value="loose">宽松</option><option value="low">低</option><option value="medium" selected>中</option>', '<option value="smart" selected>智慧（自动校准）</option><option value="loose">宽松</option><option value="low">低</option><option value="medium">中</option>',1)
# View HTML replacements.
old_conv_view="""if(!$('v-conversations').dataset.ready){$('v-conversations').dataset.ready='1';$('v-conversations').innerHTML='<div class="section-head"><div><h2>群友对话记录</h2><p>只记录群友原始消息，不记录 AI 回复或系统消息。管理员可直接处理精华、撤回、群待办、公告、提醒与违规流程。</p></div><button id="convReload" class="btn">重新加载</button></div><div class="card conversation-toolbar"><div class="row"><input id="convSearch" class="grow" placeholder="搜索群友、QQ、消息或转发内容"><label class="switch"><input id="convViolationOnly" type="checkbox">只看违规消息</label><button id="convSearchBtn" class="btn primary">搜索</button></div></div><div id="conversationList" class="list"><div class="empty">尚未加载</div></div>';$('convReload').onclick=loadConversations;$('convSearchBtn').onclick=loadConversations;$('convViolationOnly').onchange=loadConversations;$('convSearch').onkeydown=function(e){if(e.key==='Enter')loadConversations()}}"""
new_conv_view="""if(!$('v-conversations').dataset.ready){$('v-conversations').dataset.ready='1';$('v-conversations').innerHTML='<div class="section-head"><div><h2>群友对话记录</h2><p>只记录群友原始消息，不记录 AI 回复或系统消息。先加载当前页，再按需切换后续页；服务器每页最多 100 条。</p></div><button id="convReload" class="btn">重新加载</button></div><div class="card conversation-toolbar"><div class="row"><input id="convSearch" class="grow" placeholder="搜索群友、QQ、消息或转发内容"><label class="switch"><input id="convViolationOnly" type="checkbox">只看违规消息</label><select id="convPageSize"><option value="25">每页 25 条</option><option value="50" selected>每页 50 条</option><option value="100">每页 100 条</option></select><button id="convSearchBtn" class="btn primary">搜索</button></div><div class="row" style="margin-top:12px"><button id="convPrev" class="btn" disabled>上一页</button><span id="convPageStatus" class="muted">第 1 页</span><button id="convNext" class="btn" disabled>下一页</button></div></div><div id="conversationList" class="list"><div class="empty">尚未加载</div></div>';$('convReload').onclick=function(){loadConversations(conversationPage)};$('convSearchBtn').onclick=function(){loadConversations(1)};$('convViolationOnly').onchange=function(){loadConversations(1)};$('convPageSize').onchange=function(){loadConversations(1)};$('convPrev').onclick=function(){if(conversationPage>1)loadConversations(conversationPage-1)};$('convNext').onclick=function(){loadConversations(conversationPage+1)};$('convSearch').onkeydown=function(e){if(e.key==='Enter')loadConversations(1)}}"""
r=replace_once(r,old_conv_view,new_conv_view,'portal conversation view')
old_ai_view="""if(!$('v-aidecisions').dataset.ready){$('v-aidecisions').dataset.ready='1';$('v-aidecisions').innerHTML='<div class="section-head"><div><h2>AI 回复与未回复记录</h2><p>每則群聊觸發判斷、主動插話來源、模型、智能 @ 規劃、獨立搜索內容與實際發送結果都獨立保存。</p></div><button id="aiLogReload" class="btn">重新加载</button></div><div class="card"><div class="row"><input id="aiLogSearch" class="grow" placeholder="搜索 QQ、訊息、原因、模型"><select id="aiLogDecision"><option value="">全部決策</option><option value="reply_generated">已產生回覆</option><option value="skipped">未回覆</option><option value="blocked">遭阻擋</option><option value="error">錯誤</option></select><select id="aiLogTrigger"><option value="">全部觸發</option><option value="mention">@機器人</option><option value="reply_to_ai">回覆機器人</option><option value="auto_interject">主動插話</option><option value="private">私聊</option><option value="none">未觸發</option></select><button id="aiLogSearchBtn" class="btn primary">搜索</button></div></div><div id="aiDecisionList" class="list" style="margin-top:16px"><div class="empty">尚未加载</div></div>';$('aiLogReload').onclick=loadAiDecisions;$('aiLogSearchBtn').onclick=loadAiDecisions;$('aiLogSearch').onkeydown=function(e){if(e.key==='Enter')loadAiDecisions()}}"""
new_ai_view="""if(!$('v-aidecisions').dataset.ready){$('v-aidecisions').dataset.ready='1';$('v-aidecisions').innerHTML='<div class="section-head"><div><h2>AI 回复与未回复记录</h2><p>先加载当前页，再按需切换后续页；服务器每页最多 100 条，避免一次读取数百条造成页面卡住。</p></div><button id="aiLogReload" class="btn">重新加载</button></div><div class="card"><div class="row"><input id="aiLogSearch" class="grow" placeholder="搜索 QQ、訊息、原因、模型"><select id="aiLogDecision"><option value="">全部決策</option><option value="reply_generated">已產生回覆</option><option value="skipped">未回覆</option><option value="blocked">遭阻擋</option><option value="error">錯誤</option></select><select id="aiLogTrigger"><option value="">全部觸發</option><option value="mention">@機器人</option><option value="reply_to_ai">回覆機器人</option><option value="auto_interject">主動插話</option><option value="private">私聊</option><option value="none">未觸發</option></select><select id="aiLogPageSize"><option value="25">每页 25 条</option><option value="50" selected>每页 50 条</option><option value="100">每页 100 条</option></select><button id="aiLogSearchBtn" class="btn primary">搜索</button></div><div class="row" style="margin-top:12px"><button id="aiLogPrev" class="btn" disabled>上一页</button><span id="aiLogPageStatus" class="muted">第 1 页</span><button id="aiLogNext" class="btn" disabled>下一页</button></div></div><div id="aiDecisionList" class="list" style="margin-top:16px"><div class="empty">尚未加载</div></div>';$('aiLogReload').onclick=function(){loadAiDecisions(aiDecisionPage)};$('aiLogSearchBtn').onclick=function(){loadAiDecisions(1)};$('aiLogDecision').onchange=function(){loadAiDecisions(1)};$('aiLogTrigger').onchange=function(){loadAiDecisions(1)};$('aiLogPageSize').onchange=function(){loadAiDecisions(1)};$('aiLogPrev').onclick=function(){if(aiDecisionPage>1)loadAiDecisions(aiDecisionPage-1)};$('aiLogNext').onclick=function(){loadAiDecisions(aiDecisionPage+1)};$('aiLogSearch').onkeydown=function(e){if(e.key==='Enter')loadAiDecisions(1)}}"""
r=replace_once(r,old_ai_view,new_ai_view,'portal AI view')
# Load function replacements.
start=r.index('async function loadAiDecisions()')
end=r.index('\nvar ruleCategoryPolicies=',start)
old=r[start:end]
new='''var aiDecisionPage=1,aiDecisionGroupId="";
async function loadAiDecisions(page){if(aiDecisionGroupId!==currentGroup){aiDecisionPage=1;aiDecisionGroupId=currentGroup}aiDecisionPage=Math.max(1,Math.floor(Number(page||aiDecisionPage||1)));var list=$('aiDecisionList');if(list)list.innerHTML='<div class="empty">正在加载第 '+aiDecisionPage+' 页…</div>';var p=new URLSearchParams({q:$('aiLogSearch').value||'',decision:$('aiLogDecision').value||'',triggerType:$('aiLogTrigger').value||'',page:String(aiDecisionPage),pageSize:String(Number($('aiLogPageSize').value||50))});var r=await api('/ai-decisions?'+p.toString());if(!r.ok){list.innerHTML='<div class="empty">'+esc(r.message)+'</div>';return}var info=r.pageInfo||{page:aiDecisionPage,pageSize:50,hasMore:false,previousPage:aiDecisionPage>1?aiDecisionPage-1:null,nextPage:null};aiDecisionPage=Number(info.page||aiDecisionPage);$('aiLogPageStatus').textContent='第 '+aiDecisionPage+' 页｜本页 '+Number(info.returned||(r.logs||[]).length)+' 条'+(info.scanLimitReached?'｜已达扫描上限':'');$('aiLogPrev').disabled=!info.previousPage;$('aiLogNext').disabled=!info.nextPage;list.innerHTML=(r.logs||[]).map(function(x){var title=(x.decision||'unknown')+'｜'+(x.senderName||x.userId||'')+'（'+(x.userId||'')+'）';var meta=(x.at||'')+'｜觸發 '+(x.triggerType||'none')+'｜原因 '+(x.reason||'')+'｜'+(x.provider||'')+((x.model)?'/'+x.model:'')+'｜發送 '+(x.sendStatus||'');var body='來源訊息：'+(x.input||'')+(x.generatedReply?'\\nAI 回覆：'+x.generatedReply:'')+'\\n關係：'+JSON.stringify({mentionedQqs:x.mentionedQqs||[],quotedMessageId:x.quotedMessageId||'',quotedSenderId:x.quotedSenderId||''})+'\\n智能 @ 規劃：'+JSON.stringify(x.mentionRouting||{})+'\\n回覆計畫：'+JSON.stringify(x.replyPlan||{})+'\\n是否搜索：'+(x.searchPerformed?'有':'無')+'（需要='+(x.searchRequired?'是':'否')+'，嘗試='+(x.searchAttempted?'是':'否')+'）'+'\\n搜索查詢：'+(x.searchQuery||'')+'\\n搜索關鍵詞：'+JSON.stringify(x.searchQueries||[])+'\\n搜索提供者：'+(x.searchProvider||'')+((x.searchModel)?'/'+x.searchModel:'')+'\\n搜索錯誤：'+(x.searchError||'')+'\\n搜索內容：'+(x.searchContext||'')+'\\n搜索來源：'+JSON.stringify(x.searchSources||[])+'\\n上下文：原文 '+(x.contextExactMessages||0)+'／摘要 '+(x.contextSummarizedMessages||0)+'／提供者 '+(x.contextSummaryProvider||'');return '<div class="item"><div class="item-title">'+esc(title)+'</div><div class="item-meta">'+esc(meta)+'</div><div class="item-body" style="white-space:pre-wrap">'+esc(body)+'</div></div>'}).join('')||'<div class="empty">沒有符合的紀錄</div>'}
'''
r=r[:start]+new+r[end:]
start=r.index('async function loadConversations()')
end=r.index('\nfunction safeAttachmentUrl',start)
old=r[start:end]
new='''var conversationPage=1,conversationGroupId="";
async function loadConversations(page){if(!currentGroup){$('conversationList').innerHTML='<div class="empty">请先选择群组</div>';return}if(conversationGroupId!==currentGroup){conversationPage=1;conversationGroupId=currentGroup}conversationPage=Math.max(1,Math.floor(Number(page||conversationPage||1)));var list=$('conversationList');list.innerHTML='<div class="empty">正在加载第 '+conversationPage+' 页…</div>';var p=new URLSearchParams({q:$('convSearch').value||'',page:String(conversationPage),pageSize:String(Number($('convPageSize').value||50))});if($('convViolationOnly').checked)p.set('violation','1');var r=await api('/conversations?'+p.toString());if(!r.ok){list.innerHTML='<div class="empty">'+esc(r.message)+'</div>';return}var info=r.pageInfo||{page:conversationPage,pageSize:50,hasMore:false,previousPage:conversationPage>1?conversationPage-1:null,nextPage:null};conversationPage=Number(info.page||conversationPage);$('convPageStatus').textContent='第 '+conversationPage+' 页｜本页 '+Number(info.returned||(r.items||[]).length)+' 条'+(info.scanLimitReached?'｜已达扫描上限':'');$('convPrev').disabled=!info.previousPage;$('convNext').disabled=!info.nextPage;conversationCapabilities=r.capabilities||{recordViolation:false};list.innerHTML=(r.items||[]).map(renderConversationRecord).join('')||'<div class="empty">没有符合条件的群友消息</div>';list.querySelectorAll('[data-conv-action]').forEach(function(b){b.onclick=function(){handleConversationAction(this.dataset.id,this.dataset.convAction)}});list.querySelectorAll('[data-attachment-preview]').forEach(function(b){b.onclick=function(){openAttachmentPreview(this.dataset.attachmentPreview,this.dataset.attachmentType,this.dataset.attachmentName)}})}
'''
r=r[:start]+new+r[end:]
write('src/portal/runtime.js',r)

# Package / release.
pkg=json.loads(read('package.json'))
pkg['version']='2.7.7'
check=pkg['scripts']['check']
if 'verify-v277-emergency.mjs' not in check:
    check += ' && node verify-v277-emergency.mjs'
pkg['scripts']['check']=check
write('package.json',json.dumps(pkg,ensure_ascii=False,indent=2)+'\n')
release=json.loads(read('release-notes.json'))
release['version']='2.7.7'
added=list(release.get('added',[]))
fixed=list(release.get('fixed',[]))
for x in [
    '新增确定性政治话题过滤器；现实政治消息在进入一般聊天模型前静默终止，不回覆、不警告、不检索',
    'Portal 群友对话与 AI 回覆记录改为渐进分页加载，可选每页 25／50／100 条，服务器硬上限 100 条'
]:
    if x not in added: added.insert(0,x)
for x in [
    '机器人 QQ 同号人工输入在通过明确前缀与出站指纹检查后获得操作权限；! 指令与 //、??、/! 聊天不再被普通成员权限误挡',
    '群规判断新群默认使用智慧严格度，按近期误判、撤销、实际处置、管理干预与群聊漂移自动校准；管理员固定等级仍优先',
    '修复 Portal 对话与 AI 回覆页面一次请求并渲染 500 条导致长时间卡住或不显示的问题'
]:
    if x not in fixed: fixed.insert(0,x)
release['added']=added
release['fixed']=fixed
write('release-notes.json',json.dumps(release,ensure_ascii=False,indent=2)+'\n')

# Focused test.
write('verify-v277-emergency.mjs', '''import assert from "node:assert/strict";
import fs from "node:fs";
import { classifyPoliticalTopic } from "./src/policy/political-topics.js";
import { PORTAL_PAGE_SIZE_MAX, collectFilteredPage, normalizePortalPagination } from "./src/data/pagination.js";

assert.equal(classifyPoliticalTopic("法国现任总统是谁？").blocked, true);
assert.equal(classifyPoliticalTopic("你怎么看最近的选举和政党政策").blocked, true);
assert.equal(classifyPoliticalTopic("讨论两岸主权争议").blocked, true);
assert.equal(classifyPoliticalTopic("这个游戏里的总统角色怎么升级").blocked, false, "明确虚构／游戏语境不应误挡");
assert.equal(classifyPoliticalTopic("大众汽车是哪国的").blocked, false);

assert.equal(PORTAL_PAGE_SIZE_MAX, 100);
assert.deepEqual(normalizePortalPagination("2", "500"), { page: 2, pageSize: 100, offset: 100 });
assert.deepEqual(normalizePortalPagination("bad", "0"), { page: 1, pageSize: 50, offset: 0 });
const sample = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
const filtered = await collectFilteredPage(sample, { page: 2, pageSize: 2, load: async x => x, match: x => x % 2 === 0 });
assert.deepEqual(filtered.items, [6, 4], "分页偏移必须按过滤后的匹配项计算");
assert.equal(filtered.pageInfo.hasMore, true);
assert.equal(filtered.pageInfo.nextPage, 3);

const worker = fs.readFileSync("worker.js", "utf8");
const portal = fs.readFileSync("src/portal/runtime.js", "utf8");
const permissions = fs.readFileSync("src/core/permissions.js", "utf8");
const config = fs.readFileSync("src/config/runtime.js", "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

assert.match(worker, /let trustedSelfOperator = false/);
assert.match(worker, /const apiMessage = await isKnownOutboundMessage/);
assert.match(worker, /trustedSelfOperator = explicitSelfChat \|\| explicitSelfCommand/);
assert.match(worker, /if \(trustedSelfOperator\) \{\s*isDeveloper = true;/);
assert.match(worker, /reason: "political_topic_filter"/);
assert.match(worker, /naturalLanguageTrigger = [^\\n]*!politicalTopic\.blocked/);
assert.doesNotMatch(worker, /您的发言已涉嫌违反平台政治敏感内容管理规范/);
assert.match(worker, /同号人工控制：机器人 QQ 本人可直接发送 !指令/);
assert.match(config, /ruleStrictness: "smart"/);
assert.match(portal, /normalizePortalPagination/);
assert.match(portal, /pageSize:String\(Number\(\$\('convPageSize'\)\.value\|\|50\)\)/);
assert.match(portal, /pageSize:String\(Number\(\$\('aiLogPageSize'\)\.value\|\|50\)\)/);
assert.doesNotMatch(portal, /limit:'500'/);
assert.match(portal, /服务器每页最多 100 条/);
assert.match(permissions, /async function listAiDecisionLogPage/);
assert.equal(pkg.version, "2.7.7");
assert.match(pkg.scripts.check, /verify-v277-emergency\.mjs/);

console.log("verify-v277-emergency: ok");
''')

# Update permanent version assertions when present in a full repository.
for path in ROOT.glob('verify-*.mjs'):
    if path.name == 'verify-v277-emergency.mjs': continue
    text=path.read_text(encoding='utf-8')
    updated=text.replace('2.7.6','2.7.7')
    if updated != text: path.write_text(updated,encoding='utf-8')

print('v2.7.7 patch applied to',ROOT)
