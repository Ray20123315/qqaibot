from pathlib import Path
import re

ROOT = Path('.')


def read(path):
    return (ROOT / path).read_text(encoding='utf-8')


def write(path, text):
    (ROOT / path).write_text(text, encoding='utf-8')


def replace_once(path, old, new):
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{path}: expected one exact anchor, found {count}: {old[:120]!r}')
    write(path, text.replace(old, new, 1))


def regex_replace_once(path, pattern, replacement, flags=0):
    text = read(path)
    next_text, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f'{path}: expected one regex anchor, found {count}: {pattern[:120]!r}')
    write(path, next_text)


# 1. Version and regression entry.
replace_once('src/config/runtime.js', 'const VERSION = "2.7.6";', 'const VERSION = "2.7.7";')
replace_once('package.json', '"version": "2.7.6"', '"version": "2.7.7"')
replace_once(
    'package.json',
    'verify-notification-routing.mjs"',
    'verify-notification-routing.mjs && node verify-emergency-v2.7.7.mjs"'
)

# 2. Deterministic politics silent filter and repeated short-reply guard.
worker_helpers_anchor = 'const QQAI_V1_R54_REMOVED_FEATURE_KEYS = Object.freeze(["schedule_template", "draft", "dashboard", "quality-dashboard", "quality_dashboard", "growth", "growth-admin", "growth_admin", "schedule-template"]);'
worker_helpers = r'''const POLITICAL_TOPIC_PATTERN = /(?:政治|政党|政黨|选举|選舉|总统|總統|国会|國會|立法院|立法委员|立法委員|立委|议员|議員|首相|总理|總理|内阁|內閣|政权|政權|政治人物|政治制度|公共政策|民进党|民進黨|国民党|國民黨|共产党|共產黨|民主党|民主黨|共和党|共和黨|两岸政治|兩岸政治|罢免|罷免|公投|\b(?:politics|political|election|parliament|congress)\b)/i;

function isPoliticalTopicText(value) {
  return POLITICAL_TOPIC_PATTERN.test(String(value || "").normalize("NFKC"));
}

function normalizeShortReplyFingerprint(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/\[CQ:[^\]]+\]/g, "")
    .replace(/@\d{5,}/g, "")
    .replace(/\s+/g, "")
    .toLowerCase()
    .slice(0, 80);
}

function isRepeatedShortReplyCandidate(value) {
  const text = normalizeShortReplyFingerprint(value);
  if (!text || text.length > 24) return false;
  if (/^[?？!！.。~～…]{2,24}$/.test(text)) return true;
  if (/^(.)\1{1,23}$/u.test(text)) return true;
  return /^(?:嗯+|哦+|啊+|蛤+|欸+|诶+|哈+|呵+|6+|草+|收到|好|行|可以|笑死|不知道|不懂|无语|無語)$/i.test(text);
}

async function shouldSuppressRepeatedShortReply(env, { isGroup, groupId, text, windowMs = 60000 } = {}) {
  if (!isGroup || !groupId || !isRepeatedShortReplyCandidate(text)) return false;
  const fingerprint = normalizeShortReplyFingerprint(text);
  const key = `short_reply_guard:${String(groupId)}`;
  const raw = await dbGet(env, key);
  let previous = null;
  try { previous = raw ? JSON.parse(raw) : null; } catch {}
  const duplicate = Boolean(previous && previous.fingerprint === fingerprint && Date.now() - Number(previous.at || 0) < windowMs);
  if (!duplicate) await dbPut(env, key, JSON.stringify({ fingerprint, at: Date.now() }));
  return duplicate;
}

'''
replace_once('worker.js', worker_helpers_anchor, worker_helpers + worker_helpers_anchor)

# Politics must be dropped before natural-language intent classification or any chat model call.
politics_anchor = '''      let naturalLanguageIntent = null;
      let privateAccessMode = "";
      let privateAccessChecked = false;

      // 自我禁言只能由本人私讯解除。该命令独立于私聊 AI 开关，成功或失败都不发送聊天提示。'''
politics_replacement = '''      let naturalLanguageIntent = null;
      let privateAccessMode = "";
      let privateAccessChecked = false;

      // 政治相关普通聊天在进入任何意图分类器或聊天模型前静默丢弃；明确 ! 指令仍可用于管理设置。
      if (!isCommandMessage && isPoliticalTopicText(cleanMessage)) {
        await clearThinkingIndicator();
        ctx.waitUntil(writeSystemAudit(env, {
          type: "political_topic_silent_drop",
          groupId: currentGroupId,
          actorId: userId,
          action: "silent_drop",
          messageId: replyMessageId,
          detector: "local_v1"
        }).catch(() => {}));
        return new Response(null, { status: 204 });
      }

      // 自我禁言只能由本人私讯解除。该命令独立于私聊 AI 开关，成功或失败都不发送聊天提示。'''
replace_once('worker.js', politics_anchor, politics_replacement)

# A model-side [SKIP] is always silent, including direct political requests missed by the local detector.
replace_once(
    'worker.js',
    '      if (isAutoInterject && /^\\s*\\[SKIP\\]\\s*$/i.test(baseText)) {\n        ctx.waitUntil(writeAiDecisionLog(env, { ...aiDecisionBase, decision: "skipped", reason: "model_declined_interjection", triggerType, provider: usedProvider, model: usedModel, interjectJudgement, searchRequired: searchInfo.required, searchAttempted: searchInfo.attempted, searchPerformed: searchInfo.performed, searchQuery: searchInfo.query, searchContext: searchInfo.context, searchSources: searchInfo.sources, searchQueries: searchInfo.queries, searchProvider: searchInfo.provider, searchModel: searchInfo.model, searchError: searchInfo.error, contextMessageCount: groupConversationLogs.length, contextSummaryProvider: longGroupContext?.summaryProvider || "" }));\n        return new Response(null, { status: 204 });\n      }',
    '      if (/^\\s*\\[SKIP\\]\\s*$/i.test(baseText)) {\n        ctx.waitUntil(writeAiDecisionLog(env, { ...aiDecisionBase, decision: "skipped", reason: isAutoInterject ? "model_declined_interjection" : "model_declined_response", triggerType, provider: usedProvider, model: usedModel, interjectJudgement, searchRequired: searchInfo.required, searchAttempted: searchInfo.attempted, searchPerformed: searchInfo.performed, searchQuery: searchInfo.query, searchContext: searchInfo.context, searchSources: searchInfo.sources, searchQueries: searchInfo.queries, searchProvider: searchInfo.provider, searchModel: searchInfo.model, searchError: searchInfo.error, contextMessageCount: groupConversationLogs.length, contextSummaryProvider: longGroupContext?.summaryProvider || "" }));\n        await clearThinkingIndicator();\n        return new Response(null, { status: 204 });\n      }'
)

short_reply_anchor = '''      // 1. 群聊使用每回合独立行追加，避免同群多人并发时整份历史互相覆盖；私聊仍按单用户顺序保存。'''
short_reply_replacement = '''      if (await shouldSuppressRepeatedShortReply(env, {
        isGroup,
        groupId: currentGroupId,
        text: replyText
      })) {
        await clearThinkingIndicator();
        ctx.waitUntil(writeAiDecisionLog(env, {
          ...aiDecisionBase,
          decision: "skipped",
          reason: "repeated_short_reply_guard",
          triggerType,
          provider: usedProvider,
          model: usedModel,
          generatedReply: replyText.slice(0, 80)
        }).catch(() => {}));
        return new Response(null, { status: 204 });
      }

      // 1. 群聊使用每回合独立行追加，避免同群多人并发时整份历史互相覆盖；私聊仍按单用户顺序保存。'''
replace_once('worker.js', short_reply_anchor, short_reply_replacement)

# Non-whitelisted groups must never receive operational failure notices.
failure_anchor = '''  async notifyExplicitReplyFailureOnce(body, disposition, extra = {}) {
    if (!eventHasBotMention(body) && body?.__qqai_explicit_question !== true) return;
    const messageId = String(body?.message_id || "");'''
failure_replacement = '''  async notifyExplicitReplyFailureOnce(body, disposition, extra = {}) {
    if (!eventHasBotMention(body) && body?.__qqai_explicit_question !== true) return;
    if (body?.message_type === "group") {
      const groupId = String(body?.group_id || "");
      if (!groupId || !(await isGroupWhitelisted(this.env, groupId))) {
        await this.recordIngress(body, "failure_notice_suppressed_non_whitelist", {
          disposition: String(disposition || "worker_no_reply"),
          status: Number(extra.status || 0)
        }).catch(() => {});
        return;
      }
    }
    const messageId = String(body?.message_id || "");'''
replace_once('worker.js', failure_anchor, failure_replacement)

# Replace old model warning instruction with a model-side silence fallback.
replace_once(
    'worker.js',
    '- 【严厉警告机制】：只有当群友故意聊起【绝对禁止】的严重违规话题时，你才必须立刻收起人设，切换为极度严肃的语气明确警告对方：“无法回答此类问题。您的发言已涉嫌违反平台政治敏感内容管理规范，请立即停止相关话题，否则将面临封禁风险”。',
    '- 【静默机制】：遇到【绝对禁止】的政治敏感话题只输出 [SKIP]，不得警告、解释、拒绝或延伸讨论；Worker 会把 [SKIP] 静默丢弃。'
)

# 3. Server-side pagination with a fast path for unfiltered browsing.
portal_backend_pattern = r'''  if \(request\.method === "GET" && path === "/conversations"\) \{.*?\n  \}\n\n  if \(request\.method === "GET" && path === "/conversations/detail"\) \{'''
portal_backend_replacement = '''  if (request.method === "GET" && path === "/conversations") {
    const canManage = Boolean(permissions.aiAdmin || permissions.groupOps || permissions.nativeAdmin || role === "admin" || role === "owner" || portalIsDeveloper);
    if (!canManage) return jsonResponse({ ok: false, message: "缺少对话记录管理权限。" }, 403);
    if (!groupId) return jsonResponse({ ok: false, message: "请先选择群组。" }, 400);
    const ids = await readJson(env, `conversation:index:${groupId}`, []);
    const q = String(url.searchParams.get("q") || "").trim().toLowerCase();
    const violationOnly = url.searchParams.get("violation") === "1";
    const requestedPage = Math.max(1, Math.floor(Number(url.searchParams.get("page") || 1) || 1));
    const requestedPageSize = Math.floor(Number(url.searchParams.get("pageSize") || url.searchParams.get("limit") || 20) || 20);
    const pageSize = Math.max(1, Math.min(100, requestedPageSize));
    const orderedIds = ids.slice(-5000).reverse();
    const botRuleState = await getBotGroupRole(env, groupId);
    const recordViolationAvailable = botCanRunRuleMonitor(botRuleState);

    const readConversation = async id => {
      const item = await readJson(env, `conversation:${groupId}:${id}`, null);
      return item && item.source === "group_member" ? item : null;
    };
    const enrichConversation = async item => {
      if (!item) return null;
      const violation = item.violationId ? await readJson(env, `ruleviolation:${item.violationId}`, null) : null;
      return { ...item, violation: violation ? { id: violation.id, type: violation.violationType, reason: violation.reason, actionTaken: violation.actionTaken, actionResult: violation.actionResult, humanVerdict: violation.humanVerdict } : null };
    };

    let total = 0;
    let page = requestedPage;
    let items = [];
    if (!q && !violationOnly) {
      total = orderedIds.length;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      page = Math.min(page, totalPages);
      const pageIds = orderedIds.slice((page - 1) * pageSize, page * pageSize);
      const rows = await Promise.all(pageIds.map(readConversation));
      items = (await Promise.all(rows.filter(Boolean).map(enrichConversation))).filter(Boolean);
    } else {
      const matches = [];
      for (let offset = 0; offset < orderedIds.length; offset += 50) {
        const batchIds = orderedIds.slice(offset, offset + 50);
        const rows = await Promise.all(batchIds.map(readConversation));
        for (const item of rows) {
          if (!item) continue;
          if (q && !`${item.senderName || ""} ${item.userId || ""} ${item.text || ""} ${JSON.stringify(item.forwardSnapshots || [])}`.toLowerCase().includes(q)) continue;
          if (violationOnly && !item.violationActive) continue;
          matches.push(item);
        }
      }
      total = matches.length;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      page = Math.min(page, totalPages);
      const selected = matches.slice((page - 1) * pageSize, page * pageSize);
      items = (await Promise.all(selected.map(enrichConversation))).filter(Boolean);
    }
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return jsonResponse({ ok: true, items, pagination: {
      page,
      pageSize,
      total,
      totalPages,
      hasPrevious: page > 1,
      hasNext: page < totalPages
    }, capabilities: {
      reply: true,
      setEssence: true,
      deleteEssence: true,
      atAll: true,
      atOwner: true,
      atAdmins: true,
      atMembers: true,
      atSelected: true,
      recall: true,
      groupTodo: true,
      completeGroupTodo: true,
      cancelGroupTodo: true,
      groupNotice: true,
      recordViolation: recordViolationAvailable,
      cancelViolation: true,
      refreshForward: true
    } });
  }

  if (request.method === "GET" && path === "/conversations/detail") {'''
regex_replace_once('src/portal/runtime.js', portal_backend_pattern, portal_backend_replacement, flags=re.S)

# Front-end state and a stale-response-safe pager. Default 20, maximum 100.
replace_once(
    'src/portal/runtime.js',
    "var token='';var currentGroup='';var session=null;var conversationCapabilities={recordViolation:true};var PORTAL_SIDEBAR_COLLAPSIBLE='v1';",
    "var token='';var currentGroup='';var session=null;var conversationCapabilities={recordViolation:true};var conversationPage=1,conversationPageSize=20,conversationTotalPages=1,conversationRequestSerial=0;var PORTAL_SIDEBAR_COLLAPSIBLE='v1';"
)

portal_lines = read('src/portal/runtime.js').splitlines()
load_index = next((i for i, line in enumerate(portal_lines) if line.startswith('async function loadConversations(){')), None)
if load_index is None:
    raise RuntimeError('src/portal/runtime.js: loadConversations one-line function not found')
portal_frontend = r'''function ensureConversationPager(){if($('conversationPager')||!$('conversationList'))return;var wrap=document.createElement('div');wrap.id='conversationPager';wrap.className='card';wrap.style.marginBottom='12px';wrap.innerHTML='<div class="row"><label class="row" style="gap:6px">每页<select id="conversationPageSize"><option value="20">20</option><option value="50">50</option><option value="100">100</option></select></label><button id="conversationPrev" class="btn">上一页</button><span id="conversationPageStatus" class="grow muted">第 1 / 1 页</span><button id="conversationNext" class="btn">下一页</button></div>';$('conversationList').parentNode.insertBefore(wrap,$('conversationList'));$('conversationPageSize').value=String(conversationPageSize);$('conversationPageSize').onchange=function(){conversationPageSize=Math.max(1,Math.min(100,Number(this.value)||20));loadConversations(1)};$('conversationPrev').onclick=function(){if(conversationPage>1)loadConversations(conversationPage-1)};$('conversationNext').onclick=function(){if(conversationPage<conversationTotalPages)loadConversations(conversationPage+1)}}
async function loadConversations(page){if(!currentGroup){$('conversationList').innerHTML='<div class="empty">请先选择群组</div>';return}ensureConversationPager();conversationPage=Math.max(1,Number(page||conversationPage)||1);var serial=++conversationRequestSerial;var p=new URLSearchParams({q:$('convSearch').value||'',page:String(conversationPage),pageSize:String(conversationPageSize)});if($('convViolationOnly').checked)p.set('violation','1');$('conversationList').innerHTML='<div class="empty">正在加载第 '+conversationPage+' 页…</div>';var r=await api('/conversations?'+p.toString());if(serial!==conversationRequestSerial)return;if(!r.ok){$('conversationList').innerHTML='<div class="empty">'+esc(r.message)+'</div>';return}conversationCapabilities=r.capabilities||{recordViolation:false};var pg=r.pagination||{};conversationPage=Math.max(1,Number(pg.page||conversationPage)||1);conversationPageSize=Math.max(1,Math.min(100,Number(pg.pageSize||conversationPageSize)||20));conversationTotalPages=Math.max(1,Number(pg.totalPages||1)||1);if($('conversationPageSize'))$('conversationPageSize').value=String(conversationPageSize);if($('conversationPageStatus'))$('conversationPageStatus').textContent='第 '+conversationPage+' / '+conversationTotalPages+' 页｜共 '+Number(pg.total||0)+' 条';if($('conversationPrev'))$('conversationPrev').disabled=!pg.hasPrevious;if($('conversationNext'))$('conversationNext').disabled=!pg.hasNext;$('conversationList').innerHTML=(r.items||[]).map(renderConversationRecord).join('')||'<div class="empty">没有符合条件的群友消息</div>';$('conversationList').querySelectorAll('[data-conv-action]').forEach(function(b){b.onclick=function(){handleConversationAction(this.dataset.id,this.dataset.convAction)}});$('conversationList').querySelectorAll('[data-attachment-preview]').forEach(function(b){b.onclick=function(){openAttachmentPreview(this.dataset.attachmentPreview,this.dataset.attachmentType,this.dataset.attachmentName)}})}'''.replace('\\"', '"')
portal_lines[load_index:load_index + 1] = portal_frontend.splitlines()
write('src/portal/runtime.js', '\n'.join(portal_lines) + '\n')

# Event bindings are installed when the pager is created, after the dynamic conversation view exists.
replace_once(
    'src/portal/runtime.js',
    "$('conversationPageSize').value=String(conversationPageSize);$('conversationPageSize').onchange=function(){conversationPageSize=Math.max(1,Math.min(100,Number(this.value)||20));loadConversations(1)};",
    "$('conversationPageSize').value=String(conversationPageSize);if($('convSearch')){$('convSearch').onkeydown=function(e){if(e.key==='Enter')loadConversations(1)}}if($('convViolationOnly'))$('convViolationOnly').onchange=function(){loadConversations(1)};if($('convSearchBtn'))$('convSearchBtn').onclick=function(){loadConversations(1)};$('conversationPageSize').onchange=function(){conversationPageSize=Math.max(1,Math.min(100,Number(this.value)||20));loadConversations(1)};"
)

# 4. Add regression checks for every emergency requirement and existing adaptive moderation.
verify = r'''import fs from "node:fs";

const worker = fs.readFileSync("worker.js", "utf8");
const portal = fs.readFileSync("src/portal/runtime.js", "utf8");
const moderation = fs.readFileSync("src/moderation/runtime.js", "utf8");
const config = fs.readFileSync("src/config/runtime.js", "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

function check(condition, message) {
  if (!condition) throw new Error(message);
}

check(config.includes('const VERSION = "2.7.7";'), "runtime version must be 2.7.7");
check(pkg.version === "2.7.7", "package version must be 2.7.7");

// Robot-account manual input remains allowed while outbound echoes remain blocked.
check(worker.includes("const isSelfAccount = Boolean(userId && eventSelfId && userId === eventSelfId);"), "same-account identity detection missing");
check(worker.includes("cleanMessage.startsWith('//')") && worker.includes("explicitSelfCommand"), "same-account // and ! controls missing");
check(worker.includes("await isKnownOutboundMessage(env"), "same-account outbound echo guard missing");
check(worker.includes("if (!isSentEvent && !explicitSelfChat && !explicitSelfCommand) return new Response(null, { status: 204 });"), "same-account non-command safety gate missing");

// Political conversation is dropped before model intent classification and direct [SKIP] is silent.
const politicalIndex = worker.indexOf("political_topic_silent_drop");
const naturalIntentIndex = worker.indexOf("const naturalLanguageTrigger");
check(politicalIndex >= 0 && naturalIntentIndex >= 0 && politicalIndex < naturalIntentIndex, "political filter must run before natural-language model classification");
check(worker.includes("if (!isCommandMessage && isPoliticalTopicText(cleanMessage))"), "political command exemption or silent filter missing");
check(worker.includes('reason: isAutoInterject ? "model_declined_interjection" : "model_declined_response"'), "direct model [SKIP] must be silent");
check(!worker.includes("严厉警告机制"), "political topics must not produce warning replies");

// Non-whitelisted groups never receive failure notices.
check(worker.includes("failure_notice_suppressed_non_whitelist"), "non-whitelist failure suppression missing");
check(worker.includes("!(await isGroupWhitelisted(this.env, groupId))"), "failure notice whitelist gate missing");

// Repeated tiny replies such as ??? cannot spam the group.
check(worker.includes("shouldSuppressRepeatedShortReply"), "short reply repeat guard missing");
check(worker.includes("repeated_short_reply_guard"), "short reply suppression audit missing");
check(worker.includes("short_reply_guard:${String(groupId)}"), "short reply guard must be group scoped");

// Conversation API and UI use server-side pagination, default 20 and hard maximum 100.
check(portal.includes("const pageSize = Math.max(1, Math.min(100, requestedPageSize));"), "conversation API must cap pages at 100");
check(portal.includes('url.searchParams.get("pageSize")') && portal.includes("pageSize: String(conversationPageSize)"), "conversation pageSize contract missing");
check(portal.includes("conversationPageSize=20") && portal.includes('<option value="100">100</option>'), "conversation pager defaults/options missing");
check(portal.includes("conversationRequestSerial") && portal.includes("serial!==conversationRequestSerial"), "stale conversation responses must not overwrite newer pages");
check(!portal.includes("limit:'500'"), "legacy 500-row initial conversation load still present");

// Adaptive violation strictness was already implemented and must remain active.
check(moderation.includes('"智慧": "smart"') && moderation.includes("resolveAdaptiveRuleStrictness"), "adaptive violation strictness missing");
check(moderation.includes("近期人工复核或撤销发现") && moderation.includes("暂时提高敏感度"), "adaptive violation feedback signals missing");

console.log("Emergency v2.7.7 regression checks passed.");
'''
write('verify-emergency-v2.7.7.mjs', verify)

# Final patch-level sanity checks before npm tests.
for path in ['worker.js', 'src/portal/runtime.js', 'src/config/runtime.js', 'package.json', 'verify-emergency-v2.7.7.mjs']:
    if not read(path).strip():
        raise RuntimeError(f'{path}: unexpectedly empty')
print('Applied emergency v2.7.7 patches successfully.')
