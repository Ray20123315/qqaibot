# VERIFY

## Production Code

- production commit: `5ff25e2f97926fd0bfa038b4006427a0fb7f2962`
- GitHub CI run: `36332485133`
- regression: success
- V3 regression: success
- V4 regression: success
- isolated V4 test checks: success
- Worker bundle dry-run: success

## Production Cloudflare Deployment

- Worker: `qqai`
- Cloudflare build: `bb3b6a76-f7e1-4cdd-85c4-eec9fb089f2b`
- outcome: success
- migration tag: `v4_qqopen_gateway`
- named Durable Object handlers: `OneBotHub`, `QqOpenGateway`
- Wrangler current version: `dc1dff2f-a264-471f-a808-719dbad96c43`
- custom domains: retained
- Cron schedules: retained

## Variable Cleanup Verification

Removed 11 production bindings:
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

Post-cleanup GET settings:
- removed binding names present: none
- retained binding count: 34
- secret bindings: preserved
- D1 / Vectorize / Rate Limiter: preserved
- OneBotHub / QqOpenGateway: preserved

## Remaining Live Verification

`QQ_OPEN_CLIENT_SECRET` is absent from production. After the user adds it:
1. confirm Gateway configured=true;
2. confirm READY;
3. test C2C `!qqping`;
4. test group `@机器人 !qqping`;
5. test `!qqecho hello`;
6. then verify member-management/media APIs with the app's granted permissions.
