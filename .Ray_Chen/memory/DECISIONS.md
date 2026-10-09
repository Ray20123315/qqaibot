# DECISIONS
2026-10-10 r10: Implement group message recall only for Bbot-created relay copies with confirmed ACK message ID, and only when original group's group_recall notice arrives. Covers author and admin recalls. Pending sends canceled, late ACK triggers queued deletion.
2026-10-10 r10: `!CODE --no` is join-time receive-only, suppresses that group's outward chat forwarding and remote join notices. `!setting` lists caller's proven permissions and every linked group; normal join produces notices.
2026-10-10 r10: OneBot native face and mface sent as original types. Absentee @ fallback source nickname instead of QQ number. Bilibili and JSON/XML share cards rendered into text without raw JSON card.
2026-10-10 r10: New Hub generation bridge-bbot-recall-v4 because hot websocket Durable Object may preserve stale code across deploy; human reconnect required. Abot remains disabled.
