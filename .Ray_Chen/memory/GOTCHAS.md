# GOTCHAS
- PE Subsystem 2=Windows GUI vs 3=console. Previous 2026-10-11 EXE was console despite visible status, incorrect for explicit GUI requirement.
- GUI exe and Backend.exe must be in same directory. Windows GUI auto starts backend only when original settings are valid. Backend is hidden with CreateNoWindow and existing Bridge token/URL.
- Preserve user local config at %APPDATA%/QQAIBOT/codex-bridge.json incl advanced read/edit roots. Do not leak Token in GUI logs or support messages; status data restricted to known fixed labels.
- Minimize to tray retains connection; close GUI stops its spawned backend. CLI model availability and real Windows environment not verifiable by CI alone.
- QQ slash menu published at developer portal may persist independently of program. Source search passing does not remove server-published QQ command entry.


## 2026-10-11 · QQ panel API exact retirement cleanup
- Baseline main 546f2128ed41495e66ba7eeb0bbae7c8eff2c479 already has verified WinForms GUI and Windows artifact. DO NOT replace or duplicate the canonical tools/codex-bridge-gui implementation.
- New change: src/qq-panel-cleanup.js official GET/PUT/DELETE /v2/panels via existing QQ_OPEN_APP_ID and QQ_OPEN_CLIENT_SECRET, exact retired 设置插话率 only; preserve all other command items, marks and targets.
- Worker /status and public /health expose abot.command_panel_cleanup in pending|removed|no_match|failed; cron QqOpenGateway runs once, 15-min retry backoff, no broad deletion.
- No source changes to Abot model replies, Codex bridge, Bbot, D1/Vectorize, or Windows GUI.
- Feature CI and Cloudflare actual panel API result pending; if no_match/failed, QQ legacy publish settings still need manual operator action.
