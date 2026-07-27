import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function write(path, content) {
  fs.writeFileSync(path, content);
}

function replaceOnce(source, search, replacement, label) {
  const next = source.replace(search, replacement);
  if (next === source) throw new Error(`replacement failed: ${label}`);
  return next;
}

function replaceSection(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0 || end <= start) throw new Error(`section replacement failed: ${label}`);
  return source.slice(0, start) + replacement + source.slice(end);
}

let worker = read("worker.js");
worker = replaceOnce(
  worker,
  `      const conversationText = [directConversationText, forwardContext].filter(Boolean).join("\\n");\n      const explicitTimeQuestion = isExplicitCurrentTimeQuestion(conversationText);`,
  `      const conversationText = [directConversationText, forwardContext].filter(Boolean).join("\\n");\n      if (isPoliticalTopicText(conversationText)) {\n        ctx.waitUntil(writeAiDecisionLog(env, {\n          ...aiDecisionBase,\n          decision: "skipped",\n          reason: "political_topic_silence",\n          triggerType: botMentioned ? "mention" : repliedToBot ? "reply_to_ai" : sameQqSelfAsk ? "self_ask" : isPrivate ? "private" : "none",\n          generatedReply: ""\n        }).catch(() => {}));\n        return new Response(null, { status: 204 });\n      }\n      const explicitTimeQuestion = isExplicitCurrentTimeQuestion(conversationText);`,
  "worker political pre-generation gate"
);
worker = replaceOnce(
  worker,
  `      if (isGroup && !isCommandMessage && !isSelfAccount && body.__qqai_suppress_optional_ai !== true) {`,
  `      if (isGroup && !isCommandMessage && !isSelfAccount && body.__qqai_suppress_optional_ai !== true && !isPoliticalTopicText(cleanMessage)) {`,
  "worker political conflict bypass"
);
worker = replaceOnce(
  worker,
  `1. 政治红线（智能求生欲）：严格遵守中国大陆平台（QQ）的审查底线，防范真正的封号风险。\n- 【允许回答】：公开的国际地理、普通历史百科事实、外国元首名字等纯客观常识（例如问“法国现任总统是谁”、“大众汽车是哪国的”）。请用群友的口吻极简、客观地直接回答，绝对不要进行任何政治体制、意识形态的延伸讨论。\n- 【绝对禁止】：任何涉及中国本土当代政治、国家领导人、敏感历史事件、领土争议、时政热点新闻评论或任何带有主观立场的敏感话题。\n- 【静默机制】：遇到【绝对禁止】的政治敏感话题只输出 [SKIP]，不得警告、解释、拒绝或延伸讨论；Worker 会把 [SKIP] 静默丢弃。`,
  `1. 政治静默：现实政治、政党、选举、领导人、政府、公共政策、政治事件、外交、领土争议、意识形态或政治立场一律不回答、不评论、不劝阻、不延伸。若仍收到此类内容，只输出 [SKIP]；Worker 会静默丢弃。普通地理、非政治性的生活常识与作品虚构设定不属于此项。`,
  "worker political prompt"
);
const personaStart = `// 🌟 獲取群組全局人格 (Group Persona) 與 專屬人設`;
const personaEnd = `      finalStylePrompt += \`\n\n【命令前缀安全规则】`;
const personaReplacement = `// 🌟 获取群组全局人格（持续基底）与个人／模仿覆盖层\n      const mimicTargetQq = await dbGet(env, \`mimic_target:\${currentGroupId}\`);\n      const groupPersona = await dbGet(env, \`group_persona:\${currentGroupId}\`);\n      const userCustomStyle = await dbGet(env, \`custom_style:\${currentGroupId}:\${userId}\`);\n      const personaLayers = [];\n\n      // 群组人格是管理员保存的持续基底，不能因为启用模仿或个人风格而消失。\n      if (groupPersona) {\n        personaLayers.push(\`【群组全局人格｜持续基底】\n以下是当前群管理员明确保存的人格设定，必须在每次正常聊天中持续执行：\n\${String(groupPersona).slice(0, 12000)}\n\n【人格执行边界】\n- 人格负责称呼、语气、傲娇／温柔程度、动作描写、段落结构与互动氛围。\n- 安全规则、政治静默、事实准确、权限、群规处理、隐私与命令前缀规则永远更高。\n- 不得把人格中的威胁、暴力、歧视、强迫或违法台词当成现实行动；需要时改写成无伤害的戏剧化表达。\n- 系统最终会统一输出简体中文；人格中的繁体中文要求不得覆盖产品语言规范。\`);\n      }\n\n      // 模仿只叠加语言习惯，不替换管理员保存的核心人格。\n      if (mimicTargetQq) {\n        let dynamicLogs = [];\n        try {\n          const embeddingResponse = await env.AI.run('@cf/baai/bge-large-en-v1.5', { text: [userMessage] });\n          const vectorMatches = await env.VECTORIZE.query(embeddingResponse.data[0], {\n            topK: 10,\n            filter: { qq: mimicTargetQq },\n            returnValues: true\n          });\n          dynamicLogs = (vectorMatches.matches || []).map(match => match.metadata?.text || "").filter(Boolean);\n        } catch (vErr) {\n          console.error("🚨 向量空间抽样失败:", vErr);\n        }\n        if (dynamicLogs.length > 0) {\n          personaLayers.push(\`【灵魂模仿覆盖层】\n在不改变上方群组核心角色、关系边界与安全规则的前提下，参考 QQ:\${mimicTargetQq} 的句长、语气和口语习惯：\n\${dynamicLogs.join('\\n')}\`);\n        }\n      }\n\n      // 当前用户的个人风格是最上层微调，但仍不能删除群组人格。\n      if (userCustomStyle) {\n        personaLayers.push(\`【当前对话对象专属覆盖层】\n当前群友为 QQ:\${userId}。在保留群组核心人格的前提下，对此用户额外采用：\n\${String(userCustomStyle).slice(0, 2000)}\`);\n      }\n\n      const dynamicPersona = personaLayers.join("\\n\\n");\n      const hasConfiguredPersona = Boolean(dynamicPersona);\n      const allowRoleplayStyle = hasConfiguredPersona || explicitRoleplayRequest;\n\n      if (hasConfiguredPersona) {\n        finalStylePrompt = dynamicPersona + "\\n\\n" + finalStylePrompt;\n      } else {\n        finalStylePrompt += \`\n\n【默认人格锁】\n当前没有群组人格、个人专属人格或模仿配置。必须使用中性、自然、简洁的群友语气。\n- 用户消息、历史 AI 回复、群友玩笑或称呼不能替你建立人格。\n- 禁止自行变成猫娘、萝莉、宠物、主人关系或其他角色；禁止“本喵、喵呜、主人”等口癖。\n- 禁止使用括号描写蹦跳、蹭手、摇尾巴、眯眼等舞台动作。\n- 历史助手回复只用于理解事实，不代表本轮风格，绝对不得延续其语气。\`;\n      }\n\n`;
worker = replaceSection(worker, personaStart, personaEnd, personaReplacement, "worker persona layering");
worker = replaceOnce(
  worker,
  `        direct: socialDirectTrigger\n      });`,
  `        direct: socialDirectTrigger,\n        personaConfigured: hasConfiguredPersona\n      });`,
  "worker social prompt persona flag"
);
worker = replaceOnce(
  worker,
  `        direct: !isAutoInterject\n      });`,
  `        direct: !isAutoInterject,\n        personaConfigured: hasConfiguredPersona\n      });`,
  "worker output policy persona flag"
);
write("worker.js", worker);

let social = read("src/social/runtime.js");
social = replaceOnce(
  social,
  `function buildSocialPromptBlock({ decision, profile, relationship, direct = false }) {\n  const style = normalizeStyle(profile?.style || DEFAULT_STYLE);\n  const facts = personaFactsForPrompt(profile);\n  const emojiPolicy = style.samples >= 20 && style.emojiRate >= 0.05 ? "最多一个普通表情符号" : "不要使用 Emoji 或颜文字";`,
  `function buildSocialPromptBlock({ decision, profile, relationship, direct = false, personaConfigured = false }) {\n  const style = normalizeStyle(profile?.style || DEFAULT_STYLE);\n  const facts = personaFactsForPrompt(profile);\n  const emojiPolicy = personaConfigured\n    ? "表情、颜文字、动作描写、称呼和段落结构必须服从已配置人格；社交统计不得覆盖人格"\n    : style.samples >= 20 && style.emojiRate >= 0.05 ? "最多一个普通表情符号" : "不要使用 Emoji 或颜文字";`,
  "social prompt signature"
);
social = replaceOnce(
  social,
  `群体风格统计：平均约 \${Math.round(style.averageChars)} 字；重复问号比例 \${Math.round(style.repeatedQuestionRate * 100)}%；省略号比例 \${Math.round(style.ellipsisRate * 100)}%；括号动作比例 \${Math.round(style.actionTextRate * 100)}%。只模仿句长、标点、拆句和口语程度，不复制任何单一群友的秘密、攻击词或专属口癖。\n\${emojiPolicy}。禁止客服腔、教程腔、“作为 AI”、过量礼貌和机械总结。`,
  `群体风格统计：平均约 \${Math.round(style.averageChars)} 字；重复问号比例 \${Math.round(style.repeatedQuestionRate * 100)}%；省略号比例 \${Math.round(style.ellipsisRate * 100)}%；括号动作比例 \${Math.round(style.actionTextRate * 100)}%。\${personaConfigured ? "当前已配置人格，这些统计只能帮助判断聊天节奏，不能改变人格中的固定称呼、语气、动作描写、分段方式或禁用项。" : "只模仿句长、标点、拆句和口语程度，不复制任何单一群友的秘密、攻击词或专属口癖。"}\n\${emojiPolicy}。禁止客服腔、教程腔、“作为 AI”、过量礼貌和机械总结。`,
  "social persona precedence text"
);
social = replaceOnce(
  social,
  `function applySocialOutputPolicy({ text, userText = "", decision, profile, isGroup = true, explicitLong = false, direct = false }) {`,
  `function applySocialOutputPolicy({ text, userText = "", decision, profile, isGroup = true, explicitLong = false, direct = false, personaConfigured = false }) {`,
  "social output signature"
);
social = replaceOnce(
  social,
  `  const emojiMax = style.samples >= 20 && style.emojiRate >= 0.05 ? 1 : 0;\n  output = removeEmoji(output, emojiMax);\n  if (!(style.samples >= 20 && style.kaomojiRate >= 0.04)) output = removeKaomoji(output);`,
  `  if (!personaConfigured) {\n    const emojiMax = style.samples >= 20 && style.emojiRate >= 0.05 ? 1 : 0;\n    output = removeEmoji(output, emojiMax);\n    if (!(style.samples >= 20 && style.kaomojiRate >= 0.04)) output = removeKaomoji(output);\n  }`,
  "social output persona preservation"
);
write("src/social/runtime.js", social);

let auth = read("src/portal/auth.js");
auth = replaceOnce(
  auth,
  `{ key: "group_persona", label: "群组人格", command: "!切换人格 / !恢复人格", minRole: "admin", scope: "group", type: "textarea", defaultValue: "" }`,
  `{ key: "group_persona", label: "群组人格", command: "!切换人格 / !恢复人格", minRole: "admin", scope: "group", type: "textarea", maxLength: 12000, defaultValue: "" }`,
  "portal persona definition maxLength"
);
auth = replaceOnce(
  auth,
  `case "group_persona": return dbPut(env, \`group_persona:\${groupId}\`, String(value || "").slice(0, 4000));`,
  `case "group_persona": return dbPut(env, \`group_persona:\${groupId}\`, String(value || "").slice(0, 12000));`,
  "portal persona storage limit"
);
write("src/portal/auth.js", auth);

let moderation = read("src/moderation/runtime.js");
const moderationHelpers = `\nconst POLITICAL_MODERATION_PATTERN = /(?:政治|政党|政黨|选举|選舉|总统|總統|主席|国会|國會|立法院|立法委员|立法委員|立委|议员|議員|首相|总理|總理|内阁|內閣|政府|政权|政權|执政|執政|在野|政治人物|政治制度|公共政策|外交|制裁|领土争议|領土爭議|两岸|兩岸|统一|統一|台独|台獨|罢免|罷免|公投|意识形态|意識形態|民进党|民進黨|国民党|國民黨|共产党|共產黨|民主党|民主黨|共和党|共和黨|\\b(?:politics|political|election|government|parliament|congress|president|prime minister)\\b)/i;\nconst RACIAL_GROUP_PATTERN = /(?:黑人|白人|黄种人|黃種人|亚洲人|亞洲人|非洲人|印度人|犹太人|猶太人|阿拉伯人|拉丁裔|少数民族|少數民族|种族|種族|族群|民族)/i;\nconst RACIAL_ABUSE_PATTERN = /(?:最低贱|最低賤|低贱|低賤|低等|劣等|下等|不配做人|不是人|农具|農具|奴隶|奴隸|棉花种植园|棉花種植園|种族洁癖|種族潔癖|不歧视就完蛋|不歧視就完蛋|应该隔离|應該隔離|应该清除|應該清除|天生愚蠢|天生肮脏|天生骯髒|污染血统|污染血統|拒绝.*(?:黑人|白人|黄种人|黃種人|印度人)|远离.*(?:黑人|白人|黄种人|黃種人|印度人)|遠離.*(?:黑人|白人|黃種人|印度人)|接受不了.*(?:黑人|白人|黄种人|黃種人|印度人))/i;\nconst ANTI_RACISM_PATTERN = /(?:反对|反對|制止|停止|不要|不能|不该|不該|谴责|譴責|抵制|这是|這是|属于|屬於|算是|疑似|举报|舉報).{0,18}(?:种族歧视|種族歧視|种歧|種歧)|(?:种族歧视|種族歧視|种歧|種歧).{0,18}(?:不对|不對|错误|錯誤|过分|過分|违法|違法)/i;\n\nfunction isPoliticalModerationTopic(value) {\n  return POLITICAL_MODERATION_PATTERN.test(String(value || "").normalize("NFKC"));\n}\n\nfunction detectExplicitRacialDiscrimination(value, recentContext = "") {\n  const text = String(value || "").normalize("NFKC").trim();\n  const context = String(recentContext || "").normalize("NFKC");\n  if (!text || ANTI_RACISM_PATTERN.test(text)) return null;\n  const directGroup = RACIAL_GROUP_PATTERN.test(text);\n  const contextualGroup = directGroup || RACIAL_GROUP_PATTERN.test(context.slice(-2500));\n  const abusive = RACIAL_ABUSE_PATTERN.test(text);\n  const explicitIdeology = /(?:种族洁癖|種族潔癖|不歧视就完蛋|不歧視就完蛋)/i.test(text);\n  if (!(abusive && contextualGroup) && !explicitIdeology) return null;\n  return {\n    matched: true,\n    violationType: "种族歧视",\n    reason: "把某一种族或族群描述为低等、低贱、工具，或主张因族群身份排斥他人，属于种族歧视。请停止此类表达。",\n    confidence: directGroup || explicitIdeology ? 0.99 : 0.93\n  };\n}\n\nfunction isRacialDiscriminationReview(item, review) {\n  if (review?.forceWarning === true) return true;\n  const text = [item?.violationType, item?.rule, item?.reason, review?.violationType, review?.rule, review?.reason].map(value => String(value || "")).join(" ");\n  return /(?:种族歧视|種族歧視|族群歧视|族群歧視|racial discrimination|racism)/i.test(text);\n}\n`;
moderation = replaceOnce(
  moderation,
  `import { assertSafePublicUrl, fetchPublicUrl, numericId } from "../security/network.js";\n`,
  `import { assertSafePublicUrl, fetchPublicUrl, numericId } from "../security/network.js";\n${moderationHelpers}`,
  "moderation helper insertion"
);
moderation = replaceOnce(
  moderation,
  `  const content = String(text || "").trim();\n  if (!content) return { status: "error", error: "待检查消息为空" };\n  const activeRuleRecords = await opsActiveRuleRecords(env, groupId);`,
  `  const content = String(text || "").trim();\n  if (!content) return { status: "error", error: "待检查消息为空" };\n  if (isPoliticalModerationTopic(content)) {\n    await writeSystemAudit(env, { type: "rule_political_topic_skipped", groupId, actorId: String(userId || ""), action: "skip", messageId: String(messageId || "") }).catch(() => {});\n    return { status: "no_violation", review: { violation: false, confidence: 1, reason: "政治相关内容不由 AI 群规监控处理。", politicalTopicSkipped: true } };\n  }\n  const activeRuleRecords = await opsActiveRuleRecords(env, groupId);`,
  "moderation political early return"
);
moderation = replaceOnce(
  moderation,
  `  const recentContext = recentLogRows.slice(-18).join("\\n").slice(-5000);\n  const recentConversationRecords = await readRecentConversationRecords(env, groupId, 30);\n  const managerExchange = managerExchangeContext(recentConversationRecords, { userId, senderRole, text: content, mentionedQqs, quotedSenderId });\n  if (!manual && looksLikeRoughBanter(content) && (managerExchange.managerParticipating || managerExchange.managerStopActive)) {`,
  `  const recentContext = recentLogRows.slice(-18).join("\\n").slice(-5000);\n  const racialDiscrimination = detectExplicitRacialDiscrimination(content, recentContext);\n  const recentConversationRecords = await readRecentConversationRecords(env, groupId, 30);\n  const managerExchange = managerExchangeContext(recentConversationRecords, { userId, senderRole, text: content, mentionedQqs, quotedSenderId });\n  if (!manual && !racialDiscrimination && looksLikeRoughBanter(content) && (managerExchange.managerParticipating || managerExchange.managerStopActive)) {`,
  "moderation race before manager banter"
);
moderation = replaceOnce(moderation, `  if (!rules && !spamEvidence) return { status: "no_rules" };`, `  if (!rules && !spamEvidence && !racialDiscrimination) return { status: "no_rules" };`, "moderation race without group rules");
moderation = replaceOnce(
  moderation,
  `  let review;\n  if (deterministicSpamReview) {\n    review = deterministicSpamReview;\n  } else {`,
  `  const deterministicRacialReview = racialDiscrimination ? {\n    violation: true,\n    confidence: racialDiscrimination.confidence,\n    violationType: racialDiscrimination.violationType,\n    rule: "禁止种族歧视、族群贬损与去人化表达",\n    reason: racialDiscrimination.reason,\n    severity: "moderate",\n    intentional: true,\n    action: "warn",\n    muteSeconds: 0,\n    testContext: false,\n    linkAssessment: "无链接",\n    deterministic: true,\n    forceWarning: true\n  } : null;\n  let review;\n  if (deterministicRacialReview) {\n    review = deterministicRacialReview;\n  } else if (deterministicSpamReview) {\n    review = deterministicSpamReview;\n  } else {`,
  "moderation deterministic race review"
);
moderation = replaceOnce(moderation, `"linkAssessment":"无链接或简短判断"}`, `"linkAssessment":"无链接或简短判断","forceWarning":true|false}`, "moderation classifier schema");
moderation = replaceOnce(
  moderation,
  `5. “建政/涉政”必须是对现实国家政治制度、领导人、公共政策、政治事件的实质讨论、宣传、攻击、批评或动员。游戏、军事梗、影视台词、虚构阵营、普通玩笑和比喻不得单独判为建政。`,
  `5. 现实政治、政党、选举、领导人、政府、公共政策、政治事件、外交、领土争议与意识形态内容必须 violation=false；AI 群规监控不得评论、记录为违规或处罚政治内容。游戏、影视与虚构阵营只有在明确映射现实政治时才按此静默略过。`,
  "moderation political classifier rule"
);
moderation = replaceOnce(
  moderation,
  `20. 群内普通、双方自愿且不过度露骨的文字调情允许。只有明确拒绝后仍持续、公开内容明显露骨、强迫纠缠或持续影响正常聊天时才越界；独立调情边界最多禁言300秒。`,
  `20. 群内普通、双方自愿且不过度露骨的文字调情允许。只有明确拒绝后仍持续、公开内容明显露骨、强迫纠缠或持续影响正常聊天时才越界；独立调情边界最多禁言300秒。\n21. 明确宣称某一种族／族群天生低等、低贱、不是人或只配当工具，使用奴隶／农具／棉花种植园等语境去人化特定族群，或主张必须歧视、隔离、排斥某族群，必须判为“种族歧视”，action=warn，forceWarning=true。此类项目固定公开警告，不建议撤回、禁言或踢出；反对、引用并批评种族歧视不得误判。`,
  "moderation race classifier rule"
);
moderation = replaceOnce(
  moderation,
  `  const severity = normalizeRuleSeverity(review?.severity || item.severity || "moderate");\n  const intentional = review?.intentional !== false;\n  item = await updateRuleViolationRecord(env, item, { policyAction: policy.punishment, policyActions: policy.actions, policyNote: policy.note, severity, intentional, proxyMode: mode });\n  if (mode === "record") return updateRuleViolationRecord(env, item, { actionTaken: "record_only", actionResult: "仅记录，未启用警告或处罚代理", strikeCounted: false, progressiveCount: 0 });`,
  `  const severity = normalizeRuleSeverity(review?.severity || item.severity || "moderate");\n  const intentional = review?.intentional !== false;\n  const warningOnlyRacial = isRacialDiscriminationReview(item, review);\n  item = await updateRuleViolationRecord(env, item, { policyAction: warningOnlyRacial ? "warn" : policy.punishment, policyActions: warningOnlyRacial ? [] : policy.actions, policyNote: warningOnlyRacial ? "种族歧视固定公开警告，不自动撤回、禁言、踢出或累计处罚" : policy.note, severity, intentional, proxyMode: mode, warningOnlyRacial });\n  if (mode === "record" && !warningOnlyRacial) return updateRuleViolationRecord(env, item, { actionTaken: "record_only", actionResult: "仅记录，未启用警告或处罚代理", strikeCounted: false, progressiveCount: 0 });`,
  "moderation warning-only setup"
);
moderation = replaceOnce(moderation, `  const eligibleForStrike = severity !== "minor" && intentional;`, `  const eligibleForStrike = !warningOnlyRacial && severity !== "minor" && intentional;`, "moderation race no strike");
moderation = replaceOnce(
  moderation,
  `  const explicitRecallPolicy = normalizeRulePolicyPunishment(policy.punishment) === "recall";\n  if (mode === "warn") {`,
  `  const explicitRecallPolicy = !warningOnlyRacial && normalizeRulePolicyPunishment(policy.punishment) === "recall";\n  if (warningOnlyRacial) {\n    action = "warn";\n    fallbackNote = "种族歧视固定采用公开警告；本次不自动撤回、禁言、踢出或计入累进处罚";\n  } else if (mode === "warn") {`,
  "moderation race force warn branch"
);
moderation = replaceOnce(
  moderation,
  `  const additionalSpecs = [\n    ...progressiveStepActions,\n    ...(policy.actions || []).slice(1)\n  ];`,
  `  const additionalSpecs = warningOnlyRacial ? [] : [\n    ...progressiveStepActions,\n    ...(policy.actions || []).slice(1)\n  ];`,
  "moderation race no additional actions"
);
moderation = replaceOnce(moderation, `export { addRuleStrike, detectRepeatedMessageBurst,`, `export { addRuleStrike, detectExplicitRacialDiscrimination, detectRepeatedMessageBurst, isPoliticalModerationTopic,`, "moderation helper exports");
write("src/moderation/runtime.js", moderation);

let config = read("src/config/runtime.js");
config = replaceOnce(config, `const VERSION = "2.7.9";`, `const VERSION = "2.7.10";`, "runtime version");
config = replaceOnce(config, `const BUILD_DATE = "2026-07-27";`, `const BUILD_DATE = "2026-07-28";`, "runtime build date");
write("src/config/runtime.js", config);

const pkg = JSON.parse(read("package.json"));
pkg.version = "2.7.10";
if (!pkg.scripts.check.includes("verify-politics-racism-persona.mjs")) pkg.scripts.check += " && node verify-politics-racism-persona.mjs";
write("package.json", JSON.stringify(pkg, null, 2) + "\n");
write("release-notes.json", JSON.stringify({
  version: "2.7.10",
  notificationPolicy: "developer-only-by-default-with-explicit-opt-in",
  added: [
    "新增聊天与群规监控的确定性政治静默规则，政治内容不调用聊天回答或群规处罚模型",
    "新增种族歧视确定性识别与固定公开警告，禁止自动撤回、禁言、踢出和累进处罚",
    "新增群组人格持续基底与个人／模仿覆盖层，可保留最长一万二千字符"
  ],
  fixed: [
    "修复群规分类器仍会处理建政／涉政内容的问题",
    "修复管理员参与聊天时明确种族歧视可能被熟人互呛豁免的问题",
    "修复群组人格被个人风格、灵魂模仿或后置社交统计覆盖的问题",
    "修复较长群组人格在四千字符处被截断而无法完整生效的问题"
  ]
}, null, 2) + "\n");
for (const name of fs.readdirSync(".").filter(name => /^verify-.*\.mjs$/.test(name))) {
  let source = read(name);
  if (source.includes("2.7.9")) {
    source = source.replaceAll("2.7.9", "2.7.10");
    write(name, source);
  }
}
write("verify-politics-racism-persona.mjs", `import assert from "node:assert/strict";\nimport fs from "node:fs";\nimport { detectExplicitRacialDiscrimination, isPoliticalModerationTopic } from "./src/moderation/runtime.js";\nimport { buildSocialPromptBlock } from "./src/social/runtime.js";\n\nassert.equal(isPoliticalModerationTopic("总统选举与公共政策应该怎么评价"), true);\nassert.equal(isPoliticalModerationTopic("民进党和国民党正在讨论什么"), true);\nassert.equal(isPoliticalModerationTopic("法国在哪里"), false);\nassert.equal(Boolean(detectExplicitRacialDiscrimination("黑人是最低贱的")), true);\nassert.equal(Boolean(detectExplicitRacialDiscrimination("不歧视就完蛋了", "上一句正在谈论黑人和白人")), true);\nassert.equal(Boolean(detectExplicitRacialDiscrimination("棉花种植园", "刚才有人把黑人说成农具")), true);\nassert.equal(Boolean(detectExplicitRacialDiscrimination("我最接受不了黑人印度人")), true);\nassert.equal(detectExplicitRacialDiscrimination("反对种族歧视，别再说黑人低等"), null);\n\nconst worker = fs.readFileSync("worker.js", "utf8");\nconst moderation = fs.readFileSync("src/moderation/runtime.js", "utf8");\nconst auth = fs.readFileSync("src/portal/auth.js", "utf8");\nconst social = fs.readFileSync("src/social/runtime.js", "utf8");\nassert.match(worker, /if \\(isPoliticalTopicText\\(conversationText\\)\\)/);\nassert.match(worker, /political_topic_silence/);\nassert.match(worker, /!isPoliticalTopicText\\(cleanMessage\\)/);\nassert.match(moderation, /politicalTopicSkipped: true/);\nassert.match(moderation, /warningOnlyRacial/);\nassert.match(moderation, /additionalSpecs = warningOnlyRacial \\? \\[\\]/);\nassert.match(moderation, /forceWarning: true/);\nassert.match(worker, /群组全局人格｜持续基底/);\nassert.match(worker, /personaLayers\\.push/);\nassert.match(worker, /personaConfigured: hasConfiguredPersona/);\nassert.match(auth, /group_persona[^\\n]+maxLength: 12000/);\nassert.match(auth, /group_persona:\\$\\{groupId\\}[^\\n]+slice\\(0, 12000\\)/);\nassert.match(social, /社交统计不得覆盖人格/);\nconst prompt = buildSocialPromptBlock({\n  decision: { sceneType: "casual", action: "reply", outputType: "normal_chat", maxChars: 80, confidence: 1 },\n  profile: { style: { samples: 100, averageChars: 8, emojiRate: 1, kaomojiRate: 1 } },\n  relationship: null,\n  direct: true,\n  personaConfigured: true\n});\nassert.match(prompt, /不能改变人格中的固定称呼、语气、动作描写、分段方式或禁用项/);\nassert.match(prompt, /表情、颜文字、动作描写、称呼和段落结构必须服从已配置人格/);\nconsole.log("verify-politics-racism-persona: ok");\n`);
for (const [path, pattern] of [
  ["worker.js", /political_topic_silence/],
  ["src/moderation/runtime.js", /warningOnlyRacial/],
  ["src/social/runtime.js", /personaConfigured/],
  ["src/portal/auth.js", /slice\(0, 12000\)/],
  ["package.json", /verify-politics-racism-persona\.mjs/]
]) {
  if (!pattern.test(read(path))) throw new Error(`post-patch invariant failed: ${path}`);
}
console.log("apply-v2.7.10: patch complete");
