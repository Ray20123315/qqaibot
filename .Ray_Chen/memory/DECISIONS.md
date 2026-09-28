# DECISIONS

## Retained

D-001 through D-064 remain in force.

## D-065 Developer UI needs two gates
status: accepted
date: 2026-09-28
Decision: Developer UI is not exposed merely because a user knows 00000. The server first confirms that the current session belongs to a developer/system-admin identity; only then is the hidden input rendered. 00000 only unlocks the already-authorized developer surface in the browser.

## D-066 Normal V4 Portal is human-readable
status: accepted
date: 2026-09-28
Decision: Normal users see product concepts and resource state, not raw source/config/environment details. Raw QQ Open diagnostics and system internals remain developer-only.
