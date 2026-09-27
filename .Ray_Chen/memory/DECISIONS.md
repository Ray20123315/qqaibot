# DECISIONS

## Retained

D-001 through D-032 remain in force.

## D-033 Hybrid QQ transport
status: accepted
date: 2026-09-28
Decision: QQ Open is the primary official interaction/action channel; NapCat/OneBot remains auxiliary for missing visibility/capabilities.

## D-034 Dynamic full-group ownership
status: accepted
date: 2026-09-28
Decision: ordinary OneBot group messages are not disabled merely because hybrid mode is enabled. A mapped group transitions to QQ Open full-message ownership only after actual GROUP_MESSAGE_CREATE evidence is observed.

## D-035 Interaction intent permission gate
status: accepted
date: 2026-09-28
Decision: INTERACTION_CREATE support is deployed, but production remains at `33554432` until QQ Platform permission is confirmed. The future combined baseline is `100663296`.

## D-036 Active push state
status: accepted
date: 2026-09-28
Decision: C2C/GROUP MSG RECEIVE/REJECT are persisted as active-push permission state, not treated as ordinary messages.

## D-037 Hybrid scheduled outbound
status: accepted
date: 2026-09-28
Decision: informational schedules and active speaking prefer QQ Open only for explicitly mapped groups with current official push permission and without numeric QQ mentions. Otherwise OneBot remains the fallback.

## D-038 Unknown interaction callbacks are non-executable
status: accepted
date: 2026-09-28
Decision: only direct commands, structured command payloads, or explicit feature_id mappings execute. Unknown callbacks are acknowledged/recorded rather than guessed.
