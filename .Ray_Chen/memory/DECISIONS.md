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
