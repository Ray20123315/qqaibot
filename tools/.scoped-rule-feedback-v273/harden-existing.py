from __future__ import annotations

import json
from pathlib import Path

ROOT = Path('.')
RUNTIME = ROOT / 'src/moderation/runtime.js'
TEST = ROOT / 'verify-scoped-rule-feedback.mjs'
RELEASE = ROOT / 'release-notes.json'


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected exactly one match, got {count}')
    return text.replace(old, new, 1)


runtime = RUNTIME.read_text(encoding='utf-8')

if 'async function migrateLegacyRuleViolationPolicyNotes' not in runtime:
    migration = r'''function sanitizeLegacyRuleViolationRecord(item, now = Date.now()) {
  if (!item || typeof item !== "object") return null;
  const before = String(item.policyNote || "").trim().slice(0, 2000);
  const policyNote = stripLegacyHumanCorrectionLines(before);
  if (policyNote === before) return null;
  return {
    ...item,
    policyNote,
    legacyPolicyNoteCleanedAt: Number(now || Date.now()),
    updatedAt: Number(now || Date.now())
  };
}


async function migrateLegacyRuleViolationPolicyNotes(env, groupId, batchSize = 50) {
  const stateKey = `rule_policy_note_migration_v273:${groupId}`;
  const previous = await readJson(env, stateKey, null);
  if (previous?.done === true) return previous;
  const ids = await readJson(env, `ruleviolation:index:${groupId}`, []);
  const list = Array.isArray(ids) ? ids.map(String).filter(Boolean) : [];
  const previousCursor = Number(previous?.cursor);
  const cursor = Number.isFinite(previousCursor)
    ? Math.max(0, Math.min(list.length, Math.trunc(previousCursor)))
    : list.length;
  const safeBatchSize = Math.max(1, Math.min(100, Math.trunc(Number(batchSize || 50))));
  const start = Math.max(0, cursor - safeBatchSize);
  let checked = 0;
  let cleaned = 0;
  const cleanedIds = [];
  const migrationAt = Date.now();
  for (const id of list.slice(start, cursor).reverse()) {
    const item = await readJson(env, `ruleviolation:${id}`, null);
    if (!item) continue;
    checked += 1;
    const next = sanitizeLegacyRuleViolationRecord(item, migrationAt);
    if (!next) continue;
    await dbPut(env, `ruleviolation:${id}`, JSON.stringify(next));
    cleaned += 1;
    cleanedIds.push(id);
  }
  const state = {
    version: 1,
    totalAtStart: Number(previous?.totalAtStart || list.length),
    cursor: start,
    done: start === 0,
    checked: Number(previous?.checked || 0) + checked,
    cleaned: Number(previous?.cleaned || 0) + cleaned,
    lastBatchChecked: checked,
    lastBatchCleaned: cleaned,
    updatedAt: migrationAt,
    completedAt: start === 0 ? migrationAt : Number(previous?.completedAt || 0)
  };
  await dbPut(env, stateKey, JSON.stringify(state));
  if (cleaned > 0 || state.done) {
    await writeSystemAudit(env, {
      type: "rule_violation_policy_note_migration",
      groupId: String(groupId || ""),
      actorId: "system:migration_v273",
      action: state.done ? "completed" : "batch",
      checked,
      cleaned,
      cleanedIds: cleanedIds.slice(0, 50),
      remaining: start
    }).catch(() => {});
  }
  return state;
}


'''
    runtime = replace_once(
        runtime,
        'async function getRuleCategoryPolicies(env, groupId) {',
        migration + 'async function getRuleCategoryPolicies(env, groupId) {',
        'insert historical record migration',
    )
    runtime = replace_once(
        runtime,
        '  return normalized;\n}\n\n\n\nfunction matchRuleCategoryPolicy',
        '  await migrateLegacyRuleViolationPolicyNotes(env, groupId);\n  return normalized;\n}\n\n\n\nfunction matchRuleCategoryPolicy',
        'run historical record migration while reading policies',
    )
    runtime = replace_once(
        runtime,
        'normalizeRuleSeverity, normalizeRuleStrictness, selectRelevantRuleFeedbackExamples, stripLegacyHumanCorrectionLines, parseModerationConfirmation,',
        'normalizeRuleSeverity, normalizeRuleStrictness, sanitizeLegacyRuleViolationRecord, selectRelevantRuleFeedbackExamples, stripLegacyHumanCorrectionLines, parseModerationConfirmation,',
        'export historical record sanitizer',
    )

for required in [
    'async function migrateLegacyRuleViolationPolicyNotes',
    'rule_policy_note_migration_v273:',
    'rule_violation_policy_note_migration',
    'await migrateLegacyRuleViolationPolicyNotes(env, groupId);',
    'sanitizeLegacyRuleViolationRecord',
]:
    if required not in runtime:
        raise RuntimeError(f'missing migration invariant: {required}')
RUNTIME.write_text(runtime, encoding='utf-8')

test = TEST.read_text(encoding='utf-8')
if 'sanitizeLegacyRuleViolationRecord' not in test.split('\n', 8)[0:8].__str__():
    test = replace_once(
        test,
        '  normalizeRuleCategoryPolicies,\n  selectRelevantRuleFeedbackExamples,',
        '  normalizeRuleCategoryPolicies,\n  sanitizeLegacyRuleViolationRecord,\n  selectRelevantRuleFeedbackExamples,',
        'import historical record sanitizer',
    )
if 'historical = sanitizeLegacyRuleViolationRecord' not in test:
    anchor = 'assert.equal(normalized[0].note, "无法归入明确分类时只记录，交由管理复核。", "normalized category policy must not retain polluted correction text");\n'
    addition = anchor + '\nconst historical = sanitizeLegacyRuleViolationRecord({ id: "rv_old", policyNote: polluted, content: "其他人的消息" }, 123456);\nassert.equal(historical.policyNote, "无法归入明确分类时只记录，交由管理复核。", "existing violation records must lose copied legacy correction lines");\nassert.equal(historical.legacyPolicyNoteCleanedAt, 123456);\nassert.equal(sanitizeLegacyRuleViolationRecord({ policyNote: "管理员自定义说明" }, 123456), null, "clean historical records must not be rewritten");\n'
    test = replace_once(test, anchor, addition, 'add historical record sanitizer tests')
if 'rule_policy_note_migration_v273' not in test:
    anchor = 'assert.ok(source.includes("rule_policy_legacy_correction_cleanup"), "legacy policy cleanup migration must exist");\n'
    addition = anchor + 'assert.ok(source.includes("rule_policy_note_migration_v273"), "existing violation records must be cleaned in bounded migration batches");\nassert.ok(source.includes("rule_violation_policy_note_migration"), "historical migration must be auditable");\n'
    test = replace_once(test, anchor, addition, 'add migration source assertions')
TEST.write_text(test, encoding='utf-8')

release = json.loads(RELEASE.read_text(encoding='utf-8'))
fixed = list(release.get('fixed') or [])
old = '人工误判纠错不再写入整个分类备注；旧版自动追加的人工纠错行会安全清理，AI 只参考与当前消息内容相似的纠错样本'
new = '人工误判纠错不再写入整个分类备注；旧版分类及既有违规记录中的自动纠错行会分批安全清理，AI 只参考与当前消息内容相似的纠错样本'
fixed = [new if item == old else item for item in fixed]
if new not in fixed:
    fixed.insert(0, new)
release['fixed'] = fixed
RELEASE.write_text(json.dumps(release, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

print('harden-existing-rule-feedback-v2.7.3: ok')
