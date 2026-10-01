# GOTCHAS

## Retained

G-001 through G-069 remain relevant.

## G-070 type=2 enter=true client behavior concern
status: superseded
superseded_by: G-073
Historical risk: an earlier live observation suggested type=2 + enter=true could be left in the input box.
Reason superseded: the callback workaround violated the current requirement that the command itself be sent as a normal QQ message. The production panel now follows QQ command-button semantics and requires live client smoke rather than silently substituting callback execution.

## G-071 Single-category keyboard tests can hide missing category UX
Risk: validating only 基础 or one paginated category can leave other root categories returning fallback text or malformed payloads.
Mitigation: enumerate every non-empty group category, every page and every enabled group command in regression tests; also serialize one transport payload per category.

## G-072 Display labels are not canonical identifiers
Risk: UI labels can normalize case, e.g. QQ语音 -> qq语音, causing false coverage failures.
Mitigation: match keyboard coverage using canonical action.data rather than render_data.label.


## G-073 Server-side callback execution is not equivalent to sending a QQ message
Risk: a type=1 interaction callback can execute a handler and make the bot reply while never creating the command as a normal QQ message in the conversation. This violates the requested panel UX and makes the message history misleading.
Mitigation: use type=2 command buttons with enter=true for direct panel commands; reserve callbacks for interaction-only features.


## G-074 Registry-only coverage can still be functionally incomplete
Risk: tests that prove every registry command has a button do not prove every active runtime or plugin command is registered.
Mitigation: when handlers/plugins add or rename standalone commands, reconcile them against src/v4/commands/catalog.js and keep explicit restored-family assertions in the panel regression.
