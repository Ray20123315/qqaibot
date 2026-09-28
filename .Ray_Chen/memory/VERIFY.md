# VERIFY

## Product Revision

`a6a5996c2ec33da881e0dbb54725b4ab61ce7037`

## GitHub CI

Run: `36363693922`
Conclusion: SUCCESS

Passed:
- repository regression
- V3 regression
- V4 QQ Open regression
- lifecycle + dynamic mapping regression
- isolated V4 test deployment checks
- production Worker bundle dry-run

## Isolated Cloudflare Test

Build: `02ca8a73-cdd4-4ffa-beeb-db3140105a74`
Outcome: success

## Production Cloudflare

Build: `5669da1f-77c7-4fb3-8b42-ea26da91ed18`
Outcome: success
Worker version: `33538b7c-c04f-4b47-b8eb-82c444c6fe0a`

Read-back verified:
- OneBotHub present
- QqOpenGateway present
- D1 present
- Vectorize present
- AI binding present
- Rate Limiter present
- QQ_OPEN_CLIENT_SECRET present as Secret
- existing Secrets preserved
- QQ_OPEN_INTENTS=33554432
- QQ_HYBRID_PRIMARY=qq-open
- QQ_HYBRID_GROUP_MAP={}
- QQ_OPEN_DISCOVERY_SYNC=true

## Regression Coverage Added

- lifecycle normalization for friend/member/bot-group add/remove
- dynamic group fingerprinting
- generic-message rejection
- ambiguous multi-group rejection
- 3-evidence design hooks
- dynamic mapping used by OneBot observation, scheduler and Portal
- GROUP_AT and GROUP_MESSAGE observations fed into mapping
- Portal lifecycle/mapping metrics
- no forced Interaction Intent

## Live Verification Remaining

1. Confirm production Gateway READY after this deploy.
2. Send 3 distinctive @Bot test messages visible on both transports and confirm learned mapping.
3. If receive-all-message capability is enabled, observe GROUP_MESSAGE_CREATE and confirm mapped ordinary OneBot events become auxiliary.
4. Trigger a lifecycle event and confirm Portal lifecycle count changes.
5. Confirm Interaction permission before changing Intent.
