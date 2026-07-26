import assert from "node:assert/strict";
import { announceDeployedVersionFallback, getDeploymentStatusForViewer, processBuildEvent } from "./src/deployment/notifications.js";

class MockD1 {
  constructor() {
    this.map = new Map();
    this.failKeyOnce = "";
    this.failedKeys = new Set();
  }
  prepare(sql) {
    const db = this;
    return {
      args: [],
      bind(...args) { this.args = args; return this; },
      async first() {
        if (/SELECT value FROM kv_store WHERE key = \?/.test(sql)) {
          const value = db.map.get(String(this.args[0]));
          return value === undefined ? null : { value };
        }
        throw new Error(`Unsupported first SQL: ${sql}`);
      },
      async all() {
        if (/SELECT key FROM kv_store WHERE key LIKE 'group_whitelist:%'/.test(sql)) {
          return { results: [...db.map.entries()].filter(([key, value]) => key.startsWith("group_whitelist:") && value === "true").map(([key]) => ({ key })) };
        }
        throw new Error(`Unsupported all SQL: ${sql}`);
      },
      async run() {
        if (/INSERT INTO kv_store/.test(sql)) {
          const key = String(this.args[0]);
          if (db.failKeyOnce === key && !db.failedKeys.has(key)) {
            db.failedKeys.add(key);
            throw new Error(`Injected D1 failure for ${key}`);
          }
          db.map.set(key, String(this.args[1]));
          return { success: true };
        }
        throw new Error(`Unsupported run SQL: ${sql}`);
      }
    };
  }
}

function buildEvent(kind, uuid, createdAt, commitHash) {
  return {
    type: `cf.workersBuilds.worker.build.${kind}`,
    source: { type: "workersBuilds.worker", workerName: "qqai" },
    payload: {
      buildUuid: uuid,
      status: kind === "started" ? "running" : "success",
      buildOutcome: kind === "succeeded" ? "success" : null,
      createdAt: new Date(createdAt).toISOString(),
      stoppedAt: kind === "started" ? null : new Date(createdAt + 1000).toISOString(),
      buildTriggerMetadata: { branch: "main", commitHash, commitMessage: `commit ${commitHash}` }
    },
    metadata: { accountId: "acct", eventTimestamp: new Date(createdAt).toISOString() }
  };
}

const viewer = { qq: "123", role: "member", permissions: {} };
const env = { DB: new MockD1(), DEPLOY_NOTIFY_DEVELOPER_ID: "" };
const t0 = Date.now();
const first = await processBuildEvent(env, buildEvent("started", "build-a", t0, "aaa111"));
assert.equal(first.ok, true);
assert.equal(first.groupNotification?.reason, "portal_only", "Build start must be recorded for Portal without group broadcast");
const duplicate = await processBuildEvent(env, buildEvent("started", "build-a", t0, "aaa111"));
assert.equal(duplicate.reason, "duplicate");
await processBuildEvent(env, buildEvent("started", "build-b", t0 + 5000, "bbb222"));
const stale = await processBuildEvent(env, buildEvent("succeeded", "build-a", t0, "aaa111"));
assert.equal(stale.reason, "stale_terminal");
const duringNewerBuild = await getDeploymentStatusForViewer(env, viewer);
assert.equal(duringNewerBuild.status.kind, "started", "A stale terminal event must not replace the newer build status");
assert.equal(duringNewerBuild.status.noticeId, "build-b:started");
const latest = await processBuildEvent(env, buildEvent("succeeded", "build-b", t0 + 5000, "bbb222"));
assert.equal(latest.ok, true);
assert.equal(latest.groupNotification?.reason, "portal_only", "Successful deployment summary must stay in Portal");
const status = await getDeploymentStatusForViewer(env, viewer);
assert.equal(status.status.kind, "succeeded");
assert.equal(status.viewer.developer, false);
assert.equal("details" in status, false);

const retryDb = new MockD1();
retryDb.failKeyOnce = "deployment:history";
const retryEnv = { DB: retryDb, DEPLOY_NOTIFY_DEVELOPER_ID: "" };
const retryEvent = buildEvent("started", "build-retry", t0 + 10000, "retry333");
await assert.rejects(() => processBuildEvent(retryEnv, retryEvent), /Injected D1 failure/);
const retried = await processBuildEvent(retryEnv, retryEvent);
assert.equal(retried.ok, true, "A partially processed Queue event must be retryable");
const retryDuplicate = await processBuildEvent(retryEnv, retryEvent);
assert.equal(retryDuplicate.reason, "duplicate", "A successfully retried event must then be deduplicated");

const fallbackDb = new MockD1();
const fallbackEnv = { DB: fallbackDb, DEPLOY_NOTIFY_DEVELOPER_ID: "", DEPLOY_NOTIFY_SELF_GRACE_SECONDS: "30" };
const fallbackFirst = await announceDeployedVersionFallback(fallbackEnv, t0 + 20000);
assert.equal(fallbackFirst.reason, "grace_started");
const fallbackSuccess = await announceDeployedVersionFallback(fallbackEnv, t0 + 51000);
assert.equal(fallbackSuccess.ok, true, "Runtime fallback must record a live version in Portal when Queue events are absent");
assert.equal(fallbackSuccess.groupNotification?.reason, "portal_only", "Runtime fallback must not broadcast to groups");
const fallbackStatus = await getDeploymentStatusForViewer(fallbackEnv, viewer);
assert.equal(fallbackStatus.status.kind, "succeeded");
assert.equal(fallbackStatus.status.releaseVersion, "2.6.0");
const fallbackDuplicate = await announceDeployedVersionFallback(fallbackEnv, t0 + 90000);
assert.equal(fallbackDuplicate.reason, "already_announced");

console.log("deployment notification checks passed");
