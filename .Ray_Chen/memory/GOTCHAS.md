# GOTCHAS
- ACK waits added linearly under sequential outbox send; simple 3-group test can take >=5 seconds due 1s alarm plus multiple QQ RTTs. Parallelize across groups only, never reorder within a group.
- Default relayOperations previously emits separate OneBot operations for text, image, face; nativeBatch combines OneBot segments for Bbot. Mixed video/file/record may still be rejected by NapCat or QQ, requiring live testing.
- D1 outbox claim UPDATE guarded by pending state prevents identical row double-send. Cron and DO should share one Bbot hub scheduler to prevent interleaved groups across two separate workers.
- Bbot DO WebSocket can have recent 'message' activity but no OPEN socket when /health executes. Do not infer current availability from last message; track last event/connected/closed separately.
- Existing Bbot identity bridge-bbot-napcat-v2 and auth token unchanged. Check NapCat reconnection/HTTP 401 if health remains disconnected.
- Abot remains fully disabled, old QQ command panel managed separately; no new official API traffic.
