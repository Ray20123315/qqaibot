# GOTCHAS

- QQ API official 2025 notice says proactive push disabled, but 2026 community reports say group owners can enable it; actual target-group setting remains decisive.
- Bbot QQ ID and Abot group member OpenID are not the same.
- Native media may be only a NapCat internal file ID; Abot cannot upload without public HTTPS media URL. OneBot Bbot can sometimes forward local file media, but not guaranteed.
- If QQ API request times out or 5xx, delivered vs undelivered can be ambiguous; never fall back automatically, avoid duplicate sends.
- If Bbot OneBot ACK is missing, do not automatically retry. Delivery state 'failed_ambiguous'.
- Two-minute Bbot roster can become stale; refuse protected admin writes when stale. Also use fresh target roster for Bbot true @.
- DO queue and Bbot websocket health affect fallback. Incoming Bbot echo events must be filtered so messages do not loop.
- QQ platform owner can directly kick bot, software cannot override.
- Some reply/forward/face/card fidelity cannot be recreated cross group; do not claim 100%.
