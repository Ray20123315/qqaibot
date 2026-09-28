# DECISIONS

## Retained

D-001 through D-045 remain in force.

## D-046 Capability-aware legacy action fallback
status: accepted
date: 2026-09-28
Decision: QQ Open remains the first execution transport. Legacy OneBot may run only after a deterministic official capability/permission/unavailability result (or safe read fallback), required group mapping and legacy Bot role checks pass, and required target identities can be represented safely.

## D-047 Ingress ownership remains single-path
status: accepted
date: 2026-09-28
Decision: restoring legacy capabilities does not re-enable parallel command handling by the old Bot. Fallback is inside the single AIBot command execution after official capability evaluation.

## D-048 Cross-transport writes use conservative retry semantics
status: accepted
date: 2026-09-28
Decision: ambiguous mutating QQ Open timeout/5xx results are not replayed through OneBot because the official side effect may already have occurred.

## D-049 Member identity mapping is evidence-based
status: accepted
date: 2026-09-28
Decision: member OpenID -> numeric QQ mapping is recorded only after the group mapping is confirmed and a correlated OneBot observation provides a numeric user ID without conflict.


## D-050 QQ discovery is category-oriented
status: accepted
date: 2026-09-28
Decision: QQ group command discovery is split into category-specific panels. QQ PanelItem has no nested child-panel primitive, so category separation is implemented as multiple panels. C2C custom menu uses QQ's native one-level submenu support.

## D-051 Discovery visibility is not authorization
status: accepted
date: 2026-09-28
Decision: hiding a privileged command from a menu/panel is only UX/discovery filtering. Runtime authorization, feature switches, cooldowns and confirmation flows remain mandatory for every command execution.
