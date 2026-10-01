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
status: superseded
superseded_by: D-083
date: 2026-09-29
Previous decision: omit action.click_limit from normal child-command buttons.
Reason superseded: current Tencent SDK DTO documents click_limit=1 as single-use, so omission does not provide reusable behavior.

## D-076 Unknown commands default to prefill
status: accepted
date: 2026-09-29
Decision: new or unclassified commands default to editable prefill so a new command cannot accidentally become a one-click execution path.

## D-077 Direct commands use reusable callbacks
status: superseded
superseded_by: D-082
date: 2026-09-29
Previous decision: group keyboard commands explicitly marked direct use action.type=1 callbacks.
Reason superseded: user acceptance showed callback execution did not produce the required normal Bot message behavior. Direct commands now go through the same message path as manually sent ! commands.

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



## D-082 Direct no-parameter commands send real QQ messages
status: accepted
date: 2026-10-01
Decision: a group keyboard command that needs no extra input uses action.type=2 with enter=true and the canonical ! command. Callback action.type=1 is reserved for panel navigation such as previous/next page.
Reason: Bot replies and all existing permission/command middleware must be reached through the normal message path.

## D-083 Reusable QQ keyboard buttons use explicit click_limit
status: accepted
date: 2026-10-01
Decision: command and pagination buttons explicitly send click_limit=10.
Reason: Tencent's current QQ Bot SDK documents click_limit=1 as single-use and an official example demonstrates click_limit=10. Omitting the field caused the observed one-click-only behavior.

## D-084 Verified legacy identity drives cross-transport authorization
status: accepted
date: 2026-10-01
Decision: QQ Open transport remains OpenID-native, but permission/whitelist decisions may use old-Bot-verified numeric QQ/group mappings. If canonical QQ identity and old-Bot verification conflict, authorization is downgraded and audited.
Reason: QQ Open does not expose the numeric QQ identity needed by existing whitelist/permission records.

## D-085 Whitelist precedes official plugin dispatch
status: accepted
date: 2026-10-01
Decision: OneBot and QQ Open group events must pass the group whitelist before V3 official plugin dispatch.
Reason: plugins run before the core Worker handler; without this gate, non-whitelist groups could still invoke activity/poll/voice/plugin behavior.

## D-086 Group command gate owns both core and plugin command paths
status: accepted
date: 2026-10-01
Decision: !指令关 blocks group ! commands in the core Worker and V3 official plugins. !指令开 is always preserved as the authorized recovery path.


## D-087 Successful login completes through full page navigation
status: accepted
date: 2026-10-01
Decision: after a successful QQ-code, password, or Preview test login, the Portal must finish authentication with a full page reload instead of immediately invoking boot() in the same fetch chain.
Reason: the reported UI required a second login attempt even though the first authentication already created a valid session. A clean navigation removes stale in-page authentication/bootstrap state and starts the normal session bootstrap path once.

## D-088 Live Bot testing is paused without an isolated canary route
status: accepted
date: 2026-10-01
Decision: do not send live Bot test messages into existing QQ groups until an isolated Bot/canary route exists or the user explicitly authorizes a narrowly scoped real-group test.
Reason: current live testing would affect normal group chat and is not an isolated acceptance environment.
