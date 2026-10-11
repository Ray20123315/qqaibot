# ACTIVE_TASK
task_id: codex-bridge-native-gui-20261011
task_status: active
goal_revision: 2
goal: true Windows GUI Codex Bridge and remove obsolete QQ command /!设置插话率 from AIBot native slash menu
current_phase: Existing GUI verified on main; exact QQ legacy panel API cleanup staged in feature branch, CI pending
current_step: Run feature CI, promote only exact QQ command panel cleanup changes into main after green; inspect live QQ API status
completed_steps:
- Verified baseline main 5415fb104b7cb2b30b0f59938c91a412c476b494 and prior console-only binary, preserved archive/cli-before-native-gui-20261011 at baseline SHA.
- Created tools/codex-bridge-gui/QQAIBOT-CodexBridge.csproj and Program.cs .NET8 WinForms self-contained native GUI. Windows GUI executable is PE Subsystem 2, NOT console. GUI has masked Token, URL/Codex CLI config, atomic JSON saving preserving advanced settings, Start/Stop hidden sibling Node bridge, connection status, restricted diagnostics and system tray minimizing.
- CI source feature ed944543d4a265101a7abafa2ff9eeee84f28c63.
- Updated .github/workflows/build-codex-bridge-exe.yml to package true GUI + Node Backend. Compiled Node pkg backend retains existing /v3/codex-bridge WebSocket protocol and Cloudflare CODEX_BRIDGE_ACCESS_TOKEN.
- Windows feature CI 38114026126 success; feature Node CI 38114026195 success; main Windows CI 38114199372 success; main Node CI 38114199375 success. Backend --help, first-run --diagnose, missing-token guard, native GUI --self-test and PE subsystem check passed.
- Main non-force fast-forwarded to ed944543d4a265101a7abafa2ff9eeee84f28c63, no change to existing QQAIBOT Worker AI routing or secrets. Cloudflare deployed main build SHA ed944543d4a265101a7abafa2ff9eeee84f28c63, outcome success, ID c92451d0-bdc5-470b-bc49-24cab00837ae, version f50fed87-5265-478d-84b3-1c6fc85d269c, 100% traffic.
- Downloaded main Windows artifact 11693066002 and checked ZIP manifest, GUI SHA256 5cb47bb16e252e9c871d26e17cd01ab939e80836c57df9bab52f4b0b47a3eeb9 PE GUI Subsystem 2, Node backend SHA256 9501d9e055d6e2b7e0cf8a165603712e33fc830d752d092d52fba3c1b33febff console subsystem 3.
- docs/QQ_COMMAND_PANEL_CLEANUP.md documents official Tencent developer portal commands at 發布設定 > 功能配置 > 指令配置. Current worker/source DOES NOT register stale /!设置插话率 or 查看主动插话暂停状态; obsolete QQ client suggestion is stored by QQ published bot config, not removable by GitHub source change alone.
- Final memory v0.0.102 documentation updated; CI artifact pending.
verification_results: GitHub feature/main CI and Windows EXE compiled/smoke SHA verified, Cloudflare source build verified, actual user double-click and Codex login not observed.
blockers: No connected QQ Official Bot Management console with authenticated published-command record; stale UI command cannot be claimed deleted.
known_risks: Actual Windows GUI behavior on user's desktop may differ from hosted CI. EXEs must remain in same directory. Codex CLI local subscription/model availability unknown. QQ client might cache outdated slash menu even after official removal.
next_exact_action: User installs main GUI ZIP and checks dashboard. To remove obsolete QQ slash entry, user must open official QQ bot console for AIBot, 發布設定 > 功能配置 > 指令配置, delete outdated item and confirm publish, then reopen QQ; optionally connect a supported admin tool and re-check.
last_checkpoint_at: 2026-10-11T05:18:25.694Z


## 2026-10-11 · QQ panel API exact retirement cleanup
- Baseline main 546f2128ed41495e66ba7eeb0bbae7c8eff2c479 already has verified WinForms GUI and Windows artifact. DO NOT replace or duplicate the canonical tools/codex-bridge-gui implementation.
- New change: src/qq-panel-cleanup.js official GET/PUT/DELETE /v2/panels via existing QQ_OPEN_APP_ID and QQ_OPEN_CLIENT_SECRET, exact retired 设置插话率 only; preserve all other command items, marks and targets.
- Worker /status and public /health expose abot.command_panel_cleanup in pending|removed|no_match|failed; cron QqOpenGateway runs once, 15-min retry backoff, no broad deletion.
- No source changes to Abot model replies, Codex bridge, Bbot, D1/Vectorize, or Windows GUI.
- Feature CI and Cloudflare actual panel API result pending; if no_match/failed, QQ legacy publish settings still need manual operator action.
