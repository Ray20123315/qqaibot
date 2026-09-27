# DECISIONS

## Retained

D-001 through D-032 remain in force.

## D-033 Hybrid QQ transport
status: accepted
date: 2026-09-28
Decision: QQ Open is the primary official interaction/action transport; NapCat/OneBot remains an auxiliary full-visibility/capability transport for events or data unavailable from QQ Open. Explicit ownership and dedupe are required.

## D-034 Full-group official observation
status: accepted
date: 2026-09-28
Decision: when QQ grants "receive all messages", GROUP_MESSAGE_CREATE is treated as the official group full-message source. OneBot must not separately trigger AI/plugin side effects for an event already owned by QQ Open.

## D-035 Interaction intent is permission-gated
status: accepted
date: 2026-09-28
Decision: INTERACTION_CREATE support is implemented, but INTERACTION (1<<26) is not forced into production intents until the QQ application is confirmed to have that permission.

## D-036 Active-push permission is explicit state
status: accepted
date: 2026-09-28
Decision: C2C/GROUP MSG RECEIVE/REJECT events update push-permission state used by scheduled/active notifications instead of being treated as chat messages.
