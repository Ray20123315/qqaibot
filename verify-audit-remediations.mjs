import assert from "node:assert/strict";
import fs from "node:fs";
import { searchPortalVectors } from "./src/portal/auth.js";
import { listPlatformFeatures } from "./src/platform/runtime.js";

const vectorSource = fs.readFileSync("src/portal/auth.js", "utf8");
const workerSource = fs.readFileSync("worker.js", "utf8");
const portalSource = fs.readFileSync("src/portal/runtime.js", "utf8");
const platformSource = fs.readFileSync("src/platform/runtime.js", "utf8");
const workflow = fs.readFileSync(".github/workflows/validate.yml", "utf8");

const vectorRows = [
  { id: "msg_12345_101_1", score: 0.99, metadata: { kind: "chat_log", groupId: "12345", qq: "101", text: "current user" } },
  { id: "msg_12345_102_2", score: 0.98, metadata: { groupId: "12345", qq: "102", text: "legacy other user" } },
  { id: "msg_99999_101_3", score: 0.97, metadata: { kind: "chat_log", groupId: "99999", qq: "101", text: "other group" } },
  { id: "mem_12345_101_4", score: 0.96, metadata: { kind: "memory", groupId: "12345", qq: "101", text: "memory, not chat log" } },
  { id: "legacy_12345_101_5", score: 0.95, metadata: { groupId: "12345", qq: "101", text: "not a chat-log ID" } },
];

let queryCalls = [];
const matched = await searchPortalVectors({
  AI: { async run() { return { data: [[0.1, 0.2]] }; } },
  VECTORIZE: { async query(_vector, options) { queryCalls.push(options); return { matches: vectorRows }; } },
}, { groupId: "12345", userId: "101", permissions: {}, query: "hello", limit: 5 });
assert.deepEqual(matched.map(item => item.id), ["msg_12345_101_1"], "normal members only receive their own group chat log");
assert.deepEqual(queryCalls[0].filter, { groupId: "12345" }, "query must avoid kind filtering so legacy vectors can be checked locally");
assert.equal(queryCalls[0].returnMetadata, "all", "chat retrieval needs metadata.text");
assert.equal(queryCalls[0].topK, 15, "candidate search is bounded while leaving room for filtered matches");

queryCalls = [];
const adminMatches = await searchPortalVectors({
  AI: { async run() { return { data: [[0.1, 0.2]] }; } },
  VECTORIZE: { async query(_vector, options) { queryCalls.push(options); return { matches: vectorRows }; } },
}, { groupId: "12345", userId: "900", permissions: { aiAdmin: true }, query: "hello", limit: 5 });
assert.deepEqual(adminMatches.map(item => item.id), ["msg_12345_101_1", "msg_12345_102_2"], "admins may read current and legacy chat vectors for their group");

queryCalls = [];
const fallbackMatches = await searchPortalVectors({
  AI: { async run() { return { data: [[0.1, 0.2]] }; } },
  VECTORIZE: { async query(_vector, options) {
    queryCalls.push(options);
    if (options.filter) throw new Error("metadata filter is not indexed");
    return { matches: vectorRows };
  } },
}, { groupId: "12345", userId: "101", permissions: {}, query: "hello", limit: 5 });
assert.equal(queryCalls.length, 2, "unindexed metadata filters must fall back to a locally validated query");
assert.equal(queryCalls[1].filter, undefined);
assert.deepEqual(fallbackMatches.map(item => item.id), ["msg_12345_101_1"]);

const catalog = await listPlatformFeatures({}, { role: "developer", includeHidden: true });
assert.equal(catalog.length, 300);
assert.ok(catalog.every(item => !Object.hasOwn(item, "enabled")), "capability catalog must not claim runtime enablement");
assert.doesNotMatch(platformSource, /setPlatformFeature|platformFeatureEnabled|platformFeatureKey/);
assert.match(portalSource, /catalogOnly: true/);
assert.match(portalSource, /CAPABILITY_CATALOG_READ_ONLY/);
assert.match(portalSource, /能力目录（唯读）/);
assert.doesNotMatch(portalSource, /pfAuditSilent|机器人功能总开关/);

assert.match(workerSource, /kind: "chat_log"[\s\S]{0,80}schemaVersion: 2/);
assert.equal((workerSource.match(/returnMetadata: "all"/g) || []).length >= 4, true);
assert.doesNotMatch(workerSource, /returnValues: true/);

const actionPins = [...workflow.matchAll(/^\s*- uses: (actions\/(?:checkout|setup-node))@([a-f0-9]+)\s+#\s+(v\S+)$/gm)];
assert.equal(actionPins.length, 2, "both workflow actions must be pinned and documented");
assert.ok(actionPins.every(([, , sha]) => sha.length === 40), "GitHub Actions references must use full commit SHAs");
assert.ok(actionPins.every(([, , , tag]) => /^v\d+\.\d+\.\d+$/.test(tag)));

const readme = fs.readFileSync("README.md", "utf8");
for (const property of ["kind", "groupId", "subjectQq", "userId", "qq"]) {
  assert.match(readme, new RegExp(`create-metadata-index qqai --propertyName ${property} --type string`));
}
assert.match(readme, /不會自動被索引/);

console.log("verify-audit-remediations: ok");
