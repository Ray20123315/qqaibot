# ACTIVE_TASK

task_id: qq-cross-group-bridge-20261009
task_status: active
goal_revision: 8
goal: deploy Bbot-only mode on main, fully silencing Abot at application level without deleting data
acceptance_criteria:
- No official QQ API request, Abot Gateway WebSocket reconnect, Abot event processing or outgoing send on new Worker.
- Cron asks both historical Abot DO instances to shut down; DO class remains inert and supports /shutdown + alarm.
- All legacy OpenID and NapCat QQ numeric destinations use Bbot OneBot; missing numeric group fails closed, no QQ Open fallback.
- Bbot command, role checks, stop/grant protection, structured media native segments retained.
- Bbot offline does not consume queued messages; connected alarm uses direct socket instead of calling its own DO stub.
- Tests + dry-run green, main moved without force, Cloudflare connected build source verified.
current_phase: feature change staged
current_step: run GitHub CI on feature/bbot-only-20261010 and repair failures if any
completed_steps:
- inspected existing main e02b5ecd94ef51a70a1299e3f28ea0a578dc4738 and archive branch SHA
- rewrote src/delivery.js to Bbot-only dispatch regardless of Group OpenID
- reduced src/bridge.js to Bbot-only control, message outbox, roster management and flushing; official event functions removed
- disabled QQ Gateway session creation and event dispatch in worker.js; health exposes Abot disabled
- cron shuts down bridge-abot and bridge-abot-commands-v2 historical DOs
- new tests cover NO official API, legacy group id, Bbot ACK, old gateway shutdown, offline pending
- new docs, vars and README make mode explicit
verification_results: pending feature CI, Worker dry-run, remote deploy and QQ smoke
known_risks:
- Hot historical QQ Gateway instance could continue old code until closed / version updated. Must check Cloudflare telemetry.
- Real NapCat WS currently requires working OneBot connection. User should check /health.
- Existing D1 group without numeric QQ ID cannot be forwarded via Bbot; no guessing/migration without reliable mapping.
next_exact_action: verify CI for this branch, then fast-forward main with expected SHA, observe Cloudflare deploy/old gateway event logs, package memory and Gmail notification.
last_checkpoint_at: 2026-10-09T17:02:01.899Z
