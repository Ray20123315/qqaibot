# GOTCHAS

## Retained

G-001 through G-042 remain relevant, including QQ Open/OpenID, Gateway, Portal, permissions, D1/Cron, Connected Builds and hybrid mapping risks.

## G-043 Cross-transport side-effect retry
Risk: a QQ Open timeout or 5xx response may be ambiguous; the server can complete a write even when the client receives an error.
Mitigation: do not automatically retry mutating operations through OneBot for ambiguous failures. Limit automatic fallback to deterministic unsupported/permission/not-configured/rate-limit cases or safe read operations.

## G-044 QQ Open identifiers are not OneBot numeric identifiers
Risk: sending `group_openid`, member OpenID, QQ Open message ID or QQ Open request ID to NapCat numeric-ID actions can target the wrong object or simply fail.
Mitigation: resolve confirmed group/member mappings; reject message/request fallback when no safe translation exists.

## G-045 Command catalog pagination/order
Risk: inserting restored commands before the existing primary set can move important moderation entries out of the first official panel and break established UX/tests.
Mitigation: keep the original first 20 catalog entries in their established order; append restored functionality afterward.

## G-046 Text-slice module reconstruction
Risk: replacing an array by searching only for a closing token can accidentally retain/duplicate a second module body.
Mitigation: for compact catalog modules, reconstruct the complete module boundary and verify entry count plus syntax through CI.


## G-047 QQ command panels are flat
Risk: treating a QQ command panel as a nested menu would either flatten all commands into one surface or invent unsupported payload fields.
Mitigation: use separate category panels for group/channel discovery and use C2C custom-menu sub_menu_items only where the QQ API explicitly supports them.


## G-048 C2C submenu truncation
Risk: slicing a category to the QQ five-child submenu limit can make valid commands undiscoverable.
Mitigation: paginate each C2C category into additional top-level menu items and fail closed if the ten-item global menu limit would be exceeded.
