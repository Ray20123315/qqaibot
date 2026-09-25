import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { opsActivityParticipants, opsGetSettings, opsJoinActivity, opsPatchActivityParticipant, opsPollVotesKey, opsSaveSettings, opsVotePoll } from "./src/operations/runtime.js";
import { enqueuePlatformJob, processPlatformJobs } from "./src/platform/runtime.js";
import { dbClaimLeaseStrict, dbDeleteKeyIfJsonFieldEquals } from "./src/data/store.js";

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
  get(key) { return this.sqlite.prepare("SELECT value FROM kv_store WHERE key = ?").get(key)?.value ?? null; }
  close() { this.sqlite.close(); }
}

const DB = new SqliteD1();
const env = { DB };
const leaseClaims = await Promise.all(Array.from({ length: 20 }, (_, index) => dbClaimLeaseStrict(env, "lease:concurrency-test", `owner-${index}`, 1000, 10000)));
assert.equal(leaseClaims.filter(Boolean).length, 1, "a durable work lease must have only one concurrent owner");
const leaseValue = JSON.parse(DB.get("lease:concurrency-test"));
assert.equal(await dbDeleteKeyIfJsonFieldEquals(env, "lease:concurrency-test", "$.owner", "other-owner"), false);
assert.equal(await dbDeleteKeyIfJsonFieldEquals(env, "lease:concurrency-test", "$.owner", leaseValue.owner), true);
const activity = {
  id: "activity_concurrent_test",
  groupId: "77777",
  groupIds: ["77777"],
  status: "active",
  capacity: 3,
  waitlistEnabled: true,
  autoInviteConfirmed: false
};
const outcomes = await Promise.all(Array.from({ length: 24 }, (_, index) => opsJoinActivity(env, activity, {
  userId: String(10000 + index),
  userName: `member-${index}`,
  sourceGroupId: "77777"
})));
assert.ok(outcomes.every(result => result.ok), "all simultaneous signups should be accepted as confirmed or waitlisted");
const participants = await opsActivityParticipants(env, activity.id);
assert.equal(participants.length, 24, "CAS updates must preserve every concurrent signup");
assert.equal(new Set(participants.map(item => item.userId)).size, 24);
assert.equal(participants.filter(item => item.status === "confirmed").length, 3, "capacity must remain enforced during concurrent signups");
assert.equal(participants.filter(item => item.status === "waitlist").length, 21);
const invitePatch = { ...participants[0], inviteStatus: "sent", inviteUpdatedAt: Date.now(), invitedBy: "90000" };
await Promise.all([
  opsPatchActivityParticipant(env, activity.id, invitePatch),
  opsJoinActivity(env, activity, { userId: "20000", userName: "join-during-invite", sourceGroupId: "77777" })
]);
const participantsAfterInvite = await opsActivityParticipants(env, activity.id);
assert.equal(participantsAfterInvite.length, 25, "invitation status updates must not overwrite concurrent signups");
assert.equal(participantsAfterInvite.find(item => item.userId === invitePatch.userId)?.inviteStatus, "sent");

const poll = { id: "poll_concurrent_test", status: "active", options: ["A", "B"], multiple: false, allowChange: true };
const votes = await Promise.all(Array.from({ length: 30 }, (_, index) => opsVotePoll(env, poll, { userId: `voter-${index}`, optionIndexes: index % 2 })));
assert.ok(votes.every(result => result.ok));
assert.equal(Object.keys(JSON.parse(DB.get(opsPollVotesKey(poll.id)))).length, 30, "CAS poll writes must retain simultaneous voters");

await Promise.all([
  opsSaveSettings(env, "77777", { dailyDigestEnabled: true }),
  opsSaveSettings(env, "77777", { maintenanceMode: true })
]);
const savedSettings = await opsGetSettings(env, "77777");
assert.equal(savedSettings.dailyDigestEnabled, true, "concurrent settings writes must not erase other fields");
assert.equal(savedSettings.maintenanceMode, true, "concurrent settings writes must preserve each patch");
const audit = JSON.parse(DB.sqlite.prepare("SELECT value FROM kv_store WHERE key = ?").get("audit:system:global").value);
assert.equal(audit.filter(item => item.type === "ops_activity_signup").length, 25, "atomic audit appends must retain every concurrent event");
const job = await enqueuePlatformJob(env, { type: "audit_only", groupId: "77777", actorId: "90000", action: "concurrency-test" });
await Promise.all([processPlatformJobs(env, Date.now()), processPlatformJobs(env, Date.now())]);
const savedJob = JSON.parse(DB.get(`platform:job:${job.id}`));
assert.equal(savedJob.status, "completed");
assert.equal(savedJob.attempts, 1, "concurrent platform runners must atomically claim a queued job once");
DB.close();
console.log("verify-operations-concurrency: ok");
