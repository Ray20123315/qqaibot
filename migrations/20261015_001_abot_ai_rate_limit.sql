-- QQAIBOT Phase 1: additive D1 schema only; do NOT delete or rewrite existing user tables.
-- Run with Wrangler against a disposable copy before any production application.
-- The Worker currently also uses CREATE TABLE IF NOT EXISTS for upgrade compatibility.
CREATE TABLE IF NOT EXISTS abot_ai_rate_limit (
  group_openid TEXT NOT NULL,
  user_openid TEXT NOT NULL,
  bucket INTEGER NOT NULL,
  used INTEGER NOT NULL,
  PRIMARY KEY (group_openid, user_openid)
);
