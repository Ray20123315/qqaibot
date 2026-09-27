# VERIFY

## Verified Feature Head

`18160ef97f602a324d5c094b2f15ec2f6ca5a415`

## GitHub Actions Evidence

Run: `36335909533`
Conclusion: SUCCESS

Successful steps:
1. Install dependencies
2. Run regression checks
3. Run V3 regression checks
4. Run V4 QQ Open regression checks
5. Run isolated V4 test deployment checks
6. Build the single Worker bundle

## Added Regression

`verify-v4-runtime-bridge.mjs` checks:
- OpenID preservation
- QQ Open → legacy-compatible message mapping
- group join-request mapping
- text + rich-media send translation
- mute translation
- remove/blacklist translation
- join-request decline translation
- explicit failure for unsupported legacy-only group operations
- Worker QQ Open direct-loopback markers
- QQ Open platform action routing
- developer OpenID allowlist support
- QQ Open group/private gate behavior

## Required Live Verification After Explicit Deployment Authorization

1. Cloudflare production build/deploy succeeds.
2. QQ Open Gateway returns `ready=true`.
3. Group @Bot ordinary AI receives a normal AI reply.
4. C2C ordinary AI receives a normal AI reply.
5. Public `!codex` works when Codex Bridge is connected.
6. Developer OpenID is explicitly allowlisted before testing `!codexchat` / `!codexwork`.
7. Image/video/audio/file receive and send paths are tested with real QQ messages.
8. Member list/info, mute/unmute, remove/blacklist and join-request review are tested only where QQ grants the corresponding permission.
9. OneBot fallback remains operational until these live checks pass.

## Rollback

If live deployment fails, restore the last known-good production product revision `5ff25e2f97926fd0bfa038b4006427a0fb7f2962`. Do not delete OneBotHub or QqOpenGateway.
