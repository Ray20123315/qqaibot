# CURRENT_STATE

- QQAIBOT production main before repair: 906262b122796935bab5196328f7ae27e4729cfd
- Verified program build promoted onto main in prior task, Cloudflare deployment successful, but QQ user reports bot has no response.
- Verified Cloudflare Observability runtime error: ABOT_RESPONSE_FAILED QQ_API_400:40034024 invalid or unauthorized msg_id at 2026-10-09T16:01:12Z. Cron, Gateway DO fetch and alarms present.
- Proposed fix staged on fix/qq-passive-reply-20261010 from production main; unit CI and deployment not yet run.
- Abot reply policy: if explicit invalid msg_id, retry just once without msg_id; other errors no automatic replay.
- Existing pending /use groups can restart /use and receive a fresh code; old pending invite revoked.
- Bbot NapCat connection presence NOT VERIFIED. Current observability query found no OneBot events in sampled hour; not proof disconnection.
- main product remains old deployed bridge until repaired promotion.
