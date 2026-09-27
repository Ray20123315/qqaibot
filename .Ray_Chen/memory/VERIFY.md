# VERIFY

## Product Revision

`e75dd25ffd7900567bc4938f656b29ffaedcb5da`

## GitHub CI

Run: `36340836211`
Conclusion: SUCCESS

Passed:
- repository regression
- V3 regression
- V4 QQ Open regression
- `verify-v4-hybrid-official.mjs`
- isolated V4 test deployment dry-run
- production Worker bundle dry-run

## Isolated Cloudflare Test

Build: `610409e1-41c7-4ef8-a9be-3af4af0042dd`
Outcome: success

## Production Cloudflare

Build: `f74c53e5-4f75-48b6-b45e-d8d7b7755cce`
Outcome: success

Read-back verified:
- OneBotHub present
- QqOpenGateway present
- D1 present
- Vectorize present
- AI binding present
- Rate Limiter present
- QQ_OPEN_CLIENT_SECRET present as secret binding
- all previous secret bindings present
- DEVELOPER_IDS preserved
- PORTAL_ADMIN_USERNAME preserved
- plugin security vars preserved
- QQ_OPEN_INTENTS=33554432
- QQ_HYBRID_PRIMARY=qq-open
- QQ_HYBRID_GROUP_MAP={}

Observability:
- query timeframe covered deployment window
- exact needle `QQ Open gateway ensure failed`
- result count: 0

## Hybrid Regression Coverage

- explicit numeric group -> group_openid map parsing
- OneBot C2C ownership
- group-at ownership
- dynamic full-group ownership
- push permission normalization
- Interaction ACK policy
- button callback command parsing
- feedback / clear / model / auth controls
- Portal diagnostics
- active scheduled transport fallback
- no forced INTERACTION intent

## Live Verification Remaining

1. User checks production Gateway remains READY after deploy.
2. Ordinary C2C AI response through QQ Open.
3. Group @ AI response through QQ Open.
4. Configure a test QQ_HYBRID_GROUP_MAP entry.
5. If receive-all-message is enabled, observe GROUP_MESSAGE_CREATE and verify mapped OneBot event becomes auxiliary.
6. Trigger GROUP_MSG_RECEIVE/REJECT and verify status/active schedule routing.
7. Confirm INTERACTION permission before enabling Intent bit.
