# CURRENT_STATE

Verified current state:
- Repository: `Ray20123315/qqaibot`, default branch `main`.
- Working branch: `fix/d1-prefix-scan`.
- Cloudflare Worker Cron: every minute (`* * * * *`).
- `scheduled()` calls `cleanupTransientState()` and `cleanupExpiredModerationProposals()` every tick.
- `cleanupTransientState()` uses three OR-connected prefix `LIKE` predicates over `kv_store.key`.
- `cleanupExpiredModerationProposals()` uses `LIKE 'moderation:proposal:op_%'`.
- User-provided D1 Query Insights attributes approximately 118.09M rows read to those two query shapes.
- `SELECT value FROM kv_store WHERE key = ?` is cheap, strongly indicating an existing usable key index/unique constraint.

No production code change has been made yet.
