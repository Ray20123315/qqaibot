# GOTCHAS

## Retained

G-001 through G-055 remain relevant.

## G-056 QQ panel UI prefixes command text with slash
Risk: a panel item configured as `!面板 基础` can be presented/sent by QQ as `/!面板 基础`. This collides with QQAIBOT's pre-existing `/!` group AI-opt-out syntax.
Mitigation: normalize only the reserved `/!面板` transport form before generic opt-out parsing; regression-test both the positive panel path and the negative ordinary `/!` path.

## G-057 API-success does not prove live command dispatch
Risk: menu/panel creation tests can pass while the client sends a different command text shape.
Mitigation: keep transport normalization tests and require a live QQ click smoke test for discovery UI changes.

## G-058 Rate Limiter binding presence does not prove invocation availability
Risk: `MY_RATE_LIMITER` can be present in the deployed Worker while `limit()` still throws or becomes unavailable; treating binding presence as proof causes Portal login to return `AUTH_RATE_LIMIT_UNAVAILABLE`.
Mitigation: prefer Cloudflare Rate Limiter, catch only limiter availability failures, then use an atomic D1 fallback limiter. Never degrade to unlimited login attempts.

## G-059 Secret-triggered Worker versions must be re-read after credential changes
Risk: updating Worker secrets creates a new Worker version and deployment.
Mitigation: after secret changes, re-read latest deployment/version, confirm expected TEMP secret names are bound, and run live health before declaring the login hotfix complete.

