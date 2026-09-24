import assert from "node:assert/strict";
import {
  PLUGIN_PACKAGE_LOCK_KEY,
  createPluginPackageRegistry,
  normalizePluginPackageDescriptor,
  sha256Hex,
  verifyPluginPackageIntegrity,
  versionSatisfies
} from "./src/plugins/package.js";

const artifactA1 = new TextEncoder().encode("plugin-a-v1");
const artifactA11 = new TextEncoder().encode("plugin-a-v1.1");
const artifactA2 = new TextEncoder().encode("plugin-a-v2");
const artifactB = new TextEncoder().encode("plugin-b-v1");

async function descriptor(id, version, artifact, extra = {}) {
  return {
    id,
    name: id,
    version,
    apiVersion: "1",
    capabilities: [],
    entry: "dist/index.js",
    integrity: "sha256:" + await sha256Hex(artifact),
    ...extra
  };
}

assert.equal(versionSatisfies("1.2.3", "^1.0.0"), true);
assert.equal(versionSatisfies("2.0.0", "^1.0.0"), false);
assert.equal(versionSatisfies("1.2.3", "~1.2.0"), true);
assert.equal(versionSatisfies("1.3.0", "~1.2.0"), false);
assert.equal(versionSatisfies("1.2.3", ">=1.2.0"), true);

const a1 = await descriptor("plugin.a", "1.0.0", artifactA1);
const normalized = normalizePluginPackageDescriptor(a1);
assert.equal(normalized.id, "plugin.a");
assert.equal((await verifyPluginPackageIntegrity(a1, artifactA1)).ok, true);
await assert.rejects(() => verifyPluginPackageIntegrity(a1, artifactA11), /PLUGIN_PACKAGE_INTEGRITY_MISMATCH/);

const db = new Map();
const reads = [];
let now = 1000;
let txCounter = 0;
const registry = createPluginPackageRegistry({
  async get(key) { reads.push(key); return db.has(key) ? db.get(key) : null; },
  async put(key, value) { db.set(key, value); },
  async del(key) { db.delete(key); }
}, {
  qqaiVersion: "3.0.0",
  trustedCandidateIds: ["plugin.a", "plugin.b"],
  nowProvider: () => now,
  transactionIdProvider: () => "tx-" + (++txCounter)
});

let staged = await registry.stageInstall(a1, { artifact: artifactA1, actorId: "42" });
assert.equal(staged.type, "install");
assert.equal((await registry.list()).length, 0, "staging must not mutate installed package set");
let committed = await registry.commit(staged.id, { actorId: "42" });
assert.equal(committed.package.descriptor.version, "1.0.0");
assert.equal(committed.package.integrityVerified, true);
assert.equal(db.has(PLUGIN_PACKAGE_LOCK_KEY), true);
assert(reads.every(key => key === PLUGIN_PACKAGE_LOCK_KEY), "package registry must use one exact lock key");

const b1 = await descriptor("plugin.b", "1.0.0", artifactB, { dependencies: { "plugin.a": "^1.0.0" } });
staged = await registry.stageInstall(b1, { artifact: artifactB, actorId: "42" });
await registry.commit(staged.id, { actorId: "42" });
assert.equal((await registry.list()).length, 2);

await assert.rejects(() => registry.stageUninstall("plugin.a", { actorId: "42" }), /PLUGIN_PACKAGE_DEPENDENTS_EXIST/);

const a2 = await descriptor("plugin.a", "2.0.0", artifactA2);
await assert.rejects(() => registry.stageInstall(a2, { artifact: artifactA2, actorId: "42" }), /PLUGIN_PACKAGE_REVERSE_DEPENDENCY_UNSATISFIED/);

const a11 = await descriptor("plugin.a", "1.1.0", artifactA11);
staged = await registry.stageInstall(a11, { artifact: artifactA11, actorId: "42" });
assert.equal(staged.type, "update");
committed = await registry.commit(staged.id, { actorId: "42" });
assert.equal(committed.package.descriptor.version, "1.1.0");
const updateTxId = committed.transaction.id;
const rolled = await registry.rollback(updateTxId, { actorId: "42" });
assert.equal(rolled.package.descriptor.version, "1.0.0");

const artifactC = new TextEncoder().encode("c");
const descriptorC = await descriptor("plugin.c", "1.0.0", artifactC);
await assert.rejects(
  () => registry.stageInstall(descriptorC, { artifact: artifactC, actorId: "42" }),
  /PLUGIN_PACKAGE_CANDIDATE_NOT_BUNDLED/
);

const futureArtifact = new TextEncoder().encode("future");
const future = await descriptor("plugin.a", "1.2.0", futureArtifact, { minQQAI: "99.0.0" });
await assert.rejects(() => registry.stageInstall(future, { artifact: futureArtifact, actorId: "42" }), /PLUGIN_PACKAGE_INCOMPATIBLE/);

staged = await registry.stageUninstall("plugin.b", { actorId: "42" });
await registry.commit(staged.id, { actorId: "42" });
staged = await registry.stageUninstall("plugin.a", { actorId: "42" });
committed = await registry.commit(staged.id, { actorId: "42" });
assert.equal(await registry.get("plugin.a"), null);
const uninstallTxId = committed.transaction.id;
const restored = await registry.rollback(uninstallTxId, { actorId: "42" });
assert.equal(restored.package.descriptor.version, "1.0.0");

now += 20 * 60 * 1000;
const expArtifact = new TextEncoder().encode("exp");
const exp = await descriptor("plugin.b", "1.1.0", expArtifact);
staged = await registry.stageInstall(exp, { artifact: expArtifact, actorId: "42" });
now += 20 * 60 * 1000;
await assert.rejects(() => registry.commit(staged.id, { actorId: "42" }), /PLUGIN_PACKAGE_STAGE_EXPIRED/);

console.log("verify-v3-plugin-package-registry: ok");
