# VERIFY
- GitHub Actions npm run check: node --test tests/*.test.mjs and Wrangler dry-run.
- New tests/parallel-relay.test.mjs checks three target groups start without serial waiting, same destination order, native text + image + face joined into one OneBot message, outgoing D1 outbox dispatch concurrently, health status never lies about socket connectivity.
- Existing tests/abot-disabled.test.mjs adapted for scheduled internal /flush, tests/command-routing.test.mjs adapted for extra health diagnostics.
- CI feature branch pending, production main SHA still 9b97668ccb4bfa910b065ff9be386fe2022a8604.
- After promote, observe Cloudflare qqai source SHA, bbot.connected and bbot.last_event_at/last_closed_at, BBOT_BATCH_RESULT.duration_ms.
- Live QQ 3-group latency test and rich-media acceptance still pending; do not claim sub-five-second SLA before observing it.
