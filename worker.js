Warning: truncated output (original token count: 89388)
Total output lines: 5422

import { aiReplyPromisesFutureSearch, aiReplySignalsUncertainty, appendSearchSources, buildDeepSeekContextSummary, callDeepSeekSummaryTask, callGeminiGenerate, callGoogleDecision, decideReplyMentionRouting, deepSeekApiKeys, effectiveRuntimeModels, enforceExecutedSearchForReply, generateHybridReply, googleApiKeysFor, imageInspectionEnabled, isLightweightAcknowledgement, isLowContextInterjectionFragment, mergeAbortSignal, notifyDeveloper, roundRobinKeys, stripBotMentionFromConversation } from "./src/ai/runtime.js";
import { buildImmediateConversationContext, buildMeetingMinuteBatches, normalizeMeetingMinuteCount, splitOutboundText } from "./src/ai/conversation-quality.js";
import { AI_MEDIA_LIMITS, DEFAULTS, VERSION, classifyOperationalFailure } from "./src/config/runtime.js";
import { publicBaseUrl } from "./src/config/deployment.js";
import { consumeManualRuleCheckRate, developerIds, getAffinityProfile, isDeveloperId, latestConversationMessageForUser, recentConversationMessagesForUser, refreshAffinityAiAssessment, stripGroupAiOptOutPrefix, updateAffinityFixedFromMessage } from "./src/core/identity.js";
import { appendIndex, buildLongGroupConversationContext, callOneBotAction, checkRuntimeRateLimit, getEffectivePermissions, isKnownOutboundMessage, markOutboundPending, modelPreferenceLabel, normalizeMemoryItems, normalizeModelPreference, normalizePermissionName, permissionLabel, removeFromIndex, setExplicitPermission, updateAiDecisionLog, writeAiDecisionLog, writeSystemAudit } from "./src/core/permissions.js";
import { appendChatHistoryTurn, clearChatSessionHistory, dbDel, dbGet, dbPut, readChatHistory, withTimeout } from "./src/data/store.js";
import { announceDeployedVersionFallback, getDeploymentStatusForViewer, handleDeploymentBuildQueue, injectDeploymentPortalClient } from "./src/deployment/notifications.js";
import { botCanRunRuleMonitor, getBotGroupRole, getGroupFamilyForGroup, getGroupJoinPage, isVerifiedGroupOwner } from "./src/group/runtime.js";
import { buildHealthState } from "./src/health/runtime.js";
import { normalizeMultilingualCommand, toSimplifiedChinese } from "./src/i18n/commands.js";
import { collectFullMemberDetails, formatFullMemberDetailsReport } from "./src/members/details.js";
import { handleBilibiliWebhook, pollAutomaticBilibiliConnectors } from "./src/integrations/bilibili.js";
import { attachModerationProposalMessage, createGroupWorkRequest, createJoinRequestAssist, createModerationProposal, decideJoinRequestAssist, detectNaturalModerationProposal, findLatestActiveRuleViolationForUser, formatModerationPermissionDenied, formatModerationProposal, getGroupMemberSafe, handleGroupWorkDecision, handleModerationConfirmation, inspectMessageAgainstGroupRules, normalizeRuleProxyMode, normalizeRuleStrictness, parseModerationConfirmation, parseUnlimitedNonNegativeInteger, recordRuleViolationFeedback, ruleStrictnessLabel } from "./src/moderation/runtime.js";
import { MAX_MUTE_SECONDS as MUTE_LOCK_MAX_SECONDS, canUnlockMute, clearMuteLock, createMasterMuteLock, createPartnerMuteLock, createSelfMuteLock, getMuteLock, listActiveSelfMuteLocks, markMuteLockReapplied, markMuteUnlockBlocked, muteLockRemainingSeconds, putMuteLock } from "./src/moderation/mute-locks.js";
import { MASTER_RELATIONSHIP_DEFAULTS, MASTER_RELATIONSHIP_MAX_LEVEL, clearPartnerBinding, createMasterBindingRequest, createPartnerBindingRequest, decidePartnerBindingRequest, getBindingRequest, getPartnerBinding } from "./src/moderation/partner-bindings.js";
import { appendPortalConversationRecord, applyConversationOutputGuards, auditIgnoredRobotMessage, botInteractionAllowKey, buildReplyPlan, cacheBotSenderClassification, clearRegisteredThinkingIndicators, detectLiteralPseudoElementLabels, eventHasBotMention, eventMentionedQqs, eventPlainText, eventSenderDisplayName, eventSenderRobotHint, extractFileDescriptors, extractForwardIds, extractMediaDescriptor, extractMessageText, extractOutboundMediaTypes, extractTextMentionIds, filterRobotMentionIds, formatForwardContext, getForwardMessageSnapshot, getQuotedMessage, getTaipeiTimeContext, isExplicitCurrentTimeQuestion, isExplicitRoleplayRequest, isGroupRobotInteractionAllowed, isIgnoredGroupRobotSender, isStandaloneCurrentTimeQuestion, looksLikeRobotDisplayName, normalizeFileDescriptor, parseDurationSeconds, prepareConversationHistory, purgeLegacyBotRepliesFromRecentLogs, qqaiTruthyRobotFlag, recordStructuredMessage, registerThinkingIndicator, removeTextMentionTokens, resolveOneBotMediaAsBase64, runOneBotGroupOperation, sanitizeAiReply, sendThinkingIndicator, thinkingIndicatorRegistryKey } from "./src/onebot/messages.js";
import { classifyCollaborationNaturalIntent, classifyNaturalLanguageCommandIntent, normalizeNaturalLanguageCommandText, opsGetGroupMember, opsGetSettings, opsHandleActivityCommand, opsHandleMemberLeave, opsProcessAutomations } from "./src/operations/runtime.js";
import { processPlatformJobs } from "./src/platform/runtime.js";
import { authDbDelStrict, authDbGetStrict, authDbPutStrict, clearPasswordLoginGuard, commandChangesWebSettings, constantTimeEqual, createPortalPasswordRecord, createPortalSession, decryptPortalAuthSecret, encryptPortalAuthSecret, deleteMemoryVector, generateSixDigitCode, getOneBotHub, getPortalSession, getPublicNebulaSeed, hashBackupCode, isMemoryBanned, isValidPortalPasswordRecord, jsonResponse, markGroupMemberLeft, needsPortalPasswordRehash, normalizePortalAdminUsername, notePasswordLoginFailure, portalAdminCredentialConfig, portalAdminUsernameIsClaimed, portalEnvironmentWithManagedDeveloperIds, portalSessionCookie, readCookie, readJson, readPasswordLoginGuard, readPortalAuthJson, readPortalManagedDeveloperIds, rehashPortalPasswordIfNeeded, sendOneBotAction, sendOneBotHttpAction, sendPortalVerificationMessage, upsertGroupMember, upsertMemoryVector, validatePortalPassword, verifyPortalAdminCredentials, verifyPortalPassword, verifyPortalVerificationCode, verifyTotpCode, writeMemoryAudit, writePortalManagedDeveloperIds, writeSystemError } from "./src/portal/auth.js";
import { getLiveHtmlPage, getPortalHomePage, handleGeminiLiveUpgrade, handlePortalApi } from "./src/portal/runtime.js";
import { injectPortalLayoutClient } from "./src/portal/layout.js";
import { injectPortalMembersClient } from "./src/portal/members.js";
import { applySocialOutputPolicy, buildSocialDecision, buildSocialPromptBlock, capturePersonaContinuity, oneBotBotMentionCount, oneBotEventHasMedia, oneBotEventIsBareMention, oneBotEventIsPunctuationOnly, observeSocialStyle, shouldSendSocialBufferNotice, socialInputDelayMs, waitForSocialTyping } from "./src/social/runtime.js";
import { pickSticker, pickStickerForText, stickerCqMessage } from "./src/social/sticker-library.js";
import { cancelSchedule, cleanupExpiredModerationProposals, cleanupTransientState, countActiveSchedulesForUser, createAppealFromText, createScheduleRecord, extractScheduleMentionIds, formatScheduleLine, listUserSchedules, parseManagementScheduleAction, parseScheduleRequest, performManualGroupCheckins, processConflictSignal, processDueSchedules, reviewScheduleWithGemma, reviseScheduleRecord, runAutomaticGroupCheckins, skipScheduleOnce } from "./src/scheduler/runtime.js";
import { handleEntertainmentCommand } from "./src/games/entertainment.js";
import { handleWerewolfOneBotEvent, injectWerewolfPortalClient, processWerewolfTimers } from "./src/games/werewolf.js";
import { buildHelpText } from "./src/help/commands.js";
import { fetchPublicUrl, getFeatureFlag, getPrivateAccessMode, isGroupWhitelisted, numericId, verifyOneBotAccess } from "./src/security/network.js";


const POLITICAL_TOPIC_PATTERN = /(?:政治|政党|政黨|选举|選舉|总统|總統|主席|国会|國會|立法院|立法委员|立法委員|立委|议员|議員|首相|总理|總理|内阁|內閣|政府|政权|政權|执政|執政|在野|政治人物|政治制度|公共政策|外交|制裁|领土争议|領土爭議|两岸|兩岸|统一|統一|台独|台獨|罢免|罷免|公投|意识形态|意識形態|民进党|民進黨|国民党|國民黨|共产党|共產黨|民主党|民主黨|共和党|共和黨|\b(?:politics|political|election|government|parliament|congress|president|prime minister)\b)/i;

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

const QQAI_V1_R54_PROGRESSIVE_MULTI_ACTION_MARKER = "QQAI_V1_R54_PROGRESSIVE_MULTI_ACTION_MARKER";


const QQAI_V1_R53_ADAPTIVE_MULTI_ACTION_RULE_MARKER = "QQAI_V1_R53_ADAPTIVE_MULTI_ACTION_RULE_MARKER";


const QQAI_V1_R52_FINAL_STABILIZATION_MARKER = "QQAI_V1_R52_FINAL_STABILIZATION_MARKER";


const QQAI_V1_R51_MODEL_ROUTING_ACTIVITY_FIX_MARKER = "QQAI_V1_R51_MODEL_ROUTING_ACTIVITY_FIX_MARKER";


const QQAI_V1_R50_AUTH_SECURITY_FREEZE_MARKER = "QQAI_V1_R50_AUTH_SECURITY_FREEZE_MARKER";


const QQAI_V1_R46_ERROR_SEARCH_PROPOSAL_MARKER = "QQAI_V1_R46_ERROR_SEARCH_PROPOSAL_MARKER";


const QQAI_V1_R45_DIRECT_LOOPBACK_RELIABILITY_MARKER = "QQAI_V1_R45_DIRECT_LOOPBACK_RELIABILITY_MARKER";


const QQAI_V1_R44_PERSISTENT_LOGIN_PERMISSION_LIST_MOBILE_MARKER = "QQAI_V1_R44_PERSISTENT_LOGIN_PERMISSION_LIST_MOBILE_MARKER";


const QQAI_V1_R43_MOBILE_COLLAB_INTENT_MARKER = "QQAI_V1_R43_MOBILE_COLLAB_INTENT_MARKER";


const QQAI_V1_R42_BOT_LOOP_TRANSIENT_RETRY_MARKER = "QQAI_V1_R42_BOT_LOOP_TRANSIENT_RETRY_MARKER";


const QQAI_V1_R41_REPLY_SEMANTICS_RESTORE_MARKER = "QQAI_V1_R41_REPLY_SEMANTICS_RESTORE_MARKER";


const QQAI_V1_R40_MAINTENANCE_LATENCY_INVITE_MARKER = "QQAI_V1_R40_MAINTENANCE_LATENCY_INVITE_MARKER";


const QQAI_V1_R39_PRIVATE_GATE_SELF_SLASH_BANG_MARKER = "QQAI_V1_R39_PRIVATE_GATE_SELF_SLASH_BANG_MARKER";


const QQAI_V1_R38_AFFINITY_MANUAL_CHECK_MARKER = "QQAI_V1_R38_AFFINITY_MANUAL_CHECK_MARKER";


const QQAI_V1_R37_PORTAL_SIMPLIFIED_MARKER = "QQAI_V1_R37_PORTAL_SIMPLIFIED_MARKER";


const QQAI_V1_R36_MARKER = "QQAI_V1_R36_MARKER";


const QQAI_V1_R35_STANDALONE_MARKER = "QQAI_V1_R35_STANDALONE_MARKER";


const QQAI_V1_R34_MARKER = "QQAI_V1_R34_MARKER";


const QQAI_V1_R33_MARKER = "QQAI_V1_R33_MARKER";


const QQAI_V1_R32_MARKER = "QQAI_V1_R32_MARKER";


const QQAI_V1_R31_MARKER = "QQAI_V1_R31_MARKER";


const QQAI_V1_COMPLETE_MARKER = "QQAI_V1_COMPLETE_MARKER";


const QQAI_V1_R3_MARKER = "QQAI_V1_R3_MARKER";

async function checkPortalAuthRateLimit(env, scope, principal, request) {
  if (typeof env?.MY_RATE_LIMITER?.limit !== "function") return { ok: false, unavailable: true };
  const accountKey = `portal:${scope}:account:${String(principal || "unknown").slice(0, 96)}`;
  const ip = String(request?.headers?.get("CF-Connecting-IP") || "unknown").slice(0, 96);
  try {
    const accountResult = await env.MY_RATE_LIMITER.limit({ key: accountKey });
    if (!accountResult?.success) return { ok: false, unavailable: false };
    const ipResult = await env.MY_RATE_LIMITER.limit({ key: `portal:${scope}:ip:${ip}` });
    if (!ipResult?.success) return { ok: false, unavailable: false };
    return { ok: true, unavailable: false };
  } catch {
    return { ok: false, unavailable: true };
  }
}




const QQAIWorker = {
  async fetch(request, env, ctx) {
    env = await portalEnvironmentWithManagedDeveloperIds(env);
    const url = new URL(request.url); // 👈 保留此行，避免後續代碼崩潰！

    // ==========================================
    // 🔌 NapCat / OneBot WebSocket Client 主動回覆入口
    // ==========================================
    const upgradeHeader = request.headers.get("Upgrade");
    if (upgradeHeader && upgradeHeader.toLowerCase() === "websocket" && ["/onebot", "/ws", "/ws/onebot"].includes(url.pathname)) {
      if (!verifyOneBotAccess(request, env)) return new Response("Unauthorized", { status: 401 });
      return getOneBotHub(env).fetch(request);
    }

    // ==========================================
    // 🎙️ Gemini Live：網頁與 WebSocket
    // ==========================================
    if (url.pathname === "/live") {
      if (!upgradeHeader || upgradeHeader.toLowerCase() !== "websocket") {
        return new Response(toSimplifiedChinese(getLiveHtmlPage(url.host)), {
          headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Strict-Transport-Security": "max-age=31536000", "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "strict-origin-when-cross-origin", "Permissions-Policy": "camera=(), geolocation=()" }
        });
      }
      return handleGeminiLiveUpgrade(request, env);
    }

    if (request.method === "GET" && url.pathname === "/system-admin") {
      const session = await getPortalSession(env, readCookie(request, "qqai_session"), { touch: false }).catch(() => null);
      if (!session?.systemAdmin) return Response.redirect(`${url.origin}/`, 302);
      return new Response(`<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>系統管理員</title><style>*{box-sizing:border-box}body{margin:0;padding:24px;background:#101522;color:#eef3ff;font:16px system-ui}.card{max-width:760px;margin:8vh auto;padding:24px;border:1px solid #34405a;border-radius:16px;background:#192235}h1{margin-top:0}p{color:#bdc8dc;line-height:1.6}textarea{display:block;width:100%;min-height:220px;padding:12px;border-radius:10px;border:1px solid #46536e;background:#101522;color:#fff;font:15px monospace}button{margin:14px 8px 0 0;padding:11px 16px;border:0;border-radius:8px;background:#82d8ff;color:#06111c;font-weight:700;cursor:pointer}.secondary{background:#35425a;color:#fff}#status{min-height:24px;color:#9de9bd}.readonly{padding:12px;border-radius:8px;background:#101522;overflow-wrap:anywhere}</style><main class="card"><h1>系統管理員</h1><p>在這裡管理可用 QQ 驗證碼登入的開發者。每行一個 QQ 號；變更不會覆蓋 Cloudflare 的靜態開發者變數。</p><label for="ids">已管理的開發者 QQ</label><textarea id="ids" autocomplete="off" spellcheck="false" placeholder="每行一個 5 至 12 位 QQ 號"></textarea><div><button id="save">儲存開發者名單</button><button id="logout" class="secondary">登出</button></div><p id="status" role="status" aria-live="polite"></p><h2>由 Cloudflare 環境變數管理（唯讀）</h2><div id="static" class="readonly">載入中…</div></main><script>const statusNode=document.querySelector('#status'),idsNode=document.querySelector('#ids'),staticNode=document.querySelector('#static');async function api(method='GET',body){const response=await fetch('/api/system-admin/developers',{method,headers:method==='GET'?{}:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,credentials:'same-origin',cache:'no-store'});const data=await response.json().catch(()=>({ok:false,message:'伺服器回應無法解析'}));if(!response.ok||!data.ok)throw new Error(data.message||'請求失敗');return data}async function load(){try{const data=await api();idsNode.value=(data.managedIds||[]).join('\\n');staticNode.textContent=(data.environmentIds||[]).join('、')||'無';}catch(error){statusNode.textContent=error.message}}document.querySelector('#save').onclick=async()=>{const button=document.querySelector('#save');button.disabled=true;statusNode.textContent='儲存中…';try{const result=await api('POST',{ids:idsNode.value.split(/[\\n,;]+/).map(value=>value.trim()).filter(Boolean)});idsNode.value=result.managedIds.join('\\n');statusNode.textContent='已安全儲存。新的開發者登入將在數秒內生效。'}catch(error){statusNode.textContent=error.message}finally{button.disabled=false}};document.querySelector('#logout').onclick=async()=>{await fetch('/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',credentials:'same-origin'});location.replace('/')}load();</script></html>`, {
        headers: {
          "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Strict-Transport-Security": "max-age=31536000",
          "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "no-referrer",
          "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"
        }
      });
    }

    if (url.pathname === "/api/system-admin/developers") {
      const session = await getPortalSession(env, readCookie(request, "qqai_session")).catch(() => null);
      if (!session?.systemAdmin) return jsonResponse({ ok: false, message: "需要系統管理員帳號登入。" }, 401);
      if (request.method === "GET") {
        try {
          const managedIds = await readPortalManagedDeveloperIds(env);
          const environmentIds = String(env.qqaiStaticDeveloperIds || "").split(/[\n,;]+/g).map(value => value.trim()).filter(Boolean);
          return jsonResponse({ ok: true, managedIds, environmentIds });
        } catch {
          return jsonResponse({ ok: false, code: "DEVELOPER_LIST_UNAVAILABLE", message: "開發者名單資料庫暫時無法讀取。" }, 503);
        }
      }
      if (request.method !== "POST") return jsonResponse({ ok: false, message: "不支援的請求方式。" }, 405, { Allow: "GET, POST" });
      let origin = "";
      try { origin = new URL(request.headers.get("Origin") || "").origin; } catch {}
      if (origin !== url.origin || !request.headers.get("Content-Type")?.toLowerCase().includes("application/json")) {
        return jsonResponse({ ok: false, message: "請從同一個管理員頁面送出變更。" }, 403);
      }
      const payload = await request.json().catch(() => ({}));
      try {
        const managedIds = await writePortalManagedDeveloperIds(env, payload.ids);
        await writeSystemAudit(env, { type: "system_developer_ids", actorId: "system-admin", action: "replace", count: managedIds.length });
        return jsonResponse({ ok: true, managedIds });
      } catch (error) {
        const invalid = ["DEVELOPER_QQ_INVALID", "DEVELOPER_QQ_LIMIT"].includes(error?.code);
        return jsonResponse({ ok: false, code: error?.code || "DEVELOPER_LIST_UNAVAILABLE", message: invalid ? (error.code === "DEVELOPER_QQ_LIMIT" ? "開發者名單最多 50 個 QQ 號。" : "每個 QQ 號必須是 5 至 12 位數字。") : "開發者名單無法安全儲存，請稍後重試。" }, invalid ? 400 : 503);
      }
    }

    // ==========================================
    // 🌌 公共首頁與記憶矩陣中心
    // ==========================================
    if (request.method === 'GET' && ['/', '/portal', '/matrix'].includes(url.pathname)) {
      const portalHtml = injectPortalLayoutClient(injectWerewolfPortalClient(injectPortalMembersClient(injectDeploymentPortalClient(toSimplifiedChinese(getPortalHomePage(url.host))))));
      return new Response(portalHtml, {
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Strict-Transport-Security": "max-age=31536000", "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "strict-origin-when-cross-origin", "Permissions-Policy": "camera=(), geolocation=()" }
      });
    }

    if (request.method === 'GET' && url.pathname === '/appeal') {
      return Response.redirect(`${url.origin}/#appeals`, 302);
    }

    if (request.method === 'GET' && /^\/join\/\d{5,}$/.test(url.pathname)) {
      const requestedGroupId = url.pathname.split('/').pop();
      const family = await getGroupFamilyForGroup(env, requestedGroupId);
      return new Response(getGroupJoinPage(family || { headGroupId: requestedGroupId, headAlias: requestedGroupId }, url.origin), {
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Strict-Transport-Security": "max-age=31536000", "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "strict-origin-when-cross-origin", "Permissions-Policy": "camera=(), geolocation=()" }
      });
    }

    if (request.method === 'GET' && ['/health', '/healthz'].includes(url.pathname)) {
      return jsonResponse(await buildHealthState(env));
    }

    if (request.method === 'GET' && url.pathname === '/api/public/nebula') {
      return jsonResponse(getPublicNebulaSeed());
    }

    if (url.pathname.startsWith('/api/appeal/')) {
      return jsonResponse({ ok: false, message: "独立申诉接口已停用，请登录 Control Center 使用匿名申诉。" }, 410);
    }

    if (request.method === 'POST' && url.pathname.startsWith('/api/integrations/bilibili/webhook/')) {
      return handleBilibiliWebhook(request, env, url);
    }

    if (request.method === 'GET' && url.pathname === '/api/deployment/status') {
      const token = readCookie(request, 'qqai_session');
      const session = await getPortalSession(env, token, { touch: false }).catch(() => null);
      if (!session) return jsonResponse({ ok: false, message: '请先登录 Portal。' }, 401);
      return jsonResponse(await getDeploymentStatusForViewer(env, session));
    }

    if (url.pathname.startsWith('/api/portal/')) {
      try {
        return await handlePortalApi(request, env, url);
      } catch (error) {
        const storageUnavailable = ["D1_STORAGE_UNAVAILABLE", "PORTAL_AUTH_STORAGE_UNAVAILABLE"].includes(String(error?.code || ""));
        console.error("Portal API request failed", String(error?.code || error?.name || "unknown"));
        return jsonResponse({ ok: false, code: storageUnavailable ? "STORAGE_UNAVAILABLE" : "PORTAL_REQUEST_FAILED", retryable: storageUnavailable, message: storageUnavailable ? "資料庫暫時無法完成操作，資料未確認寫入；請稍後重試。" : "控制台目前無法完成這項操作，請稍後重試。" }, storageUnavailable ? 503 : 500, storageUnavailable ? { "Retry-After": "30" } : {});
      }
    }

    if (request.method === 'POST' && url.pathname === '/api/auth/request-code') {
      let payload = {};
      try { payload = await request.json(); } catch (e) {}
      const qq = String(payload.qq || "").replace(/\D/g, "");
      const group = "";
      if (!/^\d{5,12}$/.test(qq)) {
        return jsonResponse({ ok: false, message: "请先输入 QQ 号。" }, 400);
      }
      const codeLimit = await checkPortalAuthRateLimit(env, "code-send", qq, request);
      if (!codeLimit.ok) return jsonResponse({ ok: false, code: codeLimit.unavailable ? "AUTH_RATE_LIMIT_UNAVAILABLE" : "AUTH_RATE_LIMITED", message: codeLimit.unavailable ? "驗證碼服務目前無法安全啟動，請稍後再試。" : "驗證碼請求過於頻繁，請 10 秒後再試。" }, codeLimit.unavailable ? 503 : 429);

      const code = generateSixDigitCode();
      const authKey = `portal_auth_code:${qq}`;
      try {
        await authDbPutStrict(env, authKey, JSON.stringify({
          code,
          group,
          qq,
          expiresAt: Date.now() + 5 * 60 * 1000,
          attempts: 0
        }));
      } catch (error) {
        return jsonResponse({ ok: false, code: "AUTH_STORAGE_UNAVAILABLE", message: "登录资料库暂时不可用，验证码尚未建立。请稍后重试。" }, 503);
      }

      const verificationMessage = `【QQAIbot Portal 登入驗證碼】\n驗證碼：${code}\n有效期：5 分鐘。\n若非本人操作，請忽略。`;
      const delivery = await sendPortalVerificationMessage(env, qq, verificationMessage);

      await writeSystemAudit(env, {
        type: "portal_auth_code_delivery",
        actorId: qq,
        action: delivery.ok ? "sent" : "failed",
        transport: delivery.transport,
        errors: delivery.ok ? [] : delivery.errors?.slice(-4) || []
      }).catch(() => {});

      if (!delivery.ok) {
        await authDbDelStrict(env, authKey).catch(() => {});
        const diagnostics = delivery.diagnostics || { websocketConnected: null, httpConfigured: Boolean(String(env.ONEBOT_HTTP_ACTION_URL || env.ONEBOT_HTTP_URL || env.NAPCAT_HTTP_URL || "").trim()) };
        const message = diagnostics.websocketConnected === false && !diagnostics.httpConfigured
          ? "驗證碼沒有送出，已取消這次驗證碼。NapCat WebSocket 目前未連線，請確認 NapCat 連到 Worker 的 /onebot WebSocket，且雙方使用相同 Access Token；也可設定 HTTP 備援。"
          : diagnostics.websocketConnected === true
            ? "驗證碼沒有送出，已取消這次驗證碼。NapCat 已連線但拒絕私訊；請確認機器人帳號可私訊此 QQ、Access Token 正確且沒有被對方封鎖。"
            : diagnostics.httpConfigured
              ? "驗證碼沒有送出，已取消這次驗證碼。WebSocket 與 HTTP 備援皆失敗，請檢查 NapCat HTTP URL／Token、連線狀態與 QQ 私訊權限。"
              : "驗證碼沒有送出，已取消這次驗證碼。請連接 NapCat WebSocket，或設定 ONEBOT_HTTP_URL 作為備援。";
        return jsonResponse({
          ok: false,
          code: "VERIFICATION_DELIVERY_FAILED",
          message,
          diagnostics
        }, 503);
      }

      return jsonResponse({
        ok: true,
        message: "驗證碼已傳送至該 QQ 私訊，請在 5 分鐘內輸入。",
        transport: delivery.transport,
        ttl_seconds: 300
      });
    }

    if (request.method === 'POST' && url.pathname === '/api/auth/verify-code') {
      let payload = {};
      try { payload = await request.json(); } catch (e) {}
      const qq = String(payload.qq || "").replace(/\D/g, "");
      const code = String(payload.code || "").replace(/\D/g, "");
      if (!/^\d{5,12}$/.test(qq) || !/^\d{6}$/.test(code)) return jsonResponse({ ok: false, message: "请输入正确的 QQ 号和六位验证码。" }, 400);
      const verifyLimit = await checkPortalAuthRateLimit(env, "code-verify", qq, request);
      if (!verifyLimit.ok) return jsonResponse({ ok: false, code: verifyLimit.unavailable ? "AUTH_RATE_LIMIT_UNAVAILABLE" : "AUTH_RATE_LIMITED", message: verifyLimit.unavailable ? "驗證碼服務目前無法安全啟動，請稍後再試。" : "驗證碼驗證過於頻繁，請 10 秒後再試。" }, verifyLimit.unavailable ? 503 : 429);
      let verified;
      try {
        verified = await verifyPortalVerificationCode(env, qq, code, { consume: false });
      } catch (error) {
        return jsonResponse({ ok: false, code: "AUTH_STORAGE_UNAVAILABLE", message: "登录资料库暂时不可用，验证码没有被消耗。请稍后重试。" }, 503);
      }
      if (!verified.ok) return jsonResponse(verified, 400);
      const remember = payload.remember !== false;
      let session;
      try {
        session = await createPortalSession(env, { qq, group: "", groupId: "", persistent: remember, authMethod: "qq_code" });
        await authDbDelStrict(env, `portal_auth_code:${qq}`);
      } catch (error) {
        return jsonResponse({ ok: false, code: "SESSION_STORAGE_UNAVAILABLE", message: "验证码正确，但登录会话无法安全保存。验证码仍可再次使用，请稍后重试。" }, 503);
      }
      return jsonResponse({
        ok: true,
        message: "登录成功，正在进入 Control Center。",
        qq,
        group: "",
        groupId: "",
        role: session.role,
        permissions: session.permissions || {},
        passwordSetupAvailable: !(await authDbGetStrict(env, `portal_auth_password:${qq}`).catch(() => null))
      }, 200, { "Set-Cookie": portalSessionCookie(session.token, session.persistent ? DEFAULTS.portalSessionCookieSeconds : null) });
    }

    if (request.method === 'POST' && url.pathname === '/api/auth/reset-password') {
      let payload = {};
      try { payload = await request.json(); } catch (e) {}
      const qq = String(payload.qq || "").replace(/\D/g, "");
      const code = String(payload.code || "").replace(/\D/g, "");
      const newPassword = String(payload.newPassword || "");
      if (!/^\d{5,12}$/.test(qq) || !/^\d{6}$/.test(code)) return jsonResponse({ ok: false, message: "请输入正确的 QQ 号和六位验证码。" }, 400);
      const validation = validatePortalPassword(newPassword);
      if (!validation.ok) return jsonResponse({ ok: false, code: "PASSWORD_POLICY", message: validation.message }, 400);
      try {
        const verified = await verifyPortalVerificationCode(env, qq, code, { consume: false });
        if (!verified.ok) return jsonResponse(verified, 400);
        const record = await createPortalPasswordRecord(validation.value);
        await authDbPutStrict(env, `portal_auth_password:${qq}`, JSON.stringify(record));
        await authDbDelStrict(env, `portal_auth_code:${qq}`);
        await clearPasswordLoginGuard(env, qq);
        await writeSystemAudit(env, { type: "portal_auth_security", actorId: qq, action: "password_reset_by_qq_code" }).catch(() => {});
        return jsonResponse({ ok: true, message: "密码已通过 QQ 验证码重设。现在可以使用新密码登录。" });
      } catch (error) {
        return jsonResponse({ ok: false, code: error?.code || "AUTH_STORAGE_UNAVAILABLE", message: "密码重设失败，验证码尚未消耗，请稍后重试。" }, 503);
      }
    }

    if (request.method === 'POST' && url.pathname === '/api/auth/login-password') {
      let payload = {};
      try { payload = await request.json(); } catch (e) {}
      const loginName = String(payload.username ?? payload.qq ?? "").normalize("NFKC").trim();
      const normalizedLoginName = normalizePortalAdminUsername(loginName);
      const password = String(payload.password || "");
      const adminConfig = portalAdminCredentialConfig(env);
      if (adminConfig.mode === "invalid" && (normalizedLoginName === normalizePortalAdminUsername(env.PORTAL_ADMIN_USERNAME) || normalizedLoginName === "admin")) {
        return jsonResponse({ ok: false, code: "ADMIN_CREDENTIALS_MISCONFIGURED", message: "管理員帳號與密碼變數設定不完整或格式無效，請同時設定有效的 PORTAL_ADMIN_USERNAME 與 PORTAL_ADMIN_PASSWORD。" }, 503);
      }
      if (adminConfig.mode === "configured" && normalizedLoginName === adminConfig.normalizedUsername) {
        if (!password) return jsonResponse({ ok: false, message: "請輸入帳號與密碼。" }, 400);
        const adminRateLimit = await checkPortalAuthRateLimit(env, "password-login", normalizedLoginName, request);
        if (!adminRateLimit.ok) return jsonResponse({ ok: false, code: adminRateLimit.unavailable ? "AUTH_RATE_LIMIT_UNAVAILABLE" : "AUTH_RATE_LIMITED", message: adminRateLimit.unavailable ? "登入服務目前無法安全啟動，請稍後再試。" : "登入嘗試過於頻繁，請 10 秒後再試。" }, adminRateLimit.unavailable ? 503 : 429);
        const guardId = `system_admin:${adminConfig.normalizedUsername}`;
        try {
          const guard = await readPasswordLoginGuard(env, guardId);
          if (Number(guard.lockUntil || 0) > Date.now()) {
            return jsonResponse({ ok: false, code: "PASSWORD_LOGIN_LOCKED", message: `管理員登入嘗試過多，請在 ${Math.ceil((guard.lockUntil - Date.now()) / 60000)} 分鐘後重試。` }, 429);
          }
          const verified = verifyPortalAdminCredentials(env, loginName, password);
          if (!verified.ok) {
            await notePasswordLoginFailure(env, guardId);
            return jsonResponse({ ok: false, code: "PASSWORD_INVALID", message: "管理員帳號或密碼錯誤。" }, 401);
          }
          if (await portalAdminUsernameIsClaimed(env, adminConfig.normalizedUsername)) {
            return jsonResponse({ ok: false, code: "ADMIN_USERNAME_COLLISION", message: "這個管理員帳號名稱已被既有帳號使用，現有帳號資料已保留。請更改 PORTAL_ADMIN_USERNAME 後再登入。" }, 409);
          }
          const session = await createPortalSession(env, { systemAdmin: true, username: verified.username, persistent: false, authMethod: "environment_admin_password" });
          await clearPasswordLoginGuard(env, guardId);
          await writeSystemAudit(env, { type: "portal_auth_security", actorId: "system-admin", action: "environment_admin_login" }).catch(() => {});
          return jsonResponse({ ok: true, systemAdmin: true, message: "系統管理員登入成功。" }, 200, { "Set-Cookie": portalSessionCookie(session.token, 30 * 60) });
        } catch (error) {
          return jsonResponse({ ok: false, code: "ADMIN_AUTH_STORAGE_UNAVAILABLE", message: "管理員登入暫時無法安全完成，請稍後重試。" }, 503);
        }
      }
      if (adminConfig.mode === "configured" && normalizedLoginName === "admin" && normalizedLoginName !== adminConfig.normalizedUsername) {
        return jsonResponse({ ok: false, code: "PASSWORD_INVALID", message: "管理員帳號或密碼錯誤。" }, 401);
      }
      const qqInput = String(payload.qq ?? (/^\d{5,12}$/.test(loginName) ? loginName : "")).trim();
      const qq = /^\d{5,12}$/.test(qqInput) ? qqInput : "";
      if (!/^\d{5,12}$/.test(qq) || !password) return jsonResponse({ ok: false, message: "请输入正确的 QQ 号和密码。" }, 400);
      const passwordRateLimit = await checkPortalAuthRateLimit(env, "password-login", qq, request);
      if (!passwordRateLimit.ok) return jsonResponse({ ok: false, code: passwordRateLimit.unavailable ? "AUTH_RATE_LIMIT_UNAVAILABLE" : "AUTH_RATE_LIMITED", message: passwordRateLimit.unavailable ? "登入服務目前無法安全啟動，請稍後再試。" : "登入嘗試過於頻繁，請 10 秒後再試。" }, passwordRateLimit.unavailable ? 503 : 429);
      try {
        const guard = await readPasswordLoginGuard(env, qq);
        if (Number(guard.lockUntil || 0) > Date.now()) {
          return jsonResponse({ ok: false, code: "PASSWORD_LOGIN_LOCKED", message: `密码登录尝试过多，请在 ${Math.ceil((guard.lockUntil - Date.now()) / 60000)} 分钟后重试，或改用 QQ 验证码。` }, 429);
        }
        const passwordRecord = await readPortalAuthJson(env, `portal_auth_password:${qq}`, null);
        if (!passwordRecord) return jsonResponse({ ok: false, code: "PASSWORD_NOT_SET", message: "此 QQ 尚未设置密码，请先使用 QQ 验证码登录。" }, 404);
        if (!isValidPortalPasswordRecord(passwordRecord)) return jsonResponse({ ok: false, code: "PASSWORD_RECORD_INVALID", message: "密码记录已损坏或格式过旧，请使用 QQ 验证码重设密码。" }, 409);
        if (!(await verifyPortalPassword(password, passwordRecord))) {
          await notePasswordLoginFailure(env, qq);
          return jsonResponse({ ok: false, code: "PASSWORD_INVALID", message: "QQ 号或密码错误。" }, 401);
        }
        const twoFactor = await readPortalAuthJson(env, `portal_auth_2fa:${qq}`, null);
        let factorResult = { ok: true, method: "password" };
        if (twoFactor?.enabled) {
          const factorType = String(payload.factorType || "").toLowerCase();
          const factorCode = String(payload.factorCode || "").trim();
          if (!factorType || !factorCode) {
            return jsonResponse({ ok: false, code: "TWO_FACTOR_REQUIRED", requiresTwoFactor: true, methods: ["totp", "backup", "qq_code"], message: "密码正确，请输入验证器动态码、备用码，或发送 QQ 验证码。" }, 202);
          }
          if (factorType === "totp") {
            const secret = await decryptPortalAuthSecret(env, twoFactor.secret);
            factorResult = { ok: await verifyTotpCode(secret, factorCode), method: "totp" };
          } else if (factorType === "backup") {
            const hash = await hashBackupCode(env, factorCode);
            const index = Array.isArray(twoFactor.backupCodeHashes) ? twoFactor.backupCodeHashes.findIndex(item => constantTimeEqual(item, hash)) : -1;
            factorResult = { ok: index >= 0, method: "backup", index };
          } else if (factorType === "qq_code") {
            const result = await verifyPortalVerificationCode(env, qq, factorCode, { consume: false });
            factorResult = { ok: result.ok, method: "qq_code", message: result.message };
          } else {
            factorResult = { ok: false, method: factorType };
          }
          if (!factorResult.ok) {
            await notePasswordLoginFailure(env, qq);
            return jsonResponse({ ok: false, code: "TWO_FACTOR_INVALID", message: factorResult.message || "双因数验证码或备用码错误。" }, 401);
          }
          if (factorResult.method === "totp" && Number(twoFactor.secret?.version || 1) < 2) {
            try {
              twoFactor.secret = await encryptPortalAuthSecret(env, await decryptPortalAuthSecret(env, twoFactor.secret));
              twoFactor.updatedAt = Date.now();
              await authDbPutStrict(env, `portal_auth_2fa:${qq}`, JSON.stringify(twoFactor));
            } catch (migrationError) {
              console.warn("legacy TOTP key migration deferred", String(migrationError?.code || migrationError?.message || migrationError));
            }
          }
        }
        if (needsPortalPasswordRehash(passwordRecord)) {
          await rehashPortalPasswordIfNeeded(env, qq, password, passwordRecord)
            .catch(error => console.warn("legacy portal password rehash deferred", String(error?.code || "D1_STORAGE_UNAVAILABLE")));
        }
        const remember = payload.remember !== false;
        const session = await createPortalSession(env, { qq, group: "", groupId: "", persistent: remember, authMethod: twoFactor?.enabled ? `password_${factorResult.method}` : "password" });
        if (twoFactor?.enabled && factorResult.method === "backup") {
          twoFactor.backupCodeHashes.splice(factorResult.index, 1);
          twoFactor.updatedAt = Date.now();
          await authDbPutStrict(env, `portal_auth_2fa:${qq}`, JSON.stringify(twoFactor));
        } else if (twoFactor?.enabled && factorResult.method === "qq_code") {
          await authDbDelStrict(env, `portal_auth_code:${qq}`);
        }
        await clearPasswordLoginGuard(env, qq);
        return jsonResponse({ ok: true, message: "密码登录成功。", qq, role: session.role, permissions: session.permissions || {} }, 200, { "Set-Cookie": portalSessionCookie(session.token, session.persistent ? DEFAULTS.portalSessionCookieSeconds : null) });
      } catch (error) {
        const secretMissing = error?.code === "PORTAL_AUTH_SECRET_MISSING";
        return jsonResponse({ ok: false, code: secretMissing ? "TWO_FACTOR_CONFIGURATION_ERROR" : "AUTH_STORAGE_UNAVAILABLE", message: secretMissing ? "双因数验证密钥配置缺失，请管理员设置 PORTAL_AUTH_SECRET。" : "登录资料库暂时不可用，请稍后重试。" }, 503);
      }
    }

    if (request.method === 'POST' && url.pathname === '/api/auth/logout') {
      const token = readCookie(request, "qqai_session");
      if (token) await authDbDelStrict(env, `portal_session:${token}`).catch(() => {});
      return jsonResponse({ ok: true, message: "已退出登录。" }, 200, { "Set-Cookie": portalSessionCookie("", 0) });
    }

    // ==========================================
    // 🤖 OneBot 事件入口：預設只接受 Durable Object 內部轉送
    // ==========================================
    if (request.method !== 'POST') return new Response(`🤖 QQAI Worker ${VERSION} 运行正常`, { status: 200 });
    const internalTransport = url.pathname === "/__onebot_event" && request.headers.get("X-QQAI-Transport") === "websocket-do" && verifyOneBotAccess(request, env);
    const httpTransport = ["/onebot/event", "/event"].includes(url.pathname) && env.ENABLE_ONEBOT_HTTP_EVENTS === "true" && verifyOneBotAccess(request, env);
    if (!internalTransport && !httpTransport) return new Response("Not Found", { status: 404 });

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response("Invalid JSON", { status: 400 });
    }

    const rawMessage = String(body.raw_message || (typeof body.message === 'string' ? body.message : ""));
    const eventSelfId = body.self_id ? body.self_id.toString() : "";
    // 使用 OneBot 事件实际 self_id 判断 @；随机插话仍由插话率独立决定。
    const botId = eventSelfId;
    const rawUserId = body.user_id ? body.user_id.toString() : "";
    const isSentEvent = body.post_type === "message_sent";
    // message_sent 的 user_id 在不同 OneBot 实现中可能代表收件人；发送者固定视为事件 self_id。
    const userId = isSentEvent && eventSelfId ? eventSelfId : rawUserId;
    const isSelfAccount = Boolean(userId && eventSelfId && userId === eventSelfId);
    let sameQqSelfAsk = false;
    let sameQqHumanOnly = false;

    // Webhook 被动回复工具。长任务会在正式回复前撤回「正在思考...」。
    let activeThinkingMessageId = null;
    const clearThinkingIndicator = async () => {
      const id = activeThinkingMessageId;
      activeThinkingMessageId = null;
      await clearRegisteredThinkingIndicators(env, {
        isGroup: body?.message_type === "group", groupId: String(body?.group_id || ""), userId: String(body?.user_id || body?.self_id || "")
      }, id ? [id] : []).catch(() => {});
    };
    const jsonReply = (text, meta = {}) => {
      const thinkingMessageId = activeThinkingMessageId;
      activeThinkingMessageId = null;
      return new Response(JSON.stringify({ reply: toSimplifiedChinese(text), auto_escape: false, thinking_message_id: thinkingMessageId || null, record_reply: false, reply_kind: "command_or_system", ...meta }), {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      });
    };
    const jsonReplyChunks = (chunks, meta = {}) => {
      const rows = (Array.isArray(chunks) ? chunks : [chunks]).map(item => toSimplifiedChinese(String(item || "").trim())).filter(Boolean);
      if (!rows.length) return jsonReply("没有可发送的内容。", meta);
      return jsonReply(rows[0], { ...meta, reply_chunks: rows });
    };
    if (request.signal) {
      request.signal.addEventListener("abort", () => {
        if (typeof ctx?.waitUntil === "function") ctx.waitUntil(clearThinkingIndicator());
        else clearThinkingIndicator().catch(() => {});
      }, { once: true });
    }

    // 【專用小助手】呼叫 Gemini API (用於獨立工具指令)
    const callGeminiDirectly = async (prompt) => {
      const apiKeys = roundRobinKeys(googleApiKeysFor(env, "gemini_chat"), "gemini_chat");
      const fallbackModels = ['gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-3-flash-preview', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'];
      if(apiKeys.length === 0) return null;
      for (const apiKey of apiKeys) {
        for (const model of fallbackModels) {
          try {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] }),
              signal: AbortSignal.timeout(15000)
            });
            if (res.ok) {
              const data = await res.json();
              if (data.candidates?.[0]) return data.candidates[0].content.parts[0].text.replace(/[\*#\-\`~>_]/g, '').trim();
            }
          } catch(e) {}
        }
      }
      return null;
    };

    // 【長期記憶專用】改用 Cloudflare 官方原生免 Key 嵌入模型 (維度 1024)
    const getVector = async (text) => {
      if (!env.AI) return "error_no_cf_ai_binding";
      try {
        const response = await env.AI.run('@cf/baai/bge-m3', {
          text: [text]
        });
        return response.data[0] || null;
      } catch (e) {
        return `error_cf_ai_${e.message}`;
      }
    };

    // 【多模态附件】限制大小、类型与私有地址，避免耗尽 Worker 资源。
    const fetchImageAsBase64 = async (descriptor) => {
      const item = await resolveOneBotMediaAsBase64(env, descriptor, "image", AI_MEDIA_LIMITS.imageBytes, ["image/"]);
      return item ? { base64: item.base64, mimeType: item.mimeType } : null;
    };
    const fetchAudioAsBase64 = async (descriptor) => resolveOneBotMediaAsBase64(env, descriptor, "record", AI_MEDIA_LIMITS.audioBytes, ["audio/", "application/octet-stream"]);
    const fetchVideoAsBase64 = async (descriptor) => resolveOneBotMediaAsBase64(env, descriptor, "video", AI_MEDIA_LIMITS.videoBytes, ["video/", "application/octet-stream"]);

    // ==========================================
    // 🚀 主邏輯業務區
    // ==========================================
    try {
      const currentGroupId = body.group_id ? body.group_id.toString() : "";
      if (body.post_type === "message" && body.message_type === "group" && !isSelfAccount) {
        const ignoredRobotSender = await isIgnoredGroupRobotSender(env, body, { probe: eventHasBotMention(body) });
        if (ignoredRobotSender) {
          ctx.waitUntil(auditIgnoredRobotMessage(env, body, "worker_ingress_guard").catch(() => {}));
          return new Response(null, { status: 204 });
        }
      }
      // 禁言锁必须由 OneBot 实时解除事件驱动；提示去重只控制群消息，绝不能停止补禁。
      if (body.post_type === 'notice' && body.notice_type === 'group_ban' && currentGroupId) {
        if (!(await isGroupWhitelisted(env, currentGroupId))) return new Response(null, { status: 204 });
        const targetId = String(body.user_id || '');
        const operatorId = String(body.operator_id || '');
        const subType = String(body.sub_type || '').toLowerCase();
        const isLift = subType === 'lift_ban' || subType === 'unban' || (subType !== 'ban' && Number(body.duration || 0) === 0);
        if (!isLift || !targetId) return new Response(null, { status: 204 });
        const protectedLock = await getMuteLock(env, currentGroupId, targetId);
        if (!protectedLock) return new Response(null, { status: 204 });

        let liveOperatorRole = '';
        if (operatorId) {
          try {
            const liveOperator = await callOneBotAction(env, { action: 'get_group_member_info', params: { group_id: numericId(currentGroupId), user_id: numericId(operatorId), no_cache: true } }, 8000);
            liveOperatorRole = String(liveOperator?.role || liveOperator?.data?.role || '');
          } catch {}
        }
        const developerOperator = isDeveloperId(env, operatorId);
        const liveOwner = operatorId ? await isVerifiedGroupOwner(env, currentGroupId, operatorId).catch(() => false) : false;
        const permission = canUnlockMute(env, protectedLock, {
          actorId: operatorId,
          actorRole: liveOwner ? 'owner' : liveOperatorRole,
          isDeveloper: developerOperator,
          managementOverride: ['partner', 'master'].includes(protectedLock.source) && (liveOwner || liveOperatorRole === 'admin')
        });
        if (permission.allowed) {
          await clearMuteLock(env, currentGroupId, targetId);
          await writeSystemAudit(env, { type: 'mute_lock_native_release_allowed', groupId: currentGroupId, actorId: operatorId, targetId, action: 'unmute', source: protectedLock.source, reason: permission.reason }).catch(() => {});
          return new Response(null, { status: 204 });
        }

        const blocked = await markMuteUnlockBlocked(env, protectedLock, operatorId);
        const activeLock = blocked.lock || protectedLock;
        const remaining = muteLockRemainingSeconds(activeLock);
        if (remaining <= 0) {
          await clearMuteLock(env, currentGroupId, targetId).catch(() => {});
          return new Response(null, { status: 204 });
        }
        try {
          await callOneBotAction(env, { action: 'set_group_ban', params: { group_id: numericId(currentGroupId), user_id: numericId(targetId), duration: remaining } }, 15000);
          await markMuteLockReapplied(env, activeLock);
          await writeSystemAudit(env, { type: 'mute_lock_reapplied', groupId: currentGroupId, actorId: operatorId, targetId, action: 'mute', source: activeLock.source, remainingSeconds: remaining, blockedAttempts: activeLock.blockedAttempts }).catch(() => {});
          if (blocked.shouldNotify) {
            const hint = activeLock.source === 'self'
              ? '该成员处于自我禁言，只能本人私讯机器人发送「!解除禁言」。'
              : activeLock.source === 'partner'
                ? '该成员处于对象禁言，只能对象或正常群管理权限解除。'
                : activeLock.source === 'master'
                  ? '该成员处于主人禁言，只能对应主人或正常群管理权限解除。'
                  : activeLock.allowOwnerUnmute
                  ? '该禁言已启用防解除，仅开发者或群主可以解除。'
                  : '该禁言已启用防解除，仅开发者可以解除。';
            await callOneBotAction(env, { action: 'send_group_msg', params: { group_id: numericId(currentGroupId), message: '[CQ:at,qq=' + targetId + '] ' + hint + ' 已按剩余时间重新禁言；后续重复尝试不再发送提示。', auto_escape: false } }, 12000).catch(() => {});
          }
        } catch (error) {
          await writeSystemAudit(env, { type: 'mute_lock_reapply_failed', groupId: currentGroupId, actorId: operatorId, targetId, action: 'mute', source: activeLock.source, remainingSeconds: remaining, error: String(error?.message || error).slice(0, 500) }).catch(() => {});
        }
        return new Response(null, { status: 204 });
      }

      if (body.post_type === 'notice' && body.notice_type === 'group_decrease' && currentGroupId) {
        if (!(await isGroupWhitelisted(env, currentGroupId))) return new Response(null, { status: 204 });
        const leavingUserId = String(body.user_id || "");
        if (leavingUserId) {
          await markGroupMemberLeft(env, currentGroupId, leavingUserId, {
            reason: String(body.sub_type || "leave"),
            operatorId: String(body.operator_id || ""),
            groupName: String(body.group_name || currentGroupId)
          });
          ctx.waitUntil(opsHandleMemberLeave(env, currentGroupId, leavingUserId));
          ctx.waitUntil(clearPartnerBinding(env, currentGroupId, leavingUserId).catch(() => {}));
        }
        return new Response(null, { status: 204 });
      }
      if (body.post_type === 'notice' && body.notice_type === 'group_increase' && currentGroupId) {
        if (!(await isGroupWhitelisted(env, currentGroupId))) return new Response(null, { status: 204 });
        const joiningUserId = String(body.user_id || "");
        if (joiningUserId) {
          const cached = await readJson(env, `group_members:${currentGroupId}`, []);
          const existing = cached.find(x => String(x.qq) === joiningUserId);
          await upsertGroupMember(env, currentGroupId, {
            qq: joiningUserId,
            name: existing?.name || joiningUserId,
            role: existing?.role || "member",
            groupName: String(body.group_name || currentGroupId),
            firstSeenAt: existing?.firstSeenAt || new Date().toISOString()
          });
        }
        if (await dbGet(env, `welcome_enabled:${currentGroupId}`) === "true") {
          const template = String(await dbGet(env, `welcome_text:${currentGroupId}`) || DEFAULTS.welcomeText);
          const atCode = `[CQ:at,qq=${joiningUserId}]`;
          let rendered = template.replaceAll('{qq}', joiningUserId).replaceAll('{at}', atCode).trim();
          if (!rendered.includes(atCode)) rendered = `${atCode} ${rendered}`;
          await sendOneBotAction(env, {
            action: "send_group_msg",
            params: { group_id: numericId(currentGroupId), message: rendered, auto_escape: false }
          });
        }
        return new Response(null, { status: 204 });
      }
      if (body.post_type === "request" && body.request_type === "group" && currentGroupId) {
        if (!(await isGroupWhitelisted(env, currentGroupId))) return new Response(null, { status: 204 });
        const requestUserId = String(body.user_id || "");
        if (requestUserId && body.flag) {
          await dbPut(env, `group_join_request:${currentGroupId}:${requestUserId}`, JSON.stringify({
            flag: String(body.flag),
            subType: String(body.sub_type || "add"),
            groupId: String(currentGroupId),
            userId: requestUserId,
            comment: String(body.comment || "").slice(0, 1000),
            at: Date.now()
          }));
        }
        if (await dbGet(env, `join_assist_enabled:${currentGroupId}`) === "false") return new Response(null, { status: 204 });
        const requestOpsSettings = await opsGetSettings(env, currentGroupId);
        if (requestOpsSettings.maintenanceMode || requestOpsSettings.emergencyLock) {
          await writeSystemAudit(env, { type: "join_request_paused", groupId: currentGroupId, actorId: requestUserId, action: requestOpsSettings.emergencyLock ? "emergency_lock" : "maintenance" });
          return new Response(null, { status: 204 });
        }
        await createJoinRequestAssist(env, body);
        return new Response(null, { status: 204 });
      }
      if (!['message', 'message_sent'].includes(body.post_type)) return new Response(null, { status: 204 });

      // 🕒 取得台北時區的確定時間；模型只能使用這份時間資料，不可自行猜測時段。
      const currentTimeContext = getTaipeiTimeContext();
      const currentTime = currentTimeContext.display;
      const isGroup = body.message_type === 'group';
      const isPrivate = body.message_type === 'private';
      
      // 🎯 【就在這裡補上這行宣告！】
      const sessionKey = isGroup ? `chat:group:${currentGroupId}` : `chat:private:${userId}`;

      // ==========================================
      // 💬 D1 歷史紀錄讀取 (維持上下文記憶)
      // ==========================================
      let history = [];
      try {
        history = await readChatHistory(env, sessionKey, DEFAULTS.conversationHistoryItems);
        if (history.length) console.log(`🧠 成功加载历史记忆，当前记忆条数: ${history.length}`);
      } catch (historyError) {
        console.error("读取 D1 历史记录失败:", historyError);
        history = [];
      }
      
      // 精準提取群組身分
      const senderCard = body.sender?.card || body.sender?.nickname || userId;
      const senderRole = body.sender?.role || "member"; 
      const isDeveloper = isDeveloperId(env, userId);

      // OneBot 偶尔可能漏掉 lift_ban 通知。自我禁言仍有效却能再次发言时，静默补禁；
      // 但允许「!禁言自己／!自我禁言」继续进入命令处理，以便刷新禁言时长。
      if (isGroup && body.post_type === "message" && !isSelfAccount && userId) {
        const activeSelfLock = await getMuteLock(env, currentGroupId, userId);
        if (activeSelfLock?.source === "self") {
          const selfMuteCommandText = rawMessage.replace(/\[CQ:at,qq=(?:\d+|all)\]/gi, " ").replace(/\s+/g, " ").trim();
          const refreshingSelfMute = /^[!！](?:禁言自己|自我禁言)(?:\s|$)/i.test(selfMuteCommandText);
          if (!refreshingSelfMute) {
            const remaining = muteLockRemainingSeconds(activeSelfLock);
            if (remaining > 0) {
              try {
                await callOneBotAction(env, { action: "set_group_ban", params: { group_id: numericId(currentGroupId), user_id: numericId(userId), duration: remaining } }, 15000);
                await markMuteLockReapplied(env, activeSelfLock);
                await writeSystemAudit(env, { type: "self_mute_message_fallback_reapplied", groupId: currentGroupId, actorId: userId, targetId: userId, action: "mute", remainingSeconds: remaining }).catch(() => {});
              } catch (error) {
                await writeSystemAudit(env, { type: "self_mute_message_fallback_failed", groupId: currentGroupId, actorId: userId, targetId: userId, action: "mute", remainingSeconds: remaining, error: String(error?.message || error).slice(0, 500) }).catch(() => {});
              }
              return new Response(null, { status: 204 });
            }
          }
        }
      }

      const roleName = senderRole === "owner" ? "群主" : (senderRole === "admin" ? "管理员" : "群友");
      if (isGroup && userId) {
        const senderRobotHint = eventSenderRobotHint(body) || looksLikeRobotDisplayName(senderCard);
        ctx.waitUntil(upsertGroupMember(env, currentGroupId, {
          qq: userId,
          name: senderCard,
          role: isDeveloper ? "developer" : senderRole,
          ...(senderRobotHint ? { isRobot: true } : {}),
          groupName: String(body.group_name || currentGroupId)
        }));
      }

      // ========================================================
      // 📦 【智慧型訊息結構解析器】完美兼容還原 AT 節點、圖片、語音、影片
      // ========================================================
      let userMessage = "";
      let aiReplyOptOut = false;
      let selfSlashBangChat = false;
      let selfSlashBangRawText = "";
      let imageUrl = null;
      let imageFile = null;
      let voiceUrl = null;
      let voiceFile = null;
      let videoUrl = null;
      let videoFile = null;
      let fileAttachments = [];
      let forwardIds = [];
      let forwardSnapshots = [];
      let forwardContext = "";
      let literalPseudoElementContext = "";
      let mentionedQqs = [];
      let replyMessageId = body.message_id ? body.message_id.toString() : "";
      let quotedMessageId = "";
      let quotedMessageText = "";

      if (typeof body.message === "string") {
        userMessage = body.raw_message || body.message || "";
        mentionedQqs = [...userMessage.matchAll(/\[CQ:at,qq=(\d+|all)\]/g)].map(m => m[1]);
        const replyMatch = userMessage.match(/\[CQ:reply,[^\]]*id=([^,\]]+)/);
        quotedMessageId = replyMatch ? replyMatch[1] : "";
        const imageMedia = extractMediaDescriptor(userMessage, "image");
        imageUrl = imageMedia.url;
        imageFile = imageMedia.file;
        const voiceMedia = extractMediaDescriptor(userMessage, "record");
        voiceUrl = voiceMedia.url;
        voiceFile = voiceMedia.file;
        const videoMedia = extractMediaDescriptor(userMessage, "video");
        videoUrl = videoMedia.url;
        videoFile = videoMedia.file;
        fileAttachments = extractFileDescriptors(userMessage);
        forwardIds = extractForwardIds(userMessage);
      } else if (Array.isArray(body.message)) {
        for (const part of body.message) {
          if (part.type === "text") {
            userMessage += part.data.text;
          } else if (part.type === "at") {
            userMessage += `[CQ:at,qq=${part.data.qq}]`;
            mentionedQqs.push(String(part.data.qq));
          } else if (part.type === "reply") {
            quotedMessageId = String(part.data.id || part.data.message_id || "");
            userMessage += quotedMessageId ? `[CQ:reply,id=${quotedMessageId}]` : "";
            quotedMessageText = part.data.text || part.data.message || "";
          } else if (part.type === "image") {
            imageUrl = part.data?.url || null;
            imageFile = part.data?.file || null;
          } else if (part.type === "video") {
            videoUrl = part.data?.url || null;
            videoFile = part.data?.file || null;
          } else if (part.type === "record") {
            voiceUrl = part.data?.url || null;
            voiceFile = part.data?.file || null;
          } else if (part.type === "file") {
            fileAttachments.push(normalizeFileDescriptor(part.data || {}));
          } else if (part.type === "forward") {
            const forwardId = String(part.data?.id || part.data?.message_id || part.data?.res_id || "").trim();
            if (forwardId) forwardIds.push(forwardId);
          }
        }
      }
      forwardIds = [...new Set(forwardIds.filter(Boolean))].slice(0, AI_MEDIA_LIMITS.forwardBundles);
      fileAttachments = fileAttachments.filter(item => item && (item.name || item.file || item.url)).slice(0, 20);
      mentionedQqs = [...new Set([...mentionedQqs, ...eventMentionedQqs(body)].filter(Boolean).map(String))];
      if (isSelfAccount) {
        const selfSlashBang = stripGroupAiOptOutPrefix(userMessage, botId);
        if (selfSlashBang.optedOut) {
          selfSlashBangChat = true;
          selfSlashBangRawText = userMessage;
          userMessage = selfSlashBang.text;
        }
      } else if (isGroup) {
        const optOut = stripGroupAiOptOutPrefix(userMessage, botId);
        aiReplyOptOut = optOut.optedOut;
        userMessage = optOut.text;
      }
      userMessage = normalizeMultilingualCommand(userMessage);

      // 清洗 CQ 标签，保留媒体存在的语义提示。
      let cleanMessage = userMessage
        .replace(/\[CQ:reply,[^\]]+\]/g, '')
        .replace(/\[CQ:at,qq=(\d+)\]/g, '@$1 ')
        .replace(/\[CQ:at,qq=all\]/g, '@全体成员 ')
        .replace(/\[CQ:image,[^\]]+\]/g, '【系统：此位置有一张真实图片附件】')
        .replace(/\[CQ:record,[^\]]+\]/g, '【系统：此位置有一条真实语音附件】')
        .replace(/\[CQ:video,[^\]]+\]/g, '【系统：此位置有一段真实视频附件】')
        .replace(/\[CQ:file,[^\]]+\]/g, '【系统：此位置有一个文件附件】')
        .replace(/\[CQ:forward,[^\]]+\]/g, '【系统：此位置有一组转发消息】')
        .trim();

      // QQ 群友可以手动输入“[聊天记录]”“[图片]”等文字。只有 OneBot 的结构化
      // forward/image/record/video/file 消息段才代表真实附件，普通方括号文字不得误判。
      const literalPseudoElements = detectLiteralPseudoElementLabels(cleanMessage);
      if (literalPseudoElements.length) {
        literalPseudoElementContext = `解析说明：${literalPseudoElements.join("、")} 是用户手动输入的普通文字，不是真实聊天记录、合并转发或附件。当前消息${forwardIds.length ? "另有真实合并转发消息段" : "没有检测到真实合并转发消息段"}。不得声称已查看任何聊天记录，也不要输出“[不支持的元素类型]”之类占位文字。`;
      }

      // 同 QQ 模式：优先识别人工控制前缀。NapCat 标准上报为 message_sent，
      // 但部分版本／连接配置会把自身消息上报成 message；//、??、/!、!、！前缀可兼容放行。
      // 群友的 /! 仍代表完全跳过 AI；只有机器人自身账号人工发出的 /! 才作为聊天触发别名。
      if (isSelfAccount) {
        const explicitSelfSlashBang = selfSlashBangChat;
        const explicitSelfChat = cleanMessage.startsWith('//') || cleanMessage.startsWith('??') || explicitSelfSlashBang;
        const explicitSelfCommand = /^[!！]/.test(cleanMessage);
        if (!isSentEvent && !explicitSelfChat && !explicitSelfCommand) return new Response(null, { status: 204 });

        // Worker 自己通过 API 发出的消息必须继续按 Message ID／发送前指纹排除，避免形成回音循环。
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

        if (cleanMessage.startsWith('//')) {
          cleanMessage = cleanMessage.slice(2).trim();
          sameQqSelfAsk = true;
        } else if (cleanMessage.startsWith('??')) {
          cleanMessage = cleanMessage.slice(2).trim();
          sameQqSelfAsk = true;
        } else if (explicitSelfSlashBang) {
          sameQqSelfAsk = true;
        } else if (!explicitSelfCommand) {
          sameQqHumanOnly = true;
        }
      }

      // 明确 @Bot 后接 ! 指令时，移除机器人自身提及再进入指令路由；
      // 普通 @Bot 聊天仍保留原文，不会被误当成指令。
      if (isGroup && botId && mentionedQqs.includes(String(botId))) {
        const commandAfterMention = stripBotMentionFromConversation(cleanMessage, botId).trim();
        if (/^[!！]/.test(commandAfterMention)) cleanMessage = commandAfterMention;
      }

      let msgLower = cleanMessage.trim().toLowerCase();
      let atSender = isGroup ? `[CQ:at,qq=${userId}] ` : "";
      let isCommandMessage = !aiReplyOptOut && /^[!！]/.test(cleanMessage);
      let commandBody = cleanMessage.replace(/^[!！]+/, '').trim();
      let isAppealCommand = /^(申诉|申訴|appeal)(?:\s|$)/i.test(commandBody);
      let isScheduleCommand = /^(排程|定时|定時|schedule)(?:\s|$)/i.test(commandBody);
      let isActivityInteraction = /(?:活动|活動|报名|報名|候补|候補|参加|參加)/i.test(cleanMessage);
      let naturalLanguageIntent = null;
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

      // 自我禁言只能由本人私讯解除。该命令独立于私聊 AI 开关，成功或失败都不发送聊天提示。
      const privateSelfUnmuteCommand = isPrivate && cleanMessage.match(/^[!！](?:解除禁言|解禁)(?:\s+(\d{5,}))?$/i);
      if (privateSelfUnmuteCommand) {
        const requestedGroupId = String(privateSelfUnmuteCommand[1] || "").replace(/\D/g, "");
        const locks = (await listActiveSelfMuteLocks(env, userId)).filter(lock => !requestedGroupId || lock.groupId === requestedGroupId);
        for (const lock of locks) {
          const permission = canUnlockMute(env, lock, { actorId: userId, privateSelfCommand: true });
          if (!permission.allowed) continue;
          let cleared = false;
          try {
            await clearMuteLock(env, lock.groupId, userId);
            cleared = true;
            await callOneBotAction(env, { action: "set_group_ban", params: { group_id: numericId(lock.groupId), user_id: numericId(userId), duration: 0 } }, 15000);
            await writeSystemAudit(env, { type: "self_mute_private_release", groupId: lock.groupId, actorId: userId, targetId: userId, action: "unmute", silent: true }).catch(() => {});
          } catch (error) {
            if (cleared) await putMuteLock(env, lock).catch(() => {});
            await writeSystemAudit(env, { type: "self_mute_private_release_failed", groupId: lock.groupId, actorId: userId, targetId: userId, action: "unmute_failed", silent: true, error: String(error?.message || error) }).catch(() => {});
          }
        }
        return new Response(null, { status: 204 });
      }

      // 只学习群体结构统计，不保存原句或复制单一群友的私人表达。
      if (isGroup && !isSelfAccount && cleanMessage) {
        ctx.waitUntil(observeSocialStyle(env, {
          groupId: currentGroupId,
          text: cleanMessage,
          isCommand: isCommandMessage,
          isRobot: false
        }).catch(error => console.warn("social style observation failed", error?.message || error)));
      }

      // 先解析明确触发关系。非白名单群的普通聊天必须完全静默，不能见人就提示。
      let quotedMessage = null;
      if (quotedMessageId) {
        quotedMessage = await getQuotedMessage(env, currentGroupId, quotedMessageId, botId);
        quotedMessageText = quotedMessage?.text || quotedMessageText || "";
        // 允许“回复图片并 @机器人”读图；只从被引用消息取媒体，不猜测上一条群消息。
        if (!imageUrl && !imageFile && quotedMessage?.message) {
          const quotedImage = extractMediaDescriptor(quotedMessage.message, "image");
          imageUrl = quotedImage.url;
          imageFile = quotedImage.file;
        }
        if (!voiceUrl && !voiceFile && quotedMessage?.message) {
          const quotedVoice = extractMediaDescriptor(quotedMessage.message, "record");
          voiceUrl = quotedVoice.url;
          voiceFile = quotedVoice.file;
        }
      }
      const botMentioned = Boolean(botId && mentionedQqs.includes(botId));
      const duplicateMentionNoise = isGroup && botMentioned && oneBotBotMentionCount(body) > 1 && (!eventPlainText(body).trim() || oneBotEventIsPunctuationOnly(body));
      if (duplicateMentionNoise) {
        ctx.waitUntil(writeAiDecisionLog(env, {
          groupId: currentGroupId, userId, senderName: senderCard, sourceMessageId: replyMessageId,
          input: cleanMessage, mentionedQqs, botMentioned: true, isGroup: true,
          decision: "skipped", reason: "duplicate_mention_noise", triggerType: "mention"
        }));
        return new Response(null, { status: 204 });
      }
      const repliedToBot = Boolean(quotedMessage && quotedMessage.source === 'ai');
      const repliedToOwnerHuman = Boolean(quotedMessage && quotedMessage.source === 'owner-human');

      // 私聊权限必须在任何可选模型、图片诊断与自然语言 AI 分类之前完成。
      // 私聊 AI 未开放时，普通文字、图片、语音与视频全部静默；不会泄露开发者配置状态。
      // 为保留「所有指令均有自然语言」，此处只运行本地确定性解析器，不调用任何模型。
      if (isPrivate && !isDeveloper) {
        privateAccessMode = await getPrivateAccessMode(env, userId);
        const privateChatEnabled = await getFeatureFlag(env, 'private_chat_enabled', false);
        const privateScheduleEnabled = await getFeatureFlag(env, 'private_schedule_enabled', false);
        const appealEnabled = await getFeatureFlag(env, 'private_appeal_enabled', DEFAULTS.appealEnabled);

        if (!isCommandMessage && !aiReplyOptOut) {
          const privateNaturalSource = stripBotMentionFromConversation(cleanMessage, botId) || cleanMessage;
          const localPrivateNatural = normalizeNaturalLanguageCommandText(privateNaturalSource, Date.now());
          if (localPrivateNatural?.commandText) {
            naturalLanguageIntent = { ...localPrivateNatural, parser: localPrivateNatural.parser || 'local_private_gate' };
            cleanMessage = localPrivateNatural.commandText;
            msgLower = cleanMessage.toLowerCase();
            isCommandMessage = true;
            commandBody = cleanMessage.replace(/^[!！]+/, '').trim();
            isAppealCommand = /^(申诉|申訴|appeal)(?:\s|$)/i.test(commandBody);
            isScheduleCommand = /^(排程|定时|定時|schedule)(?:\s|$)/i.test(commandBody);
            isActivityInteraction = /(?:活动|活動|报名|報名|候补|候補|参加|參加)/i.test(cleanMessage);
            ctx.waitUntil(writeSystemAudit(env, {
              type: 'natural_language_command', groupId: '', actorId: userId,
              action: String(localPrivateNatural.intent || commandBody).slice(0, 120),
              parser: naturalLanguageIntent.parser, confidence: Number(localPrivateNatural.confidence || 0),
              originalText: privateNaturalSource.slice(0, 1000)
            }).catch(() => {}));
          }
        }

        if (isAppealCommand && appealEnabled) {
          // 放行匿名申诉。
        } else if (isScheduleCommand && privateScheduleEnabled && privateAccessMode !== 'none') {
          // 私聊排程与聊天开关分离。
        } else if (isActivityInteraction && privateAccessMode !== 'none') {
          // 活动报名、候补、取消与有权限的活动管理可在私聊独立使用。
        } else if (!privateChatEnabled || privateAccessMode === 'none') {
          return new Response(null, { status: 204 });
        } else if (privateAccessMode === 'commands' && !isCommandMessage) {
          return new Response(null, { status: 204 });
        }
        privateAccessChecked = true;
      } else if (!isGroup && !isPrivate) {
        return new Response(null, { status: 204 });
      }

      const naturalLanguageTrigger = !aiReplyOptOut && !isCommandMessage && (isPrivate || botMentioned || repliedToBot || sameQqSelfAsk);
      if (naturalLanguageTrigger) {
        const naturalSourceText = stripBotMentionFromConversation(cleanMessage, botId) || cleanMessage;
        const normalizedNatural = normalizeNaturalLanguageCommandText(naturalSourceText, Date.now()) || await classifyNaturalLanguageCommandIntent(env, naturalSourceText);
        if (normalizedNatural?.commandText) {
          naturalLanguageIntent = normalizedNatural;
          cleanMessage = normalizedNatural.commandText;
          msgLower = cleanMessage.toLowerCase();
          isCommandMessage = true;
          commandBody = cleanMessage.replace(/^[!！]+/, '').trim();
          isAppealCommand = /^(申诉|申訴|appeal)(?:\s|$)/i.test(commandBody);
          isScheduleCommand = /^(排程|定时|定時|schedule)(?:\s|$)/i.test(commandBody);
          isActivityInteraction = /(?:活动|活動|报名|報名|候补|候補|参加|參加)/i.test(cleanMessage);
          ctx.waitUntil(writeSystemAudit(env, { type: "natural_language_command", groupId: currentGroupId, actorId: userId, action: String(normalizedNatural.intent || commandBody).slice(0, 120), parser: normalizedNatural.parser || "local", confidence: Number(normalizedNatural.confidence || 0), originalText: naturalSourceText.slice(0, 1000) }).catch(() => {}));
        }
      }
      const explicitlyTriggered = !aiReplyOptOut && (botMentioned || repliedToBot || sameQqSelfAsk || isPrivate || isCommandMessage);

      // 只有真实文字或媒体才算有效提问；单独 @、空白、换行、全角空格与零宽字符全部静默丢弃。
      const hasAnyMediaAttachment = Boolean(imageUrl || imageFile || voiceUrl || voiceFile || videoUrl || videoFile || fileAttachments.length || forwardIds.length || oneBotEventHasMedia(body));
      const meaningfulText = String(userMessage || "")
        .replace(/\[CQ:(?:at|reply),[^\]]+\]/gi, "")
        .replace(/\[CQ:[^\]]+\]/g, "")
        .replace(/[\s\u00A0\u200B-\u200D\u2060\u3000\uFEFF]+/g, "");
      if (isGroup && botMentioned && !meaningfulText && !hasAnyMediaAttachment) {
        ctx.waitUntil(writeAiDecisionLog(env, {
          groupId: currentGroupId, userId, senderName: senderCard, sourceMessageId: replyMessageId,
          input: cleanMessage, mentionedQqs, botMentioned: true, isGroup: true,
          decision: "skipped", reason: "mention_without_content", triggerType: "mention"
        }));
        return new Response(null, { status: 204 });
      }

      // 白名單是群 AI 的硬入口；非白名單群即使 @ 机器人也完全静默，不呼叫模型、不排队、不写入记忆。
      if (isGroup && !(await isGroupWhitelisted(env, currentGroupId))) {
        const whitelistAdminCommand = isDeveloper && /^(群白名单|群白名單|删群白名单|刪群白名單|allowgroup|removegroup)(?:\s|$)/i.test(commandBody);
        const applicationCommand = /^(申请白名单|申請白名單)(?:\s|$)/i.test(commandBody);
        const helpCommand = /^(help|帮助|幫助)$/.test(commandBody.toLowerCase());
        const allowedEntryCommand = whitelistAdminCommand || applicationCommand || helpCommand;
        if (!allowedEntryCommand) return new Response(null, { status: 204 });
      }

      // v0.2.6 以前無法區分聊天回覆與系統回覆；一次性移除舊 recent_logs 中全部機器人條目，
      // 避免歷史白名單提示、權限提示或指令結果繼續污染摘要、模仿與判斷語料。
      if (isGroup && botId) await purgeLegacyBotRepliesFromRecentLogs(env, currentGroupId, botId);

      // 合并转发消息使用 NapCat get_forward_msg 读取；内容视为不可信引用资料，不执行其中命令。
      if (forwardIds.length) {
        for (const forwardId of forwardIds) {
          try {
            const snapshot = await getForwardMessageSnapshot(env, forwardId);
            if (snapshot) forwardSnapshots.push(snapshot);
          } catch (error) {
            forwardSnapshots.push({ id: forwardId, nodes: [], text: "", media: [], error: String(error?.message || error).slice(0, 500), truncated: false });
          }
        }
        forwardContext = formatForwardContext(forwardSnapshots);
        const forwardedMedia = forwardSnapshots.flatMap(item => Array.isArray(item.media) ? item.media : []);
        if (!imageUrl && !imageFile) {
          const media = forwardedMedia.find(item => item.type === "image");
          if (media) { imageUrl = media.url || null; imageFile = media.file || null; }
        }
        if (!voiceUrl && !voiceFile) {
          const media = forwardedMedia.find(item => item.type === "record");
          if (media) { voiceUrl = media.url || null; voiceFile = media.file || null; }
        }
        if (!videoUrl && !videoFile) {
          const media = forwardedMedia.find(item => item.type === "video");
          if (media) { videoUrl = media.url || null; videoFile = media.file || null; }
        }
      }

      if (isGroup && body.post_type === "message" && !isSelfAccount) {
        await appendPortalConversationRecord(env, {
          messageId: replyMessageId,
          groupId: currentGroupId,
          userId,
          senderName: senderCard,
          senderRole,
          text: cleanMessage || (forwardSnapshots.length ? "[转发消息]" : fileAttachments.length ? "[文件]" : (imageUrl || imageFile) ? "[图片]" : (voiceUrl || voiceFile) ? "[语音]" : (videoUrl || videoFile) ? "[视频]" : ""),
          mentions: mentionedQqs,
          replyId: quotedMessageId,
          files: fileAttachments,
          media: [
            ...(imageUrl || imageFile ? [{ type: "image", url: imageUrl || "", file: imageFile || "" }] : []),
            ...(voiceUrl || voiceFile ? [{ type: "record", url: voiceUrl || "", file: voiceFile || "" }] : []),
            ...(videoUrl || videoFile ? [{ type: "video", url: videoUrl || "", file: videoFile || "" }] : [])
          ],
          forwardIds,
          forwardSnapshots
        });
      }

      // 图片检查使用独立多金钥池；未配置时自动关闭。
      const imageInspectionConfigured = imageInspectionEnabled(env);
      const hasImageReference = Boolean(imageUrl || imageFile);
      if (explicitlyTriggered && /(?:看|讀|读|识别|識別|看到|看见|看見).{0,10}(?:图片|圖片|照片|图|圖)|(?:图片|圖片|照片|图|圖).{0,10}(?:看到|看见|看見|看得到|看得見)/i.test(cleanMessage) && !hasImageReference) {
        return jsonReply(`${atSender}我这则消息没有收到可读取的图片。请直接“回复那张图片”再 @我，或把图片和问题放在同一则消息发送。`);
      }
      if (explicitlyTriggered && hasImageReference && !imageInspectionConfigured) {
        return jsonReply(`${atSender}图片检查目前未启用。开发者配置 GEMINI_VISION_API_KEYS（可填写多个，以逗号分隔）后会自动启用；未配置时系统会自动保持关闭。`);
      }

      // 私聊权限已在任何图片诊断与自然语言模型调用之前完成；此处仅保留防御性断言。
      if (isPrivate && !isDeveloper && !privateAccessChecked) return new Response(null, { status: 204 });

      // 引用訊息已在白名单入口前解析，确保普通群消息不会误触发提示。
      const targetMentionQqs = mentionedQqs.filter(q => q !== botId && q !== 'all');
      const mentionContext = mentionedQqs.length > 0
        ? `当前消息明确提及：${mentionedQqs.map(q => q === botId ? `机器人账号 QQ:${q}` : q === 'all' ? '全体成员' : `成员 QQ:${q}`).join('、')}`
        : "";
      const quoteContext = quotedMessageId
        ? `当前消息引用了 ${quotedMessage?.senderName || '未知成员'}（QQ:${quotedMessage?.senderId || '未知'}，来源:${quotedMessage?.source || 'unknown'}）的消息：${quotedMessageText ? `「${quotedMessageText}」` : '未能取得正文'}。用户当前正文与引用内容必须分开理解。${repliedToOwnerHuman ? '这是同 QQ 模式下的人工消息，不是机器人回答。' : ''}`
        : "";
      const relationContext = [quoteContext, mentionContext, literalPseudoElementContext].filter(Boolean).join("\n");
      const aiDecisionBase = {
        groupId: currentGroupId,
        userId,
        senderName: senderCard,
        sourceMessageId: replyMessageId,
        input: cleanMessage,
        quotedMessageId,
        quotedSenderId: String(quotedMessage?.senderId || ""),
        quotedSource: String(quotedMessage?.source || ""),
        botMentioned,
        repliedToBot,
        mentionedQqs,
        targetMentionQqs,
        isPrivate,
        isGroup
      };

      // /! 是群友明确要求“只作为普通群聊，不进入任何 AI 流程”。
      // 除了不生成聊天回复，也跳过群规分类、插话判断、摘要、向量检索与好感度 AI 评估。
      if (aiReplyOptOut) {
        if (isGroup) {
          await recordStructuredMessage(env, {
            groupId: currentGroupId,
            userId,
            senderName: senderCard,
            messageId: replyMessageId,
            text: cleanMessage,
            mentions: mentionedQqs,
            replyId: quotedMessageId,
            source: "human"
          });
        }
        ctx.waitUntil(writeAiDecisionLog(env, { ...aiDecisionBase, decision: "skipped", reason: "user_opt_out_all_ai", triggerType: "user_opt_out" }).catch(() => {}));
        return new Response(null, { status: 204 });
      }

      // 權限拆分：AI 管理與真正群操作互不混用。
      const permissionSet = await getEffectivePermissions(env, currentGroupId, userId, senderRole, isDeveloper);
      const hasAdminAuth = permissionSet.aiAdmin;
      const hasGroupOpsAuth = permissionSet.groupOps;
      const isOnlyMe = isDeveloper;

      // 固定好感度只采用可解释、限额且幂等的规则更新；AI 调整分另行缓存评估。
      if (isGroup && !isCommandMessage && meaningfulText && (botMentioned || repliedToBot)) {
        ctx.waitUntil(updateAffinityFixedFromMessage(env, {
          groupId: currentGroupId,
          userId,
          text: cleanMessage,
          messageId: replyMessageId,
          direct: true
        }).catch(error => console.warn("affinity fixed update failed", error?.message || error)));
      }

      // 同號人工普通發言只納入上下文，不觸發 AI；人工命令與 ?? 提問可繼續。
      if (sameQqHumanOnly) {
        await recordStructuredMessage(env, {
          groupId: currentGroupId, userId, senderName: senderCard, messageId: replyMessageId,
          text: cleanMessage, mentions: mentionedQqs, replyId: quotedMessageId, source: 'owner-human'
        });
        return new Response(null, { status: 204 });
      }

      // 敏感詞過濾：內建底線 + 群務面板設定。
      const groupKeywords = await readJson(env, `keyword_filter:${currentGroupId}`, []);
      const sensitiveWords = [...groupKeywords];
      const matchedSensitiveWord = sensitiveWords.find(word => cleanMessage.includes(word));
      if (matchedSensitiveWord) {
        ctx.waitUntil(writeAiDecisionLog(env, { ...aiDecisionBase, decision: "blocked", reason: "keyword_filter", triggerType: botMentioned ? "mention" : repliedToBot ? "reply_to_ai" : isPrivate ? "private" : "none", matchedKeyword: matchedSensitiveWord }));
        return new Response(null, { status: 204 });
      }

      const operationsRuntimeSettings = isGroup ? await opsGetSettings(env, currentGroupId) : null;
      const operationsHighRiskPaused = Boolean(operationsRuntimeSettings?.maintenanceMode || operationsRuntimeSettings?.emergencyLock);
      if (isGroup && !operationsHighRiskPaused && !isCommandMessage && !isSelfAccount && (cleanMessage.length > 0 || ((imageUrl || imageFile) && imageInspectionConfigured)) && await dbGet(env, `rule_monitor_enabled:${currentGroupId}`) !== "false") {
        // 在后台检查；群规文字优先，图片作为直接证据一并送入 Google 判断链。检查器会先即时确认机器人为群主／管理员。
        ctx.waitUntil(inspectMessageAgainstGroupRules(env, { groupId: currentGroupId, userId, senderName: senderCard, senderRole: isDeveloper ? "developer" : senderRole, text: cleanMessage || ((imageUrl || imageFile) ? "[图片]" : ""), messageId: replyMessageId, imageUrl, imageFile, mentionedQqs, quotedSenderId: String(quotedMessage?.senderId || "") }));
      }

      // 维护／紧急锁定时暂停主动插话，但保留群友主动 @Bot 的一般聊天。
      const interjectChance = operationsHighRiskPaused ? 0 : Math.max(0, Math.min(100, Number(await dbGet(env, `interject_rate:${currentGroupId}`) || String(DEFAULTS.interjectRate)))) / 100;
      const requiresAiJudgment = true;
      const isImitationGlobal = true;

      // 🛠️ 萬用指令參數解析器：優先使用非機器人的 @，亦支援直接 QQ 号。
      const parseArgs = (rawMessage, prefix) => {
        const lowerRaw = String(rawMessage || '').toLowerCase();
        const index = lowerRaw.indexOf(String(prefix || '').toLowerCase());
        const rawArgs = (index >= 0 ? rawMessage.slice(index + prefix.length) : rawMessage).trim();
        const directNumber = rawArgs.replace(/\[CQ:[^\]]+\]/g, '').trim().match(/^(\d{5,})\b/);
        const targetQq = targetMentionQqs[0] || directNumber?.[1] || null;
        let restText = rawArgs
          .replace(/\[CQ:at,qq=(\d+|all)\]/g, '')
          .replace(/^\d{5,}\b/, '')
          .replace(/\[CQ:[^\]]+\]/g, '')
          .trim();
        return { targetQq, targetQqs: targetMentionQqs.slice(), restText };
      };

      const manualRuleCheckCommand = cleanMessage.match(/^[!！](?:检查|檢查|违规检查|違規檢查|群规检查|群規檢查)(?:\s+([\s\S]*))?$/i);
      if (manualRuleCheckCommand) {
        if (!isGroup) return jsonReply(`${atSender}人工违规检查只能在群聊中使用。`);
        let reportReason = String(manualRuleCheckCommand[1] || "").trim();
        let targetRecord = null;
        if (quotedMessage && quotedMessage.source !== "ai" && String(quotedMessage.senderId || "") !== String(botId || "")) {
          targetRecord = {
            messageId: String(quotedMessage.messageId || quotedMessageId || ""),
            userId: String(quotedMessage.senderId || ""),
            senderName: String(quotedMessage.senderName || quotedMessage.senderId || "群友"),
            text: String(quotedMessage.text || quotedMessageText || "").trim()
          };
        }
        const explicitTarget = targetMentionQqs[0] || reportReason.match(/^@?(\d{5,})\b/)?.[1] || "";
        if (!targetRecord && explicitTarget) {
          const recent = await latestConversationMessageForUser(env, currentGroupId, explicitTarget, replyMessageId);
          if (recent) targetRecord = {
            messageId: String(recent.messageId || recent.id || ""),
            userId: String(recent.userId || explicitTarget),
            senderName: String(recent.senderName || explicitTarget),
            text: String(recent.text || "").trim()
          };
        }
        if (!targetRecord?.userId || !targetRecord?.text) {
          return jsonReply(`${atSender}请回复需要检查的群友消息，并填写原因；也可以 @群友 后说明原因。示例：回复消息后发送“!检查 他连续 @别人并叫爸妈，疑似骚扰”。`);
        }
        if (String(targetRecord.userId) === String(botId || "")) return jsonReply(`${atSender}该指令用于补检群友消息，不检查机器人自己的回复。`);
        if (explicitTarget) {
          reportReason = reportReason.replace(new RegExp(`^@?${explicitTarget}\\s*`), "").trim();
        }
        reportReason = reportReason.replace(/^(?:原因(?:是|为|為)?|因为|因為|理由)[:：\s]*/i, "").trim();
        if (!reportReason) return jsonReply(`${atSender}必须填写你认为违规的具体原因，不能只发“检查”。`);
        const rate = await consumeManualRuleCheckRate(env, currentGroupId, userId);
        if (!rate.allowed) return jsonReply(`${atSender}${rate.message}`);
        await writeSystemAudit(env, {
          type: "manual_rule_check_requested",
          groupId: currentGroupId,
          actorId: userId,
          targetId: targetRecord.userId,
          action: "manual_check",
          messageId: targetRecord.messageId,
          reason: reportReason.slice(0, 1000)
        }).catch(() => {});
        const result = await inspectMessageAgainstGroupRules(env, {
          groupId: currentGroupId,
          userId: targetRecord.userId,
          senderName: targetRecord.senderName,
          text: targetRecord.text,
          messageId: targetRecord.messageId,
          manualReport: {
            reporterId: userId,
            reporterName: senderCard,
            reason: reportReason,
            sourceMessageId: replyMessageId,
            requestedAt: Date.now()
          }
        });
        if (result?.status === "no_rules") return jsonReply(`${atSender}本群尚未设置可供检查的群规。`);
        if (result?.status === "error") return jsonReply(`${atSender}检查失败：${String(result.error || "分类服务暂时不可用").slice(0, 180)}`);
        if (result?.status === "pending_review") return jsonReply(`${atSender}目前证据不足，已保留记录并礼貌询问本群管理协助确认；系统不会因为模型暂时无法判断而停止群规流程。`);
        if (result?.status === "no_violation") {
          const confidence = Math.round(Number(result.review?.confidence || 0) * 100);
          return jsonReply(`${atSender}已复核该消息，目前未确认违规${confidence ? `（置信度 ${confidence}%）` : ""}。你的补充原因已写入审计记录，但不会仅凭举报直接处罚。`);
        }
        if (result?.status === "violation") {
          const item = result.item || {};
          const actionText = String(item.actionResult || result.actionResult || "已建立违规记录");
          return jsonReply(`${atSender}补检确认存在违规。\n对象：${targetRecord.senderName}（QQ:${targetRecord.userId}）\n分类：${item.violationType || result.review?.violationType || "其他"}\n原因：${item.reason || result.review?.reason || reportReason}\n处理：${actionText}`);
        }
        if (result?.status === "disabled") return jsonReply(`${atSender}${result.message || "当前无法执行群规检查。"}`);
        return jsonReply(`${atSender}检查完成，但没有取得可用结论，请稍后重试。`);
      }

      const affinityQueryCommand = cleanMessage.match(/^[!！](?:好感度|查询好感度|查詢好感度|查好感)(?:\s+([\s\S]*))?$/i);
      if (affinityQueryCommand) {
        const rawTarget = String(affinityQueryCommand[1] || "").trim();
        const targetQq = targetMentionQqs[0] || rawTarget.match(/@?(\d{5,})/)?.[1] || userId;
        let targetName = targetQq === userId ? senderCard : targetQq;
        if (isGroup && targetQq !== userId) {
          const member = await opsGetGroupMember(env, currentGroupId, targetQq).catch(() => null);
          if (member?.name) targetName = member.name;
        }
        const profile = await getAffinityProfile(env, { groupId: currentGroupId || "private", userId: targetQq, senderName: targetName, refreshAi: true });
        const aiPart = profile.aiAdjustment >= 0 ? `+${profile.aiAdjustment}` : String(profile.aiAdjustment);
        return jsonReply(`${atSender}${targetName}（QQ:${targetQq}）的好感度：${profile.total}/100\n组成：固定 ${profile.fixed}，AI 调整 ${aiPart}\n关系：${profile.level}\n评估：${profile.reason}`);
      }

      const affinityContextCommand = cleanMessage.match(/^[!！](?:好感度注入|好感度给AI|好感度給AI|好感度上下文)\s*(开|開|关|關|状态|狀態)$/i);
      if (affinityContextCommand) {
        if (!isGroup) return jsonReply(`${atSender}好感度 AI 上下文开关只能在群聊中设置。`);
        const mode = affinityContextCommand[1];
        const enabled = await dbGet(env, `affinity_context_enabled:${currentGroupId}`) !== "false";
        if (/状态|狀態/.test(mode)) return jsonReply(`${atSender}好感度提供给 AI 当前为：${enabled ? "开启" : "关闭"}。`);
        if (!hasAdminAuth) return jsonReply(`${atSender}你没有 AI 管理权限。`);
        const next = /开|開/.test(mode);
        await dbPut(env, `affinity_context_enabled:${currentGroupId}`, next ? "true" : "false");
        await writeSystemAudit(env, { type: "affinity_context_setting", groupId: currentGroupId, actorId: userId, action: next ? "enabled" : "disabled" });
        return jsonReply(`${atSender}已${next ? "开启" : "关闭"}好感度 AI 上下文。${next ? "之后 AI 会收到当前用户的好感度组成，但不会主动公开分数。" : "之后 AI 不再收到好感度资料。"}`);
      }

      const collaborationText = stripBotMentionFromConversation(cleanMessage, botId) || cleanMessage;
      const collaborationFixed = /^[!！](?:活动|活動|报名|報名|取消报名|取消報名|活动名单|活動名單|活动通知|活動通知|投票)(?:\s|$)/i.test(String(collaborationText || "").trim());
      const collaborationConfirm = /^(?:确认建立活动|確認建立活動|确认创建活动|確認創建活動|取消建立活动|取消建立活動|取消创建活动|取消創建活動|确认建立投票|確認建立投票|取消建立投票|确认结束投票|確認結束投票|取消结束投票|取消結束投票)$/i.test(String(collaborationText || "").trim());
      let collaborationNaturalIntent = null;
      const collaborationNaturalEligible = !collaborationFixed && !collaborationConfirm && !isCommandMessage && (isPrivate || botMentioned || repliedToBot || sameQqSelfAsk);
      if (collaborationNaturalEligible) collaborationNaturalIntent = await classifyCollaborationNaturalIntent(env, collaborationText, currentGroupId);
      if (collaborationFixed || collaborationConfirm || collaborationNaturalIntent) {
        const opsActivityCommand = await opsHandleActivityCommand(env, {
          groupId: currentGroupId,
          userId,
          userName: senderCard,
          role: isDeveloper ? "developer" : senderRole,
          text: collaborationText,
          isPrivate,
          naturalIntent: collaborationNaturalIntent
        });
        if (opsActivityCommand.handled) return jsonReply(`${atSender}${opsActivityCommand.text}`);
      }

      const noViolationCommand = cleanMessage.match(/^[!！](?:无违规|無違規)(?:\s|$)/i);
      if (noViolationCommand) {
        if (!(isDeveloper || permissionSet.nativeAdmin)) return jsonReply(`${atSender}只有当前 QQ 管理员、群主或开发者可以撤销群规误判。`);
        const prefix = noViolationCommand[0].trim();
        const { targetQq, restText } = parseArgs(userMessage, prefix);
        if (!targetQq || !String(restText || "").trim()) return jsonReply(`${atSender}格式：!无违规 @被判定违规群友 补充说明。目标和补充说明都必须填写。`);
        const violation = await findLatestActiveRuleViolationForUser(env, currentGroupId, targetQq);
        if (!violation) return jsonReply(`${atSender}找不到该成员尚未撤销的群规处理记录。`);
        const updated = await recordRuleViolationFeedback(env, violation, userId, "not_violation", String(restText).trim());
        await dbDel(env, `rule_mute_enforcement:${currentGroupId}:${targetQq}`);
        return jsonReply(`${atSender}已将 ${targetQq} 的记录 ${updated.id} 标记为误判，并撤销可撤销处罚。补充：${String(restText).trim()}`);
      }

      const muteGuardSetting = cleanMessage.match(/^[!！](?:违规禁言保护|違規禁言保護)\s*(开|開|关|關|状态|狀態)$/i);
      if (muteGuardSetting) {
        if (!(isDeveloper || await isVerifiedGroupOwner(env, currentGroupId, userId))) return jsonReply(`${atSender}只有当前群主或开发者可以开关违规禁言保护。`);
        const mode = muteGuardSetting[1];
        if (/状态|狀態/.test(mode)) {
          const enabled = await dbGet(env, `rule_mute_guard_enabled:${currentGroupId}`) !== "false";
          return jsonReply(`${atSender}违规禁言保护当前为：${enabled ? "开启" : "关闭"}。`);
        }
        const enabled = /开|開/.test(mode);
        await dbPut(env, `rule_mute_guard_enabled:${currentGroupId}`, enabled ? "true" : "false");
        await writeSystemAudit(env, { type: "rule_mute_guard_setting", groupId: currentGroupId, actorId: userId, action: enabled ? "enabled" : "disabled" });
        return jsonReply(`${atSender}违规禁言保护已${enabled ? "开启" : "关闭"}。${enabled ? "管理提前解除 AI 群规禁言时，将按剩余时间重新禁言。" : "之后不会重新禁言，也不会发送提示。"}`);
      }

      const webSettingCommandsDisabledEarly = await dbGet(env, `web_command_off:${currentGroupId}`) === "true";
      if (webSettingCommandsDisabledEarly && commandChangesWebSettings(cleanMessage)) {
        return jsonReply(`${atSender}本群已關閉設定型 ! 指令。關閉後只能從 Portal 網頁重新開啟或修改設定。`);
      }

      const ruleMonitorSetting = cleanMessage.match(/^[!！](?:群规监控|群規監控|规则监控|規則監控)\s*(开|開|关|關|状态|狀態)$/i);
      if (ruleMonitorSetting) {
        const mode = ruleMonitorSetting[1];
        co…39388 tokens truncated…
        maxMessages: DEFAULTS.groupContextExactMessages,
        maxChars: 16000
      }) : "";
      if (immediateContext) userPrompt = `${immediateContext}\n\n【当前发言】\n${userPrompt}`;
      aiInputParts.push({ text: userPrompt });

      // 2. 注入多模态媒体 (图片/语音/视频)
      let loadedImage = false;
      if ((imageUrl || imageFile) && imageInspectionConfigured) {
        try {
          const imageData = await fetchImageAsBase64({ url: imageUrl, file: imageFile });
          if (imageData) {
            loadedImage = true;
            aiInputParts.push({ inlineData: { mimeType: imageData.mimeType, data: imageData.base64 } });
          }
        } catch (error) {
          console.warn("NapCat image download failed:", error);
          await clearThinkingIndicator();
          return jsonReply(`${atSender}我收到了图片消息，但 NapCat 没有提供 Cloudflare 可下载的图片网址。请更新 NapCat 后重试，或重新发送图片并 @我。`);
        }
      }
      if (voiceUrl || voiceFile) {
        try {
          const audioData = await fetchAudioAsBase64({ url: voiceUrl, file: voiceFile });
          if (audioData) aiInputParts.push({ inlineData: { mimeType: audioData.mimeType, data: audioData.base64 } });
        } catch (error) {
          console.warn("NapCat audio download failed:", error);
        }
      }
      if (videoUrl || videoFile) {
        try {
          const videoData = await fetchVideoAsBase64({ url: videoUrl, file: videoFile });
          if (videoData) aiInputParts.push({ inlineData: { mimeType: videoData.mimeType, data: videoData.base64 } });
        } catch (error) {
          console.warn("NapCat video download failed:", error);
        }
      }
      if (!loadedImage) {
        finalStylePrompt += "\n\n【视觉真实性规则】当前请求没有成功载入任何图片像素。绝对禁止声称看到了图片、描述图片内容或假装能读取上一条未引用的图片；若用户询问图片，应明确要求他回复该图片或重新发送。";
      }

      // 3. System Prompt 只通过各提供者的 system/systemInstruction 传入，避免伪造一轮助手确认消息造成风格漂移。
      let contents = [];

      // 4. 历史助手回复会先去除未配置的角色扮演表面风格，再作为事实上下文传入。
      for (const msg of prepareConversationHistory(history, { allowRoleplay: allowRoleplayStyle })) {
        contents.push(msg);
      }

      // 5. 压入本次用户的最新发言与附件
      contents.push({ role: "user", parts: aiInputParts });

      // 第八段到此完美结束，准备进入第九段的多模型轮询请求与响应处理...

      // ==========================================
      // 🔄 Gemini / DeepSeek 混合路由
      // ==========================================
      const replaceThinkingStatus = async phase => {
        if (!botMentioned || isAutoInterject) return;
        const labels = { searching: "正在搜索...", organizing: "正在整理...", thinking: "正在思考..." };
        const text = labels[String(phase || "")] || "正在思考...";
        await clearRegisteredThinkingIndicators(env, { isGroup, groupId: currentGroupId, userId }, activeThinkingMessageId ? [activeThinkingMessageId] : []).catch(() => null);
        activeThinkingMessageId = await sendThinkingIndicator(env, { isGroup, groupId: currentGroupId, userId, text }).catch(() => null);
      };
      let finalReply = "";
      let success = false;
      let baseText = "";
      let usedModel = "";
      let usedProvider = "";
      let generationError = null;
      let searchInfo = { required: false, attempted: false, performed: false, query: "", context: "", sources: [], queries: [], provider: "", model: "", error: "" };
      const modelPref = await dbGet(env, `model_pref:${currentGroupId || 'private'}:${userId}`) || 'auto';
      if (standaloneTimeQuestion) {
        baseText = `【Asia/Taipei/Shanghai（亚洲/台北/上海时间）是：${currentTime}】`;
        usedModel = "deterministic-clock";
        usedProvider = "worker";
        success = true;
      } else {
        try {
          const generated = await generateHybridReply(env, {
            modelPref, chatModels, finalStylePrompt, contents, cleanText: conversationText,
            fastChat: isFastAcknowledgement,
            hasMedia: Boolean(loadedImage || voiceUrl || voiceFile || videoUrl || videoFile),
            visionRequest: loadedImage,
            userId, groupId: currentGroupId, isDeveloper, signal: request.signal,
            onSearchStatus: replaceThinkingStatus
          });
          baseText = String(generated?.text || '').trim();
          usedModel = generated?.model || 'unknown';
          usedProvider = generated?.provider || 'unknown';
          searchInfo = {
            required: Boolean(generated?.searchRequired),
            attempted: Boolean(generated?.searchAttempted),
            performed: Boolean(generated?.searchPerformed),
            query: String(generated?.searchQuery || conversationText || ""),
            context: String(generated?.searchContext || ""),
            sources: Array.isArray(generated?.searchSources) ? generated.searchSources : [],
            queries: Array.isArray(generated?.searchQueries) ? generated.searchQueries : [],
            provider: String(generated?.searchProvider || ""),
            model: String(generated?.searchModel || ""),
            error: String(generated?.searchError || "")
          };
          success = Boolean(baseText);
          if (searchInfo.required || searchInfo.attempted) await replaceThinkingStatus("thinking");
        } catch (e) {
          generationError = e;
          console.error('Hybrid generation failed:', e);
        }
      }

      const replyNeedsSearchRecovery = baseText && (aiReplyPromisesFutureSearch(baseText) || (!searchInfo.performed && aiReplySignalsUncertainty(baseText)));
      if (replyNeedsSearchRecovery) {
        const recovered = await enforceExecutedSearchForReply(env, {
          text: baseText,
          searchInfo,
          query: conversationText,
          models: chatModels,
          finalStylePrompt,
          contents,
          signal: request.signal,
          force: aiReplySignalsUncertainty(baseText),
          onSearchStatus: replaceThinkingStatus
        });
        baseText = String(recovered.text || "").trim();
        const recoveredSearch = recovered.searchInfo || {};
        searchInfo = {
          required: Boolean(recoveredSearch.required),
          attempted: Boolean(recoveredSearch.attempted),
          performed: Boolean(recoveredSearch.performed),
          query: String(recoveredSearch.query || conversationText || ""),
          context: String(recoveredSearch.context || ""),
          sources: Array.isArray(recoveredSearch.sources) ? recoveredSearch.sources : [],
          queries: Array.isArray(recoveredSearch.searchQueries || recoveredSearch.queries) ? (recoveredSearch.searchQueries || recoveredSearch.queries) : [],
          provider: String(recoveredSearch.provider || "gemini_google_search"),
          model: String(recoveredSearch.model || ""),
          error: String(recoveredSearch.error || recoveredSearch.recoveryError || "")
        };
        usedProvider = searchInfo.performed ? `${usedProvider}+grounded_recovery` : `${usedProvider}+search_unavailable_guard`;
        success = Boolean(baseText);
      }

      if (request.signal?.aborted) {
        await clearThinkingIndicator();
        return new Response(null, { status: 204 });
      }

      if (success) {
        const totalCallsStr = await dbGet(env, 'STAT_TOTAL_CALLS');
        const totalCalls = totalCallsStr ? parseInt(totalCallsStr) : 0;
        ctx.waitUntil(dbPut(env, 'STAT_TOTAL_CALLS', String(totalCalls + 1)));
        ctx.waitUntil(dbPut(env, 'STAT_LAST_MODEL', `${usedProvider}:${usedModel}`));
      } else {
        const classified = classifyOperationalFailure(generationError || searchInfo.error || "ALL_MODELS_FAILED", { disposition: "worker_error" });
        ctx.waitUntil(writeAiDecisionLog(env, { ...aiDecisionBase, decision: "error", reason: "all_models_failed", triggerType, interjectJudgement, failureCode: classified.code, failureDetail: String(generationError?.message || generationError || searchInfo.error || "ALL_MODELS_FAILED").slice(0, 500), contextMessageCount: groupConversationLogs.length, contextSummaryProvider: longGroupContext?.summaryProvider || "" }));
        if (isAutoInterject) return new Response(null, { status: 204 });
        return jsonReply(`${atSender}${classified.userText}`);
      }

      if (/^\s*\[SKIP\]\s*$/i.test(baseText)) {
        ctx.waitUntil(writeAiDecisionLog(env, { ...aiDecisionBase, decision: "skipped", reason: isAutoInterject ? "model_declined_interjection" : "model_declined_response", triggerType, provider: usedProvider, model: usedModel, interjectJudgement, searchRequired: searchInfo.required, searchAttempted: searchInfo.attempted, searchPerformed: searchInfo.performed, searchQuery: searchInfo.query, searchContext: searchInfo.context, searchSources: searchInfo.sources, searchQueries: searchInfo.queries, searchProvider: searchInfo.provider, searchModel: searchInfo.model, searchError: searchInfo.error, contextMessageCount: groupConversationLogs.length, contextSummaryProvider: longGroupContext?.summaryProvider || "" }));
        await clearThinkingIndicator();
        return new Response(null, { status: 204 });
      }

      // ==========================================
      // 📝 D1 历史纪录保存与最终回覆动态处理
      // ==========================================
      
      // 先执行人格与时间防漂移，再把净化后的回复保存进历史，避免错误风格污染下一轮。
      if (request.signal?.aborted) {
        await clearThinkingIndicator();
        return new Response(null, { status: 204 });
      }
      let replyText = sanitizeAiReply(applyConversationOutputGuards(sanitizeAiReply(baseText), {
        allowRoleplay: allowRoleplayStyle,
        explicitTimeQuestion,
        standaloneTimeQuestion,
        currentTime,
        currentDayPart: currentTimeContext.dayPart,
        userText: conversationText
      }));
      const explicitLongReply = /(?:详细|詳細|展开|展開|长文|長文|解释清楚|解釋清楚|完整说明|完整說明|仔细说|仔細說)/i.test(conversationText);
      replyText = applySocialOutputPolicy({
        text: replyText,
        userText: conversationText,
        decision: socialDecision,
        profile: socialDecision.profile,
        isGroup,
        explicitLong: explicitLongReply,
        direct: !isAutoInterject,
        personaConfigured: hasConfiguredPersona
      });
      const personaContinuity = await capturePersonaContinuity(env, {
        groupId: currentGroupId,
        userText: conversationText,
        replyText
      }).catch(error => {
        console.warn("persona continuity capture failed", error?.message || error);
        return null;
      });
      if (personaContinuity?.replyText) replyText = personaContinuity.replyText;
      if (aiReplyPromisesFutureSearch(replyText)) {
        replyText = searchInfo.performed && searchInfo.context
          ? appendSearchSources(searchInfo.context, searchInfo.sources || [])
          : "这个问题需要查证，但本轮没有成功取得可验证的联网检索结果。我不会假装稍后还会继续处理，请稍后重新提问。";
      }

      if (await shouldSuppressRepeatedShortReply(env, {
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

      // 1. 群聊使用每回合独立行追加，避免同群多人并发时整份历史互相覆盖；私聊仍按单用户顺序保存。
      const userHistoryItem = { role: 'user', parts: aiInputParts };
      const modelHistoryItem = { role: 'model', parts: [{ text: replyText }] };
      history.push(userHistoryItem, modelHistoryItem);
      if (history.length > DEFAULTS.conversationHistoryItems) history = history.slice(-DEFAULTS.conversationHistoryItems);
      if (isGroup) {
        ctx.waitUntil(appendChatHistoryTurn(env, sessionKey, [userHistoryItem, modelHistoryItem], {
          createdAt: Number(body.time || 0) > 0 ? Number(body.time) * 1000 : Date.now(),
          messageId: replyMessageId,
          userId
        }));
      } else {
        ctx.waitUntil(dbPut(env, sessionKey, JSON.stringify(history)));
      }

      // ==========================================
      // 🚀 最終回覆計畫：可引用、@、純文字或插話
      // ==========================================
      const generatedMentionIds = [...new Set([...extractTextMentionIds(replyText), ...(socialDecision.managerMentionId ? [String(socialDecision.managerMentionId)] : [])])];
      const visibleReplyText = removeTextMentionTokens(replyText);
      const senderDndCheck = await dbGet(env, `dnd:${currentGroupId}:${userId}`) === "true";
      const mentionRouting = await decideReplyMentionRouting(env, {
        isGroup, isAutoInterject, botMentioned, quotedMessageId, userId, selfId: botId,
        quotedSenderId: String(quotedMessage?.senderId || ""), targetMentionQqs, generatedMentionIds,
        senderDnd: senderDndCheck, inputText: conversationText, replyText: visibleReplyText,
        relationContext, recentContext: groupConversationLogs
      });
      const safeMentionIds = isGroup
        ? await filterRobotMentionIds(env, currentGroupId, mentionRouting.mentionIds)
        : mentionRouting.mentionIds;
      const replyPlan = buildReplyPlan({
        isGroup, isAutoInterject, botMentioned, quotedMessageId, messageId: replyMessageId,
        userId, selfId: botId, selectedMentionIds: safeMentionIds, senderDnd: senderDndCheck,
        text: visibleReplyText
      });
      const typingDelayMs = await waitForSocialTyping({
        text: visibleReplyText,
        decision: socialDecision,
        isGroup,
        direct: !isAutoInterject
      });
      if (request.signal?.aborted) {
        await clearThinkingIndicator();
        return new Response(null, { status: 204 });
      }
      const aiDecision = await writeAiDecisionLog(env, {
        ...aiDecisionBase,
        decision: "reply_generated",
        reason: isAutoInterject ? "auto_interject_accepted" : "direct_trigger",
        triggerType,
        interjectChance,
        interjectJudgement,
        lowContextFragment,
        socialSceneType: socialDecision.sceneType,
        socialAction: socialDecision.action,
        socialOutputType: socialDecision.outputType,
        socialConfidence: Number(socialDecision.confidence || 0),
        socialReason: String(socialDecision.reason || ""),
        typingDelayMs,
        provider: usedProvider,
        model: usedModel,
        generatedReply: visibleReplyText,
        replyPlan,
        mentionRouting,
        searchRequired: searchInfo.required,
        searchAttempted: searchInfo.attempted,
        searchPerformed: searchInfo.performed,
        searchQuery: searchInfo.query,
        searchContext: searchInfo.context,
        searchSources: searchInfo.sources,
        searchQueries: searchInfo.queries,
        searchProvider: searchInfo.provider,
        searchModel: searchInfo.model,
        searchError: searchInfo.error,
        contextMessageCount: groupConversationLogs.length,
        directHistoryItems: history.length,
        contextSummaryProvider: longGroupContext?.summaryProvider || "",
        contextExactMessages: longGroupContext?.exactCount || 0,
        contextSummarizedMessages: longGroupContext?.summarizedCount || 0,
        sendStatus: "pending"
      });
      const thinkingMessageIdForReply = activeThinkingMessageId;
      activeThinkingMessageId = null;
      const replyChunks = splitOutboundText(visibleReplyText, { maxChars: DEFAULTS.outboundChunkChars, maxParts: DEFAULTS.outboundMaxParts, hardTotalChars: DEFAULTS.replyHardChars });
      return new Response(JSON.stringify({ reply: toSimplifiedChinese(replyChunks[0] || visibleReplyText), reply_chunks: replyChunks.map(toSimplifiedChinese), reply_plan: replyPlan, thinking_message_id: thinkingMessageIdForReply || null, record_reply: true, reply_kind: "conversation", ai_log_id: aiDecision.id }), {
        status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' }
      });

    } catch (err) {
      // 兜底全域崩溃防护，确保 Worker 绝对不会死机
      console.error("全局严重错误:", err);
      await clearThinkingIndicator();
      ctx.waitUntil(writeSystemError(env, err, { url: request.url }));
      const classified = classifyOperationalFailure(err, { disposition: "uncaught_error" });
      const fallbackText = body?.message_type === "group"
        ? `[CQ:at,qq=${String(body?.user_id || "")}] ${classified.userText}`
        : classified.userText;
      return new Response(JSON.stringify({ reply: toSimplifiedChinese(fallbackText), record_reply: false, reply_kind: "system_error" }), {
        status: 200,
        headers: { "Content-Type": "application/json; charset=utf-8" }
      });
    }
  }, // 结束 fetch 函式

  async scheduled(controller, env, ctx) {
    env = await portalEnvironmentWithManagedDeveloperIds(env);
    ctx.waitUntil(dbPut(env, "system:last_cron", String(Number(controller?.scheduledTime || Date.now()))));
    ctx.waitUntil(announceDeployedVersionFallback(env).catch(error => console.error("deployment self-fallback failed", error)));
    ctx.waitUntil(processDueSchedules(env, Number(controller?.scheduledTime || Date.now())));
    ctx.waitUntil(cleanupTransientState(env));
    ctx.waitUntil(cleanupExpiredModerationProposals(env));
    ctx.waitUntil(runAutomaticGroupCheckins(env, Number(controller?.scheduledTime || Date.now())));
    ctx.waitUntil(processPlatformJobs(env, Number(controller?.scheduledTime || Date.now())));
    ctx.waitUntil(processWerewolfTimers(env, Number(controller?.scheduledTime || Date.now())).catch(error => console.error("werewolf timer failed", error)));
    ctx.waitUntil(opsProcessAutomations(env, Number(controller?.scheduledTime || Date.now())));
    ctx.waitUntil(pollAutomaticBilibiliConnectors(env, Number(controller?.scheduledTime || Date.now())));
  },

  async queue(batch, env, ctx) {
    await handleDeploymentBuildQueue(batch, env);
  }
};

 // 结束 QQAIWorker

export default QQAIWorker;



export class OneBotHub {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.activeSocket = null;
    this.connectionId = "";
    this.connectedAt = null;
    this.lastHeartbeatAt = null;
    this.socketDiagnostics = { reconnectCount: 0, closeCount: 0, errorCount: 0, history: [] };
    this.pending = new Map();
    this.eventTasks = new Set();
    this.toolInFlight = new Map();
    this.toolCounts = new Map();
    this.userInFlight = new Map();
    this.userQueues = new Map();
    this.inputBuffers = new Map();
    this.queueSchedulerRunning = false;
    this.explicitReplyFailureNotified = new Set();

    // 使用 Durable Objects WebSocket Hibernation API 后，Object 可被回收并重建，
    // 但 NapCat 的 WebSocket 仍保持连接。构造时必须从 state 重新取得现有连接。
    this.restoreActiveSocket();

    this.queueReady = Promise.resolve();
    if (state?.storage && typeof state.blockConcurrencyWhile === "function") {
      this.queueReady = state.blockConcurrencyWhile(async () => {
        const [saved, savedInFlight, diagnostics] = await Promise.all([
          state.storage.list({ prefix: "userqueue:" }),
          state.storage.list({ prefix: "question-inflight:" }),
          state.storage.get("napcat:socket-diagnostics")
        ]);
        if (diagnostics && typeof diagnostics === "object") this.socketDiagnostics = { ...this.socketDiagnostics, ...diagnostics };
        for (const [storageKey, value] of saved) {
          const queue = Array.isArray(value) ? value.filter(item => item?.body && Date.now() - Number(item?.enqueuedAt || 0) <= DEFAULTS.userQueueTtlMs) : [];
          await state.storage.delete(storageKey);
          for (const entry of queue) {
            const key = this.userQueueKey(entry.body);
            const merged = [...(this.userQueues.get(key) || []), entry]
              .sort((a, b) => Number(a?.enqueuedAt || 0) - Number(b?.enqueuedAt || 0))
              .slice(0, DEFAULTS.userQueueMax);
            this.userQueues.set(key, merged);
            await state.storage.put(`userqueue:${key}`, merged);
          }
        }
        // 若实例在处理中被部署、重启或异常回收，把未完成问题放回该发言者的队首。
        for (const [storageKey, value] of savedInFlight) {
          const age = Date.now() - Number(value?.startedAt || value?.enqueuedAt || 0);
          if (value?.body && age <= DEFAULTS.userQueueTtlMs) {
            const key = this.userQueueKey(value.body);
            const recovered = {
              body: value.body,
              requestUrl: value.requestUrl || "https://onebot-hub/onebot",
              enqueuedAt: Number(value.enqueuedAt || value.startedAt || Date.now()),
              preview: value.preview || this.eventPreview(value.body),
              recovered: true
            };
            const merged = [recovered, ...(this.userQueues.get(key) || [])]
              .sort((a, b) => Number(a?.enqueuedAt || 0) - Number(b?.enqueuedAt || 0))
              .slice(0, DEFAULTS.userQueueMax);
            this.userQueues.set(key, merged);
            await state.storage.put(`userqueue:${key}`, merged);
          }
          await state.storage.delete(storageKey);
        }
        this.restoreActiveSocket();
      });
    }
  }

  socketAttachment(socket) {
    try { return socket?.deserializeAttachment?.() || {}; } catch { return {}; }
  }

  restoreActiveSocket() {
    if (this.activeSocket?.readyState === WebSocket.OPEN) return this.activeSocket;
    if (!this.state || typeof this.state.getWebSockets !== "function") return null;
    let sockets = [];
    try { sockets = this.state.getWebSockets("napcat") || []; } catch { sockets = []; }
    const openSockets = sockets.filter(ws => ws?.readyState === WebSocket.OPEN);
    openSockets.sort((a, b) => Number(this.socketAttachment(b).connectedAt || 0) - Number(this.socketAttachment(a).connectedAt || 0));
    this.activeSocket = openSockets[0] || null;
    if (this.activeSocket) {
      const meta = this.socketAttachment(this.activeSocket);
      this.connectionId = String(meta.connectionId || "");
      this.connectedAt = Number(meta.connectedAt || this.connectedAt || Date.now());
      this.lastHeartbeatAt = Number(meta.lastHeartbeatAt || meta.lastEventAt || this.lastHeartbeatAt || this.connectedAt);
    }
    return this.activeSocket;
  }

  async isIgnoredRobotSender(body, { probe = false } = {}) {
    const knownIgnored = await isIgnoredGroupRobotSender(this.env, body, { probe: false });
    if (knownIgnored || !probe) return knownIgnored;
    const groupId = String(body?.group_id || "");
    const userId = String(body?.user_id || "");
    if (!groupId || !userId || userId === String(body?.self_id || "")) return false;
    if (await isGroupRobotInteractionAllowed(this.env, groupId, userId)) return false;
    try {
      const response = await this.sendAction({
        action: "get_group_member_info",
        params: { group_id: numericId(groupId), user_id: numericId(userId), no_cache: false }
      }, 5000);
      const member = response?.data && typeof response.data === "object" ? response.data : response;
      const robot = qqaiTruthyRobotFlag(member?.is_robot) || qqaiTruthyRobotFlag(member?.isRobot) || looksLikeRobotDisplayName(member?.card || member?.nickname || eventSenderDisplayName(body));
      await cacheBotSenderClassification(this.env, groupId, userId, robot, "durable_object_member_probe").catch(() => {});
      if (robot) {
        await upsertGroupMember(this.env, groupId, {
          qq: userId,
          name: String(member?.card || member?.nickname || eventSenderDisplayName(body) || userId),
          role: String(member?.role || body?.sender?.role || "member"),
          isRobot: true,
          groupName: String(body?.group_name || groupId)
        }).catch(() => {});
      }
      return robot;
    } catch {
      await cacheBotSenderClassification(this.env, groupId, userId, false, "durable_object_probe_unavailable").catch(() => {});
      return false;
    }
  }

  async recordSocketDiagnostic(type, detail = {}) {
    const now = Date.now();
    const current = this.socketDiagnostics && typeof this.socketDiagnostics === "object"
      ? { ...this.socketDiagnostics }
      : { reconnectCount: 0, closeCount: 0, errorCount: 0, history: [] };
    if (type === "connected") current.reconnectCount = Number(current.reconnectCount || 0) + 1;
    if (type === "closed") current.closeCount = Number(current.closeCount || 0) + 1;
    if (type === "error") current.errorCount = Number(current.errorCount || 0) + 1;
    const event = { type, at: now, connectionId: String(detail.connectionId || this.connectionId || ""), ...detail };
    current.lastEvent = event;
    if (type === "closed") current.lastClose = event;
    if (type === "error") current.lastError = event;
    current.history = [...(Array.isArray(current.history) ? current.history : []), event].slice(-20);
    this.socketDiagnostics = current;
    if (this.state?.storage) await this.state.storage.put("napcat:socket-diagnostics", current);
  }

  trackEventTask(task) {
    this.eventTasks.add(task);
    task.finally(() => this.eventTasks.delete(task));
    if (typeof this.state?.waitUntil === "function") this.state.waitUntil(task);
    return task;
  }

  async fetch(request) {
    await this.queueReady;
    const url = new URL(request.url);
    const upgrade = request.headers.get("Upgrade");
    if (upgrade && upgrade.toLowerCase() === "websocket") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      const now = Date.now();
      const connectionId = crypto.randomUUID();
      const previousSockets = typeof this.state?.getWebSockets === "function"
        ? (this.state.getWebSockets("napcat") || []).filter(ws => ws?.readyState === WebSocket.OPEN)
        : (this.activeSocket?.readyState === WebSocket.OPEN ? [this.activeSocket] : []);

      // 不再使用 server.accept()。Hibernation API 可让 Durable Object 回收内存时仍保留连接。
      this.state.acceptWebSocket(server, ["napcat"]);
      server.serializeAttachment({
        type: "napcat",
        connectionId,
        connectedAt: now,
        lastHeartbeatAt: now,
        lastEventAt: now,
        requestUrl: request.url
      });
      this.activeSocket = server;
      this.connectionId = connectionId;
      this.connectedAt = now;
      this.lastHeartbeatAt = now;

      // 先登记新连接，再关闭旧连接，避免旧连接的 close 事件清掉新连接上的 RPC。
      await this.recordSocketDiagnostic("connected", { connectionId, replacedConnections: previousSockets.length });
      for (const oldSocket of previousSockets) {
        if (oldSocket === server) continue;
        try { oldSocket.close(4001, "replaced by newer NapCat connection"); } catch {}
      }

      this.trackEventTask(this.kickQueueScheduler().catch(error => console.error("restore queued questions failed", error)));
      return new Response(null, { status: 101, webSocket: client });
    }

    if (request.method === "POST" && ["/rpc", "/send"].includes(url.pathname)) {
      const payload = await request.json().catch(() => null);
      if (!payload?.action) return Response.json({ ok: false, sent: false, error: "invalid_payload" }, { status: 400 });
      try {
        const response = await this.sendAction(payload, Number(payload.timeoutMs || 15000));
        const ok = response?.status === "ok" || response?.retcode === 0;
        return Response.json({ ok, sent: true, data: response?.data ?? null, response, error: ok ? null : response?.message || `retcode:${response?.retcode}` }, { status: ok ? 200 : 502 });
      } catch (error) {
        return Response.json({ ok: false, sent: false, error: String(error.message || error) }, { status: 503 });
      }
    }

    if (request.method === "POST" && url.pathname === "/moderation/expiry") {
      const data = await request.json().catch(() => ({}));
      const proposalId = String(data.proposalId || "");
      const expiresAt = Number(data.expiresAt || 0);
      if (!proposalId || !expiresAt) return Response.json({ ok: false, message: "invalid expiry payload" }, { status: 400 });
      await this.state.storage.put(`moderation-expiry:${proposalId}`, { proposalId, expiresAt });
      const currentAlarm = await this.state.storage.getAlarm();
      if (!currentAlarm || expiresAt < currentAlarm) await this.state.storage.setAlarm(expiresAt);
      return Response.json({ ok: true, proposalId, expiresAt });
    }

    if (url.pathname === "/status") {
      const socket = this.restoreActiveSocket();
      if (socket?.readyState === WebSocket.OPEN) await this.kickQueueScheduler();
      const now = Date.now();
      const heartbeatAgeMs = this.lastHeartbeatAt ? Math.max(0, now - Number(this.lastHeartbeatAt)) : null;
      const ingressStored = await this.state.storage.list({ prefix: "ingress:" });
      const recentGroupIngress = [...ingressStored.values()].filter(Boolean).sort((a, b) => Number(b.lastUpdatedAt || 0) - Number(a.lastUpdatedAt || 0)).slice(0, 20);
      return Response.json({
        sockets: socket?.readyState === WebSocket.OPEN ? 1 : 0,
        connected: socket?.readyState === WebSocket.OPEN,
        transportMode: "durable_object_hibernation",
        connectionId: this.connectionId || null,
        connectedAt: this.connectedAt,
        lastHeartbeatAt: this.lastHeartbeatAt,
        heartbeatAgeMs,
        pendingRpc: this.pending.size,
        inFlightQuestions: this.userInFlight.size,
        queuedQuestions: [...this.userQueues.values()].reduce((sum, list) => sum + list.length, 0),
        bufferedQuestions: this.inputBuffers.size,
        inputDebounceMs: DEFAULTS.inputDebounceMs,
        queuePolicy: "per_user_single_inflight_group_unlimited_cancel_and_merge",
        schedulerRunning: this.queueSchedulerRunning,
        reconnectCount: Number(this.socketDiagnostics?.reconnectCount || 0),
        closeCount: Number(this.socketDiagnostics?.closeCount || 0),
        errorCount: Number(this.socketDiagnostics?.errorCount || 0),
        lastClose: this.socketDiagnostics?.lastClose || null,
        lastSocketError: this.socketDiagnostics?.lastError || null,
        recentSocketEvents: Array.isArray(this.socketDiagnostics?.history) ? this.socketDiagnostics.history.slice(-8) : [],
        recentGroupIngress,
        queues: this.queueSnapshot()
      });
    }
    if (request.method === "POST" && url.pathname === "/queue/cancel") {
      const data = await request.json().catch(() => ({}));
      const groupId = String(data.groupId || "");
      const userId = String(data.userId || "");
      const messageId = String(data.messageId || "");
      const keys = [...new Set([`group:${groupId}`, `group:${groupId}:user:${userId}`])];
      let removed = 0, remaining = 0;
      for (const key of keys) {
        const queue = this.userQueues.get(key) || [];
        const next = queue.filter(item => {
          if (messageId) return String(item.body?.message_id || "") !== messageId;
          if (userId) return String(item.body?.user_id || "") !== userId;
          return false;
        });
        removed += queue.length - next.length;
        remaining += next.length;
        if (next.length) this.userQueues.set(key, next); else this.userQueues.delete(key);
        await this.persistUserQueue(key);
      }
      return Response.json({ ok: true, removed, remaining, message: `已移除 ${removed} 条等待中的问题。` });
    }
    if (request.method === "POST" && url.pathname === "/queue/clear") {
      const data = await request.json().catch(() => ({}));
      const groupId = String(data.groupId || "");
      let removed = 0;
      const clearedKeys = [];
      for (const [key, queue] of this.userQueues) {
        if (!groupId || key.startsWith(`group:${groupId}:`)) { removed += queue.length; this.userQueues.delete(key); clearedKeys.push(key); }
      }
      await Promise.all(clearedKeys.map(key => this.persistUserQueue(key)));
      return Response.json({ ok: true, removed, message: `已清除 ${removed} 条等待中的问题。` });
    }
    return new Response("OneBotHub OK", { status: 200 });
  }

  async webSocketMessage(socket, message) {
    const now = Date.now();
    const meta = this.socketAttachment(socket);
    meta.connectionId = String(meta.connectionId || this.connectionId || crypto.randomUUID());
    meta.connectedAt = Number(meta.connectedAt || this.connectedAt || now);
    meta.lastHeartbeatAt = now;
    meta.lastEventAt = now;
    meta.requestUrl = String(meta.requestUrl || "https://onebot-hub/onebot");
    try { socket.serializeAttachment(meta); } catch {}
    if (!this.activeSocket || this.activeSocket.readyState !== WebSocket.OPEN || String(this.socketAttachment(this.activeSocket).connectionId || "") === meta.connectionId) {
      this.activeSocket = socket;
      this.connectionId = meta.connectionId;
      this.connectedAt = meta.connectedAt;
    }
    this.lastHeartbeatAt = now;
    this.trackEventTask(this.kickQueueScheduler().catch(error => console.error("queue recovery wake failed", error)));
    const task = this.handleMessage(socket, { url: meta.requestUrl }, { data: message })
      .catch(error => console.error("OneBotHub hibernation handler failed", error));
    this.trackEventTask(task);
  }

  async webSocketClose(socket, code, reason, wasClean) {
    const meta = this.socketAttachment(socket);
    const connectionId = String(meta.connectionId || "");
    const isActive = this.activeSocket === socket || (connectionId && connectionId === this.connectionId);
    if (isActive) {
      this.activeSocket = null;
      this.connectionId = "";
      this.rejectAll(`NapCat disconnected (${code || 1006})`);
    }
    await this.recordSocketDiagnostic("closed", {
      connectionId,
      code: Number(code || 0),
      reason: String(reason || ""),
      wasClean: Boolean(wasClean),
      wasActiveConnection: isActive
    });
    try { if (socket.readyState !== WebSocket.CLOSED) socket.close(code || 1000, String(reason || "closed").slice(0, 120)); } catch {}
  }

  async webSocketError(socket, error) {
    const meta = this.socketAttachment(socket);
    const connectionId = String(meta.connectionId || "");
    const isActive = this.activeSocket === socket || (connectionId && connectionId === this.connectionId);
    if (isActive) {
      this.activeSocket = null;
      this.connectionId = "";
      this.rejectAll("NapCat socket error");
    }
    await this.recordSocketDiagnostic("error", {
      connectionId,
      message: String(error?.message || error || "unknown websocket error"),
      wasActiveConnection: isActive
    });
  }

  async alarm() {
    const now = Date.now();
    const rows = await this.state.storage.list({ prefix: "moderation-expiry:" });
    let nextAlarm = 0;
    for (const [storageKey, item] of rows) {
      const expiresAt = Number(item?.expiresAt || 0);
      if (expiresAt > now) {
        nextAlarm = nextAlarm ? Math.min(nextAlarm, expiresAt) : expiresAt;
        continue;
      }
      const proposalId = String(item?.proposalId || storageKey.slice("moderation-expiry:".length));
      const proposal = await readJson(this.env, `moderation:proposal:${proposalId}`, null);
      if (proposal?.status === "pending") {
        proposal.status = "expired";
        proposal.expiredAt = now;
        if (proposal.notificationMessageId && !proposal.notificationRetractedAt) {
          try {
            await this.sendAction({ action: "delete_msg", params: { message_id: numericId(proposal.notificationMessageId) } }, 10000);
            proposal.notificationRetractedAt = now;
            proposal.notificationRetractReason = "expired";
            proposal.notificationRetractStatus = "success";
          } catch (error) {
            proposal.notificationRetractStatus = "failed";
            proposal.notificationRetractError = String(error?.message || error);
          }
        }
        await dbPut(this.env, `moderation:proposal:${proposalId}`, JSON.stringify(proposal));
      }
      await this.state.storage.delete(storageKey);
    }
    await this.kickQueueScheduler().catch(error => console.error("queue alarm recovery failed", error));
    const hasQueued = [...this.userQueues.values()].some(queue => queue?.length);
    const queueAlarm = hasQueued ? Date.now() + DEFAULTS.queueRecoveryAlarmMs : 0;
    const targetAlarm = nextAlarm && queueAlarm ? Math.min(nextAlarm, queueAlarm) : (nextAlarm || queueAlarm);
    if (targetAlarm) await this.state.storage.setAlarm(targetAlarm);
  }

  rejectAll(reason) {
    for (const [, p] of this.pending) { clearTimeout(p.timer); p.reject(new Error(reason)); }
    this.pending.clear();
  }

  async sendAction(payload, timeoutMs = 15000) {
    const socket = this.restoreActiveSocket();
    if (!socket || socket.readyState !== WebSocket.OPEN) throw new Error("NAPCAT_NOT_CONNECTED");
    const echo = String(payload.echo || `qqai:rpc:${Date.now()}:${crypto.randomUUID()}`);
    const action = { action: payload.action, params: payload.params || {}, echo };
    if (["send_group_msg", "send_private_msg", "send_msg"].includes(action.action)) {
      const isGroup = action.action === "send_group_msg" || action.params.message_type === "group";
      await markOutboundPending(this.env, { isGroup, groupId: isGroup ? String(action.params.group_id || "") : "", peerId: isGroup ? "" : String(action.params.user_id || ""), text: extractMessageText(action.params.message), mediaTypes: extractOutboundMediaTypes(action.params.message) });
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(echo); reject(new Error("ONEBOT_RPC_TIMEOUT")); }, Math.max(1000, Math.min(timeoutMs, 30000)));
      this.pending.set(echo, { resolve, reject, timer, action });
      try { socket.send(JSON.stringify(action)); } catch (error) {
        clearTimeout(timer);
        this.pending.delete(echo);
        if (this.activeSocket === socket) this.activeSocket = null;
        const diagnosticTask = this.recordSocketDiagnostic("error", { connectionId: this.connectionId, message: `send failed: ${String(error?.message || error)}`, wasActiveConnection: true });
        if (typeof this.state?.waitUntil === "function") this.state.waitUntil(diagnosticTask);
        reject(error);
      }
    });
  }

  async handleMessage(socket, request, event) {
    let body;
    try { body = JSON.parse(typeof event.data === "string" ? event.data : new TextDecoder().decode(event.data)); } catch { return; }
    const now = Date.now();
    this.lastHeartbeatAt = now;
    const meta = this.socketAttachment(socket);
    if (meta && typeof socket?.serializeAttachment === "function") {
      meta.lastHeartbeatAt = now;
      meta.lastEventAt = now;
      try { socket.serializeAttachment(meta); } catch {}
    }
    if (body?.echo && this.pending.has(String(body.echo))) {
      const pending = this.pending.get(String(body.echo)); this.pending.delete(String(body.echo)); clearTimeout(pending.timer);
      const messageId = body?.data?.message_id ?? body?.data?.messageId;
      if (messageId && ["send_group_msg", "send_private_msg", "send_msg"].includes(pending.action.action)) {
        await dbPut(this.env, `outbound:${messageId}`, JSON.stringify({ at: Date.now(), action: pending.action.action }));
      }
      pending.resolve(body); return;
    }
    if (!body) return;

    // NapCat may report one API send as both message_sent and message. Reject every event
    // proven to be our own outbound before games, queues or Worker processing can see it.
    const inboundPostType = String(body.post_type || "");
    const inboundSelfId = String(body.self_id || "");
    const inboundUserId = String(body.user_id || "");
    const selfMessageEvent = ["message", "message_sent"].includes(inboundPostType)
      && (inboundPostType === "message_sent" || Boolean(inboundSelfId && inboundUserId === inboundSelfId));
    if (selfMessageEvent) {
      const outboundEcho = await isKnownOutboundMessage(this.env, {
        messageId: String(body.message_id || ""),
        isGroup: body.message_type === "group",
        groupId: body.message_type === "group" ? String(body.group_id || "") : "",
        peerId: body.message_type === "group" ? "" : String(body.target_id || body.peer_id || body.user_id || body.self_id || ""),
        text: extractMessageText(body.message || body.raw_message || ""),
        mediaTypes: extractOutboundMediaTypes(body.message || body.raw_message || "")
      });
      if (outboundEcho) {
        await this.recordIngress(body, "self_outbound_echo_ignored", {
          explicit: eventHasBotMention(body),
          force: true,
          postType: inboundPostType
        }).catch(() => {});
        return;
      }
    }

    const werewolfHandled = await handleWerewolfOneBotEvent(this.env, body).catch(async error => {
      await writeSystemAudit(this.env, { type: "werewolf_event_failed", groupId: String(body?.group_id || ""), actorId: String(body?.user_id || ""), action: "handle_event", error: String(error?.message || error).slice(0, 500) }).catch(() => {});
      return null;
    });
    if (werewolfHandled?.handled) return;
    if (this.isRuleMuteLiftNotice(body)) {
      await this.handleRuleMuteLiftNotice(body);
      return;
    }
    if (this.isQuestionRecallNotice(body)) {
      await this.handleQuestionRecall(body, request.url);
      return;
    }
    if (this.isBotPokeNotice(body)) {
      await this.flushBufferedQuestion(this.userQueueKey({ message_type: "group", group_id: body.group_id, user_id: body.user_id }), "poke");
      return;
    }
    if (body.post_type === "meta_event") return;
    if (body.post_type === "message" && body.message_type === "group") {
      const ignoredRobotSender = await this.isIgnoredRobotSender(body, { probe: eventHasBotMention(body) });
      if (ignoredRobotSender) {
        await auditIgnoredRobotMessage(this.env, body, "durable_object_ingress_guard").catch(() => {});
        await this.recordIngress(body, "bot_sender_ignored", { explicit: eventHasBotMention(body), force: true, senderName: eventSenderDisplayName(body) }).catch(() => {});
        return;
      }
    }

    if (body.post_type === "message" && body.message_type === "group" && eventHasBotMention(body) && oneBotBotMentionCount(body) > 1 && (!eventPlainText(body).trim() || oneBotEventIsPunctuationOnly(body))) {
      await this.recordIngress(body, "duplicate_mention_noise", { explicit: false, force: true, botMentionCount: oneBotBotMentionCount(body) }).catch(() => {});
      return;
    }

    const answerNowKey = this.answerNowKey(body);
    if (answerNowKey && this.inputBuffers.has(answerNowKey)) {
      await this.flushBufferedQuestion(answerNowKey, "answer_now");
      return;
    }

    const continuationKey = this.questionContinuationKey(body);
    if (continuationKey) {
      await this.receiveUserQuestion(body, request.url);
      return;
    }

    const explicitGroupQuestion = await this.shouldQueueUserQuestion(body);
    await this.recordIngress(body, "received", { explicit: explicitGroupQuestion }).catch(() => {});
    if (explicitGroupQuestion) {
      await this.receiveUserQuestion(body, request.url);
      return;
    }
    if (body.post_type === "message" && body.message_type === "group" && eventHasBotMention(body)) {
      const groupId = String(body.group_id || "");
      const text = eventPlainText(body).trim();
      if (groupId && await dbGet(this.env, `ai_off:${groupId}`) === "true" && !/^[!！]/.test(text)) {
        await this.recordIngress(body, "ai_disabled", { explicit: true, force: true }).catch(() => {});
        return;
      }
    }
    // 普通群消息仍会写入对话记录并执行必要的本地逻辑，但当已有明确 @ 提问正在生成时，
    // 暂停随机插话与冲突 AI 判断，避免活跃群抢占其他群的模型请求。
    if (body.post_type === "message" && body.message_type === "group" && this.userInFlight.size > 0) {
      body = { ...body, __qqai_suppress_optional_ai: true };
    }
    await this.processInboundEvent(body, request.url);
  }

  explicitReplyQuestionId(body) {
    return [
      String(body?.message_type || ""),
      String(body?.group_id || ""),
      String(body?.user_id || ""),
      String(body?.message_id || "")
    ].join(":");
  }

  async sendImmediateThinkingIndicator(body, options = {}) {
    if (body?.post_type !== "message" || body?.message_type !== "group") return "";
    if (!eventHasBotMention(body)) return "";
    const groupId = String(body.group_id || "");
    if (!groupId || !(await isGroupWhitelisted(this.env, groupId))) return "";
    const indicatorSetting = await dbGet(this.env, `social_thinking_indicator_enabled:${groupId}`);
    if (indicatorSetting === "false" || (!options.allowDefault && indicatorSetting !== "true")) return "";
    if (oneBotEventIsPunctuationOnly(body)) return "";
    if (await dbGet(this.env, `ai_off:${groupId}`) === "true") return "";
    const text = eventPlainText(body);
    if (!text || /^(?:[!！]|\/!)/.test(text)) return "";

    const message = [];
    if (body.message_id !== undefined && body.message_id !== null) {
      message.push({ type: "reply", data: { id: String(body.message_id) } });
    }
    if (body.user_id !== undefined && body.user_id !== null) {
      message.push({ type: "at", data: { qq: String(body.user_id) } });
      message.push({ type: "text", data: { text: " " } });
    }
    message.push({ type: "text", data: { text: "正在思考..." } });

    const response = await this.sendAction({
      action: "send_group_msg",
      params: { group_id: body.group_id, message, auto_escape: false }
    }, 10000);
    const messageId = String(
      response?.message_id ??
      response?.messageId ??
      response?.data?.message_id ??
      response?.data?.messageId ??
      ""
    );
    if (messageId) {
      await registerThinkingIndicator(this.env, {
        isGroup: true,
        groupId: String(body.group_id || ""),
        userId: String(body.user_id || "")
      }, messageId).catch(error => console.error("register immediate thinking indicator failed", error));
    }
    return messageId;
  }

  async notifyExplicitReplyFailureOnce(body, disposition, extra = {}) {
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
    const key = `${this.explicitReplyQuestionId(body)}:${String(disposition || "unknown")}`;
    if (this.explicitReplyFailureNotified.has(key)) return;

    const classified = classifyOperationalFailure(extra.error || extra.responsePreview || disposition, {
      disposition,
      status: extra.httpStatus,
      preview: extra.responsePreview,
      code: extra.errorCode,
      failureId: extra.failureId
    });
    let text = classified.userText;

    this.explicitReplyFailureNotified.add(key);
    if (this.explicitReplyFailureNotified.size > 300) this.explicitReplyFailureNotified.clear();
    await this.sendQueueNotice(body, text);
  }

  async recordIngress(body, disposition, extra = {}) {
    const groupId = String(body?.group_id || "");
    if (!groupId || !["message", "message_sent"].includes(String(body?.post_type || ""))) return;
    const explicit = Boolean(extra.explicit || body?.__qqai_explicit_question === true || eventHasBotMention(body) || /^[!！]/.test(eventPlainText(body)));
    if (!explicit && !extra.force) return;
    const key = `ingress:${groupId}`;
    const previous = await this.state.storage.get(key) || {};
    const next = {
      ...previous,
      groupId,
      receivedCount: Number(previous.receivedCount || 0) + (disposition === "received" ? 1 : 0),
      lastReceivedAt: disposition === "received" ? Date.now() : Number(previous.lastReceivedAt || Date.now()),
      lastUpdatedAt: Date.now(),
      lastDisposition: String(disposition || "unknown"),
      lastMessageId: String(body?.message_id || previous.lastMessageId || ""),
      lastUserId: String(body?.user_id || previous.lastUserId || ""),
      mentionDetected: eventHasBotMention(body),
      preview: eventPlainText(body).slice(0, 160),
      ...extra
    };
    await this.state.storage.put(key, next);
    if (["worker_error", "worker_http_error", "worker_timeout", "worker_empty_reply", "worker_no_reply", "send_failed"].includes(String(disposition))) {
      await this.notifyExplicitReplyFailureOnce(body, String(disposition), extra)
        .catch(error => console.error("explicit reply failure notice failed", error));
    }
  }

  isRuleMuteLiftNotice(body) {
    if (body?.post_type !== "notice" || String(body.notice_type || "") !== "group_ban") return false;
    const subType = String(body.sub_type || "").toLowerCase();
    return Boolean(body.group_id && body.user_id) && (subType === "lift_ban" || subType === "unban" || Number(body.duration || 0) === 0);
  }

  async handleRuleMuteLiftNotice(body) {
    const groupId = String(body.group_id || "");
    const userId = String(body.user_id || "");
    const operatorId = String(body.operator_id || "");
    const selfId = String(body.self_id || "");
    if (!groupId || !userId) return;

    const muteLock = await getMuteLock(this.env, groupId, userId);
    if (muteLock) {
      if (muteLock.source === "partner") {
        await clearMuteLock(this.env, groupId, userId);
        await writeSystemAudit(this.env, { type: "partner_mute_management_release", groupId, actorId: operatorId || "unknown", targetId: userId, action: "native_management_unmute" }).catch(() => {});
        return;
      }
      const now = Date.now();
      const remainingSeconds = muteLockRemainingSeconds(muteLock, now);
      if (remainingSeconds <= 0) { await clearMuteLock(this.env, groupId, userId); return; }
      const verifiedOwner = Boolean(muteLock.allowOwnerUnmute && operatorId)
        && await isVerifiedGroupOwner(this.env, groupId, operatorId).catch(() => false);
      const permission = canUnlockMute(this.env, muteLock, {
        actorId: operatorId,
        actorRole: verifiedOwner ? "owner" : ""
      });
      if (permission.allowed) {
        await clearMuteLock(this.env, groupId, userId);
        await writeSystemAudit(this.env, { type: "mute_lock_authorized_release", groupId, actorId: operatorId || "unknown", targetId: userId, action: permission.reason, source: muteLock.source }).catch(() => {});
        return;
      }
      if (now - Number(muteLock.lastReappliedAt || 0) < 5000) return;
      const botState = await getBotGroupRole(this.env, groupId).catch(() => ({ role: "unknown" }));
      if (!botCanRunRuleMonitor(botState)) {
        await writeSystemAudit(this.env, { type: "mute_lock_guard_skipped", groupId, actorId: operatorId || "unknown", targetId: userId, action: "bot_not_admin", source: muteLock.source, remainingSeconds }).catch(() => {});
        return;
      }
      const blocked = await markMuteUnlockBlocked(this.env, muteLock, operatorId);
      try {
        await this.sendAction({ action: "set_group_ban", params: { group_id: numericId(groupId), user_id: numericId(userId), duration: Math.max(1, Math.min(MUTE_LOCK_MAX_SECONDS, remainingSeconds)) } }, 15000);
        await markMuteLockReapplied(this.env, blocked.lock || muteLock);
        if (blocked.shouldNotify) {
          const message = [];
          if (operatorId && operatorId !== selfId) message.push({ type: "at", data: { qq: operatorId } }, { type: "text", data: { text: " " } });
          const text = muteLock.source === "self"
            ? `该成员处于自我禁言，已恢复剩余 ${remainingSeconds} 秒。只能本人私讯机器人发送「!解除禁言」静默解除；后续重复解除不再提示。`
            : `该禁言已启用防解除，已恢复剩余 ${remainingSeconds} 秒。${muteLock.allowOwnerUnmute ? "仅开发者或群主可解除" : "仅开发者可解除"}；后续重复解除不再提示。`;
          message.push({ type: "text", data: { text } });
          await this.sendAction({ action: "send_group_msg", params: { group_id: numericId(groupId), message, auto_escape: false } }, 15000).catch(() => null);
        }
        await writeSystemAudit(this.env, { type: "mute_lock_guard_reapplied", groupId, actorId: operatorId || "unknown", targetId: userId, action: "reapply_remaining_mute", source: muteLock.source, remainingSeconds, notified: blocked.shouldNotify });
      } catch (error) {
        await writeSystemAudit(this.env, { type: "mute_lock_guard_failed", groupId, actorId: operatorId || "unknown", targetId: userId, action: "reapply_failed", source: muteLock.source, remainingSeconds, error: String(error?.message || error) }).catch(() => {});
      }
      return;
    }

    const key = `rule_mute_enforcement:${groupId}:${userId}`;
    const enforcement = await readJson(this.env, key, null);
    if (!enforcement?.active) return;
    const now = Date.now();
    const remainingSeconds = Math.ceil((Number(enforcement.expiresAt || 0) - now) / 1000);
    if (remainingSeconds <= 0) { await dbDel(this.env, key); return; }
    // 合法误判复核会先删除 enforcement；若记录仍存在，即使解禁动作由 Bot 代执行，也要按剩余时间恢复。
    if (await dbGet(this.env, `rule_mute_guard_enabled:${groupId}`) === "false") return;
    const botState = await getBotGroupRole(this.env, groupId).catch(() => ({ role: "unknown" }));
    if (!botCanRunRuleMonitor(botState)) {
      await writeSystemAudit(this.env, { type: "rule_mute_guard_skipped", groupId, actorId: operatorId || "unknown", targetId: userId, action: "bot_not_admin", remainingSeconds, violationId: enforcement.violationId }).catch(() => {});
      return;
    }
    if (now - Number(enforcement.lastReappliedAt || 0) < 5000) return;
    const shouldNotify = !enforcement.guardNoticeSentAt;
    enforcement.lastReappliedAt = now;
    enforcement.lastUnmutedBy = operatorId;
    enforcement.lastRemainingSeconds = remainingSeconds;
    if (shouldNotify) enforcement.guardNoticeSentAt = now;
    await dbPut(this.env, key, JSON.stringify(enforcement));
    try {
      await this.sendAction({ action: "set_group_ban", params: { group_id: numericId(groupId), user_id: numericId(userId), duration: Math.max(1, Math.min(30 * 24 * 3600, remainingSeconds)) } }, 15000);
      const message = [];
      if (operatorId && operatorId !== selfId) message.push({ type: "at", data: { qq: operatorId } }, { type: "text", data: { text: " " } });
      message.push({ type: "text", data: { text: `检测到群规禁言被提前解除，已按剩余 ${remainingSeconds} 秒重新禁言 QQ:${userId}。若确认属于误判，请到 Portal 的历史违规记录复核，或发送「!无违规 @${userId} 补充说明」；目标和补充说明都必须填写。` } });
      if (shouldNotify) await this.sendAction({ action: "send_group_msg", params: { group_id: numericId(groupId), message, auto_escape: false } }, 15000).catch(() => null);
      await writeSystemAudit(this.env, { type: "rule_mute_guard_reapplied", groupId, actorId: operatorId || "unknown", targetId: userId, action: "reapply_remaining_mute", remainingSeconds, violationId: enforcement.violationId, notified: shouldNotify });
    } catch (error) {
      await writeSystemAudit(this.env, { type: "rule_mute_guard_failed", groupId, actorId: operatorId || "unknown", targetId: userId, action: "reapply_failed", remainingSeconds, violationId: enforcement.violationId, error: String(error?.message || error) }).catch(() => {});
    }
  }

  isQuestionRecallNotice(body) {
    return body?.post_type === "notice"
      && ["group_recall", "group_msg_delete", "message_recall"].includes(String(body.notice_type || ""))
      && Boolean(body.group_id && body.message_id);
  }

  isBotPokeNotice(body) {
    return body?.post_type === "notice"
      && String(body.notice_type || "") === "notify"
      && String(body.sub_type || "") === "poke"
      && String(body.target_id || "") === String(body.self_id || "")
      && Boolean(body.group_id && body.user_id);
  }

  answerNowKey(body) {
    if (body?.post_type !== "message" || body?.message_type !== "group") return "";
    const text = eventPlainText(body).replace(/@\d{5,}\s*/g, "").trim();
    if (!/^(?:回答吧|回答|可以回答了|开始回答|開始回答|说完了|說完了|好了)$/i.test(text)) return "";
    return this.userQueueKey(body);
  }

  questionContinuationKey(body) {
    if (body?.post_type !== "message" || body?.message_type !== "group") return "";
    if (String(body.user_id || "") === String(body.self_id || "")) return "";
    const text = eventPlainText(body).trim();
    const hasPayload = Boolean(text || oneBotEventHasMedia(body));
    if (!hasPayload || /^(?:[!！]|\/!)/.test(text)) return "";
    const key = this.userQueueKey(body);
    const selfId = String(body.self_id || "");
    const mentions = eventMentionedQqs(body).map(String).filter(Boolean);
    // @了其他成员时属于正常群聊，不得偷接到正在生成的问题中。
    if (mentions.some(id => id !== selfId)) return "";
    const buffered = this.inputBuffers.get(key);
    if (buffered && Date.now() - Number(buffered.lastAt || 0) <= DEFAULTS.inputDebounceMs + 800) return key;
    // 已进入模型生成后，只有再次明确 @机器人，才取消旧生成并重建；普通聊天不再误触。
    if (this.userInFlight.has(key) && eventHasBotMention(body)) return key;
    return "";
  }

  questionBodies(body) {
    const list = Array.isArray(body?.__qqai_source_bodies) ? body.__qqai_source_bodies : [body];
    return list.filter(Boolean).map(item => ({ ...item, __qqai_source_bodies: undefined }));
  }

  questionMessageIds(body) {
    return this.questionBodies(body).map(item => String(item?.message_id || "")).filter(Boolean);
  }

  mergeQuestionBodies(parts) {
    const clean = (parts || []).filter(Boolean);
    if (!clean.length) return null;
    const last = clean[clean.length - 1];
    const segments = [];
    clean.forEach((item, index) => {
      if (index) segments.push({ type: "text", data: { text: "\n" } });
      if (Array.isArray(item.message)) {
        for (const segment of item.message) segments.push(segment);
      } else {
        segments.push({ type: "text", data: { text: String(item.raw_message || item.message || "") } });
      }
    });
    return {
      ...last,
      message: segments,
      raw_message: clean.map(item => String(item.raw_message || extractMessageText(item.message || ""))).join("\n"),
      message_id: last.message_id,
      __qqai_source_message_ids: clean.map(item => String(item.message_id || "")).filter(Boolean),
      __qqai_source_bodies: clean
    };
  }

  uniqueQuestionBodies(parts) {
    const seen = new Set();
    const output = [];
    for (const part of parts || []) {
      if (!part) continue;
      const id = String(part.message_id || "");
      const key = id || `${String(part.time || "")}:${eventPlainText(part)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      output.push(part);
    }
    return output;
  }

  scheduleInputBuffer(key) {
    const entry = this.inputBuffers.get(key);
    if (!entry) return;
    const token = crypto.randomUUID();
    entry.token = token;
    const now = Date.now();
    const deadline = Number(entry.firstAt || now) + DEFAULTS.inputDebounceMaxMs;
    const delay = Math.max(0, Math.min(socialInputDelayMs(entry.parts), deadline - now));
    entry.fireAt = now + delay;
    this.inputBuffers.set(key, entry);
    this.trackEventTask((async () => {
      await new Promise(resolve => setTimeout(resolve, delay));
      const current = this.inputBuffers.get(key);
      if (!current || current.token !== token) return;
      await this.flushBufferedQuestion(key, "debounce");
    })().catch(error => console.error("input debounce failed", error)));
  }

  async bufferQuestionParts(key, parts, requestUrl, { notify = false } = {}) {
    const now = Date.now();
    const existing = this.inputBuffers.get(key);
    const mergedParts = this.uniqueQuestionBodies([...(existing?.parts || []), ...(parts || [])]);
    const entry = {
      key,
      parts: mergedParts,
      requestUrl: requestUrl || existing?.requestUrl || "https://onebot-hub/onebot",
      firstAt: Number(existing?.firstAt || now),
      lastAt: now,
      notified: Boolean(existing?.notified)
    };
    this.inputBuffers.set(key, entry);
    const latestPart = mergedParts[mergedParts.length - 1];
    const bufferNoticeEnabled = await shouldSendSocialBufferNotice(this.env, String(latestPart?.group_id || ""));
    if (notify && bufferNoticeEnabled && !entry.notified && mergedParts.length >= 2) {
      entry.notified = true;
      this.inputBuffers.set(key, entry);
      const latest = mergedParts[mergedParts.length - 1];
      await this.sendQueueNotice(latest, "检测到你正在连续补充内容，我会短暂等待。说完后可戳一戳我，或发送“回答吧”立即开始。")
        .catch(error => console.error("multi input notice failed", error));
    }
    this.scheduleInputBuffer(key);
  }

  async cancelActiveQuestion(key, reason) {
    const active = this.userInFlight.get(key);
    if (!active) return [];
    active.cancelled = true;
    active.cancelledReason = reason;
    try { active.controller?.abort(new DOMException(reason, "AbortError")); } catch { try { active.controller?.abort(); } catch {} }
    await this.retractRegisteredThinkingIndicators(active.body).catch(error => console.error("cancel thinking cleanup failed", error));
    await this.recordIngress(active.body, reason, { explicit: true, cancelled: true }).catch(() => {});
    return active.parts || this.questionBodies(active.body);
  }

  async receiveUserQuestion(body, requestUrl) {
    if (body?.message_type === "group") {
      const groupId = String(body.group_id || "");
      if (!groupId || !(await isGroupWhitelisted(this.env, groupId)) || await dbGet(this.env, `ai_off:${groupId}`) === "true") {
        await this.recordIngress(body, "ai_disabled", { explicit: true, force: true }).catch(() => {});
        return;
      }
    }
    const key = this.userQueueKey(body);
    const incoming = this.questionBodies(body);
    const activeParts = this.userInFlight.has(key) ? await this.cancelActiveQuestion(key, "cancelled_by_new_input") : [];
    const existingCount = Number(this.inputBuffers.get(key)?.parts?.length || 0);
    await this.bufferQuestionParts(key, [...activeParts, ...incoming], requestUrl, { notify: Boolean(activeParts.length || existingCount || incoming.length > 1) });
    await this.recordIngress(body, activeParts.length ? "restarted_after_new_input" : "buffered", { explicit: true, debounceMs: DEFAULTS.inputDebounceMs }).catch(() => {});
  }

  async flushBufferedQuestion(key, reason = "manual") {
    const entry = this.inputBuffers.get(key);
    if (!entry) return false;
    if (this.userInFlight.has(key)) {
      if (reason === "poke" || reason === "answer_now") {
        entry.forceImmediate = true;
        this.inputBuffers.set(key, entry);
      }
      return false;
    }
    this.inputBuffers.delete(key);
    const body = this.mergeQuestionBodies(entry.parts);
    if (!body) return false;
    await this.recordIngress(body, "debounce_complete", { explicit: true, reason, mergedMessages: entry.parts.length }).catch(() => {});
    this.trackEventTask(this.runQuestion(key, body, entry.requestUrl, { enqueuedAt: entry.firstAt, preview: this.eventPreview(body) }));
    return true;
  }

  async handleQuestionRecall(body, requestUrl) {
    const groupId = String(body.group_id || "");
    const userId = String(body.user_id || "");
    const messageId = String(body.message_id || "");
    if (!groupId || !userId || !messageId) return;
    const key = this.userQueueKey({ message_type: "group", group_id: groupId, user_id: userId });
    const buffered = this.inputBuffers.get(key);
    if (buffered) {
      buffered.parts = buffered.parts.filter(part => String(part.message_id || "") !== messageId);
      if (buffered.parts.length) {
        buffered.firstAt = Date.now();
        buffered.lastAt = Date.now();
        this.inputBuffers.set(key, buffered);
        this.scheduleInputBuffer(key);
      } else {
        this.inputBuffers.delete(key);
      }
    }
    const active = this.userInFlight.get(key);
    if (active && (active.parts || this.questionBodies(active.body)).some(part => String(part.message_id || "") === messageId)) {
      const remaining = (active.parts || this.questionBodies(active.body)).filter(part => String(part.message_id || "") !== messageId);
      await this.cancelActiveQuestion(key, String(body.operator_id || "") === userId ? "cancelled_by_author_recall" : "cancelled_by_moderator_recall");
      if (remaining.length) await this.bufferQuestionParts(key, remaining, requestUrl, { notify: false });
    }
    const queue = this.userQueues.get(key) || [];
    const next = queue.filter(item => !this.questionMessageIds(item.body).includes(messageId));
    if (next.length) this.userQueues.set(key, next); else this.userQueues.delete(key);
    await this.persistUserQueue(key);
    await writeSystemAudit(this.env, {
      type: "question_cancelled_by_recall",
      groupId,
      actorId: String(body.operator_id || userId),
      targetId: userId,
      action: String(body.operator_id || "") === userId ? "author_recall" : "moderator_recall",
      messageId
    }).catch(() => {});
  }

  async shouldQueueUserQuestion(body) {
    if (!body || body.post_type !== "message" || body.message_type !== "group") return false;
    if (String(body.user_id || "") === String(body.self_id || "")) return false;
    const groupId = String(body.group_id || "");
    if (!groupId || !(await isGroupWhitelisted(this.env, groupId))) return false;
    if (await dbGet(this.env, `ai_off:${groupId}`) === "true") return false;
    const mentioned = eventHasBotMention(body);
    const text = eventPlainText(body);
    const hasPayload = Boolean(text || oneBotEventHasMedia(body) || oneBotEventIsBareMention(body));
    if (oneBotBotMentionCount(body) > 1 && (!text || oneBotEventIsPunctuationOnly(body))) return false;
    if (!mentioned || !hasPayload || /^(?:[!！]|\/!)/.test(text)) return false;
    return true;
  }

  userQueueKey(body) {
    // 只锁定同一位发言者：同群不同成员可同时处理，不设置每群或全局聊天并发上限。
    const userId = String(body?.user_id || body?.self_id || "");
    return body?.message_type === "group"
      ? `group:${String(body.group_id || "")}:user:${userId}`
      : `private:user:${userId}`;
  }

  queueSnapshot() {
    const rows = [];
    for (const [key, active] of this.userInFlight) {
      const queue = this.userQueues.get(key) || [];
      rows.push({ key, groupId: active.groupId, userId: active.userId, startedAt: active.startedAt, messageId: active.messageId, preview: active.preview, queued: queue.map(item => ({ userId: String(item.body?.user_id || ""), messageId: String(item.body?.message_id || ""), enqueuedAt: item.enqueuedAt, preview: item.preview })) });
    }
    for (const [key, queue] of this.userQueues) {
      if (this.userInFlight.has(key)) continue;
      const groupId = key.match(/group:([^:]+)/)?.[1] || "";
      const userId = key.match(/user:([^:]+)/)?.[1] || String(queue[0]?.body?.user_id || "");
      rows.push({ key, groupId, userId, startedAt: null, messageId: "", preview: "", queued: queue.map(item => ({ userId: String(item.body?.user_id || ""), messageId: String(item.body?.message_id || ""), enqueuedAt: item.enqueuedAt, preview: item.preview })) });
    }
    return rows;
  }

  async persistUserQueue(key) {
    if (!this.state?.storage) return;
    const queue = this.userQueues.get(key) || [];
    const storageKey = `userqueue:${key}`;
    if (queue.length) await this.state.storage.put(storageKey, queue);
    else await this.state.storage.delete(storageKey);
  }

  eventPreview(body) {
    return extractMessageText(body?.message || body?.raw_message || "").replace(/\s+/g, " ").trim().slice(0, 120);
  }

  async persistQuestionInFlight(key, active) {
    if (!this.state?.storage) return;
    const storageKey = `question-inflight:${key}`;
    if (active) {
      const { controller, ...serializable } = active;
      await this.state.storage.put(storageKey, serializable);
    } else await this.state.storage.delete(storageKey);
  }

  oldestQueuedKey() {
    let selected = "";
    let oldest = Infinity;
    for (const [key, queue] of this.userQueues) {
      if (this.userInFlight.has(key) || !Array.isArray(queue) || !queue.length) continue;
      const at = Number(queue[0]?.enqueuedAt || 0);
      if (at < oldest) { oldest = at; selected = key; }
    }
    return selected;
  }

  async runQuestion(key, body, requestUrl, { fromQueue = false, enqueuedAt = Date.now(), preview = "" } = {}) {
    let immediateThinkingMessageId = "";
    if (body?.message_type === "group") {
      const groupId = String(body.group_id || "");
      if (!groupId || !(await isGroupWhitelisted(this.env, groupId)) || await dbGet(this.env, `ai_off:${groupId}`) === "true") {
        await this.recordIngress(body, "ai_disabled", { explicit: true, force: true }).catch(() => {});
        return;
      }
    }
    const controller = new AbortController();
    const token = crypto.randomUUID();
    const active = {
      token,
      groupId: String(body.group_id || ""),
      userId: String(body.user_id || ""),
      messageId: String(body.message_id || ""),
      preview: preview || this.eventPreview(body),
      startedAt: Date.now(),
      enqueuedAt: Number(enqueuedAt || Date.now()),
      body,
      parts: this.questionBodies(body),
      requestUrl,
      controller,
      cancelled: false,
      cancelledReason: ""
    };
    this.userInFlight.set(key, active);
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
      await this.processInboundEvent(processingBody, requestUrl, { signal: controller.signal, key, token });
    } catch (error) {
      if (!controller.signal.aborted) {
        console.error("user question failed", error);
        await this.notifyExplicitReplyFailureOnce({ ...body, __qqai_explicit_question: true }, "uncaught_error", { error: String(error?.message || error).slice(0, 300) }).catch(() => {});
        if (fromQueue) await this.sendQueueNotice(body, "排队的问题处理失败，已跳到下一条。请稍后重试。").catch(() => {});
      }
    } finally {
      processingFinished = true;
      if (immediateThinkingMessageId) {
        await this.retractThinkingIndicator(body, immediateThinkingMessageId)
          .catch(error => console.error("immediate thinking cleanup failed", error));
      }
      await this.retractRegisteredThinkingIndicators(body).catch(error => console.error("final thinking cleanup failed", error));
      if (this.userInFlight.get(key)?.token === token) this.userInFlight.delete(key);
      await this.persistQuestionInFlight(key, null);
      if (this.inputBuffers.has(key)) {
        const buffered = this.inputBuffers.get(key);
        if (buffered?.forceImmediate) await this.flushBufferedQuestion(key, "forced_after_cancel");
        else this.scheduleInputBuffer(key);
      } else await this.drainUserQueue(key);
    }
  }

  async enqueueUserQuestion(body, requestUrl) {
    return this.receiveUserQuestion(body, requestUrl);
  }

  async kickQueueScheduler(preferredKey = "") {
    if (this.queueSchedulerRunning) return;
    const socket = this.restoreActiveSocket();
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    this.queueSchedulerRunning = true;
    try {
      const keys = [];
      if (preferredKey && !this.userInFlight.has(preferredKey) && (this.userQueues.get(preferredKey) || []).length) keys.push(preferredKey);
      for (const [key, queue] of [...this.userQueues.entries()].sort((a, b) => Number(a[1]?.[0]?.enqueuedAt || 0) - Number(b[1]?.[0]?.enqueuedAt || 0))) {
        if (keys.includes(key) || this.userInFlight.has(key) || !queue?.length) continue;
        keys.push(key);
        if (keys.length >= DEFAULTS.queueRecoveryBatchSize) break;
      }
      for (const key of keys) {
        const queue = this.userQueues.get(key) || [];
        const entry = queue.shift();
        if (queue.length) this.userQueues.set(key, queue); else this.userQueues.delete(key);
        await this.persistUserQueue(key);
        if (!entry || Date.now() - Number(entry.enqueuedAt || 0) > DEFAULTS.userQueueTtlMs) continue;
        this.trackEventTask(this.runQuestion(key, entry.body, entry.requestUrl, {
          fromQueue: true, enqueuedAt: entry.enqueuedAt, preview: entry.preview
        }));
      }
      if ([...this.userQueues.values()].some(queue => queue?.length)) await this.scheduleQueueRecoveryAlarm();
    } finally {
      this.queueSchedulerRunning = false;
    }
  }

  async drainUserQueue(key) {
    await this.kickQueueScheduler(key);
  }

  async scheduleQueueRecoveryAlarm() {
    if (!this.state?.storage || ![...this.userQueues.values()].some(queue => queue?.length)) return;
    const target = Date.now() + DEFAULTS.queueRecoveryAlarmMs;
    const current = await this.state.storage.getAlarm();
    if (!current || target < current) await this.state.storage.setAlarm(target);
  }

  async sendQueueNotice(body, text) {
    const message = [
      ...(body.message_id !== undefined && body.message_id !== null ? [{ type: "reply", data: { id: String(body.message_id) } }] : []),
      { type: "at", data: { qq: String(body.user_id || "") } },
      { type: "text", data: { text: ` ${toSimplifiedChinese(text)}` } }
    ];
    await this.sendAction({ action: "send_group_msg", params: { group_id: body.group_id, message, auto_escape: false } }, 10000);
  }

  isSafeTransientRetryChat(body) {
    if (!body || body.post_type !== "message" || body.message_type !== "group") return false;
    if (String(body.user_id || "") === String(body.self_id || "")) return false;
    if (!eventHasBotMention(body) && body?.__qqai_explicit_question !== true) return false;
    const text = eventPlainText(body).trim();
    if (!text || /^(?:[!！]|\/!)/.test(text)) return false;
    // 只重试没有副作用的普通聊天；设置、群务、活动、排程与审核类请求绝不自动重放。
    if (/(?:禁言|踢出?|移出|全员禁言|全員禁言|管理员|管理員|确认|確認|取消执行|取消執行|设置|設定|开启|開啟|关闭|關閉|排程|定时|定時|活动|活動|报名|報名|候补|候補|申诉|申訴|群规|群規|欢迎词|歡迎詞)/i.test(text)) return false;
    return true;
  }

  async processInboundEvent(body, requestUrl, options = {}) {
    const toolTask = this.classifyToolTask(body);
    const lease = toolTask ? this.acquireToolLease(body, toolTask) : { ok: true, key: "", token: "", type: "" };
    if (!lease.ok) {
      await this.sendToolBusyNotice(body, toolTask, lease.reason).catch(error => console.error("send tool busy notice failed", error));
      return;
    }

    let payload = null;
    let action = body.message_type === "private" ? "send_private_msg" : "send_group_msg";
    try {
      const sourceUrl = new URL(requestUrl);
      const internalTimeoutMs = toolTask ? 60000 : 32000;
      const internalStartedAt = Date.now();
      const explicitQuestion = body?.__qqai_explicit_question === true || eventHasBotMention(body);
      const semanticQuestion = body?.__qqai_semantic_question !== false && !oneBotEventIsPunctuationOnly(body);
      // v1.4.5：Durable Object 与同一份 Worker 逻辑在同一模块内直接调用。
      // 不再通过公开域名重新 fetch 自己，避免同区路由、边缘部署切换与公网子请求产生的偶发 502/503/504。
      const internalFetch = async (eventBody, timeoutMs) => {
        const signal = mergeAbortSignal(timeoutMs, options.signal);
        const internalRequest = new Request(`${sourceUrl.protocol}//${sourceUrl.host}/__onebot_event`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-QQAI-Transport": "websocket-do",
            "X-QQAI-Internal-Mode": "direct-loopback",
            "Authorization": `Bearer ${String(this.env.ONEBOT_ACCESS_TOKEN || "")}`
          },
          body: JSON.stringify(eventBody),
          signal
        });
        const directContext = {
          waitUntil: promise => {
            try {
              if (this.state && typeof this.state.waitUntil === "function") this.state.waitUntil(Promise.resolve(promise));
              else Promise.resolve(promise).catch(error => console.error("direct loopback waitUntil failed", error));
            } catch (error) {
              console.error("direct loopback waitUntil registration failed", error);
            }
          }
        };
        try {
          return await QQAIWorker.fetch(internalRequest, this.env, directContext);
        } catch (directError) {
          // 公网回环只保留为显式紧急开关，默认绝不启用。
          if (String(this.env.QQAI_PUBLIC_INTERNAL_FALLBACK || "").toLowerCase() !== "true") throw directError;
          await this.recordIngress(body, "worker_public_fallback", {
            explicit: eventHasBotMention(body),
            force: true,
            directError: String(directError?.message || directError).slice(0, 300)
          }).catch(() => {});
          return fetch(`${sourceUrl.protocol}//${sourceUrl.host}/__onebot_event`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-QQAI-Transport": "websocket-do",
              "Authorization": `Bearer ${String(this.env.ONEBOT_ACCESS_TOKEN || "")}`
            },
            body: JSON.stringify(eventBody),
            signal
          });
        }
      };
      let internalResponse;
      let internalRaw = "";
      let retryAttempted = false;
      let firstFailure = null;
      const safeRetry = !toolTask && this.isSafeTransientRetryChat(body);
      try {
        internalResponse = await internalFetch(body, internalTimeoutMs);
      } catch (error) {
        const elapsedMs = Date.now() - internalStartedAt;
        const transientNetworkFailure = !options.signal?.aborted && safeRetry && elapsedMs < 7000;
        if (transientNetworkFailure) {
          retryAttempted = true;
          firstFailure = { type: "network", error: String(error?.message || error).slice(0, 300), elapsedMs };
          await this.recordIngress(body, "worker_transient_retry", { explicit: true, retryAttempted: true, firstFailure, internalTransportMode: "direct_loopback" }).catch(() => {});
          await new Promise(resolve => setTimeout(resolve, 250));
          const remainingMs = Math.max(5000, internalTimeoutMs - (Date.now() - internalStartedAt));
          try {
            internalResponse = await internalFetch({ ...body, __qqai_internal_retry: 1 }, remainingMs);
          } catch (retryError) {
            error = retryError;
          }
        }
        if (!internalResponse) {
          if (options.signal?.aborted) {
            await this.recordIngress(body, "generation_cancelled", { explicit: eventHasBotMention(body), reason: String(options.signal.reason?.message || options.signal.reason || "cancelled").slice(0, 300) }).catch(() => {});
            return;
          }
          console.error("OneBot internal event processing failed", error);
          await this.recordIngress(body, /abort|timeout/i.test(String(error?.message || error)) ? "worker_timeout" : "worker_error", { explicit: eventHasBotMention(body), error: String(error?.message || error).slice(0, 300), retryAttempted, firstFailure }).catch(() => {});
          const timedOut = /abort|timeout/i.test(String(error?.message || error));
          if (toolTask && timedOut) {
            await this.sendDirectText(body, `⏱️ ${toolTask.label}处理超过时限，任务已自动结束；机器人不会继续被占用。`).catch(() => {});
          } else if (timedOut && await this.shouldQueueUserQuestion(body)) {
            await this.sendQueueNotice(body, "这次回答处理超时，任务已释放，请稍后再试。").catch(() => {});
          }
          return;
        }
      }
      if (options.signal?.aborted) return;
      if (!internalResponse) {
        await this.recordIngress(body, "worker_error", { explicit: eventHasBotMention(body), error: "missing_internal_response", retryAttempted, firstFailure }).catch(() => {});
        return;
      }

      if ([502, 503, 504].includes(Number(internalResponse.status)) && safeRetry && !retryAttempted && Date.now() - internalStartedAt < 14000) {
        internalRaw = await internalResponse.text().catch(() => "");
        retryAttempted = true;
        firstFailure = {
          type: "http",
          httpStatus: Number(internalResponse.status),
          responsePreview: String(internalRaw || "").replace(/\s+/g, " ").slice(0, 500),
          elapsedMs: Date.now() - internalStartedAt
        };
        await this.recordIngress(body, "worker_transient_retry", { explicit: true, retryAttempted: true, firstFailure, internalTransportMode: "direct_loopback" }).catch(() => {});
        await new Promise(resolve => setTimeout(resolve, 250));
        const remainingMs = Math.max(5000, internalTimeoutMs - (Date.now() - internalStartedAt));
        try {
          internalResponse = await internalFetch({ ...body, __qqai_internal_retry: 1 }, remainingMs);
          internalRaw = "";
        } catch (retryError) {
          await this.recordIngress(body, /abort|timeout/i.test(String(retryError?.message || retryError)) ? "worker_timeout" : "worker_error", {
            explicit: true, error: String(retryError?.message || retryError).slice(0, 300), retryAttempted: true, firstFailure
          }).catch(() => {});
          return;
        }
      }

      if (internalResponse.status === 204 && explicitQuestion && semanticQuestion && safeRetry && !options.signal?.aborted && body?.__qqai_force_explicit_reply !== true) {
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
      }
      if (!internalRaw) internalRaw = await internalResponse.text().catch(() => "");
      try { payload = internalRaw ? JSON.parse(internalRaw) : null; } catch { payload = null; }
      if (options.signal?.aborted) return;
      if (!internalResponse.ok) {
        const responsePreview = String(internalRaw || "").replace(/\s+/g, " ").slice(0, 500);
        const failureId = crypto.randomUUID();
        await writeSystemError(this.env, new Error(`INTERNAL_WORKER_HTTP_${internalResponse.status}`), {
          failureId, groupId: String(body.group_id || ""), userId: String(body.user_id || ""), messageId: String(body.message_id || ""), responsePreview, retryAttempted, firstFailure
        }).catch(() => {});
        const classifiedFailure = classifyOperationalFailure(payload?.message || payload?.error || responsePreview, { disposition: "worker_http_error", status: internalResponse.status, preview: responsePreview, failureId });
        await this.recordIngress(body, "worker_http_error", { explicit: eventHasBotMention(body), httpStatus: internalResponse.status, responsePreview, retryAttempted, firstFailure, failureId, errorCode: classifiedFailure.code, internalTransportMode: "direct_loopback" }).catch(() => {});
        return;
      }
      if (!payload?.reply) {
        await this.recordIngress(body, "worker_empty_reply", { explicit: eventHasBotMention(body), httpStatus: internalResponse.status, responsePreview: String(internalRaw || "").slice(0, 500) }).catch(() => {});
        return;
      }
      await this.recordIngress(body, "reply_ready", { explicit: eventHasBotMention(body), httpStatus: internalResponse.status, internalTransportMode: "direct_loopback" }).catch(() => {});
      const plan = payload.reply_plan || {};
      const isPrivate = body.message_type === "private";
      const rawChunks = Array.isArray(payload.reply_chunks) && payload.reply_chunks.length ? payload.reply_chunks : [payload.reply];
      const chunks = rawChunks.map(item => toSimplifiedChinese(String(item || "").trim())).filter(Boolean);
      action = isPrivate ? "send_private_msg" : "send_group_msg";
      const sentIds = [];
      const sendChunk = async (chunk, index) => {
        const visible = index === 0 ? chunk : `（${index + 1}/${chunks.length}）\n${chunk}`;
        const message = isPrivate ? visible : (index === 0 ? this.buildSegments(body, plan, visible) : visible);
        const params = isPrivate ? { user_id: body.user_id, message, auto_escape: false } : { group_id: body.group_id, message, auto_escape: false };
        try {
          const response = await this.sendAction({ action, params }, 15000);
          return { response, message, mode: "websocket" };
        } catch (websocketError) {
          const response = await sendOneBotHttpAction(this.env, action, params, 12000);
          return { response, message, mode: "http_fallback", websocketError };
        }
      };
      try {
        if (options.signal?.aborted) return;
        for (let index = 0; index < chunks.length; index += 1) {
          if (options.signal?.aborted) return;
          const sent = await sendChunk(chunks[index], index);
          const messageId = sent.response?.message_id ?? sent.response?.messageId ?? sent.response?.data?.message_id ?? sent.response?.data?.messageId;
          if (messageId) sentIds.push(String(messageId));
          await this.recordIngress(body, sent.mode === "websocket" ? "sent" : "sent_http_fallback", { explicit: eventHasBotMention(body), sentMessageId: String(messageId || ""), chunkIndex: index + 1, chunkCount: chunks.length, websocketError: sent.websocketError ? String(sent.websocketError?.message || sent.websocketError).slice(0, 300) : "" }).catch(() => {});
          if (index === 0 && messageId && payload.moderation_proposal_id) await attachModerationProposalMessage(this.env, String(payload.moderation_proposal_id), String(messageId), String(body.group_id || ""));
          if (messageId && payload.record_reply === true) {
            await recordStructuredMessage(this.env, {
              messageId: String(messageId), groupId: String(body.group_id || ""), senderId: String(body.self_id || ""), senderName: "QQAI",
              text: extractMessageText(sent.message), mentions: index === 0 ? (plan.mentionIds || []) : [], replyId: index === 0 ? (plan.quoteMessageId || plan.replyId || "") : "", media: [],
              source: "ai", createdAt: Date.now()
            });
          }
        }
        if (payload.ai_log_id) await updateAiDecisionLog(this.env, payload.ai_log_id, { sendStatus: "sent", sentMessageId: sentIds[0] || "", sentMessageIds: sentIds, sentChunkCount: chunks.length, sentAt: Date.now() });
      } catch (error) {
        console.error("send chunked reply failed", error);
        const sendError = String(error?.message || error);
        await this.recordIngress(body, "send_failed", { explicit: eventHasBotMention(body), error: sendError.slice(0, 500), sentChunkCount: sentIds.length, expectedChunkCount: chunks.length }).catch(() => {});
        if (payload?.ai_log_id) await updateAiDecisionLog(this.env, payload.ai_log_id, { sendStatus: "failed", sendError, sentMessageIds: sentIds, sendFailedAt: Date.now() }).catch(() => null);
      } finally {
        if (payload.thinking_message_id) await this.retractThinkingIndicator(body, payload.thinking_message_id).catch(() => {});
      }
    } catch (error) {
      if (!options?.signal?.aborted) {
        await this.notifyExplicitReplyFailureOnce(body, "uncaught_error", {
          error: String(error?.message || error).slice(0, 200)
        }).catch(notifyError => console.error("uncaught explicit reply failure notice failed", notifyError));
      }
      throw error;
    } finally {
      if (toolTask) this.releaseToolLease(lease);
    }
  }

  thinkingRegistryKey(body) {
    const isGroup = body?.message_type === "group";
    return thinkingIndicatorRegistryKey({
      isGroup,
      groupId: String(body?.group_id || ""),
      userId: String(body?.user_id || body?.self_id || "")
    });
  }

  async forgetThinkingIndicator(body, messageId) {
    const id = String(messageId || "");
    if (!id) return;
    const key = this.thinkingRegistryKey(body);
    const rows = await readJson(this.env, key, []);
    const next = (Array.isArray(rows) ? rows : []).map(String).filter(value => value && value !== id);
    if (next.length) await dbPut(this.env, key, JSON.stringify(next.slice(-12)));
    else await dbDel(this.env, key);
  }

  async retractRegisteredThinkingIndicators(body, extraIds = []) {
    const key = this.thinkingRegistryKey(body);
    const rows = await readJson(this.env, key, []);
    const ids = [...new Set([...(Array.isArray(rows) ? rows : []), ...(Array.isArray(extraIds) ? extraIds : [])].map(String).filter(Boolean))];
    if (!ids.length) return { ok: true, cleared: 0 };
    let cleared = 0;
    const failed = [];
    for (const id of ids) {
      const result = await this.retractThinkingIndicator(body, id).catch(error => ({ ok: false, error: String(error?.message || error) }));
      if (result?.ok) cleared += 1;
      else failed.push(id);
    }
    if (failed.length) await dbPut(this.env, key, JSON.stringify(failed.slice(-12)));
    else await dbDel(this.env, key);
    return { ok: failed.length === 0, cleared, failed };
  }

  async retractThinkingIndicator(body, messageId) {
    const normalizedMessageId = numericId(messageId);
    if (!normalizedMessageId) return { ok: true, skipped: true };
    let firstError = "";
    try {
      await this.sendAction({ action: "delete_msg", params: { message_id: normalizedMessageId } }, 8000);
      await this.forgetThinkingIndicator(body, messageId);
      return { ok: true, mode: "normal_recall" };
    } catch (error) {
      firstError = String(error?.message || error);
    }

    const groupId = String(body?.group_id || "");
    let botRole = "unknown";
    let adminRetryError = "";
    if (body?.message_type === "group" && groupId) {
      const state = await getBotGroupRole(this.env, groupId).catch(() => ({ role: "unknown" }));
      botRole = String(state?.role || "unknown");
      if (botRole === "owner" || botRole === "admin") {
        try {
          await this.sendAction({ action: "delete_msg", params: { message_id: normalizedMessageId } }, 12000);
          await this.forgetThinkingIndicator(body, messageId);
          await writeSystemAudit(this.env, { type: "thinking_indicator_recall", groupId, actorId: String(body?.self_id || "bot"), action: "admin_group_recall_retry", messageId: String(messageId), firstError: firstError.slice(0, 500) }).catch(() => {});
          return { ok: true, mode: "admin_group_recall_retry", botRole };
        } catch (error) {
          adminRetryError = String(error?.message || error);
        }
      }
    }

    const residual = {
      at: Date.now(),
      groupId,
      userId: String(body?.user_id || ""),
      botId: String(body?.self_id || ""),
      messageId: String(messageId),
      botRole,
      firstError: firstError.slice(0, 1000),
      adminRetryError: adminRetryError.slice(0, 1000),
      status: "residual"
    };
    await dbPut(this.env, `thinking_indicator_residual:${groupId || "private"}:${messageId}`, JSON.stringify(residual)).catch(() => {});
    await writeSystemAudit(this.env, { type: "thinking_indicator_residual", groupId, actorId: String(body?.self_id || "bot"), action: "recall_failed", ...residual }).catch(() => {});
    return { ok: false, ...residual };
  }

  classifyToolTask(body) {
    if (!body || !["message", "message_sent"].includes(body.post_type)) return null;
    const text = extractMessageText(body.message || body.raw_message || "")
      .replace(/@\d{5,}\s*/g, "")
      .trim();
    const definitions = [
      { type: "tts", label: "语音生成", limit: 2, pattern: /^[!！](?:语音|語音|speak|tts)(?:\s|$)/i },
      { type: "web", label: "网页分析", limit: 3, pattern: /^[!！](?:读网页|讀網頁)(?:\s|$)/i },
      { type: "minutes", label: "会议纪要", limit: 2, pattern: /^[!！](?:会议纪要|會議紀要)(?:\s|$)/i }
    ];
    return definitions.find(item => item.pattern.test(text)) || null;
  }

  acquireToolLease(body, toolTask) {
    const scope = body.message_type === "group"
      ? `group:${String(body.group_id || "")}`
      : `private:${String(body.user_id || "")}`;
    const key = `${scope}:${toolTask.type}`;
    if (this.toolInFlight.has(key)) return { ok: false, reason: "same_scope", key, type: toolTask.type };
    const count = Number(this.toolCounts.get(toolTask.type) || 0);
    if (count >= toolTask.limit) return { ok: false, reason: "global_limit", key, type: toolTask.type };
    const token = crypto.randomUUID();
    this.toolInFlight.set(key, token);
    this.toolCounts.set(toolTask.type, count + 1);
    return { ok: true, key, token, type: toolTask.type };
  }

  releaseToolLease(lease) {
    if (!lease?.ok || !lease.key) return;
    if (this.toolInFlight.get(lease.key) === lease.token) this.toolInFlight.delete(lease.key);
    const count = Math.max(0, Number(this.toolCounts.get(lease.type) || 0) - 1);
    if (count) this.toolCounts.set(lease.type, count);
    else this.toolCounts.delete(lease.type);
  }

  async sendDirectText(body, text) {
    const isPrivate = body.message_type === "private";
    const action = isPrivate ? "send_private_msg" : "send_group_msg";
    const params = isPrivate
      ? { user_id: body.user_id, message: toSimplifiedChinese(text), auto_escape: false }
      : { group_id: body.group_id, message: toSimplifiedChinese(text), auto_escape: false };
    await this.sendAction({ action, params }, 10000);
  }

  async sendToolBusyNotice(body, toolTask, reason) {
    const text = reason === "same_scope"
      ? `⏳ 本聊天已有一个${toolTask.label}任务正在处理，这次重复指令未加入队列；普通 AI 对话仍可继续使用。`
      : `⏳ 目前${toolTask.label}工作槽已满，请稍后再试；普通 AI 对话不受影响。`;
    await this.sendDirectText(body, text);
  }

  parseCqSegments(value) {
    const input = String(value || "");
    const segments = [];
    const re = /\[CQ:(at|reply|image|record|video|face),([^\]]+)\]/g;
    let last = 0, match;
    const parseData = raw => Object.fromEntries(String(raw).split(",").map(part => { const i = part.indexOf("="); return i < 0 ? [part, ""] : [part.slice(0, i), part.slice(i + 1)]; }));
    while ((match = re.exec(input))) {
      if (match.index > last) segments.push({ type: "text", data: { text: input.slice(last, match.index) } });
      const data = parseData(match[2]);
      if (match[1] === "at" && data.qq) segments.push({ type: "at", data: { qq: String(data.qq) } });
      else if (match[1] === "reply" && (data.id || data.message_id)) segments.push({ type: "reply", data: { id: String(data.id || data.message_id) } });
      else if (["image", "record", "video", "face"].includes(match[1])) segments.push({ type: match[1], data });
      last = re.lastIndex;
    }
    if (last < input.length) segments.push({ type: "text", data: { text: input.slice(last) } });
    return segments.length ? segments : [{ type: "text", data: { text: input } }];
  }

  buildSegments(eventBody, plan, text) {
    const segments = [];
    const quoteId = plan.quoteMessageId || plan.replyId;
    if (quoteId) segments.push({ type: "reply", data: { id: String(quoteId) } });
    const mentions = [...new Set((plan.mentionIds || []).map(String).filter(id => id && id !== String(eventBody.self_id || "")))];
    for (const id of mentions) { segments.push({ type: "at", data: { qq: id } }); segments.push({ type: "text", data: { text: " " } }); }
    segments.push(...this.parseCqSegments(text));
    return segments;
  }
}
