import fs from "node:fs";

const read = path => fs.readFileSync(path, "utf8");
const write = (path, value) => fs.writeFileSync(path, value);

function replaceOnce(source, from, to, label) {
  const first = source.indexOf(from);
  if (first < 0) throw new Error(`Missing anchor: ${label}`);
  if (source.indexOf(from, first + from.length) >= 0) throw new Error(`Ambiguous anchor: ${label}`);
  return source.slice(0, first) + to + source.slice(first + from.length);
}

function patchWorker() {
  let worker = read("worker.js");
  if (!worker.includes('from "./src/games/entertainment.js"')) {
    worker = replaceOnce(
      worker,
      'import { handleWerewolfOneBotEvent, injectWerewolfPortalClient, processWerewolfTimers } from "./src/games/werewolf.js";',
      'import { handleEntertainmentCommand } from "./src/games/entertainment.js";\nimport { handleWerewolfOneBotEvent, injectWerewolfPortalClient, processWerewolfTimers } from "./src/games/werewolf.js";\nimport { buildHelpText } from "./src/help/commands.js";',
      "worker imports"
    );
  }

  const helpStart = worker.indexOf("      if (['!help', '!帮助', '!幫助', '！help', '！帮助', '！幫助'].includes(msgLower)) {");
  const statusStart = worker.indexOf("      if (['!status', '!配额', '!配額', '！status', '！配额', '！配額'].includes(msgLower)) {", helpStart);
  if (helpStart < 0 || statusStart < 0 || statusStart <= helpStart) throw new Error("Unable to locate help/status block");

  const entertainmentBlock = [
    "      const entertainmentResult = handleEntertainmentCommand({",
    "        text: cleanMessage,",
    "        userId,",
    "        groupId: currentGroupId || \"private\",",
    "        now: new Date()",
    "      });",
    "      if (entertainmentResult.handled) {",
    "        return jsonReply(`${atSender}${entertainmentResult.text}`, {",
    "          reply_kind: \"entertainment\",",
    "          entertainment_kind: entertainmentResult.kind || \"unknown\"",
    "        });",
    "      }",
    ""
  ].join("\n");

  const helpBlock = [
    "      if (['!help', '!帮助', '!幫助', '！help', '！帮助', '！幫助'].includes(msgLower)) {",
    "        const roleTxt = isOnlyMe ? '开发者' :",
    "          senderRole === 'owner' ? '群主' :",
    "          senderRole === 'admin' ? 'QQ管理员' :",
    "          permissionSet.groupOps && permissionSet.aiAdmin ? 'AI管理＋群操作' :",
    "          permissionSet.groupOps ? '群操作权限' :",
    "          permissionSet.aiAdmin ? 'AI管理权限' : '群成员';",
    "        const helpMsg = buildHelpText({",
    "          roleLabel: roleTxt,",
    "          permissionSet,",
    "          isDeveloper,",
    "          isOwner: senderRole === 'owner',",
    "          portalUrl: 'https://qqai.ray2025.com/',",
    "          liveUrl: 'https://qqai.ray2025.com/live'",
    "        });",
    "        return jsonReply(`${atSender}${helpMsg}`);",
    "      }",
    ""
  ].join("\n");

  worker = worker.slice(0, helpStart) + entertainmentBlock + "\n" + helpBlock + "\n" + worker.slice(statusStart);
  write("worker.js", worker);
}

function patchRuntime() {
  let runtime = read("src/config/runtime.js");
  if (runtime.includes('const VERSION = "2.7.10";')) {
    runtime = replaceOnce(runtime, 'const VERSION = "2.7.10";', 'const VERSION = "2.7.11";', "runtime version");
  } else if (!runtime.includes('const VERSION = "2.7.11";')) {
    throw new Error("Unexpected runtime version");
  }

  const failureStart = runtime.indexOf("const EXPLICIT_REPLY_FAILURE_MESSAGES = Object.freeze({");
  const affinityStart = runtime.indexOf("const AFFINITY_DEFAULTS = Object.freeze({", failureStart);
  if (failureStart < 0 || affinityStart < 0) throw new Error("Unable to locate operational failure block");

  const failureBlock = `const EXPLICIT_REPLY_FAILURE_MESSAGES = Object.freeze({
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


`;
  runtime = runtime.slice(0, failureStart) + failureBlock + runtime.slice(affinityStart);
  write("src/config/runtime.js", runtime);
}

function patchPackageAndRelease() {
  const pkg = JSON.parse(read("package.json"));
  if (!["2.7.10", "2.7.11"].includes(pkg.version)) throw new Error(`Unexpected package version: ${pkg.version}`);
  pkg.version = "2.7.11";
  if (!pkg.scripts.check.includes("verify-entertainment-help-readme-errors.mjs")) {
    pkg.scripts.check += " && node verify-entertainment-help-readme-errors.mjs";
  }
  write("package.json", JSON.stringify(pkg, null, 2) + "\n");

  write("release-notes.json", JSON.stringify({
    version: "2.7.11",
    notificationPolicy: "developer-only-by-default-with-explicit-opt-in",
    verification: "full-regression-and-single-worker-bundle",
    added: [
      "新增不调用模型 API 的骰子、随机数、硬币、猜拳、选择、今日运势、真心话与大冒险指令",
      "新增集中式、权限感知的条列式 !help 指令目录",
      "新增秒、分钟、小时与天的用户友好重试时间格式"
    ],
    fixed: [
      "重写 README，使架构、Portal、群规、人格、绑定、验证与部署说明符合 2.7.11 现况",
      "修复 !help 指令遗漏、权限混杂及长段落难以阅读的问题",
      "修复无回复与 API 故障提示过长、暴露内部维护入口且缺少明确重试时间的问题"
    ]
  }, null, 2) + "\n");
}

function patchVerification() {
  for (const file of fs.readdirSync(".")) {
    if (!/^verify-.*\.mjs$/.test(file) || file === "verify-entertainment-help-readme-errors.mjs") continue;
    const source = read(file);
    if (source.includes("2.7.10")) write(file, source.split("2.7.10").join("2.7.11"));
  }

  let memberDetails = read("verify-member-details.mjs");
  const oldAssertion = 'assert.match(workerSource, /!详细资料 \\[@成员\\]/, "help must document the privileged full-detail command");';
  if (memberDetails.includes(oldAssertion)) {
    memberDetails = memberDetails.replace(
      oldAssertion,
      'const helpSource = fs.readFileSync("src/help/commands.js", "utf8");\nassert.match(workerSource + "\\n" + helpSource, /!详细资料 \\[@成员\\]/, "help must document the privileged full-detail command");'
    );
    write("verify-member-details.mjs", memberDetails);
  } else if (!memberDetails.includes('fs.readFileSync("src/help/commands.js"')) {
    throw new Error("Unable to update modular help assertion");
  }
}

patchWorker();
patchRuntime();
patchPackageAndRelease();
patchVerification();
console.log("Applied permanent v2.7.11 integration patch.");
