import assert from "node:assert/strict";
import { appendIndex, writeSystemAudit } from "./src/core/permissions.js";
import { processPlatformJobs } from "./src/platform/runtime.js";
import { opsSendDailyDigest, opsTaipeiDateKey } from "./src/operations/runtime.js";
import { processDueSchedules } from "./src/scheduler/runtime.js";
import { dbCleanupExpiredRows, dbCompareAndSwap, dbDel, dbDeletePrefix, dbGetStrict, dbPut, dbPutExpiring } from "./src/data/store.js";
import { createPortalSession, getPortalSession } from "./src/portal/auth.js";

class MemoryStatement {
  constructor(db, sql) { this.db = db; this.sql = sql; this.values = []; }
  bind(...values) { this.values = values; return this; }
  async first() {
    if (!this.sql.startsWith("SELECT value FROM kv_store WHERE key = ?")) throw new Error(`Unexpected SELECT: ${this.sql}`);
    const value = this.db.rows.get(String(this.values[0]));
    return value === undefined ? null : { value };
  }
  async all() {
    if (!this.sql.startsWith("SELECT key, value FROM kv_store WHERE key LIKE 'expiry:%'")) throw new Error("Unexpected SELECT all");
    const [before, limit] = this.values;
    const results = [...this.db.rows.entries()]
      .filter(([key]) => key.startsWith("expiry:") && key < String(before))
      .sort(([left], [right]) => left.localeCompare(right))
      .slice(0, Number(limit))
      .map(([key, value]) => ({ key, value }));
    return { results };
  }
  async run() {
    const values = this.values;
    if (this.db.failWrites) return { success: false, meta: { changes: 0 } };
    if (this.sql.startsWith("INSERT INTO kv_store (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING")) {
      const [key, value] = values.map(String);
      if (this.db.rows.has(key)) return { success: true, meta: { changes: 0 } };
      this.db.rows.set(key, value);
      return { success: true, meta: { changes: 1 } };
    }
    if (this.sql.startsWith("UPDATE kv_store SET value = ? WHERE key = ? AND value = ?")) {
      const [value, key, expected] = values.map(String);
      if (this.db.rows.get(key) !== expected) return { success: true, meta: { changes: 0 } };
      this.db.rows.set(key, value);
      return { success: true, meta: { changes: 1 } };
    }
    if (this.sql.startsWith("INSERT INTO kv_store (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE")) {
      const [key, value] = values.map(String);
      this.db.rows.set(key, value);
      return { success: true, meta: { changes: 1 } };
    }
    if (this.sql.startsWith("DELETE FROM kv_store WHERE key = ?")) {
      const changed = this.db.rows.delete(String(values[0]));
      return { success: true, meta: { changes: Number(changed) } };
    }
    if (this.sql.startsWith("DELETE FROM kv_store WHERE key IN (")) {
      let changes = 0;
      for (const key of values.map(String)) if (this.db.rows.delete(key)) changes += 1;
      return { success: true, meta: { changes } };
    }
    if (this.sql.startsWith("DELETE FROM kv_store WHERE substr(key, 1, ?) = ?")) {
      const prefix = String(values[1]);
      let changes = 0;
      for (const key of this.db.rows.keys()) if (key.startsWith(prefix)) { this.db.rows.delete(key); changes += 1; }
      return { success: true, meta: { changes } };
    }
    throw new Error(`Unexpected SQL: ${this.sql}`);
  }
}

function memoryDb() {
  const db = { rows: new Map(), failWrites: false };
  db.prepare = sql => new MemoryStatement(db, sql);
  db.batch = async statements => {
    const results = [];
    for (const statement of statements) results.push(await statement.run());
    return results;
  };
  return db;
}

const env = { DB: memoryDb() };
await assert.rejects(dbPut({}, "x", "1"), error => error.code === "D1_STORAGE_UNAVAILABLE" && error.retryable === true);
await assert.rejects(dbDel({}, "x"), error => error.code === "D1_STORAGE_UNAVAILABLE");
await assert.rejects(dbDeletePrefix({}, "x:"), error => error.code === "D1_STORAGE_UNAVAILABLE");

env.DB.failWrites = true;
await assert.rejects(dbPut(env, "must-not-look-saved", "1"), error => error.code === "D1_STORAGE_UNAVAILABLE");
env.DB.failWrites = false;

const expiryNow = 1_800_000_000_000;
const expiredIndex = await dbPutExpiring(env, "transient:expired", "old", expiryNow - 1);
const liveIndex = await dbPutExpiring(env, "transient:live", "current", expiryNow + 1000);
assert.equal(await dbCleanupExpiredRows(env, expiryNow, 25), 1, "cleanup removes only rows whose expiry has passed");
assert.equal(await dbGetStrict(env, "transient:expired"), null);
assert.equal(await dbGetStrict(env, expiredIndex), null);
assert.equal(await dbGetStrict(env, "transient:live"), "current", "cleanup retains rows with a future expiry");
assert.equal(await dbGetStrict(env, liveIndex), "transient:live");

for (let index = 0; index < 26; index += 1) {
  await dbPutExpiring(env, "transient:batch:" + index, "old", expiryNow - 1);
}
assert.equal(await dbCleanupExpiredRows(env, expiryNow, 100), 25, "cleanup hard-caps each maintenance batch at 25 rows");
assert.equal(await dbCleanupExpiredRows(env, expiryNow, 100), 1, "a later tick can finish the next bounded cleanup batch");

const sessionEnv = { DB: memoryDb() };
const portalSession = await createPortalSession(sessionEnv, { qq: "123456789", username: "admin", persistent: false });
const portalSessionKey = "portal_session:" + portalSession.token;
const sessionExpiryKeys = () => [...sessionEnv.DB.rows.entries()]
  .filter(([key, value]) => key.startsWith("expiry:") && value === portalSessionKey)
  .map(([key]) => key);
assert.equal(sessionExpiryKeys().length, 1, "new Portal sessions must be registered for expiry cleanup");
await new Promise(resolve => setTimeout(resolve, 5));
const touchedSession = await getPortalSession(sessionEnv, portalSession.token);
assert(touchedSession.expiresAt > portalSession.expiresAt, "session activity refreshes its expiry");
assert.equal(sessionExpiryKeys().length, 1, "refresh replaces the prior expiry index instead of accumulating rows");
const touchedExpiryKey = sessionExpiryKeys()[0];
const expiredSession = { ...touchedSession, expiresAt: expiryNow - 1 };
await dbPutExpiring(sessionEnv, portalSessionKey, JSON.stringify(expiredSession), expiredSession.expiresAt, touchedExpiryKey);
assert.equal(await dbCleanupExpiredRows(sessionEnv, expiryNow, 25), 1, "session cleanup is covered by bounded expiry cleanup");
assert.equal(await dbGetStrict(sessionEnv, portalSessionKey), null, "an inactive expired session row is removed");

assert.equal(await dbCompareAndSwap(env, "claim", null, "owner-a"), true);
assert.equal(await dbCompareAndSwap(env, "claim", null, "owner-b"), false, "only one concurrent creator may claim a missing key");
assert.equal(await dbGetStrict(env, "claim"), "owner-a");
assert.equal(await dbCompareAndSwap(env, "claim", "owner-a", "owner-b"), true);

await Promise.all([
  appendIndex(env, "concurrent:index", "a", 100),
  appendIndex(env, "concurrent:index", "b", 100)
]);
assert.deepEqual(JSON.parse(await dbGetStrict(env, "concurrent:index")).sort(), ["a", "b"]);

await Promise.all([
  writeSystemAudit(env, { type: "consistency_test", groupId: "12345", action: "first" }),
  writeSystemAudit(env, { type: "consistency_test", groupId: "12345", action: "second" })
]);
for (const key of ["audit:system:global", "audit:system:group:12345"]) {
  const rows = JSON.parse(await dbGetStrict(env, key));
  assert.equal(rows.length, 2, `${key} must not lose a concurrent audit append`);
  assert.deepEqual(rows.map(row => row.action).sort(), ["first", "second"]);
}

let sendCount = 0;
let privateSendCount = 0;
env.ONEBOT_HUB = {
  idFromName() { return "default"; },
  get() {
    return {
      async fetch(_url, init) {
        if (!init?.method) return Response.json({ connected: true });
        const payload = JSON.parse(init.body);
        if (payload.action === "send_group_msg") sendCount += 1;
        if (payload.action === "send_private_msg") privateSendCount += 1;
        await new Promise(resolve => setTimeout(resolve, 15));
        return Response.json({ ok: true, data: {} });
      }
    };
  }
};
const dueAt = Date.now() - 1000;
env.DB.rows.set("platform:job:index", JSON.stringify(["job_claim_race"]));
env.DB.rows.set("platform:job:job_claim_race", JSON.stringify({
  id: "job_claim_race", status: "queued", attempts: 0, maxAttempts: 3, nextRunAt: dueAt,
  type: "notification", groupId: "12345", message: "one side effect"
}));
await Promise.all([processPlatformJobs(env, Date.now()), processPlatformJobs(env, Date.now())]);
assert.equal(sendCount, 1, "two overlapping cron invocations must share one durable platform-job claim");
assert.equal(JSON.parse(env.DB.rows.get("platform:job:job_claim_race")).status, "completed");

env.DB.rows.set("platform:job:index", JSON.stringify(["job_stale_claim"]));
env.DB.rows.set("platform:job:job_stale_claim", JSON.stringify({
  id: "job_stale_claim", status: "running", attempts: 1, maxAttempts: 3, nextRunAt: dueAt,
  type: "notification", groupId: "12345", message: "must not be duplicated", claim: { owner: "old", expiresAt: dueAt }
}));
await processPlatformJobs(env, Date.now());
assert.equal(sendCount, 1, "an expired job claim must require review rather than auto-send a possible duplicate");
assert.equal(JSON.parse(env.DB.rows.get("platform:job:job_stale_claim")).status, "dead_letter");

const scheduleNow = Date.now();
const scheduleRecord = {
  id: "schedule_claim_race", enabled: true, status: "active", type: "once",
  nextRunAt: scheduleNow - 1000, groupId: "12345", creatorId: "777", content: "one scheduled side effect"
};
env.DB.rows.set("group_whitelist:12345", "true");
env.DB.rows.set("schedule:index", JSON.stringify([scheduleRecord.id]));
env.DB.rows.set(`schedule:${scheduleRecord.id}`, JSON.stringify(scheduleRecord));
const sendsBeforeSchedule = sendCount;
await Promise.all([processDueSchedules(env, scheduleNow), processDueSchedules(env, scheduleNow)]);
assert.equal(sendCount - sendsBeforeSchedule, 1, "overlapping schedule crons must claim a due schedule before sending");
assert.equal(JSON.parse(env.DB.rows.get(`schedule:${scheduleRecord.id}`)).status, "completed");

const staleSchedule = {
  ...scheduleRecord, id: "schedule_stale_claim", nextRunAt: scheduleNow - 1000,
  content: "must not be duplicated"
};
env.DB.rows.set("schedule:index", JSON.stringify([staleSchedule.id]));
env.DB.rows.set(`schedule:${staleSchedule.id}`, JSON.stringify(staleSchedule));
env.DB.rows.set(`schedule:run_claim:${staleSchedule.id}`, JSON.stringify({
  scheduledAt: staleSchedule.nextRunAt, status: "running", owner: "old", expiresAt: scheduleNow - 1
}));
await processDueSchedules(env, scheduleNow);
assert.equal(sendCount - sendsBeforeSchedule, 1, "an expired ambiguous schedule claim must not be sent again automatically");
assert.equal(JSON.parse(env.DB.rows.get(`schedule:${staleSchedule.id}`)).status, "paused");

env.DB.rows.set("ops:settings:12345", JSON.stringify({
  dailyDigestEnabled: true, dailyDigestTime: "00:00", dailyDigestRecipientIds: ["100"]
}));
const digestNow = Date.now();
const privateSendsBeforeDigest = privateSendCount;
await Promise.all([
  opsSendDailyDigest(env, "12345", digestNow),
  opsSendDailyDigest(env, "12345", digestNow)
]);
assert.equal(privateSendCount - privateSendsBeforeDigest, 1, "overlapping daily-digest runs must share a durable per-day claim");
const digestKey = `ops:digest:sent:12345:${opsTaipeiDateKey(digestNow)}`;
const digestClaim = JSON.parse(env.DB.rows.get(digestKey));
assert.equal(digestClaim.state, "sent");

const staleDigestNow = digestNow + 86_400_000;
const staleDigestKey = `ops:digest:sent:12345:${opsTaipeiDateKey(staleDigestNow)}`;
env.DB.rows.set(staleDigestKey, JSON.stringify({ state: "running", owner: "old", startedAt: staleDigestNow - 40 * 60 * 1000, expiresAt: staleDigestNow - 1 }));
await opsSendDailyDigest(env, "12345", staleDigestNow);
assert.equal(privateSendCount - privateSendsBeforeDigest, 1, "an expired ambiguous digest claim must require review instead of resending");
assert.equal(JSON.parse(env.DB.rows.get(staleDigestKey)).state, "manual_review");

const failedDigestEnv = { DB: memoryDb() };
failedDigestEnv.DB.rows.set("ops:settings:12345", JSON.stringify({
  dailyDigestEnabled: true, dailyDigestTime: "00:00", dailyDigestRecipientIds: ["100"]
}));
const failedDigest = await opsSendDailyDigest(failedDigestEnv, "12345", digestNow);
const failedDigestKey = "ops:digest:sent:12345:" + opsTaipeiDateKey(digestNow);
assert.equal(failedDigest.ok, false, "a digest with no successful transport must not be reported as delivered");
assert.equal(JSON.parse(failedDigestEnv.DB.rows.get(failedDigestKey)).state, "retry", "an undelivered digest remains eligible for retry");

console.log("verify-d1-write-consistency: ok");
