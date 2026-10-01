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
status: accepted
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

## D-080 V4 Preview uses an isolated credential-free acceptance login
status: accepted
date: 2026-10-01
Decision: user acceptance testing uses a Preview-only highest-privilege login endpoint guarded by exact Preview hostname, `V4_PREVIEW_TEST_LOGIN=true`, an explicit expiry, and `QQ_OPEN_ENABLED=false`. It creates a temporary system-admin/developer session without copying production credentials. This path must not be enabled on the production hostname and must be removed or disabled before production merge.

## D-081 Cloudflare branch versions are code sources, not trusted Preview configurations
status: accepted
date: 2026-10-01
Decision: Connected Build branch versions may inherit production bindings/secrets. Before promoting code to the stable V4 Preview URL, copy only the code/module payload and construct an explicit Preview-safe binding set.

