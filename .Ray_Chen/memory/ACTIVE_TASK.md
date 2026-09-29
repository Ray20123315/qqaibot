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

## Product Patch

Current development revision: `719290878187f2230a5be10092cc4a9aa3ce1e34`

Implemented:
- registry panel metadata now carries explicit `enter` behavior;
- catalog marks no-argument commands as direct-send;
- group keyboard buttons use QQ official action.type=2 command-button semantics;
- parameterized commands preserve a trailing space with `enter=false`;
- no normal command button emits `click_limit`;
- runtime normalization preserves type=2, enter/reply/unsupport_tips and only preserves click_limit when explicitly supplied by another feature;
- regressions cover direct-send, prefill, pagination, and repeatability.

## next_exact_action

Run full development CI on `719290878187f2230a5be10092cc4a9aa3ce1e34`; fix only verified regressions before main promotion.

last_checkpoint_at: 2026-09-29T10:32:00+08:00
