# GOTCHAS

## Retained

Prior transport, identity, user-storage, political and plugin risks remain relevant.

## G-051 Group storage cannot be inferred from message sender
Risk: choosing the current speaker's D1/KV as a group's permanent storage would allow arbitrary members to redirect shared group data and break ownership.
Mitigation: QQ Open group durable persistence stays disabled until an explicit group storage owner and connector authorization are configured.

## G-052 No hidden platform fallback
Risk: a failed/missing user connector could silently push private content back into platform D1.
Mitigation: USER_STORAGE_REQUIRED resolves to non-durable private chat; it never falls back to platform user-content storage.
