# ACTIVE_TASK

task_id: qqaibot-20260929-keyboard-command-actions
task_status: completed
goal_revision: 1

## Goal

Make group category keyboard buttons reusable and context-appropriate:
- no-argument commands: click -> send immediately;
- argument/target/content commands: click -> prefill the input box and wait for user completion.

## Acceptance Results

- VERIFIED: normal child-command buttons use QQ official action.type=2 command semantics.
- VERIFIED: direct-send commands set enter=true.
- VERIFIED: parameterized commands set enter=false and preserve a trailing space after the command.
- VERIFIED: normal command buttons omit click_limit and remain reusable.
- VERIFIED: pagination buttons use type=2 + enter=true and remain reusable.
- VERIFIED: runtime keyboard normalization preserves type=2, enter, reply, unsupport_tips and does not synthesize click_limit.
- VERIFIED: explicit command metadata controls direct-send; unknown/new commands default to prefill.
- VERIFIED: normal command keyboards no longer depend on INTERACTION_CREATE, while the previously enabled Interaction intent remains available for other callback features.
- VERIFIED: direct ! commands and all original authorization/confirmation/cooldown/Portal paths are unchanged.
- VERIFIED: development CI, final development-head CI, main CI and production Connected Build all succeeded.

## Evidence

- product revision: `719290878187f2230a5be10092cc4a9aa3ce1e34`
- deployed main head: `e6824c0a7e825450526152da90b7b0d8fba3049c`
- development product CI: `36511639011` — success
- final development-head CI: `36511690614` — success
- main CI: `36511830433` — success
- Cloudflare production build: `8da5b2da-5646-4e73-a34e-ba21844b020c` — success

## next_exact_action

Live-test one direct-send button such as help/status and one prefill button such as codex/翻译/禁言, confirming the first sends immediately and the second stays editable in the message input.

last_checkpoint_at: 2026-09-29T10:45:00+08:00
