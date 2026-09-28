# GOTCHAS

## Retained

All prior QQ Open, OpenID, Gateway, Portal, permissions, D1/Cron, Connected Builds, hybrid, user-storage and plugin risks remain relevant.

## G-043 Destructive fallback ambiguity
Risk: QQ Open may complete a moderation action while the caller only sees a timeout/5xx.
Mitigation: timeout/network/5xx are UNKNOWN and never trigger OneBot replay.

## G-044 OpenID is not numeric QQ
Risk: mapped group identity does not imply member identity mapping.
Mitigation: targeted OneBot fallback requires an independently known numeric identity.

## G-045 AI Provider soul-existence
Risk: provider access could survive after provider leaves a group.
Mitigation: sharing intent is not enough; live membership is verified at call time.

## G-046 Legal whitelist is not consent
Risk: developer whitelist could be mistaken for user consent.
Mitigation: keep consent and whitelist state separate.

## G-047 Text-only political filters are incomplete
Risk: names, euphemisms and indirect political questions bypass keywords.
Mitigation: text prefilter first, classifier for ambiguous input, output guard before save/send.

## G-048 Plugin static scan is not enough
Risk: runtime-only cross-tenant/global behavior can evade artifact scan.
Mitigation: next transaction wires runtime security violations into force-stop + security-center quarantine.
