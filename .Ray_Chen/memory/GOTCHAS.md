# GOTCHAS

- NapCat OneBot group_recall event includes original numeric group_id and message_id; delete_msg only applies to relay message IDs sent and ACKed by Bbot. QQ recall restrictions and message_id availability vary by adapter; never fabricate.
- Recalls may happen while outbox is pending or waiting ACK; pending original payload canceled; late ack mapping must re-check recalled_sources and requeue delete.
- D1 additive column receive_only defaults 0 for previously joined groups, preserves existing data.
- QQ OneBot mface requires emoji_id and emoji_package_id, optional key and summary, do not convert to image.
- QQ Bilibili JSON/XML card may contain signed tokens, never publish entire raw card; plain title/link with preview-prevention.
- Protected QQ account logic unchanged. --no suppresses outbound but not local control reply or incoming other-group messages.
- Hot Cloudflare Durable Object WebSocket may survive Worker deployment; new recall-v4 shared hub identity and user reconnect required.
