-- D1 hot-read fix for the scheduler's high-frequency prefix LIKE queries.
-- SQLite's default LIKE is ASCII case-insensitive, so the existing BINARY key
-- index cannot service these prefix searches. A NOCASE index lets SQLite turn
-- `LIKE 'prefix%'` into bounded key range searches instead of full-table scans.
CREATE INDEX IF NOT EXISTS idx_kv_store_key_nocase
ON kv_store(key COLLATE NOCASE);

PRAGMA optimize;
