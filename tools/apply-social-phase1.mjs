import fs from 'node:fs';

function replaceOnce(source, search, replacement, label) {
  const first = source.indexOf(search);
  if (first < 0) throw new Error(`Missing patch anchor: ${label}`);
  if (source.indexOf(search, first + search.length) >= 0) throw new Error(`Patch anchor is not unique: ${label}`);
  return source.slice(0, first) + replacement + source.slice(first + search.length);
}

let worker = fs.readFileSync('worker.js', 'utf8');

worker = replaceOnce(
  worker,
  'import { injectPortalMembersClient } from "./src/portal/members.js";\n',
  'import { injectPortalMembersClient } from "./src/portal/members.js";\nimport { applySocialOutputPolicy, buildSocialDecision, buildSocialPromptBlock, capturePersonaContinuity, oneBotEventHasMedia, oneBotEventIsBareMention, observeSocialStyle, shouldSendSocialBufferNotice, socialInputDelayMs, waitForSocialTyping } from "./src/social/runtime.js";\n',
  'social runtime import'
);

worker = replaceOnce(
  worker,
  '      let privateAccessChecked = false;\n\n      // 先解析明确触发关系。非白名单群的普通聊天必须完全静默，不能见人就提示。',
  '      let privateAccessChecked = false;\n\n      // 只学习群体结构统计，不保存原句或复制单一群友的私人表达。\n      if (isGroup && !isSelfAccount && cleanMessage) {\n        ctx.waitUntil(observeSocialStyle(env, {\n          groupId: currentGroupId,\n          text: cleanMessage,\n          isCommand: isCommandMessage,\n          isRobot: false\n        }).catch(error => console.warn("social style observation failed", error?.message || error)));\n      }\n\n      // 先解析明确触发关系。非白名单群的普通聊天必须完全静默，不能见人就提示。',
  'social style observation'
);

const socialDecisionBlock = `      // 社交决策层只决定场景、行为和输出形态，不直接生成公开措辞。\n      const socialDirectTrigger = !aiReplyOptOut && (isAtMeOrAi || isPrivate);\n      const socialDecision = await buildSocialDecision(env, {\n        groupId: currentGroupId,\n        userId,\n        senderName: senderCard,\n        text: conversationText,\n        recentContext: groupConversationLogs.slice(-24).join("\\n"),\n        direct: socialDirectTrigger,\n        hasMedia: Boolean(imageUrl || imageFile || voiceUrl || voiceFile || videoUrl || videoFile || fileAttachments.length || forwardIds.length),\n        isPrivate\n      }).catch(error => ({\n        sceneType: "casual", outputType: "micro_chat", action: "reply", maxChars: 80, confidence: 0,\n        shouldReply: socialDirectTrigger, mayInterject: false, allowLowContextInterject: false,\n        reason: "social_layer_fallback", profile: null, relationship: null, managerMentionId: "",\n        error: String(error?.message || error).slice(0, 300)\n      }));\n      finalStylePrompt += "\\n\\n" + buildSocialPromptBlock({\n        decision: socialDecision,\n        profile: socialDecision.profile,\n        relationship: socialDecision.relationship,\n        direct: socialDirectTrigger\n      });\n\n`;
worker = replaceOnce(
  worker,
  '      // 第七段到此完美結束，準備進入第八段的 AI 隨機插話判定與上下文封裝模組...',
  socialDecisionBlock + '      // 第七段到此完美結束，準備進入第八段的 AI 隨機插話判定與上下文封裝模組...',
  'social decision insertion'
);

worker = replaceOnce(
  worker,
  '      let shouldReply = !aiReplyOptOut && (isAtMeOrAi || isPrivate);',
  '      let shouldReply = socialDirectTrigger;',
  'direct social trigger'
);

worker = replaceOnce(
  worker,
  '        } else if (lowContextFragment) {\n          noReplyReason = "low_context_fragment";',
  '        } else if (lowContextFragment && !socialDecision.allowLowContextInterject) {\n          noReplyReason = "low_context_fragment";',
  'low context social exception'
);

worker = replaceOnce(
  worker,
  '            const judgePrompt = `最近群聊：\\n${recentForJudge}\\n\\n候选插话触发句：${cleanMessage}\\n判断机器人此刻插话是否能明确接上正在讨论的话题。`;',
  '            const judgePrompt = `最近群聊：\\n${recentForJudge}\\n\\n候选插话触发句：${cleanMessage}\\n社交层判断：场景=${socialDecision.sceneType}，建议形态=${socialDecision.outputType}，建议动作=${socialDecision.action}。\\n判断此刻是否适合像真人群友一样接一句、问一句或做极短反应。`;',
  'interject judge prompt'
);

worker = replaceOnce(
  worker,
  '                 system: "你是严格的 QQ 群聊插话门控器。只有机器人能明确理解当前多人对话、知道自己要回应谁、且确实能增加价值时输出 REPLY。纯数字、短问号、单个词、只有群友之间才懂的暗号、私人对话、关系不明、可能认错人或只能尬聊时输出 SKIP。只能输出 REPLY 或 SKIP。DeepSeek 不得用于此判断。",',
  '                 system: "你是 QQ 粉丝群的插话门控器。机器人可以像普通群友一样接一句、问一句‘你们在说啥／哪个游戏／给我看看’，或做极短标点反应，不要求每次提供知识价值。但不能抢正在进行的两人私密对话、认错对象、重复别人、强行解释群梗或突然发长文。适合自然短插话输出 REPLY，否则输出 SKIP。只能输出 REPLY 或 SKIP。DeepSeek 不得用于此判断。",',
  'interject judge system'
);

worker = replaceOnce(
  worker,
  '      if (botMentioned && !isAutoInterject && !activeThinkingMessageId && body.__qqai_transport_thinking !== true) {',
  '      if (botMentioned && !isAutoInterject && !activeThinkingMessageId && body.__qqai_transport_thinking !== true && (!isGroup || await dbGet(env, `social_thinking_indicator_enabled:${currentGroupId}`) === "true")) {',
  'worker thinking indicator opt-in'
);

worker = replaceOnce(
  worker,
  '      }));\n      if (aiReplyPromisesFutureSearch(replyText)) {',
  '      }));\n      const explicitLongReply = /(?:详细|詳細|展开|展開|长文|長文|解释清楚|解釋清楚|完整说明|完整說明|仔细说|仔細說)/i.test(conversationText);\n      replyText = applySocialOutputPolicy({\n        text: replyText,\n        userText: conversationText,\n        decision: socialDecision,\n        profile: socialDecision.profile,\n        isGroup,\n        explicitLong: explicitLongReply\n      });\n      ctx.waitUntil(capturePersonaContinuity(env, {\n        groupId: currentGroupId,\n        userText: conversationText,\n        replyText\n      }).catch(error => console.warn("persona continuity capture failed", error?.message || error)));\n      if (aiReplyPromisesFutureSearch(replyText)) {',
  'social output policy'
);

worker = replaceOnce(
  worker,
  '      const generatedMentionIds = extractTextMentionIds(replyText);',
  '      const generatedMentionIds = [...new Set([...extractTextMentionIds(replyText), ...(socialDecision.managerMentionId ? [String(socialDecision.managerMentionId)] : [])])];',
  'social manager appeal mention'
);

worker = replaceOnce(
  worker,
  '      const aiDecision = await writeAiDecisionLog(env, {\n        ...aiDecisionBase,',
  '      const typingDelayMs = await waitForSocialTyping({\n        text: visibleReplyText,\n        decision: socialDecision,\n        isGroup,\n        direct: !isAutoInterject\n      });\n      if (request.signal?.aborted) {\n        await clearThinkingIndicator();\n        return new Response(null, { status: 204 });\n      }\n      const aiDecision = await writeAiDecisionLog(env, {\n        ...aiDecisionBase,',
  'social typing delay'
);

worker = replaceOnce(
  worker,
  '        lowContextFragment,\n        provider: usedProvider,',
  '        lowContextFragment,\n        socialSceneType: socialDecision.sceneType,\n        socialAction: socialDecision.action,\n        socialOutputType: socialDecision.outputType,\n        socialConfidence: Number(socialDecision.confidence || 0),\n        socialReason: String(socialDecision.reason || ""),\n        typingDelayMs,\n        provider: usedProvider,',
  'social decision audit fields'
);

worker = replaceOnce(
  worker,
  '    if (!groupId || !(await isGroupWhitelisted(this.env, groupId))) return "";\n    if (await dbGet(this.env, `ai_off:${groupId}`) === "true") return "";',
  '    if (!groupId || !(await isGroupWhitelisted(this.env, groupId))) return "";\n    if (await dbGet(this.env, `social_thinking_indicator_enabled:${groupId}`) !== "true") return "";\n    if (await dbGet(this.env, `ai_off:${groupId}`) === "true") return "";',
  'transport thinking indicator opt-in'
);

worker = replaceOnce(
  worker,
  '    const delay = Math.max(0, Math.min(DEFAULTS.inputDebounceMs, deadline - now));',
  '    const delay = Math.max(0, Math.min(socialInputDelayMs(entry.parts), deadline - now));',
  'social aggregation delay'
);

worker = replaceOnce(
  worker,
  '    this.inputBuffers.set(key, entry);\n    if (notify && !entry.notified && mergedParts.length >= 2) {',
  '    this.inputBuffers.set(key, entry);\n    const latestPart = mergedParts[mergedParts.length - 1];\n    const bufferNoticeEnabled = await shouldSendSocialBufferNotice(this.env, String(latestPart?.group_id || ""));\n    if (notify && bufferNoticeEnabled && !entry.notified && mergedParts.length >= 2) {',
  'silent input aggregation notice'
);

worker = replaceOnce(
  worker,
  '    const mentioned = eventHasBotMention(body);\n    const text = eventPlainText(body);\n    if (!mentioned || !text || /^(?:[!！]|\\/!)/.test(text)) return false;',
  '    const mentioned = eventHasBotMention(body);\n    const text = eventPlainText(body);\n    const hasPayload = Boolean(text || oneBotEventHasMedia(body) || oneBotEventIsBareMention(body));\n    if (!mentioned || !hasPayload || /^(?:[!！]|\\/!)/.test(text)) return false;',
  'bare mention input queue'
);

fs.writeFileSync('worker.js', worker);

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.version = '2.1.0';
if (!String(pkg.scripts?.check || '').includes('verify-social-digital-twin.mjs')) {
  pkg.scripts.check = String(pkg.scripts.check || '').trim() + ' && node verify-social-digital-twin.mjs';
}
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');

let config = fs.readFileSync('src/config/runtime.js', 'utf8');
config = replaceOnce(config, 'const VERSION = "2.0.5";', 'const VERSION = "2.1.0";', 'runtime version');
fs.writeFileSync('src/config/runtime.js', config);

fs.writeFileSync('release-notes.json', JSON.stringify({
  version: '2.1.0',
  notificationPolicy: 'latest-main-only-with-runtime-success-fallback',
  queueDelivery: 'mark-processed-after-success',
  added: [
    '脑与嘴分离的群聊社交决策层',
    '只 @ 后继续发送图片、文字或表情的静默消息聚合',
    '群体句长、标点、重复问号与括号动作的隐私化风格学习',
    '首次生成后持续一致的生日、年龄、性别、身高与体重人格资料',
    '玩笑互怼、真实攻击、卖惨、小道歉与严重道歉的关系状态',
    '按输出形态执行的自然打字延迟与群聊长度控制'
  ],
  fixed: [
    '只 @ 机器人后再发图片时，首条消息没有进入连续输入缓冲',
    '群聊默认公开发送正在思考和连续补充提示，显得过于机械',
    '玩笑互怼可能升级成人身攻击，或小事使用过度正式的 AI 式道歉',
    '个人资料在不同群友询问时可能产生互相矛盾的答案',
    '模型忽略群体短句、标点反应和括号动作习惯而持续输出长文'
  ]
}, null, 2) + '\n');

let deploymentVerify = fs.readFileSync('verify-deployment-notifications.mjs', 'utf8');
deploymentVerify = deploymentVerify.replaceAll('2.0.5', '2.1.0');
fs.writeFileSync('verify-deployment-notifications.mjs', deploymentVerify);

console.log('apply-social-phase1: patched');
