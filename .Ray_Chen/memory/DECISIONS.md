# DECISIONS

2026-10-10 goal revision 10: Cross-group recall supported only for copies that Bbot itself sent with confirmed message ID, mapped to source QQ group ID and source message ID. Unmapped sends not revoked by guess. User or administrator recalls authenticated through NapCat group_recall event. Pending canceled and late ACK mapping queues recall automatically.
2026-10-10: --no is join-time receive-only mode, with local success reply and zero remote join notices; old groups default bidirectional. Regular joining announces to other linked active groups.
2026-10-10: Native QQ face preserved face, market mface preserved mface if emoji_id and emoji_package_id provided; no fake image conversion.
2026-10-10: Bilibili JSON/XML share card is descriptive text, with URLs rendered as non-preview text rather than forwarding card JSON.
2026-10-10: Only true destination group member gets OneBot at. Others are represented by source nickname or @群友, rather than a misleading QQ ID pseudo-mention.
2026-10-10: Use shared hub ID bridge-bbot-recall-v4 to avoid hot existing WS DO code continuing older logic. NapCat must reconnect once after deploy.
