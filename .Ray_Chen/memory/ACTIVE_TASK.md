# ACTIVE_TASK
task_id: unsloth-qq-chat-diagnostics-20261024
task_status: blocked
goal_revision: 5
goal: Fix generic MODEL_UNAVAILABLE for standalone QQ Unsloth Worker and support usable diagnostics/slow local inference while preserving secrets and old QQ system.
acceptance_criteria:
- Keep ADMIN_TOKEN and UNSLOTH_API_KEY as Cloudflare Worker Secrets, selected-model-v2 as KV-only model ID.
- Make Chat Completions minimal, no tool delegation, max_tokens 1024, safe model error classifications and useful admin hints; web timeout 60s.
- Preserve QQ async lifecycle with 22s timeout; do not change existing qqai worker, D1, QQ platform callback, or group state.
- GitHub isolated+legacy CI succeed, main merge and standalone Cloudflare deployment verified.
- Explicitly identify true live model inference as not yet verified.
current_phase: Code merged/deployed, user real chat test pending.
current_step: User re-tests admin chat and reports precise safe error or successful reply.
completed_steps:
- Confirmed Cloudflare Worker secret_text ADMIN_TOKEN and UNSLOTH_API_KEY, CONFIG_KV selected-model-v2 key, compatible same-zone public flag; no secret value read or modified.
- Inspected old model chat POST with 18s timeout / generic catch. Implemented safer minimal OpenAI Chat Completions, 60s admin / 22s QQ timeout, classified errors and safe UI hints, more model tests and README.
- Fixed previous tests' outdated expectations about tools fields. PR #89 isolated CI 40076227706 and existing QQ CI 40076227711 SUCCESS; merged a974232b6f71991af2d23f654d618ccc0ec72465.
- Cloudflare Worker uploaded with strict inherited secrets and KV, version 327900f7-5a47-46dc-87ca-ee8988240bdf, 100% deployment. Readback confirmed flags, bindings and code.
verification_results: Node GitHub CI SUCCESS, Cloudflare deployment 100%, secret type and KV binding preserved. Actual chat inference/QQ response still unverified.
blockers: No real admin chat retry from user yet; root cause of prior MODEL_UNAVAILABLE unknown. QQ response for slow model may exceed background waitUntil (22s) and require durable queue if prolonged.
next_exact_action: User reloads QQ AI admin website, tests one message, reports exact safe error code if any or successful model reply; do not send API secrets.
resume_rule: Verify git main head and Cloudflare deployment version before changing; only modify separate standalone worker.
last_checkpoint_date: 2026-10-24
