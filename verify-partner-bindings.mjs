import fs from "node:fs";

function assert(condition, message) { if (!condition) throw new Error(message); }

const bindings = fs.readFileSync("src/moderation/partner-bindings.js", "utf8");
assert(bindings.includes("clearPartnerBinding"), "Legacy relationship cleanup must remain available");
assert(bindings.includes("partnerBindingKey"), "Legacy relationship keys must remain addressable for cleanup");
for (const removed of [
  "createPartnerBindingRequest",
  "createMasterBindingRequest",
  "decidePartnerBindingRequest",
  "createDirectMasterBinding",
  "updateMasterBindingLevel",
  "updateMasterBindingPermissions",
  "listGroupBindings",
  "getPartnerBinding",
  "MASTER_RELATIONSHIP_LEVELS",
  "PARTNER_REQUEST_TTL_MS"
]) assert(!bindings.includes(removed), `Retired relationship API must stay removed: ${removed}`);

const worker = fs.readFileSync("worker.js", "utf8");
assert(worker.includes("clearPartnerBinding(env, currentGroupId, leavingUserId)"), "Member-leave cleanup must delete historical relationship rows");
for (const removed of ["!绑定对象","!綁定對象","!同意绑定对象","!同意綁定對象","!对象禁言","!對象禁言","!解绑对象","!解綁對象"]) {
  assert(!worker.includes(removed), `Worker must not expose retired partner command: ${removed}`);
}

const locks = fs.readFileSync("src/moderation/mute-locks.js", "utf8");
assert(locks.includes('source.source === "partner"'), "Legacy partner mute locks must remain readable until retired");
assert(locks.includes('source.source === "master"'), "Legacy master mute locks must remain readable until retired");

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
assert(pkg.scripts.check.includes("verify-partner-bindings.mjs"), "Relationship retirement regression must stay in the permanent suite");
console.log("verify-partner-bindings retirement: ok");
