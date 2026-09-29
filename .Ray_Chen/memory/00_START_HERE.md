# Ray_Chen Memory Entry

- memory_version: v0.0.41
- project: QQAIBOT
- repository: Ray20123315/QQAIBOT
- canonical_branch: main
- development_branch: v4-qqopen-native
- task_id: qqaibot-20260929-keyboard-command-actions
- task_status: active
- goal_revision: 1
- base_revision: a033063e8564c6f71bd2c22724a9a6b2f4083f37
- updated_at: 2026-09-29T10:20:00+08:00

## Current Goal

Change QQ child-command keyboards from one-shot callback buttons into repeatable official command buttons with per-command send/input behavior.

## User Requirement

- Buttons must not become unusable after one click.
- Commands that need no additional data should be sent immediately.
- Commands that need parameters/targets/text should be inserted into the QQ message input for the user to complete, not sent immediately.
- Existing direct ! commands, permissions, confirmations, cooldowns, Portal switches and transport safety remain unchanged.

## Official QQ Semantics

Per current QQ official message-button documentation:
- action.type=2 is a command button and inserts @bot + action.data into the input box;
- action.enter=true auto-sends the command;
- action.enter=false leaves it in the input box for editing;
- action.click_limit is deprecated and defaults to unlimited when omitted.

## next_exact_action

Add explicit per-command keyboard enter metadata, generate type=2 buttons, preserve enter/reply/unsupport fields through runtime normalization, remove click_limit, and run full CI.
