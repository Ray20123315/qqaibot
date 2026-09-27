# Ray_Chen Memory Entry

- memory_version: v0.0.10
- project: QQAIBOT
- repository: Ray20123315/qqaibot
- canonical_branch: main
- development_branch: v4-qqopen-native
- task_id: qqaibot-20260927-qqopen-v4-native
- task_status: active
- goal_revision: 3
- production_commit: 5ff25e2f97926fd0bfa038b4006427a0fb7f2962
- production_ci_run: 36332485133
- production_cloudflare_build: bb3b6a76-f7e1-4cdd-85c4-eec9fb089f2b
- production_worker: qqai
- production_migration: v4_qqopen_gateway
- updated_at: 2026-09-28T00:18:00+08:00

## Recovery Route

1. Read `ACTIVE_TASK.md` and `CURRENT_STATE.md`.
2. Treat `main` as the production source of truth.
3. Verify Cloudflare `qqai` still exposes both `OneBotHub` and `QqOpenGateway`.
4. Read `FILE_MANIFEST.json` before changing bindings or Cloudflare triggers.
5. Do not invent or copy QQ AppSecret; `QQ_OPEN_CLIENT_SECRET` is still missing from production.

## Quick Recovery Summary

V4 has been fast-forwarded into production `main` and deployed successfully to the formal `qqai` Worker. Cloudflare migration tag is now `v4_qqopen_gateway`; legacy `OneBotHub` remains while `QqOpenGateway` is added. Eleven dead/empty/redundant production variables were removed without touching secrets, D1, Vectorize, Rate Limiter, or either Durable Object namespace. QQ Open public vars are present and enabled in production, but live QQ Gateway connection is still blocked until the user adds `QQ_OPEN_CLIENT_SECRET` as a Cloudflare Secret on `qqai`.
