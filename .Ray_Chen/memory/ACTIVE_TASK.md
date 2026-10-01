# ACTIVE_TASK

task_id: qqaibot-20261001-panel-complete-real-message-send
task_status: active
goal_revision: 1

## Goal

Fix both live defects reported against main:
- command panel is incomplete;
- direct panel actions do not create a normal QQ message.

## Acceptance Criteria

- Direct/no-argument buttons use QQ command action type=2 with enter=true.
- Parameterized/target/content buttons use type=2 with enter=false and preserve a trailing-space prefill.
- Pagination sends a real !面板 command message via type=2 + enter=true.
- No normal command button uses click_limit.
- Active relationship/self-service/runtime commands missing from the registry are exposed under an appropriate group category.
- Every enabled group command is present in category/page regression coverage.
- Existing permissions, confirmations, cooldowns, slash routing, Portal switches and QQ Open routing remain unchanged.
- Development tests/CI pass before main is advanced.

## Current Phase

IN_PROGRESS — implementation preparation completed; product patch is next.

## Completed Steps

- VERIFIED: main and v4-qqopen-native are identical at a1c19cf0d732fd576000c8ecb2753facf38c51e8.
- VERIFIED: current direct child buttons use action.type=1 callbacks.
- VERIFIED: runtime converts those callbacks into synthetic legacy events rather than a user-sent QQ message.
- VERIFIED: worker.js contains active command families absent from src/v4/commands/catalog.js.

## Blockers

None.

## next_exact_action

Modify src/v4/commands/group-panel.js, src/v4/commands/catalog.js and verify-v4-qqopen.mjs on chatgpt/fix-command-panel-message-send-20261001.

last_checkpoint_at: 2026-10-01T18:10:00+08:00
