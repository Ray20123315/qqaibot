# VERIFY

## Product

Feature implementation:
`535804857f530dd8bf16d221422a6ed095300fe8`

Regression/production head:
`edeacf6cf8c215cc3987b86a4a0d5220c7f581d9`

## GitHub

Feature product run `36366445081`: SUCCESS.
Regression run `36366534308`: SUCCESS.
Main run `36366701774`: SUCCESS.

Passed:
- repository regression
- V3 regression
- V4 QQ Open regression
- hybrid official regression
- isolated V4 test deployment checks
- Worker bundle

## Cloudflare Test

Build `e280d9fb-bb0d-4659-91e8-cb2db205e1a3`
Outcome: success
Commit: `edeacf6cf8c215cc3987b86a4a0d5220c7f581d9`

## Cloudflare Production

Build `2f3fa902-2e60-44a2-8355-7459a5ef9db4`
Outcome: success
Worker version: `4d8fff7e-5713-4e5c-83e2-7caa9bcbb633`

Read-back verified:
- OneBotHub present
- QqOpenGateway present
- D1 present
- Vectorize present
- Workers AI present
- Rate Limiter present
- all expected Secrets preserved
- QQ_OPEN_INTENTS=33554432
- QQ_HYBRID_PRIMARY=qq-open
- QQ_HYBRID_GROUP_MAP={}
- QQ_OPEN_DISCOVERY_SYNC=true

## New Regression Coverage

- menu PUT body is wrapped as `{menu}`
- panel list requires C2C/group scope
- panel update is wrapped as `{panel}`
- discovery handles `records` and both scopes
- QQ Open runtime does not contain `reply_plan?.mentionIds` prefix injection
- passive replies still bind `replyMessageId: message.messageId`
- rich-media `msg_type=7` carries placeholder content
- worker records hybrid mapping observation before ownership suppression
- ownership source has official-pending recent storage
- Portal exposes pending mapping candidates/progress

## Live Verification Remaining

1. User refreshes authenticated Gateway diagnostics; discovery error should clear after READY/RESUMED sync.
2. User sends three new distinctive messages after this deployment.
3. Portal should show mapping candidate progress then auto mapping.
4. New replies should not contain literal `<@OpenID>`.
5. Confirm official passive reply continues working; do not require unsupported quote-box rendering.
