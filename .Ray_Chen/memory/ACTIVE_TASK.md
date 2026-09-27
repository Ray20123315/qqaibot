# ACTIVE_TASK

task_id: qqaibot-20260927-qqopen-v4-native
task_status: active
goal_revision: 5

## Goal

Make QQ Open the primary official QQAIBOT transport while retaining NapCat/OneBot as an auxiliary visibility/capability source. Reuse the same AI, Codex, memory, cooldown, plugin and permission runtime, and prevent duplicate handling across transports.

## Current Phase

Phase 5 — hybrid transport ownership and official event expansion.

## Execution Plan

1. Add official full-group-message policy for GROUP_MESSAGE_CREATE.
2. Add interaction event normalization/acknowledgement and internal handling for button/menu/feedback/clear-session/model/auth events.
3. Track C2C/group active-message receive/reject state.
4. Add hybrid event ownership/dedupe so QQ Open owns supported official message/action flows and OneBot supplements missing visibility without duplicate AI/plugin/moderation side effects.
5. Add diagnostics/Portal visibility and regression coverage.
6. Verify repository, V3, V4, isolated V4 test and Worker bundle before considering main.

## Hard Constraints

- Keep OneBot/NapCat.
- Do not duplicate the AI stack.
- QQ Open OpenID stays opaque.
- Unsupported official actions must not silently fall back to NapCat for a QQ Open event.
- Interaction intent is opt-in until permission is confirmed.
- No secrets in Git/memory.

## Checkpoint

- feature head before this phase: `e7292b6ba90c3e2228cbdec43cb8cf153e21224e`
- safe production product revision: `5ff25e2f97926fd0bfa038b4006427a0fb7f2962`
- latest verified prior CI: `36337247900` success
- production QQ Open Gateway previously user-verified READY

## next_exact_action

Implement official event-state normalization plus hybrid ownership/dedupe primitives, then expand V4 regression tests before changing main.

last_checkpoint_at: 2026-09-28T01:48:00+08:00
