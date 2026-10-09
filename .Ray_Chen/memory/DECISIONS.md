# DECISIONS
2026-10-10 revision 9: Parallelize independent target QQ groups (max 4) with bounded Promise workers; preserve same-target FIFO and per-message ACK; do not invent OneBot multi-group broadcast API.
2026-10-10: When Bbot-only, OneBot supports array message segments; use one native OneBot action per incoming message/target where possible. Existing default relayOperations split logic retained for compatibility tests and future cases.
2026-10-10: Remove fixed 1-second alarm wait in favor of near-immediate ~50-ms scheduling, and make cron wake the same BbotHub to prevent cross-invocation ordering races.
2026-10-10: /health false is meaningful for current readyState; expose last connection/event/closure separately. Do not claim 'connected' from recent events.
2026-10-10: Preserve Abot-disabled code, user QQ 3569028262/2681167798 protections, existing D1 and legacy archive. No private secrets in logs.
