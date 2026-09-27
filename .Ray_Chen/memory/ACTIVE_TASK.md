# ACTIVE_TASK

task_id: qqaibot-20260927-qqopen-v4-native
task_status: active
goal_revision: 4

## Goal

Make QQ Open V4 a full production ingress for the existing QQAIBOT capabilities instead of a connectivity-only path. Reuse the same AI, Codex, memory, cooldown, plugin, permission and command logic; adapt platform actions/media/group management to QQ Open APIs without pretending OpenIDs are numeric QQ IDs.

## Hard Constraints

- Keep legacy OneBotHub available as rollback/fallback.
- Do not duplicate the main AI/command implementation into a second codepath.
- OpenID values remain opaque strings.
- Developer-only functions require an explicit QQ Open developer OpenID mapping/configuration; never infer numeric QQ identity.
- Platform-specific actions from a QQ Open event must not accidentally execute through NapCat.
- Preserve existing production data, D1, Vectorize, secrets, Portal and Codex Bridge.

## Current Phase

Phase 4 — QQ Open full-runtime bridge.

## Current Step

Implement and verify:
1. QQ Open canonical event → existing Worker internal event bridge.
2. QQ Open-aware action adapter for replies, group member actions, mute, remove, media and capability probes.
3. Shared AI / public Codex / plugins through existing worker.js direct-loopback.
4. OpenID-aware developer configuration and official-group access rules.
5. Regression coverage and production cutover only after all checks pass.

## Checkpoint

- safe rollback product commit: `5ff25e2f97926fd0bfa038b4006427a0fb7f2962`
- current memory-only head before implementation: `fe1c3023a9464ef4e784ae3b4b597519eee74128`
- production QQ Open Gateway: READY and `!qqping` verified by user
- OneBotHub: retained
- QqOpenGateway: retained
- live AI through QQ Open: not yet enabled at this checkpoint

## next_exact_action

Create the QQ Open legacy-compatibility bridge and route QQ Open non-connectivity messages through OneBotHub direct-loopback into the existing `QQAIWorker.fetch` logic, with QQ Open action routing for side effects.

last_checkpoint_at: 2026-09-28T00:32:00+08:00
