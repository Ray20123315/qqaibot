# ACTIVE_TASK

task_id: qq-cross-group-bridge-20261009
task_status: active
goal_revision: 6
goal: replace panel-dependent / commands with /! or ! text commands, isolate stale QQ Gateway DO, publish main, and give NapCat reverse-WebSocket configuration
acceptance_criteria: /!use, !use, /use parse identically; protected command ACL preserved; old QQ panel not loaded in Worker; gateway starts a fresh DO instance; health includes sanitized Abot/Bbot live status; tests pass; main updates and Cloudflare deploy verified
hard_constraints: no QQ production group messages or unsafe live testing; do not publish secrets; preserve original legacy branch
current_phase: fix branch preparation and CI
current_step: commit source + tests and run GitHub CI

completed_steps:
- inspected main 827921036139c3b24a8c6e1c1d9025655c45f399 and archive 6a22b06433cfaffcf13abe2b60a917305290b629
- confirmed src/core.js parser accepted only / command syntax; normalized /!use, !use and /use to same handler; legacy special bang commands do not forward as chat
- verified QQ official documentation says shortcut slash command menu originates from separate developer console setup (not Worker); user must delete old menu there
- discovered previous QQ Gateway DO still logged stale 40034024 errors; used fresh named DO instance bridge-abot-commands-v2 and added gateway event/status logs
- documented NapCat Array, wss://aibot.ray2025.com/onebot, ONEBOT_ACCESS_TOKEN, heartbeat 30000, reconnect 5000
- added command-routing and sanitized health tests

files_modified: src/core.js, src/bridge.js, worker.js, README.md, docs/DEPLOY.md, tests/command-routing.test.mjs, .github/workflows/bridge-check.yml, .Ray_Chen/memory/*
verification_results: new code CI pending; QQ live client unverified
known_failures: old DO may remain active until its connection terminates; simultaneous QQ official Gateway sessions may interfere; actual Bbot connection still unverified; obsolete QQ platform autocomplete must be removed in developer console
next_exact_action: run fix branch CI; if successful fast-forward main; verify Cloudflare deployment, new gateway version/READY and OneBot connection; then provide current test instructions
last_checkpoint_at: 2026-10-10T00:35:00+08:00
