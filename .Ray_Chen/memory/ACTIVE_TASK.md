# ACTIVE_TASK

task_id: qqaibot-20260929-group-panel-slash-dispatch
task_status: completed
goal_revision: 1

## Goal

Repair live QQ group panel commands whose QQ-rendered `/!` prefix collided with the intentional `/!` AI-bypass syntax.

## Root Cause

QQ group command-panel entries are displayed/sent with a leading slash, e.g. `/!面板 基础`. Group input previously reached `stripGroupAiOptOutPrefix` first, so the command was converted into plain `面板 基础` with `aiReplyOptOut=true` before the panel router ran.

## Acceptance Results

- VERIFIED: reserved panel slash input is normalized before `stripGroupAiOptOutPrefix`.
- VERIFIED: only `/!面板` / `/！面板` (including full-width slash) receives this normalization.
- VERIFIED: `/!普通内容` is unchanged and remains AI opt-out.
- VERIFIED: CQ-at-prefixed panel commands are normalized without losing the CQ prefix.
- VERIFIED: category-only panel input returns the child-command list.
- VERIFIED: category + child expands to the existing canonical command and therefore uses existing permission/confirmation/handler logic.
- VERIFIED: repository, V3, V4 QQ Open, isolated deployment and bundle checks pass on development and main.
- VERIFIED: production Connected Build succeeds.

## Product Revision

`64513e94f6634921f0b1ee8f7c6d5d44a754a6f5`

## Changed Product Files

- `src/v4/commands/group-panel.js`
- `worker.js`
- `verify-v4-qqopen.mjs`

## Verification Evidence

- development CI: `36476322049` — success
- main CI: `36476525721` — success
- production build: `8aa6ab67-ad80-4ddd-b916-0b76e7bfcf3c` — success

## next_exact_action

Live-test one group panel entry, preferably `/!面板 基础`, and confirm the bot returns the category child list.

last_checkpoint_at: 2026-09-29T04:08:00+08:00
