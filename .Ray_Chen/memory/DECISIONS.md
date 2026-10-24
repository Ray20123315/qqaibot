# DECISIONS
- 2026-10-11: Native Windows Forms GUI is the official Codex Bridge frontend; hidden Node backend remains a sibling EXE. Do not duplicate/rewrite.
- 2026-10-11: Native QQ slash suggestion /!设置插话率 may live in QQ publisher configuration, independent of Worker; deletion requires authoritative platform confirmation.
- 2026-10-15: Only exact leading /跨群 <文字> authorizes sending; all other QQ group events are non-relay. Existing D1 room_id defines the scope and preserves trust separation between rooms.
- 2026-10-15: Forward only to verified and not stopped targets; stopped and receive-only sender restrictions remain effective. Legacy bridge_enabled toggles never reactivate continuous forwarding.
- 2026-10-15: Mark manual outbox IDs with manual-v1: and dispatch only those; cancel historical pending automatic jobs to avoid delayed broadcast. Disable join announcements. Use existing NapCat/Bbot ACK and do not retry ambiguous sends.

- 2026-10-24: Build separate `qqaibot-unsloth` Worker and `qqbot-ai.ray2025.com` domain, independent of old production `qqai`; text-only official QQ signed Webhook, group @ and C2C, fixed Unsloth upstream and no tool calling. New QQ bot must be explicitly configured and must not commandeer old callback.

- 2026-10-24: Admin-entered Unsloth API key is used only against the fixed /v1/models endpoint. A chosen model must be confirmed in that live list; encrypt key + selection with AES-GCM before persisting to standalone CONFIG_KV. ADMIN_TOKEN stays a Cloudflare Secret and is the encryption key derivation input; existing env secrets used only as initial fallback.

- 2026-10-24 supersedes browser API Key input/encrypted KV plan: Unsloth API Key only in Cloudflare Secret UNSLOTH_API_KEY; admin UI list models without key field, store selected model ID only in CONFIG_KV. Use global_fetch_strictly_public for same-zone public Tunnel subrequests.

- 2026-10-24: Minimal OpenAI Chat Completions request deliberately omits tools/tool_choice (no delegation capability), uses max_tokens 1024. Admin chat 60s timeout; QQ async handler 22s budget. UI returns sanitized errors rather than raw HTTP body or credentials.

- 2026-10-24: Keep QQ API fixed host while diagnosing. Current/legacy Tencent sources differ; do not blindly switch to api.sgroup.qq.com or bots.qq.com on UNKNOWN. Add safe QQ_AUTH_FETCH_FAILED and QQ_SEND_FETCH_FAILED classification, timeout/redirect/numeric business codes. Never send credentials or raw QQ response bodies into logs/KV.

- 2026-10-24: New QQ AI dashboard uses self-contained responsive UI in dashboard.js, signed 8h HttpOnly/Secure/SameSite=Strict HMAC session auth derived from ADMIN_TOKEN Worker Secret, same-origin write checks, bearer backward compatibility, no browser key storage. Existing worker secrets/KV and QQ callback intact. Preserve newlines in text replies; Qwen installed capabilities vs actual QQ integration must be reported separately.

- 2026-10-24: Set model-roles-v3 as canonical roles config (chat/asr/tts/webSearch) with legacy selected-model-v2 synchronized. Only ADMIN_TOKEN-protected admin can mutate IDs. Web search is opt-in on explicit request, enabled_tools=['web_search'] only, no MCP/shell/file tools; normal chat disables tools. User opted to EXCLUDE images entirely from routing, even though a local image model is installed.
- 2026-10-24: Unsloth Model auto-switch / idle-unload stays managed by Studio Settings → API. No forced simultaneous model loading: hardware/VRAM must be verified. Admin endpoints test ASR/TTS with WAV and multipart audio; QQ rich-media voice is a separate unverified scope.
- 2026-10-24: Preserve existing QQ/admin MODEL_* diagnostic codes at queryModel compatibility layer when upgrading upstream shared router; CI used to prove compatibility before merge/deploy.

- 2026-10-24: Always request Unsloth web_search for every chat, still hard restrict allowed tools to ['web_search'] and disable MCP, no shell/files/images. Do not treat an enabled flag as proof tools ran; prompt requires explicit caveat if tool results absent. Preserve prior role config shape for backward compatibility, override webSearch false on read and write.
- 2026-10-24: QQ rich message first via msg_type:2 markdown.content; native headings and lists. On definite Markdown rejection only, fall back once to msg_type:0 with markup removal, a new msg_seq, and 24h cached denial to avoid repeated errors/spam. Never retry uncertain send outcomes; true native Markdown depends on Tencent passive capability permission, which may require separate application.

- 2026-10-24: Latest customer persona replaces older 'tell model details if explicitly asked' rule. Do not supply internal AI/model/backend details under any prompt, direct or indirect; offer a short neutral refusal and help on the user's actual issue. Humanlike tone is permitted, but do not claim to be a real human or invent completed service actions. The central prompt is in standalone-qq-ai/role-router.js; all model responses instructed in Simplified Chinese. This release does not alter static QQ fallback text.

- 2026-10-24: Treat actual dashboard inline JavaScript as executable source; add CI test that parses the *served* page JS and exercises login submit handler in mocked DOM. Mere HTML string inclusion tests previously missed malformed JavaScript. Fix minimal saveRoles text syntax rather than rotate ADMIN_TOKEN or disable Origin/CSRF/session protections.
