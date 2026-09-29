# ACTIVE_TASK

task_id: qqaibot-20260929-keyboard-command-actions
task_status: active
goal_revision: 1

## Goal

Make group category keyboard buttons reusable and context-appropriate:
- no-argument commands: click -> send immediately;
- argument/target/content commands: click -> prefill the input box and wait for user completion.

## Acceptance Criteria

- All command buttons use QQ official action.type=2 command-button semantics.
- No normal command button includes click_limit.
- Direct-send commands set enter=true.
- Parameterized commands set enter=false and preserve a trailing space after the command so user input appends cleanly.
- Navigation buttons remain reusable and directly send the page command.
- Runtime keyboard normalization preserves type=2, enter, reply, unsupport_tips and does not synthesize click_limit.
- Existing callback support remains available for unrelated features, but normal command keyboards no longer depend on INTERACTION_CREATE.
- Explicit metadata identifies direct-send commands; unknown/new commands default to input/prefill for safety.
- Full development/main CI and production Connected Build succeed before completion.

## next_exact_action

Implement command-button metadata and payload changes, then run regressions.

last_checkpoint_at: 2026-09-29T10:20:00+08:00
