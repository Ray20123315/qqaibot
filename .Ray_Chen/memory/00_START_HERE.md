# Ray_Chen Memory Entry

- memory_version: v0.0.22
- project: QQAIBOT
- repository: Ray20123315/qqaibot
- canonical_branch: main
- development_branch: v4-qqopen-native
- task_id: qqaibot-20260928-full-command-panels-portal
- task_status: active
- goal_revision: 1
- base_product_revision: fd11cd640cae1124edc03b0fef3d8d8d529cc52b
- base_repository_head: 3dcd7b052c60add687a097257c47cca9f7adb016
- updated_at: 2026-09-28T13:20:00+08:00

## Current Goal

Restore the complete QQAI 2.7.12 command/function surface, expose it through categorized QQ official discovery instead of a flat command dump, and restore the full Portal without changing QQ Open/AIBot primary ownership.

## Confirmed Design

- Group command discovery uses multiple category panels because QQ PanelItem supports command/link items but no nested child panel.
- C2C custom menu uses QQ's supported menu + sub_menu_items structure for category/subcommand discovery.
- Panel visibility is a discoverability layer, not the security boundary; existing server-side permission/confirmation checks remain authoritative.
- QQ Open/AIBot remains the only user-facing command target.
- Legacy OneBot remains an internal execution fallback only when the official path cannot safely perform an action.
- Existing QQAI 2.7.12 handlers are reused; command discovery must not imply a feature rewrite or deletion.

## Recovery Route

1. Read ACTIVE_TASK.md, CURRENT_STATE.md, USER_REQUIREMENTS.md, DECISIONS.md, GOTCHAS.md and VERIFY.md.
2. Continue on v4-qqopen-native.
3. Verify command coverage against src/help/commands.js and existing handlers/plugins.
4. Run full repository/V3/V4 CI before fast-forwarding main.
5. Reconcile memory, package the next version, send one Gmail notification, then report completion.
