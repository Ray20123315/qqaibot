# VERIFY

## Pre-implementation Checkpoint

Verified production baseline:
- QQ Open enabled/configured/connected/ready
- user received `QQ Open V4 已连接并可回话。`
- production has Workers AI, Gemini keys, Vision keys, D1, Vectorize and Codex Bridge-related bindings
- current QQ Open runtime handles only `!qqping` / `!qqecho` before this task

## Required Verification Before Main Update

1. existing `npm run check`
2. existing `npm run check:v3`
3. expanded `npm run check:v4`
4. `npm run check:bundle`
5. test Worker deployment/build
6. production Cloudflare build after main fast-forward
7. Gateway returns READY after deployment
8. live QQ Open ordinary AI test
9. public `!codex` test if Codex Bridge is connected
10. media/group operations only when granted by QQ permissions

## Rollback

If the full-runtime bridge fails verification, retain production at the last known-good product revision and keep OneBot operational. Do not delete either Durable Object.
