# GOTCHAS

## Existing retained risks

- Do not leak raw internal structures in user reports.
- Natural-language routing must not desynchronize parser inputs.
- Model output is never an execution primitive; allowlists/handlers remain authoritative.
- Filesystem safety cannot rely on prompts; local canonicalization/allowlists/staging/no-delete are mandatory.
- Public Codex quota operations must handle races/failures safely.
- Codex conversation continuity must survive bridge restarts.
- Context isolation is part of the security/performance boundary.
- Large automated edits can create duplicated source/test fragments; syntax and CI are blocking gates.
- CJS executable bundles cannot assume `import.meta.url`.

## G-010 OpenID is not a QQ number
Risk: numeric-only helpers can strip or corrupt `openid`, `member_openid`, and `group_openid`.
Avoidance: V4 identities remain opaque strings and gain an explicit platform identity layer before legacy numeric code is migrated.

## G-011 QQ Gateway intents and session state are strict
Risk: unauthorized intents can close the connection; losing `session_id`/`seq` weakens Resume behavior.
Avoidance: request only authorized intents, persist session/sequence state, implement heartbeat/reconnect/resume as a first-class runtime.

## G-012 QQ command-panel limits
Risk: a single panel has a finite item limit and silently slicing the registry loses commands.
Avoidance: generate multiple panels/pages; never truncate the compatibility catalog without surfacing the omission.

## G-013 Cloudflare outbound WebSocket lifecycle
Risk: an outbound WebSocket from a Durable Object does not use inbound WebSocket hibernation semantics and can still require reconnection after lifecycle events.
Avoidance: persist enough Gateway state for reconnection/resume and do not treat process lifetime as connection lifetime.
