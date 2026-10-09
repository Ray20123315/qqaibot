# CURRENT_STATE
- Production main at start 95057385c5822e6e355066c273f7475b06d32d87, Cloudflare parallel code deployed 100% after CI success
- Observability 2026-10-09T17:21:04Z shows OneBotHub old DO version ac768bc3-0d69-4eb7-9d18-f162cac90c5f returned HTTP 404 to new /flush. This prevents new cron route from operating through existing old socket.
- New feature branch fix/parallel-hub-reconnect-20261010 uses src/bbot-hub.js shared BBOT_HUB_ID bridge-bbot-parallel-v3 in worker, bridge and delivery, test pending.
- New health reports bbot.hub_generation=parallel-v3, websocket_count/current connected, last event/connected/closed; cannot claim connected before client reconnect.
- No changes to Abot-disabled state, protected QQ ACL, existing D1 or original archived code.
- Original archive/legacy-main-20261009 at SHA 6a22b06433cfaffcf13abe2b60a917305290b629.
