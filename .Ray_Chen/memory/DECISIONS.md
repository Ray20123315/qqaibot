# DECISIONS

## Retained

D-001 through D-052 remain in force.

## D-053 Privileged discovery is cumulative
status: accepted
date: 2026-09-28
Decision: a higher-privilege discovery surface includes the lower-privilege command surface plus additional privileged commands. Developer-specific C2C panels therefore use member + developer permissions rather than developer-only filtering.

## D-054 Discovery visibility remains separate from authorization
status: accepted
date: 2026-09-28
Decision: cumulative UI visibility does not grant runtime permissions. Existing server-side authorization, confirmation, cooldown and feature switches remain mandatory.
