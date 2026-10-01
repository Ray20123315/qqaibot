# GOTCHAS

## Retained

G-001 through G-069 remain relevant.

## G-070 type=2 enter=true direct-command concern
status: superseded_by G-075
Previous risk: type=2 enter=true was treated as unreliable, so direct commands were moved to callbacks.
Why superseded: callbacks failed the required normal Bot reply path in user acceptance. The current design intentionally uses the QQ message path and explicit click limits; actual client behavior remains an acceptance item.

## G-071 Single-category keyboard tests can hide missing category UX
Risk: validating only 基础 or one paginated category can leave other root categories returning fallback text or malformed payloads.
Mitigation: enumerate every non-empty group category, every page and every enabled group command in regression tests; also serialize one transport payload per category.

## G-072 Display labels are not canonical identifiers
Risk: UI labels can normalize case, e.g. QQ语音 -> qq语音, causing false coverage failures.
Mitigation: match keyboard coverage using canonical action.data rather than render_data.label.

## G-073 Connected Build branch versions can contain production bindings
Risk: a non-main branch version upload can still inherit production Worker secrets and production-oriented plain-text settings.
Mitigation: never point the V4 Preview directly at an unchecked uploaded branch version. Read binding names/types first, then create a Preview deployment with an explicit safe env that excludes production QQ/OneBot/AI/Vectorize/admin secrets.

## G-074 Preview credential-copy attempts may be blocked by platform safety controls
Risk: directly moving password hashes or secret values between production and Preview can be rejected by the tool safety layer and creates unnecessary credential handling.
Mitigation: do not retry or obfuscate around the block. Use a Preview-only credential-free test-login path with exact-host and expiry checks instead.



## G-075 Omitting click_limit creates one-shot buttons
Risk: Tencent's current SDK DTO defaults click_limit to 1, documented as single-use.
Mitigation: explicitly set click_limit=10 on reusable command and pagination buttons and regression-test it.

## G-076 Plugin dispatch can bypass later core gates
Risk: V3 official plugins are dispatched before the legacy Worker command handler, so a whitelist/command gate implemented only in the core handler is incomplete.
Mitigation: enforce group whitelist and group command-disable state at plugin dispatch as well.

## G-077 OpenID is not a numeric QQ identity
Risk: granting permissions directly to a QQ Open OpenID breaks compatibility with old numeric-QQ authorization and can misidentify developers.
Mitigation: keep transport IDs as OpenIDs, use confirmed old-Bot mapping only for authorization aliases, and downgrade on identity conflict.

## G-078 Preview workflow intentionally rejects push triggers
Risk: adding a branch push trigger to the stable Preview workflow breaks `verify-v4-preview-workflow.mjs`.
Mitigation: keep Preview deployment manual-only; when connector dispatch is unavailable, use the Workers Preview deployment API with code modules from a verified branch version and the existing Preview-safe environment.


## G-079 Post-login transition can present as a double-login bug
status: superseded_by G-082
Previous risk: same-page boot was suspected and full reload was used as mitigation.
Why superseded: live testing showed a single login can enter the app in-page, while reload can lose the browser session. The accepted design now keeps login completion in-page and uses Preview-only resume recovery if a reload loses the cookie.

## G-080 Real QQ Bot tests have user-visible side effects
Risk: without a separate Bot/canary transport, testing command and keyboard behavior sends real messages or performs actions in existing groups.
Mitigation: keep live Bot testing paused; rely on code/CI/isolated Preview for non-Bot surfaces until an isolated Bot test route exists or a scoped live test is explicitly authorized.

## G-081 Browser Rendering injected state is not reliable across navigation
Risk: an injected browser probe can disappear when the page reloads, making post-navigation DOM instrumentation inconclusive.
Mitigation: do not treat missing injected markers after navigation as product failure. Use same-origin API/session probes plus user manual UI acceptance for login navigation.


## G-082 Preview reload can lose the ordinary HttpOnly session cookie
Risk: the user's real Preview browser can authenticate and enter the app once, but a later refresh/reload may return to the login screen because the ordinary session cookie is not available to the next page load.
Mitigation: do not force reload on successful login. On the isolated Preview, retain a separate short-lived opaque resume token and automatically exchange it for a replacement HttpOnly session cookie when boot sees no authenticated session. Rotate the resume token after use and revoke it on logout.

## G-083 Remember-login UI and privileged server policy must agree
Risk: presenting a checked "keep me signed in" option while the server forces developer/admin sessions to persistent=false makes the UI misleading and can create inconsistent cookie behavior.
Mitigation: honor the persistence request for privileged accounts but keep their existing 30-minute idle and 8-hour absolute security caps; align cookie Max-Age with the actual server absolute expiry.


## G-084 Preview-only resume is not sufficient for persistent login
Risk: a recovery mechanism limited to the V4 Preview can make acceptance login appear more robust while normal QQ/password/admin persistent sessions still fail after their cookie is unavailable.
Mitigation: use one generic remember-device protocol for all persistent Portal sessions; keep the old Preview resume only as a legacy acceptance fallback.

## G-085 Privileged TTL caps can contradict the keep-signed-in UI
Risk: forcing developer/admin/system-admin sessions to 30-minute idle / 8-hour absolute expiry even when the user selects a UI promising up to 180 days makes persistent login semantically false.
Mitigation: persistent=true uses the configured 30-day idle / 180-day absolute lifetime even for privileged sessions. persistent=false retains the short privileged limits.

## G-086 Remember tokens are authentication credentials
Risk: storing plaintext remember tokens server-side, allowing reuse, or failing to revoke them would create a durable bearer credential.
Mitigation: server records are keyed by SHA-256(token); token restore rotates and deletes the old token; logout revokes the supplied current token; Preview/TEMP credentials are externally expiry-capped.

## G-087 Motion effects must respect reduced-motion preference
Risk: aurora, view transitions, hover movement and page-entry animation can cause accessibility problems or unnecessary GPU work.
Mitigation: gate JS motion with prefers-reduced-motion and disable nonessential CSS animation/transition in the reduced-motion media query.

## G-088 A remember token that only references a session is not independent recovery
Risk: if a remember record contains only `sessionToken`, deleting or losing that server session makes both the ordinary session cookie and remember credential fail together.
Mitigation: persist a minimal sanitized session seed in the hash-keyed remember record. When the referenced persistent session is absent, rebuild a fresh session from the seed and cap it to the remember expiry before rotating the remember credential.

## G-089 Motion can exist in CSS but still be visually invisible
Risk: negative stacking contexts, body backgrounds or low light-theme opacity can make a technically running aurora effectively invisible to the user.
Mitigation: render a real `.qqai-aurora` DOM layer at foreground background z-order, use three large moving orbs plus a light ribbon, keep light-theme opacity visibly high, and verify computed animation name plus changing transform in a real Chromium render.

