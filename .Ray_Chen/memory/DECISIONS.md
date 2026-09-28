# DECISIONS

## Retained

D-001 through D-061 remain in force.

## D-062 QQ group panel slash is a reserved transport form
status: accepted
date: 2026-09-29
Decision: QQ-rendered `/!面板 ...` is normalized into the internal `!面板 ...` category router before generic group `/!` opt-out parsing.

## D-063 Generic /! semantics are preserved
status: accepted
date: 2026-09-29
Decision: the slash normalization is intentionally narrow. Inputs such as `/!普通内容` keep the existing explicit AI-bypass behavior and are never promoted into commands merely because a panel fix exists.

## D-064 Portal auth rate-limit fallback remains fail-safe
status: accepted
date: 2026-09-29
Decision: Cloudflare `MY_RATE_LIMITER` remains the preferred Portal auth limiter. If its binding call is unavailable or throws, authentication falls back to an atomic D1 compare-and-swap limiter; missing/unavailable D1 still fails closed.

## D-065 Temporary system-admin credentials are isolated and self-expiring
status: accepted
date: 2026-09-29
Decision: emergency highest-privilege Portal access uses separate `PORTAL_TEMP_ADMIN_*` bindings instead of replacing the normal admin credential. TEMP access must carry an explicit expiry no more than 7 days ahead and is rejected after expiry. Credential values are never written to Git, Ray_Chen memory, logs, or notification email.

