# DECISIONS
2026-10-10 revision 9 after first parallel main deployment: Cloudflare's hot OneBotHub WS DO continued running earlier release and returned 404 for /flush; new code remained unreachable over old WebSocket. Use a fresh shared DO key bridge-bbot-parallel-v3 with one central source constant. This replaces bridge-bbot-napcat-v2 for all official new Bbot route access. Requires ONE manual NapCat Client reconnect.
2026-10-10: Preserve existing Token and URL, don't rotate secrets or migrate D1. New /health discloses hub_generation parallel-v3 to expose stale routing.
2026-10-10: Max 4 concurrent group sends, same-target FIFO, batch OneBot array message segments, no guaranteed <5s due platform.
