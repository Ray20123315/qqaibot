import assert from "node:assert/strict";
import {
  MODERATION_APPROVAL_MODES,
  moderationApprovalDecision,
  moderationApprovalModeLabel,
  normalizeModerationApprovalMode
} from "./src/moderation/approval-mode.js";

assert.deepEqual(MODERATION_APPROVAL_MODES, ["require_approval", "smart_approval", "full_access"]);
assert.equal(normalizeModerationApprovalMode("要求核准"), "require_approval");
assert.equal(normalizeModerationApprovalMode("代我核准"), "smart_approval");
assert.equal(normalizeModerationApprovalMode("完整存取權"), "full_access");
assert.equal(moderationApprovalModeLabel("smart_approval"), "代我核准");

for (const action of ["remind", "warn", "recall", "mute", "kick"]) {
  assert.equal(moderationApprovalDecision("require_approval", action).requiresApproval, true);
}
assert.equal(moderationApprovalDecision("smart_approval", "remind").autoExecute, true);
assert.equal(moderationApprovalDecision("smart_approval", "warn").autoExecute, true);
for (const action of ["recall", "mute", "kick", "set_admin", "whole_mute"]) {
  assert.equal(moderationApprovalDecision("smart_approval", action).requiresApproval, true);
  assert.equal(moderationApprovalDecision("full_access", action).autoExecute, true);
}
console.log("verify-moderation-approval-modes: ok");
