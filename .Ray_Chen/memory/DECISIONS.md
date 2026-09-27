# DECISIONS

## Retained

D-001 through D-029 remain in force.

## D-030 Shared runtime bridge for QQ Open
status: accepted
date: 2026-09-28
Decision: QQ Open inbound events will be normalized and forwarded through the existing Worker direct-loopback rather than implementing a separate AI/command stack.

## D-031 Platform-aware action compatibility
status: accepted
date: 2026-09-28
Decision: while processing a QQ Open event, OneBot-style actions required by existing code are translated to QQ Open API calls where an official equivalent exists. Unsupported legacy-only actions fail explicitly instead of silently using NapCat.

## D-032 Explicit OpenID developer elevation only
status: accepted
date: 2026-09-28
Decision: developer-only QQ Open commands may recognize a dedicated explicit OpenID allowlist. Numeric QQ developer configuration remains unchanged for OneBot.
