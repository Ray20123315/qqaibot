# GOTCHAS

## Retained

G-001 through G-065 remain relevant.

## G-066 Rendered buttons do not prove callback subscription
Risk: QQ can render an inline keyboard while the Gateway is subscribed only to message events. Every click then times out because INTERACTION_CREATE never reaches the bot.
Mitigation: production/test/default intents must include INTERACTION (1<<26) and the production binding must be read back after deployment.

## G-067 Gateway RESUME can preserve stale intents
Risk: changing QQ_OPEN_INTENTS in configuration does not help if the Gateway resumes a session created with the old mask.
Mitigation: persist sessionIntents and only resume when it equals configuredIntents; otherwise identify a fresh session.
