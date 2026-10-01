# ACTIVE_TASK

task_id: qqaibot-20261001-panel-complete-real-message-send
task_status: active
goal_revision: 3

## Goal

Use QQ native group discovery only as a compact category launcher, keep the complete command surface in custom paginated inline keyboards, and retire unwanted relationship functionality while keeping werewolf removed.

## Acceptance Criteria

- VERIFIED development: one managed native group category-root panel.
- VERIFIED development: every retained non-empty category resolves to a paginated inline keyboard.
- VERIFIED development: retained commands are fully covered across category pages.
- VERIFIED development: direct child commands use type=2 + enter=true; parameterized commands use type=2 + enter=false.
- VERIFIED development: no relationship category/commands/handlers/Portal controls remain.
- VERIFIED development: relationship storage module can only clean historical rows.
- VERIFIED development: old relationship mute-lock source parsing remains for safe compatibility only.
- VERIFIED development: 狼人杀/狼人殺 absent from worker/help/catalog.
- VERIFIED development CI: 36878357756 success.
- PENDING: main CI, production build and live QQ client smoke.

## Product Files Changed

- src/v4/qqopen/discovery.js
- src/v4/commands/group-panel.js
- src/v4/commands/registry.js
- src/v4/commands/catalog.js
- worker.js
- src/portal/community-suite.js
- src/portal/members.js
- src/portal/member-cleanup.js
- src/members/details.js
- src/moderation/partner-bindings.js
- verify-v4-qqopen.mjs
- verify-partner-bindings.mjs
- verify-master-bindings.mjs
- verify-portal-relationships.mjs
- verify-community-suite.mjs
- verify-member-details.mjs
- verify-member-cleanup.mjs
- verify-portal-members-client.mjs
- verify-v3-transition-cleanup.mjs

## Blockers

None.

## next_exact_action

Promote `0c4cc0aa55f9e01212b2a39cb979ee8de1ace1fe` to main, then verify main CI and Cloudflare Connected Build.

last_checkpoint_at: 2026-10-01T22:44:00+08:00
