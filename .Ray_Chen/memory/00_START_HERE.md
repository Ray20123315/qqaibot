# Ray_Chen Memory Entry

- memory_version: v0.0.13
- project: QQAIBOT
- repository: Ray20123315/qqaibot
- canonical_branch: main
- development_branch: v4-qqopen-native
- task_id: qqaibot-20260927-qqopen-v4-native
- task_status: active
- goal_revision: 4
- safe_production_product_commit: 5ff25e2f97926fd0bfa038b4006427a0fb7f2962
- production_worker: qqai
- production_migration: v4_qqopen_gateway
- updated_at: 2026-09-28T00:36:00+08:00

## Current State

- Production QQ Open credentials are configured.
- User verified Gateway `enabled=true`, `configured=true`, `connected=true`, `ready=true`.
- User verified `!qqping` returns `QQ Open V4 已连接并可回话。`.
- AI providers are configured in production, but QQ Open ordinary messages have not yet been bridged into the existing AI/command runtime.
- OneBotHub remains intact as fallback.

## Current Goal

Bridge QQ Open into the existing Worker direct-loopback so ordinary AI, memory, cooldown, commands, plugins and Codex use the same codepath. Redirect platform actions to QQ Open APIs whenever the current ingress is QQ Open.

## Recovery Route

1. Read `ACTIVE_TASK.md`, `CURRENT_STATE.md`, `VERIFY.md`, and `FILE_MANIFEST.json`.
2. Keep the safe product rollback revision `5ff25e2f97926fd0bfa038b4006427a0fb7f2962` until the bridge passes all regressions.
3. Never infer a numeric QQ from an OpenID.
4. Do not remove OneBotHub during this phase.
