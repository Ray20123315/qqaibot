# DECISIONS

## Retained

D-001 through D-041 remain in force.

## D-042 QQ Open reply does not synthesize user mention text
status: accepted
date: 2026-09-28
Decision: ordinary QQ Open AI replies must not prepend `reply_plan.mentionIds` as visible CQ/OpenID mention text. The official source-message `msg_id` and `msg_seq` carry passive-reply semantics.

## D-043 Mapping observation is independent from ownership
status: accepted
date: 2026-09-28
Decision: all eligible human OneBot group messages may be recorded as mapping observations before transport ownership is decided. Observation does not authorize OneBot to reply or execute side effects.

## D-044 Hybrid correlation is order-independent
status: accepted
date: 2026-09-28
Decision: retain recent official and OneBot observations separately so either transport may arrive first. Later arrival rechecks the opposite-side observations and may add mapping evidence.

## D-045 Discovery payload follows QQ API wrappers
status: accepted
date: 2026-09-28
Decision: menu update uses `{menu}`, panel listing always supplies a scene scope, and panel update uses `{panel}`. Discovery enumerates C2C and group panels separately.
