# ACTIVE_TASK
task_id: qq-cross-group-bridge-20261009
task_status: active
goal_revision: 8
goal: temporarily disable all Abot application traffic and route every group command and outbound delivery via Bbot
current_phase: last unit test mock correction
current_step: run feature branch CI; promote main only after green

completed:
- Bbot-only implementation with no QQ Open token/gateway/event/send calls
- old Abot DO shutdown in cron, QqOpenGateway preserved inert for compatibility
- Bbot offline outbox holding and directly injected Bbot send in DO alarm
- original main archive and existing D1 kept
- CI 37963398835: 33/35 pass, test mock and old echo expectation failed
- CI 37963624474: 34/35 pass, fake gateway URL corrected
- CI 37963768519: 34/35 pass, fake OneBot status URL string also needs normalization. Corrected now.

verification: next CI pending. main unchanged at previous production sha.
risk: old Abot hot DO socket cessation and QQ actual group flow still require runtime checks.
next_exact_action: pass new CI, move main with expected sha, verify Cloudflare source, package latest memory and send one Gmail notification.
