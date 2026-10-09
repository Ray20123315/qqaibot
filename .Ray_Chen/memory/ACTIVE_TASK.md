# ACTIVE_TASK

task_id: qqaibot-ai-rebuild-20261010
task_status: active
goal_revision: 1
goal: implement lean QQ AI assistant with preconfigured Gemini/DeepSeek Secret key pools, trigger-only replies, per-group context and quota, while preserving old bridge as disabled-by-default plugin and backups
acceptance_criteria:
- Existing Cloudflare Secret names Gemini GEMINI_API_KEYS and DEEPSEEK_API_KEY reused; no new API key, no Cloudflare AI binding dependency or accidental key disclosure.
- Gemini generateContent call via x-goog-api-key header, existing GEMINI_CHAT_MODELS list + compatible fallback; DeepSeek chat/completions uses DEEPSEEK_API_KEY only after explicit !model deepseek selection, no automatic cross-provider paid fallback.
- No proactive interjections or untriggered QQ chat replies. Only @Bbot, reply to Bbot sent message or !ai.
- !help, !status, !setting and !setting ai on/off, !model gemini/deepseek, !plugin list, !plugin bridge on/off, !clear.
- D1 per-group provider and plugin config persists; history split by QQ group and author, retained ≤3d, per-user 20 and group 120 daily defaults, request dedupe.
- Plugin default OFF even for historical linked groups and previously pending messages; source and destination require explicit on, and cross-group modules lazy import when possible.
- Preserve original D1, protected QQ identity policy, old archives and Abot disabled.
- New independent Bbot DO hub identity requires manual NapCat WS reconnect after eventual deploy, no changes to URL or Token.
- Automated tests, Wrangler dry-run, Cloudflare deployment and (later) QQ safe smoke. Do not misrepresent API mock tests as live model test.
current_phase: implementation staged for CI
current_step: run full GitHub Actions on feature/ai-assistant-rebuild-20261010, fix failures, evaluate safe main cutover
completed_steps:
- Confirmed Cloudflare qqai settings includes secret_text GEMINI_API_KEYS, GEMINI_VISION_API_KEYS, DEEPSEEK_API_KEY, CODEX_BRIDGE_ACCESS_TOKEN, plus model lists; did NOT request raw secret values.
- Inspected archived old provider-client & Gemini/Gemma/DeepSeek route code to mirror correct HTTP endpoints and Secret shapes.
- Created backup archive/bbot-bridge-before-ai-20261010 at product SHA 13b915d1d4451d4cb15ff91f70a498cede760d40; older backup remains unchanged.
- Created src/model-client.js using Gemini key pool + DeepSeek explicit provider, strict model name validation, bounded retries and error sanitization; no fallback between providers.
- Created src/assistant.js command router/short-term isolated conversations/quotas/plugin toggles; Gemini defaults and model selection persist in D1.
- Worker routes OneBot events through assistant and lazily loads old bridge module when needed; health reports AI mode and provider availability, Abot still disabled.
- src/bridge.js checks both source plugin setting and target enabled conditions through assistant_groups table, including pending sends, when ASSISTANT_MODE=true.
- New Bbot Hub bridge-bbot-ai-v1; wrangler vars ASSISTANT_MODE=true, limits 20/120; reuses named Secrets.
- Added tests/assistant.test.mjs for secret names, headers, explicit DeepSeek, !ai dedupe, quiet messages and unauthorized plugin; adapted legacy health/HUB/scheduled tests.
- README and DEPLOY replaced with concise docs, no longer advertise bridge as main bot.
verification_results: CI pending, no live production change yet
risks:
- Current AI MVP text-only; media multimodal from old runtime is not copied into new core yet.
- Cloudflare configured GEMINI_CHAT_MODELS may include preview or unavailable models; try one configured plus stable fallback.
- D1 new tables additive, no drop or data migration; new DO generation requires NapCat reconnect after rollout.
- QQ real model API requests untested. Do not assume response or rate availability.
next_exact_action: run feature CI, repair failures. On green, decide cutover safety, promote main with expected SHA, confirm Cloudflare build, package memory tar SHA and send Gmail. Need controlled QQ prompt test to confirm actual answer.
checkpoint_at: 2026-10-09T18:26:04.585Z
