# DECISIONS
- 2026-10-11: Native Windows Forms GUI is the official Codex Bridge frontend; hidden Node backend remains a sibling EXE. Do not duplicate/rewrite.
- 2026-10-11: Native QQ slash suggestion /!设置插话率 may live in QQ publisher configuration, independent of Worker; deletion requires authoritative platform confirmation.
- 2026-10-15: Only exact leading /跨群 <文字> authorizes sending; all other QQ group events are non-relay. Existing D1 room_id defines the scope and preserves trust separation between rooms.
- 2026-10-15: Forward only to verified and not stopped targets; stopped and receive-only sender restrictions remain effective. Legacy bridge_enabled toggles never reactivate continuous forwarding.
- 2026-10-15: Mark manual outbox IDs with manual-v1: and dispatch only those; cancel historical pending automatic jobs to avoid delayed broadcast. Disable join announcements. Use existing NapCat/Bbot ACK and do not retry ambiguous sends.
