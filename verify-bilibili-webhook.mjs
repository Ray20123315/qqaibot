import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { handleBilibiliWebhook, normalizeBilibiliEvent } from "./src/integrations/bilibili.js";

class SqliteD1 {
  constructor() {
    this.sqlite = new DatabaseSync(":memory:");
    this.sqlite.exec("CREATE TABLE kv_store (key TEXT PRIMARY KEY COLLATE NOCASE, value TEXT NOT NULL)");
  }
  prepare(sql) {
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

const db = new SqliteD1();
const env = { DB: db };
db.set("bili:webhook_secret:secret", "connector-1");
db.set("bili:connector:connector-1", JSON.stringify({
  id: "connector-1", groupId: "12345", creatorId: "998877", creatorName: "test creator",
  enabled: true, mode: "generic_webhook", liveNotify: false, videoNotify: false
}));

const url = new URL("https://qqai.test/api/integrations/bilibili/webhook/secret");
const request = (eventId, extra = {}) => new Request(url, {
  method: "POST",
  headers: { "Content-Type": "application/json", ...extra },
  body: JSON.stringify({ event_type: "LIVE_START", event_id: eventId, creator_id: "998877", room_id: "7654", title: "test" })
});

assert.equal((await handleBilibiliWebhook(new Request(url, { method: "POST", body: "{}" }), env, url)).status, 415);
assert.equal((await handleBilibiliWebhook(new Request(url, { method: "POST", headers: { "Content-Type": "application/json", "Content-Length": "70000" }, body: "{}" }), env, url)).status, 413);
assert.equal(normalizeBilibiliEvent({ event_type: "LIVE_START", event_id: "x".repeat(500) }).eventId.length, 256);

const simultaneous = await Promise.all([
  handleBilibiliWebhook(request("event-1"), env, url),
  handleBilibiliWebhook(request("event-1"), env, url)
]);
const results = await Promise.all(simultaneous.map(response => response.json()));
assert.equal(results.filter(result => result.duplicate).length, 1);
assert.equal(results.filter(result => result.sent === false).length, 1);
const dedup = JSON.parse(db.get("bili:dedup:connector-1:event-1"));
assert.equal(dedup.status, "completed");
assert.ok(dedup.expiresAt > Date.now());

const expiredKey = "bili:dedup:connector-1:retry";
db.set(expiredKey, JSON.stringify({ expiresAt: Date.now() - 1, owner: "old" }));
const retry = await handleBilibiliWebhook(request("retry"), env, url);
assert.equal(retry.status, 200, "expired idempotency rows may be claimed again");

db.sqlite.close();
console.log("verify-bilibili-webhook: ok");
