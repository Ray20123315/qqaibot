# ACTIVE_TASK

task_id: qq-cross-group-bridge-20261009
task_status: blocked
goal_revision: 7
goal: replace Abot-only group linking with NapCat/Bbot primary verification and native replies across groups
current_phase: production deployed and CI verified; live QQ acceptance pending
current_step: user restarts/reconnects only NapCat WebSocket Client to fresh bridge-bbot-napcat-v2 and tests plain !use in first group

completed_steps:
- Abot official API working in one QQ group but others rejected with QQ 40034105 proactive send no permission; Bbot native control selected.
- new src/napcat-control.js validates native numeric QQ group and owner/admin from fresh NapCat roster. Plain !use creates 12-character invite; !CODE alias directly joins other groups, no Abot Group OpenID required.
- src/bridge.js routes Bbot commands first and disables duplicate Abot group management commands in new mode. Normal events enqueue outbox.
- src/delivery.js sends to synthetic napcat: destination group solely through Bbot OneBot, uses Abot-first only where a valid real Group OpenID exists.
- worker.js sends direct command responses on existing OneBot WebSocket and awaits ACK, starts 1-second alarm after queued group message for prompt outbox send.
- fresh Bbot DO bridge-bbot-napcat-v2 ensures old connected DO code cannot silently process new commands; NapCat reconnect one time needed.
- existing protected QQ IDs 3569028262 and 2681167798: admin can CREATE/JOIN but cannot STOP/LEAVE/REVOKE without protected approval when either is in group; only protected user can GRANT then.
- original legacy full branch archive/legacy-main-20261009 preserved; no destructive D1 schema migration, old Abot pending data left untouched; AI chat disabled.
- CI 37960960301 succeeded after initial unrelated /health prefix string test fix; latest feature CI 37961297179 success, full node tests and Wrangler dry run.
- main fast-forwarded from ff80b3d96e223b1663e7d2c5b5b578828b052410 to 16a1391457e64f3909ccc997ca771d21fbd27542, then to 4db8fcbf844fc0cc64b4a1cf3919e18dcef5902f, no force.
- Cloudflare qqai source 4db8fcbf844fc0cc64b4a1cf3919e18dcef5902f build success, deployment 0f0dd1fc-54f1-4773-9de3-59a269ffbeb8, Worker version be4ec8e1-656d-43c7-9b55-00d5eafab839, 100% traffic.

files_changed: src/napcat-control.js src/bridge.js src/delivery.js worker.js tests/napcat-control.test.mjs wrangler.toml README.md docs/DEPLOY.md .github/workflows/bridge-check.yml .Ray_Chen/memory/*
verification_results: code CI and Cloudflare deploy success; live end-to-end QQ not tested
known_risks: current NapCat connection may remain on previous DO until user reconnects; older Abot Gateway may still have an open session, prefer bare !use without @; media, true @ and actual cross-group forwarding must be checked live
next_exact_action: user disables/enables NapCat WebSocket Client once, keeps wss://aibot.ray2025.com/onebot and existing Token, waits for bbot.connected=true in /health, then sends !use in first group and !CODE 簡寫 in second group; report status or errors.
last_checkpoint_at: 2026-10-10T00:52:00+08:00
