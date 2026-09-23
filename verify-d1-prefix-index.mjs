import assert from "node:assert/strict";
import fs from "node:fs";
import {
  cleanupExpiredModerationProposals,
  cleanupTransientState,
  processDueSchedules,
  runAutomaticGroupCheckins
} from "./src/scheduler/runtime.js";

const migrationPath = "migrations/0000_kv_store_key_nocase.sql";
assert.ok(fs.existsSync(migrationPath), `${migrationPath} must exist`);

const sql = fs.readFileSync(migrationPath, "utf8");
assert.match(sql, /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_kv_store_key_nocase/i);
assert.match(sql, /ON\s+kv_store\s*\(\s*key\s+COLLATE\s+NOCASE\s*\)/i);

const active = fs.readFileSync("src/scheduler/runtime.js", "utf8");
const legacy = fs.readFileSync("src/scheduler/runtime-legacy.js", "utf8");

for (const query of [
  "LIKE 'outbound_pending:%'",
  "LIKE 'outbound:%'",
  "LIKE 'notice:not_whitelisted:%'",
  "LIKE 'moderation:proposal:op_%'"
]) {
  assert.ok(!active.includes(query), `active scheduler must not contain high-frequency prefix scan: ${query}`);
  assert.ok(legacy.includes(query), `legacy rollback copy should preserve original implementation: ${query}`);
}

assert.match(active, /dbCleanupExpiredRows\(env,\s*now,\s*25\)/);
assert.match(active, /onebot_disconnected/);
assert.match(active, /MODERATION_FALLBACK_INTERVAL_MS\s*=\s*24\s*\*\s*60\s*\*\s*60\s*\*\s*1000/);
assert.ok(!/return\s+legacy\.cleanupTransientState\s*\(/.test(active), "transient cleanup must never call the legacy prefix scan");
assert.match(active, /return\s+legacy\.cleanupExpiredModerationProposals\s*\(env\)/);

const transient = await cleanupTransientState({});
assert.equal(transient?.bounded, true);
assert.equal(transient?.deleted, 0);

for (const [name, fn] of [
  ["processDueSchedules", processDueSchedules],
  ["runAutomaticGroupCheckins", runAutomaticGroupCheckins],
  ["cleanupExpiredModerationProposals", cleanupExpiredModerationProposals]
]) {
  const result = await fn({});
  assert.equal(result?.skipped, "onebot_disconnected", `${name} must skip before D1 scanning when OneBot is offline`);
}

const permissions = fs.readFileSync("src/core/permissions.js", "utf8");
assert.match(permissions, /Date\.now\(\)\s*-\s*Number\(item\.at\s*\|\|\s*0\)\s*>\s*2\s*\*\s*60\s*\*\s*1000/);

const moderation = fs.readFileSync("src/moderation/runtime.js", "utf8");
assert.match(moderation, /onebot-hub\/moderation\/expiry/);

const wrangler = fs.readFileSync("wrangler.toml", "utf8");
assert.match(wrangler, /database_name\s*=\s*"qqaibot"/);
assert.match(wrangler, /crons\s*=\s*\["\* \* \* \* \*"\]/);

console.log("D1 hot-read guard regression passed.");
