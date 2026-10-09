# GOTCHAS
- QQ client may automatically unfurl raw HTTPS URLs even if OneBot sends plain text segments. Direct copy usability and never-preview are conflicting properties at client level. Plain link chosen to prioritize copyability as latest user request.
- Bilibili URLs validated with safeMediaUrl and exact/child domain matches bilibili.com or b23.tv; do not echo arbitrary raw signed QQ card JSON.
- User also requested hidden receiving destinations and prevention of corresponding recall. Existing bridge provides source group recall via mapped ACK IDs. Do not covertly disable that while hiding destinations, since origin participants cannot know where revoked content remains.
- Hot Durable Object WS may require reconnect on code deployment; BBOT_HUB_ID remains bridge-bbot-recall-v4, unchanged in this safe edit.
