# ACTIVE_TASK

task_id: qq-cross-group-bridge-20261009
task_status: blocked
goal_revision: 1
current_phase: feature code and CI verified; awaiting operational capability proof
current_step: keep legacy main unchanged; confirm QQ official active cross-group delivery before production promotion

completed_steps:
- archived original main SHA 6a22b06433cfaffcf13abe2b60a917305290b629 at archive/legacy-main-20261009
- new clean Worker staged on feature/qq-cross-group-bridge-20261009
- first CI 37946376223 success (unit tests and Wrangler dry-run)
- second CI 37946659489 success (parser regression + Wrangler dry-run)
- Bbot numeric QQ identity and group roster fail-closed permission checks
- protected QQ 3569028262 and 2681167798; explicit manage/stop delegation, no inherited grant privilege
- room code, verify, join, rename, revoke, stop, resume, leave, status, identity-pairing
- onebot HTTP/reverse WebSocket, Abot Gateway, D1 outbox and idempotency
- AI removed from bridge code, no AI API calls
- old DO migration tags and database preserved
- real mentions disabled by default until proven supported

known_blockers:
- Tencent QQ official docs explicitly state proactive push no longer provided since 2025-04-21. The destination-group Abot send required by this design may be rejected.
- Current credentials and QQ group live client test were not executed to avoid affecting existing groups.
- No reliable production behavior validation. True @ and media delivery not verified; media uses placeholders.
- New secret ONEBOT_ACCESS_TOKEN and actual NapCat/Abot integration required.

next_exact_action: in isolated test groups, confirm Abot can send unsolicited cross-group messages via QQ official API; if platform rejects, redesign transport with user's approval instead of switching main or silently sending through Bbot.
