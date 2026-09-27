# GOTCHAS

## Retained

Previous QQ Open, OpenID, Gateway lifecycle, reconnect, Portal animation, pruning, permissions, principal identity, Connected Builds name override, D1 limit, Cron limit and GitHub credential risks remain in force.

## G-024 keep_vars preserves dead Dashboard variables
Risk: `keep_vars=true` correctly preserves Dashboard-managed values, but it also preserves historical variables that were removed from Wrangler config.
Avoidance: after verified deployment, remove only the known dead bindings with Cloudflare settings PATCH while using `inherit` for every retained binding.

## G-025 QQ Open enabled is not configured
Risk: production can show `QQ_OPEN_ENABLED=true` while Gateway authentication is impossible because `QQ_OPEN_CLIENT_SECRET` is absent.
Avoidance: treat `enabled` and `configured` as separate states; do not claim READY until the Secret is added and live Gateway handshake succeeds.

## G-026 Memory commits can trigger unnecessary production builds
Risk: committing only Ray_Chen memory to `main` can cause a production deploy even though runtime code is unchanged.
Avoidance: production trigger excludes `.Ray_Chen/**`.
