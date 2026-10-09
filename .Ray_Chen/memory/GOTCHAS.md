# GOTCHAS

- QQ numeric QQ ID is not QQ OpenID; do not cast or conflate.
- QQ official docs note proactive group push disabled since 2025-04-21, so cross-group unsolicited outbound sends may fail.
- Trusted QQ roster needed before permission checks, including verifying protected IDs are absent; stale roster = deny.
- Bbot reverse WS Authorization must use ONEBOT_ACCESS_TOKEN; no secrets in Git.
- QQ platform owners can kick bots, outside software control.
- Bbot does not send relay messages, even on Abot failure.
- Official sender commands need passive msg_id replies when possible; destination relay may not have those IDs.
