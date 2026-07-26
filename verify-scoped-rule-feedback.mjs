import fs from "node:fs";
import assert from "node:assert/strict";
import {
  normalizeRuleCategoryPolicies,
  sanitizeLegacyRuleViolationRecord,
  selectRelevantRuleFeedbackExamples,
  stripLegacyHumanCorrectionLines
} from "./src/moderation/runtime.js";

const polluted = "无法归入明确分类时只记录，交由管理复核。\n人工纠错 2026-07-25（QQ:3569028262）：这属于近期的一个梗 by.叶北尘喵 QQ 473204883";
assert.equal(stripLegacyHumanCorrectionLines(polluted), "无法归入明确分类时只记录，交由管理复核。", "legacy per-record correction line must be removed");
assert.equal(stripLegacyHumanCorrectionLines("管理员自定义说明：人工纠错流程需复核"), "管理员自定义说明：人工纠错流程需复核", "legitimate administrator-authored note must remain");

const normalized = normalizeRuleCategoryPolicies([{ name: "管理员记录", punishment: "manual", note: polluted }]);
assert.equal(normalized[0].note, "无法归入明确分类时只记录，交由管理复核。", "normalized category policy must not retain polluted correction text");

const historical = sanitizeLegacyRuleViolationRecord({ id: "rv_old", policyNote: polluted, content: "其他人的消息" }, 123456);
assert.equal(historical.policyNote, "无法归入明确分类时只记录，交由管理复核。", "existing violation records must lose copied legacy correction lines");
assert.equal(historical.legacyPolicyNoteCleanedAt, 123456);
assert.equal(sanitizeLegacyRuleViolationRecord({ policyNote: "管理员自定义说明" }, 123456), null, "clean historical records must not be rewritten");

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
assert.ok(source.includes("rule_policy_note_migration_v273"), "existing violation records must be cleaned in bounded migration batches");
assert.ok(source.includes("rule_violation_policy_note_migration"), "historical migration must be auditable");
assert.ok(!source.includes("const correction = `人工纠错"), "per-record correction must not be appended to global policy notes");
assert.ok(source.includes("resolveAdaptiveRuleStrictness(env, groupId, recentContext, recentRuleFeedback)"), "aggregate feedback may still tune smart strictness without exposing unrelated notes");

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const notes = JSON.parse(fs.readFileSync("release-notes.json", "utf8"));
assert.equal(pkg.version, "2.7.3");
assert.equal(notes.version, "2.7.3");
assert.match(pkg.scripts.check, /verify-scoped-rule-feedback\.mjs/);
console.log("verify-scoped-rule-feedback: ok");
