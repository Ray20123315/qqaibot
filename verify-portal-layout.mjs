import fs from "node:fs";
import assert from "node:assert/strict";
import { injectPortalLayoutClient } from "./src/portal/layout.js";

const sample = '<!doctype html><html><head><style id="feature">.x{display:block}</style></head><body><main></main></body></html>';
const injected = injectPortalLayoutClient(sample);
assert.match(injected, /id="qqai-portal-layout-v400"/);
assert.match(injected, /id="qqai-portal-layout-client-v400"/);
assert.ok(injected.indexOf("qqai-portal-layout-v400") > injected.indexOf('id="feature"'), "canonical layout must be the last style layer");
assert.match(injected, /@media\(max-width:1024px\)/);
assert.match(injected, /@media\(max-width:700px\)/);
assert.match(injected, /@media\(max-width:440px\)/);
for (const selector of [".portal-appbar{", ".portal-home-hero{", ".plugin-grid{", ".member-action-row{", ".cleanup-summary{", "#qqai-deployment-toast"]) {
  assert.ok(injected.includes(selector), "missing layout selector: " + selector);
}
assert.match(injected, /--portal-bg:#f5f7fb/);
assert.match(injected, /:root\[data-theme="dark"\]/);
assert.match(injected, /\.portal-main,.main\{margin:0!important/);
assert.doesNotMatch(injected, /--bg:#020713!important/);

const worker = fs.readFileSync("worker.js", "utf8");
assert.match(worker, /injectPortalLayoutClient\(injectPortalMembersClient\(injectDeploymentPortalClient/);
for (const path of ["src/portal/community-suite.js", "src/portal/member-cleanup.js"]) {
  const source = fs.readFileSync(path, "utf8");
  assert.ok(!source.includes("var(--border)"), path + " must use the Portal --line token");
}
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
assert.equal(pkg.version, "2.7.12");
assert.match(pkg.scripts.check, /verify-portal-layout\.mjs/);
console.log("verify-portal-layout: ok");

assert.doesNotMatch(worker, /werewolf|狼人殺|狼人杀/i);
