# Ray_Chen Memory Entry

- memory_version: v0.0.43
- project: QQAIBOT
- repository: Ray20123315/QQAIBOT
- canonical_branch: main
- development_branch: v4-qqopen-native
- task_id: qqaibot-20260929-keyboard-command-actions
- task_status: completed
- goal_revision: 1
- product_revision: 719290878187f2230a5be10092cc4a9aa3ce1e34
- deployed_main_head: e6824c0a7e825450526152da90b7b0d8fba3049c
- updated_at: 2026-09-29T10:45:00+08:00

## Completed Goal

QQ child-command keyboards are now reusable official command buttons rather than one-shot callback buttons.

- Commands that need no additional data use action.type=2 + enter=true and send immediately.
- Commands that need parameters, targets, or text use action.type=2 + enter=false and prefill the QQ input box with the canonical command plus a trailing space.
- Normal command buttons omit click_limit, so they do not become unusable after one click.
- Pagination buttons are also reusable type=2 command buttons and send page commands directly.
- Existing handlers, permissions, confirmations, cooldowns, Portal switches, QQ Open primary routing and OneBot fallback remain unchanged.
- Existing INTERACTION intent support remains available for unrelated callback-based features, but normal command keyboards no longer depend on callback ACKs.

## Verification

- product CI 36511639011: success
- final development-head CI 36511690614: success
- main CI 36511830433: success
- Cloudflare production build 8da5b2da-5646-4e73-a34e-ba21844b020c: success

## Recovery Route

Treat 719290878187f2230a5be10092cc4a9aa3ce1e34 as the keyboard product revision and e6824c0a7e825450526152da90b7b0d8fba3049c as the deployed main head. If a button behaves incorrectly, inspect command.panel.enter metadata first; new commands default to prefill for safety.
