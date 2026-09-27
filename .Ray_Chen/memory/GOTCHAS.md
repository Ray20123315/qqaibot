# GOTCHAS

## Retained

Previous QQ Open, OpenID, Gateway lifecycle, reconnect, Portal animation, pruning, permissions, principal identity, Connected Builds name override, D1 limit, Cron limit and GitHub credential risks remain in force.

## G-024 keep_vars preserves dead Dashboard variables
Risk: `keep_vars=true` preserves Dashboard-managed values but can also preserve dead historical vars.
Avoidance: prune only verified dead bindings.

## G-025 READY is not full app verification
Risk: Gateway READY does not prove AI/plugin/management routing.
Avoidance: live-test application paths separately.

## G-026 Memory-only build churn
Risk: memory commits can trigger unnecessary builds.
Avoidance: keep build path exclusions explicit.

## G-027 OpenID is not numeric QQ
Risk: identity corruption if OpenIDs are coerced to QQ numbers.
Avoidance: preserve opaque OpenIDs and use explicit linking/allowlists.

## G-028 Platform action leakage
Risk: QQ Open events may accidentally execute NapCat side effects.
Avoidance: use platform-marked action routing; unsupported official actions fail explicitly.

## G-029 Dual-observation duplicates
Risk: QQ Open full-group events and OneBot full-message events may represent the same human action and cause duplicate AI/plugin/moderation.
Avoidance: hybrid ownership/dedupe must suppress secondary side effects while still allowing auxiliary observation/storage.

## G-030 Interaction permission failure
Risk: enabling INTERACTION intent without QQ authorization can fail Gateway authentication.
Avoidance: implement support first; opt in only after permission is confirmed.
