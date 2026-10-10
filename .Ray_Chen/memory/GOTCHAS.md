# GOTCHAS
- QQ official group passive reply validity ~5 min and source msg_id required; old proactive send failures are not evidence passive path works. Error 40034105 may persist for app lacking permission, no blind Bbot fallback.
- GROUP_MESSAGE_CREATE can include ordinary messages: reply only if mentions.is_you true. GROUP_AT_MESSAGE_CREATE is the safe default.
- New QqOpenGateway WebSocket within DO must send HELLO IDENTIFY, heartbeats on alarms, report READY and reconnect; older hot DO identity is separate.
- D1 official group_openid and member_openid are opaque, not numeric QQ; no fake conversions.
- Bbot optional plugin disabled by default. Do not let it reply concurrently to same !ai query.
- QQ token and Gemini API Key never logged; only safe status/code in health.
