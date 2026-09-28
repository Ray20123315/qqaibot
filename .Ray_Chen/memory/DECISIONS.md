# DECISIONS

## Retained

D-001 through D-062 remain in force unless explicitly superseded below.

## D-063 Runtime plugin quarantine is impact-based
status: accepted
date: 2026-09-28
Decision: Runtime plugin quarantine is reserved for explicit or recognized global/cross-tenant/system security boundary violations. Ordinary plugin bugs are not automatically treated as security incidents.

## D-064 Runtime security block is immediate
status: accepted
date: 2026-09-28
Decision: A non-overridable runtime security finding immediately removes the plugin from the active runtime set, marks lifecycle blocked and reports the finding to the security center.
