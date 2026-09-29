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
