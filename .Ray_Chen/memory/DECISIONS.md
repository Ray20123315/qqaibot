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

## D-058 Public V4 integration preserves current main history
status: accepted
date: 2026-09-29
Decision: V4 public work is integrated through a two-parent merge whose first parent is the current main. Force-replacing main with the older feature branch is prohibited.

## D-059 Preview isolation is a D1 table namespace
status: accepted
date: 2026-09-29
Decision: same-Worker Preview may share the physical D1 database but must use `QQAI_DB_TABLE=kv_store_v4public_preview`; production must keep `QQAI_DB_TABLE` unset.

## D-060 Public resources are principal-owned
status: accepted
date: 2026-09-29
Decision: user AI providers, storage connectors, settings, memories and private persistence are modeled with explicit principal ownership and may only be shared through explicit policy.

## D-061 Hybrid health uses runtime hybrid status
status: accepted
date: 2026-09-29
Decision: OneBotHub status must call `await hybridRuntimeStatus(this.env)`; the removed/unimported `hybridStatus` symbol must not be used from worker runtime.
