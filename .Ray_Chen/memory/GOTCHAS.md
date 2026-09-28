# GOTCHAS

## Retained

All prior QQ Open, OpenID, Gateway, Portal, permissions, D1/Cron, Connected Builds and hybrid risks remain relevant.

## G-043 Destructive fallback ambiguity
Risk: QQ Open may complete a moderation action while the caller only sees a timeout/5xx. Falling back to OneBot in this state can execute the action twice.
Mitigation: classify timeout/network/5xx as UNKNOWN and never fallback. Only explicit unsupported/unavailable or permission-denied states may fall back.

## G-044 OpenID is not a numeric QQ identity
Risk: mapped group identity does not imply member identity mapping. Reusing a QQ Open member OpenID as OneBot user_id can target the wrong entity or fail unpredictably.
Mitigation: targeted OneBot fallback requires an independently known numeric user ID. Never coerce OpenID.

## G-045 AI Provider soul-existence
Risk: a provider could keep sharing an API to a group after leaving it if authorization only checks a stored group list.
Mitigation: sharing records are only intent; every shared access decision must re-verify current membership for both provider owner and consuming member.

## G-046 Legal whitelist is not consent
Risk: treating a developer group whitelist as user consent creates false consent records.
Mitigation: store consent and developer group override separately. Override changes access only and remains silent in the target group.

## G-047 Text-only political filters are incomplete
Risk: names, euphemisms and indirect political questions may bypass keyword rules.
Mitigation: text prefilter executes first; ambiguous content requires a classifier and generated output receives the same guard before send. Unknown classification defaults to block.

## G-048 Plugin static scan is not enough
Risk: benign-looking plugin code may attempt cross-tenant/global access only at runtime.
Mitigation: runtime boundary violations with non-overridable impacts must terminate execution and create/update a security-center record.
