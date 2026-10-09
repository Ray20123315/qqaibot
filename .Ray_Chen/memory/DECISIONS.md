# DECISIONS

2026-10-10: primary textual commands /!use and !use; legacy /use compatible. QQ Open Platform slash autocomplete is separately configured in developer portal; no automation tool available to erase stale config. Exclude old keyboard code and provide manual removal path.
2026-10-10: fresh Abot Gateway DO bridge-abot-commands-v2 to avoid perpetually hot old DO using earlier source; monitor for session interference.
2026-10-10: connected health readout returns only boolean connected/session-ready indicators, no secrets.
2026-10-10: Cloudflare Observability identified real Bbot reverse WS 401 Unauthorized, once per ~5 sec; user must align NapCat Token with Worker Secret ONEBOT_ACCESS_TOKEN. Do not silently rotate production secret or expose its value.
2026-10-10: promoted tested feature source to main with fast-forward and verified Worker connected build/deploy.
