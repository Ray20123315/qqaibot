# USER_REQUIREMENTS
- Latest: QQAIBOT Codex EXE needs genuine GUI, not CLI or image mockup; fix obsolete QQ native suggestion /!设置插话率 from screenshot. User states no such active feature exists.
- Keep existing Abot AI, Bbot memory D1/Vectorize, Luna non-think session preference, political policy and QQ plain text reply, preserved Secrets/local configuration/backups.


## 2026-10-11 · QQ panel API exact retirement cleanup
- Baseline main 546f2128ed41495e66ba7eeb0bbae7c8eff2c479 already has verified WinForms GUI and Windows artifact. DO NOT replace or duplicate the canonical tools/codex-bridge-gui implementation.
- New change: src/qq-panel-cleanup.js official GET/PUT/DELETE /v2/panels via existing QQ_OPEN_APP_ID and QQ_OPEN_CLIENT_SECRET, exact retired 设置插话率 only; preserve all other command items, marks and targets.
- Worker /status and public /health expose abot.command_panel_cleanup in pending|removed|no_match|failed; cron QqOpenGateway runs once, 15-min retry backoff, no broad deletion.
- No source changes to Abot model replies, Codex bridge, Bbot, D1/Vectorize, or Windows GUI.
- Feature CI and Cloudflare actual panel API result pending; if no_match/failed, QQ legacy publish settings still need manual operator action.
