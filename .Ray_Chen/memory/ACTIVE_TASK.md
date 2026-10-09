# ACTIVE_TASK

task_id: qq-cross-group-bridge-20261009
task_status: active
goal_revision: 3
current_phase: multi-group dual-proof binding and Abot/Bbot fallback regression
current_step: verify CI for secure pairing and no-echo guard

completed_steps:
- old main archived at archive/legacy-main-20261009
- Abot-first proactive and media upload, Bbot only after definite Abot rejection or unencodable native media
- use OneBot send_group_msg and confirm ACK before counting Bbot delivery
- QQ ID and group OpenID two-sided identity verification
- QQ group numeric ID pairing now requires Abot AND Bbot observe same verification code
- group membership / owner / admin verified by Bbot fresh roster, fail closed
- Abot replies and sent messages include invisible bridge echo marker to prevent loops
- rich media chunks for image, record, video, file, face, native fallback; AI chat disabled
- /status opportunistically reads group bot_state allow_proactive_msg if permission granted
- previous CI 37950336668 succeeded, test correction in v0.0.68 verified

verification_results:
- latest dual-proof patch CI pending
- Cloudflare settings read-only confirmed required secret binding names, secret values not read
- live QQ sandbox/proactive-send/mention/media still not tested
- no production main change

blocking_gates:
- QQ group proactive send permission and Bbot NapCat HTTP/WS live test necessary before safe main deployment
- Bbot needs to reconnect and authenticate to new Worker; old production DO transports cannot be assumed to migrate automatically
- test group consent to cross-group transcript redistribution

next_exact_action: confirm CI for this commit + v0.0.69 archive, then test two-sided group pairing in isolated QQ groups, read actual Abot API response, verify Bbot fallback, then promote main only if reliable.
