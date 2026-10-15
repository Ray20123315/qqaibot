# GOTCHAS
- QQ actual bridge data as of 2026-10-15: four verified groups share one room, but all stopped=1. Preserve these settings; protected QQ account rules restrict !resume. No end-to-end relay can succeed until authorized resume.
- QQ Bbot/NapCat authenticated websocket and fresh roster required for privileged !use/!CODE/!resume controls. Bbot receives native numeric QQ IDs; never send synthetic napcat: identifiers to QQ official API.
- An incoming OneBot message may be duplicated; idempotent manual-v1: hashed outbox IDs are required. Outbound OneBot ACK timeout is ambiguous and must not be blindly retried.
- Group memory collection deliberately excludes leading slash commands, so /跨群 content is not ingested as source group long-term memory.
- QQ official published native slash menu is NOT the same as command text parser. Text command works if Bbot receives it; QQ menu cannot be claimed configured without platform readback.
- Existing qqai /v2/panels API returned QQ_PANEL_RECORDS_MISSING_OBJECT_ABSENT_ABSENT. Do not assume empty response is evidence old menu removed; refuse unrelated deletes.
- Preserve Windows native Codex GUI, local bridge JSON including edit/read roots, Cloudflare Secrets, Abot AI, D1/Vectorize. No destructive repo reset or force push.
