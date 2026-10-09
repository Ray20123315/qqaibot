# ACTIVE_TASK

task_id: qq-cross-group-bridge-20261009
task_status: active
goal_revision: 1
current_phase: GitHub CI verification
current_step: unit tests and Worker bundle passed in feature run 37946376223; follow-up parser fixes staged for second CI run

completed_steps:
- archived old main commit 6a22b06433cfaffcf13abe2b60a917305290b629 at archive/legacy-main-20261009
- created clean cross-group bridge feature commit 2435e9115fe700a118ad44ba8fa838a932f8284e
- first feature CI GitHub Actions run 37946376223 succeeded (test + Wrangler dry run)
- Bbot numeric roster authorization, Abot group registration, encrypted-code hash pairing, disabled AI, failed-outbound audit implemented
- slash prefix and non-relay of unknown commands fixed pending repeat CI

known_blockers:
- official Tencent active push restriction blocks proof of unsolicited target-group relaying
- live multi-group credential-backed OpenID / @ validation unavailable; cannot promote production main safely

next_exact_action: verify second CI, record success, then sandbox test official proactively sent message and @ before main deployment.
