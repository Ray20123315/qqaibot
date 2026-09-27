# DECISIONS

## Retained decisions

D-001 through D-015 remain accepted, including curated user output, silent successful recall, registered-command execution boundaries, grounded sensitive parameters, Codex quota/security/session rules, QQ Open Native V4, Command Registry as source of truth, preservation of mature non-transport systems, and feature-branch-before-cutover.

## D-016 Connectivity before migration breadth
status: accepted
date: 2026-09-27
Decision: prove real QQ Gateway READY plus group/C2C passive reply before migrating normal AI, legacy commands, moderation or media.

## D-017 Conservative initial intents
status: accepted
date: 2026-09-27
Decision: default first live connection to `GROUP_AND_C2C_EVENT (1 << 25 = 33554432)`, matching the documented C2C and group-at baseline. Additional intents are enabled only after confirming the application's granted permissions.

## D-018 Gateway session state survives runtime recreation
status: accepted
date: 2026-09-27
Decision: persist Gateway `session_id` and `seq`, use Resume when possible, and combine reconnect/backoff with the existing minute cron watchdog instead of assuming an outbound WebSocket lives forever.
