# GOTCHAS

## Retained

All prior QQ Open, OpenID, Gateway, Portal, permissions, D1/Cron, Connected Builds and hybrid risks remain relevant.

## G-037 Synthetic OpenID mention leakage
Risk: taking `reply_plan.mentionIds` from the legacy-compatible AI plan and serializing it as CQ mention makes QQ Open output literal `<@OpenID>` text.
Mitigation: do not inject those mention IDs into ordinary QQ Open AI responses. Use source-message `msg_id + msg_seq` passive-reply semantics.

## G-038 QQ visible quote UI is not equivalent to passive reply
Risk: assuming `msg_id` must render a classic quote bubble leads to attempts to send unsupported `message_reference`.
Mitigation: keep official `msg_id + msg_seq`; do not depend on a currently unsupported group/C2C message-reference field.

## G-039 Hybrid mapping chicken-and-egg
Risk: if OneBot observations are only recorded after a group is already auxiliary/mapped, an unmapped group can never learn.
Mitigation: record lightweight human OneBot group observations before ownership logic; recording evidence must not imply OneBot ownership.

## G-040 Hybrid event-order dependency
Risk: QQ Open may arrive before OneBot or vice versa. One-sided immediate matching loses evidence.
Mitigation: keep capped recent lists for both transports and reconcile again on the later event.

## G-041 Low-information mapping evidence
Risk: short/common text such as HI/你好 can collide across groups.
Mitigation: keep those samples excluded. Require distinctive content/media and 3 distinct official message IDs.

## G-042 QQ discovery required fields
Risk: menu/panel sync can return HTTP 400 "必填字段缺失" when the request body is not wrapped or panel scope is omitted.
Mitigation: use `{menu}`, scoped panel listing, `records` pagination and `{panel}` updates.
