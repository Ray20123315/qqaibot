# GOTCHAS
- Cloudflare DO WebSocket hot instance can remain on old Worker code after auto-deploy. A new Cron calling /flush returned 404 because existing bridge-bbot-napcat-v2 was still running former version. Don't assume CI/build updates hot DO method handlers.
- Rotate OneBotHub idFromName to bridge-bbot-parallel-v3 across Worker + bridge + delivery (shared constant), and require NapCat WS Client toggle off/on once. Do not change URL/Token, keep D1 state.
- /health connected=false until new hub receives authenticated WS handshake; old DO message traffic does not count as current connected.
- QQ Group send_onebot ACK and QQ rate limits may still constrain latency; do not promise hard 5 seconds.
- Abot remains disabled and protected QQ IDs remain.
