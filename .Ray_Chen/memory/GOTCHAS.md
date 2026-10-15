# GOTCHAS
- QQ actual bridge data as of 2026-10-15: four verified groups share one room, but all stopped=1. Preserve these settings; protected QQ account rules restrict !resume. No end-to-end relay can succeed until authorized resume.
- QQ Bbot/NapCat authenticated websocket and fresh roster required for privileged !use/!CODE/!resume controls. Bbot receives native numeric QQ IDs; never send synthetic napcat: identifiers to QQ official API.
- An incoming OneBot message may be duplicated; idempotent manual-v1: hashed outbox IDs are required. Outbound OneBot ACK timeout is ambiguous and must not be blindly retried.
- Group memory collection deliberately excludes leading slash commands, so /跨群 content is not ingested as source group long-term memory.
- QQ official published native slash menu is NOT the same as command text parser. Text command works if Bbot receives it; QQ menu cannot be claimed configured without platform readback.
- Existing qqai /v2/panels API returned QQ_PANEL_RECORDS_MISSING_OBJECT_ABSENT_ABSENT. Do not assume empty response is evidence old menu removed; refuse unrelated deletes.
- Preserve Windows native Codex GUI, local bridge JSON including edit/read roots, Cloudflare Secrets, Abot AI, D1/Vectorize. No destructive repo reset or force push.

- 2026-10-15: Old test "Connected old EXE is preferred over Gemini" contradicts latest user spec; updated to Gemini-first. Initial PR CI 38728955414 failed exactly this test; fix CI 38729107874 succeeded.
- 2026-10-15: `main` is a slimmed worker, without full original Portal UI/auth API; portal must be safely reconciled against legacy archive, not assumed present or indiscriminately cherry-picked.
- 2026-10-15: Abot identifiers are official OpenIDs while Bbot uses numeric QQ IDs. No assumption about cross-group personal quota until verified identity binding.
- 2026-10-15: D1 rate-limit SQL code relies on atomic upsert; GitHub fake D1 CI success is not a live D1 transaction/stress proof.
