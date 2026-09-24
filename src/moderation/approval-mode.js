const MODERATION_APPROVAL_MODES = Object.freeze([
  "require_approval",
  "smart_approval",
  "full_access"
]);

function normalizeModerationApprovalMode(value) {
  const raw = String(value || "").trim().toLowerCase();
  const aliases = {
    "要求核准": "require_approval",
    "每次核准": "require_approval",
    "require": "require_approval",
    "require_approval": "require_approval",
    "代我核准": "smart_approval",
    "智慧核准": "smart_approval",
    "smart": "smart_approval",
    "smart_approval": "smart_approval",
    "完整存取權": "full_access",
    "完整存取权": "full_access",
    "完整": "full_access",
    "full": "full_access",
    "full_access": "full_access"
  };
  return aliases[raw] || "require_approval";
}

function moderationApprovalModeLabel(value) {
  return ({
    require_approval: "要求核准",
    smart_approval: "代我核准",
    full_access: "完整存取權"
  })[normalizeModerationApprovalMode(value)];
}

function moderationApprovalModeDescription(value) {
  return ({
    require_approval: "所有對 QQ 群產生外部效果的自動管理動作（包含提醒、警告、撤回、禁言與踢出）都先建立提案，必須由管理員核准。",
    smart_approval: "提醒與警告可自動處理；撤回、禁言、踢出與權限變更仍要求核准。",
    full_access: "在機器人原本已擁有的 QQ 群權限內自動執行；仍保留角色、保護名單、黑名單與不可提權等安全限制。"
  })[normalizeModerationApprovalMode(value)];
}

function moderationActionNeedsApproval(mode, action) {
  const normalized = normalizeModerationApprovalMode(mode);
  const name = String(action || "").trim().toLowerCase();
  if (!name || ["record", "manual", "none"].includes(name)) return true;
  if (normalized === "full_access") return false;
  if (normalized === "smart_approval") return !["remind", "warn"].includes(name);
  return true;
}

function moderationApprovalDecision(mode, action) {
  const normalized = normalizeModerationApprovalMode(mode);
  const name = String(action || "").trim().toLowerCase();
  const requiresApproval = moderationActionNeedsApproval(normalized, name);
  return Object.freeze({
    mode: normalized,
    label: moderationApprovalModeLabel(normalized),
    action: name,
    requiresApproval,
    autoExecute: !requiresApproval
  });
}

export {
  MODERATION_APPROVAL_MODES,
  moderationActionNeedsApproval,
  moderationApprovalDecision,
  moderationApprovalModeDescription,
  moderationApprovalModeLabel,
  normalizeModerationApprovalMode
};
