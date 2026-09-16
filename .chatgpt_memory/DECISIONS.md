# DECISIONS

## Active decisions
1. Preserve the one-minute Cron because it supports minute-granularity scheduling and other automation.
2. Fix the two read-heavy prefix scans rather than masking them by lowering Cron frequency.
3. Prefer explicit lexicographic prefix ranges (`key >= lower AND key < upper`) over relying on SQLite `LIKE` collation optimization.
4. Keep the change code-only; do not require a destructive schema migration.
5. Add a regression verifier that detects the former query strings and verifies the bounded range form.
