# ACTIVE_TASK

task_status: active
revision: 1

## Goal
Stop idle Cloudflare D1 daily row-read exhaustion caused by scheduler prefix scans while preserving one-minute Cron scheduling behavior.

## Acceptance
- [~] Replace both identified `LIKE 'prefix%'` full scans with indexable prefix range queries.
- [ ] Preserve cleanup semantics for outbound/notice and moderation proposal keys.
- [ ] Add regression verification that rejects the old LIKE queries and requires bounded range predicates.
- [ ] Run repository validation/build checks or record exact blocker.
- [ ] Review diff and evidence.
- [ ] Remove temporary `.chatgpt_memory/` files before final delivery.

## Constraints
- Do not change `main` directly; work on `fix/d1-prefix-scan`.
- Do not reduce Cron frequency as the primary fix.
- Do not require destructive D1 schema/data changes.

## Evidence
- D1 Query Insights supplied by user: ~65.16M + ~52.93M rows read from the two scheduler LIKE scans.
- `wrangler.toml`: `crons = ["* * * * *"]`.
- `worker.js scheduled()` invokes both cleanup functions each Cron tick.

## Next action
Implement the query rewrite and regression check.
