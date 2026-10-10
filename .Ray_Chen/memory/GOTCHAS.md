# GOTCHAS
- QQ bot official group replies have ~5-minute passive window, require incoming msg_id. Past proactive API rejection 40034105 may persist; log safe status/code only and never silently substitute Bbot.
- GROUP_MESSAGE_CREATE without actual mention may include every group message; ignore. GROUP_AT_MESSAGE_CREATE only when QQ subscribed.
- Group and member OpenIDs cannot be assumed numerical QQ IDs. D1 official identity separate.
- New DO gateway starts from Cron, 1-minute initial wait after deploying expected; READY logged 2026-10-10T15:06:08.297Z on correct version confirms connection.
- QQ_AI_ABOT_ENABLED and QQ_OPEN_INTENTS are platform permission dependent; official gateway READY does not prove bot can reply in particular group.
- Bbot AI disabled to avoid duplicate responses. Existing Bbot optional bridge plugin settings remain.
