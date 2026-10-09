# GOTCHAS

- Real 2026-10-09T16:01:12Z Cloudflare qqai error ABOT_RESPONSE_FAILED QQ_API_400:40034024:请求参数msg_id无效或越权. New group reply fallback only when explicit error code, not generic 400/5xx/timeout.
- Cloudflare new code deployment may still temporarily show old Durable Object versions in telemetry, due globally eventually-consistent DO updates.
- /use was previously able to allocate DB room before failed API reply; a repeat /use now regenerates pending credentials.
- If group proactive reply permission is off, retry without msg_id may still be rejected, requiring group owner to enable QQ group bot proactive messages.
- Bbot reverse WebSocket needs authenticated NapCat and connected service; no successful Bbot events observed in sampled Cloudflare logs.
