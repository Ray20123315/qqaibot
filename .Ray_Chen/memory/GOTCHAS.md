# GOTCHAS

## Retained risks

- Never expose raw internal structures when curated output is enough.
- AI/model output is not an execution primitive; registered handlers and permissions remain authoritative.
- OpenID is not a numeric QQ ID.
- Filesystem safety cannot rely on prompts; CodexWork local enforcement remains authoritative.
- Command-panel limits require paging; never silently truncate commands.
- Large automated edits require syntax/CI gates.

## G-011 QQ Gateway intents/session rules
Risk: requesting unauthorized intents can close the Gateway connection; losing session/sequence state reduces Resume reliability.
Avoidance: request only granted intents and persist `session_id` / `seq`.

## G-012 Cloudflare outbound WebSocket lifecycle
Risk: outbound WebSockets do not use inbound WebSocket hibernation semantics and runtime lifetime is not a permanent-connection guarantee.
Avoidance: persist resume state, reconnect on close/error/timeout, and use the minute scheduler as a watchdog.

## G-013 Reconnect storms consume QQ session capacity
Risk: invalid credentials/intents/network failures can repeatedly create sessions.
Avoidance: 20-second connect timeout and bounded backoff 5s/10s/20s/40s/60s.

## G-014 UI connection state is not proof of message flow
Risk: socket OPEN is weaker than QQ READY, and READY is weaker than successful receive/reply.
Avoidance: distinguish connected vs READY in `!status`, then require real `!qqping` / `!qqecho` tests before migration proceeds.
