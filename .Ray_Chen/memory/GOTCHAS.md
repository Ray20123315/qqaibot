# GOTCHAS

## Retained

Previous QQ Open, OpenID, Gateway lifecycle, reconnect, Portal animation, pruning, permissions, principal identity, Connected Builds name override, D1 limit, Cron limit and GitHub credential risks remain in force.

## G-024 keep_vars preserves dead Dashboard variables
Risk: `keep_vars=true` correctly preserves Dashboard-managed values, but it also preserves historical variables that were removed from Wrangler config.
Avoidance: after verified deployment, remove only known dead bindings with Cloudflare settings PATCH while using `inherit` for every retained binding.

## G-025 enabled/configured/ready are distinct Gateway states
Risk: configuration presence does not prove a live WebSocket, and READY does not prove the full AI application path.
Current evidence: production is configured and READY, and `!qqping` works.
Avoidance: separately verify ordinary AI/Codex/application routing after the full-runtime bridge deploys.

## G-026 Memory commits can trigger unnecessary production builds
Risk: committing only Ray_Chen memory to `main` can cause a production deploy even though runtime code is unchanged.
Avoidance: production trigger excludes `.Ray_Chen/**`.

## G-027 OpenID is not numeric QQ
Risk: QQ Open member/user identifiers cannot be treated as OneBot QQ numbers. Doing so would corrupt permissions, identity and group actions.
Avoidance: preserve OpenIDs as opaque strings; only developer-specific elevation may use an explicit `QQ_OPEN_DEVELOPER_OPENIDS` allowlist or a deliberate future linking flow.

## G-028 Platform action leakage
Risk: routing a QQ Open inbound event through the legacy Worker can accidentally call NapCat for side effects.
Avoidance: mark QQ Open internal requests and make `callOneBotAction` dispatch through the QQ Open compatibility adapter for that event.
