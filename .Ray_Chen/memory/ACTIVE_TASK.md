# ACTIVE_TASK
task_id: codex-exe-visible-startup-20261011
task_status: active
goal_revision: 1
goal: Repair Windows Codex Bridge EXE which flashes then exits, preserve existing settings/security, deliver tested visible double-click EXE that reports its connection and errors rather than hiding automatically
acceptance_criteria:
- Default double click/CLI no args starts VISIBLE foreground session, not background detach; successful WebSocket keeps console open, with connected/Worker hello/reconnect feedback.
- Missing settings generate local JSON at %APPDATA%/QQAIBOT/codex-bridge.json, try opening Notepad for setup, prompt on invalid settings/Token before closing when interactive; do not reveal or require user to send credentials.
- Old config preserved and loaded without overwrite, default template has no nonexistent D:/QQAIBOT read root.
- Error, HTTP 401, connection, Codex CLI availability reported as restricted status only and logged under %LOCALAPPDATA%/QQAIBOT/logs/codex-bridge.log without token or raw prompts; log rotation.
- --background explicit opt-in, --run foreground, --diagnose checks config and CLI without connecting; --install-startup compatible.
- Existing Cloudflare Worker, QQ API, D1 and Secrets untouched for EXE-only UX fix; tests + Windows compiled EXE smoke tests pass, promotion to main and verified package artifact, memory and Gmail.
current_phase: GitHub feature stage
current_step: trigger Node CI and Windows EXE workflow, fix failures, then promote main
completed_steps:
- Read user-uploaded /mnt/data/QQAIBOT-CodexBridge.exe, PE32+ Windows x86_64 console executable, size 57625775, SHA256 8e6556d428c2a61e8f3df44ae2929a20716a0ca5326b07c452c35f8ca7b43ab7: byte-for-byte same as previously delivered artifact.
- Read existing tools/codex-bridge-windows.mjs and tools/codex-work-bridge.mjs, confirmed double-click no arguments unconditionally invokes startBackground() then prints and immediately exits; no config just creates JSON and exits; WebSocket error event intentionally silent.
- Preserved prior main 80d3cb38ce18fc44f3e77170ce8ff5ea4beff7be as archive/codex-exe-before-startup-fix-20261011.
- Updated exe launcher: no-args foreground, explicit --background, first-run config template with no invalid D: path, Notepad assist for new/invalid config, wait for Enter on interactive configuration or startup errors, optional --diagnose.
- Added no-secret status log with rotation at %LOCALAPPDATA%/QQAIBOT/logs/codex-bridge.log and Worker HELLO/HTTP 401/close feedback.
- Updated Windows build workflow to smoke-test first run --diagnose config generation and --run missing-token exit 2, Node tests for visible/default config validation; README, docs/DEPLOY updated.
verification_results: CI pending, Windows actual double-click by user not yet available; no modification to official qqai Worker source
known_risks: Windows process.stdin.isTTY may differ by launch context; fallback --run from existing cmd.exe supported. Installed Codex CLI may be absent or model unsupported even when WS connects; reports warning, cannot auto-install without permission.
next_exact_action: Run feature CI & Windows EXE build on fix/codex-exe-visible-startup-20261011; inspect failure logs if any, fix and rerun. Only promote main when both green.
checkpoint_at: 2026-10-11T04:45:19.850Z
