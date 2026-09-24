-- Safe fresh-D1 bootstrap. Existing production kv_store data is preserved.
CREATE TABLE IF NOT EXISTS kv_store (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE INDEX IF NOT EXISTS idx_kv_store_key_nocase
  ON kv_store(key COLLATE NOCASE);
