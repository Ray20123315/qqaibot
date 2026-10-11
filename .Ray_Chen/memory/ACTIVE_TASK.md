# ACTIVE_TASK
task_id: qqaibot-native-gui-and-stale-command-20261011
task_status: active
goal_revision: 1
goal: deliver true Windows GUI Codex Bridge instead of console app, remove stale /!设置插话率 QQ official slash panel item without damaging other commands
acceptance_criteria:
- Windows main executable QQAIBOT-CodexBridge.exe MUST be native GUI (WinExe), not Node CLI; settings tabs for Connection, Folder Permissions, Overview, Diagnostics; visually visible startup and editable masked Bridge Token, URL and Codex path; start/stop underlying engine without console window; retains all existing config and Secret redaction.
- Bundle QQAIBOT-CodexBridge-Engine.exe hidden child in same distribution, not as primary user entrypoint; Windows GitHub Action compiles GUI self-contained (no .NET preinstall), tests --self-test and backend startup settings.
- QQ retired command /!设置插话率 / description 查看主动插话暂停状态 should be removed from QQ official panel using GET/PUT/DELETE /v2/panels API, with exact matching only and preserving all nonmatching items, permissions, targets and remarks.
- Cron one-time panel cleanup, rate-limited by Durable Object storage, logged safe result visible in /health Abot command_panel_cleanup. If old config is QQ admin portal instead, document manual removal without pretending API changed it.
- Preserve existing Abot AI, QQ passive reply, Codex, Gemini, Bbot optional relay, DB, Vectorize, Secrets, backups.
- Node tests and Wrangler dry-run; Windows-native GUI build+smoke; non-force main promotion, memory archive version and Gmail notification.
current_phase: initial implementation staged, CI pending
current_step: commit feature and wait for Windows build / Node tests; repair any failure before updating main
completed_steps:
- Confirmed existing 'fixed startup' QQAIBOT-CodexBridge.exe was still @yao-pkg/pkg Node Win console binary, not GUI; user's complaint valid.
- Reviewed new QQ official docs for /v2/panels (Aug 2026) listing, editing and deleting panel items. Existing current parser correctly ignores /!设置插话率, but QQ UI's configured command panel is separately persisted.
- Branch feature/native-gui-and-qq-panel-cleanup-20261011 forked from 5415fb104b7cb2b30b0f59938c91a412c476b494; archived old 5415fb104b7cb2b30b0f59938c91a412c476b494 as archive/pre-native-gui-20261011.
- Added true native .NET 8 WinForms project tools/gui/ with tabbed dark interface, masked local Bridge Token, URLs, Codex CLI file picker, group read/edit folder controls, start/stop engine and live status/log, no console window; settings save keeps unknown fields.
- Changed Windows CI to compile bundled node backend as QQAIBOT-CodexBridge-Engine.exe and self-contained GUI QQAIBOT-CodexBridge.exe; tests GUI --self-test, backend help and config error; SHA256 SUMS.
- Added src/qq-panel-cleanup.js and tests scoped by group/c2c/channel/dm, remove only exact retired command; update existing panel or delete empty panel without replacing anything else.
- Worker cron calls QQ official command panel cleanup on a QqOpenGateway DO with 15min minimum retry and once-only completion state. Health includes cleanup status. wrangler QQ_RETIRED_COMMAND_CLEANUP true.
- README and docs updated to distinguish GUI and Worker-command-panel action; fixed stale example D: read path.
verification_results: GitHub CI pending, Windows CLI and UI build not yet compiled; actual QQ panel API result unknown
known_failures: none observed yet.
risk_and_notes:
- QQ panel API could reject bot authentication or retired item could come from legacy management console not v2 panels; will report no_match/failed and manual platform steps, not claim removed without confirmation.
- GUI is two .exe files in one folder, though user's double-click uses only GUI. Real Windows Explorer interactions and on-machine Codex login unverified.
- Native Windows GUI uses .NET 8 self-contained single-file publish, size may be larger; old CLI/source archived.
next_exact_action: run feature Node/Windows CI, inspect compiler/QQ panel mock test failures, repair; promote verified commit to main, check Cloudflare actual one-time panel cleanup result, build/download GUI & memory, send Gmail.
checkpoint_at: 2026-10-11T05:12:20.985Z
