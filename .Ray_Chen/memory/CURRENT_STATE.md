# CURRENT_STATE
- Current production main before feature 9b97668ccb4bfa910b065ff9be386fe2022a8604; original entire old main archive/legacy-main-20261009 at 6a22b06433cfaffcf13abe2b60a917305290b629
- Production currently Bbot-only, Abot disabled. QQ cross-group message outbox processing previously sequential with 1-second alarm.
- Cloudflare logs show OneBotHub 'message' at 2026-10-09T17:12:15Z, /health at 17:12:33Z; user reports bbot.connected=false. No independent proof of connection at health instant. Diagnose with new timestamps.
- Staged bounded parallel sends (4 different targets) while preserving within-group FIFO and OneBot ACK, combining native OneBot segments.
- Cron wakes OneBotHub via internal /flush rather than independently consuming outbox; DO alarm resumes backlogs.
- Feature branch CI pending; QQ latency not yet measured in real groups.
