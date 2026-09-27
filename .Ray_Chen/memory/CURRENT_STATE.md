# CURRENT_STATE

## Production

- Worker: `qqai`
- branch: `main`
- migration tag: `v3_remove_budget_guard`
- Durable Object class: `OneBotHub`
- production deploy command: `npx wrangler deploy worker.js --no-assets`
- production Worker modified time remained unchanged during test-environment work
- `v4-qqopen-native` is explicitly excluded from the production Worker's non-production trigger

## Isolated V4 Test

- Worker: `qqai-v4test`
- Worker tag: `95d30a6cea594b5f8d9a7ac7183c7712`
- URL: `https://qqai-v4test.ray20123315.workers.dev`
- migration: `v4test_qqopen_gateway_v1`
- Durable Object: `QqOpenGateway`
- dedicated build trigger: `522507cc-658f-4361-8e90-9a98e65b92d7`
- source branch: `v4-qqopen-native`
- build command: none
- deploy command: `npx wrangler deploy --config wrangler.v4test.toml --no-assets`
- path exclude: `.Ray_Chen/**`
- latest successful Cloudflare build: `d92e427e-ee8c-48b8-92a7-0773cdc870c0`

The test Worker has:
- no D1
- no production domain/routes
- no Vectorize
- no OneBotHub
- no Cron
- no QQ AppSecret yet

Non-secret test vars include QQ Open AppID and `GROUP_AND_C2C_EVENT` intent baseline.

## Verification

- GitHub CI `36330424094`: success
- isolated V4 config dry-run: success
- Cloudflare deployment: success
- QqOpenGateway migration on test Worker: success
- external public HTTP smoke from this assistant environment: unavailable due tool/network resolution limitation
- live QQ Gateway: pending Secret
