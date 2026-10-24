# USER_REQUIREMENTS
- Latest (2026-10-15): QQbot add /跨群 <文字>; include all previously bound groups from each existing D1 room; send cross-group ONLY upon that exact command, not continuously or from normal QQ messages. Keep bindings and trust model.
- Preserve native Windows GUI Codex Bridge (not CLI replacement), passive Abot AI, Bbot memory using D1/Vectorize, Luna non-think preference, politics policy, QQ plain-text AI replies, existing secrets/local configs/backups.
- Keep cross-group admin controls via verified NapCat QQ member roster. Two protected QQ accounts retain restrictions; existing stopped or receive-only bindings must not be silently overridden.
- Earlier user request: remove QQ native old suggestion /!设置插话率. Official published-command record is not available via current connected tools; actual deletion not verified, and unrelated QQ panels must not be wiped.

- Latest 2026-10-24: build a new official QQ Open Platform AI chatbot under QQAIBOT GitHub, in its own Cloudflare Worker; call home-hosted Unsloth via https://msiai.ray2025.com/; simple web backend, **no command execution**. Preserve existing QQ worker, bot, secrets and cross-group setup.

- Latest 2026-10-24 (goal revision 2): after entering Unsloth API Key in QQ AI admin page, automatically retrieve available models and let user choose one; selected model must persist and be used for QQ replies. Keep strict no command execution.

- 2026-10-24 latest: Store Unsloth API Key directly in Cloudflare Worker Secret, never in web UI or KV. Continue model discovery, model selection and QQ text-only mode with no command execution.

- 2026-10-24: Investigate chat "MODEL_UNAVAILABLE" without disclosing secrets, keep selected Unsloth model and strict no-command/no-tool-execution behavior. Address slow inference and provide actual failure categories rather than hiding diagnostics.

- 2026-10-24: Address actual QQ bot silence after confirmed event_received GROUP_AT and send_failed UNKNOWN, with actionable safe auth-vs-send diagnostics without exposing credentials or touching original qqai.

- 2026-10-24: Replace simplistic web page with proper Qwen login screen and functional admin interface. Vision, web browsing/search and speech functionality already exist in user's environment, so don't recommend reinstalling them or label them absent. Image generation explicitly on hold. Maintain safety boundaries and do not misrepresent QQ Worker integration.
