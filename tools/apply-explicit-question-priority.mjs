import fs from 'node:fs';

function replaceOnce(source, search, replacement, label) {
  const first = source.indexOf(search);
  if (first < 0) throw new Error(`Missing patch anchor: ${label}`);
  if (source.indexOf(search, first + search.length) >= 0) throw new Error(`Patch anchor is not unique: ${label}`);
  return source.slice(0, first) + replacement + source.slice(first + search.length);
}

let social = fs.readFileSync('src/social/runtime.js', 'utf8');
social = replaceOnce(
  social,
  'function eventVisibleText(body) {',
  `function oneBotBotMentionCount(body) {
  const selfId = String(body?.self_id || "");
  if (!selfId || body?.message_type !== "group") return 0;
  if (Array.isArray(body?.message)) {
    return body.message.filter(part => String(part?.type || "").toLowerCase() === "at" && String(part?.data?.qq ?? part?.data?.user_id ?? "") === selfId).length;
  }
  const raw = String(body?.raw_message || (typeof body?.message === "string" ? body.message : ""));
  let count = 0;
  for (const match of raw.matchAll(/\\[CQ:at,[^\\]]*qq=([^,\\]]+)/gi)) if (String(match[1] || "") === selfId) count += 1;
  return count;
}

function eventVisibleText(body) {`,
  'bot mention counter'
);
social = replaceOnce(
  social,
  `function oneBotEventIsBareMention(body) {
  const selfId = String(body?.self_id || "");
  if (!selfId || body?.message_type !== "group" || !eventMentionIds(body).includes(selfId)) return false;
  return !eventVisibleText(body) && !oneBotEventHasMedia(body);
}

function socialInputDelayMs(parts) {
  const list = Array.isArray(parts) ? parts.filter(Boolean) : [];
  if (!list.length) return 1200;
  const latest = list[list.length - 1];
  if (oneBotEventIsBareMention(latest)) return 3400;
  if (oneBotEventHasMedia(latest)) return list.length > 1 ? 1500 : 2200;
  if (list.length > 1) return 1100;
  return 1300;
}`,
  `function oneBotEventIsPunctuationOnly(body) {
  const text = eventVisibleText(body).replace(/[\\s\\u00A0\\u200B-\\u200D\\u2060\\u3000\\uFEFF]+/g, "");
  return /^[.。…?？!！~～]{1,8}$/.test(text);
}

function oneBotEventIsBareMention(body) {
  const selfId = String(body?.self_id || "");
  if (!selfId || body?.message_type !== "group" || oneBotBotMentionCount(body) !== 1 || !eventMentionIds(body).includes(selfId)) return false;
  return !eventVisibleText(body) && !oneBotEventHasMedia(body);
}

function socialInputDelayMs(parts) {
  const list = Array.isArray(parts) ? parts.filter(Boolean) : [];
  if (!list.length) return 900;
  const latest = list[list.length - 1];
  if (oneBotEventIsBareMention(latest)) return 3400;
  if (oneBotEventHasMedia(latest)) return list.length > 1 ? 900 : 1500;
  if (oneBotEventIsPunctuationOnly(latest)) return list.length > 1 ? 900 : 1500;
  if (oneBotBotMentionCount(latest) === 1 && eventVisibleText(latest)) return 450;
  if (list.length > 1) return 650;
  return 900;
}`,
  'bare mention and priority delay'
);
social = replaceOnce(
  social,
  '  oneBotEventHasMedia,\n  oneBotEventIsBareMention,',
  '  oneBotBotMentionCount,\n  oneBotEventHasMedia,\n  oneBotEventIsBareMention,\n  oneBotEventIsPunctuationOnly,',
  'social exports'
);
fs.writeFileSync('src/social/runtime.js', social);

let worker = fs.readFileSync('worker.js', 'utf8');
worker = replaceOnce(
  worker,
  'import { applySocialOutputPolicy, buildSocialDecision, buildSocialPromptBlock, capturePersonaContinuity, oneBotEventHasMedia, oneBotEventIsBareMention, observeSocialStyle, shouldSendSocialBufferNotice, socialInputDelayMs, waitForSocialTyping } from "./src/social/runtime.js";',
  'import { applySocialOutputPolicy, buildSocialDecision, buildSocialPromptBlock, capturePersonaContinuity, oneBotBotMentionCount, oneBotEventHasMedia, oneBotEventIsBareMention, oneBotEventIsPunctuationOnly, observeSocialStyle, shouldSendSocialBufferNotice, socialInputDelayMs, waitForSocialTyping } from "./src/social/runtime.js";',
  'worker social import'
);
worker = replaceOnce(
  worker,
  '      const botMentioned = Boolean(botId && mentionedQqs.includes(botId));\n      const repliedToBot = Boolean(quotedMessage && quotedMessage.source === \'ai\');',
  `      const botMentioned = Boolean(botId && mentionedQqs.includes(botId));
      const duplicateMentionNoise = isGroup && botMentioned && oneBotBotMentionCount(body) > 1 && (!eventPlainText(body).trim() || oneBotEventIsPunctuationOnly(body));
      if (duplicateMentionNoise) {
        ctx.waitUntil(writeAiDecisionLog(env, {
          groupId: currentGroupId, userId, senderName: senderCard, sourceMessageId: replyMessageId,
          input: cleanMessage, mentionedQqs, botMentioned: true, isGroup: true,
          decision: "skipped", reason: "duplicate_mention_noise", triggerType: "mention"
        }));
        return new Response(null, { status: 204 });
      }
      const repliedToBot = Boolean(quotedMessage && quotedMessage.source === 'ai');`,
  'worker duplicate mention guard'
);
worker = replaceOnce(
  worker,
  '      const hasAnyMediaAttachment = Boolean(imageUrl || imageFile || voiceUrl || voiceFile || videoUrl || videoFile || fileAttachments.length || forwardIds.length);',
  '      const hasAnyMediaAttachment = Boolean(imageUrl || imageFile || voiceUrl || voiceFile || videoUrl || videoFile || fileAttachments.length || forwardIds.length || oneBotEventHasMedia(body));',
  'worker face media recognition'
);
worker = replaceOnce(
  worker,
  '      const socialDirectTrigger = !aiReplyOptOut && (isAtMeOrAi || isPrivate);',
  '      const socialDirectTrigger = !aiReplyOptOut && (isAtMeOrAi || isPrivate || body.__qqai_explicit_question === true || body.__qqai_force_explicit_reply === true);',
  'forced explicit trigger'
);
worker = replaceOnce(
  worker,
  '    const answerNowKey = this.answerNowKey(body);',
  `    if (body.post_type === "message" && body.message_type === "group" && eventHasBotMention(body) && oneBotBotMentionCount(body) > 1 && (!eventPlainText(body).trim() || oneBotEventIsPunctuationOnly(body))) {
      await this.recordIngress(body, "duplicate_mention_noise", { explicit: false, force: true, botMentionCount: oneBotBotMentionCount(body) }).catch(() => {});
      return;
    }

    const answerNowKey = this.answerNowKey(body);`,
  'durable duplicate mention guard'
);
worker = replaceOnce(
  worker,
  '  async sendImmediateThinkingIndicator(body) {',
  '  async sendImmediateThinkingIndicator(body, options = {}) {',
  'thinking indicator signature'
);
worker = replaceOnce(
  worker,
  '    if (!groupId || !(await isGroupWhitelisted(this.env, groupId))) return "";\n    if (await dbGet(this.env, `social_thinking_indicator_enabled:${groupId}`) !== "true") return "";\n    if (await dbGet(this.env, `ai_off:${groupId}`) === "true") return "";',
  '    if (!groupId || !(await isGroupWhitelisted(this.env, groupId))) return "";\n    const indicatorSetting = await dbGet(this.env, `social_thinking_indicator_enabled:${groupId}`);\n    if (indicatorSetting === "false" || (!options.allowDefault && indicatorSetting !== "true")) return "";\n    if (oneBotEventIsPunctuationOnly(body)) return "";\n    if (await dbGet(this.env, `ai_off:${groupId}`) === "true") return "";',
  'delayed thinking default'
);
worker = replaceOnce(
  worker,
  '    if (!eventHasBotMention(body)) return;\n    const key = `${this.explicitReplyQuestionId(body)}:${String(disposition || "unknown")}`;',
  '    if (!eventHasBotMention(body) && body?.__qqai_explicit_question !== true) return;\n    const key = `${this.explicitReplyQuestionId(body)}:${String(disposition || "unknown")}`;',
  'explicit failure marker'
);
worker = replaceOnce(
  worker,
  '    const explicit = Boolean(extra.explicit || eventHasBotMention(body) || /^[!！]/.test(eventPlainText(body)));',
  '    const explicit = Boolean(extra.explicit || body?.__qqai_explicit_question === true || eventHasBotMention(body) || /^[!！]/.test(eventPlainText(body)));',
  'record ingress explicit marker'
);
worker = replaceOnce(
  worker,
  '    try {\n      immediateThinkingMessageId = await this.sendImmediateThinkingIndicator(body);\n    } catch (error) {\n      console.error("immediate thinking indicator failed", error);\n    }\n\n    const controller = new AbortController();',
  '    const controller = new AbortController();',
  'remove immediate thinking'
);
worker = replaceOnce(
  worker,
  '    this.userInFlight.set(key, active);\n    await this.persistQuestionInFlight(key, active);\n    await this.recordIngress(body, "processing", { explicit: true, fromQueue }).catch(() => {});\n    try {\n      const processingBody = immediateThinkingMessageId\n        ? { ...body, __qqai_transport_thinking: true }\n        : body;\n      await this.processInboundEvent(fromQueue ? { ...processingBody, __qqai_queued: true } : processingBody, requestUrl, { signal: controller.signal, key, token });',
  `    this.userInFlight.set(key, active);
    await this.persistQuestionInFlight(key, active);
    await this.recordIngress(body, "processing", { explicit: true, fromQueue }).catch(() => {});
    let processingFinished = false;
    const semanticQuestion = !oneBotEventIsPunctuationOnly(body);
    if (body?.message_type === "group" && semanticQuestion) {
      this.trackEventTask((async () => {
        await new Promise(resolve => setTimeout(resolve, 1800));
        if (processingFinished || controller.signal.aborted || this.userInFlight.get(key)?.token !== token) return;
        const indicatorId = await this.sendImmediateThinkingIndicator(body, { allowDefault: true }).catch(() => "");
        if (!indicatorId) return;
        if (processingFinished || controller.signal.aborted || this.userInFlight.get(key)?.token !== token) {
          await this.retractThinkingIndicator(body, indicatorId).catch(() => {});
          return;
        }
        immediateThinkingMessageId = indicatorId;
      })().catch(error => console.error("delayed thinking indicator failed", error)));
    }
    try {
      const processingBody = {
        ...body,
        __qqai_transport_thinking: true,
        __qqai_explicit_question: true,
        __qqai_semantic_question: semanticQuestion,
        ...(fromQueue ? { __qqai_queued: true } : {})
      };
      await this.processInboundEvent(processingBody, requestUrl, { signal: controller.signal, key, token });`,
  'delayed thinking and explicit markers'
);
worker = replaceOnce(
  worker,
  '    } catch (error) {\n      if (!controller.signal.aborted) {\n        console.error("user question failed", error);\n        if (fromQueue) await this.sendQueueNotice(body, "排队的问题处理失败，已跳到下一条。请稍后重试。").catch(() => {});\n      }\n    } finally {',
  '    } catch (error) {\n      if (!controller.signal.aborted) {\n        console.error("user question failed", error);\n        await this.notifyExplicitReplyFailureOnce({ ...body, __qqai_explicit_question: true }, "uncaught_error", { error: String(error?.message || error).slice(0, 300) }).catch(() => {});\n        if (fromQueue) await this.sendQueueNotice(body, "排队的问题处理失败，已跳到下一条。请稍后重试。").catch(() => {});\n      }\n    } finally {\n      processingFinished = true;',
  'runQuestion failure notice'
);
worker = replaceOnce(
  worker,
  '    const mentioned = eventHasBotMention(body);\n    const text = eventPlainText(body);\n    const hasPayload = Boolean(text || oneBotEventHasMedia(body) || oneBotEventIsBareMention(body));\n    if (!mentioned || !hasPayload || /^(?:[!！]|\\/!)/.test(text)) return false;',
  '    const mentioned = eventHasBotMention(body);\n    const text = eventPlainText(body);\n    const hasPayload = Boolean(text || oneBotEventHasMedia(body) || oneBotEventIsBareMention(body));\n    if (oneBotBotMentionCount(body) > 1 && (!text || oneBotEventIsPunctuationOnly(body))) return false;\n    if (!mentioned || !hasPayload || /^(?:[!！]|\\/!)/.test(text)) return false;',
  'queue duplicate mention guard'
);
worker = replaceOnce(
  worker,
  '    if (!eventHasBotMention(body)) return false;\n    const text = eventPlainText(body).trim();',
  '    if (!eventHasBotMention(body) && body?.__qqai_explicit_question !== true) return false;\n    const text = eventPlainText(body).trim();',
  'safe retry explicit marker'
);
worker = replaceOnce(
  worker,
  '      const internalStartedAt = Date.now();',
  '      const internalStartedAt = Date.now();\n      const explicitQuestion = body?.__qqai_explicit_question === true || eventHasBotMention(body);\n      const semanticQuestion = body?.__qqai_semantic_question !== false && !oneBotEventIsPunctuationOnly(body);',
  'process explicit state'
);
worker = replaceOnce(
  worker,
  `      if (internalResponse.status === 204) {
        await this.recordIngress(body, "worker_skipped", { explicit: false, force: true, httpStatus: 204, retryAttempted, internalTransportMode: "direct_loopback" }).catch(() => {});
        return;
      }`,
  `      if (internalResponse.status === 204 && explicitQuestion && semanticQuestion && !options.signal?.aborted && body?.__qqai_force_explicit_reply !== true) {
        retryAttempted = true;
        firstFailure = { type: "explicit_204", httpStatus: 204, elapsedMs: Date.now() - internalStartedAt };
        await this.recordIngress(body, "worker_explicit_retry", { explicit: true, force: true, retryAttempted: true, firstFailure }).catch(() => {});
        const remainingMs = Math.max(5000, internalTimeoutMs - (Date.now() - internalStartedAt));
        try {
          internalResponse = await internalFetch({ ...body, __qqai_force_explicit_reply: true, __qqai_internal_retry: 1 }, remainingMs);
          internalRaw = "";
        } catch (retryError) {
          await this.recordIngress(body, /abort|timeout/i.test(String(retryError?.message || retryError)) ? "worker_timeout" : "worker_error", {
            explicit: true, force: true, error: String(retryError?.message || retryError).slice(0, 300), retryAttempted: true, firstFailure
          }).catch(() => {});
          return;
        }
      }
      if (internalResponse.status === 204) {
        if (explicitQuestion && semanticQuestion) {
          await this.recordIngress(body, "worker_no_reply", { explicit: true, force: true, httpStatus: 204, retryAttempted, firstFailure, internalTransportMode: "direct_loopback" }).catch(() => {});
        } else {
          await this.recordIngress(body, "worker_skipped", { explicit: false, force: true, httpStatus: 204, retryAttempted, internalTransportMode: "direct_loopback" }).catch(() => {});
        }
        return;
      }`,
  'explicit 204 retry'
);
fs.writeFileSync('worker.js', worker);

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.version = '2.1.1';
if (!String(pkg.scripts?.check || '').includes('verify-explicit-question-priority.mjs')) pkg.scripts.check += ' && node verify-explicit-question-priority.mjs';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');

let config = fs.readFileSync('src/config/runtime.js', 'utf8');
config = replaceOnce(config, 'const VERSION = "2.1.0";', 'const VERSION = "2.1.1";', 'runtime version');
fs.writeFileSync('src/config/runtime.js', config);

let socialVerify = fs.readFileSync('verify-social-digital-twin.mjs', 'utf8');
socialVerify = socialVerify.replaceAll("pkg.version === '2.1.0'", "pkg.version === '2.1.1'").replaceAll('Package version must be 2.1.0', 'Package version must be 2.1.1');
fs.writeFileSync('verify-social-digital-twin.mjs', socialVerify);

let deploymentVerify = fs.readFileSync('verify-deployment-notifications.mjs', 'utf8');
deploymentVerify = deploymentVerify.replaceAll('2.1.0', '2.1.1');
fs.writeFileSync('verify-deployment-notifications.mjs', deploymentVerify);

fs.writeFileSync('release-notes.json', JSON.stringify({
  version: '2.1.1',
  notificationPolicy: 'latest-main-only-with-runtime-success-fallback',
  queueDelivery: 'mark-processed-after-success',
  added: [
    '明确文字提问的强制触发标记与 204 自动重试',
    '处理超过约两秒时才出现并在完成后撤回的延迟思考提示',
    '语义提问、媒体补充、纯标点和单独 @ 的分级聚合延迟'
  ],
  fixed: [
    '明确 @ 提问在内部返回 204 或异常时可能完全静默',
    '同一消息重复 @ 机器人会被误判为单独 @ 并接续纯标点',
    '纯标点互动可能与真正问题取得相同处理优先级',
    'QQ 原生表情虽进入聚合，但 Worker 有效内容检查仍可能将其判空'
  ]
}, null, 2) + '\n');

console.log('apply-explicit-question-priority: patched');
