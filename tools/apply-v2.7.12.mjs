import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function write(path, content) {
  fs.writeFileSync(path, content, "utf8");
}

function replaceRequired(path, before, after, expected = 1) {
  const source = read(path);
  const count = source.split(before).length - 1;
  if (count !== expected) throw new Error(`${path}: expected ${expected} occurrence(s), found ${count}: ${before.slice(0, 100)}`);
  write(path, source.split(before).join(after));
}

function replaceRegexRequired(path, pattern, replacer, minimum = 1) {
  const source = read(path);
  let count = 0;
  const output = source.replace(pattern, (...args) => {
    count += 1;
    return typeof replacer === "function" ? replacer(...args) : replacer;
  });
  if (count < minimum) throw new Error(`${path}: pattern did not match enough times: ${pattern}`);
  write(path, output);
  return count;
}

// Version and personal fallback removal.
replaceRequired("src/config/runtime.js", 'const VERSION = "2.7.11";', 'const VERSION = "2.7.12";');
replaceRequired("src/config/runtime.js", 'const BUILD_DATE = "2026-07-28";', 'const BUILD_DATE = "2026-08-03";');
replaceRequired("src/config/runtime.js", 'const DEFAULT_DEVELOPER_ID = "3569028262";', 'const DEFAULT_DEVELOPER_ID = "";');

// Central developer identity helpers.
replaceRequired(
  "src/core/identity.js",
  'import { AFFINITY_DEFAULTS, DEFAULT_DEVELOPER_ID } from "../config/runtime.js";',
  'import { AFFINITY_DEFAULTS } from "../config/runtime.js";\nimport { developerId, developerIds, isDeveloperId } from "../config/deployment.js";'
);
replaceRequired(
  "src/core/identity.js",
  'function developerId(env) {\n  return String(env?.DEVELOPER_ID || DEFAULT_DEVELOPER_ID);\n}\n\n\n\nfunction isDeveloperId(env, qq) {\n  return Boolean(qq && String(qq) === developerId(env));\n}\n\n\n\n',
  ''
);
replaceRequired(
  "src/core/identity.js",
  'consumeManualRuleCheckRate, developerId, getAffinityProfile, isDeveloperId,',
  'consumeManualRuleCheckRate, developerId, developerIds, getAffinityProfile, isDeveloperId,'
);

// Remove unused personal-default imports.
replaceRequired(
  "src/integrations/bilibili.js",
  'import { DEFAULT_DEVELOPER_ID, VERSION } from "../config/runtime.js";',
  'import { VERSION } from "../config/runtime.js";'
);
replaceRequired(
  "src/moderation/runtime.js",
  'import { DEFAULTS, DEFAULT_DEVELOPER_ID, VERSION } from "../config/runtime.js";',
  'import { DEFAULTS, VERSION } from "../config/runtime.js";'
);

// Deployment notification recipients support multi-developer configuration.
replaceRequired(
  "src/deployment/notifications.js",
  'import { DEFAULT_DEVELOPER_ID, VERSION } from "../config/runtime.js";',
  'import { VERSION } from "../config/runtime.js";\nimport { developerIds, isDeveloperId } from "../config/deployment.js";'
);
replaceRequired(
  "src/deployment/notifications.js",
  'function developerId(env) {\n  return String(env?.DEPLOY_NOTIFY_DEVELOPER_ID || env?.DEVELOPER_ID || DEFAULT_DEVELOPER_ID || "").replace(/\\D/g, "");\n}\n',
  'function deploymentDeveloperIds(env) {\n  const override = String(env?.DEPLOY_NOTIFY_DEVELOPER_IDS || env?.DEPLOY_NOTIFY_DEVELOPER_ID || "").trim();\n  if (!override) return developerIds(env);\n  return developerIds({ ...env, DEVELOPER_IDS: override, ROOT_QQ_IDS: "", DEVELOPER_ID: "" });\n}\n'
);
replaceRegexRequired(
  "src/deployment/notifications.js",
  /async function notifyDeveloperFailure\(env, record, accountId\) \{[\s\S]*?\n\}\n\nasync function appendHistory/,
  `async function notifyDeveloperFailure(env, record, accountId) {
  const qqs = deploymentDeveloperIds(env);
  if (!qqs.length) return { ok: false, skipped: true, reason: "developer_id_missing" };
  const logs = await fetchBuildLogs(env, accountId, record.buildUuid);
  const detail = logs || record.failureDetail || "事件没有附带错误日志。请在 Cloudflare Workers Builds 中按 Build UUID 查看。";
  const text = [
    "【QQAI 部署失败详情】",
    \`Worker：\${record.workerName || "qqai"}\`,
    \`Build UUID：\${record.buildUuid || "未知"}\`,
    \`分支：\${record.branch || "未知"}\`,
    \`Commit：\${record.commitHash ? record.commitHash.slice(0, 12) : "未知"}\`,
    record.commitMessage ? \`提交说明：\${record.commitMessage.slice(0, 300)}\` : "",
    \`结果：\${record.outcome || record.kind}\`,
    "",
    \`错误详情：\\n\${detail.slice(0, 5000)}\`
  ].filter(Boolean).join("\\n");
  const recipients = [];
  for (const qq of qqs) {
    recipients.push({ qq, ...(await sendOneBotWithFallback(env, "send_private_msg", { user_id: numericId(qq), message: text, auto_escape: false })) });
  }
  return { ok: recipients.some(item => item.ok), recipients };
}

async function appendHistory`
);
replaceRequired(
  "src/deployment/notifications.js",
  'String(session?.qq || "") === developerId(env)',
  'isDeveloperId(env, session?.qq)'
);

// Automatic check-in deployment switch.
replaceRequired(
  "src/scheduler/runtime.js",
  'import { DEFAULTS } from "../config/runtime.js";',
  'import { DEFAULTS } from "../config/runtime.js";\nimport { envBoolean } from "../config/deployment.js";'
);
replaceRequired(
  "src/scheduler/runtime.js",
  'async function runAutomaticGroupCheckins(env, now = Date.now()) {\n  const parts = taipeiParts(now);',
  'async function runAutomaticGroupCheckins(env, now = Date.now()) {\n  if (!envBoolean(env?.AUTO_CHECKIN_ENABLED, true)) return;\n  const parts = taipeiParts(now);'
);

// Worker uses central identity and public URL helpers.
replaceRequired(
  "worker.js",
  'import { AI_MEDIA_LIMITS, DEFAULTS, VERSION, classifyOperationalFailure } from "./src/config/runtime.js";',
  'import { AI_MEDIA_LIMITS, DEFAULTS, VERSION, classifyOperationalFailure } from "./src/config/runtime.js";\nimport { publicBaseUrl } from "./src/config/deployment.js";'
);
replaceRequired(
  "worker.js",
  'import { consumeManualRuleCheckRate, getAffinityProfile, latestConversationMessageForUser, recentConversationMessagesForUser, refreshAffinityAiAssessment, stripGroupAiOptOutPrefix, updateAffinityFixedFromMessage } from "./src/core/identity.js";',
  'import { consumeManualRuleCheckRate, developerIds, getAffinityProfile, isDeveloperId, latestConversationMessageForUser, recentConversationMessagesForUser, refreshAffinityAiAssessment, stripGroupAiOptOutPrefix, updateAffinityFixedFromMessage } from "./src/core/identity.js";'
);
replaceRequired(
  "worker.js",
  '        const helpMsg = buildHelpText({',
  '        const configuredHelpBaseUrl = publicBaseUrl(env, url.origin);\n        const helpMsg = buildHelpText({'
);
replaceRequired("worker.js", "          portalUrl: 'https://qqai.ray2025.com/',", '          portalUrl: configuredHelpBaseUrl ? `${configuredHelpBaseUrl}/` : "",');
replaceRequired("worker.js", "          liveUrl: 'https://qqai.ray2025.com/live'", '          liveUrl: configuredHelpBaseUrl ? `${configuredHelpBaseUrl}/live` : ""');

let worker = read("worker.js");
worker = worker.replace(
  /Boolean\(operatorId && \(operatorId === String\(env\.DEVELOPER_ID \|\| ['"]3569028262['"]\) \|\| operatorId === ['"]3569028262['"]\)\)/g,
  "isDeveloperId(env, operatorId)"
);
worker = worker.replace(
  'const isDeveloper = (env.DEVELOPER_ID ? userId === env.DEVELOPER_ID.toString() : false) || userId === "3569028262";',
  'const isDeveloper = isDeveloperId(env, userId);'
);
worker = worker.replace(
  'const relationshipDeveloperId = String(env.DEVELOPER_ID || "3569028262");',
  'const relationshipDeveloperIds = new Set(developerIds(env));'
);
worker = worker.replace(/member\.qq !== relationshipDeveloperId/g, "!relationshipDeveloperIds.has(member.qq)");
worker = worker.replace(
  /(targetUserId|targetQq) === ["']3569028262["'] \|\| \(env\.DEVELOPER_ID && \1 === env\.DEVELOPER_ID\.toString\(\)\)/g,
  (_match, variable) => `isDeveloperId(env, ${variable})`
);
if (worker.includes("3569028262") || worker.includes("env.DEVELOPER_ID")) {
  throw new Error("worker.js still contains a personal or single-developer hardcoded check");
}
write("worker.js", worker);

// Package and permanent regression chain.
const packageJson = JSON.parse(read("package.json"));
packageJson.version = "2.7.12";
if (!packageJson.scripts.check.includes("verify-configurable-deployment.mjs")) {
  packageJson.scripts.check += " && node verify-configurable-deployment.mjs";
}
write("package.json", JSON.stringify(packageJson, null, 2) + "\n");

// Existing version fixtures follow the current runtime version. The new configurability
// regression intentionally retains the phrase "from 2.7.11" for upgrade documentation.
for (const path of fs.readdirSync(".").filter(name => /^verify-.*\.mjs$/.test(name) && name !== "verify-configurable-deployment.mjs")) {
  const source = read(path);
  if (source.includes("2.7.11")) write(path, source.replaceAll("2.7.11", "2.7.12"));
  if (source.includes("3569028262")) write(path, read(path).replaceAll("3569028262", "999999999"));
}

// Update the prior README regression for the new complete configuration guide.
replaceRequired(
  "verify-entertainment-help-readme-errors.mjs",
  'assert.match(readme, /群組人格最多保存 12,000 字元/);',
  'assert.match(readme, /群組人格最多(?:保存)? 12,000 字元/);'
);
replaceRequired(
  "verify-entertainment-help-readme-errors.mjs",
  'assert.match(readme, /每頁最多 100 筆/);',
  'assert.match(readme, /Portal／群組動態設定/);'
);

// Guard the final generated candidate.
for (const path of [
  "src/config/runtime.js",
  "src/core/identity.js",
  "src/deployment/notifications.js",
  "src/integrations/bilibili.js",
  "src/moderation/runtime.js",
  "worker.js",
  "wrangler.toml",
  "README.md"
]) {
  if (read(path).includes("3569028262")) throw new Error(`${path} still contains the maintainer QQ`);
}

console.log("Applied v2.7.12 configurable deployment integration.");
