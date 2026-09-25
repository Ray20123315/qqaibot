// Extracted from worker.js without behavioral changes.
// Cloudflare still deploys worker.js as the single Worker entry point.



const VERSION = "2.7.12";


const BUILD_DATE = "2026-08-03";


const DEFAULT_DEVELOPER_ID = "";


const DEFAULTS = Object.freeze({
  deepseekFlashModel: "deepseek-v4-flash",
  interjectRate: 0,
  contextSummaryThreshold: 20,
  groupContextExactMessages: 80,
  groupContextMaximumMessages: 600,
  conversationHistoryItems: 48,
  outboundChunkChars: 1400,
  outboundMaxParts: 10,
  replyHardChars: 12000,
  aiDecisionLogLimit: 2000,
  manualRuleCheckCooldownMs: 20 * 1000,
  manualRuleCheckHourlyLimit: 8,
  thinkingDelayMs: 1200,
  inputDebounceMs: 1200,
  inputDebounceMaxMs: 3500,
  scheduleMinIntervalMinutes: 1,
  scheduleMaxActivePerUser: 0,
  scheduleMaxPerGroupHour: 0,
  appealEnabled: true,
  appealFormerMemberDays: 30,
  ruleStrikeWindowDays: 7,
  ruleProgressiveFirstMuteSeconds: 60,
  ruleProgressiveSecondMuteSeconds: 600,
  userQueueMax: 5,
  userQueueTtlMs: 10 * 60 * 1000,
  queueRecoveryAlarmMs: 30 * 1000,
  queueRecoveryBatchSize: 5,
  moderationProposalTtlMs: 2 * 60 * 1000,
  modelCostPolicy: "free_first",
  deepseekEmergencyFallback: false,
  paidContextSummary: false,
  portalSessionTtlMs: 30 * 24 * 60 * 60 * 1000,
  portalSessionAbsoluteTtlMs: 180 * 24 * 60 * 60 * 1000,
  portalSessionCookieSeconds: 180 * 24 * 60 * 60,
  portalSessionTemporaryTtlMs: 12 * 60 * 60 * 1000,
  portalSessionTemporaryAbsoluteTtlMs: 24 * 60 * 60 * 1000,
  moderationTargetCooldownSeconds: 0,
  newcomerObservationDays: 0,
  welcomeText: "欢迎 {at} 加入本群 🎉 请先阅读群规，有问题可以询问管理员。",
  ruleMonitorEnabled: true,
  ruleProxyMode: "record",
  ruleProxyMuteSeconds: 600,
  ruleStrictness: "smart",
  runtimeRateLimitSeconds: 10,
  joinPatternAutoApproveThreshold: 2,
  joinAiApproveConfidence: 0.90,
  ruleSpamWindowSeconds: 60,
  ruleSpamThreshold: 4,
  ruleSpamKeepCount: 3,
  ruleMuteGuardEnabled: true,
  operationsRetentionDays: 90,
  operationsQuietStart: "23:00",
  operationsQuietEnd: "08:00",
  operationsInviteCooldownSeconds: 30,
  operationsFuseFailureThreshold: 5,
  ingredientAnalysisMinimumMessages: 8,
  ingredientAnalysisMaximumMessages: 30,
  deepseekEmergencyFailureThreshold: 3,
  deepseekEmergencyFailureWindowMs: 15 * 60 * 1000,
  deepseekEmergencyAccessWindowMs: 10 * 60 * 1000,
});



const EXPLICIT_REPLY_FAILURE_MESSAGES = Object.freeze({
  worker_error: "内部处理失败，请 30 秒后再试。",
  worker_http_error: "处理服务异常，请 30 秒后再试。",
  worker_timeout: "处理超时，请 30 秒后再试。",
  worker_empty_reply: "模型没有返回内容，请 10 秒后再试。",
  worker_no_reply: "本次没有生成可发送的回复，请 15 秒后再试。",
  send_failed: "机器人连接异常，消息暂时无法发送，请 1 分钟后再试。",
  uncaught_error: "系统处理异常，请 30 秒后再试。"
});

function parseRetryAfterSeconds(source, fallbackSeconds = 0) {
  const text = String(source || "").normalize("NFKC");
  const englishSeconds = text.match(/retry[_ -]?after[^0-9]{0,8}([0-9]+(?:[.][0-9]+)?)/i);
  if (englishSeconds) {
    const amount = Number(englishSeconds[1]);
    if (Number.isFinite(amount) && amount > 0) {
      return Math.max(1, Math.min(30 * 86400, Math.ceil(amount)));
    }
  }
  const patterns = [
    /retry[_ -]?after\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(seconds?|secs?|s)?/i,
    /(?:请|請)?\s*(\d+(?:\.\d+)?)\s*(秒|分钟|分鐘|分|小时|小時|时|時|天)后(?:再试|重试|重試)/i,
    /(?:retry|重试|重試)[^\d]{0,16}(\d+(?:\.\d+)?)\s*(秒|分钟|分鐘|分|小时|小時|时|時|天)/i
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const amount = Number(match[1]);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const unit = String(match[2] || "秒").toLowerCase();
    const multiplier = /天/.test(unit) ? 86400 : /小时|小時|时|時/.test(unit) ? 3600 : /分钟|分鐘|分/.test(unit) ? 60 : 1;
    return Math.max(1, Math.min(30 * 86400, Math.ceil(amount * multiplier)));
  }
  const explicit = Number(fallbackSeconds || 0);
  return Number.isFinite(explicit) && explicit > 0 ? Math.max(1, Math.min(30 * 86400, Math.ceil(explicit))) : 0;
}

function formatRetryDelay(seconds) {
  const value = Math.max(1, Math.ceil(Number(seconds || 1)));
  if (value < 60) return String(value) + " 秒";
  if (value < 3600) return String(Math.ceil(value / 60)) + " 分钟";
  if (value < 86400) return String(Math.ceil(value / 3600)) + " 小时";
  return String(Math.ceil(value / 86400)) + " 天";
}

function retryMessage(problem, seconds) {
  return String(problem) + "，请 " + formatRetryDelay(seconds) + "后再试。";
}

function classifyOperationalFailure(errorLike, options = {}) {
  const status = Number(options.status || 0);
  const disposition = String(options.disposition || "");
  const source = [
    String(errorLike?.message || errorLike || ""),
    String(options.preview || ""),
    String(options.code || ""),
    String(status || "")
  ].join(" ");
  const lower = source.toLowerCase();
  const explicitRetry = Number(options.retryAfterSeconds || options.retryAfter || 0);
  let retryAfterSeconds = parseRetryAfterSeconds(source, explicitRetry);
  let code = "INTERNAL_EXECUTION_ERROR";
  let userText = EXPLICIT_REPLY_FAILURE_MESSAGES[disposition] || EXPLICIT_REPLY_FAILURE_MESSAGES.uncaught_error;
  const defaultDispositionRetry = ({ worker_error: 30, worker_http_error: 30, worker_timeout: 30, worker_empty_reply: 10, worker_no_reply: 15, send_failed: 60, uncaught_error: 30 })[disposition] || 30;

  if (/api_keys?_missing|未配置.{0,20}(?:api|模型).{0,10}(?:key|金钥|密钥)|missing.{0,20}(?:api.?key|credential)/i.test(source)) {
    code = "MODEL_CREDENTIALS_MISSING";
    retryAfterSeconds = 0;
    userText = "模型 API 配置缺失，请联系开发者。";
  } else if (status === 429 || /resource_exhausted|rate.?limit|too many requests|quota|额度不足|配额/i.test(source)) {
    code = "MODEL_RATE_LIMITED";
    retryAfterSeconds = retryAfterSeconds || 60;
    userText = retryMessage("模型 API 已限流", retryAfterSeconds);
  } else if (/abort|timeout|timed out|deadline|超时|超过时限/i.test(source) || disposition === "worker_timeout") {
    code = "PROCESSING_TIMEOUT";
    retryAfterSeconds = retryAfterSeconds || 30;
    userText = retryMessage("处理超时", retryAfterSeconds);
  } else if (/d1|database|sqlite|sql_|sql error|资料库|数据库|db_get|db_put/i.test(source)) {
    code = "DATABASE_ERROR";
    retryAfterSeconds = retryAfterSeconds || 60;
    userText = retryMessage("资料库暂时不可用", retryAfterSeconds);
  } else if (/napcat|onebot|websocket|no active websocket|rpc.*(?:fail|error)|send_(?:group|private)_msg/i.test(source) || disposition === "send_failed") {
    code = "NAPCAT_CONNECTION_ERROR";
    retryAfterSeconds = retryAfterSeconds || 60;
    userText = retryMessage("机器人连接异常，消息暂时无法发送", retryAfterSeconds);
  } else if (/gemini|gemma|deepseek|workers.?ai|model|generatecontent/i.test(source)) {
    code = "MODEL_PROVIDER_ERROR";
    retryAfterSeconds = retryAfterSeconds || 60;
    userText = retryMessage("目前模型 API 均无法调用", retryAfterSeconds);
  } else if ([401, 403].includes(status) || /unauthorized|forbidden|鉴权|权限验证失败/i.test(source)) {
    code = "INTERNAL_AUTH_ERROR";
    retryAfterSeconds = 0;
    userText = "内部权限配置异常，请联系开发者。";
  } else if (disposition === "worker_empty_reply") {
    code = "EMPTY_MODEL_REPLY";
    retryAfterSeconds = retryAfterSeconds || 10;
    userText = retryMessage("模型没有返回内容", retryAfterSeconds);
  } else if ([502, 503, 504].includes(status)) {
    code = "UPSTREAM_UNAVAILABLE";
    retryAfterSeconds = retryAfterSeconds || 60;
    userText = retryMessage("上游服务暂时不可用", retryAfterSeconds);
  } else if (status >= 500) {
    code = "INTERNAL_HTTP_ERROR";
    retryAfterSeconds = retryAfterSeconds || 30;
    userText = retryMessage("内部处理服务异常", retryAfterSeconds);
  } else {
    retryAfterSeconds = retryAfterSeconds || defaultDispositionRetry;
    if (disposition === "worker_no_reply") {
      code = "NO_SENDABLE_REPLY";
      userText = retryMessage("本次没有生成可发送的回复", retryAfterSeconds);
    } else if (disposition === "worker_http_error") {
      code = "INTERNAL_HTTP_ERROR";
      userText = retryMessage("处理服务异常", retryAfterSeconds);
    } else if (disposition === "worker_error") {
      userText = retryMessage("内部处理失败", retryAfterSeconds);
    } else if (disposition === "uncaught_error" || !disposition) {
      userText = retryMessage("系统处理异常", retryAfterSeconds);
    }
  }

  return {
    code,
    userText,
    raw: source.slice(0, 1000),
    lower,
    retryAfterSeconds,
    failureId: String(options.failureId || "").trim()
  };
}


const AI_MEDIA_LIMITS = Object.freeze({
  imageBytes: 8 * 1024 * 1024,
  audioBytes: 12 * 1024 * 1024,
  videoBytes: 25 * 1024 * 1024,
  forwardBundles: 3,
  forwardNodes: 80,
  forwardTextChars: 40000,
  conversationRecords: 10000,
  mentionBatchSize: 30,
  mentionMaxRecipients: 300
});



// The historical 300-item catalog was a non-enforced placeholder. Real optional features are V3 plugins.
const PLATFORM_FEATURE_NAMES = Object.freeze([]);
const PLATFORM_FEATURES = Object.freeze([]);
const PLATFORM_FEATURE_COUNT = PLATFORM_FEATURES.length;


export { AI_MEDIA_LIMITS, BUILD_DATE, DEFAULTS, DEFAULT_DEVELOPER_ID, EXPLICIT_REPLY_FAILURE_MESSAGES, PLATFORM_FEATURES, PLATFORM_FEATURE_COUNT, PLATFORM_FEATURE_NAMES, VERSION, classifyOperationalFailure };
