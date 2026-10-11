# DECISIONS
2026-10-11: Native Windows Forms WinExe frontend is the deliverable; hidden existing Node pkg CLI preserved as sibling backend for compatibility, not directly shown to users.
2026-10-11: GUI masks token, atomically saves only its own three fields, never prints arbitrary Codex stdout or Secrets, supports tray minimize and true start/stop.
2026-10-11: QQ native slash entry may be platform publisher config, separate from Worker source. Do not falsely claim it was deleted by a Worker deploy; provide accurate developer console removal.


## 2026-10-11 · QQ panel API exact retirement cleanup
- Baseline main 546f2128ed41495e66ba7eeb0bbae7c8eff2c479 already has verified WinForms GUI and Windows artifact. DO NOT replace or duplicate the canonical tools/codex-bridge-gui implementation.
- New change: src/qq-panel-cleanup.js official GET/PUT/DELETE /v2/panels via existing QQ_OPEN_APP_ID and QQ_OPEN_CLIENT_SECRET, exact retired 设置插话率 only; preserve all other command items, marks and targets.
- Worker /status and public /health expose abot.command_panel_cleanup in pending|removed|no_match|failed; cron QqOpenGateway runs once, 15-min retry backoff, no broad deletion.
- No source changes to Abot model replies, Codex bridge, Bbot, D1/Vectorize, or Windows GUI.
- Feature CI and Cloudflare actual panel API result pending; if no_match/failed, QQ legacy publish settings still need manual operator action.
