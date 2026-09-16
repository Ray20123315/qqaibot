# ACTIVE_TASK

task_status: active
revision: 2

## Goal
Stop idle Cloudflare D1 daily row-read exhaustion caused by scheduler prefix scans while preserving one-minute Cron scheduling behavior.

## Acceptance
- [x] Add an index compatible with SQLite's default case-insensitive prefix `LIKE` semantics: `kv_store(key COLLATE NOCASE)`.
- [x] Preserve the existing cleanup SQL and key-matching semantics; no scheduler behavior change.
- [x] Add regression verification for the migration, query shapes, D1 binding, and one-minute Cron.
- [~] Run repository validation/build checks through PR CI.
- [ ] Review final diff and CI evidence.
- [ ] Consolidate state and remove temporary `.chatgpt_memory/` files before delivery.

## Constraints
- Do not change `main` directly before verification; work on `fix/d1-prefix-scan`.
- Do not reduce Cron frequency as the primary fix.
- Do not delete or rewrite existing D1 data.
- Remote D1 migration still requires an authenticated Cloudflare execution after merge/deploy.

## Evidence
- D1 Query Insights supplied by user: ~65.16M + ~52.93M rows read from the two scheduler LIKE scans.
- `wrangler.toml`: `crons = ["* * * * *"]`.
- `worker.js scheduled()` invokes both cleanup functions each Cron tick.
- SQLite optimizer documentation: default LIKE can use an index whose column uses built-in NOCASE collation.
- Local SQLite query-plan reproduction: adding `key COLLATE NOCASE` changes both identified query shapes to indexed `SEARCH`; the 3-way OR uses `MULTI-INDEX OR`.
- Draft PR #59 opened; CI is running.

## Next action
Inspect PR CI and diff. If CI passes, remove temporary task-memory files, rerun CI on the cleaned head, then deliver the PR and exact remote migration command.
