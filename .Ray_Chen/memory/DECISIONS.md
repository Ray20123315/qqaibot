# DECISIONS

2026-10-10 goal revision 8: user explicitly requests Abot temporarily disabled, all functions by Bbot due to inconsistent QQ Open Platform outgoing send permissions. This supersedes former "Abot first Bbot fallback" and dual-bot operation until user explicitly asks to re-enable.
2026-10-10: Keep QqOpenGateway class binding and migration for backward compatibility, but make the class inert, delete alarms, try to close old client sockets and send /shutdown to bridge-abot and bridge-abot-commands-v2 once per cron; no new /ensure.
2026-10-10: Do not delete historical credentials, Group OpenID mappings or database records. Bbot is the only outbound. Missing numeric QQ group is an explicit failure; never use QQ official API.
2026-10-10: Avoid deadlock by dispatching from OneBotHub alarm to its own live WebSocket directly, not via its own DO fetch. Cron requires connected Bbot before dequeue.
