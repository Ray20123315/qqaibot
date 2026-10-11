# ACTIVE_TASK
task_id: codex-bridge-native-gui-20261011
task_status: active
goal_revision: 1
goal: ship actual Windows GUI Codex Bridge and investigate/resolve stale AIBot QQ slash menu entry for interjection rate
acceptance_criteria:
- QQAIBOT-CodexBridge.exe native .NET8 WinForms WinExe, PE subsystem 2; status, masked Token, URL, Codex CLI, Save/Start/Stop, diagnostics, tray. Old packaged Node bridge is hidden sibling Backend.exe, both shipped.
- Existing local config and Secret preserved; config changes atomic and retain readRoots/editRoots.
- CI tests backend CLI and GUI --self-test/PE subsystem, packages two files with checksums.
- Verify obsolete slash command not registered in current bot code. Platform-published QQ commands must be removed in official bot console when accessible, do not claim deletion without readback.
- Original Abot AI, Bbot plugin and Cloudflare Worker unchanged; archive previous main.
current_phase: feature staged for CI
current_step: run GitHub Node and Windows build, repair failures; only then promote main and release verified EXE/archive.
completed_steps:
- Inspected main 5415fb104b7cb2b30b0f59938c91a412c476b494, found previous EXE only Node pkg console, not GUI; user's criticism confirmed.
- Existing current bot code has no registration for outdated QQ command /!设置插话率 or its description 查看主动插话暂停状态.
- QQ official developer docs confirm native slash suggestions are controlled by published bot command configuration, which may survive code changes. No connected access to exact QQ publishing record, deletion unverified.
- Created archive/cli-before-native-gui-20261011 at 5415fb104b7cb2b30b0f59938c91a412c476b494.
- Added tools/codex-bridge-gui Program.cs and .csproj native WinForms GUI, masked token, local JSON atomic save preserving advanced fields, separate hidden Node backend process and tray.
- Windows workflow now builds Node backend plus self-contained WinForms GUI, checks GUI subsystem and headless control initialization, emits both hashes.
- Added tests/native-gui-and-commands.test.mjs and docs/QQ_COMMAND_PANEL_CLEANUP.md, updated README and docs/DEPLOY.
verification_results: pending CI / windows build, no user desktop validation, no confirmed remote QQ slash removal.
blockers: QQ official bot publishing console record not accessible, user may need delete stale platform configuration manually.
next_exact_action: Check feature Node + Windows CI; repair code and tests, then safe main promotion and archive/Gmail; disclose QQ command still pending platform deletion if unable to edit.
last_checkpoint_at: 2026-10-11T05:11:42.794Z
