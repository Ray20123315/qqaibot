# CURRENT_STATE

## Verified Product State

Canonical product commit before memory initialization:
`0d86baf190a02de5be3e9622ddceea248eb67e8a`

GitHub Actions:
- workflow: Validate single-Worker build
- run_id: 36268773902
- conclusion: success
- regression checks: success
- V3 regression checks: success
- Worker dry-run bundle: success

## Behavior

### Member details

QQ output contains curated member information, management/relationship status summaries, and source availability summaries. It no longer prints full `liveSources`, `storedSources`, or `operationalState` JSON blocks.

### Recall

For the administrator `!撤回` path:
- permission / missing quote / execution failure still returns an error message;
- successful `delete_msg` returns HTTP 204 and sends no additional success notification.

### Smart command routing

Natural-language command classification can select only entries in `AI_COMMAND_TOOL_COMMANDS`. The classifier does not execute OneBot actions. It emits a normalized existing command, then the normal Worker command path recalculates effective permissions and runs the existing handler.

Safety context supplied to the router includes actor role, developer status, quote presence, and actual mentioned target QQs. URL and member-target builders reject values not grounded in the user's source message/context.

## Notification

A single Gmail project-update notification for this user request was verified in Sent. Do not send a duplicate for the same task.
