from pathlib import Path
import json
import re


def must_replace(text, old, new, label):
    if old not in text:
        raise RuntimeError(f"missing anchor: {label}")
    return text.replace(old, new, 1)


def must_regex(text, pattern, replacement, label, flags=re.S):
    next_text, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f"regex anchor mismatch ({count}): {label}")
    return next_text


# Scheduler conflict guard: management participation suppresses intervention; management stop enables one warning.
scheduler_path = Path('src/scheduler/runtime.js')
scheduler = scheduler_path.read_text()
scheduler = must_replace(
    scheduler,
    'import { getFeatureFlag, isGroupWhitelisted, numericId } from "../security/network.js";\n',
    'import { getFeatureFlag, isGroupWhitelisted, numericId } from "../security/network.js";\nimport { isManagementRole, looksLikeRoughBanter, managerExchangeContext, readRecentConversationRecords } from "../moderation/social-boundaries.js";\n',
    'scheduler social boundary import'
)
new_conflict = r'''async function processConflictSignal(env, { groupId, userId, senderName, senderRole = "member", text, botId, mentionedQqs = [], quotedSenderId = "", messageId = "" }) {
  const now = Date.now();
  const records = await readRecentConversationRecords(env, groupId, 20);
  const managerContext = managerExchangeContext(records, { userId, senderRole, text, mentionedQqs, quotedSenderId, now });
  const stateKey = `conflict:${groupId}`;
  const state = await readJson(env, stateKey, { warnedAt: 0, updatedAt: 0, participants: [], managerStoppedAt: 0, managerId: "", warnedAfterManagerStop: [] });

  if (managerContext.currentManagerStop) {
    const participants = [...new Set([
      ...(Array.isArray(state.participants) ? state.participants : []),
      ...records.filter(record => !isManagementRole(record.senderRole) && now - Number(record.createdAt || 0) <= 5 * 60 * 1000).map(record => String(record.userId || ""))
    ].filter(Boolean))];
    const next = {
      ...state,
      updatedAt: now,
      managerStoppedAt: now,
      managerId: String(userId || ""),
      managerStopMessageId: String(messageId || ""),
      participants,
      warnedAfterManagerStop: []
    };
    await dbPut(env, stateKey, JSON.stringify(next));
    await writeSystemAudit(env, {
      type: "conflict_manager_intervention",
      groupId,
      actorId: String(userId || ""),
      action: "stop_signal",
      messageId: String(messageId || ""),
      participants
    }).catch(() => {});
    return null;
  }

  // 管理层正在参与该段对话时，视为已有人工分寸判断；机器人不插手、不升级也不召集其他管理。
  if (managerContext.managerParticipating) {
    if (Number(state.updatedAt || 0)) await dbDel(env, stateKey).catch(() => {});
    return null;
  }

  const rough = looksLikeRoughBanter(text);
  const activeManagerStopAt = Math.max(Number(state.managerStoppedAt || 0), Number(managerContext.managerStopRecord?.createdAt || 0));
  const managerStopActive = activeManagerStopAt > 0 && now - activeManagerStopAt <= 8 * 60 * 1000;
  if (!rough && !managerStopActive && now - Number(state.updatedAt || 0) > 10 * 60 * 1000) {
    if (Number(state.updatedAt || 0)) await dbDel(env, stateKey).catch(() => {});
    return null;
  }

  let conflict = rough;
  let severity = rough ? 1 : 0;
  try {
    const context = records.slice(-14).map(record => `[${record.senderRole}:${record.senderName || record.userId}(QQ:${record.userId})] ${record.text}`).join("\n");
    const result = await callGoogleDecision(env, {
      system: "判断QQ群最近对话是否发生真实持续争吵或人身攻击。熟人玩笑互呛、短暂的‘神经／滚／笨蛋’、双方都在接话、或管理员正在参与时必须判 conflict=false。只输出JSON：{\"conflict\":true|false,\"severity\":0|1|2|3}。",
      prompt: context.slice(-5000),
      maxOutputTokens: 80
    });
    const obj = JSON.parse(result.text.match(/\{[\s\S]*\}/)?.[0] || "{}");
    conflict = Boolean(obj.conflict);
    severity = Math.max(0, Math.min(3, Number(obj.severity || 0)));
  } catch {}

  if (!conflict) {
    if (!managerStopActive && Number(state.updatedAt || 0)) await dbDel(env, stateKey).catch(() => {});
    return null;
  }

  const participants = [...new Set([...(Array.isArray(state.participants) ? state.participants : []), String(userId || "")].filter(Boolean))];
  if (managerStopActive) {
    const warned = new Set((Array.isArray(state.warnedAfterManagerStop) ? state.warnedAfterManagerStop : []).map(String));
    if (warned.has(String(userId || ""))) {
      await dbPut(env, stateKey, JSON.stringify({ ...state, updatedAt: now, participants }));
      return null;
    }
    warned.add(String(userId || ""));
    const next = {
      ...state,
      updatedAt: now,
      managerStoppedAt: activeManagerStopAt,
      managerId: String(state.managerId || managerContext.managerStopRecord?.userId || ""),
      participants,
      warnedAfterManagerStop: [...warned]
    };
    await dbPut(env, stateKey, JSON.stringify(next));
    await writeSystemAudit(env, {
      type: "conflict_warning_after_manager_stop",
      groupId,
      actorId: String(userId || ""),
      targetId: String(userId || ""),
      action: "warn",
      messageId: String(messageId || ""),
      severity,
      managerId: next.managerId,
      participants
    }).catch(() => {});
    return { replyText: "管理已经要求停止，请不要继续针对人或延续争吵。" };
  }

  // 没有管理介入时最多劝阻一次；继续争吵只记录状态，不再重复劝阻、@管理或私讯开发者。
  if (Number(state.warnedAt || 0) && now - Number(state.warnedAt || 0) <= 10 * 60 * 1000) {
    await dbPut(env, stateKey, JSON.stringify({ ...state, updatedAt: now, participants, lastSeverity: severity }));
    return null;
  }
  await dbPut(env, stateKey, JSON.stringify({ ...state, warnedAt: now, updatedAt: now, participants, lastSeverity: severity }));
  return { replyText: "先停一下，语气有点冲了。把事情说清楚就好，别继续针对人。" };
}'''
scheduler = must_regex(
    scheduler,
    r'async function processConflictSignal\(env, \{ groupId, userId, senderName, text, botId \}\) \{.*?\n\}\n\nexport \{',
    new_conflict + '\n\nexport {',
    'replace conflict signal'
)
scheduler_path.write_text(scheduler)


# Worker: pass live role and relationship context into both rule and conflict guards.
worker_path = Path('worker.js')
worker = worker_path.read_text()
worker = must_replace(
    worker,
    'ctx.waitUntil(inspectMessageAgainstGroupRules(env, { groupId: currentGroupId, userId, senderName: senderCard, text: cleanMessage || ((imageUrl || imageFile) ? "[图片]" : ""), messageId: replyMessageId, imageUrl, imageFile }));',
    'ctx.waitUntil(inspectMessageAgainstGroupRules(env, { groupId: currentGroupId, userId, senderName: senderCard, senderRole: isDeveloper ? "developer" : senderRole, text: cleanMessage || ((imageUrl || imageFile) ? "[图片]" : ""), messageId: replyMessageId, imageUrl, imageFile, mentionedQqs, quotedSenderId: String(quotedMessage?.senderId || "") }));',
    'automatic rule context'
)
worker = must_replace(
    worker,
    '          groupId: currentGroupId, userId, senderName: senderCard, text: cleanMessage, botId\n',
    '          groupId: currentGroupId, userId, senderName: senderCard, senderRole: isDeveloper ? "developer" : senderRole, text: cleanMessage, botId, mentionedQqs, quotedSenderId: String(quotedMessage?.senderId || ""), messageId: replyMessageId\n',
    'conflict context'
)
worker_path.write_text(worker)


# Moderation: manager-participated rough banter is exempt; flirting has an independent proportional boundary.
moderation_path = Path('src/moderation/runtime.js')
moderation = moderation_path.read_text()
moderation = must_replace(
    moderation,
    'import { canUnlockMute, clearMuteLock, createManualMuteLock, getMuteLock, putMuteLock } from "./mute-locks.js";\n',
    'import { canUnlockMute, clearMuteLock, createManualMuteLock, getMuteLock, putMuteLock } from "./mute-locks.js";\nimport { FLIRT_MUTE_MAX_SECONDS, clampFlirtMuteSeconds, isFlirtRefusalSignal, isManagementRole, looksLikeFlirtCandidate, looksLikeRoughBanter, managerExchangeContext, normalizeFlirtAction, readRecentConversationRecords } from "./social-boundaries.js";\n',
    'moderation social boundary import'
)
flirt_functions = r'''
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
'''
moderation = must_replace(
    moderation,
    'async function inspectMessageAgainstGroupRules(env, { groupId, userId, senderName, text, messageId, manualReport = null, imageUrl = null, imageFile = null }) {',
    flirt_functions + '\nasync function inspectMessageAgainstGroupRules(env, { groupId, userId, senderName, senderRole = "member", text, messageId, manualReport = null, imageUrl = null, imageFile = null, mentionedQqs = [], quotedSenderId = "" }) {',
    'insert flirt boundary functions and signature'
)
moderation = must_replace(
    moderation,
    '  if (!rules && !spamEvidence) return { status: "no_rules" };\n  if (content.length < 2 && !repeatedMessageBurst && !manual) return { status: "no_violation", review: { violation: false, confidence: 1, reason: "消息过短且无重复发送证据" } };\n\n  const recentLogRows = (await readJson(env, `recent_logs:${groupId}`, [])).slice(-30);\n  const recentContext = recentLogRows.slice(-18).join("\\n").slice(-5000);\n',
    '  if (content.length < 2 && !repeatedMessageBurst && !manual) return { status: "no_violation", review: { violation: false, confidence: 1, reason: "消息过短且无重复发送证据" } };\n\n  const recentLogRows = (await readJson(env, `recent_logs:${groupId}`, [])).slice(-30);\n  const recentContext = recentLogRows.slice(-18).join("\\n").slice(-5000);\n  const recentConversationRecords = await readRecentConversationRecords(env, groupId, 30);\n  const managerExchange = managerExchangeContext(recentConversationRecords, { userId, senderRole, text: content, mentionedQqs, quotedSenderId });\n  if (!manual && looksLikeRoughBanter(content) && (managerExchange.managerParticipating || managerExchange.managerStopActive)) {\n    await writeSystemAudit(env, { type: "rule_banter_manager_participation_skip", groupId, actorId: String(userId || ""), action: managerExchange.managerStopActive ? "handled_by_manager_stop" : "manager_participating", messageId: String(messageId || "") }).catch(() => {});\n    return { status: "no_violation", review: { violation: false, confidence: 1, reason: managerExchange.managerStopActive ? "管理已明确介入，后续由冲突守卫记录并警告，不重复执行群规处罚" : "管理层正在参与该段熟人互呛，视为已有人工分寸判断" } };\n  }\n  const flirtBoundary = await handleFlirtBoundary(env, { groupId, userId, senderName, senderRole, content, messageId, recentRecords: recentConversationRecords, canEnforce });\n  if (flirtBoundary) return flirtBoundary;\n  if (!rules && !spamEvidence) return { status: "no_rules" };\n',
    'insert social boundary prechecks'
)
moderation = must_replace(
    moderation,
    '18. memeVerification 是联网搜索、群内上下文和管理员历史纠错的综合核查。likelyMeme=true 且 disruptive=false 时优先不处罚；搜不到只能视为未知，不能直接判定“不是梗”。`,',
    '18. memeVerification 是联网搜索、群内上下文和管理员历史纠错的综合核查。likelyMeme=true 且 disruptive=false 时优先不处罚；搜不到只能视为未知，不能直接判定“不是梗”。\n19. 管理员、群主或开发者正在参与一段熟人互呛时，不得仅凭“滚、神经、笨蛋”等短词判违规；管理明确要求停止后仍继续的情况由独立冲突守卫记录并警告，避免重复处罚。\n20. 群内普通、双方自愿且不过度露骨的文字调情允许。只有明确拒绝后仍持续、公开内容明显露骨、强迫纠缠或持续影响正常聊天时才越界；独立调情边界最多禁言300秒。`,',
    'rule classifier social boundary instructions'
)
moderation_path.write_text(moderation)


# Version, release notes and permanent verification.
config_path = Path('src/config/runtime.js')
config = config_path.read_text().replace('const VERSION = "2.5.1";', 'const VERSION = "2.5.2";', 1)
config_path.write_text(config)

pkg_path = Path('package.json')
pkg = json.loads(pkg_path.read_text())
pkg['version'] = '2.5.2'
if 'verify-social-boundaries.mjs' not in pkg['scripts']['check']:
    pkg['scripts']['check'] += ' && node verify-social-boundaries.mjs'
pkg_path.write_text(json.dumps(pkg, ensure_ascii=False, indent=2) + '\n')

Path('release-notes.json').write_text(json.dumps({
    'version': '2.5.2',
    'notificationPolicy': 'portal-only-with-private-developer-failure-details',
    'added': [
        '群聊文字调情采用独立分级边界：警告、警告并撤回近期相关内容、警告撤回并禁言',
        '调情禁言硬上限为300秒；普通、双方自愿且不过度露骨的互动明确允许',
        '管理员明确制止冲突后，继续争吵者会被记录并收到一次警告'
    ],
    'fixed': [
        '熟人以“神经、滚、笨蛋”等短句互呛时不再仅凭词语判违规；管理层参与该段对话时机器人不介入',
        '冲突劝阻无效后不再重复提醒、自动@管理或私讯开发者；没有管理介入时最多劝阻一次',
        '群规分类与冲突守卫共享管理参与和管理制止语境，避免同一事件重复处罚'
    ]
}, ensure_ascii=False, indent=2) + '\n')

for verify_path in Path('.').glob('verify-*.mjs'):
    text = verify_path.read_text()
    text = text.replace("pkg.version === '2.5.1'", "pkg.version === '2.5.2'")
    text = text.replace('Package version must be 2.5.1', 'Package version must be 2.5.2')
    verify_path.write_text(text)

print('social boundary patch applied')
