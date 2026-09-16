import assert from "node:assert/strict";
import fs from "node:fs";

const migrationPath = "migrations/0000_kv_store_key_nocase.sql";
assert.ok(fs.existsSync(migrationPath), `${migrationPath} must exist`);

const sql = fs.readFileSync(migrationPath, "utf8");
assert.match(sql, /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_kv_store_key_nocase/i);
assert.match(sql, /ON\s+kv_store\s*\(\s*key\s+COLLATE\s+NOCASE\s*\)/i);
assert.match(sql, /PRAGMA\s+optimize\s*;/i);

const scheduler = fs.readFileSync("src/scheduler/runtime.js", "utf8");
for (const query of [
  "LIKE 'outbound_pending:%'",
  "LIKE 'outbound:%'",
  "LIKE 'notice:not_whitelisted:%'",
  "LIKE 'moderation:proposal:op_%'"
]) {
  assert.ok(scheduler.includes(query), `expected scheduler prefix query missing: ${query}`);
}

const wrangler = fs.readFileSync("wrangler.toml", "utf8");
assert.match(wrangler, /database_name\s*=\s*"qqaibot"/);
assert.match(wrangler, /crons\s*=\s*\["\* \* \* \* \*"\]/);

console.log("D1 prefix LIKE index regression passed.");
