import fs from "node:fs";

function assert(condition, message) { if (!condition) throw new Error(message); }

const worker = fs.readFileSync("worker.js", "utf8");
for (const removed of [
  "!绑定主人","!綁定主人","!同意主人绑定","!同意主人綁定",
  "!主人功能","!主人权限","!主人權限","!主人禁言","!主人解除禁言",
  "!主人改名","!主人撤回","!收为所属成员","!收為所屬成員"
]) assert(!worker.includes(removed), `Worker must not expose retired master command: ${removed}`);
assert(!worker.includes("createMasterMuteLock"), "Worker must not create new master-source mute locks");
assert(!worker.includes("masterCommand: true"), "Retired master commands must not retain a privileged unlock path");
assert(worker.includes("clearPartnerBinding(env, currentGroupId, leavingUserId)"), "Historical relationship rows must still be cleaned when a member leaves");

const bindings = fs.readFileSync("src/moderation/partner-bindings.js", "utf8");
assert(bindings.includes("clearPartnerBinding"), "Legacy cleanup helper must remain");
assert(!bindings.includes("createMasterBindingRequest"), "Master binding creation API must stay removed");
assert(!bindings.includes("createDirectMasterBinding"), "Portal/direct master creation API must stay removed");
assert(!bindings.includes("updateMasterBindingLevel"), "Master level mutation API must stay removed");

const portal = fs.readFileSync("src/portal/members.js", "utf8") + "\n" + fs.readFileSync("src/portal/community-suite.js", "utf8");
assert(!portal.includes("/members/relationships"), "Portal relationship routes must stay removed");
assert(!portal.includes("主人关系等级"), "Portal master relationship UI must stay removed");

const locks = fs.readFileSync("src/moderation/mute-locks.js", "utf8");
assert(locks.includes('source.source === "master"'), "Existing master-source mute locks must remain parseable for safe expiry/unlock");
assert(locks.includes('source.source === "partner"'), "Existing partner-source mute locks must remain parseable for safe expiry/unlock");

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
assert(pkg.scripts.check.includes("verify-master-bindings.mjs"), "Master retirement regression must run permanently");
console.log("verify-master-bindings retirement: ok");
