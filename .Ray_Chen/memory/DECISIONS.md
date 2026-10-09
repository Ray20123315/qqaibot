# DECISIONS

2026-10-10 revision 9: User demands batch/parallel relay; chosen bounded 4-group concurrency, no API invented for multi-destination OneBot action, same QQ group FIFO and ACK. Merge native OneBot segments per target where supported; do not promise <5 seconds without real measurement.
2026-10-10: Shorten DO alarm to ~50ms, route cron through same DO /flush to prevent competing send/ordering races, and include pending next-batch self scheduling.
2026-10-10: Health connected means current OPEN socket only; last activity/connected/disconnected metadata shown separately. Do not report online simply because earlier messages existed.
2026-10-10: Live old DO /flush=404 proves hot OneBotHub stale code after deployment. Shared centralized hub ID bridge-bbot-parallel-v3 and one NapCat client restart chosen over risky force-close. Existing worker URL/token/D1 data unchanged.
2026-10-10: Preserve Abot-off policy, protected QQ IDs and legacy archive.
