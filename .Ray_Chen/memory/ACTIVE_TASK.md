# ACTIVE_TASK

task_id: qq-cross-group-bridge-20261009
task_status: blocked
goal_revision: 6
goal: put /!use and !use native-text QQ cross-group bridge on main, bypass stale Abot DO, remove reliance on old panel, configure Bbot reverse WS
current_phase: new code CI and Cloudflare deployed, awaiting NapCat token/QQ operator action
current_step: user aligns NapCat Token to Cloudflare ONEBOT_ACCESS_TOKEN and manually removes legacy QQ command menu

completed_steps:
- verified main and old branch historical states and old QQ command parser lacking /!use or !use
- implemented /!use, !use, /use normalization, /!verify /!status and /!join code variants, slash/bang unknown commands not relayed
- main source code contains NO old QQ UI command/keyboard; QQ official docs confirm command menu is managed in QQ developer console
- new Gateway DO name bridge-abot-commands-v2 plus logging and read-only /health Abot/Bbot connection status
- documented NapCat WebSocket Client wss://aibot.ray2025.com/onebot, Array, secret token, heartbeat 30000, reconnect 5000
- added regression tests for commands and health secrets not leaked
- feature CI 37958408119 passed node test + wrangler dry-run; v0.0.73 archive created
- fast-forward main from 827921036139c3b24a8c6e1c1d9025655c45f399 to c641a11ad8cd03f74f6321091e01375eb0ce6a60, no force update
- Cloudflare Worker qqai new build from c641a11ad8cd03f74f6321091e01375eb0ce6a60 success, deployment 20e8ce43-f056-4acf-9e89-1a04b006fd01, version 9c690db5-2681-4586-9047-e200cf3090f6, 100% traffic
- live Cloudflare observability shows repeated GET /onebot HTTP 401 every ~5 seconds (NapCat token mismatch or missing), confirmed after new deployment
- legacy archive at 6a22b06433cfaffcf13abe2b60a917305290b629 unchanged

blockers:
- NapCat token is not matching existing Secret ONEBOT_ACCESS_TOKEN; cannot read secret value. Must set same on both sides, do not copy to Git or messages.
- QQ official slash autocomplete list /!设置插话率 is independent server-side QQ bot developer-configured menu; not accessible through GitHub or Cloudflare. Must remove manually at developer portal.
- No post-deploy ABOT_GATEWAY_READY logged yet in samples; new gateway session readiness must be confirmed.
- Two QQ group end-to-end media/@ tests not yet verified.

verification_results: feature CI success and Cloudflare deploy success; real Bbot WS failure HTTP 401 verified; Abot official receive/reply still UNKNOWN
next_exact_action: user updates NapCat Bbot WebSocket Client Token to match Cloudflare ONEBOT_ACCESS_TOKEN, restarts/reconnects and sends @AIBot /!use as an ordinary chat message. If still no response, query latest Cloudflare official Gateway errors and ready status.
last_checkpoint_at: 2026-10-10T00:28:00+08:00
