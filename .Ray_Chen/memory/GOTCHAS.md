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


## G-075 Root-only native discovery can hide all real commands
Risk: registering only `!面板 <分类>` entries makes QQ's native command list look complete by count while the actual canonical commands are absent from the native panel.
Mitigation: sync categorized real-command panels from the canonical registry and regression-test the union of published PanelItem names against every enabled group command.


## G-076 QQ native group panel limits make it unsuitable as the complete command surface
Risk: publishing every concrete command directly to QQ native group discovery can make the client show only a constrained subset, so valid commands appear missing.
Mitigation: keep the native group panel compact with category launchers, then render the complete retained command set through the bot-managed paginated inline keyboard.


## G-077 A valid keyboard object can still fail if wrapped in the wrong QQ message type
Risk: forcing `msg_type:2 + markdown + keyboard` can make the whole card fail on a bot/client path without Markdown capability even though the inline keyboard itself is valid; automatic fallback then hides the real failure by sending only text.
Mitigation: send panel keyboards as `msg_type:0 + content + keyboard`, regression-test the exact outbound body, log `QQ_OPEN_KEYBOARD_FALLBACK` on rejection, and keep emergency fallback copy separate from the successful card.


## G-079 Healthy Gateway does not imply fresh QQ discovery
Risk: a persistent websocket can survive a code deploy while the desired command-panel fingerprint changes. If discovery sync is bound only to READY/RESUMED, QQ keeps stale panels.
Mitigation: reconcile discovery from the minute `/ensure` watchdog; fingerprint unchanged desired state to avoid rewrites; persist sync diagnostics.

## G-080 QQ native panel clicks may prefix commands with /
Risk: a panel item named `!help` can reach the bot as `/!help`. Treating all `/!` text as AI opt-out prevents panel commands from reaching the command parser.
Mitigation: before opt-out handling, remove the slash only when the remainder resolves through the canonical Command Registry or is a `!面板` root. Unknown `/!text` must remain untouched.
