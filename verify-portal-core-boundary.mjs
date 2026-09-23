import assert from "node:assert/strict";
import fs from "node:fs";
import { portalPluginCatalog, portalPluginForApiPath, portalPluginForView } from "./src/plugins/runtime.js";
import { getPortalHomePage } from "./src/portal/runtime.js";

const CORE_VIEWS = ["overview","plugins","account"];
const rendered = getPortalHomePage("aibot.ray2025.com");

for (const core of CORE_VIEWS) {
  assert.ok(rendered.includes('data-view="' + core + '"'), "missing core nav " + core);
  assert.ok(rendered.includes('id="view-' + core + '"'), "missing core view " + core);
}
for (const forbidden of ["health","tasks","moderation","simulator","models","quota","groups","memory","logs","members","platform","maintenance","appeals","conversations"]) {
  assert.equal(rendered.includes('data-view="' + forbidden + '"'), false, forbidden + " must not be first-class core navigation");
  assert.equal(rendered.includes('id="view-' + forbidden + '"'), false, forbidden + " must not be rendered as core DOM");
  assert.equal(rendered.includes('id="v-' + forbidden + '"'), false, forbidden + " legacy view must not be rendered");
}
assert.equal((rendered.match(/class="view(?: active)?"/g)||[]).length, 3, "core surface count must stay exactly three");
assert.doesNotMatch(rendered, /pluginCompatNav|qqai-nav-entry|member-console|deployment-toast/);

const catalog = portalPluginCatalog();
assert.ok(catalog.length >= 7, "feature plugin catalog unexpectedly small");
assert.equal(catalog.every(plugin => plugin.portal.defaultEnabled === false), true, "product plugins must default disabled");
for (const core of CORE_VIEWS) assert.equal(portalPluginForView(core), null, "core view must not be plugin-owned: " + core);

const developerTools = catalog.find(plugin => plugin.id === "qqai.developer-tools");
assert.ok(developerTools);
assert.equal(developerTools.portal.developerOnly, true);
assert.ok(developerTools.portal.views.includes("health"));
assert.ok(developerTools.portal.apiPrefixes.includes("/health"));
assert.equal(developerTools.portal.defaultEnabled, false);

const handleSource = fs.readFileSync("src/portal/runtime.js", "utf8");
const start = handleSource.indexOf("async function handlePortalApi");
const end = handleSource.indexOf("async function handleGeminiLiveUpgrade", start);
assert.ok(start >= 0 && end > start, "handlePortalApi bounds missing");
const block = handleSource.slice(start, end);
const paths = new Set([
  ...[...block.matchAll(/path\s*===\s*"([^"]+)"/g)].map(m=>m[1]),
  ...[...block.matchAll(/path\.startsWith\("([^"]+)"\)/g)].map(m=>m[1])
]);
const coreExact = new Set(["/heartbeat","/me","/groups","/select-group","/capabilities","/plugins","/plugins/","/branding"]);
function core(path){return coreExact.has(path)||path==="/security"||path.startsWith("/security/")}
const unowned=[...paths].filter(p=>!core(p)).filter(p=>!portalPluginForApiPath(p)).sort();
assert.deepEqual(unowned, [], "all non-core Portal APIs need plugin ownership: " + unowned.join(", "));
for (const p of ["/heartbeat","/me","/groups","/select-group","/capabilities","/plugins","/branding","/security/auth-state","/security/password"]) {
  assert.equal(portalPluginForApiPath(p), null, "shared core API must remain plugin-independent: " + p);
}

const worker = fs.readFileSync("worker.js", "utf8");
assert.match(worker, /getPortalHomePage\(url\.host\)/);
assert.doesNotMatch(worker, /injectPortalLayoutClient|injectPortalMembersClient|injectDeploymentPortalClient/);

console.log("verify-portal-core-boundary: ok");
