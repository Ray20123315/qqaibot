CREATE TABLE IF NOT EXISTS kv_store_v3test_20260924 (
  key TEXT PRIMARY KEY COLLATE NOCASE,
  value TEXT NOT NULL
);
INSERT INTO kv_store_v3test_20260924 (key, value)
VALUES ('v3test:bootstrap', '{"ok":true,"source":"v3-forward-staging-20260924"}')
ON CONFLICT(key) DO UPDATE SET value = excluded.value;
