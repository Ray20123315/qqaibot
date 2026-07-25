import fs from "node:fs";

function read(path) { return fs.readFileSync(path, "utf8"); }
function write(path, value) { fs.writeFileSync(path, value); }
function replaceOnce(source, before, after, label) {
  const index = source.indexOf(before);
  if (index < 0) throw new Error(`Missing patch anchor: ${label}`);
  if (source.indexOf(before, index + before.length) >= 0) throw new Error(`Ambiguous patch anchor: ${label}`);
  return source.slice(0, index) + after + source.slice(index + before.length);
}
function insertBeforeOnce(source, marker, insertion, label) {
  const index = source.indexOf(marker);
  if (index < 0) throw new Error(`Missing insertion anchor: ${label}`);
  if (source.indexOf(marker, index + marker.length) >= 0) throw new Error(`Ambiguous insertion anchor: ${label}`);
  return source.slice(0, index) + insertion + marker + source.slice(index);
}

const path = "src/moderation/runtime.js";
let source = read(path);

const helpers = [
  "function normalizeSpamBurstText(value) {",
  "  return String(value || \"\")",
  "    .normalize(\"NFKC\")",
  "    .toLowerCase()",
  "    .replace(/[\\s\\u200B-\\u200D\\uFEFF.,!?，。！？、~～\\\"'“”‘’（）()【】{}<>《》:：;；_\\-]/g, \"\")",
  "    .slice(0, 1000);",
  "}",
  "",
  "function spamTextSimilarity(left, right) {",
  "  const a = normalizeSpamBurstText(left);",
  "  const b = normalizeSpamBurstText(right);",
  "  if (!a || !b) return 0;",
  "  if (a === b) return 1;",
  "  const minLength = Math.min(a.length, b.length);",
  "  const maxLength = Math.max(a.length, b.length);",
  "  if (minLength < 4 || maxLength - minLength > Math.max(2, Math.floor(minLength * 0.35))) return 0;",
  "  let prefix = 0;",
  "  while (prefix < minLength && a[prefix] === b[prefix]) prefix += 1;",
  "  let suffix = 0;",
  "  while (suffix < minLength - prefix && a[a.length - 1 - suffix] === b[b.length - 1 - suffix]) suffix += 1;",
  "  const edgeRatio = Math.max(prefix, suffix) / minLength;",
  "  const grams = value => {",
  "    const set = new Set();",
  "    for (let index = 0; index < value.length - 1; index++) set.add(value.slice(index, index + 2));",
  "    return set;",
  "  };",
  "  const leftGrams = grams(a);",
  "  const rightGrams = grams(b);",
  "  let intersection = 0;",
  "  for (const gram of leftGrams) if (rightGrams.has(gram)) intersection += 1;",
  "  const union = new Set([...leftGrams, ...rightGrams]).size || 1;",
  "  return Math.max(edgeRatio, intersection / union);",
  "}",
  "",
  "function detectRepeatedMessageBurst(rows, currentText, threshold = DEFAULTS.ruleSpamThreshold, keepCount = DEFAULTS.ruleSpamKeepCount) {",
  "  const safeThreshold = Math.max(2, Math.min(50, Number(threshold || DEFAULTS.ruleSpamThreshold)));",
  "  const safeKeepCount = Math.max(0, Math.min(safeThreshold - 1, Number(keepCount || 0)));",
  "  const currentNormalized = normalizeSpamBurstText(currentText);",
  "  const prepared = (Array.isArray(rows) ? rows : []).map(row => ({",
  "    ...row,",
  "    normalized: normalizeSpamBurstText(row?.normalized || row?.text || \"\")",
  "  })).filter(row => row.normalized);",
  "  const exactRows = prepared.filter(row => row.normalized === currentNormalized);",
  "  const similarRows = prepared.filter(row => spamTextSimilarity(row.normalized, currentNormalized) >= 0.8);",
  "  let trailingSameCount = 0;",
  "  for (let index = prepared.length - 1; index >= 0; index--) {",
  "    if (prepared[index].normalized !== currentNormalized) break;",
  "    trailingSameCount += 1;",
  "  }",
  "  const repeatedMessageBurst = exactRows.length >= safeThreshold || similarRows.length >= safeThreshold + 1;",
  "  const evidenceRows = exactRows.length >= safeThreshold ? exactRows : similarRows;",
  "  return {",
  "    currentNormalized, exactSameCount: exactRows.length, similarMessageCount: similarRows.length, trailingSameCount, repeatedMessageBurst,",
  "    repeatedMessageIds: repeatedMessageBurst",
  "      ? evidenceRows.slice(Math.min(safeKeepCount, evidenceRows.length)).map(row => String(row.messageId || \"\")).filter(Boolean)",
  "      : []",
  "  };",
  "}",
  "",
  ""
].join("\n");
source = insertBeforeOnce(source, "async function inspectMessageAgainstGroupRules(env, {", helpers, "spam helper functions");
source = replaceOnce(source, '  if (!rules) return { status: "no_rules" };\n', "", "remove early no-rules return");
source = replaceOnce(source,
  '  const normalizeBurstText = value => String(value || "").replace(/\\s+/g, " ").trim().toLowerCase();',
  "  const normalizeBurstText = normalizeSpamBurstText;",
  "spam normalizer"
);

const oldBurstDecision = [
  "  const currentNormalized = normalizeBurstText(content);",
  "  let trailingSameCount = 0;",
  "  for (let index = burstRows.length - 1; index >= 0; index--) {",
  "    if (burstRows[index].normalized !== currentNormalized) break;",
  "    trailingSameCount += 1;",
  "  }",
  "  const repeatedMessageBurst = trailingSameCount >= spamThreshold;",
  "  const excessCount = repeatedMessageBurst ? Math.max(1, trailingSameCount - spamKeepCount) : 0;",
  "  const repeatedMessageIds = repeatedMessageBurst",
  "    ? burstRows.slice(-excessCount).map(row => row.messageId).filter(Boolean)",
  "    : [];"
].join("\n");
const newBurstDecision = [
  "  const burstDecision = detectRepeatedMessageBurst(burstRows, content, spamThreshold, spamKeepCount);",
  "  const currentNormalized = burstDecision.currentNormalized;",
  "  const trailingSameCount = burstDecision.trailingSameCount;",
  "  const exactSameCount = burstDecision.exactSameCount;",
  "  const similarMessageCount = burstDecision.similarMessageCount;",
  "  const repeatedMessageBurst = burstDecision.repeatedMessageBurst;",
  "  const repeatedMessageIds = burstDecision.repeatedMessageIds;",
  "  const deterministicSpamCount = Math.max(exactSameCount, similarMessageCount);",
  "  const deterministicSpamReview = repeatedMessageBurst ? {",
  "    violation: true, confidence: 1, violationType: \"公共秩序\",",
  "    rule: rules ? \"本群刷屏规则\" : \"系统默认反刷屏规则\",",
  "    reason: `${spamWindowSeconds} 秒内同一成员发送相同或高度相似内容 ${deterministicSpamCount} 次，达到刷屏门槛 ${spamThreshold} 次。`,",
  "    severity: deterministicSpamCount >= spamThreshold + 3 ? \"severe\" : \"moderate\",",
  "    intentional: true, action: \"recall\", muteSeconds: 0, testContext: false, linkAssessment: \"无链接\", deterministic: true",
  "  } : null;",
  "  if (!rules && !deterministicSpamReview) return { status: \"no_rules\" };"
].join("\n");
source = replaceOnce(source, oldBurstDecision, newBurstDecision, "deterministic burst decision");
source = replaceOnce(source, "  let review;\n  try {", [
  "  let review;",
  "  if (deterministicSpamReview) {",
  "    review = deterministicSpamReview;",
  "  } else {",
  "  try {"
].join("\n"), "skip AI for deterministic spam");
source = replaceOnce(source,
  '    return { status: "pending_review", reason, clarification };\n  }\n  await opsRecordAutomationResult(env, groupId, "rule_monitor", true).catch(() => {});',
  [
    '    return { status: "pending_review", reason, clarification };',
    "  }",
    "  }",
    '  await opsRecordAutomationResult(env, groupId, "rule_monitor", true).catch(() => {});'
  ].join("\n"),
  "close deterministic spam AI branch"
);
source = replaceOnce(source,
  "        repeatedMessageBurst,\n        trailingSameCount,\n        spamWindowSeconds,",
  "        repeatedMessageBurst,\n        trailingSameCount,\n        exactSameCount,\n        similarMessageCount,\n        spamWindowSeconds,",
  "spam evidence payload"
);
source = replaceOnce(source, "export { addRuleStrike,", "export { addRuleStrike, detectRepeatedMessageBurst,", "export spam detector");
write(path, source);

const spamTest = [
  'import assert from "node:assert/strict";',
  'import fs from "node:fs";',
  'import { detectRepeatedMessageBurst } from "./src/moderation/runtime.js";',
  "",
  "const exactRows = [",
  '  { messageId: "1", text: "我要告老师了" },',
  '  { messageId: "2", text: "我要告老师了" },',
  '  { messageId: "3", text: "我要告老师了" },',
  '  { messageId: "4", text: "我要告老师了" }',
  "];",
  'const exact = detectRepeatedMessageBurst(exactRows, "我要告老师了", 4, 3);',
  'assert.equal(exact.repeatedMessageBurst, true, "Four identical messages must be deterministic spam");',
  "assert.equal(exact.exactSameCount, 4);",
  'assert.deepEqual(exact.repeatedMessageIds, ["4"]);',
  "",
  "const variantRows = [",
  '  { messageId: "a", text: "我要告老师了" },',
  '  { messageId: "b", text: "我要告老师吗" },',
  '  { messageId: "c", text: "我要告老师了" },',
  '  { messageId: "d", text: "我要告老师呢" },',
  '  { messageId: "e", text: "我要告老师了" }',
  "];",
  'const variant = detectRepeatedMessageBurst(variantRows, "我要告老师了", 4, 3);',
  'assert.equal(variant.repeatedMessageBurst, true, "Near-identical variants must not reset spam detection");',
  "assert.equal(variant.exactSameCount, 3);",
  "assert.equal(variant.similarMessageCount, 5);",
  "",
  'const source = fs.readFileSync("src/moderation/runtime.js", "utf8");',
  'assert(!source.includes(\'if (!rules) return { status: "no_rules" };\'), "Spam detection must run without configured group rules");',
  'assert(source.indexOf("const deterministicSpamReview") < source.indexOf("callGoogleDecision(env"), "Deterministic spam must be decided before AI review");',
  'assert(source.includes("if (deterministicSpamReview)"), "Deterministic spam must bypass AI review");',
  'console.log("spam detection checks passed");',
  ""
].join("\n");
write("verify-spam-detection.mjs", spamTest);
