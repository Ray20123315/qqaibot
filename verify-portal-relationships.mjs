import fs from "node:fs";

function assert(condition, message) { if (!condition) throw new Error(message); }

const bindings = fs.readFileSync("src/moderation/partner-bindings.js", "utf8");
assert(bindings.includes("clearPartnerBinding"), "Legacy relationship cleanup must remain");
assert(!bindings.includes("createDirectMasterBinding"), "Portal must not have a direct relationship creation backend");
assert(!bindings.includes("listGroupBindings"), "Portal must not have a relationship listing backend");
assert(!bindings.includes("updateMasterBindingLevel"), "Portal must not have a relationship-level backend");

const members = fs.readFileSync("src/portal/members.js", "utf8");
for (const removed of ["listGroupBindings","publicRelationship","cachedRelationships","relationshipEligibility","关系身份","member-relationship"]) {
  assert(!members.includes(removed), `Member Portal must not expose relationship state: ${removed}`);
}

const suite = fs.readFileSync("src/portal/community-suite.js", "utf8");
for (const removed of ["/members/relationships","suite-master-policy","suitePolicy","suiteMasterLevels","主人关系等级"]) {
  assert(!suite.includes(removed), `Community suite must not expose relationship controls: ${removed}`);
}

const cleanup = fs.readFileSync("src/portal/member-cleanup.js", "utf8");
for (const removed of ["listGroupBindings","protectRelationships","cleanupProtectRelationships","hasRelationship","关系成员默认保留"]) {
  assert(!cleanup.includes(removed), `Cleanup workflow must not depend on retired relationships: ${removed}`);
}

const details = fs.readFileSync("src/members/details.js", "utf8");
assert(!details.includes("getPartnerBinding"), "Member details must not load relationship state");
assert(!details.includes("关系记录"), "Member details report must not expose relationship state");

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
assert(pkg.scripts.check.includes("verify-portal-relationships.mjs"), "Portal relationship retirement verification must run permanently");
console.log("verify-portal-relationships retirement: ok");
