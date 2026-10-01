# GOTCHAS

## Retained

G-001 through G-069 remain relevant.

## G-070 type=2 enter=true is not reliable enough for guaranteed group execution
Risk: the live QQ group client may still insert a type=2 command into the message input instead of immediately sending it.
Mitigation: commands that must execute immediately use reusable callbacks; type=2 is reserved for editable prefill behavior.

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

