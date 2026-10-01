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


## G-079 Same-page post-login bootstrap can present as a double-login bug
Risk: immediately calling boot() after the authentication fetch can leave the UI on the login screen even though the first login already created a valid server session.
Mitigation: after successful authentication use one full page reload, then let normal page startup load /api/portal/me.

## G-080 Real QQ Bot tests have user-visible side effects
Risk: without a separate Bot/canary transport, testing command and keyboard behavior sends real messages or performs actions in existing groups.
Mitigation: keep live Bot testing paused; rely on code/CI/isolated Preview for non-Bot surfaces until an isolated Bot test route exists or a scoped live test is explicitly authorized.

## G-081 Browser Rendering injected state is not reliable across navigation
Risk: an injected browser probe can disappear when the page reloads, making post-navigation DOM instrumentation inconclusive.
Mitigation: do not treat missing injected markers after navigation as product failure. Use same-origin API/session probes plus user manual UI acceptance for login navigation.
