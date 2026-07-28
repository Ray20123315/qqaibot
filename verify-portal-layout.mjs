import fs from "node:fs";
import assert from "node:assert/strict";
import { injectPortalLayoutClient } from "./src/portal/layout.js";

const sample = "<!doctype html><html><head><style id=\"feature\">.x{display:block}</style></head><body><main></main></body></html>";
const injected = injectPortalLayoutClient(sample);
assert.match(injected, /id="qqai-portal-layout-v274"/);
assert.match(injected, /id="qqai-portal-layout-client-v274"/);
assert.ok(injected.indexOf("qqai-portal-layout-v274") > injected.indexOf('id="feature"'), "canonical layout must be the last style layer");
assert.match(injected, /@media\(max-width:1024px\)/);
assert.match(injected, /@media\(max-width:700px\)/);
assert.match(injected, /@media\(max-width:430px\)/);
assert.match(injected, /max-height:min\(88dvh,900px\)/);
assert.match(injected, /\.ww-layout\{grid-template-columns/);
assert.match(injected, /\.member-action-row\{grid-template-columns/);
assert.match(injected, /\.cleanup-summary\{grid-template-columns/);

const worker = fs.readFileSync("worker.js", "utf8");
assert.match(worker, /injectPortalLayoutClient\(injectWerewolfPortalClient\(injectPortalMembersClient/);
for (const path of ["src/portal/community-suite.js", "src/portal/member-cleanup.js", "src/games/werewolf.js"]) {
  const source = fs.readFileSync(path, "utf8");
  assert.ok(!source.includes("var(--border)"), `${path} must use the Portal --line token`);
}
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
assert.equal(pkg.version, "2.7.11");
assert.match(pkg.scripts.check, /verify-portal-layout\.mjs/);
console.log("verify-portal-layout: ok");
