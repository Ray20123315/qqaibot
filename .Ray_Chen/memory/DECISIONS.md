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
status: superseded
superseded_by: D-089
date: 2026-10-01
Previous decision: after successful authentication, finish with a full page reload.
Reason superseded: the real browser does not reliably retain the Preview login session across reload, so reload itself became the failure trigger.

## D-088 Live Bot testing is paused without an isolated canary route
status: accepted
date: 2026-10-01
Decision: do not send live Bot test messages into existing QQ groups until an isolated Bot/canary route exists or the user explicitly authorizes a narrowly scoped real-group test.
Reason: current live testing would affect normal group chat and is not an isolated acceptance environment.


## D-089 Successful login completes in-page
status: accepted
date: 2026-10-01
Decision: successful QQ-code, password and Preview test login remain on the current page, confirm the new session through /api/portal/me, then call the shared authenticated Portal bootstrap. No forced reload is part of login completion.
Reason: a single login already creates a valid server session; forcing navigation is unnecessary and can expose browser cookie-persistence problems.

## D-090 V4 Preview uses a separate resumable acceptance session
status: superseded
superseded_by: D-091
date: 2026-10-01
Decision: only on the isolated V4 Preview, login also issues a separate opaque resume token. The server stores only a hash-keyed resume record, the client stores the opaque token in localStorage when remember-login is selected or sessionStorage otherwise, and boot exchanges it for a replacement HttpOnly session cookie if the ordinary cookie is unavailable. Resume tokens rotate after use and are revoked on logout.
Security boundary: exact Preview hostname, V4_PREVIEW_TEST_LOGIN=true, QQ_OPEN_ENABLED=false, Preview expiry and privileged-session absolute expiry remain authoritative. This mechanism is acceptance-only and must not silently become a production login credential.


## D-091 Persistent login uses a generic remember-device credential
status: accepted
date: 2026-10-01
Decision: every supported persistent Portal login may issue a separate opaque remember-device token in addition to the HttpOnly session cookie. The server stores only a SHA-256-keyed record, restore rotates the token and sets a replacement HttpOnly cookie, and logout revokes the active token.
Reason: Preview-only recovery did not satisfy the user's persistent-login requirement. Persistent login must survive loss of the ordinary session cookie across all supported login modes, not only the acceptance login.
Security: persistent sessions use the existing 30-day idle / 180-day absolute project limits. Unchecked privileged sessions retain the short 30-minute idle / 8-hour absolute limits. Preview and temporary-admin remember credentials remain capped by their external expiry.

## D-092 Portal motion follows the supplied dark aurora/glass reference
status: accepted
date: 2026-10-01
Decision: preserve the existing Portal information architecture while adding the supplied reference's visual language: dark layered radial background, purple/cyan moving blurred light fields, glass panels, hover glow/lift, button sheen, page-entry motion, topbar sweep and View Transition where supported.
Accessibility: nonessential motion is disabled under prefers-reduced-motion.

## D-093 Persistent remember state is an HttpOnly cookie
status: accepted
date: 2026-10-01
Decision: persistent Portal login stores the generic remember-device credential in a separate HttpOnly, Secure, SameSite=Lax `qqai_remember` cookie. The normal page bootstrap does not depend on JavaScript/localStorage to make persistence work.
Reason: real-browser refresh showed that an application-level localStorage restore path was not a reliable boundary for authentication persistence. Server-side cookie recovery runs before the Portal decides the user is logged out.

## D-094 Remember credentials can reconstruct a missing server session
status: accepted
date: 2026-10-01
Decision: a remember record stores a minimal sanitized session seed alongside the referenced session token. If the referenced persistent session no longer exists, restore creates a new persistent session from the seed, limits its absolute expiry to the remember credential expiry, then rotates the remember credential.
Reason: a remember token that only points to the old server session cannot recover when that old session record itself is missing.

