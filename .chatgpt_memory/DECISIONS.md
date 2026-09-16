# DECISIONS

## Active decisions
1. Preserve the one-minute Cron because it supports minute-granularity scheduling and other automation.
2. Fix the two read-heavy prefix scans rather than masking them by lowering Cron frequency.
3. Use a dedicated `kv_store(key COLLATE NOCASE)` index. SQLite's default `LIKE` is ASCII case-insensitive; this collation pairing allows the existing prefix `LIKE` queries to become index range searches without changing cleanup semantics.
4. Use a non-destructive D1 migration; do not rewrite existing rows or alter the table schema.
5. Keep remote migration application explicit via `npm run d1:migrate:remote` rather than silently coupling it to every deploy.
6. Add a regression verifier that requires the index migration and preserves the known scheduler query shapes and Cron configuration.
