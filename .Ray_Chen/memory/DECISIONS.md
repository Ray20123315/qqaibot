# DECISIONS

## Retained

D-001 through D-054 remain in force.

## D-055 Developer is the top cumulative permission level
status: accepted
date: 2026-09-28
Decision: Developer discovery includes every command enabled for the current scope, not just member + developer entries.

## D-056 Group panels contain the complete group-scoped surface
status: accepted
date: 2026-09-28
Decision: categorized group panels include all enabled group-scoped commands across member, group_ops, ai_admin, owner and developer permissions. Runtime authorization remains the security boundary.

## D-057 QQ group targeting cannot implement per-user Developer hiding
status: accepted
date: 2026-09-28
Decision: QQ group panels can be specific to group_openids but not to an individual user inside a group. Developer-only group commands therefore cannot be both group-visible to the Developer and invisible to every other member using only the official panel API.
