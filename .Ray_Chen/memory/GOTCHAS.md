# GOTCHAS

## Retained

G-001 through G-065 remain relevant.

## G-066 Rendered buttons do not prove callback subscription
Risk: QQ can render an inline keyboard while the Gateway is subscribed only to message events. Every click then times out because INTERACTION_CREATE never reaches the bot.
Mitigation: production/test/default intents must include INTERACTION (1<<26) and the production binding must be read back after deployment.

## G-067 Gateway RESUME can preserve stale intents
Risk: changing QQ_OPEN_INTENTS in configuration does not help if the Gateway resumes a session created with the old mask.
Mitigation: persist sessionIntents and only resume when it equals configuredIntents; otherwise identify a fresh session.


## G-068 click_limit=1 makes command keyboards one-shot
Risk: applying approval-style click_limit=1 to ordinary command buttons causes the button to become unusable after one click.
Mitigation: ordinary type=2 command buttons omit click_limit; only unrelated features that explicitly need a limit may carry it.

## G-069 Callback buttons are the wrong primitive for editable commands
Risk: action.type=1 requires INTERACTION_CREATE/ACK and cannot provide the desired "put command in the input box so the user can add parameters" UX.
Mitigation: use action.type=2 with enter=false for editable commands and enter=true only for explicitly safe no-argument commands.
