# GOTCHAS

## Retained risks

- OpenID is not a numeric QQ ID.
- Model output never bypasses registered handlers/authorization.
- Filesystem safety remains local to CodexWork enforcement.
- Gateway intents/session state are strict and must be persisted.
- Outbound WebSocket lifetime is not permanent.
- Reconnect storms must be bounded.
- QQ UI/connection status alone is not E2E proof.

## G-015 Portal animation versus accessibility/performance
Risk: deliberately heavy animations can make low-power devices unpleasant or inaccessible.
Avoidance: motion uses CSS transforms/opacity where possible and all decorative animation/tilt is disabled under `prefers-reduced-motion: reduce`.

## G-016 Legacy light-theme variables can break V4 contrast
Risk: the old Portal theme can leave dark V4 surfaces with dark text.
Avoidance: the V4 lean body defines its own high-contrast dark design tokens.

## G-017 Portal pruning can hide data still needed for migration
Risk: deleting legacy modules or D1 data too early can remove configuration/history before QQ Open replacements are verified.
Avoidance: first prune navigation and V4 registry; retain rollback code/data until live verification, then physically delete dead modules.

## G-018 QQ management permission availability is app-specific
Risk: documented group management APIs may return permission/admin errors for a specific bot.
Avoidance: Portal handles permission failures visibly and live verification is required before declaring a management capability production-ready.

## G-019 Principal identity is not automatically cross-context identity
Risk: QQ Open may expose different opaque identifiers in C2C and group contexts.
Avoidance: Codex accepts a stable `principalId` when identity mapping exists; otherwise it falls back to platform user ID and does not invent cross-ID equivalence.
