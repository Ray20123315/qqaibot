# DECISIONS

- 2026-10-09: Save original main to archive/legacy-main-20261009 at 6a22b06433cfaffcf13abe2b60a917305290b629.
- 2026-10-09: Build new independent Worker on feature branch, old DO migration and D1 binding remain for safe deployment.
- 2026-10-09: Authentication uses Bbot group roster and QQ IDs, not Abot OpenID as real QQ ID.
- 2026-10-09: Fail closed on stale or missing roster for privileged writes.
- 2026-10-09: Protected-account grants can delegate manage or stop, but grants cannot be re-delegated in a protected group.
- 2026-10-09: Queue relay sends; ambiguous send failures become failed without blind replay.
- 2026-10-09: Real @ gated behind BRIDGE_REAL_MENTIONS=false until validated; no unverified platform claims.
