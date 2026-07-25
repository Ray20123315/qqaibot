import assert from "node:assert/strict";
import { getDeploymentStatusForViewer, processBuildEvent } from "./src/deployment/notifications.js";

class MockD1 {
  constructor() { this.map = new Map(); }
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
          db.map.set(String(this.args[0]), String(this.args[1]));
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

const env = { DB: new MockD1(), DEPLOY_NOTIFY_DEVELOPER_ID: "" };
const t0 = Date.now();
const first = await processBuildEvent(env, buildEvent("started", "build-a", t0, "aaa111"));
assert.equal(first.ok, true);
const duplicate = await processBuildEvent(env, buildEvent("started", "build-a", t0, "aaa111"));
assert.equal(duplicate.reason, "duplicate");
await processBuildEvent(env, buildEvent("started", "build-b", t0 + 5000, "bbb222"));
const stale = await processBuildEvent(env, buildEvent("succeeded", "build-a", t0, "aaa111"));
assert.equal(stale.reason, "stale_terminal");
const latest = await processBuildEvent(env, buildEvent("succeeded", "build-b", t0 + 5000, "bbb222"));
assert.equal(latest.ok, true);
const status = await getDeploymentStatusForViewer(env, { qq: "123", role: "member", permissions: {} });
assert.equal(status.status.kind, "succeeded");
assert.equal(status.viewer.developer, false);
assert.equal("details" in status, false);
console.log("deployment notification checks passed");
