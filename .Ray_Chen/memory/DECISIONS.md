# DECISIONS

## Retained

D-001 through D-073 remain in force.

## D-074 Normal child-command button split
status: superseded
superseded_by: D-077
date: 2026-09-29
Previous decision: use action.type=2 for all normal child-command buttons and panel.enter=true for direct send.
Reason superseded: live QQ group clients can still place type=2 commands into the input box despite enter=true.

## D-075 Normal command buttons are reusable by default
status: accepted
date: 2026-09-29
Decision: omit action.click_limit from normal child-command buttons. Unrelated features may still set an explicit limit if they truly need one.

## D-076 Unknown commands default to prefill
status: accepted
date: 2026-09-29
Decision: new or unclassified commands default to editable prefill so a new command cannot accidentally become a one-click execution path.

## D-077 Direct commands use reusable callbacks
status: superseded
superseded_by: D-079
date: 2026-09-29
Decision: group keyboard commands explicitly marked direct use action.type=1 reusable callbacks. QqOpenGateway ACKs INTERACTION_CREATE first, then dispatches the existing canonical command handler. This guarantees immediate execution independently of QQ group type=2 enter behavior.

## D-078 Parameterized commands stay command-button prefills
status: accepted
date: 2026-09-29
Decision: commands needing parameters, targets or content use action.type=2 with enter=false and a trailing-space canonical command. Existing handler authorization remains unchanged.

## D-079 Every active group category is regression-owned
status: accepted
date: 2026-09-29
Decision: tests enumerate every non-empty GROUP_PANEL_CATEGORY_META category and every keyboard page, requiring full command coverage and valid row/button limits. Single-category success is not sufficient evidence.

## D-079 Direct commands must emit normal QQ messages
status: accepted
date: 2026-10-01
Decision: direct/no-argument group keyboard commands use action.type=2 with enter=true so the QQ client generates the ordinary command-message event consumed by the normal Bot handler. Callback-only execution is not accepted for these commands. Parameterized commands remain action.type=2 with enter=false. Pagination also uses the normal command-message path.
Reason: live user testing showed callback-only execution does not produce the expected Bot reply behavior, while the product requirement is specifically to send a message rather than dispatch an interaction callback.
Scope: test branch only until live QQ client smoke validation succeeds; main remains untouched.
