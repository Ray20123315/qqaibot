CREATE TABLE IF NOT EXISTS kv_store_v4public_preview (
  key TEXT PRIMARY KEY COLLATE NOCASE,
  value TEXT NOT NULL
);

INSERT INTO kv_store_v4public_preview (key, value)
VALUES ('v4preview:bootstrap', '{"ok":true,"source":"feature/v4-public-bot"}')
ON CONFLICT(key) DO UPDATE SET value = excluded.value;
