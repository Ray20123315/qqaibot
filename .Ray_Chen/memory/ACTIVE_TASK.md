# ACTIVE_TASK
task_id: qwen-qq-admin-console-20261024
task_status: completed
goal_revision: 8
goal: Replace standalone qqaibot-unsloth primitive admin page with a modern Qwen-branded login and management console while preserving QQ/Cloudflare safety; reflect user's existing vision, web and voice resources without installing image generation.
acceptance_criteria:
- Responsive modern login and navigation for dashboard, model, chat, QQ diagnostics and capabilities.
- ADMIN_TOKEN never persisted in browser storage or shown to client except input at login; signed secure HttpOnly session cookie and same-origin CSRF guard. Existing bearer authentication still works.
- Preserve user-provided truth: image understanding, internet and speech services already available; distinguish installed services from verified QQ Worker integration. Image generation explicitly paused.
- Fix paragraph/newline flattening in AI output without altering QQ signature/routing or command/tool restrictions.
- Isolated/legacy CI pass, PR merge main, standalone Cloudflare deployment readback with all secret/KV bindings.
current_phase: Code/CI/merge/deployment verified, user browser acceptance pending.
current_step: User opens live admin console and checks login/navigation/model/chat and QQ diagnosis.
completed_steps:
- Inspected repo and current Cloudflare bindings/QQ Worker. Old UI was literal inline HTML with ADMIN_TOKEN pasted for each call; current Worker only handles signed QQ text event payloads and fixed Unsloth chat endpoint.
- Added dashboard.js modern HTML/CSS/JS login and console; session-auth.js signed 8h __Host cookie and same-origin checks.
- Wired worker.js new modules and /api/session; preserved legacy bearer admin; replaced control-char regex to preserve \n, tabs and normalize CRLF; updated README and added dashboard-session tests.
- Adjusted UI after user correction: voice, vision, web resources already available but QQ integration not proven; no image-generation installation.
- PR #94 isolated CI 40082915685 PASS, existing AI CI 40082915660 PASS; merged main 8741abb9ea524adfb77dd3d7629ace6dda5b5fd3.
- Cloudflare independent qqaibot-unsloth Worker module upload 68e38e2c-da07-4c2b-a9d7-1e959f89e4d2, 100% verified with all 4 secret_text and CONFIG_KV. Source readback contains dashboard/session/admin/QQ routes; KV selected-model-v2 preserved.
verification_results: GitHub CI/merge and Cloudflare API deploy/readback SUCCESS. Real browser login/use and site visual appearance not independently smoke-tested. QQ real message after new deployment not checked.
known_failures: Initial CI failed old UI literal test expectation for UNSLOTH_API_KEY Secret; label reinstated, CI rerun PASS.
blockers: None for code/deploy. Manual browser acceptance and service integration are separate future work.
next_exact_action: User opens https://qqbot-ai.ray2025.com/, signs in with ADMIN_TOKEN and tests model selection, paragraph-preserving chat and QQ diagnostics.
resume_rule: Check current main and Worker deployment before further change; do not claim image/web/voice integration into this Worker without actual evidence; image generation stays disabled by user preference.
last_checkpoint_date: 2026-10-24
