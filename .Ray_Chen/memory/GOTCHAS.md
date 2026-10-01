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

## G-073 Callback success is not equivalent to normal QQ message delivery
Risk: a callback button can ACK and dispatch internal code yet still fail the product requirement because no normal user-message event reaches the ordinary Bot message pipeline.
Mitigation: direct/no-argument commands use action.type=2 + enter=true. Verify the resulting QQ client message and Bot reply end-to-end; do not treat callback handler execution as equivalent evidence.

## G-074 enter=true still needs live-client verification
Risk: historical QQ group clients may insert a type=2 command into the input field instead of sending it even when enter=true.
Mitigation: keep this as a live smoke-test gate. If reproduced, investigate platform/client behavior without reverting to callback-only execution, because callback-only execution violates the normal-message requirement.
