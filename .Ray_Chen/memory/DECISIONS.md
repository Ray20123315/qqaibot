# DECISIONS
2026-10-10 goal revision 11: Bilibili share card outputs plain text with real, directly copyable HTTPS link for exact domains bilibili.com/b23.tv, without re-sending JSON/XML card; QQ client may still unfurl a URL.
2026-10-10: Hidden receive-only QQ groups while silently preserving recalled source messages are NOT implemented; this would conceal recipients and prevent source recall. Prefer auditable recipient lists and explicit retention rules before changing those semantics.
2026-10-10: Keep current --no and recall source behavior and protected QQ ACL unchanged; no D1 migration.
