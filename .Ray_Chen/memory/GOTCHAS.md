# GOTCHAS
- Bbot OneBot send_group_msg ACK may omit message_id; safe mirrored recall requires this ID and cannot act without it. QQ delete_msg may be forbidden/expired.
- Recall notice may race send ACK: record recalled source, cancel pending, queue late recall after confirmed send; don't blindly resend ambiguous ACK failure.
- D1 bridge_groups.receive_only additive DEFAULT 0, old groups continue bidirectional.
- QQ store emojis need mface emoji_id and emoji_package_id, not an image URL. Incomplete native fields fallback text, not image.
- Bilibili JSON/XML card raw payload may be signed/private. Only extract title/safe URL text; do not copy original card JSON.
- QQ at pings only true target member verified via fresh roster. If absent use source nickname or @群友 (not real notification).
- Older Durable Object instance can continue old code; fresh identity bridge-bbot-recall-v4 requires disconnect/reconnect NapCat WebSocket Client.
- Existing protected QQ ACL 3569028262/2681167798 and Bbot-only AI-disabled policy unchanged.
