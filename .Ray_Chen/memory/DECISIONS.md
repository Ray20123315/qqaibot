# DECISIONS

## D-001 Curated member-detail output

status: accepted
date: 2026-09-27

Decision: retain the underlying data collection for functionality/audit, but format QQ output as curated fields and source-state summaries. Do not stringify full OneBot/D1 objects into user-visible QQ messages.

## D-002 Silent successful recall

status: accepted
date: 2026-09-27

Decision: keep errors visible, but return HTTP 204 after a successful administrator `!撤回`.

## D-003 AI selects commands, handlers execute them

status: accepted
date: 2026-09-27

Decision: AI is a routing/classification layer only. It selects from a fixed command allowlist and produces a normalized existing command. The existing command handler remains the sole executor and therefore retains all established permission and confirmation behavior.

## D-004 Ground sensitive parameters

status: accepted
date: 2026-09-27

Decision: member targets and web URLs selected by the router must be grounded in actual mentions/source text. Recall additionally requires an actual quoted message.
