# ACTIVE_TASK

task_id: qq-cross-group-bridge-20261009
task_status: active
goal_revision: 7
goal: implement NapCat/Bbot group verification and cross-group linking independent of Abot Group OpenID on main
current_phase: stop old Bbot websocket instances from carrying old code
current_step: run feature CI and then promote new Bbot DO to main

completed_steps:
- initial NapCat-native feature CI 37960815779 had one /health prefix string mismatch, 31/32 passed; fixed.
- CI 37960960301 succeeded with all tests and Wrangler dry-run for v0.0.76.
- fast-forward main to feature commit 16a1391457e64f3909ccc997ca771d21fbd27542, Cloudflare deployment 845effb2-fb1b-48dd-898f-8d35bcb1ae22, Worker version 55fa43bd-4b1f-4ec9-9d0a-f0cd93c3e4b7, build outcome success with source 16a1391457e64f3909ccc997ca771d21fbd27542, traffic 100%.
- found old Bbot OneBotHub hot DO still could be attached to old code. Changed hub and delivery stub idFromName to bridge-bbot-napcat-v2, which needs one NapCat WS reconnect after deployment.
- docs/DEPLOY.md instructs disable/re-enable WebSocket Client once, same URL and Token.

verification: current updated DO source CI pending; no true QQ chat send test yet.
known_risks: Bbot must reconnect WebSocket to new DO, official Abot hot Gateway may still receive @AIBot commands; user should send bare !use without @.
next_exact_action: run feature CI; if green update main, verify Cloudflare deployment and memory package, then ask user to reconnect NapCat WS once and try !use in first group and !CODE alias in second group.
