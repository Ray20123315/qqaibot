// Extracted from worker.js without behavioral changes.
// Cloudflare still deploys worker.js as the single Worker entry point.

import { callGeminiGenerate, callGoogleDecision, geminiSearchApiKeys, notifyDeveloper, parseList } from "../ai/runtime.js";
import { DEFAULTS, VERSION } from "../config/runtime.js";
import { developerId, isDeveloperId, recentConversationMessagesForUser } from "../core/identity.js";
import { appendIndex, callOneBotAction, getEffectivePermissions, writeSystemAudit } from "../core/permissions.js";
import { dbDel, dbGet, dbPut } from "../data/store.js";
import { dispatchHumanAttentionNotification } from "../notifications/routing.js";
import { canUnlockMute, clearMuteLock, createManualMuteLock, getMuteLock, putMuteLock } from "./mute-locks.js";
import { FLIRT_MUTE_MAX_SECONDS, clampFlirtMuteSeconds, isFlirtRefusalSignal, isManagementRole, looksLikeFlirtCandidate, looksLikeRoughBanter, managerExchangeContext, normalizeFlirtAction, readRecentConversationRecords } from "./social-boundaries.js";
import { botCanRunRuleMonitor, canUseBotGroupOperations, getBotGroupRole, isBotVerifiedGroupOwner } from "../group/runtime.js";
import { formatDuration, parseDurationSeconds, runOneBotGroupOperation } from "../onebot/messages.js";
import { opsActiveRuleRecords, opsFuseAllows, opsGetSettings, opsRecordAutomationResult, opsRuleExceptionMatch, opsSaveRecord } from "../operations/runtime.js";
import { getOneBotHub, readJson, resolvePortalRole, sendPortalVerificationMessage, sha256Hex } from "../portal/auth.js";
import { assertSafePublicUrl, fetchPublicUrl, numericId } from "../security/network.js";

const POLITICAL_MODERATION_PATTERN = /(?:政治|政党|政黨|选举|選舉|总统|總統|主席|国会|國會|立法院|立法委员|立法委員|立委|议员|議員|首相|总理|總理|内阁|內閣|政府|政权|政權|执政|執政|在野|政治人物|政治制度|公共政策|外交|制裁|领土争议|領土爭議|两岸|兩岸|统一|統一|台独|台獨|罢免|罷免|公投|意识形态|意識形態|民进党|民進黨|国民党|國民黨|共产党|共產黨|民主党|民主黨|共和党|共和黨|\b(?:politics|political|election|government|parliament|congress|president|prime minister)\b)/i;
const RACIAL_GROUP_PATTERN = /(?:黑人|白人|黄种人|黃種人|亚洲人|亞洲人|非洲人|印度人|犹太人|猶太人|阿拉伯人|拉丁裔|少数民族|少數民族|种族|種族|族群|民族)/i;
const RACIAL_ABUSE_PATTERN = /(?:最低贱|最低賤|低贱|低賤|低等|劣等|下等|不配做人|不是人|农具|農具|奴隶|奴隸|棉花种植园|棉花種植園|种族洁癖|種族潔癖|不歧视就完蛋|不歧視就完蛋|应该隔离|應該隔離|应该清除|應該清除|天生愚蠢|天生肮脏|天生骯髒|污染血统|污染血統|拒绝.*(?:黑人|白人|黄种人|黃種人|印度人)|远离.*(?:黑人|白人|黄种人|黃種人|印度人)|遠離.*(?:黑人|白人|黃種人|印度人)|接受不了.*(?:黑人|白人|黄种人|黃種人|印度人))/i;
const ANTI_RACISM_PATTERN = /(?:反对|反對|制止|停止|不要|不能|不该|不該|谴责|譴責|抵制|这是|這是|属于|屬於|算是|疑似|举报|舉報).{0,18}(?:种族歧视|種族歧視|种歧|種歧)|(?:种族歧视|種族歧視|种歧|種歧).{0,18}(?:不对|不對|错误|錯誤|过分|過分|违法|違法)/i;

function isPoliticalModerationTopic(value) {
  return POLITICAL_MODERATION_PATTERN.test(String(value || "").normalize("NFKC"));
}

function detectExplicitRacialDiscrimination(value, recentContext = "") {
  const text = String(value || "").normalize("NFKC").trim();
  const context = String(recentContext || "").normalize("NFKC");
  if (!text || ANTI_RACISM_PATTERN.test(text)) return null;
  const directGroup = RACIAL_GROUP_PATTERN.test(text);
  const contextualGroup = directGroup || RACIAL_GROUP_PATTERN.test(context.slice(-2500));
  const abusive = RACIAL_ABUSE_PATTERN.test(text);
  const explicitIdeology = /(?:种族洁癖|種族潔癖|不歧视就完蛋|不歧視就完蛋)/i.test(text);
  if (!(abusive && contextualGroup) && !explicitIdeology) return null;
  return {
    matched: true,
    violationType: "种族歧视",
    reason: "把某一种族或族群描述为低等、低贱、工具，或主张因族群身份排斥他人，属于种族歧视。请停止此类表达。",
    confidence: directGroup || explicitIdeology ? 0.99 : 0.93
  };
}

function isRacialDiscriminationReview(item, review) {
  if (review?.forceWarning === true) return true;
  const text = [item?.violationType, item?.rule, item?.reason, review?.violationType, review?.rule, review?.reason].map(value => String(value || "")).join(" ");
  return /(?:种族歧视|種族歧視|族群歧视|族群歧視|racial discrimination|racism)/i.test(text);
}




function moderationActionLabel(action) {
  return ({
    kick: "踢出群聊",
    mute: "禁言",
    unmute: "解除禁言",
    whole_mute: "开启全员禁言",
    whole_unmute: "解除全员禁言",
    set_admin: "设为管理员",
    unset_admin: "取消管理员"
  })[action] || action;
}



function moderationActionNeedsTarget(action) {
  return ["kick", "mute", "unmute", "set_admin", "unset_admin"].includes(action);
}



function moderationPermissionLevelLabel(senderRole, isDeveloper = false) {
  if (isDeveloper) return "开发者";
  if (senderRole === "owner") return "群主";
  if (senderRole === "admin") return "QQ管理员";
  return "群成员";
}



function formatModerationPermissionDenied(senderRole, isDeveloper = false) {
  return `⚠️ 权限不足\n当前权限等级：${moderationPermissionLevelLabel(senderRole, isDeveloper)}\n需要权限等级：QQ管理员或以上`;
}



function parseModerationConfirmation(text) {
  const value = String(text || "").trim();
  // 必须带 op，避免普通聊天中的“确认／取消”误触发；确认op／取消op处理本群最新一笔待处理提案。
  const confirm = value.match(/^[!！/]?(?:确认|確認|同意执行|同意執行|执行|執行|confirm|approve|execute)\s*(op(?:_[a-z0-9_-]+)?)$/i);
  if (confirm) return { type: "confirm", id: /^op$/i.test(confirm[1]) ? "" : confirm[1], alias: /^op$/i.test(confirm[1]) ? "latest" : "explicit" };
  const cancel = value.match(/^[!！/]?(?:取消操作|取消執行|取消执行|取消|cancel|abort)\s*(op(?:_[a-z0-9_-]+)?)$/i);
  if (cancel) return { type: "cancel", id: /^op$/i.test(cancel[1]) ? "" : cancel[1], alias: /^op$/i.test(cancel[1]) ? "latest" : "explicit" };
  return null;
}



function localModerationIntent(text) {
  const value = String(text || "").trim();
  const direct = value.match(/(?:QQ[:： ]*)?(\d{5,})/i)?.[1] || "";
  const hasMention = /@\d{5,}/.test(value);
  const imperativePrefix = /^(?:把|將|将|給我|给我|幫我|帮我|請|请|麻煩|麻烦|立刻|立即|馬上|马上|讓|让|快點|快点|please|pls|kindly)\b/i.test(value);
  const directActionStart = /^(?:踢出?|移出|请出|請出|杀了|殺了|斩了|斬了|清出去|禁言|闭麦|閉麥|解除禁言|解禁|全员禁言|全員禁言|解除全员禁言|解除全員禁言|设为管理员|設為管理員|取消管理员|取消管理員|mute|unmute|kick|remove|ban|whole\s+mute|group\s+mute|set\s+admin|unset\s+admin)\b/i.test(value);
  const discussionOnly = /(?:吗|嗎|么|麼|是不是|是否|为什么|為什麼|怎么|怎麼|有人被|剛才|刚才|已經|已经|聽說|听说).{0,10}(?:踢|禁言|管理员|管理員)/.test(value) || /(?:踢|禁言|管理员|管理員).{0,8}(?:吗|嗎|么|麼|？|\?)/.test(value);
  const hasCommandShape = imperativePrefix || directActionStart || hasMention || Boolean(direct);
  if (!hasCommandShape || (discussionOnly && !imperativePrefix && !directActionStart)) return { action: "none", confidence: 0 };
  let action = "none";
  if (/(?:解除|取消).{0,5}(?:全员|全員)禁言|\b(?:whole|group)\s+unmute\b/i.test(value)) action = "whole_unmute";
  else if (/(?:开启|開啟|全员|全員).{0,5}禁言|\b(?:whole|group)\s+mute\b/i.test(value) && !/@\d+/.test(value)) action = "whole_mute";
  else if (/(?:解除|取消|解开|解開|解禁).{0,6}(?:禁言|闭麦|閉麥)?|\bunmute\b/i.test(value)) action = "unmute";
  else if (/(?:设|設|升|加).{0,8}(?:管理员|管理員)|\bset\s+admin\b/i.test(value)) action = "set_admin";
  else if (/(?:取消|撤销|撤銷|下掉).{0,8}(?:管理员|管理員)|\bunset\s+admin\b/i.test(value)) action = "unset_admin";
  else if (/(?:踢|移出|请出|請出|杀了|殺了|斩了|斬了|清出去|\bkick\b|\bremove\b|\bban\b)/i.test(value)) action = "kick";
  else if (/(?:禁言|闭麦|閉麥|关小黑屋|關小黑屋|\bmute\b)/i.test(value)) action = "mute";
  if (action === "none") return { action: "none", confidence: 0 };
  let durationSeconds = 0;
  const durationText = value.match(/(\d+(?:\.\d+)?\s*(?:秒|分(?:钟|鐘)?|小时|小時|天))/)?.[1] || "";
  if (durationText) durationSeconds = parseDurationSeconds(durationText);
  return { action, targetQq: direct, targetName: "", durationSeconds, confidence: 0.62, reason: "本地保守规则识别" };
}



async function classifyNaturalModerationIntent(env, text) {
  const source = String(text || "").trim();
  if (!/(?:踢|移出|请出|請出|杀了|殺了|斩了|斬了|禁言|闭麦|閉麥|全员禁言|全員禁言|管理员|管理員)/i.test(source)) {
    return { action: "none", confidence: 0 };
  }
  try {
    const result = await callGoogleDecision(env, {
      system: `你是QQ群管理意图解析器。只有当发言明显是在要求机器人执行群管理操作时才识别；闲聊、比喻、引用、讨论某人被踢或玩笑不得识别。只输出JSON，不要Markdown：{"action":"none|kick|mute|unmute|whole_mute|whole_unmute|set_admin|unset_admin","targetQq":"数字或空","targetName":"昵称或空","durationSeconds":数字,"confidence":0到1,"reason":"简短原因"}。中文“杀了/斩了/清出去”在明确命令语境中表示kick。禁言未给时长默认600秒。`,
      prompt: source.slice(0, 1200),
      maxOutputTokens: 180,
      deadlineAt: Date.now() + 9000,
      maxAttempts: 2
    });
    const obj = JSON.parse(result.text.match(/\{[\s\S]*\}/)?.[0] || "{}");
    const allowed = ["none", "kick", "mute", "unmute", "whole_mute", "whole_unmute", "set_admin", "unset_admin"];
    if (!allowed.includes(obj.action)) return localModerationIntent(source);
    return {
      action: obj.action,
      targetQq: String(obj.targetQq || "").replace(/\D/g, ""),
      targetName: String(obj.targetName || "").trim(),
      durationSeconds: Number(obj.durationSeconds || 0),
      confidence: Number(obj.confidence || 0),
      reason: String(obj.reason || "Gemma 识别")
    };
  } catch (error) {
    console.warn("moderation classifier fallback:", error?.message || error);
    return localModerationIntent(source);
  }
}



async function getGroupMemberSafe(env, groupId, userId) {
  if (!groupId || !userId) return null;
  try {
    return await callOneBotAction(env, {
      action: "get_group_member_info",
      params: { group_id: numericId(groupId), user_id: numericId(userId), no_cache: false }
    }, 10000);
  } catch {
    const cached = await readJson(env, `group_members:${groupId}`, []);
    const item = cached.find(m => String(m.qq || m.user_id) === String(userId));
    return item ? { user_id: numericId(userId), nickname: item.name || "", card: item.name || "", role: item.role || "member" } : null;
  }
}



async function resolveModerationTarget(env, { groupId, targetMentionQqs = [], intent, botId }) {
  let targetQq = String(intent?.targetQq || targetMentionQqs[0] || "").replace(/\D/g, "");
  if (targetQq && targetQq !== String(botId || "")) {
    const member = await getGroupMemberSafe(env, groupId, targetQq);
    return { ok: true, targetQq, member, targetName: member?.card || member?.nickname || targetQq };
  }
  const targetName = String(intent?.targetName || "").trim().replace(/^[@＠]/, "");
  if (!targetName) return { ok: false, reason: "missing", matches: [] };
  let members = [];
  try {
    const data = await callOneBotAction(env, { action: "get_group_member_list", params: { group_id: numericId(groupId), no_cache: false } }, 12000);
    members = Array.isArray(data) ? data : [];
  } catch {
    members = await readJson(env, `group_members:${groupId}`, []);
  }
  const norm = value => String(value || "").trim().toLowerCase();
  const wanted = norm(targetName);
  const exact = members.filter(m => [m.card, m.nickname, m.name].some(v => norm(v) === wanted));
  const partial = exact.length ? exact : members.filter(m => [m.card, m.nickname, m.name].some(v => norm(v).includes(wanted) || wanted.includes(norm(v))));
  const matches = partial.filter(m => String(m.user_id || m.qq || "") !== String(botId || "")).slice(0, 8);
  if (matches.length !== 1) return { ok: false, reason: matches.length ? "ambiguous" : "not_found", matches };
  const member = matches[0];
  targetQq = String(member.user_id || member.qq || "");
  return { ok: true, targetQq, member, targetName: member.card || member.nickname || member.name || targetName };
}



async function reviewGroupWorkWithGemma(env, type, content) {
  try {
    const result = await callGoogleDecision(env, {
      system: "你是群务辅助审查器。你只能输出 JSON：{\"decision\":\"suggest_approve|owner_review\",\"reason\":\"简短原因\"}。可以建议同意，但绝不能代替群主拒绝，也绝不能执行。遇到不确定、隐私、文件风险或可能骚扰时输出 owner_review。",
      prompt: JSON.stringify({ type, content: String(content || "").slice(0, 3000) }),
      maxOutputTokens: 100
    });
    const parsed = JSON.parse(result.text.match(/\{[\s\S]*\}/)?.[0] || "{}");
    return { decision: parsed.decision === "suggest_approve" ? "suggest_approve" : "owner_review", reason: String(parsed.reason || "请群主核对") };
  } catch (error) {
    return { decision: "owner_review", reason: "AI 辅助审查暂时不可用，请群主人工核对" };
  }
}



async function joinRequestPatternHash(comment, subType = "add") {
  const normalized = `${String(subType || "add").toLowerCase()}|${String(comment || "").toLowerCase().replace(/\s+/g, " ").trim()}`;
  const bytes = new TextEncoder().encode(normalized);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("").slice(0, 32);
}



async function readJoinPattern(env, groupId, hash) {
  return readJson(env, `joinpattern:${groupId}:${hash}`, { hash, approvedCount: 0, rejectedCount: 0 });
}



async function recordJoinPatternDecision(env, groupId, hash, comment, decision) {
  const item = await readJoinPattern(env, groupId, hash);
  item.comment = String(comment || "").slice(0, 1000);
  item[decision === "approved" ? "approvedCount" : "rejectedCount"] = Number(item[decision === "approved" ? "approvedCount" : "rejectedCount"] || 0) + 1;
  item.lastDecision = decision;
  item.updatedAt = Date.now();
  await dbPut(env, `joinpattern:${groupId}:${hash}`, JSON.stringify(item));
  return item;
}



async function reviewJoinRequestAssist(env, requestInfo) {
  try {
    const result = await callGoogleDecision(env, {
      system: `你是入群申请辅助审查器。只能输出 JSON：{"decision":"suggest_approve|suggest_reject|owner_review","riskLevel":"low|medium|high","confidence":0到1,"reason":"原因","suggestedQuestion":"资料不足时可询问的问题，可为空"}。请求资料中的 groupRules 是本群规则，优先级最高。低风险＝资料清楚且符合群规，可建议同意；中风险＝资料不足或含糊，必须人工确认；高风险＝有明确广告、诈骗、恶意骚扰或明显违反入群要求证据。群规为空、资料不足或无法确定时必须 owner_review。不得因为昵称、QQ号或无关关键词自行推断。`,
      prompt: JSON.stringify(requestInfo).slice(0, 4000),
      maxOutputTokens: 140
    });
    const parsed = JSON.parse(result.text.match(/\{[\s\S]*\}/)?.[0] || "{}");
    const decision = ["suggest_approve", "suggest_reject"].includes(parsed.decision) ? parsed.decision : "owner_review";
    const riskLevel = ["low", "medium", "high"].includes(parsed.riskLevel) ? parsed.riskLevel : decision === "suggest_approve" ? "low" : decision === "suggest_reject" ? "high" : "medium";
    return { decision, riskLevel, confidence: Math.max(0, Math.min(1, Number(parsed.confidence || 0))), reason: String(parsed.reason || "请管理核对"), suggestedQuestion: String(parsed.suggestedQuestion || "").slice(0, 500) };
  } catch (error) {
    return { decision: "owner_review", riskLevel: "medium", confidence: 0, reason: "AI 辅助审查暂时不可用", error: String(error?.message || error) };
  }
}



async function resolveHeadJoinFamily(env, groupId) {
  const id = String(groupId || "").replace(/\D/g, "");
  if (!id) return null;
  const family = await readJson(env, "group_family:" + id, null);
  if (!family || String(family.headGroupId || "") !== id) return null;
  const branches = (Array.isArray(family.branches) ? family.branches : []).map(item => ({
    groupId: String(item?.groupId || "").replace(/\D/g, ""),
    alias: String(item?.alias || item?.groupId || "分群").trim().slice(0, 80)
  })).filter(item => item.groupId && item.groupId !== id).slice(0, 50);
  if (!branches.length) return null;
  return { headGroupId: id, headAlias: String(family.headAlias || id), branches };
}


async function findApplicantBranchMembership(env, family, userId) {
  const qq = String(userId || "").replace(/\D/g, "");
  if (!qq || !family) return null;
  const branches = Array.isArray(family.branches) ? family.branches : [];
  if (!branches.length) return null;
  const checks = branches.map(async branch => {
    const response = await callOneBotAction(env, {
      action: "get_group_member_info",
      params: { group_id: numericId(branch.groupId), user_id: numericId(qq), no_cache: true }
    }, 8000);
    const member = response?.data && typeof response.data === "object" ? response.data : response;
    const memberId = String(member?.user_id || member?.qq || "").replace(/\D/g, "");
    if (memberId !== qq) throw new Error("Applicant is not a live member of this branch");
    return {
      groupId: String(branch.groupId),
      branchAlias: String(branch.alias || branch.groupId),
      userId: qq,
      memberName: String(member?.card || member?.nickname || member?.name || qq),
      role: String(member?.role || "member"),
      verifiedAt: Date.now(),
      source: "onebot_live_member_info"
    };
  });
  try {
    return await Promise.any(checks);
  } catch {
    return null;
  }
}


function joinRequestAttentionMessage(item, heading = "入群申请待人工处理") {
  const review = item?.review || {};
  const decision = review.decision === "suggest_approve" ? "建议同意" : review.decision === "suggest_reject" ? "建议人工核对拒绝" : "请人工核对";
  return `【${heading}】
编号：${item?.id || "未生成"}
群号：${item?.groupId || ""}
申请人：${item?.userId || ""}
附言：${item?.comment || "无"}
AI 意见：${decision}${review.reason ? `（${review.reason}）` : ""}
当前状态：${item?.status || "unknown"}
处理方式：请在对应群聊发送“确认入群 ${item?.id || "编号"}”或“忽略入群 ${item?.id || "编号"}”。`;
}


async function notifyJoinRequestAttention(env, item, eventId, heading) {
  const result = await dispatchHumanAttentionNotification(env, {
    groupId: item.groupId,
    eventId,
    message: joinRequestAttentionMessage(item, heading),
    audit: { actorId: "system:join_assist", targetId: item.userId, requestId: item.id, status: item.status }
  });
  item.notification = result;
  return result;
}


async function createJoinRequestAssist(env, body) {
  const groupId = String(body.group_id || "").replace(/\D/g, "");
  const userId = String(body.user_id || "").replace(/\D/g, "");
  const comment = String(body.comment || "");
  const subType = String(body.sub_type || "add");
  const headFamily = subType === "add" ? await resolveHeadJoinFamily(env, groupId) : null;
  const branchMembership = headFamily && userId ? await findApplicantBranchMembership(env, headFamily, userId) : null;
  const patternHash = await joinRequestPatternHash(comment, subType);

  if (branchMembership) {
    const id = `jr_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 6)}`;
    const item = {
      id,
      groupId,
      userId,
      flag: String(body.flag || ""),
      subType,
      comment,
      patternHash,
      review: {
        decision: "direct_approve",
        riskLevel: "not_applicable",
        confidence: 1,
        reason: "OneBot 已即时确认申请者为分群「" + branchMembership.branchAlias + "」成员，依群组政策直接同意，不经过 AI 审核",
        family: {
          headGroupId: headFamily.headGroupId,
          headAlias: headFamily.headAlias,
          sourceGroupId: branchMembership.groupId,
          sourceGroupAlias: branchMembership.branchAlias
        },
        membership: branchMembership
      },
      status: "approved_subgroup_member_direct",
      createdAt: Date.now()
    };
    try {
      await callOneBotAction(env, { action: "set_group_add_request", params: { flag: item.flag, sub_type: subType, approve: true, reason: "" } }, 15000);
      await recordJoinPatternDecision(env, groupId, patternHash, comment, "approved");
      await writeSystemAudit(env, {
        type: "join_request_subgroup_member_direct_approved",
        groupId,
        actorId: "system:subgroup_member_join_policy",
        targetId: item.userId,
        action: "approve",
        reason: item.review.reason,
        headGroupId: headFamily.headGroupId,
        sourceGroupId: branchMembership.groupId,
        membershipSource: branchMembership.source
      });
    } catch (error) {
      item.status = "approve_failed";
      item.result = String(error?.message || error);
      await writeSystemAudit(env, {
        type: "join_request_subgroup_member_direct_approve_failed",
        groupId,
        actorId: "system:subgroup_member_join_policy",
        targetId: item.userId,
        action: "approve_failed",
        error: item.result,
        headGroupId: headFamily.headGroupId,
        sourceGroupId: branchMembership.groupId
      }).catch(() => {});
      await notifyJoinRequestAttention(env, item, "join_request_failed", "分群成员入群自动同意失败").catch(error => {
        console.warn("notify subgroup join failure failed", error?.message || error);
      });
    }
    await dbPut(env, `joinrequest:${id}`, JSON.stringify(item));
    await appendIndex(env, `joinrequest:index:${groupId}`, id, 1000);
    return item;
  }
  const pattern = await readJoinPattern(env, groupId, patternHash);
  const threshold = Math.max(1, parseUnlimitedNonNegativeInteger(await dbGet(env, `join_pattern_auto_approve_threshold:${groupId}`), DEFAULTS.joinPatternAutoApproveThreshold));
  const aiApproveEnabled = await dbGet(env, `join_ai_approve_enabled:${groupId}`) !== "false";
  const groupRules = String(await dbGet(env, `group_rules:${groupId}`) || "").trim();
  const joinFuse = await opsFuseAllows(env, groupId, "join_review");
  const automationAllowed = joinFuse.allowed;

  if (automationAllowed && aiApproveEnabled && Number(pattern.approvedCount || 0) >= threshold && Number(pattern.rejectedCount || 0) === 0) {
    try {
      await callOneBotAction(env, { action: "set_group_add_request", params: { flag: String(body.flag || ""), sub_type: subType, approve: true, reason: "" } }, 15000);
      const id = `jr_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 6)}`;
      const item = { id, groupId, userId: String(body.user_id || ""), flag: String(body.flag || ""), subType, comment, patternHash, review: { decision: "cached_approve", reason: `相同申请方式已获准 ${pattern.approvedCount} 次` }, status: "approved_cached", createdAt: Date.now() };
      await dbPut(env, `joinrequest:${id}`, JSON.stringify(item));
      await appendIndex(env, `joinrequest:index:${groupId}`, id, 1000);
      await recordJoinPatternDecision(env, groupId, patternHash, comment, "approved");
      return item;
    } catch (error) {
      console.warn("cached join approval failed", error);
      const failed = { id: `jr_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 6)}`, groupId, userId, flag: String(body.flag || ""), subType, comment, patternHash, review: { decision: "cached_approve", reason: `相同申请方式已获准 ${pattern.approvedCount} 次` }, status: "approve_failed", result: String(error?.message || error), createdAt: Date.now() };
      await dbPut(env, `joinrequest:${failed.id}`, JSON.stringify(failed));
      await appendIndex(env, `joinrequest:index:${groupId}`, failed.id, 1000);
      await notifyJoinRequestAttention(env, failed, "join_request_failed", "缓存规则自动同意失败").catch(() => {});
    }
  }

  const review = await reviewJoinRequestAssist(env, {
    groupId,
    userId: String(body.user_id || ""),
    comment,
    subType,
    groupRules: groupRules.slice(0, 5000),
    previousPattern: { approvedCount: Number(pattern.approvedCount || 0), rejectedCount: Number(pattern.rejectedCount || 0) }
  });
  await opsRecordAutomationResult(env, groupId, "join_review", !review.error, review.error || "").catch(() => {});
  if (automationAllowed && aiApproveEnabled && review.decision === "suggest_approve" && Number(review.confidence || 0) >= DEFAULTS.joinAiApproveConfidence) {
    const id = `jr_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 6)}`;
    const item = { id, groupId, userId: String(body.user_id || ""), flag: String(body.flag || ""), subType, comment, patternHash, review, status: "approved_ai", createdAt: Date.now() };
    try {
      await callOneBotAction(env, { action: "set_group_add_request", params: { flag: item.flag, sub_type: subType, approve: true, reason: "" } }, 15000);
      await recordJoinPatternDecision(env, groupId, patternHash, comment, "approved");
      await writeSystemAudit(env, { type: "join_request_ai_approved", groupId, actorId: "system:join_assist", targetId: item.userId, action: "approve", confidence: Number(review.confidence || 0), reason: review.reason });
      await dbPut(env, `joinrequest:${id}`, JSON.stringify(item));
      await appendIndex(env, `joinrequest:index:${groupId}`, id, 1000);
      return item;
    } catch (error) {
      item.status = "approve_failed";
      item.result = String(error?.message || error);
      await dbPut(env, `joinrequest:${id}`, JSON.stringify(item));
      await appendIndex(env, `joinrequest:index:${groupId}`, id, 1000);
      await notifyJoinRequestAttention(env, item, "join_request_failed", "AI 自动同意入群失败").catch(() => {});
      await dbPut(env, `joinrequest:${id}`, JSON.stringify(item));
    }
  }
  const rejectAuthorized = await dbGet(env, `join_reject_authorized:${groupId}`) === "true";
  if (automationAllowed && review.decision === "suggest_reject" && rejectAuthorized && review.confidence >= 0.92) {
    const id = `jr_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 6)}`;
    const item = { id, groupId, userId: String(body.user_id || ""), flag: String(body.flag || ""), subType, comment, patternHash, review, status: "rejected_ai", createdAt: Date.now() };
    try {
      await callOneBotAction(env, { action: "set_group_add_request", params: { flag: item.flag, sub_type: subType, approve: false, reason: String(review.reason || "不符合入群要求").slice(0, 120) } }, 15000);
      await recordJoinPatternDecision(env, groupId, patternHash, comment, "rejected");
    } catch (error) {
      item.status = "reject_failed";
      item.result = String(error?.message || error);
      await notifyJoinRequestAttention(env, item, "join_request_failed", "AI 自动拒绝入群失败").catch(() => {});
    }
    await dbPut(env, `joinrequest:${id}`, JSON.stringify(item));
    await appendIndex(env, `joinrequest:index:${groupId}`, id, 1000);
    return item;
  }

  const id = `jr_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 6)}`;
  const item = { id, groupId, userId: String(body.user_id || ""), flag: String(body.flag || ""), subType, comment, patternHash, review, status: "pending_management", createdAt: Date.now() };
  await dbPut(env, `joinrequest:${id}`, JSON.stringify(item));
  await appendIndex(env, `joinrequest:index:${groupId}`, id, 1000);
  await notifyJoinRequestAttention(env, item, "join_request_pending", "入群申请待人工处理").catch(error => {
    console.warn("route join request notification failed", error?.message || error);
  });
  await dbPut(env, `joinrequest:${id}`, JSON.stringify(item));
  return item;
}



async function decideJoinRequestAssist(env, { groupId, actorId, id, decision }) {
  const item = await readJson(env, `joinrequest:${id}`, null);
  if (!item || String(item.groupId) !== String(groupId)) return { ok: false, message: "找不到该入群申请。" };
  const actorRole = await resolvePortalRole(env, String(actorId), String(groupId));
  const actorPermissions = await getEffectivePermissions(env, String(groupId), String(actorId), actorRole, isDeveloperId(env, actorId));
  if (!(actorPermissions.aiAdmin || actorPermissions.groupOps || actorPermissions.nativeAdmin || actorPermissions.developer)) return { ok: false, message: "缺少管理权限，无法处理入群申请。" };
  if (decision === "ignore") {
    item.status = "ignored"; item.decidedAt = Date.now(); item.decidedBy = String(actorId);
    await dbPut(env, `joinrequest:${id}`, JSON.stringify(item));
    return { ok: true, message: "已忽略该申请；没有发送拒绝操作。" };
  }
  try {
    await callOneBotAction(env, { action: "set_group_add_request", params: { flag: item.flag, sub_type: item.subType || "add", approve: true, reason: "" } }, 15000);
    item.status = "approved"; item.decidedAt = Date.now(); item.decidedBy = String(actorId);
    await dbPut(env, `joinrequest:${id}`, JSON.stringify(item));
    if (item.patternHash) await recordJoinPatternDecision(env, groupId, item.patternHash, item.comment, "approved");
    return { ok: true, message: "已由管理确认同意入群申请；相同申请方式已计入缓存。" };
  } catch (error) {
    item.status = "failed"; item.result = String(error?.message || error);
    await notifyJoinRequestAttention(env, item, "join_request_failed", "管理确认入群执行失败").catch(() => {});
    await dbPut(env, `joinrequest:${id}`, JSON.stringify(item));
    return { ok: false, message: `同意申请失败：${item.result}` };
  }
}



function normalizeRuleProxyMode(value) {
  const mode = String(value || "").trim().toLowerCase();
  return ["record", "warn", "mute", "auto"].includes(mode) ? mode : "record";
}



function normalizeRuleStrictness(value) {
  const raw = String(value || "").trim().toLowerCase();
  const aliases = {
    "智慧": "smart", "智能": "smart", "自适应": "smart", "自適應": "smart", smart: "smart", adaptive: "smart",
    "宽松": "loose", "寬鬆": "loose", loose: "loose",
    "低": "low", low: "low",
    "中": "medium", medium: "medium", normal: "medium",
    "高": "high", high: "high",
    "严格": "strict", "嚴格": "strict", strict: "strict"
  };
  return aliases[raw] || "medium";
}



function ruleStrictnessLabel(value) {
  return ({ smart: "智慧", loose: "宽松", low: "低", medium: "中", high: "高", strict: "严格" })[normalizeRuleStrictness(value)] || "中";
}



function ruleStrictnessConfig(value) {
  const normalized = normalizeRuleStrictness(value);
  const level = normalized === "smart" ? "medium" : normalized;
  const config = ({
    loose: { level, minConfidence: 0.95, instruction: "只记录极其明确、严重且具有现实伤害或明显恶意推广目的的违规；玩笑、测试、引用、讨论管理功能、普通链接一律不要判违规。" },
    low: { level, minConfidence: 0.90, instruction: "仅记录证据清楚的直接违规；测试、引用、反讽、讨论禁言或群规功能、无招揽目的的链接不要判违规。" },
    medium: { level, minConfidence: 0.82, instruction: "保持平衡，必须有完整语境证据；不能因为出现敏感词、@某人、禁言字样或链接就判违规。" },
    high: { level, minConfidence: 0.74, instruction: "可记录较明显的边界违规，但仍必须排除测试、引用、转述、管理功能讨论和正常分享链接。" },
    strict: { level, minConfidence: 0.66, instruction: "对轻微但真实的违规也可记录；即使如此仍禁止仅凭关键词或链接存在进行判定，必须说明实际违规行为。" }
  })[level];
  return { ...config, configuredLevel: normalized, adaptive: normalized === "smart" };
}



async function resolveAdaptiveRuleStrictness(env, groupId, recentContext, feedbackExamples = []) {
  const configured = normalizeRuleStrictness(await dbGet(env, `rule_strictness:${groupId}`) || DEFAULTS.ruleStrictness);
  if (configured !== "smart") return { ...ruleStrictnessConfig(configured), adaptiveReason: "使用管理员固定等级" };
  const feedback = Array.isArray(feedbackExamples) ? feedbackExamples.slice(0, 30) : [];
  const audits = (await readJson(env, `audit:system:group:${groupId}`, [])).slice(-120);
  const recentCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recentAudits = audits.filter(item => Date.parse(item.at || 0) >= recentCutoff);
  const auditReversals = recentAudits.filter(item => item.type === "rule_violation_reversed").length;
  const auditEnforcements = recentAudits.filter(item => item.type === "rule_proxy_action" && !/record|manual|cooldown/.test(String(item.action || ""))).length;
  const moderationSignals = recentAudits.filter(item => /moderation_confirmed|group_operation|conversation_action/.test(String(item.type || ""))).length;
  const falsePositives = feedback.filter(item => item.verdict === "not_violation").length + auditReversals;
  const confirmed = feedback.filter(item => item.verdict === "violation" || item.verdict === "violation_additional").length + auditEnforcements;
  const context = String(recentContext || "");
  const driftSignals = (context.match(/(?:滚|闭嘴|垃圾|废物|智障|傻逼|去死|开盒|广告|加群|刷屏|连续@|骚扰)/gi) || []).length;
  const managerSignals = (context.match(/(?:管理员|群主|警告|提醒|别刷|不要吵|停止|群规)/gi) || []).length + moderationSignals;
  let effective = "medium";
  let reason = "近期没有明显偏差，维持平衡判断";
  if (falsePositives >= 3 && falsePositives > confirmed * 1.4) {
    effective = falsePositives >= 6 ? "loose" : "low";
    reason = `近期人工复核或撤销发现 ${falsePositives} 次误判，自动放宽以降低误伤`;
  } else if (driftSignals >= 5 || (confirmed >= 4 && confirmed > falsePositives * 1.5) || managerSignals >= 5) {
    effective = driftSignals >= 9 || confirmed >= 8 ? "strict" : "high";
    reason = `近期群聊边界行为、实际处置或管理干预较多（漂移 ${driftSignals}、确认处置 ${confirmed}、管理信号 ${managerSignals}），暂时提高敏感度`;
  }
  const config = ruleStrictnessConfig(effective);
  return { ...config, configuredLevel: "smart", adaptive: true, effectiveLevel: effective, adaptiveReason: reason };
}



function defaultRuleCategoryPolicies(groupId = "") {
  const rayGroup = String(groupId || "") === "808882936";
  if (rayGroup) {
    return [
      { name: "严禁建政", punishment: "kick", note: "仅处理真实政治宣传、动员，或针对国家政治制度、领导人、公共政策和现实政治事件的实质讨论、攻击或煽动。游戏、军事梗、影视台词、虚构内容、普通玩笑和比喻不算违规。" },
      { name: "严禁涉政人物", punishment: "kick", note: "必须明确涉及现实政治人物并具有讨论、评价、攻击、宣传或动员意图；同名、历史人物、影视角色或无关玩笑不算。" },
      { name: "严禁拉人/宣群", punishment: "kick", note: "必须存在明确招揽、推广、加入陌生群或引流目的；普通链接、工具链接、资料引用和 QQAI 内部链接不算。" },
      { name: "严禁违法/开盒", punishment: "kick", note: "涉及开盒、人肉搜索、泄露隐私、传播私密内容或明确违法协助。" },
      { name: "成人内容", punishment: "remind", note: "直接发送不符合群规的成人内容；必须结合媒体内容，不能仅凭聊天文字猜测。轻微或误操作优先提醒，不自动累计警告。" },
      { name: "人身攻击", punishment: "remind", note: "必须具有真实针对群友的侮辱、骚扰、威胁或攻击意图；测试、引用、玩笑互损和管理功能讨论应排除。轻微冲突先提醒。" },
      { name: "商业行为", punishment: "remind", note: "明确广告、销售、导购或商业推广。普通分享不算；初次且影响较轻时可只提醒。" },
      { name: "隐私安全", punishment: "progressive", note: "无端骚扰、跟踪、泄露或索取他人隐私。轻微边界行为先提醒，明确或重复行为才计入累进。" },
      { name: "感官冲击", punishment: "remind", note: "猎奇血腥、恶心、恐怖惊吓等明显影响群聊体验的内容。误发或轻微内容优先提醒。" },
      { name: "公共秩序", punishment: "remind", note: "持续刷屏、长期把群聊当私聊或其他明显影响群聊秩序的行为；单条普通对话不算，先友善提醒。" },
      { name: "其他", punishment: "manual", note: "无法归入明确分类时只记录，交由管理复核。" }
    ];
  }
  return [
    { name: "政治与敏感公共议题", punishment: "manual", note: "各群定义不同，默认只交由管理员复核；不得只凭政治、国家、军事等关键词自动处罚。" },
    { name: "拉人/宣群", punishment: "manual", note: "必须确认存在明确招揽或引流意图；普通链接、资料分享和内部服务链接不算。" },
    { name: "违法/隐私侵害", punishment: "manual", note: "涉及开盒、泄露隐私或违法协助时交由管理员复核；紧急风险可由管理员单独配置处罚。" },
    { name: "成人内容", punishment: "remind", note: "必须结合实际媒体内容与群规，轻微或误操作优先提醒。" },
    { name: "人身攻击/骚扰", punishment: "remind", note: "必须结合上下文确认真实攻击或骚扰意图；测试、引用、玩笑和管理讨论应排除。" },
    { name: "商业推广", punishment: "remind", note: "明确广告或商业推广才处理；普通分享不算。" },
    { name: "公共秩序", punishment: "remind", note: "持续刷屏或明显影响群聊时先友善提醒。" },
    { name: "其他", punishment: "manual", note: "默认只记录并交由管理员复核。" }
  ];
}


function normalizeRulePolicyPunishment(value) {
  const action = String(value || "").trim().toLowerCase();
  return ["record", "remind", "warn", "recall", "mute", "progressive", "kick", "manual"].includes(action) ? action : "manual";
}



function normalizeRulePolicyActionSpec(value, fallbackAction = "manual") {
  const raw = value && typeof value === "object" ? value : { action: value };
  const action = normalizeRulePolicyPunishment(raw?.action || raw?.punishment || fallbackAction);
  return {
    action,
    muteSeconds: Math.max(0, Math.min(30 * 24 * 3600, parseUnlimitedNonNegativeInteger(raw?.muteSeconds, 0)))
  };
}



function normalizeRulePolicyActions(value, fallbackPunishment = "manual", fallbackMuteSeconds = 0) {
  const source = Array.isArray(value) && value.length ? value : [{ action: fallbackPunishment, muteSeconds: fallbackMuteSeconds }];
  const output = [];
  for (const raw of source.slice(0, 8)) {
    const item = normalizeRulePolicyActionSpec(raw, fallbackPunishment);
    const duplicate = output.some(existing => existing.action === item.action && existing.muteSeconds === item.muteSeconds);
    if (!duplicate) output.push(item);
  }
  return output.length ? output : [{ action: "manual", muteSeconds: 0 }];
}



function stripLegacyHumanCorrectionLines(value) {
  return String(value || "")
    .split(/\r?\n/)
    .filter(line => !/^\s*人工(?:纠错|糾錯)\s+\d{4}-\d{2}-\d{2}\s*[（(]QQ[:：]?\d+[）)]\s*[:：]/.test(String(line || "")))
    .join("\n")
    .trim()
    .slice(0, 2000);
}


function normalizeRuleCategoryPolicies(value, fallbackPolicies = null) {
  const source = Array.isArray(value) ? value : [];
  const output = [];
  for (const raw of source.slice(0, 50)) {
    const name = String(raw?.name || "").trim().slice(0, 80);
    if (!name || output.some(item => item.name === name)) continue;
    const actions = normalizeRulePolicyActions(raw?.actions, raw?.punishment, raw?.muteSeconds);
    output.push({
      name,
      punishment: actions[0].action,
      actions,
      note: stripLegacyHumanCorrectionLines(raw?.note),
      muteSeconds: actions.find(item => item.action === "mute")?.muteSeconds || parseUnlimitedNonNegativeInteger(raw?.muteSeconds, 0)
    });
  }
  if (output.length) return output;
  const fallback = Array.isArray(fallbackPolicies) && fallbackPolicies.length ? fallbackPolicies : defaultRuleCategoryPolicies();
  return fallback.map(raw => {
    const actions = normalizeRulePolicyActions(raw?.actions, raw?.punishment, raw?.muteSeconds);
    return { ...raw, punishment: actions[0].action, actions, note: stripLegacyHumanCorrectionLines(raw?.note), muteSeconds: actions.find(item => item.action === "mute")?.muteSeconds || parseUnlimitedNonNegativeInteger(raw?.muteSeconds, 0) };
  });
}



function sanitizeLegacyRuleViolationRecord(item, now = Date.now()) {
  if (!item || typeof item !== "object") return null;
  const before = String(item.policyNote || "").trim().slice(0, 2000);
  const policyNote = stripLegacyHumanCorrectionLines(before);
  if (policyNote === before) return null;
  return {
    ...item,
    policyNote,
    legacyPolicyNoteCleanedAt: Number(now || Date.now()),
    updatedAt: Number(now || Date.now())
  };
}


async function migrateLegacyRuleViolationPolicyNotes(env, groupId, batchSize = 50) {
  const stateKey = `rule_policy_note_migration_v273:${groupId}`;
  const previous = await readJson(env, stateKey, null);
  if (previous?.done === true) return previous;
  const ids = await readJson(env, `ruleviolation:index:${groupId}`, []);
  const list = Array.isArray(ids) ? ids.map(String).filter(Boolean) : [];
  const previousCursor = Number(previous?.cursor);
  const cursor = Number.isFinite(previousCursor)
    ? Math.max(0, Math.min(list.length, Math.trunc(previousCursor)))
    : list.length;
  const safeBatchSize = Math.max(1, Math.min(100, Math.trunc(Number(batchSize || 50))));
  const start = Math.max(0, cursor - safeBatchSize);
  let checked = 0;
  let cleaned = 0;
  const cleanedIds = [];
  const migrationAt = Date.now();
  for (const id of list.slice(start, cursor).reverse()) {
    const item = await readJson(env, `ruleviolation:${id}`, null);
    if (!item) continue;
    checked += 1;
    const next = sanitizeLegacyRuleViolationRecord(item, migrationAt);
    if (!next) continue;
    await dbPut(env, `ruleviolation:${id}`, JSON.stringify(next));
    cleaned += 1;
    cleanedIds.push(id);
  }
  const state = {
    version: 1,
    totalAtStart: Number(previous?.totalAtStart || list.length),
    cursor: start,
    done: start === 0,
    checked: Number(previous?.checked || 0) + checked,
    cleaned: Number(previous?.cleaned || 0) + cleaned,
    lastBatchChecked: checked,
    lastBatchCleaned: cleaned,
    updatedAt: migrationAt,
    completedAt: start === 0 ? migrationAt : Number(previous?.completedAt || 0)
  };
  await dbPut(env, stateKey, JSON.stringify(state));
  if (cleaned > 0 || state.done) {
    await writeSystemAudit(env, {
      type: "rule_violation_policy_note_migration",
      groupId: String(groupId || ""),
      actorId: "system:migration_v273",
      action: state.done ? "completed" : "batch",
      checked,
      cleaned,
      cleanedIds: cleanedIds.slice(0, 50),
      remaining: start
    }).catch(() => {});
  }
  return state;
}


async function getRuleCategoryPolicies(env, groupId) {
  const key = `rule_category_policies:${groupId}`;
  const raw = await readJson(env, key, null);
  const normalized = normalizeRuleCategoryPolicies(raw, defaultRuleCategoryPolicies(groupId));
  const legacyPollution = Array.isArray(raw) && raw.some(item => stripLegacyHumanCorrectionLines(item?.note) !== String(item?.note || "").trim().slice(0, 2000));
  if (legacyPollution) {
    await dbPut(env, key, JSON.stringify(normalized));
    await writeSystemAudit(env, {
      type: "rule_policy_legacy_correction_cleanup",
      groupId: String(groupId || ""),
      actorId: "system:migration_v273",
      action: "remove_per_record_corrections_from_category_notes"
    }).catch(() => {});
  }
  await migrateLegacyRuleViolationPolicyNotes(env, groupId);
  return normalized;
}



function matchRuleCategoryPolicy(name, policies) {
  const text = String(name || "").trim().toLowerCase();
  const list = normalizeRuleCategoryPolicies(policies);
  return list.find(item => item.name.toLowerCase() === text)
    || list.find(item => text.includes(item.name.toLowerCase()) || item.name.toLowerCase().includes(text))
    || list.find(item => item.name === "其他")
    || { name: "其他", punishment: "manual", actions: [{ action: "manual", muteSeconds: 0 }], note: "交由管理复核。", muteSeconds: 0 };
}



function normalizeRuleSeverity(value) {
  const raw = String(value || "").trim().toLowerCase();
  return ["minor", "moderate", "severe", "critical"].includes(raw) ? raw : "moderate";
}



function normalizeProgressiveAction(value, fallback = "warn") {
  const action = String(value || "").trim().toLowerCase();
  return ["remind", "warn", "recall", "mute", "kick", "manual"].includes(action) ? action : fallback;
}



function normalizeProgressiveActionSpecs(value, fallbackAction = "warn", fallbackMuteSeconds = 0) {
  const source = Array.isArray(value) && value.length ? value : [{ action: fallbackAction, muteSeconds: fallbackMuteSeconds }];
  const output = [];
  for (const raw of source.slice(0, 8)) {
    const action = normalizeProgressiveAction(raw?.action ?? raw?.punishment ?? raw, fallbackAction);
    const muteSeconds = Math.max(0, Math.min(30 * 24 * 3600, parseUnlimitedNonNegativeInteger(raw?.muteSeconds, action === "mute" ? fallbackMuteSeconds : 0)));
    if (output.some(item => item.action === action && item.muteSeconds === muteSeconds)) continue;
    output.push({ action, muteSeconds });
    if (action === "manual") break;
  }
  return output.length ? output : [{ action: normalizeProgressiveAction(fallbackAction, "warn"), muteSeconds: Math.max(0, parseUnlimitedNonNegativeInteger(fallbackMuteSeconds, 0)) }];
}



function defaultRuleProgressivePolicy(groupId = "") {
  const rayGroup = String(groupId || "") === "808882936";
  const steps = rayGroup
    ? [
        { actions: [{ action: "mute", muteSeconds: 60 }] },
        { actions: [{ action: "mute", muteSeconds: 600 }] },
        { actions: [{ action: "kick", muteSeconds: 0 }] }
      ]
    : [
        { actions: [{ action: "remind", muteSeconds: 0 }] },
        { actions: [{ action: "warn", muteSeconds: 0 }] },
        { actions: [{ action: "manual", muteSeconds: 0 }] }
      ];
  return {
    windowDays: Number(DEFAULTS.ruleStrikeWindowDays || 7),
    minorAction: "remind",
    steps: steps.map((step, index) => {
      const actions = normalizeProgressiveActionSpecs(step.actions, "warn", 0);
      return { index: index + 1, action: actions[0].action, muteSeconds: actions[0].muteSeconds, actions };
    })
  };
}


function normalizeRuleProgressivePolicy(value, groupId = "") {
  const base = defaultRuleProgressivePolicy(groupId);
  const raw = value && typeof value === "object" ? value : {};
  let sourceSteps = Array.isArray(raw.steps) ? raw.steps : [];
  if (!sourceSteps.length && (raw.firstAction || raw.secondAction || raw.thirdAction)) {
    sourceSteps = [
      { action: raw.firstAction, muteSeconds: raw.firstMuteSeconds },
      { action: raw.secondAction, muteSeconds: raw.secondMuteSeconds },
      { action: raw.thirdAction, muteSeconds: raw.thirdMuteSeconds }
    ];
  }
  if (!sourceSteps.length) sourceSteps = base.steps;
  const steps = sourceSteps.slice(0, 20).map((step, index) => {
    const fallbackStep = base.steps[Math.min(index, base.steps.length - 1)] || base.steps[0] || { action: "warn", muteSeconds: 0, actions: [{ action: "warn", muteSeconds: 0 }] };
    const fallbackAction = fallbackStep.action || fallbackStep.actions?.[0]?.action || "warn";
    const fallbackMuteSeconds = fallbackStep.muteSeconds || fallbackStep.actions?.find(item => item.action === "mute")?.muteSeconds || 0;
    const actions = normalizeProgressiveActionSpecs(step?.actions, step?.action || fallbackAction, step?.muteSeconds ?? fallbackMuteSeconds);
    return {
      index: index + 1,
      action: actions[0].action,
      muteSeconds: actions[0].muteSeconds,
      actions
    };
  });
  if (!steps.length) steps.push({ index: 1, action: "warn", muteSeconds: 0, actions: [{ action: "warn", muteSeconds: 0 }] });
  return {
    windowDays: Math.max(1, Math.min(365, parseUnlimitedNonNegativeInteger(raw.windowDays, base.windowDays))),
    minorAction: normalizeProgressiveAction(raw.minorAction, base.minorAction),
    steps,
    firstAction: steps[0]?.action || "warn",
    firstMuteSeconds: steps[0]?.muteSeconds || 0,
    secondAction: steps[1]?.action || steps[0]?.action || "warn",
    secondMuteSeconds: steps[1]?.muteSeconds || steps[0]?.muteSeconds || 0,
    thirdAction: steps[2]?.action || steps[steps.length - 1]?.action || "manual",
    thirdMuteSeconds: steps[2]?.muteSeconds || steps[steps.length - 1]?.muteSeconds || 0
  };
}



async function getRuleProgressivePolicy(env, groupId) {
  return normalizeRuleProgressivePolicy(await readJson(env, `rule_progressive_policy:${groupId}`, null), groupId);
}



function resolveRuleProgressiveStep(policy, count) {
  const p = normalizeRuleProgressivePolicy(policy);
  const index = Math.max(0, Math.min(p.steps.length - 1, Number(count || 1) - 1));
  const step = p.steps[index] || p.steps[p.steps.length - 1];
  const actions = normalizeProgressiveActionSpecs(step.actions, step.action, step.muteSeconds);
  return {
    action: actions[0].action,
    durationSeconds: actions[0].muteSeconds,
    actions,
    stepIndex: index + 1,
    repeatsLastStep: Number(count || 1) > p.steps.length
  };
}



function progressiveMuteFallback(policy, count, fallback = 600) {
  const p = normalizeRuleProgressivePolicy(policy);
  const upto = Math.max(0, Math.min(p.steps.length - 1, Number(count || 1) - 1));
  for (let index = upto; index >= 0; index--) {
    const mute = normalizeProgressiveActionSpecs(p.steps[index]?.actions, p.steps[index]?.action, p.steps[index]?.muteSeconds).find(item => item.action === "mute" && Number(item.muteSeconds || 0) > 0);
    if (mute) return Number(mute.muteSeconds);
  }
  return Math.max(60, parseUnlimitedNonNegativeInteger(fallback, 600));
}



async function readRecentRuleFeedbackExamples(env, groupId, limit = 20) {
  const ids = await readJson(env, `rulefeedback:index:${groupId}`, []);
  const rows = [];
  for (const id of ids.slice(-Math.max(1, Math.min(50, limit))).reverse()) {
    const item = await readJson(env, `rulefeedback:${id}`, null);
    if (!item) continue;
    rows.push({ content: String(item.content || "").slice(0, 500), originalType: String(item.originalType || "").slice(0, 100), verdict: item.verdict, note: String(item.note || "").slice(0, 300) });
  }
  return rows;
}



async function addRuleStrike(env, item, windowDays = DEFAULTS.ruleStrikeWindowDays) {
  const key = `rule_strikes:${item.groupId}:${item.userId}`;
  const cutoff = Date.now() - Math.max(1, Number(windowDays || DEFAULTS.ruleStrikeWindowDays || 7)) * 86400000;
  const list = (await readJson(env, key, [])).filter(row => Number(row.at || 0) >= cutoff && row.reversed !== true && row.id !== item.id);
  list.push({ id: item.id, at: Date.now(), category: item.violationType });
  await dbPut(env, key, JSON.stringify(list.slice(-100)));
  return list.length;
}



async function removeRuleStrike(env, item) {
  const key = `rule_strikes:${item.groupId}:${item.userId}`;
  const list = await readJson(env, key, []);
  await dbPut(env, key, JSON.stringify(list.filter(row => row.id !== item.id)));
}



function extractOneBotMessageId(data) {
  if (typeof data === "string" || typeof data === "number") return String(data);
  return String(data?.message_id ?? data?.messageId ?? data?.data?.message_id ?? data?.data?.messageId ?? "");
}



function extractRuleReviewUrls(text) {
  const matches = String(text || "").match(/https?:\/\/[^\s<>{}\[\]"']+/gi) || [];
  return [...new Set(matches.map(value => value.replace(/[),.;!?，。！？；：]+$/g, "")))].slice(0, 2);
}



async function readResponseTextPrefix(response, maxBytes = 65536) {
  if (!response?.body?.getReader) return (await response.text()).slice(0, maxBytes);
  const reader = response.body.getReader();
  const chunks = []; let total = 0;
  try {
    while (total < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = value instanceof Uint8Array ? value : new Uint8Array(value || []);
      const keep = chunk.slice(0, Math.max(0, maxBytes - total));
      chunks.push(keep); total += keep.length;
      if (keep.length < chunk.length) break;
    }
  } finally { try { await reader.cancel(); } catch {} }
  const merged = new Uint8Array(total); let offset = 0;
  for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}



function extractHtmlMetadata(html) {
  const source = String(html || "");
  const title = source.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "";
  const description = source.match(/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']*)["']/i)?.[1]
    || source.match(/<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["'](?:description|og:description)["']/i)?.[1] || "";
  return {
    title: title.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 240),
    description: description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 500)
  };
}



async function inspectUrlsForRuleReview(env, text) {
  const urls = extractRuleReviewUrls(text);
  const results = [];
  for (const rawUrl of urls) {
    let parsed;
    try { parsed = assertSafePublicUrl(rawUrl); } catch (error) {
      results.push({ url: rawUrl, ok: false, error: String(error?.message || error) });
      continue;
    }
    const trustedInternal = parsed.hostname === "qqai.ray2025.com" || parsed.hostname.endsWith(".ray2025.com");
    if (trustedInternal) {
      results.push({ url: rawUrl, finalUrl: parsed.toString(), hostname: parsed.hostname, status: 200, contentType: "internal", trustedInternal: true, title: "QQAI Control Center", description: "QQAIbot 内部服务", ok: true });
      continue;
    }
    const cacheKey = `rule_url_preview:${(await sha256Hex(parsed.toString())).slice(0, 32)}`;
    const cached = await readJson(env, cacheKey, null);
    if (cached && Date.now() - Number(cached.cachedAt || 0) < 30 * 60 * 1000) {
      results.push({ ...cached, cached: true });
      continue;
    }
    try {
      const response = await fetchPublicUrl(parsed.toString(), {
        method: "GET",
        headers: { "Accept": "text/html,application/xhtml+xml,application/json;q=0.8,*/*;q=0.2", "User-Agent": `QQAIbot/${VERSION} LinkReview` },
        signal: AbortSignal.timeout(6000)
      }, 2);
      const contentType = String(response.headers.get("Content-Type") || "").split(";")[0].trim().toLowerCase();
      let metadata = { title: "", description: "" };
      if (/text\/html|application\/xhtml\+xml/.test(contentType)) metadata = extractHtmlMetadata(await readResponseTextPrefix(response));
      const result = { url: rawUrl, finalUrl: response.url || parsed.toString(), hostname: parsed.hostname, status: response.status, contentType, trustedInternal, ...metadata, ok: response.ok, cachedAt: Date.now() };
      results.push(result);
      await dbPut(env, cacheKey, JSON.stringify(result));
    } catch (error) {
      results.push({ url: rawUrl, hostname: parsed.hostname, trustedInternal, ok: false, error: String(error?.message || error).slice(0, 300) });
    }
  }
  return results;
}



function ruleContentNeedsWebVerification(text) {
  const source = String(text || "");
  return /(?:新闻|新聞|快讯|快訊|刚刚|剛剛|最新|今日|今天|昨日|昨天|本周|本週|网传|網傳|据说|據說|消息称|消息稱|官方通报|官方通報|辟谣|闢謠|谣言|謠言|热搜|熱搜|时事|時事|政策|选举|選舉|战争|戰爭|地震|台风|颱風|事故|发布会|發布會)/i.test(source);
}



async function verifyRuleNewsContext(env, text) {
  if (!ruleContentNeedsWebVerification(text)) return null;
  try {
    const result = await callGeminiGenerate(env, {
      models: parseList(env.GEMINI_SEARCH_MODELS, ["gemini-3.5-flash", "gemini-3.1-flash-lite"]),
      apiKeys: geminiSearchApiKeys(env),
      keyProvider: "gemini_search",
      system: "你是群规判断的事实核查辅助。只核对消息中的时效性新闻或公共事件说法，简短说明可验证事实、不确定处和来源；不要替代群规作出处罚决定。",
      contents: [{ role: "user", parts: [{ text: String(text || "").slice(0, 4000) }] }],
      maxOutputTokens: 420,
      temperature: 0,
      useSearch: true,
      requireSearch: false,
      deadlineAt: Date.now() + 12000,
      maxAttempts: 2
    });
    return { ok: true, text: String(result.text || "").slice(0, 3000), sources: Array.isArray(result.sources) ? result.sources.slice(0, 5) : [], model: result.model || "" };
  } catch (error) {
    return { ok: false, error: String(error?.message || error).slice(0, 500), sources: [] };
  }
}




function ruleContentMayBeMeme(text) {
  const source = String(text || "").trim();
  if (source.length < 2 || source.length > 160) return false;
  return /(?:梗|接龙|接龍|复读|復讀|玩梗|热梗|熱梗|流行语|流行語|名场面|名場面|口号|口號)/i.test(source)
    || /^[\p{L}\p{N}，。！？!?、~～ ]{2,80}$/u.test(source);
}

async function readRuleMemeExamples(env, groupId, limit = 60) {
  const rows = await readJson(env, `rule_meme_examples:${groupId}`, []);
  return (Array.isArray(rows) ? rows : []).slice(-Math.max(1, Math.min(200, Number(limit || 60))));
}

async function rememberRuleMemeExample(env, item, actorId, note) {
  const explanation = String(note || "").trim().slice(0, 1000);
  if (!/(?:梗|接龙|接龍|复读|復讀|玩笑|群友都在玩|流行|好玩|名场面|名場面)/i.test(explanation)) return null;
  const normalized = normalizeSpamBurstText(item?.content || "");
  if (!normalized) return null;
  const key = `rule_meme_examples:${item.groupId}`;
  const current = await readJson(env, key, []);
  const next = (Array.isArray(current) ? current : []).filter(row => row?.normalized !== normalized);
  const saved = {
    normalized,
    text: String(item?.content || "").slice(0, 500),
    note: explanation,
    actorId: String(actorId || ""),
    at: Date.now()
  };
  next.push(saved);
  await dbPut(env, key, JSON.stringify(next.slice(-200)));
  await writeSystemAudit(env, { type: "rule_meme_example_learned", groupId: item.groupId, actorId: String(actorId || ""), targetId: item.id, action: "remember", reason: explanation }).catch(() => {});
  return saved;
}

function localMemeContextSignals(recentContext) {
  const source = String(recentContext || "");
  const support = (source.match(/(?:这是|這是|属于|屬於|近期|最近|当前|當前).{0,12}(?:梗|接龙|接龍|流行)|玩梗|群梗|挺好玩|录取了|錄取了|接上了|接上啦/gi) || []).length;
  const cooperative = (source.match(/(?:哈哈|笑死|草|确实|確實|有意思|挺好玩|好玩|接龙|接龍)/gi) || []).length;
  const objections = (source.match(/(?:别刷|別刷|停止刷|不要刷|影响聊天|影響聊天|太吵|很烦|很煩|煞风景|煞風景|已经刷屏|已經刷屏)/gi) || []).length;
  return {
    support,
    cooperative,
    objections,
    likelyGroupMeme: support >= 1 && support + cooperative > objections,
    disruptive: objections >= 1 && objections > support + Math.floor(cooperative / 2)
  };
}

async function verifyRuleMemeContext(env, { groupId, text, repeatedMessageBurst = false, recentContext = "", targetRecentMessages = [], humanFeedbackExamples = [], learnedExamples = [] }) {
  if (!repeatedMessageBurst && !ruleContentMayBeMeme(text)) return null;
  const normalized = normalizeSpamBurstText(text);
  if (!normalized) return null;
  const localSignals = localMemeContextSignals(recentContext);
  const learned = (Array.isArray(learnedExamples) ? learnedExamples : []).find(example => spamTextSimilarity(example?.normalized || example?.text || "", normalized) >= 0.82);
  const corrected = (Array.isArray(humanFeedbackExamples) ? humanFeedbackExamples : []).find(example => example?.verdict === "not_violation" && /(?:梗|接龙|接龍|流行|玩笑|好玩)/i.test(String(example?.note || "")) && spamTextSimilarity(example?.content || "", normalized) >= 0.82);
  const learnedMatch = learned || corrected;
  if (learnedMatch && !localSignals.disruptive) {
    return {
      ok: true,
      likelyMeme: true,
      currentTrend: false,
      groupLocal: true,
      disruptive: false,
      confidence: 0.97,
      name: "管理员已确认的群内梗",
      reason: String(learnedMatch.note || "相似表达曾由管理复核为群内梗或正常玩笑").slice(0, 500),
      sources: [],
      source: "learned_group_example"
    };
  }
  const cacheKey = `rule_meme_context:${groupId}:${(await sha256Hex(normalized)).slice(0, 32)}`;
  const cached = await readJson(env, cacheKey, null);
  if (cached && Date.now() - Number(cached.cachedAt || 0) < 6 * 60 * 60 * 1000) {
    return { ...cached, cached: true, localSignals };
  }
  try {
    const result = await callGeminiGenerate(env, {
      models: parseList(env.GEMINI_SEARCH_MODELS, ["gemini-3.5-flash", "gemini-3.1-flash-lite"]),
      apiKeys: geminiSearchApiKeys(env),
      keyProvider: "gemini_search",
      system: `你是 QQ 群聊流行梗与接龙语境核查器。你必须结合联网搜索结果和提供的群内上下文判断一句话是否属于当前流行梗、网络接龙、复读梗、群内既有梗或普通重复消息。只输出 JSON：{"likelyMeme":true|false|null,"currentTrend":true|false,"groupLocal":true|false,"disruptive":true|false,"confidence":0到1,"name":"梗名称或空","reason":"简短证据"}。
规则：
1. 搜不到不能直接证明不是梗；群内多人自然接龙、管理员历史纠错和群内明确说明可以证明 groupLocal=true。
2. 即使是梗，若有人明确要求停止、已经明显妨碍正常聊天或群规明确禁止复读，disruptive=true。
3. 单纯重复次数多不是“不是梗”的证据；也不能因为发送者声称是梗就直接相信。
4. 当前流行趋势优先使用搜索结果；不要编造梗名称或来源。`,
      contents: [{ role: "user", parts: [{ text: JSON.stringify({
        phrase: String(text || "").slice(0, 500),
        repeatedMessageBurst,
        recentContext: String(recentContext || "").slice(0, 6000),
        targetRecentMessages: (Array.isArray(targetRecentMessages) ? targetRecentMessages : []).slice(-12),
        localSignals,
        learnedExamples: (Array.isArray(learnedExamples) ? learnedExamples : []).slice(-12),
        humanFeedbackExamples: (Array.isArray(humanFeedbackExamples) ? humanFeedbackExamples : []).slice(0, 20)
      }).slice(0, 16000) }] }],
      maxOutputTokens: 260,
      temperature: 0,
      useSearch: true,
      requireSearch: false,
      deadlineAt: Date.now() + 12000,
      maxAttempts: 2
    });
    const parsed = JSON.parse(String(result.text || "").match(/\{[\s\S]*\}/)?.[0] || "{}");
    const likelyMeme = parsed.likelyMeme === true ? true : parsed.likelyMeme === false ? false : null;
    const record = {
      ok: true,
      likelyMeme,
      currentTrend: parsed.currentTrend === true,
      groupLocal: parsed.groupLocal === true || localSignals.likelyGroupMeme,
      disruptive: parsed.disruptive === true || localSignals.disruptive,
      confidence: Math.max(0, Math.min(1, Number(parsed.confidence || 0))),
      name: String(parsed.name || "").slice(0, 160),
      reason: String(parsed.reason || "联网与群内语境核查完成").slice(0, 600),
      sources: Array.isArray(result.sources) ? result.sources.slice(0, 6) : [],
      model: String(result.model || ""),
      cachedAt: Date.now(),
      source: "search_and_context"
    };
    await dbPut(env, cacheKey, JSON.stringify(record));
    return record;
  } catch (error) {
    if (localSignals.likelyGroupMeme || localSignals.disruptive) {
      return {
        ok: true,
        likelyMeme: localSignals.likelyGroupMeme ? true : null,
        currentTrend: false,
        groupLocal: localSignals.likelyGroupMeme,
        disruptive: localSignals.disruptive,
        confidence: localSignals.likelyGroupMeme || localSignals.disruptive ? 0.72 : 0,
        name: localSignals.likelyGroupMeme ? "群内接龙或群梗" : "",
        reason: localSignals.likelyGroupMeme ? "群内上下文显示多人把该表达当作接龙或玩梗" : "群内已有明确制止或干扰信号",
        sources: [],
        source: "local_context_fallback",
        searchError: String(error?.message || error).slice(0, 400)
      };
    }
    return { ok: false, likelyMeme: null, currentTrend: false, groupLocal: false, disruptive: false, confidence: 0, reason: "梗核查暂时不可用", sources: [], error: String(error?.message || error).slice(0, 500) };
  }
}

async function requestRuleManagerClarification(env, { groupId, userId, senderName, content, messageId, reason, review = null }) {
  const fingerprint = (await sha256Hex(`${groupId}|${messageId || ""}|${userId}|${String(content || "").slice(0, 500)}`)).slice(0, 24);
  const cooldownKey = `rule_manager_clarification:${groupId}:${fingerprint}`;
  if (Date.now() - Number(await dbGet(env, cooldownKey) || 0) < 30 * 60 * 1000) return { requested: false, reason: "cooldown" };
  let members = [];
  try {
    const data = await callOneBotAction(env, { action: "get_group_member_list", params: { group_id: numericId(groupId), no_cache: false } }, 12000);
    members = Array.isArray(data) ? data : [];
  } catch {
    members = await readJson(env, `group_members:${groupId}`, []);
  }
  const managers = members.filter(member => ["owner", "admin"].includes(String(member.role || ""))).map(member => ({
    id: String(member.user_id || member.qq || ""),
    role: String(member.role || "admin"),
    name: String(member.card || member.nickname || member.name || member.user_id || member.qq || "管理员")
  })).filter(member => member.id);
  if (!managers.length) {
    await notifyDeveloper(env, `【群规判断待人工确认】
群号：${groupId}
成员：${senderName || userId}（${userId}）
原因：${reason}
内容：${String(content || "").slice(0, 1000)}`).catch(() => null);
    return { requested: false, reason: "no_manager" };
  }
  const owners = managers.filter(member => member.role === "owner");
  const admins = managers.filter(member => member.role === "admin");
  const pickRandom = list => list.length ? list[Math.floor(Math.random() * list.length)] : null;
  const selected = [];
  const owner = pickRandom(owners);
  if (owner) selected.push(owner);
  const admin = pickRandom(admins.filter(member => !selected.some(chosen => chosen.id === member.id)));
  if (admin) selected.push(admin);
  if (!selected.length) selected.push(pickRandom(managers));
  const segments = [];
  if (messageId) segments.push({ type: "reply", data: { id: String(messageId) } });
  for (const manager of selected.filter(Boolean)) segments.push({ type: "at", data: { qq: manager.id } });
  segments.push({ type: "text", data: { text: ` 群规判断目前证据不足，想请管理协助确认。
对象：${senderName || userId}（QQ:${userId}）
疑点：${String(reason || "模型无法稳定判断").slice(0, 500)}
请到 Control Center 的“群规监控记录”选择“有违规”“无违规（撤销处罚）”或“有违规（追加处分）”。` } });
  try {
    await callOneBotAction(env, { action: "send_group_msg", params: { group_id: numericId(groupId), message: segments, auto_escape: false } }, 15000);
    await dbPut(env, cooldownKey, String(Date.now()));
    await writeSystemAudit(env, { type: "rule_manager_clarification", groupId, actorId: "system:rule_monitor", targetId: userId, action: "ask_managers", messageId, managerIds: selected.filter(Boolean).map(item => item.id), reason: String(reason || "").slice(0, 1000), modelReview: review });
    return { requested: true, managerIds: selected.filter(Boolean).map(item => item.id) };
  } catch (error) {
    await notifyDeveloper(env, `【群规询问管理失败】
群号：${groupId}
原因：${String(error?.message || error)}
待确认内容：${String(content || "").slice(0, 1000)}`).catch(() => null);
    return { requested: false, reason: String(error?.message || error) };
  }
}



function explicitPromotionLanguage(text) {
  return /(?:加入|进|進|加)(?:我们|我們|这个|這個)?(?:群|频道|頻道)|群号|群號|招募|宣传|宣傳|推广|推廣|引流|点(?:击)?链接|點(?:擊)?連結|邀请码|邀請碼|关注我|關注我/i.test(String(text || ""));
}



function parseUnlimitedNonNegativeInteger(value, fallback = 0) {
  const text = String(value ?? "").trim();
  if (!text) return Math.max(0, Math.trunc(Number(fallback) || 0));
  const number = Number(text);
  if (!Number.isFinite(number) || number < 0) return Math.max(0, Math.trunc(Number(fallback) || 0));
  return Math.min(Number.MAX_SAFE_INTEGER, Math.trunc(number));
}



async function appendRuleViolationRecord(env, data) {
  const id = `rv_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`;
  const item = {
    id,
    groupId: String(data.groupId || ""),
    userId: String(data.userId || ""),
    senderName: String(data.senderName || data.userId || ""),
    content: String(data.content || "").slice(0, 4000),
    violationType: String(data.violationType || "其他").slice(0, 120),
    rule: String(data.rule || "").slice(0, 500),
    reason: String(data.reason || "").slice(0, 1000),
    confidence: Math.max(0, Math.min(1, Number(data.confidence || 0))),
    recommendedAction: String(data.recommendedAction || "record"),
    actionTaken: String(data.actionTaken || "none"),
    actionResult: String(data.actionResult || ""),
    messageId: String(data.messageId || ""),
    relatedMessageIds: [...new Set((Array.isArray(data.relatedMessageIds) ? data.relatedMessageIds : []).map(String).filter(Boolean))].slice(-12),
    strictness: normalizeRuleStrictness(data.strictness || DEFAULTS.ruleStrictness),
    urlInspections: Array.isArray(data.urlInspections) ? data.urlInspections.slice(0, 3) : [],
    newsVerification: data.newsVerification || null,
    memeVerification: data.memeVerification || null,
    testContext: Boolean(data.testContext),
    severity: normalizeRuleSeverity(data.severity || "moderate"),
    intentional: data.intentional !== false,
    strikeCounted: Boolean(data.strikeCounted),
    policyAction: String(data.policyAction || ""),
    policyActions: normalizeRulePolicyActions(data.policyActions, data.policyAction || "manual", data.actionDurationSeconds || 0),
    actionsTaken: Array.isArray(data.actionsTaken) ? data.actionsTaken.map(String).slice(0, 12) : [],
    actionResults: Array.isArray(data.actionResults) ? data.actionResults.map(String).slice(0, 20) : [],
    warningMessageIds: Array.isArray(data.warningMessageIds) ? data.warningMessageIds.map(String).filter(Boolean).slice(0, 20) : [],
    policyNote: stripLegacyHumanCorrectionLines(data.policyNote),
    humanVerdict: String(data.humanVerdict || ""),
    createdAt: Date.now()
  };
  await dbPut(env, `ruleviolation:${id}`, JSON.stringify(item));
  await appendIndex(env, `ruleviolation:index:${item.groupId}`, id, 10000);
  return item;
}



async function updateRuleViolationRecord(env, item, patch) {
  const next = { ...item, ...patch, updatedAt: Date.now() };
  await dbPut(env, `ruleviolation:${item.id}`, JSON.stringify(next));
  return next;
}



async function ruleProxyCooldownRemaining(env, groupId, userId) {
  const seconds = parseUnlimitedNonNegativeInteger(await dbGet(env, `moderation_target_cooldown_seconds:${groupId}`), DEFAULTS.moderationTargetCooldownSeconds);
  if (seconds <= 0) return 0;
  const key = `rule_proxy_last_action:${groupId}:${userId}`;
  const lastAt = Number(await dbGet(env, key) || 0);
  const remaining = seconds * 1000 - (Date.now() - lastAt);
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
}



function ruleBaseActionName(value) {
  const text = String(value || "");
  if (text.includes("recall")) return "recall";
  if (text.includes("mute")) return "mute";
  if (text.includes("warn")) return "warn";
  if (text.includes("remind")) return "remind";
  if (text.includes("kick")) return "kick";
  return text;
}



async function performRuleAdditionalActions(env, item, actionSpecs, options = {}) {
  const mode = String(options.mode || "auto");
  const humanOverride = Boolean(options.humanOverride);
  const allowKick = Boolean(options.allowKick);
  const primaryAction = ruleBaseActionName(options.primaryAction || "");
  const specs = normalizeRulePolicyActions(actionSpecs, "manual", options.defaultMuteSeconds || 0);
  const taken = [];
  const results = [];
  const warningMessageIds = [];
  let muteDurationSeconds = 0;
  const botRole = (await getBotGroupRole(env, item.groupId)).role;
  const botCanModerate = botRole === "owner" || botRole === "admin";
  const kickAuthorized = humanOverride ? allowKick : (await dbGet(env, `rule_proxy_kick_authorized:${item.groupId}`) === "true");
  const allowedByMode = action => humanOverride
    || mode === "auto"
    || (mode === "mute" && ["remind", "warn", "recall", "mute"].includes(action))
    || (mode === "warn" && ["remind", "warn", "recall"].includes(action));
  for (const spec of specs) {
    const action = normalizeRulePolicyPunishment(spec.action);
    if (["record", "manual", "progressive"].includes(action)) {
      if (action === "progressive") results.push("追加动作“累进处罚”需设为分类的第一动作，本次未重复计算次数");
      continue;
    }
    if (action === primaryAction || taken.includes(action)) continue;
    if (!allowedByMode(action)) {
      results.push(`当前代理模式不允许追加“${action}”`);
      continue;
    }
    if (["recall", "mute", "kick"].includes(action) && !botCanModerate) {
      results.push(`机器人没有群管理权限，无法追加“${action}”`);
      continue;
    }
    try {
      if (action === "recall") {
        const ids = [...new Set([item.messageId, ...(Array.isArray(item.relatedMessageIds) ? item.relatedMessageIds : [])].map(String).filter(Boolean))].slice(-12);
        let recalled = 0;
        for (const id of ids) {
          try { await callOneBotAction(env, { action: "delete_msg", params: { message_id: numericId(id) } }, 15000); recalled += 1; } catch {}
        }
        if (!recalled) throw new Error("没有可成功撤回的消息");
        taken.push("recall"); results.push(`追加撤回 ${recalled} 条消息`);
      } else if (action === "mute") {
        const fallback = parseUnlimitedNonNegativeInteger(await dbGet(env, `rule_proxy_mute_seconds:${item.groupId}`), DEFAULTS.ruleProxyMuteSeconds);
        const duration = Math.max(60, Math.min(30 * 24 * 3600, parseUnlimitedNonNegativeInteger(spec.muteSeconds, fallback || 600)));
        await callOneBotAction(env, { action: "set_group_ban", params: { group_id: numericId(item.groupId), user_id: numericId(item.userId), duration } }, 15000);
        const startedAt = Date.now();
        await dbPut(env, `rule_mute_enforcement:${item.groupId}:${item.userId}`, JSON.stringify({ violationId: item.id, groupId: item.groupId, userId: item.userId, startedAt, durationSeconds: duration, expiresAt: startedAt + duration * 1000, active: true }));
        muteDurationSeconds = Math.max(muteDurationSeconds, duration);
        taken.push("mute"); results.push(`追加禁言 ${duration} 秒`);
      } else if (action === "kick") {
        if (!kickAuthorized) throw new Error(humanOverride ? "追加踢出必须由群主或开发者确认" : "群主尚未授权 AI 踢出");
        await callOneBotAction(env, { action: "set_group_kick", params: { group_id: numericId(item.groupId), user_id: numericId(item.userId), reject_add_request: false } }, 15000);
        taken.push("kick"); results.push("追加踢出群聊");
      } else if (action === "warn" || action === "remind") {
        const label = action === "warn" ? "追加警告" : "追加提醒";
        const message = [];
        if (item.messageId) message.push({ type: "reply", data: { id: String(item.messageId) } });
        message.push({ type: "at", data: { qq: String(item.userId) } });
        message.push({ type: "text", data: { text: ` ${label}：${String(options.reasonText || item.reason || item.rule || "请遵守群规").slice(0, 1000)}` } });
        const sent = await callOneBotAction(env, { action: "send_group_msg", params: { group_id: numericId(item.groupId), message, auto_escape: false } }, 15000);
        const id = extractOneBotMessageId(sent); if (id) warningMessageIds.push(id);
        taken.push(action); results.push(`已发送${label}`);
      }
    } catch (error) {
      results.push(`追加“${action}”失败：${String(error?.message || error).slice(0, 300)}`);
    }
  }
  return { ok: taken.length > 0, taken, results, warningMessageIds, muteDurationSeconds };
}



async function performRuleProxyAction(env, item, review) {
  const mode = normalizeRuleProxyMode(await dbGet(env, `rule_proxy_mode:${item.groupId}`) || DEFAULTS.ruleProxyMode);
  const policies = await getRuleCategoryPolicies(env, item.groupId);
  const policy = matchRuleCategoryPolicy(item.violationType, policies);
  const progressivePolicy = await getRuleProgressivePolicy(env, item.groupId);
  const severity = normalizeRuleSeverity(review?.severity || item.severity || "moderate");
  const intentional = review?.intentional !== false;
  const warningOnlyRacial = isRacialDiscriminationReview(item, review);
  item = await updateRuleViolationRecord(env, item, { policyAction: warningOnlyRacial ? "warn" : policy.punishment, policyActions: warningOnlyRacial ? [] : policy.actions, policyNote: warningOnlyRacial ? "种族歧视固定公开警告，不自动撤回、禁言、踢出或累计处罚" : policy.note, severity, intentional, proxyMode: mode, warningOnlyRacial });
  if (mode === "record" && !warningOnlyRacial) return updateRuleViolationRecord(env, item, { actionTaken: "record_only", actionResult: "仅记录，未启用警告或处罚代理", strikeCounted: false, progressiveCount: 0 });

  const remaining = await ruleProxyCooldownRemaining(env, item.groupId, item.userId);
  if (remaining > 0 && !warningOnlyRacial) return updateRuleViolationRecord(env, item, { actionTaken: "cooldown", actionResult: `处置冷却剩余 ${remaining} 秒；本次仍已记录`, strikeCounted: false });

  const eligibleForStrike = !warningOnlyRacial && severity !== "minor" && intentional;
  let action = "warn";
  let progressiveCount = 0;
  let duration = 0;
  let strikeCounted = false;
  let fallbackNote = "";
  let progressiveStepActions = [];

  const explicitRecallPolicy = !warningOnlyRacial && normalizeRulePolicyPunishment(policy.punishment) === "recall";
  if (warningOnlyRacial) {
    action = "warn";
    fallbackNote = "种族歧视固定采用公开警告；本次不自动撤回、禁言、踢出或计入累进处罚";
  } else if (mode === "warn") {
    if (eligibleForStrike) {
      progressiveCount = await addRuleStrike(env, item, progressivePolicy.windowDays);
      strikeCounted = true;
      action = explicitRecallPolicy ? "recall" : "warn";
    } else if (explicitRecallPolicy) {
      action = "recall";
      fallbackNote = "分类规则要求撤回；本次不计入累计次数";
    } else {
      action = normalizeProgressiveAction(progressivePolicy.minorAction, "remind");
      if (!["remind", "warn"].includes(action)) action = "remind";
      fallbackNote = "影响较轻或缺乏明确恶意，本次只提醒且不计入累计次数";
    }
  } else if (mode === "mute") {
    if (explicitRecallPolicy) {
      if (eligibleForStrike) {
        progressiveCount = await addRuleStrike(env, item, progressivePolicy.windowDays);
        strikeCounted = true;
      }
      action = "recall";
      fallbackNote = strikeCounted ? "分类规则要求撤回" : "分类规则要求撤回；本次不计入累计次数";
    } else if (eligibleForStrike) {
      progressiveCount = await addRuleStrike(env, item, progressivePolicy.windowDays);
      strikeCounted = true;
      const step = resolveRuleProgressiveStep(progressivePolicy, progressiveCount);
      action = step.action;
      duration = step.durationSeconds;
      progressiveStepActions = step.actions.slice(1);
      if (action === "kick") {
        action = "mute";
        duration = progressiveMuteFallback(progressivePolicy, progressiveCount, await dbGet(env, `rule_proxy_mute_seconds:${item.groupId}`));
        fallbackNote = "当前为禁言代理，累进规则中的踢出已自动降级为禁言";
      }
    } else {
      action = normalizeProgressiveAction(progressivePolicy.minorAction, "remind");
      if (!["remind", "warn"].includes(action)) action = "remind";
      fallbackNote = "影响较轻或缺乏明确恶意，本次只提醒且不计入累计次数";
    }
  } else {
    action = normalizeRulePolicyPunishment(policy.punishment);
    if (action === "manual" || action === "record") return updateRuleViolationRecord(env, item, { actionTaken: "record_only", actionResult: `分类“${policy.name}”设为人工复核或仅记录`, strikeCounted: false });
    if (eligibleForStrike) {
      progressiveCount = await addRuleStrike(env, item, progressivePolicy.windowDays);
      strikeCounted = true;
    }
    if (action === "progressive") {
      if (!eligibleForStrike) {
        action = normalizeProgressiveAction(progressivePolicy.minorAction, "remind");
        fallbackNote = "影响较轻或缺乏明确恶意，本次不计入累计次数";
      } else {
        const step = resolveRuleProgressiveStep(progressivePolicy, progressiveCount);
        action = step.action;
        duration = step.durationSeconds;
        progressiveStepActions = step.actions.slice(1);
      }
    } else if (action === "warn" && !eligibleForStrike) {
      action = "remind";
      fallbackNote = "影响较轻，本次仅提醒且不计入累计次数";
    }
  }

  if (!["remind", "warn", "recall", "mute", "kick", "manual"].includes(action)) action = "warn";
  if (action === "manual") return updateRuleViolationRecord(env, item, { actionTaken: "manual_review", actionResult: "已记录并交由管理员人工复核", progressiveCount, strikeCounted });

  const kickAuthorized = await dbGet(env, `rule_proxy_kick_authorized:${item.groupId}`) === "true";
  if (action === "kick" && (mode !== "auto" || !kickAuthorized)) {
    action = mode === "mute" ? "mute" : "warn";
    if (action === "mute") duration = progressiveMuteFallback(progressivePolicy, progressiveCount, await dbGet(env, `rule_proxy_mute_seconds:${item.groupId}`));
    fallbackNote = mode !== "auto" ? "只有完全代理模式允许踢出，已自动降级" : "群主尚未授权 AI 踢出，已降级处理";
  }

  const botRole = (await getBotGroupRole(env, item.groupId)).role;
  const botCanModerate = botRole === "owner" || botRole === "admin";
  if ((action === "mute" || action === "kick" || action === "recall") && !botCanModerate) {
    action = "warn";
    fallbackNote = "机器人没有足够的群管理权限，已降级为警告";
  }

  const appealHint = "如认为判断有误，请登录 Control Center → 历史违规记录，可对单条或多条记录一键申诉。";
  const countLine = strikeCounted
    ? `累计：已计入 ${progressivePolicy.windowDays} 天内第 ${Math.max(1, progressiveCount)} 次违规。`
    : "累计：本次不计入累计次数。";
  const quotedRuleMessage = (title, reasonText, extraLine = "") => {
    const segments = [];
    if (item.messageId) segments.push({ type: "reply", data: { id: String(item.messageId) } });
    segments.push({ type: "at", data: { qq: String(item.userId) } });
    segments.push({ type: "text", data: { text: `
${title}

原因：${reasonText || "请遵守群规"}
${countLine}${extraLine ? `
${extraLine}` : ""}

${appealHint}` } });
    return segments;
  };
  let result = { ok: false, message: "未执行" };
  let warningMessageId = "";
  let actionTaken = action;
  try {
    if (action === "remind") {
      const sent = await callOneBotAction(env, { action: "send_group_msg", params: { group_id: numericId(item.groupId), message: quotedRuleMessage(`群规提醒：这条消息可能不太合适（${item.violationType}）。`, item.reason || item.rule || "请留意群规"), auto_escape: false } }, 15000);
      warningMessageId = extractOneBotMessageId(sent);
      result = { ok: true, message: fallbackNote || "已发送友善提醒，不计入累计次数" };
    } else if (action === "warn") {
      const sent = await callOneBotAction(env, { action: "send_group_msg", params: { group_id: numericId(item.groupId), message: quotedRuleMessage(`群规警告：你的消息可能违反“${item.violationType}”。`, item.reason || item.rule || "请遵守群规"), auto_escape: false } }, 15000);
      warningMessageId = extractOneBotMessageId(sent);
      actionTaken = strikeCounted ? "progressive_warn" : "warn";
      result = { ok: true, message: fallbackNote || (strikeCounted ? `已发送警告（${progressivePolicy.windowDays} 天内第 ${progressiveCount} 次）` : "已发送警告，本次不计入累计次数") };
    } else if (action === "recall") {
      if (!item.messageId) throw new Error("该违规记录没有原消息 ID，无法撤回");
      const recallIds = [...new Set([item.messageId, ...(Array.isArray(item.relatedMessageIds) ? item.relatedMessageIds : [])].map(String).filter(Boolean))].slice(-12);
      const recalledIds = [];
      const recallFailures = [];
      for (const recallId of recallIds) {
        try {
          await callOneBotAction(env, { action: "delete_msg", params: { message_id: numericId(recallId) } }, 15000);
          recalledIds.push(recallId);
        } catch (error) {
          recallFailures.push({ messageId: recallId, error: String(error?.message || error).slice(0, 300) });
        }
      }
      if (!recalledIds.length) throw new Error(`撤回失败：${recallFailures.map(row => `${row.messageId}:${row.error}`).join("；") || "未知错误"}`);
      if (recallFailures.length) fallbackNote = `${fallbackNote ? fallbackNote + "；" : ""}部分重复消息撤回失败 ${recallFailures.length} 条`;
      actionTaken = strikeCounted ? "progressive_recall" : "recall";
      try {
        const sent = await callOneBotAction(env, { action: "send_group_msg", params: { group_id: numericId(item.groupId), message: [
          { type: "at", data: { qq: String(item.userId) } },
          { type: "text", data: { text: `
群规处理：已撤回 ${recalledIds.length} 条可能违反“${item.violationType}”的消息。

原因：${item.reason || item.rule || "请遵守群规"}
${countLine}

${appealHint}` } }
        ], auto_escape: false } }, 15000);
        warningMessageId = extractOneBotMessageId(sent);
      } catch (notifyError) {
        fallbackNote = `${fallbackNote ? fallbackNote + "；" : ""}违规消息已撤回，但公开通知发送失败：${String(notifyError?.message || notifyError).slice(0, 200)}`;
      }
      result = { ok: true, message: `${fallbackNote ? fallbackNote + "；" : ""}已撤回 ${recalledIds.length} 条违规消息${strikeCounted ? `（第 ${progressiveCount} 次累计）` : "（不计入累计次数）"}` };
    } else if (action === "mute") {
      const configured = parseUnlimitedNonNegativeInteger(await dbGet(env, `rule_proxy_mute_seconds:${item.groupId}`), DEFAULTS.ruleProxyMuteSeconds);
      const suggested = parseUnlimitedNonNegativeInteger(duration || policy.muteSeconds || review?.muteSeconds, configured);
      duration = Math.max(60, Math.min(30 * 24 * 3600, suggested || configured || 600));
      const durationText = duration >= 60 && duration % 60 === 0 ? `${duration / 60} 分钟` : `${duration} 秒`;
      const sent = await callOneBotAction(env, { action: "send_group_msg", params: { group_id: numericId(item.groupId), message: quotedRuleMessage(`群规处理：违反“${item.violationType}”，本次禁言 ${durationText}。`, item.reason || item.rule || "请遵守群规"), auto_escape: false } }, 15000);
      warningMessageId = extractOneBotMessageId(sent);
      await callOneBotAction(env, { action: "set_group_ban", params: { group_id: numericId(item.groupId), user_id: numericId(item.userId), duration } }, 15000);
      const muteStartedAt = Date.now();
      await dbPut(env, `rule_mute_enforcement:${item.groupId}:${item.userId}`, JSON.stringify({
        violationId: item.id, groupId: item.groupId, userId: item.userId, startedAt: muteStartedAt,
        durationSeconds: duration, expiresAt: muteStartedAt + duration * 1000, active: true
      }));
      actionTaken = strikeCounted ? "progressive_mute" : "mute";
      result = { ok: true, message: `${fallbackNote ? fallbackNote + "；" : ""}已禁言 ${duration} 秒${strikeCounted ? `（第 ${progressiveCount} 次累计）` : "（不计入累计次数）"}` };
    } else if (action === "kick") {
      await sendPortalVerificationMessage(env, item.userId, `【群规处理通知】
群号：${item.groupId}
分类：${item.violationType}
结果：已移出群聊
原因：${item.reason || item.rule || "违反群规"}
${appealHint}`).catch(() => null);
      await callOneBotAction(env, { action: "set_group_kick", params: { group_id: numericId(item.groupId), user_id: numericId(item.userId), reject_add_request: false } }, 15000);
      actionTaken = "kick";
      result = { ok: true, message: strikeCounted ? `${progressivePolicy.windowDays} 天内累计第 ${progressiveCount} 次，已踢出群聊` : "已踢出群聊" };
    }
  } catch (error) {
    result = { ok: false, message: String(error?.message || error) };
  }

  const additionalSpecs = warningOnlyRacial ? [] : [
    ...progressiveStepActions,
    ...(policy.actions || []).slice(1)
  ];
  const additional = await performRuleAdditionalActions(env, item, additionalSpecs, {
    mode,
    primaryAction: actionTaken,
    defaultMuteSeconds: policy.muteSeconds || duration,
    reasonText: item.reason || item.rule
  });
  const actionsTaken = [...new Set([ruleBaseActionName(actionTaken), ...(additional.taken || [])].filter(Boolean))];
  const actionResults = [result.message, ...(additional.results || [])].filter(Boolean);
  const warningMessageIds = [...new Set([warningMessageId, ...(additional.warningMessageIds || [])].filter(Boolean))];
  const combinedResult = actionResults.join("；");
  if (result.ok || additional.ok) await dbPut(env, `rule_proxy_last_action:${item.groupId}:${item.userId}`, String(Date.now()));
  await writeSystemAudit(env, { type: "rule_proxy_action", groupId: item.groupId, actorId: "system:rule_proxy", targetId: item.userId, action: actionsTaken.join("+"), result: combinedResult, violationId: item.id, progressiveCount, strikeCounted, severity, proxyMode: mode });
  return updateRuleViolationRecord(env, item, { actionTaken, actionsTaken, actionResult: combinedResult, actionResults, actionOk: result.ok || additional.ok, actionDurationSeconds: Math.max(duration, Number(additional.muteDurationSeconds || 0)), warningMessageId: warningMessageIds[0] || "", warningMessageIds, progressiveCount, strikeCounted, severity, intentional, proxyMode: mode });
}



async function reverseRuleViolationAction(env, item, actorId) {
  const results = [];
  const warningIds = [...new Set([item.warningMessageId, ...(Array.isArray(item.warningMessageIds) ? item.warningMessageIds : [])].map(String).filter(Boolean))];
  for (const warningId of warningIds) {
    try {
      await callOneBotAction(env, { action: "delete_msg", params: { message_id: numericId(warningId) } }, 12000);
      results.push("已撤回机器人警告消息");
    } catch (error) { results.push(`警告消息撤回失败：${String(error?.message || error)}`); }
  }
  const allActions = [...new Set([String(item.actionTaken || ""), ...(Array.isArray(item.actionsTaken) ? item.actionsTaken : [])].map(ruleBaseActionName).filter(Boolean))];
  if (allActions.includes("mute")) {
    try {
      await dbDel(env, `rule_mute_enforcement:${item.groupId}:${item.userId}`);
      await callOneBotAction(env, { action: "set_group_ban", params: { group_id: numericId(item.groupId), user_id: numericId(item.userId), duration: 0 } }, 15000);
      results.push("已解除禁言");
    } catch (error) { results.push(`解除禁言失败：${String(error?.message || error)}`); }
  }
  if (allActions.includes("recall")) results.push("原违规消息已撤回，QQ 接口无法恢复被撤回的原消息");
  if (allActions.includes("kick")) results.push("成员已被踢出，QQ 接口无法自动恢复群成员，需要人工重新邀请");
  if (item.strikeCounted || Number(item.progressiveCount || 0) > 0) await removeRuleStrike(env, item);
  const hadPublicAction = allActions.some(action => ["remind", "warn", "mute", "kick", "recall"].includes(action)) || warningIds.length > 0;
  const correctionNoticeKey = `rule_reversal_notice:${item.groupId}:${item.userId}`;
  const correctionNoticeRecent = Date.now() - Number(await dbGet(env, correctionNoticeKey) || 0) < 30000;
  if (hadPublicAction && !correctionNoticeRecent) {
    try {
      const sent = await callOneBotAction(env, {
        action: "send_group_msg",
        params: { group_id: numericId(item.groupId), message: `[CQ:at,qq=${item.userId}] 经管理员复核，此前群规判断为误判；相关警告及可撤销处罚已撤销。`, auto_escape: false }
      }, 15000);
      if (extractOneBotMessageId(sent)) {
        await dbPut(env, correctionNoticeKey, String(Date.now()));
        results.push("已发送误判更正通知");
      }
    } catch (error) { results.push(`更正通知发送失败：${String(error?.message || error)}`); }
  } else if (hadPublicAction) results.push("同一成员的更正通知已在 30 秒内发送，本次合并避免刷屏");
  else results.push("该记录没有公开警告或处罚，仅撤销违规判定");
  await writeSystemAudit(env, { type: "rule_violation_reversed", groupId: item.groupId, actorId: String(actorId), targetId: item.userId, action: item.actionTaken || "none", violationId: item.id, result: results.join("；") });
  return results.join("；") || "没有可自动撤销的处罚";
}



async function appendHumanCorrectionToRulePolicy(env, item, actorId, note) {
  const text = String(note || "").trim().slice(0, 800);
  if (!text) return { updated: false, note: "", scoped: true };
  await writeSystemAudit(env, {
    type: "rule_feedback_scoped_to_record",
    groupId: String(item?.groupId || ""),
    actorId: String(actorId || ""),
    targetId: String(item?.id || ""),
    action: String(item?.violationType || item?.rule || "其他"),
    reason: text
  }).catch(() => {});
  return {
    updated: false,
    note: text,
    category: String(item?.violationType || item?.rule || "其他"),
    scoped: true
  };
}



async function recordRuleViolationFeedback(env, item, actorId, verdict, note = "", options = {}) {
  const normalizedVerdict = verdict === "not_violation" ? "not_violation" : verdict === "violation_additional" ? "violation_additional" : "violation";
  if (normalizedVerdict !== "violation_additional" && String(item?.humanVerdict || "") === normalizedVerdict && Number(item?.humanReviewedAt || 0) > 0) return item;
  let reversalResult = "";
  let policyCorrection = null;
  let additionalResult = null;
  if (normalizedVerdict === "not_violation") {
    reversalResult = await reverseRuleViolationAction(env, item, actorId);
    policyCorrection = await appendHumanCorrectionToRulePolicy(env, item, actorId, note);
  }
  if (normalizedVerdict === "violation_additional") {
    additionalResult = await performRuleAdditionalActions(env, item, options.actions || [], {
      mode: "human",
      humanOverride: true,
      allowKick: Boolean(options.allowKick),
      defaultMuteSeconds: options.defaultMuteSeconds || item.actionDurationSeconds || DEFAULTS.ruleProxyMuteSeconds,
      reasonText: note,
      primaryAction: ""
    });
  }
  const feedbackId = `rf_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`;
  const feedback = {
    id: feedbackId,
    groupId: item.groupId,
    violationId: item.id,
    content: item.content,
    originalType: item.violationType,
    verdict: normalizedVerdict,
    note: String(note || "").slice(0, 1000),
    actorId: String(actorId),
    at: Date.now(),
    reversalResult,
    policyCorrection,
    additionalActions: normalizeRulePolicyActions(options.actions || [], "manual"),
    additionalResult
  };
  await dbPut(env, `rulefeedback:${feedbackId}`, JSON.stringify(feedback));
  await appendIndex(env, `rulefeedback:index:${item.groupId}`, feedbackId, 2000);
  if (normalizedVerdict === "not_violation") await rememberRuleMemeExample(env, item, actorId, note).catch(() => null);
  const existingActions = Array.isArray(item.actionsTaken) ? item.actionsTaken : [ruleBaseActionName(item.actionTaken || "")].filter(Boolean);
  const nextActions = [...new Set([...existingActions, ...(additionalResult?.taken || [])])];
  const existingResults = Array.isArray(item.actionResults) ? item.actionResults : [item.actionResult].filter(Boolean);
  const nextResults = [...existingResults, ...(additionalResult?.results || [])].filter(Boolean);
  const warningMessageIds = [...new Set([item.warningMessageId, ...(Array.isArray(item.warningMessageIds) ? item.warningMessageIds : []), ...(additionalResult?.warningMessageIds || [])].map(String).filter(Boolean))];
  return updateRuleViolationRecord(env, item, {
    humanVerdict: normalizedVerdict,
    humanFeedbackNote: feedback.note,
    humanReviewedBy: String(actorId),
    humanReviewedAt: Date.now(),
    reversalResult,
    policyCorrectionApplied: Boolean(policyCorrection?.updated),
    policyCorrectionCategory: policyCorrection?.category || "",
    actionsTaken: nextActions,
    actionResults: nextResults,
    actionResult: nextResults.join("；") || item.actionResult || "",
    actionOk: normalizedVerdict === "violation_additional" ? Boolean(additionalResult?.ok) : item.actionOk,
    actionDurationSeconds: Math.max(Number(item.actionDurationSeconds || 0), Number(additionalResult?.muteDurationSeconds || 0)),
    warningMessageId: warningMessageIds[0] || "",
    warningMessageIds,
    lastAdditionalPunishmentAt: normalizedVerdict === "violation_additional" ? Date.now() : Number(item.lastAdditionalPunishmentAt || 0)
  });
}



async function findLatestActiveRuleViolationForUser(env, groupId, userId) {
  const enforcement = await readJson(env, `rule_mute_enforcement:${groupId}:${userId}`, null);
  if (enforcement?.violationId) {
    const linked = await readJson(env, `ruleviolation:${enforcement.violationId}`, null);
    if (linked && String(linked.humanVerdict || "") !== "not_violation") return linked;
  }
  const ids = await readJson(env, `ruleviolation:index:${groupId}`, []);
  for (const id of ids.slice().reverse()) {
    const item = await readJson(env, `ruleviolation:${id}`, null);
    if (!item || String(item.userId || "") !== String(userId || "")) continue;
    if (String(item.humanVerdict || "") === "not_violation") continue;
    const activeActions = [...new Set([String(item.actionTaken || ""), ...(Array.isArray(item.actionsTaken) ? item.actionsTaken : [])].map(ruleBaseActionName).filter(Boolean))];
    if (activeActions.some(action => ["mute", "warn", "remind", "recall", "kick"].includes(action))) return item;
  }
  return null;
}



function normalizeSpamBurstText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\u200B-\u200D\uFEFF.,!?，。！？、~～\"'“”‘’（）()【】{}<>《》:：;；_\-]/g, "")
    .slice(0, 1000);
}

function spamTextSimilarity(left, right) {
  const a = normalizeSpamBurstText(left);
  const b = normalizeSpamBurstText(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const minLength = Math.min(a.length, b.length);
  const maxLength = Math.max(a.length, b.length);
  if (minLength < 4 || maxLength - minLength > Math.max(2, Math.floor(minLength * 0.35))) return 0;
  let prefix = 0;
  while (prefix < minLength && a[prefix] === b[prefix]) prefix += 1;
  let suffix = 0;
  while (suffix < minLength - prefix && a[a.length - 1 - suffix] === b[b.length - 1 - suffix]) suffix += 1;
  const edgeRatio = Math.max(prefix, suffix) / minLength;
  const grams = value => {
    const set = new Set();
    for (let index = 0; index < value.length - 1; index++) set.add(value.slice(index, index + 2));
    return set;
  };
  const leftGrams = grams(a);
  const rightGrams = grams(b);
  let intersection = 0;
  for (const gram of leftGrams) if (rightGrams.has(gram)) intersection += 1;
  const union = new Set([...leftGrams, ...rightGrams]).size || 1;
  return Math.max(edgeRatio, intersection / union);
}

function selectRelevantRuleFeedbackExamples(content, examples, limit = 8) {
  const current = normalizeSpamBurstText(content);
  if (!current) return [];
  const scored = [];
  for (const example of Array.isArray(examples) ? examples : []) {
    const candidate = normalizeSpamBurstText(example?.content || "");
    if (!candidate) continue;
    const similarity = spamTextSimilarity(current, candidate);
    const shorter = Math.min(current.length, candidate.length);
    const contained = shorter >= 6 && (current.includes(candidate) || candidate.includes(current));
    if (similarity < 0.55 && !contained) continue;
    scored.push({
      ...example,
      similarity: Math.max(similarity, contained ? Math.min(0.95, shorter / Math.max(current.length, candidate.length)) : 0)
    });
  }
  return scored
    .sort((left, right) => Number(right.similarity || 0) - Number(left.similarity || 0))
    .slice(0, Math.max(1, Math.min(20, Number(limit || 8))))
    .map(item => ({ ...item, similarity: Number(Number(item.similarity || 0).toFixed(3)) }));
}


function detectRepeatedMessageBurst(rows, currentText, threshold = DEFAULTS.ruleSpamThreshold, keepCount = DEFAULTS.ruleSpamKeepCount) {
  const safeThreshold = Math.max(2, Math.min(50, Number(threshold || DEFAULTS.ruleSpamThreshold)));
  const safeKeepCount = Math.max(0, Math.min(safeThreshold - 1, Number(keepCount || 0)));
  const currentNormalized = normalizeSpamBurstText(currentText);
  const prepared = (Array.isArray(rows) ? rows : []).map(row => ({
    ...row,
    normalized: normalizeSpamBurstText(row?.normalized || row?.text || "")
  })).filter(row => row.normalized);
  const exactRows = prepared.filter(row => row.normalized === currentNormalized);
  const similarRows = prepared.filter(row => spamTextSimilarity(row.normalized, currentNormalized) >= 0.8);
  let trailingSameCount = 0;
  for (let index = prepared.length - 1; index >= 0; index--) {
    if (prepared[index].normalized !== currentNormalized) break;
    trailingSameCount += 1;
  }
  const repeatedMessageBurst = exactRows.length >= safeThreshold || similarRows.length >= safeThreshold + 1;
  const evidenceRows = exactRows.length >= safeThreshold ? exactRows : similarRows;
  return {
    currentNormalized, exactSameCount: exactRows.length, similarMessageCount: similarRows.length, trailingSameCount, repeatedMessageBurst,
    repeatedMessageIds: repeatedMessageBurst
      ? evidenceRows.slice(Math.min(safeKeepCount, evidenceRows.length)).map(row => String(row.messageId || "")).filter(Boolean)
      : []
  };
}


function flirtBoundaryStateKey(groupId, userId) {
  return `flirt_boundary:${String(groupId || "")}:${String(userId || "")}`;
}

function fallbackFlirtBoundaryAssessment({ content, userId, recentRecords }) {
  const now = Date.now();
  const recent = (Array.isArray(recentRecords) ? recentRecords : []).filter(record => now - Number(record?.createdAt || 0) <= 10 * 60 * 1000);
  const flirtRows = recent.filter(record => looksLikeFlirtCandidate(record?.text || "", []));
  let offenderId = String(userId || "");
  if (isFlirtRefusalSignal(content)) {
    const prior = [...flirtRows].reverse().find(record => String(record.userId || "") !== String(userId || ""));
    if (prior) offenderId = String(prior.userId || offenderId);
  }
  const offenderRows = flirtRows.filter(record => String(record.userId || "") === offenderId);
  const explicit = /(?:做爱|做愛|约炮|約炮|上床|开房|開房|睡你|想睡你|脱衣|脫衣|摸胸|舔你|舌吻|发情|發情)/i.test(String(content || ""))
    || offenderRows.some(record => /(?:做爱|做愛|约炮|約炮|上床|开房|開房|睡你|想睡你|脱衣|脫衣|摸胸|舔你|舌吻|发情|發情)/i.test(String(record.text || "")));
  const refusal = isFlirtRefusalSignal(content) || recent.some(record => String(record.userId || "") !== offenderId && isFlirtRefusalSignal(record.text));
  const repeated = offenderRows.length >= 3;
  const boundaryViolation = explicit || (refusal && offenderRows.length > 0) || repeated;
  if (!boundaryViolation) return { flirt: true, consensual: true, boundaryViolation: false, action: "none", offenderId, targetId: "", reason: "普通、非露骨且未发现拒绝或持续纠缠的文字调情", confidence: 0.62, muteSeconds: 0 };
  const action = (refusal && repeated) || (explicit && repeated) ? "warn_recall_mute" : explicit || refusal ? "warn_recall" : "warn";
  return { flirt: true, consensual: !refusal, boundaryViolation: true, action, offenderId, targetId: "", reason: refusal ? "对方已表现拒绝或不适，仍出现持续调情内容" : explicit ? "群聊调情内容过于露骨" : "调情内容持续占用公共聊天", confidence: 0.72, muteSeconds: action === "warn_recall_mute" ? 120 : 0 };
}

async function classifyFlirtBoundary(env, payload) {
  const fallback = fallbackFlirtBoundaryAssessment(payload);
  try {
    const result = await callGoogleDecision(env, {
      system: `你是QQ群文字调情边界分类器。正常、双方自愿、不过度露骨的文字调情允许，不得处罚；单次“老婆、宝贝、抱抱、贴贴、亲亲”等也不能仅凭词语判违规。只有出现以下情况才 boundaryViolation=true：对方明确拒绝或不适后仍持续；公开内容明显露骨；强迫、纠缠、针对性骚扰；持续影响正常群聊。只输出JSON：{"flirt":true|false,"consensual":true|false,"boundaryViolation":true|false,"severity":0|1|2|3,"action":"none|warn|warn_recall|warn_recall_mute","muteSeconds":0到300,"offenderId":"QQ或空","targetId":"QQ或空","reason":"简短原因","confidence":0到1}。处置原则：轻微边界提醒；明确露骨或持续内容提醒并撤回近期相关内容；无视拒绝、强迫或重复越界才可加禁言，且最多300秒。管理员身份不代表可以无视明确拒绝，但不得仅因普通玩笑或熟人互动处罚。`,
      prompt: JSON.stringify({
        current: { userId: String(payload.userId || ""), senderRole: String(payload.senderRole || "member"), text: String(payload.content || ""), messageId: String(payload.messageId || "") },
        recent: (Array.isArray(payload.recentRecords) ? payload.recentRecords : []).slice(-18).map(record => ({ userId: String(record.userId || ""), role: String(record.senderRole || "member"), text: String(record.text || "").slice(0, 800), mentions: record.mentions || [], messageId: String(record.messageId || ""), createdAt: Number(record.createdAt || 0) })),
        fallbackSignals: fallback
      }).slice(0, 15000),
      maxOutputTokens: 240
    });
    const parsed = JSON.parse(result.text.match(/\{[\s\S]*\}/)?.[0] || "{}");
    const knownIds = new Set([String(payload.userId || ""), ...(Array.isArray(payload.recentRecords) ? payload.recentRecords : []).map(record => String(record?.userId || ""))].filter(Boolean));
    const offenderId = knownIds.has(String(parsed.offenderId || "")) ? String(parsed.offenderId) : fallback.offenderId;
    return {
      flirt: parsed.flirt === true,
      consensual: parsed.consensual !== false,
      boundaryViolation: parsed.boundaryViolation === true,
      severity: Math.max(0, Math.min(3, Number(parsed.severity || 0))),
      action: normalizeFlirtAction(parsed.action, fallback.action),
      muteSeconds: clampFlirtMuteSeconds(parsed.muteSeconds || fallback.muteSeconds || 60),
      offenderId,
      targetId: knownIds.has(String(parsed.targetId || "")) ? String(parsed.targetId) : "",
      reason: String(parsed.reason || fallback.reason || "调情边界判断").slice(0, 500),
      confidence: Math.max(0, Math.min(1, Number(parsed.confidence || fallback.confidence || 0)))
    };
  } catch (error) {
    return { ...fallback, error: String(error?.message || error).slice(0, 300) };
  }
}

async function handleFlirtBoundary(env, { groupId, userId, senderName, senderRole, content, messageId, recentRecords, canEnforce }) {
  if (!looksLikeFlirtCandidate(content, recentRecords)) return null;
  const assessment = await classifyFlirtBoundary(env, { groupId, userId, senderName, senderRole, content, messageId, recentRecords });
  if (!assessment.flirt) return null;
  if (!assessment.boundaryViolation) {
    return { status: "no_violation", review: { violation: false, confidence: assessment.confidence, violationType: "调情边界", reason: assessment.reason, flirtAllowed: true } };
  }

  const offenderId = String(assessment.offenderId || userId || "");
  const offenderRecord = [...(Array.isArray(recentRecords) ? recentRecords : [])].reverse().find(record => String(record?.userId || "") === offenderId);
  const offenderName = String(offenderRecord?.senderName || (offenderId === String(userId || "") ? senderName : offenderId));
  const offenderRole = String(offenderRecord?.senderRole || (offenderId === String(userId || "") ? senderRole : "member"));
  const stateKey = flirtBoundaryStateKey(groupId, offenderId);
  const previous = await readJson(env, stateKey, { count: 0, lastAt: 0, lastAction: "none" });
  const recentRepeat = Date.now() - Number(previous.lastAt || 0) <= 30 * 60 * 1000;
  let action = normalizeFlirtAction(assessment.action, "warn");
  if (recentRepeat && Number(previous.count || 0) >= 1 && action === "warn") action = "warn_recall";
  if (recentRepeat && Number(previous.count || 0) >= 2 && action !== "warn_recall_mute") action = "warn_recall_mute";
  // 管理层的明确越界仍可警告并记录，但不由机器人自动撤回同级管理消息或禁言管理层。
  if (isManagementRole(offenderRole) && action !== "warn") action = "warn";
  if (!canEnforce && action !== "warn") action = "warn";

  const cutoff = Date.now() - 10 * 60 * 1000;
  const relatedMessageIds = [...new Set([
    ...(Array.isArray(recentRecords) ? recentRecords : [])
      .filter(record => String(record?.userId || "") === offenderId && Number(record?.createdAt || 0) >= cutoff && looksLikeFlirtCandidate(record?.text || "", []))
      .map(record => String(record?.messageId || "")),
    offenderId === String(userId || "") ? String(messageId || "") : ""
  ].filter(Boolean))].slice(-8);

  let item = await appendRuleViolationRecord(env, {
    groupId,
    userId: offenderId,
    senderName: offenderName,
    content: String(content || ""),
    violationType: "调情边界",
    rule: "群聊文字调情需保持自愿、不过度露骨且不得持续纠缠",
    reason: assessment.reason,
    confidence: assessment.confidence,
    recommendedAction: action,
    messageId: offenderId === String(userId || "") ? String(messageId || "") : relatedMessageIds[relatedMessageIds.length - 1] || "",
    relatedMessageIds,
    strictness: "system_boundary",
    effectiveStrictness: "system_boundary",
    severity: action === "warn" ? "minor" : action === "warn_recall" ? "moderate" : "severe",
    intentional: action === "warn_recall_mute",
    policyAction: action,
    policyActions: [],
    policyNote: "独立调情边界；禁言硬上限300秒"
  });

  const results = [];
  const actionsTaken = ["warn"];
  let recalled = 0;
  if (action === "warn_recall" || action === "warn_recall_mute") {
    for (const id of relatedMessageIds) {
      try {
        await callOneBotAction(env, { action: "delete_msg", params: { message_id: numericId(id) } }, 15000);
        recalled += 1;
      } catch {}
    }
    if (recalled) {
      actionsTaken.push("recall");
      results.push(`撤回近期调情内容 ${recalled} 条`);
    } else results.push("未能撤回近期调情内容");
  }

  let muteSeconds = 0;
  if (action === "warn_recall_mute") {
    muteSeconds = clampFlirtMuteSeconds(assessment.muteSeconds || 120);
    try {
      await callOneBotAction(env, { action: "set_group_ban", params: { group_id: numericId(groupId), user_id: numericId(offenderId), duration: muteSeconds } }, 15000);
      actionsTaken.push("mute");
      results.push(`禁言 ${muteSeconds} 秒`);
      await dbPut(env, `rule_mute_enforcement:${groupId}:${offenderId}`, JSON.stringify({ violationId: item.id, groupId, userId: offenderId, startedAt: Date.now(), durationSeconds: muteSeconds, expiresAt: Date.now() + muteSeconds * 1000, active: true }));
    } catch (error) {
      results.push(`禁言失败：${String(error?.message || error).slice(0, 200)}`);
      muteSeconds = 0;
    }
  }

  const warningText = action === "warn"
    ? "群聊文字调情可以，但请注意分寸，确认对方接受后再继续。"
    : action === "warn_recall"
      ? `群聊文字调情可以，但这段已经越界；近期相关内容${recalled ? "已撤回" : "未能撤回"}，请停止继续。`
      : `群聊文字调情可以，但请停止露骨内容或无视拒绝的纠缠；近期相关内容${recalled ? "已撤回" : "未能撤回"}${muteSeconds ? `，并禁言 ${muteSeconds} 秒` : ""}。`;
  const message = [];
  if (action === "warn" && offenderId === String(userId || "") && messageId) message.push({ type: "reply", data: { id: String(messageId) } });
  message.push({ type: "at", data: { qq: offenderId } });
  message.push({ type: "text", data: { text: ` ${warningText}` } });
  let warningMessageId = "";
  try {
    const sent = await callOneBotAction(env, { action: "send_group_msg", params: { group_id: numericId(groupId), message, auto_escape: false } }, 15000);
    warningMessageId = extractOneBotMessageId(sent);
    results.unshift("已发送边界警告");
  } catch (error) {
    results.unshift(`警告发送失败：${String(error?.message || error).slice(0, 200)}`);
  }

  const nextCount = recentRepeat ? Number(previous.count || 0) + 1 : 1;
  await dbPut(env, stateKey, JSON.stringify({ count: nextCount, lastAt: Date.now(), lastAction: action, targetId: assessment.targetId || "", reason: assessment.reason }));
  item = await updateRuleViolationRecord(env, item, {
    actionTaken: `flirt_${action}`,
    actionsTaken,
    actionResults: results,
    actionResult: results.join("；"),
    actionOk: Boolean(warningMessageId || recalled || muteSeconds),
    actionDurationSeconds: muteSeconds,
    warningMessageId,
    warningMessageIds: warningMessageId ? [warningMessageId] : [],
    flirtBoundary: true,
    flirtAssessment: assessment,
    strikeCounted: false
  });
  await writeSystemAudit(env, { type: "flirt_boundary_action", groupId, actorId: "system:flirt_boundary", targetId: offenderId, action, messageId: String(messageId || ""), relatedMessageIds, muteSeconds, recalled, reason: assessment.reason }).catch(() => {});
  return { status: "violation", item, review: { violation: true, confidence: assessment.confidence, violationType: "调情边界", reason: assessment.reason, action, muteSeconds } };
}

async function inspectMessageAgainstGroupRules(env, { groupId, userId, senderName, senderRole = "member", text, messageId, manualReport = null, imageUrl = null, imageFile = null, mentionedQqs = [], quotedSenderId = "" }) {
  const manual = Boolean(manualReport && typeof manualReport === "object");
  const botRuleState = await getBotGroupRole(env, groupId);
  const canEnforce = botCanRunRuleMonitor(botRuleState);
  // 自动监控仍要求 Bot 为群主／管理员；人工补检可在权限不足时进行“仅分类与记录”，绝不假装已经处罚。
  if (!canEnforce && !manual) return { status: "disabled", message: "机器人不是本群群主或管理员，自动群规监控已停用。" };
  if (!manual && await dbGet(env, `rule_monitor_enabled:${groupId}`) === "false") return { status: "disabled", message: "本群自动群规监控已关闭。" };
  const fuse = await opsFuseAllows(env, groupId, "rule_monitor");
  if (!manual && !fuse.allowed) return { status: "disabled", message: "群规监控熔断中。" };
  const runtimeSettings = await opsGetSettings(env, groupId);
  const automationPaused = Boolean(runtimeSettings.maintenanceMode || runtimeSettings.emergencyLock);
  if (!manual && automationPaused) return { status: "disabled", message: "维护或紧急锁定期间暂停自动群规监控。" };
  const content = String(text || "").trim();
  if (!content) return { status: "error", error: "待检查消息为空" };
  if (isPoliticalModerationTopic(content)) {
    await writeSystemAudit(env, { type: "rule_political_topic_skipped", groupId, actorId: String(userId || ""), action: "skip", messageId: String(messageId || "") }).catch(() => {});
    return { status: "no_violation", review: { violation: false, confidence: 1, reason: "政治相关内容不由 AI 群规监控处理。", politicalTopicSkipped: true } };
  }
  const activeRuleRecords = await opsActiveRuleRecords(env, groupId);
  const matchedException = opsRuleExceptionMatch(content, activeRuleRecords.exceptions);
  if (matchedException) {
    await writeSystemAudit(env, { type: "ops_rule_exception", groupId, actorId: userId, action: "skip", ruleId: matchedException.id, messageId, reason: matchedException.title || matchedException.description || "" });
    return { status: "no_violation", review: { violation: false, confidence: 1, reason: `命中群规例外：${matchedException.title || matchedException.description || matchedException.id}` } };
  }
  const baseRules = String(await dbGet(env, `group_rules:${groupId}`) || "").trim();
  const temporaryRules = activeRuleRecords.tempRules.map((item, index) => `${index + 1}. [临时规则 P${Number(item.priority || 0)}] ${item.title || ""}：${item.description || ""}`).join("\n");
  const rules = [baseRules, temporaryRules].filter(Boolean).join("\n\n").trim();

  // 刷屏门槛按群设置；人工补检旧消息时不把该消息重新计入“刚刚发送”的突发计数。
  const now = Date.now();
  const spamWindowSeconds = Math.max(5, Math.min(3600, parseUnlimitedNonNegativeInteger(await dbGet(env, `rule_spam_window_seconds:${groupId}`), DEFAULTS.ruleSpamWindowSeconds)));
  const spamThreshold = Math.max(2, Math.min(50, parseUnlimitedNonNegativeInteger(await dbGet(env, `rule_spam_threshold:${groupId}`), DEFAULTS.ruleSpamThreshold)));
  const configuredKeepCount = Math.max(0, Math.min(49, parseUnlimitedNonNegativeInteger(await dbGet(env, `rule_spam_keep_count:${groupId}`), DEFAULTS.ruleSpamKeepCount)));
  const spamKeepCount = Math.min(configuredKeepCount, spamThreshold - 1);
  const burstKey = `rule_message_burst:${groupId}:${userId}`;
  const normalizeBurstText = normalizeSpamBurstText;
  let burstRows = (await readJson(env, burstKey, []))
    .filter(row => now - Number(row?.at || 0) <= spamWindowSeconds * 1000)
    .map(row => ({ at: Number(row.at || 0), messageId: String(row.messageId || ""), text: String(row.text || ""), normalized: normalizeBurstText(row.normalized || row.text || "") }));
  if (!manual && (!messageId || !burstRows.some(row => row.messageId === String(messageId)))) {
    burstRows.push({ at: now, messageId: String(messageId || ""), text: content.slice(0, 1000), normalized: normalizeBurstText(content) });
  }
  burstRows = burstRows.slice(-Math.max(20, spamThreshold + 8));
  if (!manual) await dbPut(env, burstKey, JSON.stringify(burstRows));
  const burstDecision = detectRepeatedMessageBurst(burstRows, content, spamThreshold, spamKeepCount);
  const currentNormalized = burstDecision.currentNormalized;
  const trailingSameCount = burstDecision.trailingSameCount;
  const exactSameCount = burstDecision.exactSameCount;
  const similarMessageCount = burstDecision.similarMessageCount;
  const repeatedMessageBurst = burstDecision.repeatedMessageBurst;
  const repeatedMessageIds = burstDecision.repeatedMessageIds;
  const deterministicSpamCount = Math.max(exactSameCount, similarMessageCount);
  const spamEvidence = repeatedMessageBurst ? {
    deterministic: true,
    count: deterministicSpamCount,
    exactSameCount,
    similarMessageCount,
    threshold: spamThreshold,
    windowSeconds: spamWindowSeconds,
    relatedMessageIds: repeatedMessageIds
  } : null;
  if (content.length < 2 && !repeatedMessageBurst && !manual) return { status: "no_violation", review: { violation: false, confidence: 1, reason: "消息过短且无重复发送证据" } };

  const recentLogRows = (await readJson(env, `recent_logs:${groupId}`, [])).slice(-30);
  const recentContext = recentLogRows.slice(-18).join("\n").slice(-5000);
  const racialDiscrimination = detectExplicitRacialDiscrimination(content, recentContext);
  const recentConversationRecords = await readRecentConversationRecords(env, groupId, 30);
  const managerExchange = managerExchangeContext(recentConversationRecords, { userId, senderRole, text: content, mentionedQqs, quotedSenderId });
  if (!manual && !racialDiscrimination && looksLikeRoughBanter(content) && (managerExchange.managerParticipating || managerExchange.managerStopActive)) {
    await writeSystemAudit(env, { type: "rule_banter_manager_participation_skip", groupId, actorId: String(userId || ""), action: managerExchange.managerStopActive ? "handled_by_manager_stop" : "manager_participating", messageId: String(messageId || "") }).catch(() => {});
    return { status: "no_violation", review: { violation: false, confidence: 1, reason: managerExchange.managerStopActive ? "管理已明确介入，后续由冲突守卫记录并警告，不重复执行群规处罚" : "管理层正在参与该段熟人互呛，视为已有人工分寸判断" } };
  }
  const flirtBoundary = await handleFlirtBoundary(env, { groupId, userId, senderName, senderRole, content, messageId, recentRecords: recentConversationRecords, canEnforce });
  if (flirtBoundary) return flirtBoundary;
  if (!rules && !spamEvidence && !racialDiscrimination) return { status: "no_rules" };
  const recentTargetRecords = await recentConversationMessagesForUser(env, groupId, userId, 12);
  const targetRecentMessages = recentTargetRecords.map(item => ({
    messageId: String(item.messageId || item.id || ""),
    text: String(item.text || "").replace(/\s+/g, " ").trim().slice(0, 800),
    mentions: (Array.isArray(item.mentions) ? item.mentions : []).map(String).slice(0, 20),
    createdAt: Number(item.createdAt || 0)
  }));
  const urlInspections = await inspectUrlsForRuleReview(env, content);
  const categoryPolicies = await getRuleCategoryPolicies(env, groupId);
  const recentRuleFeedback = await readRecentRuleFeedbackExamples(env, groupId, 30);
  const humanFeedbackExamples = selectRelevantRuleFeedbackExamples(content, recentRuleFeedback, 8);
  const learnedMemeExamples = await readRuleMemeExamples(env, groupId, 60);
  const strictness = await resolveAdaptiveRuleStrictness(env, groupId, recentContext, recentRuleFeedback);
  const progressivePolicy = await getRuleProgressivePolicy(env, groupId);
  const newsVerification = await verifyRuleNewsContext(env, content);
  const memeVerification = await verifyRuleMemeContext(env, {
    groupId,
    text: content,
    repeatedMessageBurst,
    recentContext,
    targetRecentMessages,
    humanFeedbackExamples,
    learnedExamples: learnedMemeExamples
  });
  const explicitMemeSpamRule = Boolean(rules && /(?:禁止|严禁|嚴禁|不得|违规|違規|处罚|處罰|警告|撤回|禁言|踢出).{0,20}(?:刷屏|复读|復讀|接龙|接龍|玩梗)|(?:刷屏|复读|復讀|接龙|接龍|玩梗).{0,20}(?:禁止|严禁|嚴禁|不得|违规|違規|处罚|處罰|警告|撤回|禁言|踢出)/i.test(rules));
  const memeProtected = repeatedMessageBurst
    && memeVerification?.likelyMeme === true
    && Number(memeVerification.confidence || 0) >= 0.7
    && !memeVerification.disruptive
    && !explicitMemeSpamRule;
  const confirmedDisruptiveSpam = repeatedMessageBurst
    && memeVerification
    && Number(memeVerification.confidence || 0) >= 0.72
    && (memeVerification.disruptive === true || memeVerification.likelyMeme === false);
  const deterministicSpamReview = memeProtected ? {
    violation: false,
    confidence: Math.max(0.88, Number(memeVerification.confidence || 0)),
    violationType: "公共秩序",
    rule: "流行梗／群内接龙语境",
    reason: `检测到相同或相似内容 ${deterministicSpamCount} 次，但联网或群内语境表明这是${memeVerification.name || "流行梗、接龙或群内玩梗"}，且没有明确制止或干扰证据；本次不按刷屏处罚。`,
    severity: "minor",
    intentional: false,
    action: "record",
    muteSeconds: 0,
    testContext: true,
    linkAssessment: "无链接",
    deterministic: true,
    memeProtected: true
  } : confirmedDisruptiveSpam ? {
    violation: true,
    confidence: Math.max(0.86, Number(memeVerification.confidence || 0)),
    violationType: "公共秩序",
    rule: rules ? "本群刷屏规则" : "系统默认反刷屏规则",
    reason: `${spamWindowSeconds} 秒内同一成员发送相同或高度相似内容 ${deterministicSpamCount} 次；梗核查未发现可免责语境，或群内已有明确制止／干扰证据。`,
    severity: deterministicSpamCount >= spamThreshold + 3 ? "severe" : "moderate",
    intentional: true,
    action: "recall",
    muteSeconds: 0,
    testContext: false,
    linkAssessment: "无链接",
    deterministic: true
  } : null;
  const imageDecisionParts = [];
  let imageInspection = null;
  if (imageUrl || imageFile) {
    try {
      const imageData = await fetchImageAsBase64({ url: imageUrl, file: imageFile });
      if (imageData?.base64) {
        imageDecisionParts.push({ inlineData: { mimeType: imageData.mimeType || "image/jpeg", data: imageData.base64 } });
        imageInspection = { ok: true, mimeType: imageData.mimeType || "image/jpeg", directEvidence: true };
      } else imageInspection = { ok: false, error: "图片下载未返回内容" };
    } catch (error) {
      imageInspection = { ok: false, error: String(error?.message || error).slice(0, 500) };
    }
  }
  const deterministicRacialReview = racialDiscrimination ? {
    violation: true,
    confidence: racialDiscrimination.confidence,
    violationType: racialDiscrimination.violationType,
    rule: "禁止种族歧视、族群贬损与去人化表达",
    reason: racialDiscrimination.reason,
    severity: "moderate",
    intentional: true,
    action: "warn",
    muteSeconds: 0,
    testContext: false,
    linkAssessment: "无链接",
    deterministic: true,
    forceWarning: true
  } : null;
  let review;
  if (deterministicRacialReview) {
    review = deterministicRacialReview;
  } else if (deterministicSpamReview) {
    review = deterministicSpamReview;
  } else {
  try {
    const result = await callGoogleDecision(env, {
      system: `你是 QQ 群规合规分类器。只能输出 JSON：{"violation":true|false,"confidence":0到1,"violationType":"违规项目分类","rule":"涉及群规","reason":"简短且具体的原因","severity":"minor|moderate|severe|critical","intentional":true|false,"action":"record|warn|mute|kick","muteSeconds":整数,"testContext":true|false,"linkAssessment":"无链接或简短判断","forceWarning":true|false}。
当前判断等级：${strictness.configuredLevel === "smart" ? `智慧→${ruleStrictnessLabel(strictness.level)}` : ruleStrictnessLabel(strictness.level)}。${strictness.instruction}
智慧校准原因：${strictness.adaptiveReason || "无"}
证据优先级（不得颠倒）：明确群规与有效临时规则 > 群规例外 > 图片直接内容证据 > 分类备注与“仅限当前相似表达”的人工纠错样本 > 最近语境与模型常识。
强制规则：
1. 必须结合最近聊天语境，测试机器人、测试禁言、测试群规、引用他人、转述、反讽、角色扮演、讨论管理操作，不等于真实违规。
2. “禁言、踢人、攻击”等词只是词语；必须判断发言者是否真的在针对他人实施骚扰或煽动现实伤害。类似“找一个人试禁言”“测试一下禁言”不得判成人身攻击。
3. 出现网址不等于拉人、宣传或引流。必须结合域名、页面标题/说明和发送意图；正常工具链接、Control Center、资料引用、个人正常分享不得判违规。
4. 无法访问链接时只能写入不确定性，不能仅因无法访问就判违规。
5. 现实政治、政党、选举、领导人、政府、公共政策、政治事件、外交、领土争议与意识形态内容必须 violation=false；AI 群规监控不得评论、记录为违规或处罚政治内容。游戏、影视与虚构阵营只有在明确映射现实政治时才按此静默略过。
6. violationType 必须优先选择“分类与处罚设置”中已有的分类。群规正文与有效临时规则具有最高优先级；分类备注和人工纠错用于解释群规，不得反过来覆盖明确群规。
7. 管理人工复核结果是单条学习样本，只能影响内容实质相似的表达；禁止把某一人的单笔纠错备注当成整个分类或所有后续消息的规则。被标记为误判的相似表达不得再次仅凭表面词语判违规。
8. severity 必须按实际影响判断：minor 是轻微、初次、无明显恶意或可通过提醒改善；moderate 是明确违规；severe 是重复、明显恶意或造成较大影响；critical 是需要立即制止的严重行为。
9. intentional 只有在语境显示明确故意时才为 true。轻微、误发、误解、初次边界行为应优先标记 minor，并由系统采用不累计次数的友善提醒。
10. 刷屏标准以本群群规和本群配置为准；当前确定性配置为 ${spamWindowSeconds} 秒内同内容 ${spamThreshold} 条，处罚撤回时保留最早 ${spamKeepCount} 条。
11. repeatedMessageBurst 只是确定性参考。即使它为 false，也可以根据最近聊天语境识别变体刷屏；但必须说明实际的多条消息证据，不能把单条消息内重复字符谎称为多次发送。
12. 人工补检原因只是线索，不是事实。必须独立核对被举报消息、该成员近期消息和群规；恶意举报或证据不足时必须 violation=false。
13. 对同一群友反复 @、持续使用“爸爸、妈妈、爸妈、儿子、主人”等称呼进行纠缠，在对方不接受、已表现不适或行为明显持续时，可按定向骚扰／人身攻击判断；正常互相玩梗、双方自愿称呼或单次无恶意玩笑不得误判。
14. 图片存在时必须直接检查图片内容，不得只看“[图片]”占位文字；图片直接证据的优先级高于普通语言猜测，但仍受明确群规和例外约束。
15. 时效性新闻或公共事件若提供了联网核查结果，必须优先采用核查事实；核查失败只能标记不确定，不能编造。
16. 不确定必须输出 violation=false，并在 reason 明确写“需要管理确认”。action 只是建议，系统会按授权范围决定是否执行。
17. 流行梗、多人自愿接龙、复读梗、双方都在参与的玩笑或群内既有梗不等于恶意刷屏；除非明确群规禁止，或有人明确制止、正常聊天已被持续打断，才可按公共秩序处理。
18. memeVerification 是联网搜索、群内上下文和管理员历史纠错的综合核查。likelyMeme=true 且 disruptive=false 时优先不处罚；搜不到只能视为未知，不能直接判定“不是梗”。
19. 管理员、群主或开发者正在参与一段熟人互呛时，不得仅凭“滚、神经、笨蛋”等短词判违规；管理明确要求停止后仍继续的情况由独立冲突守卫记录并警告，避免重复处罚。
20. 群内普通、双方自愿且不过度露骨的文字调情允许。只有明确拒绝后仍持续、公开内容明显露骨、强迫纠缠或持续影响正常聊天时才越界；独立调情边界最多禁言300秒。
21. 明确宣称某一种族／族群天生低等、低贱、不是人或只配当工具，使用奴隶／农具／棉花种植园等语境去人化特定族群，或主张必须歧视、隔离、排斥某族群，必须判为“种族歧视”，action=warn，forceWarning=true。此类项目固定公开警告，不建议撤回、禁言或踢出；反对、引用并批评种族歧视不得误判。`,
      prompt: JSON.stringify({
        currentMessage: content,
        userId,
        senderName,
        recentContext,
        targetRecentMessages,
        manualReport: manual ? {
          reporterId: String(manualReport.reporterId || ""),
          reporterName: String(manualReport.reporterName || ""),
          reason: String(manualReport.reason || "").slice(0, 1000),
          sourceMessageId: String(manualReport.sourceMessageId || "")
        } : null,
        recentUserMessageBurst: burstRows,
        repeatedMessageBurst,
        spamEvidence,
        trailingSameCount,
        exactSameCount,
        similarMessageCount,
        spamWindowSeconds,
        spamThreshold,
        spamKeepCount,
        strictness: { configured: strictness.configuredLevel, effective: strictness.level, reason: strictness.adaptiveReason },
        categoryPolicies: categoryPolicies.map(item => ({ name: item.name, punishment: item.punishment, actions: item.actions, note: String(item.note || "").slice(0, 800) })),
        progressivePolicy,
        humanFeedbackExamples,
        learnedMemeExamples,
        memeVerification,
        rules: rules.slice(0, 7000),
        activeTemporaryRules: activeRuleRecords.tempRules.map(item => ({ id: item.id, title: item.title, description: item.description, priority: item.priority, expiresAt: item.expiresAt || 0 })),
        rulePriorities: activeRuleRecords.priorities.map(item => ({ id: item.id, title: item.title, description: item.description, priority: item.priority })),
        urlInspections,
        newsVerification,
        imageInspection
      }).slice(0, 22000),
      inputParts: imageDecisionParts,
      maxOutputTokens: 420
    });
    review = JSON.parse(result.text.match(/\{[\s\S]*\}/)?.[0] || "{}");
  } catch (error) {
    console.warn("群规监控判定失败", error);
    await opsRecordAutomationResult(env, groupId, "rule_monitor", false, error?.message || error).catch(() => {});
    const reason = `Google 判断链暂时无法稳定分类：${String(error?.message || error).slice(0, 300)}`;
    await opsSaveRecord(env, { type: "test_case", groupId, actorId: "system:rule_monitor", actorName: "system", data: { title: "群规判断待人工确认", description: content.slice(0, 4000), status: "pending_review", messageId: String(messageId || ""), userId: String(userId || ""), reason, imageInspection, newsVerification, memeVerification } }).catch(() => {});
    const clarification = await requestRuleManagerClarification(env, { groupId, userId, senderName, content, messageId, reason });
    return { status: "pending_review", reason, clarification };
  }
  }
  await opsRecordAutomationResult(env, groupId, "rule_monitor", true).catch(() => {});

  const reviewText = `${review?.violationType || ""} ${review?.rule || ""} ${review?.reason || ""}`;
  const allLinksInternal = urlInspections.length > 0 && urlInspections.every(item => item.trustedInternal);
  if (allLinksInternal && /拉人|宣群|宣传|推广|引流/i.test(reviewText) && !explicitPromotionLanguage(content)) {
    return { status: "no_violation", review: { ...review, violation: false, reason: "内部或可信链接没有明确引流意图" } };
  }
  if (review?.testContext === true && !/(明确威胁|现实伤害|泄露隐私|诈骗|恶意刷屏|持续骚扰)/i.test(reviewText)) {
    return { status: "no_violation", review: { ...review, violation: false } };
  }
  const decisionThreshold = manual ? Math.max(0.55, strictness.minConfidence - 0.08) : strictness.minConfidence;
  if (review?.violation !== true || Number(review.confidence || 0) < decisionThreshold) {
    const confidence = Number(review?.confidence || 0);
    const explicitlyUncertain = /(?:不确定|不確定|需要管理|证据不足|證據不足|无法判断|無法判斷|需人工)/i.test(String(review?.reason || ""));
    const borderline = confidence >= Math.max(0.45, decisionThreshold - 0.18) && confidence < decisionThreshold;
    if (explicitlyUncertain || borderline) {
      const reason = String(review?.reason || `置信度 ${confidence.toFixed(2)} 未达到 ${decisionThreshold.toFixed(2)}`).slice(0, 500);
      await opsSaveRecord(env, { type: "test_case", groupId, actorId: "system:rule_monitor", actorName: "system", data: { title: "边界群规判断待管理确认", description: content.slice(0, 4000), status: "pending_review", messageId: String(messageId || ""), userId: String(userId || ""), modelReview: review, recentContext: recentContext.slice(0, 5000), imageInspection, newsVerification, memeVerification } }).catch(() => {});
      const clarification = await requestRuleManagerClarification(env, { groupId, userId, senderName, content, messageId, reason, review });
      return { status: "pending_review", review, threshold: decisionThreshold, clarification };
    }
    if (!manual && runtimeSettings.ruleSampleReviewPercent > 0 && Math.random() * 100 < runtimeSettings.ruleSampleReviewPercent) {
      await opsSaveRecord(env, { type: "test_case", groupId, actorId: "system:rule_sample", actorName: "system", data: { title: "无违规判断抽样复核", description: content.slice(0, 4000), status: "pending_review", messageId: String(messageId || ""), userId: String(userId || ""), modelReview: review, recentContext: recentContext.slice(0, 5000) } }).catch(() => {});
    }
    return { status: "no_violation", review, threshold: decisionThreshold };
  }

  const matchedPolicy = matchRuleCategoryPolicy(review.violationType || review.rule || "其他", categoryPolicies);
  let item = await appendRuleViolationRecord(env, {
    groupId, userId, senderName, content,
    violationType: matchedPolicy.name,
    rule: review.rule || "",
    reason: review.reason || "",
    confidence: review.confidence,
    recommendedAction: review.action || "record",
    messageId,
    relatedMessageIds: repeatedMessageIds,
    strictness: strictness.configuredLevel === "smart" ? "smart" : strictness.level,
    effectiveStrictness: strictness.level,
    strictnessReason: strictness.adaptiveReason,
    urlInspections,
    newsVerification,
    memeVerification,
    imageInspection,
    testContext: Boolean(review.testContext),
    severity: normalizeRuleSeverity(review.severity || "moderate"),
    intentional: review.intentional !== false,
    policyAction: matchedPolicy.punishment,
    policyActions: matchedPolicy.actions,
    policyNote: matchedPolicy.note
  });
  if (manual) {
    item = await updateRuleViolationRecord(env, item, {
      manualReport: true,
      reportedBy: String(manualReport.reporterId || ""),
      reporterName: String(manualReport.reporterName || ""),
      reportReason: String(manualReport.reason || "").slice(0, 1000),
      reportSourceMessageId: String(manualReport.sourceMessageId || ""),
      reportedAt: Number(manualReport.requestedAt || Date.now()),
      matchedRuleSource: activeRuleRecords.tempRules.some(rule => reviewText.includes(String(rule.title || ""))) ? "temporary_rule" : "base_group_rules",
      activeTemporaryRuleIds: activeRuleRecords.tempRules.map(rule => rule.id),
      rulePriorityIds: activeRuleRecords.priorities.map(rule => rule.id)
    });
  }
  if (runtimeSettings.testMode) {
    item = await updateRuleViolationRecord(env, item, { actionTaken: "test_mode", actionResult: "测试群模式：只记录模拟结果，没有执行处罚。" });
    await writeSystemAudit(env, { type: "ops_test_mode", groupId, actorId: "system", targetId: userId, action: "rule_simulated", violationId: item.id });
    return { status: "violation", item, review, actionResult: item.actionResult };
  }
  if (manual && (!canEnforce || automationPaused || !fuse.allowed)) {
    const reason = !canEnforce ? "机器人不是群主或管理员" : automationPaused ? "维护或紧急锁定中" : "自动化熔断中";
    item = await updateRuleViolationRecord(env, item, { actionTaken: "manual_record_only", actionResult: `补检确认违规，但${reason}，本次仅记录，未执行处罚。` });
    await writeSystemAudit(env, { type: "manual_rule_check_recorded", groupId, actorId: String(manualReport.reporterId || ""), targetId: userId, action: "record_only", violationId: item.id, result: item.actionResult }).catch(() => {});
    return { status: "violation", item, review, actionResult: item.actionResult };
  }
  item = await performRuleProxyAction(env, item, review);
  if (manual) await writeSystemAudit(env, { type: "manual_rule_check_confirmed", groupId, actorId: String(manualReport.reporterId || ""), targetId: userId, action: item.actionTaken || "none", violationId: item.id, result: item.actionResult || "" }).catch(() => {});
  return { status: "violation", item, review, actionResult: item.actionResult || "" };
}



async function createGroupWorkRequest(env, data) {
  const id = `gw_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 6)}`;
  const review = await reviewGroupWorkWithGemma(env, data.type, data.content || data.file || "");
  const item = {
    id, status: "pending_owner", groupId: String(data.groupId), creatorId: String(data.creatorId),
    creatorName: String(data.creatorName || data.creatorId), type: String(data.type), content: String(data.content || "").slice(0, 5000),
    file: String(data.file || "").slice(0, 2000), fileName: String(data.fileName || "").slice(0, 255), sourceMessageId: String(data.sourceMessageId || ""),
    review, createdAt: Date.now(), expiresAt: Date.now() + 24 * 60 * 60 * 1000
  };
  await dbPut(env, `groupwork:${id}`, JSON.stringify(item));
  await appendIndex(env, `groupwork:index:${item.groupId}`, id, 500);
  await writeSystemAudit(env, { type: "groupwork_requested", groupId: item.groupId, actorId: item.creatorId, action: item.type, requestId: id });
  item.notification = await dispatchHumanAttentionNotification(env, {
    groupId: item.groupId,
    eventId: "group_work_request",
    message: `【群务请求待处理】
编号：${item.id}
提出者：${item.creatorName}（QQ:${item.creatorId}）
类型：${item.type}
内容：${item.content || item.fileName || "未提供"}
请由获通知的管理人员进入 Portal 或使用现有群务决定指令处理。`,
    audit: { actorId: item.creatorId, requestId: item.id, requestType: item.type }
  }).catch(error => ({ ok: false, error: String(error?.message || error).slice(0, 500) }));
  await dbPut(env, `groupwork:${id}`, JSON.stringify(item));
  return item;
}



async function executeGroupWorkRequest(env, item, ownerId) {
  if (!(await canUseBotGroupOperations(env, item.groupId, ownerId))) return { ok: false, message: "缺少群操作权限，无法执行群公告、群待办或群文件操作。" };
  try {
    if (item.type === "notice") {
      await callOneBotAction(env, { action: "_send_group_notice", params: { group_id: numericId(item.groupId), content: item.content } }, 15000);
      return { ok: true, message: "群公告已由群主授权发布。" };
    }
    if (item.type === "todo") {
      const sent = await callOneBotAction(env, { action: "send_group_msg", params: { group_id: numericId(item.groupId), message: item.content, auto_escape: false } }, 15000);
      const messageId = sent?.message_id ?? sent?.messageId ?? sent?.data?.message_id ?? sent?.data?.messageId;
      if (!messageId) throw new Error("发送待办内容后未取得 message_id");
      await callOneBotAction(env, { action: "set_group_todo", params: { group_id: numericId(item.groupId), message_id: String(messageId) } }, 15000);
      return { ok: true, message: "群待办已由群主授权建立。" };
    }
    if (item.type === "file") {
      if (!item.file) return { ok: false, message: "群文件缺少可上传的 URL 或 NapCat 可访问路径。" };
      await callOneBotAction(env, { action: "upload_group_file", params: { group_id: numericId(item.groupId), file: item.file, name: item.fileName || "QQAI上传文件", folder_id: "/" } }, 60000);
      return { ok: true, message: "群文件已由群主授权上传。" };
    }
    return { ok: false, message: "未知群务类型。" };
  } catch (error) {
    return { ok: false, message: `群务执行失败：${error?.message || error}` };
  }
}



async function handleGroupWorkDecision(env, { groupId, actorId, id, decision }) {
  const item = await readJson(env, `groupwork:${id}`, null);
  if (!item || String(item.groupId) !== String(groupId)) return { ok: false, message: "找不到该群务确认单。" };
  if (item.status !== "pending_owner") return { ok: false, message: `该群务当前状态为 ${item.status}。` };
  if (!(await canUseBotGroupOperations(env, groupId, actorId))) return { ok: false, message: "只有 QQ 管理员、群主、开发者或获授群操作权限者可以处理该群务确认单。" };
  if (decision === "cancel") {
    item.status = "cancelled"; item.decidedAt = Date.now(); item.decidedBy = String(actorId);
    await dbPut(env, `groupwork:${id}`, JSON.stringify(item));
    return { ok: true, message: `群务 ${id} 已取消，未执行。` };
  }
  const result = await executeGroupWorkRequest(env, item, actorId);
  item.status = result.ok ? "executed" : "failed"; item.decidedAt = Date.now(); item.decidedBy = String(actorId); item.result = result.message;
  await dbPut(env, `groupwork:${id}`, JSON.stringify(item));
  await writeSystemAudit(env, { type: "groupwork_decided", groupId, actorId, action: item.type, requestId: id, result: result.ok ? "executed" : "failed" });
  return result;
}



async function createModerationProposal(env, data) {
  const now = Date.now();
  const cooldownSeconds = Math.max(0, Number(await dbGet(env, `moderation_target_cooldown_seconds:${data.groupId}`) || DEFAULTS.moderationTargetCooldownSeconds));
  const cooldownKey = data.targetId ? `moderation:target_cooldown:${data.groupId}:${data.action}:${data.targetId}` : "";
  if (cooldownKey && cooldownSeconds > 0) {
    const lastAt = Number(await dbGet(env, cooldownKey) || 0);
    if (lastAt && now - lastAt < cooldownSeconds * 1000) {
      throw new Error(`同一对象处置仍在冷却中，请在 ${Math.ceil((cooldownSeconds * 1000 - (now - lastAt)) / 1000)} 秒后重试。`);
    }
    await dbPut(env, cooldownKey, String(now));
  }
  const id = `op_${now.toString(36)}_${crypto.randomUUID().slice(0, 6)}`;
  const proposal = {
    id,
    status: "pending",
    createdAt: now,
    expiresAt: now + DEFAULTS.moderationProposalTtlMs,
    groupId: String(data.groupId || ""),
    actorId: String(data.actorId || ""),
    actorName: String(data.actorName || data.actorId || ""),
    actorRole: String(data.actorRole || "member"),
    action: data.action,
    targetId: String(data.targetId || ""),
    targetName: String(data.targetName || data.targetId || ""),
    targetRole: String(data.targetRole || "member"),
    durationSeconds: Number(data.durationSeconds || 0),
    preventUnmute: Boolean(data.preventUnmute),
    allowOwnerUnmute: Boolean(data.preventUnmute && data.allowOwnerUnmute),
    skipConfirmation: Boolean(data.skipConfirmation),
    rejectAddRequest: Boolean(data.rejectAddRequest),
    sourceText: String(data.sourceText || "").slice(0, 1000),
    classifierReason: String(data.classifierReason || ""),
    reason: String(data.reason || "").trim().slice(0, 1000),
    messageId: String(data.messageId || "")
  };
  await dbPut(env, `moderation:proposal:${id}`, JSON.stringify(proposal));
  await dbPut(env, `moderation:last:${proposal.groupId}:${proposal.actorId}`, id);
  await dbPut(env, `moderation:last:${proposal.groupId}`, id);
  await appendIndex(env, `moderation:proposal:index:${proposal.groupId}`, id, 500);
  await writeSystemAudit(env, {
    type: "moderation_proposed",
    groupId: proposal.groupId,
    actorId: proposal.actorId,
    actorName: proposal.actorName,
    targetId: proposal.targetId,
    targetName: proposal.targetName,
    action: proposal.action,
    durationSeconds: proposal.durationSeconds,
    classifierReason: proposal.classifierReason,
    reason: proposal.reason,
    proposalId: id
  });
  return proposal;
}



function formatModerationProposal(proposal) {
  const targetLine = moderationActionNeedsTarget(proposal.action)
    ? `\n目标：${proposal.targetName || proposal.targetId}（QQ:${proposal.targetId}）`
    : "";
  const durationLine = proposal.action === "mute" ? `\n时长：${formatDuration(proposal.durationSeconds || 600)}` : "";
  const reasonLine = proposal.reason ? `\n补充原因：${proposal.reason}` : "";
  const protectionLine = proposal.action === "mute" && proposal.preventUnmute ? `\n防解除：${proposal.allowOwnerUnmute ? "开发者或群主可解除" : "仅开发者可解除"}` : "";
  const skipLine = proposal.skipConfirmation ? "\nPortal 执行按钮：跳过网页确认视窗" : "";
  return `⚠️ 已建立待确认操作\n编号：${proposal.id}\n动作：${moderationActionLabel(proposal.action)}${targetLine}${durationLine}${reasonLine}${protectionLine}${skipLine}\n识别原因：${proposal.classifierReason || "管理指令"}\n请在 2 分钟内发送「确认op」执行，或发送「取消op」取消。编号仍可用于「确认 ${proposal.id}」或「取消 ${proposal.id}」；未确认不会执行任何群操作。`;
}



async function validateModerationProposalTarget(env, proposal, confirmerRole, confirmerId) {
  if (!moderationActionNeedsTarget(proposal.action)) return { ok: true };
  const developerId = String(env.DEVELOPER_ID || DEFAULT_DEVELOPER_ID);
  if (!proposal.targetId) return { ok: false, message: "操作缺少明确目标。" };
  if (proposal.targetId === String(confirmerId)) return { ok: false, message: "不能对自己执行该操作。" };
  if (proposal.targetId === developerId) return { ok: false, message: "不能对核心开发者执行该操作。" };
  const target = await getGroupMemberSafe(env, proposal.groupId, proposal.targetId);
  const targetRole = target?.role || proposal.targetRole || "member";
  if (targetRole === "owner") return { ok: false, message: "不能对群主执行该操作。" };
  if (targetRole === "admin" && !["owner", "developer"].includes(confirmerRole)) return { ok: false, message: "管理员不能对其他管理员执行该操作，必须由群主确认。" };
  if (["set_admin", "unset_admin"].includes(proposal.action) && !(await isBotVerifiedGroupOwner(env, proposal.groupId))) {
    return { ok: false, message: "机器人账号当前不是本群群主，无法新增或撤除真正 QQ 管理员。" };
  }
  return { ok: true, target };
}



async function executeModerationProposal(env, proposal, confirmer) {
  const validation = await validateModerationProposalTarget(env, proposal, confirmer.role, confirmer.id);
  if (!validation.ok) return { ok: false, message: validation.message };
  const group_id = numericId(proposal.groupId);
  const user_id = numericId(proposal.targetId);
  let action = "";
  let params = {};
  if (proposal.action === "kick") { action = "set_group_kick"; params = { group_id, user_id, reject_add_request: Boolean(proposal.rejectAddRequest) }; }
  else if (proposal.action === "mute") { action = "set_group_ban"; params = { group_id, user_id, duration: Math.max(60, Math.min(30 * 24 * 3600, Number(proposal.durationSeconds || 600))) }; }
  else if (proposal.action === "unmute") { action = "set_group_ban"; params = { group_id, user_id, duration: 0 }; }
  else if (proposal.action === "whole_mute") { action = "set_group_whole_ban"; params = { group_id, enable: true }; }
  else if (proposal.action === "whole_unmute") { action = "set_group_whole_ban"; params = { group_id, enable: false }; }
  else if (proposal.action === "set_admin") { action = "set_group_admin"; params = { group_id, user_id, enable: true }; }
  else if (proposal.action === "unset_admin") { action = "set_group_admin"; params = { group_id, user_id, enable: false }; }
  else return { ok: false, message: "未知群操作。" };
  let releasedLock = null;
  let previousMuteLock = null;
  let preparedMuteLock = false;
  if (proposal.action === "mute") {
    previousMuteLock = await getMuteLock(env, proposal.groupId, proposal.targetId);
    if (previousMuteLock?.source === "self") return { ok: false, message: "该成员正在自我禁言，管理待确认操作不能覆盖。" };
    if (proposal.preventUnmute) {
      try {
        await createManualMuteLock(env, {
          groupId: proposal.groupId,
          userId: proposal.targetId,
          actorId: confirmer.id,
          durationSeconds: Math.max(60, Math.min(30 * 24 * 3600, Number(proposal.durationSeconds || 600))),
          allowOwnerUnmute: Boolean(proposal.allowOwnerUnmute),
          reason: proposal.reason || proposal.classifierReason || "群待确认操作"
        });
        preparedMuteLock = true;
      } catch (error) {
        return { ok: false, message: `无法建立防解除锁，未执行禁言：${String(error?.message || error)}` };
      }
    }
  }
  if (proposal.action === "unmute") {
    const lock = await getMuteLock(env, proposal.groupId, proposal.targetId);
    const permission = canUnlockMute(env, lock, {
      actorId: confirmer.id,
      actorRole: confirmer.role,
      isDeveloper: confirmer.role === "developer"
    });
    if (!permission.allowed) {
      const message = lock?.source === "self"
        ? "该成员为自我禁言，只能本人私讯机器人发送 !解除禁言。"
        : lock?.allowOwnerUnmute
          ? "该禁言只能由开发者或群主解除。"
          : "该禁言只能由开发者解除。";
      return { ok: false, message };
    }
    if (lock) {
      releasedLock = lock;
      await clearMuteLock(env, proposal.groupId, proposal.targetId);
    }
  }
  let result;
  try {
    result = await runOneBotGroupOperation(env, action, params, {
      actorId: confirmer.id,
      groupId: proposal.groupId,
      targetId: proposal.targetId,
      action: moderationActionLabel(proposal.action),
      proposalId: proposal.id
    });
  } catch (error) {
    if (releasedLock) await putMuteLock(env, releasedLock).catch(() => {});
    if (preparedMuteLock) {
      if (previousMuteLock?.active) await putMuteLock(env, previousMuteLock).catch(() => {});
      else await clearMuteLock(env, proposal.groupId, proposal.targetId).catch(() => {});
    }
    throw error;
  }
  if (!result.ok) {
    if (releasedLock) await putMuteLock(env, releasedLock).catch(() => {});
    if (preparedMuteLock) {
      if (previousMuteLock?.active) await putMuteLock(env, previousMuteLock).catch(() => {});
      else await clearMuteLock(env, proposal.groupId, proposal.targetId).catch(() => {});
    }
  } else if (proposal.action === "mute" && !proposal.preventUnmute && previousMuteLock) {
    await clearMuteLock(env, proposal.groupId, proposal.targetId).catch(() => {});
  }
  return result.ok ? { ok: true, message: `已执行：${moderationActionLabel(proposal.action)}。` } : { ok: false, message: `操作失败：${result.error}` };
}



async function findLatestPendingModerationProposalId(env, groupId) {
  const pointer = String(await dbGet(env, `moderation:last:${groupId}`) || "");
  if (pointer) {
    const proposal = await readJson(env, `moderation:proposal:${pointer}`, null);
    if (proposal?.status === "pending" && Number(proposal.expiresAt || 0) >= Date.now()) return pointer;
  }
  const ids = await readJson(env, `moderation:proposal:index:${groupId}`, []);
  for (const id of ids.slice().reverse()) {
    const proposal = await readJson(env, `moderation:proposal:${id}`, null);
    if (proposal?.status === "pending" && Number(proposal.expiresAt || 0) >= Date.now()) return String(id);
  }
  return "";
}



async function retractModerationProposalMessage(env, proposal, reason = "resolved") {
  if (!proposal?.notificationMessageId || proposal.notificationRetractedAt) return { ok: true, skipped: true };
  try {
    await callOneBotAction(env, { action: "delete_msg", params: { message_id: numericId(proposal.notificationMessageId) } }, 10000);
    proposal.notificationRetractedAt = Date.now();
    proposal.notificationRetractReason = reason;
    proposal.notificationRetractStatus = "success";
    return { ok: true };
  } catch (error) {
    proposal.notificationRetractStatus = "failed";
    proposal.notificationRetractError = String(error?.message || error);
    return { ok: false, error: proposal.notificationRetractError };
  }
}



async function attachModerationProposalMessage(env, proposalId, messageId, groupId) {
  if (!proposalId || !messageId) return;
  const proposal = await readJson(env, `moderation:proposal:${proposalId}`, null);
  if (!proposal || (groupId && String(proposal.groupId) !== String(groupId))) return;
  proposal.notificationMessageId = String(messageId);
  proposal.notificationSentAt = Date.now();
  if (proposal.status !== "pending" || Date.now() > Number(proposal.expiresAt || 0)) {
    if (proposal.status === "pending") proposal.status = "expired";
    await retractModerationProposalMessage(env, proposal, proposal.status || "expired");
  }
  await dbPut(env, `moderation:proposal:${proposal.id}`, JSON.stringify(proposal));
  if (proposal.status === "pending" && Number(proposal.expiresAt || 0) > Date.now()) {
    try {
      await getOneBotHub(env).fetch("https://onebot-hub/moderation/expiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalId: proposal.id, expiresAt: proposal.expiresAt })
      });
    } catch (error) {
      console.warn("schedule moderation expiry alarm failed", error);
    }
  }
}



async function handleModerationConfirmation(env, { groupId, actorId, actorRole, isDeveloper, hasGroupOpsPermission = false, confirmation }) {
  let id = String(confirmation.id || "").trim();
  if (!id) id = await findLatestPendingModerationProposalId(env, groupId);
  if (!id) return { handled: true, ok: false, message: "本群目前没有可处理的待确认操作。" };
  const proposal = await readJson(env, `moderation:proposal:${id}`, null);
  if (!proposal || String(proposal.groupId) !== String(groupId)) return { handled: true, ok: false, message: "找不到该待确认操作。" };
  if (proposal.status !== "pending") return { handled: true, ok: false, message: `该操作当前状态为 ${proposal.status}，不能重复处理。` };
  if (Date.now() > Number(proposal.expiresAt || 0)) {
    proposal.status = "expired";
    proposal.expiredAt = Date.now();
    await retractModerationProposalMessage(env, proposal, "expired");
    await dbPut(env, `moderation:proposal:${id}`, JSON.stringify(proposal));
    return { handled: true, ok: false, message: "该操作已超过 2 分钟确认期限，未执行；原提案提示已撤回。" };
  }
  const adminRoleChange = ["set_admin", "unset_admin"].includes(proposal.action);
  const botIsOwner = adminRoleChange ? await isBotVerifiedGroupOwner(env, groupId) : false;
  const nativeManagerOrAbove = isDeveloper || actorRole === "owner" || actorRole === "admin";
  if (!nativeManagerOrAbove) {
    return { handled: true, ok: false, message: "只有 QQ 管理员、群主或开发者可以处理该提案。" };
  }
  if (confirmation.type === "cancel") {
    proposal.status = "cancelled";
    proposal.cancelledAt = Date.now();
    proposal.cancelledBy = String(actorId);
    const retractResult = await retractModerationProposalMessage(env, proposal, "cancelled");
    await dbPut(env, `moderation:proposal:${id}`, JSON.stringify(proposal));
    await writeSystemAudit(env, {
      type: "moderation_cancelled",
      groupId,
      actorId,
      action: proposal.action,
      targetId: proposal.targetId,
      targetName: proposal.targetName,
      durationSeconds: proposal.durationSeconds,
      proposalId: id,
      result: "cancelled"
    });
    return { handled: true, ok: true, message: `已取消操作 ${id}，未执行任何群管理动作。${retractResult.ok || retractResult.skipped ? "\n原待确认提示已撤回。" : "\n原待确认提示撤回失败，请由管理员手动撤回。"}` };
  }
  if (adminRoleChange && (!botIsOwner || actorRole !== "owner")) {
    return { handled: true, ok: false, message: "新增或撤除真正 QQ 管理员只能由当前群主确认，且机器人账号必须是本群群主。" };
  }
  const result = await executeModerationProposal(env, proposal, { id: String(actorId), role: isDeveloper ? "developer" : actorRole });
  proposal.status = result.ok ? "executed" : "failed";
  proposal.executedAt = Date.now();
  proposal.executedBy = String(actorId);
  proposal.result = result.message;
  const retractResult = await retractModerationProposalMessage(env, proposal, result.ok ? "confirmed" : "confirmation_failed");
  await dbPut(env, `moderation:proposal:${id}`, JSON.stringify(proposal));
  await writeSystemAudit(env, {
    type: result.ok ? "moderation_confirmed" : "moderation_failed",
    groupId,
    actorId,
    action: proposal.action,
    targetId: proposal.targetId,
    targetName: proposal.targetName,
    durationSeconds: proposal.durationSeconds,
    proposalId: id,
    result: result.message
  });
  return { handled: true, ok: result.ok, message: `${result.message}\n操作编号：${id}${retractResult.ok || retractResult.skipped ? "\n原待确认提示已撤回。" : "\n原待确认提示撤回失败，请由管理员手动撤回。"}` };
}



async function detectNaturalModerationProposal(env, { groupId, actorId, actorName, actorRole, isDeveloper, text, targetMentionQqs, botId, messageId }) {
  if (!groupId || !(isDeveloper || ["owner", "admin"].includes(actorRole))) return null;
  const intent = await classifyNaturalModerationIntent(env, text);
  if (!intent || intent.action === "none" || Number(intent.confidence || 0) < 0.55) return null;
  if (["set_admin", "unset_admin"].includes(intent.action) && !(await isBotVerifiedGroupOwner(env, groupId))) {
    return { handled: true, message: "机器人账号当前不是本群群主，因此不会显示或建立真正 QQ 管理员任免操作。" };
  }
  let target = { ok: true, targetQq: "", targetName: "", member: null };
  if (moderationActionNeedsTarget(intent.action)) {
    target = await resolveModerationTarget(env, { groupId, targetMentionQqs, intent, botId });
    if (!target.ok) {
      if (target.reason === "ambiguous") {
        const choices = target.matches.map(m => `${m.card || m.nickname || m.name || "成员"}(QQ:${m.user_id || m.qq})`).join("、");
        return { handled: true, message: `目标昵称不唯一：${choices}。请直接 @ 要操作的成员后再说一次。` };
      }
      return { handled: true, message: "我识别到群管理意图，但无法确定目标。请直接 @ 对方后再说一次；未执行任何操作。" };
    }
  }
  const proposal = await createModerationProposal(env, {
    groupId,
    actorId,
    actorName,
    actorRole: isDeveloper ? "developer" : actorRole,
    action: intent.action,
    targetId: target.targetQq,
    targetName: target.targetName,
    targetRole: target.member?.role || "member",
    durationSeconds: intent.action === "mute" ? Math.max(60, Number(intent.durationSeconds || 600)) : 0,
    sourceText: text,
    classifierReason: intent.reason || "AI 识别管理意图",
    messageId
  });
  return { handled: true, proposal, message: formatModerationProposal(proposal) };
}



async function listModerationProposals(env, groupId, { limit = 100 } = {}) {
  const ids = await readJson(env, `moderation:proposal:index:${groupId}`, []);
  const items = [];
  for (const id of ids.slice(-Math.max(1, Math.min(500, Number(limit || 100)))).reverse()) {
    const proposal = await readJson(env, `moderation:proposal:${id}`, null);
    if (proposal) items.push(proposal);
  }
  return items;
}

export { addRuleStrike, detectExplicitRacialDiscrimination, detectRepeatedMessageBurst, isPoliticalModerationTopic, appendHumanCorrectionToRulePolicy, appendRuleViolationRecord, attachModerationProposalMessage, classifyNaturalModerationIntent, createGroupWorkRequest, createJoinRequestAssist, createModerationProposal, decideJoinRequestAssist, defaultRuleCategoryPolicies, defaultRuleProgressivePolicy, detectNaturalModerationProposal, executeGroupWorkRequest, executeModerationProposal, explicitPromotionLanguage, extractHtmlMetadata, extractOneBotMessageId, extractRuleReviewUrls, findLatestActiveRuleViolationForUser, findLatestPendingModerationProposalId, formatModerationPermissionDenied, formatModerationProposal, getGroupMemberSafe, getRuleCategoryPolicies, getRuleProgressivePolicy, handleGroupWorkDecision, handleModerationConfirmation, inspectMessageAgainstGroupRules, inspectUrlsForRuleReview, joinRequestPatternHash, listModerationProposals, localModerationIntent, matchRuleCategoryPolicy, moderationActionLabel, moderationActionNeedsTarget, moderationPermissionLevelLabel, normalizeProgressiveAction, normalizeProgressiveActionSpecs, normalizeRuleCategoryPolicies, normalizeRulePolicyActionSpec, normalizeRulePolicyActions, normalizeRulePolicyPunishment, normalizeRuleProgressivePolicy, normalizeRuleProxyMode, normalizeRuleSeverity, normalizeRuleStrictness, sanitizeLegacyRuleViolationRecord, selectRelevantRuleFeedbackExamples, stripLegacyHumanCorrectionLines, parseModerationConfirmation, parseUnlimitedNonNegativeInteger, performRuleAdditionalActions, performRuleProxyAction, progressiveMuteFallback, readJoinPattern, readRecentRuleFeedbackExamples, readResponseTextPrefix, readRuleMemeExamples, rememberRuleMemeExample, recordJoinPatternDecision, recordRuleViolationFeedback, removeRuleStrike, requestRuleManagerClarification, resolveAdaptiveRuleStrictness, resolveModerationTarget, findApplicantBranchMembership, resolveHeadJoinFamily, resolveRuleProgressiveStep, retractModerationProposalMessage, reverseRuleViolationAction, reviewGroupWorkWithGemma, reviewJoinRequestAssist, ruleBaseActionName, ruleContentNeedsWebVerification, ruleProxyCooldownRemaining, ruleStrictnessConfig, ruleStrictnessLabel, updateRuleViolationRecord, validateModerationProposalTarget, verifyRuleMemeContext, verifyRuleNewsContext };
