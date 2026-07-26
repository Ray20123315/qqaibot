from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path('.')
RUNTIME = ROOT / 'src/moderation/runtime.js'
PACKAGE = ROOT / 'package.json'
RELEASE = ROOT / 'release-notes.json'
CONFIG = ROOT / 'src/config/runtime.js'
TEST = ROOT / 'verify-scoped-rule-feedback.mjs'


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected exactly one match, got {count}')
    return text.replace(old, new, 1)


def regex_replace_once(text: str, pattern: str, replacement: str, label: str) -> str:
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError(f'{label}: expected exactly one regex match, got {count}')
    return updated


runtime = RUNTIME.read_text(encoding='utf-8')

strip_helper = r'''function stripLegacyHumanCorrectionLines(value) {
  return String(value || "")
    .split(/\r?\n/)
    .filter(line => !/^\s*人工(?:纠错|糾錯)\s+\d{4}-\d{2}-\d{2}\s*[（(]QQ[:：]?\d+[）)]\s*[:：]/.test(String(line || "")))
    .join("\n")
    .trim()
    .slice(0, 2000);
}


'''
runtime = replace_once(
    runtime,
    'function normalizeRuleCategoryPolicies(value, fallbackPolicies = null) {',
    strip_helper + 'function normalizeRuleCategoryPolicies(value, fallbackPolicies = null) {',
    'insert legacy correction sanitizer',
)
runtime = replace_once(
    runtime,
    'note: String(raw?.note || "").trim().slice(0, 2000),',
    'note: stripLegacyHumanCorrectionLines(raw?.note),',
    'sanitize configured category note',
)
runtime = replace_once(
    runtime,
    'return { ...raw, punishment: actions[0].action, actions, note: String(raw?.note || "").slice(0, 2000), muteSeconds: actions.find(item => item.action === "mute")?.muteSeconds || parseUnlimitedNonNegativeInteger(raw?.muteSeconds, 0) };',
    'return { ...raw, punishment: actions[0].action, actions, note: stripLegacyHumanCorrectionLines(raw?.note), muteSeconds: actions.find(item => item.action === "mute")?.muteSeconds || parseUnlimitedNonNegativeInteger(raw?.muteSeconds, 0) };',
    'sanitize fallback category note',
)

old_get_policies = '''async function getRuleCategoryPolicies(env, groupId) {
  return normalizeRuleCategoryPolicies(await readJson(env, `rule_category_policies:${groupId}`, null), defaultRuleCategoryPolicies(groupId));
}'''
new_get_policies = '''async function getRuleCategoryPolicies(env, groupId) {
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
  return normalized;
}'''
runtime = replace_once(runtime, old_get_policies, new_get_policies, 'migrate legacy polluted policy notes')

similarity_helper = r'''function selectRelevantRuleFeedbackExamples(content, examples, limit = 8) {
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


'''
runtime = replace_once(
    runtime,
    'function detectRepeatedMessageBurst(rows, currentText, threshold = DEFAULTS.ruleSpamThreshold, keepCount = DEFAULTS.ruleSpamKeepCount) {',
    similarity_helper + 'function detectRepeatedMessageBurst(rows, currentText, threshold = DEFAULTS.ruleSpamThreshold, keepCount = DEFAULTS.ruleSpamKeepCount) {',
    'insert relevant feedback selector',
)

old_feedback_load = '''  const categoryPolicies = await getRuleCategoryPolicies(env, groupId);
  const humanFeedbackExamples = await readRecentRuleFeedbackExamples(env, groupId, 30);
  const learnedMemeExamples = await readRuleMemeExamples(env, groupId, 60);
  const strictness = await resolveAdaptiveRuleStrictness(env, groupId, recentContext, humanFeedbackExamples);'''
new_feedback_load = '''  const categoryPolicies = await getRuleCategoryPolicies(env, groupId);
  const recentRuleFeedback = await readRecentRuleFeedbackExamples(env, groupId, 30);
  const humanFeedbackExamples = selectRelevantRuleFeedbackExamples(content, recentRuleFeedback, 8);
  const learnedMemeExamples = await readRuleMemeExamples(env, groupId, 60);
  const strictness = await resolveAdaptiveRuleStrictness(env, groupId, recentContext, recentRuleFeedback);'''
runtime = replace_once(runtime, old_feedback_load, new_feedback_load, 'scope model feedback examples')

runtime = replace_once(
    runtime,
    '证据优先级（不得颠倒）：明确群规与有效临时规则 > 群规例外 > 图片直接内容证据 > 分类备注与人工纠错 > 最近语境与模型常识。',
    '证据优先级（不得颠倒）：明确群规与有效临时规则 > 群规例外 > 图片直接内容证据 > 分类备注与“仅限当前相似表达”的人工纠错样本 > 最近语境与模型常识。',
    'clarify feedback evidence scope',
)
runtime = replace_once(
    runtime,
    '7. 管理人工复核结果是学习样本；被标记为误判的相似表达不得再次仅凭表面词语判违规。',
    '7. 管理人工复核结果是单条学习样本，只能影响内容实质相似的表达；禁止把某一人的单笔纠错备注当成整个分类或所有后续消息的规则。被标记为误判的相似表达不得再次仅凭表面词语判违规。',
    'strengthen per-record feedback rule',
)

new_append_correction = '''async function appendHumanCorrectionToRulePolicy(env, item, actorId, note) {
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



async function recordRuleViolationFeedback'''
runtime = regex_replace_once(
    runtime,
    r'async function appendHumanCorrectionToRulePolicy\(env, item, actorId, note\) \{.*?\n\}\n\n\n\nasync function recordRuleViolationFeedback',
    new_append_correction,
    'disable global category mutation for per-record correction',
)

runtime = replace_once(
    runtime,
    'policyNote: String(data.policyNote || "").slice(0, 2000),',
    'policyNote: stripLegacyHumanCorrectionLines(data.policyNote),',
    'sanitize policy note copied into new records',
)

runtime = replace_once(
    runtime,
    'normalizeRuleSeverity, normalizeRuleStrictness, parseModerationConfirmation,',
    'normalizeRuleSeverity, normalizeRuleStrictness, selectRelevantRuleFeedbackExamples, stripLegacyHumanCorrectionLines, parseModerationConfirmation,',
    'export scoped feedback helpers',
)

for required in [
    'rule_feedback_scoped_to_record',
    'rule_policy_legacy_correction_cleanup',
    'selectRelevantRuleFeedbackExamples(content, recentRuleFeedback, 8)',
    'policyNote: stripLegacyHumanCorrectionLines(data.policyNote)',
]:
    if required not in runtime:
        raise RuntimeError(f'missing generated invariant: {required}')
if 'const correction = `人工纠错' in runtime:
    raise RuntimeError('legacy global correction mutation still present')
RUNTIME.write_text(runtime, encoding='utf-8')

pkg = json.loads(PACKAGE.read_text(encoding='utf-8'))
pkg['version'] = '2.7.3'
check = str(pkg.get('scripts', {}).get('check', ''))
if 'verify-scoped-rule-feedback.mjs' not in check:
    check = check.rstrip() + ' && node verify-scoped-rule-feedback.mjs'
pkg.setdefault('scripts', {})['check'] = check
PACKAGE.write_text(json.dumps(pkg, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

release = json.loads(RELEASE.read_text(encoding='utf-8'))
release['version'] = '2.7.3'
fixed = list(release.get('fixed') or [])
entry = '人工误判纠错不再写入整个分类备注；旧版自动追加的人工纠错行会安全清理，AI 只参考与当前消息内容相似的纠错样本'
if entry not in fixed:
    fixed.insert(0, entry)
release['fixed'] = fixed
RELEASE.write_text(json.dumps(release, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

config = CONFIG.read_text(encoding='utf-8')
config = replace_once(config, 'const VERSION = "2.7.2";', 'const VERSION = "2.7.3";', 'bump runtime version')
CONFIG.write_text(config, encoding='utf-8')

for path in sorted(ROOT.glob('verify-*.mjs')):
    if path == TEST:
        continue
    text = path.read_text(encoding='utf-8')
    if '2.7.2' in text:
        path.write_text(text.replace('2.7.2', '2.7.3'), encoding='utf-8')

TEST.write_text(r'''import fs from "node:fs";
import assert from "node:assert/strict";
import {
  normalizeRuleCategoryPolicies,
  selectRelevantRuleFeedbackExamples,
  stripLegacyHumanCorrectionLines
} from "./src/moderation/runtime.js";

const polluted = "无法归入明确分类时只记录，交由管理复核。\n人工纠错 2026-07-25（QQ:3569028262）：这属于近期的一个梗 by.叶北尘喵 QQ 473204883";
assert.equal(stripLegacyHumanCorrectionLines(polluted), "无法归入明确分类时只记录，交由管理复核。", "legacy per-record correction line must be removed");
assert.equal(stripLegacyHumanCorrectionLines("管理员自定义说明：人工纠错流程需复核"), "管理员自定义说明：人工纠错流程需复核", "legitimate administrator-authored note must remain");

const normalized = normalizeRuleCategoryPolicies([{ name: "管理员记录", punishment: "manual", note: polluted }]);
assert.equal(normalized[0].note, "无法归入明确分类时只记录，交由管理复核。", "normalized category policy must not retain polluted correction text");

const examples = [
  { content: "这属于近期的一个梗", verdict: "not_violation", note: "群内梗" },
  { content: "这属于近期的一个梗！", verdict: "not_violation", note: "近似写法" },
  { content: "我要告老师了", verdict: "not_violation", note: "完全无关" }
];
const relevant = selectRelevantRuleFeedbackExamples("这属于近期的一个梗", examples, 8);
assert.equal(relevant.length, 2, "only materially similar feedback examples may be supplied to the model");
assert.ok(relevant.every(item => item.note !== "完全无关"));
assert.deepEqual(selectRelevantRuleFeedbackExamples("[图片]", examples, 8), [], "unrelated image placeholder must not inherit an old meme correction");

const source = fs.readFileSync("src/moderation/runtime.js", "utf8");
assert.ok(source.includes("rule_feedback_scoped_to_record"), "per-record correction audit must exist");
assert.ok(source.includes("rule_policy_legacy_correction_cleanup"), "legacy policy cleanup migration must exist");
assert.ok(!source.includes("const correction = `人工纠错"), "per-record correction must not be appended to global policy notes");
assert.ok(source.includes("resolveAdaptiveRuleStrictness(env, groupId, recentContext, recentRuleFeedback)"), "aggregate feedback may still tune smart strictness without exposing unrelated notes");

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const notes = JSON.parse(fs.readFileSync("release-notes.json", "utf8"));
assert.equal(pkg.version, "2.7.3");
assert.equal(notes.version, "2.7.3");
assert.match(pkg.scripts.check, /verify-scoped-rule-feedback\.mjs/);
console.log("verify-scoped-rule-feedback: ok");
''', encoding='utf-8')

print('apply-scoped-rule-feedback-v2.7.3: ok')
