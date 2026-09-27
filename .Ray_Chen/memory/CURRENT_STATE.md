# CURRENT_STATE

## GitHub

- `main`: production V4 at `5ff25e2f97926fd0bfa038b4006427a0fb7f2962`
- `v4-qqopen-native`: same product revision before this memory checkpoint
- product CI: `36332485133` success

## Production Cloudflare Worker

Worker: `qqai`

Verified:
- migration tag: `v4_qqopen_gateway`
- Durable Objects: `OneBotHub`, `QqOpenGateway`
- D1: retained
- Vectorize: retained
- AI binding: retained
- Rate Limiter: retained
- production custom domains: retained
- two existing Cron schedules: retained
- production build: `bb3b6a76-f7e1-4cdd-85c4-eec9fb089f2b` success
- current production version reported by Wrangler: `dc1dff2f-a264-471f-a808-719dbad96c43`

## Production Variables

Present QQ Open public vars:
- `QQ_OPEN_ENABLED=true`
- `QQ_OPEN_APP_ID=1905687174`
- `QQ_OPEN_INTENTS=33554432`
- `QQ_OPEN_TRANSPORT=websocket`

Removed production variables:
- AUTO_CHECKIN_CONCURRENCY
- AUTO_CHECKIN_ENABLED
- AUTO_CHECKIN_RETRY_INTERVAL_MS
- DEEPSEEK_PRO_MODEL
- DEPLOY_NOTIFY_DEVELOPER_IDS
- DEPLOY_NOTIFY_START_COOLDOWN_SECONDS
- DEVELOPER_ID
- ENABLE_ONEBOT_HTTP_EVENTS
- GEMINI_IMAGE_MODELS
- IMAGEN_MODELS
- PLUGIN_SECURITY_GPT_MODEL

Production retained 34 bindings after cleanup.

## Secrets

Existing production secrets were preserved. `QQ_OPEN_CLIENT_SECRET` is not present yet, so QQ Open is enabled but not configured for live Gateway authentication.

## Cloudflare Build Triggers

Production main trigger:
- branch: `main`
- deploy: `npx wrangler deploy worker.js --no-assets`
- excludes: `.Ray_Chen/**`

Production non-main trigger:
- still uses `wrangler versions upload`
- excludes both `main` and `v4-qqopen-native`

V4 isolated test trigger remains attached only to `qqai-v4test`.
