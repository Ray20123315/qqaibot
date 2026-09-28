# CURRENT_STATE

## Branch

Development branch: `feature/v4-public-bot`
Base main commit: `08ceeb725590d9efb0160ea38733d929e6e7d18c`
Verified resource commit: `678d6a1d1eb21637fb8c542d90da54c590bce6d0`
Current product commit: `fea78bf7604d388a6e0a4e9cc4d0f1a3044ddeea`
Main modified by this task: no.

## Verified Resource Onboarding

- User AI Provider and Storage Connector secure onboarding exists.
- D1 and KV connector API tokens are encrypted and never redisplayed.
- QQ private direct credential commands are intercepted before ordinary chat bridging.
- Authenticated one-time secure web entry exists.
- D1/KV use current Cloudflare API paths.
- Resource integration passed full repo regression/V3/V4/V4-test/bundle CI at commit 678d6a1d1eb21637fb8c542d90da54c590bce6d0.

## Persistence Policy Produced

`src/v4/public/user-persistence.js` now defines:
- control plane: `platform_d1`
- user content: `user_storage_required`
- fallback: `none`

The facade selects an enabled user connector by purpose and exposes put/get/delete through the connector. Without a connector for the requested purpose, it raises `USER_STORAGE_REQUIRED`.

QQ private settings and the resource Portal API now report whether long-term persistence is actually connected.

## Storage Boundary

Platform D1 may retain only control-plane state necessary to operate the service, such as login sessions, consent evidence, identity links and encrypted resource configuration. V4 user-content categories such as settings, memory, chat history and plugin data must use the user's Storage Connector when persisted.

## Verification

Persistence-policy product CI: pending.
Production Cloudflare resources: unchanged.
