# ACTIVE_TASK
task_id: qq-cross-group-bridge-20261009
task_status: active
goal_revision: 9
goal: reduce 3-group relay latency with bounded parallel OneBot sends and batching native message segments, investigate /health bbot.connected=false
acceptance_criteria:
- Different QQ target groups fan out in parallel with concurrency cap 4; same target preserves FIFO.
- QQ OneBot text/image/emoji/at segments from one source message combined into one send per target where valid.
- Alarm triggers near-immediately after enqueue (~50 ms), and a busy outbox schedules further batches without waiting for cron.
- Cron only wakes OneBotHub alarm, avoiding direct cron/outbox racing with hub.
- Bbot health reports actual socket status/count and last connected/event/close timestamps; historical activity does not count as connected.
- OneBot ACK required, no speculative retries, no Abot API calls or role changes.
- Automated tests and Cloudflare dry-run pass before main promotion.
current_phase: feature staged
current_step: commit feature/parallel-bbot-relay-20261010 and run GitHub Actions tests
completed_steps:
- inspected live main 9b97668ccb4bfa910b065ff9be386fe2022a8604 and Cloudflare Observability; health GET and OneBotHub message event seen ~18 s apart, status false reported by user; cause of disconnect UNKNOWN
- identified serial flushOutbox, 1000-ms minimum alarm, and fragmented media operations as cumulative delay sources
- src/batch.js parallel per-destination concurrency 4 with same group sequential
- src/bridge.js concurrently prepares different destinations, batches OneBot messages, and groups outgoing work by target
- src/relay.js nativeBatch option combines multi-segment text/media/emojis per target
- worker.js shorter alarm, main cron now wakes OneBotHub rather than claiming messages, next batch reschedule, concurrent flush protection
- worker.js health includes socket count and connection/event/close timestamps without secrets or misleading inferred connectivity
- tests/parallel-relay.test.mjs covers concurrency and grouping; modified existing health/cron expectations
- docs and README updated; original branch and Bbot-only mode unchanged
verification_results: pending new CI / real QQ test
known_risks:
- Native mixed-media OneBot message could be rejected for specific media types in QQ/NapCat; no live proof.
- QQ/NapCat rate limits/network may still exceed 5 seconds; cannot promise hard SLA.
- User's /health connected=false may reflect actual transient disconnect; new metadata needed to diagnose.
- Existing Bbot OneBotHub socket must remain authenticated; old QQ platform/Abot intentionally disabled.
next_exact_action: run CI; if green promote main with expected old sha, verify Cloudflare build and production health telemetry, archive memory and Gmail once.
checkpoint_at: 2026-10-09T17:19:21.877Z
