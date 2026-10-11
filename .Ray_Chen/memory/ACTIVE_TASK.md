# ACTIVE_TASK
task_id: codex-exe-visible-startup-20261011
task_status: completed
goal_revision: 1
goal: repair QQAIBOT Windows Codex Bridge EXE flash-and-close on double-click with visible main window and first-run configuration/errors, and provide verified replacement EXE
current_phase: product code and build completed and deployed on main, downloadable Windows artifact verified; live operator acceptance pending
current_step: user downloads fixed-main Windows zip, closes old background EXE if any, starts new EXE by double click; observes status and fills local bridgeToken only if needed, never shares it; if still fails provides diagnostic event codes from local log without secret.
completed_steps:
- Inspected user-uploaded /mnt/data/QQAIBOT-CodexBridge.exe, Windows PE console x64, size 57625775, SHA256 8e6556d428c2a61e8f3df44ae2929a20716a0ca5326b07c452c35f8ca7b43ab7 matches last release, valid binary.
- Inspected tools/codex-bridge-windows.mjs and codex-work-bridge.mjs, found default no-arg startBackground() detaches and exits, missing config first-run writes JSON then returns, ws errors silent.
- Archived pre-fix main 80d3cb38ce18fc44f3e77170ce8ff5ea4beff7be in archive/codex-exe-before-startup-fix-20261011.
- Fixed double-click no-args to visible foreground, explicit --background, --diagnose, first-run JSON / Notepad guidance and Enter pause on interactive errors; removed unsupported D:/QQAIBOT readRoots from new default, retains existing config without overwriting.
- Added restricted status events on connect/Worker hello/HTTP error/close/reconnect and local rotation log %LOCALAPPDATA%/QQAIBOT/logs/codex-bridge.log; secrets/raw chats are not logged.
- Added tests/codex-exe-startup.test.mjs for no-arg foreground, explicit background, first-run config, missing/placeholder token and mapping.
- Extended Windows GitHub Actions to test --help, --diagnose creates clean missing config, --run with missing Token exits with code 2. Discovered PowerShell LASTEXITCODE retained expected 2 and caused first Windows CI false failure; fixed workflow by explicitly clearing expected exit code after checking.
- Feature CI 38112718727 SUCCESS; feature Windows EXE CI 38112718730 SUCCESS; main CI 38112831921 SUCCESS; main Windows EXE CI 38112831914 SUCCESS.
- Main non-force fast-forwarded to a71c41a349575f97e51d8b24992f6f002fa7eee0. Cloudflare qqai automatic build from a71c41a349575f97e51d8b24992f6f002fa7eee0 succeeded at deployment 0044dbc3-218f-47da-842f-70cbcfda3f92 Worker version a3d7fc6e-6b77-4e44-907a-0338b2cd2236, 100% traffic. No official QQ Worker code or Secrets edited.
- Final Windows EXE built on main artifact 11692173286, ZIP QQAIBOT-CodexBridge-Windows-x64-fixed-main.zip; extracted and checked QQAIBOT-CodexBridge.exe SHA256 897845fa5104703abf205a33da32f2e92584113d630315b424575703dc896e21 matches bundled manifest; PE32+ x86_64 console file.
- Final memory v0.0.100 prepared for CI.
verification_results: both feature and main CI suites SUCCESS; both feature and main Windows build & smoke SUCCESS; SHA256 matched; Cloudflare build matches product SHA and successful; real user's Windows double-click, config, Bridge login, and Codex model availability UNVERIFIED.
known_risks:
- Windows Explorer stdin TTY/Notepad behavior may differ on user's desktop; actual local test needed. If not interactive, --run from open terminal and --diagnose remains supported.
- Existing bridgeToken cannot be read by us, must be configured in local JSON or environment; never ask for token in chat. New EXE does not modify any existing settings file.
- Real Codex CLI login and gpt-6-luna model availability are independent from EXE startup and may still cause task errors; bridge displays CLI missing and HTTP error code.
- Old EXE may still be running in background; user should close old instance to avoid competing sockets.
next_exact_action: Operator replaces old EXE with QQAIBOT-CodexBridge-Windows-x64-fixed-main.zip, double-clicks and checks state; if no connection, run --diagnose or read %LOCALAPPDATA%/QQAIBOT/logs/codex-bridge.log and share only safe codes/timestamps.
checkpoint_at: 2026-10-11T04:52:22.393Z
