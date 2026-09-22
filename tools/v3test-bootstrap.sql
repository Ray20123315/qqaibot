-- Minimal isolated schema used only by the qqai-v3test Worker smoke environment.
-- Production D1 is intentionally not referenced by this file.
CREATE TABLE IF NOT EXISTS kv_store (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_kv_store_key_nocase
ON kv_store(key COLLATE NOCASE);

PRAGMA optimize;
