# DECISIONS

## Retained

D-001 through D-071 remain in force.

## D-072 QQ Open personal profile data is user content
status: accepted
date: 2026-09-28
Decision: QQ Open personal style, do-not-disturb state and manual long-term memories are user content. Persistent reads/writes use the user's Storage Connector; missing storage means the setting/memory is not durably saved.

## D-073 QQ Open manual memories do not use platform Vectorize
status: accepted
date: 2026-09-28
Decision: QQ Open user memories may not be copied into the shared platform Vectorize index. The runtime uses the user's own memory connector directly.

## D-074 Do not repurpose arbitrary D1 databases to bypass Preview quota
status: accepted
date: 2026-09-28
Decision: When the account D1 limit blocks the dedicated Preview database, stop and record the blocker. Do not delete, overwrite or reuse another project's D1 without a separately verified ownership decision.
