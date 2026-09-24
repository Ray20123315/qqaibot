import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { cleanupExpiredModerationProposals, cleanupTransientState } from "./src/scheduler/runtime.js";

class SqliteD1 {
  constructor() {
    this.sqlite = new DatabaseSync(":memory:");
    this.sqlite.exec("CREATE TABLE kv_store (key TEXT PRIMARY KEY COLLATE NOCASE, value TEXT NOT NULL)");
    this.preparedSql = [];
  }
  prepare(sql) {
    this.preparedSql.push(sql);
    const database = this.sqlite;
    return {
      parameters: [],
      bind(...parameters) { this.parameters = parameters; return this; },
      async first() { return database.prepare(sql).get(...this.parameters) || null; },
      async all() { return { results: database.prepare(sql).all(...this.parameters) }; },
      async run() {
        const result = database.prepare(sql).run(...this.parameters);
        return { success: true, meta: { changes: Number(result.changes || 0) } };
      }
    };
  }
  set(key, value) {
    this.sqlite.prepare("INSERT INTO kv_store (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);
  }
  get(key) {
    return this.sqlite.prepare("SELECT value FROM kv_store WHERE key = ?").get(key)?.value ?? null;
  }
}

const now = 2_000_000_000_000;
const db = new SqliteD1();
const env = { DB: db };
db.set("portal_session:expired", JSON.stringify({ expiresAt: now - 1, absoluteExpiresAt: now + 1000 }));
db.set("portal_session:active", JSON.stringify({ expiresAt: now + 1000, absoluteExpiresAt: now + 2000 }));
db.set("portal_auth_code:000_expired", JSON.stringify({ expiresAt: now - 1 }));
db.set("portal_auth_2fa_pending:expired", JSON.stringify({ expiresAt: now - 1 }));
db.set("chat_turn:chat:group:123:0000000000001:1:uuid", JSON.stringify({ createdAt: now - 31 * 86400000, items: ["old"] }));
const recentLegacyTurn = `chat_turn:chat:group:123:${String(now - 5 * 86400000).padStart(13, "0")}:2:legacy`;
const expiredLegacyTurn = `chat_turn:chat:group:123:${String(now - 31 * 86400000).padStart(13, "0")}:3:legacy`;
db.set(recentLegacyTurn, JSON.stringify({ items: ["recent legacy"] }));
db.set(expiredLegacyTurn, JSON.stringify({ items: ["expired legacy"] }));
db.set("outbound_pending:old", JSON.stringify({ at: now - 180000 }));
db.set("outbound:old", JSON.stringify({ at: now - 3600000 }));
db.set("notice:not_whitelisted:old", String(now - 2 * 86400000));
for (let index = 0; index < 60; index += 1) db.set("portal_auth_code:batch-" + String(index).padStart(2, "0"), JSON.stringify({ expiresAt: now - 1 }));

db.set("conversation:index:123", JSON.stringify(["c_keep"]));
db.set("conversation:123:c_keep", JSON.stringify({ groupId: "123", messageId: "c_keep" }));
db.set("conversation:123:c_orphan", JSON.stringify({ groupId: "123", messageId: "c_orphan" }));
db.set("ai_decision_log:index", JSON.stringify(["ai_keep"]));
db.set("ai_decision_log:index:123", JSON.stringify(["ai_keep"]));
db.set("ai_decision_log:ai_keep", JSON.stringify({ groupId: "123" }));
db.set("ai_decision_log:ai_orphan", JSON.stringify({ groupId: "123" }));
db.set("platform:trace:index", JSON.stringify(["tr_keep"]));
db.set("platform:trace:index:123", JSON.stringify(["tr_keep"]));
db.set("platform:trace:tr_keep", JSON.stringify({ groupId: "123" }));
db.set("platform:trace:tr_orphan", JSON.stringify({ groupId: "123" }));
db.set("platform:job:index", JSON.stringify(["job_live"]));
db.set("platform:job:job_live", JSON.stringify({ status: "queued" }));
db.set("platform:job:job_orphan", JSON.stringify({ status: "completed" }));
db.set("platform:job:job_unindexed_live", JSON.stringify({ status: "queued" }));

await cleanupTransientState(env, now);
assert.equal(db.get("portal_session:expired"), null);
assert.notEqual(db.get("portal_session:active"), null);
assert.equal(db.get("portal_auth_code:000_expired"), null);
assert.equal(db.get("portal_auth_2fa_pending:expired"), null);
assert.equal(db.get("chat_turn:chat:group:123:0000000000001:1:uuid"), null);
assert.notEqual(db.get(recentLegacyTurn), null, "legacy chat turn rows use the creation time already encoded in their key");
assert.equal(db.get(expiredLegacyTurn), null);
assert.equal(db.get("outbound_pending:old"), null);
assert.equal(db.get("outbound:old"), null);
assert.equal(db.get("notice:not_whitelisted:old"), null);
assert.notEqual(db.get("conversation:123:c_keep"), null);
assert.equal(db.get("conversation:123:c_orphan"), null);
assert.notEqual(db.get("ai_decision_log:ai_keep"), null);
assert.equal(db.get("ai_decision_log:ai_orphan"), null);
assert.notEqual(db.get("platform:trace:tr_keep"), null);
assert.equal(db.get("platform:trace:tr_orphan"), null);
assert.notEqual(db.get("platform:job:job_live"), null);
assert.equal(db.get("platform:job:job_orphan"), null);
assert.notEqual(db.get("platform:job:job_unindexed_live"), null);

const afterOneBatch = Array.from({ length: 60 }, (_, index) => db.get("portal_auth_code:batch-" + String(index).padStart(2, "0"))).filter(Boolean).length;
assert.equal(afterOneBatch, 11, "each prefix sweep is bounded to 50 records");
await cleanupTransientState(env, now);
const afterTwoBatches = Array.from({ length: 60 }, (_, index) => db.get("portal_auth_code:batch-" + String(index).padStart(2, "0"))).filter(Boolean).length;
assert.equal(afterTwoBatches, 0, "resumed keyset sweeps converge on the next cron pass");

const moderationPrefix = "moderation:proposal:op_";
const moderationCursor = "cleanup:cursor:moderation_proposal_expiry";
for (let index = 0; index < 60; index += 1) {
  const expired = index < 55;
  db.set(moderationPrefix + String(index).padStart(2, "0"), JSON.stringify({
    id: String(index),
    status: "pending",
    expiresAt: expired ? now - 1 : now + 60_000
  }));
}

await cleanupExpiredModerationProposals(env, now);
const moderationSelect = [...db.preparedSql].reverse().find(sql => sql.startsWith("SELECT key, value FROM kv_store WHERE key >= ? AND key < ?"));
assert.ok(moderationSelect, "moderation expiry cleanup uses an indexed key range");
assert.match(moderationSelect, /ORDER BY key LIMIT \?/);
assert.doesNotMatch(moderationSelect, /LIKE|substr\s*\(/i, "moderation expiry cleanup must not scan kv_store by pattern");
const plan = db.sqlite.prepare(`EXPLAIN QUERY PLAN ${moderationSelect}`).all(moderationPrefix, moderationPrefix + "\uFFFF", moderationCursor, 50);
const planText = plan.map(row => row.detail).join("\n");
assert.match(planText, /SEARCH kv_store USING (?:COVERING )?(?:INDEX|PRIMARY KEY)/i, "moderation range query is served by the key index");
assert.doesNotMatch(planText, /SCAN kv_store/i, "moderation range query must avoid a full-table scan");
assert.equal(JSON.parse(db.get(moderationPrefix + "00")).status, "expired");
assert.equal(JSON.parse(db.get(moderationPrefix + "49")).status, "expired");
assert.equal(JSON.parse(db.get(moderationPrefix + "50")).status, "pending", "each moderation cleanup pass is capped at 50 rows");
assert.equal(db.get(moderationCursor), moderationPrefix + "49");

await cleanupExpiredModerationProposals(env, now);
assert.equal(JSON.parse(db.get(moderationPrefix + "54")).status, "expired");
assert.equal(JSON.parse(db.get(moderationPrefix + "55")).status, "pending");
assert.equal(db.get(moderationCursor), moderationPrefix + "59");

await cleanupExpiredModerationProposals(env, now);
assert.equal(db.get(moderationCursor), null, "the cleanup cursor resets after reaching the end of the prefix");
db.sqlite.close();

console.log("verify-data-retention: ok");
