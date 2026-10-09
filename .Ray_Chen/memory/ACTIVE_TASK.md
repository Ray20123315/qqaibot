# ACTIVE_TASK

task_id: qq-cross-group-bridge-20261009
task_status: blocked
goal_revision: 4
goal: put Abot/Bbot QQ cross-group bridge onto main for real-world testing, preserving legacy code backup
current_phase: product main promotion / production deployment verified, live QQ functional acceptance pending
current_step: user tests QQ group pairing and relay using deployed Worker

completed_steps:
- preserved original main code in archive/legacy-main-20261009 at 6a22b06433cfaffcf13abe2b60a917305290b629
- deployed feature product commit 2beed0b762d07484fc8b7f201682504f429b5201 to main via nonforce fast-forward, expected old head lease accepted
- verified both main and backup GitHub refs
- GitHub main CI 37955271118 succeeded: tests and Wrangler dry-run, memory artifact v0.0.69
- Cloudflare connected build for qqai version 3a774f7c-2268-4c94-849c-bb0ad0d414a5 reported success, branch main source commit 2beed0b762d07484fc8b7f201682504f429b5201
- Cloudflare deployment 7e8bb6ff-e5ba-4621-b22d-01fc6b665f27 100% routing at 2026-10-09T15:55:42Z
- bridge code supports Abot-first, Bbot fallback only after definitive rejection, media handling, two-sided binding and two protected QQ IDs
- AI chat excluded from new Worker
- latest memory-only commit created after these observations, follow-up GitHub CI/Cloudflare deployment to be verified

known_blockers:
- Bbot NapCat websocket reconnect and group member roster not proven on new Worker
- QQ Abot proactive message ability and real @ plus media delivery not end-to-end verified
- /health external URL not accessible through available inspection tools; use connected live QQ smoke
- no claim actual QQ message delivery success without observed test

next_exact_action: In isolated QQ test groups with both Bots, verify /use -> Abot/Bbot dual /verify -> /<code> group join, Bbot incoming observation, Abot outgoing and media/@; use logged response to diagnose any failure, then verify Bbot explicit-denial fallback. Do not force replay ambiguous message results.
