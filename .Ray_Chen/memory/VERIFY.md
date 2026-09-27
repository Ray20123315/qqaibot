# VERIFY

## Final Product / Test Environment

- V4 branch commit: `7ddfc56495d58a101626ad6911ac0c673c433a1f`
- GitHub CI run: `36330424094` — success
- regression: success
- V3: success
- V4: success
- `check:v4test`: success
- production Worker bundle dry-run: success

## Cloudflare Test Deployment

- Worker: `qqai-v4test`
- tag: `95d30a6cea594b5f8d9a7ac7183c7712`
- migration: `v4test_qqopen_gateway_v1`
- named handler: `QqOpenGateway`
- build trigger: `522507cc-658f-4361-8e90-9a98e65b92d7`
- build: `d92e427e-ee8c-48b8-92a7-0773cdc870c0`
- build outcome: success
- deployment URL reported by Wrangler: `https://qqai-v4test.ray20123315.workers.dev`

## Production Isolation Verification

Production `qqai`:
- migration tag remains `v3_remove_budget_guard`
- named handler remains `OneBotHub`
- main deploy command remains `npx wrangler deploy worker.js --no-assets`
- `v4-qqopen-native` is excluded from production non-main trigger
- production Worker modified time did not change during isolated test setup

## Expected Current Test Status

The test Worker currently has no `QQ_OPEN_CLIENT_SECRET`; therefore live QQ Gateway READY is not expected yet.

## Next Live Verification

1. Add `QQ_OPEN_CLIENT_SECRET` Secret to `qqai-v4test` only.
2. Open workers.dev test dashboard.
3. Press “連接 / 重試”.
4. Confirm Gateway transitions to READY.
5. Test C2C `!qqping`.
6. Test group `@机器人 !qqping`.
7. Test `!qqecho hello`.
