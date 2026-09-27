# ACTIVE_TASK

task_id: qqaibot-20260927-qqopen-v4-native
task_status: active
goal_revision: 3

## Goal

Operate QQ Open V4 from the formal production Worker while preserving rollback capability and minimizing dead configuration.

## Acceptance Criteria

- `main` contains the verified V4 code.
- Production `qqai` successfully deploys with both OneBotHub and QqOpenGateway.
- `v4_qqopen_gateway` migration applies successfully.
- QQ Open non-secret variables are present in production.
- Dead/empty production variables are removed without deleting secrets or required resource bindings.
- Production Cloudflare trigger ignores Ray_Chen memory-only commits.
- QQ Open live connection is attempted only after `QQ_OPEN_CLIENT_SECRET` is explicitly added to production.

## Completed

- Cleaned production config in commit `5ff25e2f97926fd0bfa038b4006427a0fb7f2962`.
- Full CI run `36332485133`: success.
- Fast-forwarded `main` to the V4 commit.
- Cloudflare production build `bb3b6a76-f7e1-4cdd-85c4-eec9fb089f2b`: success.
- Production migration advanced from `v3_remove_budget_guard` to `v4_qqopen_gateway`.
- Production now exposes both `OneBotHub` and `QqOpenGateway`.
- Existing D1, Vectorize, Rate Limiter, AI binding, secrets and custom domains remained intact.
- Added formal QQ Open vars:
  - `QQ_OPEN_ENABLED=true`
  - `QQ_OPEN_APP_ID=1905687174`
  - `QQ_OPEN_INTENTS=33554432`
  - `QQ_OPEN_TRANSPORT=websocket`
- Removed 11 dead/empty/redundant production bindings:
  - `AUTO_CHECKIN_CONCURRENCY`
  - `AUTO_CHECKIN_ENABLED`
  - `AUTO_CHECKIN_RETRY_INTERVAL_MS`
  - `DEEPSEEK_PRO_MODEL`
  - `DEPLOY_NOTIFY_DEVELOPER_IDS`
  - `DEPLOY_NOTIFY_START_COOLDOWN_SECONDS`
  - `DEVELOPER_ID`
  - `ENABLE_ONEBOT_HTTP_EVENTS`
  - `GEMINI_IMAGE_MODELS`
  - `IMAGEN_MODELS`
  - `PLUGIN_SECURITY_GPT_MODEL`
- Cloudflare binding cleanup used `inherit` for all retained bindings; read-back confirmed all 11 removed and 34 required bindings retained.
- Production `main` trigger now excludes `.Ray_Chen/**` so memory-only commits do not redeploy production.
- Isolated `qqai-v4test` remains available and separate.

## Verification Results

- GitHub CI: success
- Cloudflare production build: success
- production migration: `v4_qqopen_gateway`
- OneBotHub namespace: retained
- QqOpenGateway namespace: created
- removed variable read-back: success
- required binding read-back: success
- QQ_OPEN_CLIENT_SECRET: absent
- live QQ Gateway READY: not yet attempted

## next_exact_action

Add `QQ_OPEN_CLIENT_SECRET` as a Cloudflare Secret on production Worker `qqai`. Then use the production Portal QQ Open panel or Gateway status endpoint to confirm READY and test C2C/group `!qqping` and `!qqecho hello`.

last_checkpoint_at: 2026-09-28T00:18:00+08:00
