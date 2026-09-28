# DECISIONS

## Retained

D-001 through D-038 remain in force.

## D-039 Conservative automatic group mapping
status: accepted
date: 2026-09-28
Decision: static `QQ_HYBRID_GROUP_MAP` remains authoritative, but missing mappings may be learned from short-window QQ Open/OneBot message correlation only after 3 distinct official-message evidence points for one unambiguous candidate. Generic/ambiguous/conflicting evidence does not learn.

## D-040 Official lifecycle records stay OpenID-native
status: accepted
date: 2026-09-28
Decision: FRIEND, bot group membership and group member lifecycle events are persisted separately using QQ Open identifiers; they are not inserted into legacy numeric QQ membership tables.

## D-041 GROUP_MESSAGE_CREATE remains ownership evidence
status: accepted
date: 2026-09-28
Decision: learning a numeric-group/group_openid mapping alone does not disable ordinary OneBot group processing. Official full-message ownership activates only after the official group actually emits GROUP_MESSAGE_CREATE.
