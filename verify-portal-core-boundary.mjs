import assert from "node:assert/strict";
import fs from "node:fs";
import { portalPluginCatalog, portalPluginForApiPath, portalPluginForView } from "./src/plugins/runtime.js";
import { getPortalHomePage } from "./src/portal/runtime.js";

const CORE_VIEWS = new Set(["overview", "plugins", "account"]);
const runtime = fs.readFileSync("src/portal/runtime.js", "utf8");
const featureSource = fs.readFileSync("src/plugins/bundled/portal-features.js", "utf8");

assert.match(runtime, /var core=\['overview','plugins','account'\]/, "first-class core must remain exactly overview/plugins/account");
assert.doesNotMatch(runtime, /var core=\[[^\]]*health/, "health must not be part of the first-class core");
assert.match(runtime, /class="plugin-context-control hidden"/, "group selector must be plugin-contextual");
assert.match(runtime, /function pluginUsesGroupContext/, "plugin context must be derived from manifest metadata");
assert.match(runtime, /async function ensurePluginContext/, "plugin context must be lazy-loaded");
assert.doesNotMatch(runtime, /await loadPlugins\(\);var loaded=await loadGroups\(\)/, "core boot must not eagerly load group/community context");

const rendered = getPortalHomePage("aibot.ray2025.com");
const navStart = rendered.indexOf('<nav class="core-nav" id="nav"');
const compatStart = rendered.indexOf('id="pluginCompatNav"', navStart);
assert.ok(navStart >= 0 && compatStart > navStart, "workspace core nav/plugin bridge markers missing");
assert.doesNotMatch(rendered, /<nav class="nav core-nav" id="nav"/, "portal navigation must not reuse the public nav class");
const firstClassNav = rendered.slice(navStart, compatStart);
for (const core of CORE_VIEWS) assert.ok(firstClassNav.includes(`data-view="${core}"`), "missing first-class core view " + core);
for (const forbidden of ["health","tasks","moderation","simulator","models","quota","groups","memory","logs","members","platform","maintenance"]) {
  assert.equal(firstClassNav.includes(`data-view="${forbidden}"`), false, forbidden + " must not be a first-class core nav item");
}

const sourceFiles = [
  "src/portal/runtime.js",
  "src/portal/members.js",
  "src/portal/community-suite.js",
  "src/portal/member-cleanup.js",
  "src/deployment/notifications.js"
].filter(path => fs.existsSync(path));
const discovered = new Set();
for (const path of sourceFiles) {
  const source = fs.readFileSync(path, "utf8");
  for (const match of source.matchAll(/id="v-([a-z0-9-]+)"/g)) discovered.add(match[1]);
  for (const match of source.matchAll(/data-view="([a-z0-9-]+)"/g)) discovered.add(match[1]);
}
for (const core of CORE_VIEWS) discovered.delete(core);

const catalog = portalPluginCatalog();
assert.ok(catalog.length >= 7, "feature plugin catalog unexpectedly small");
assert.equal(catalog.every(plugin => plugin.portal.defaultEnabled === false), true, "minimal deployment must not auto-enable product plugins");
const owners = new Map();
for (const plugin of catalog) {
  for (const view of plugin.portal.views || []) {
    if (!owners.has(view)) owners.set(view, []);
    owners.get(view).push(plugin.id);
  }
}
for (const view of discovered) {
  const ids = owners.get(view) || [];
  assert.equal(ids.length, 1, `non-core view ${view} must have exactly one plugin owner; got ${ids.join(",") || "none"}`);
  assert.equal(portalPluginForView(view)?.id, ids[0]);
}
for (const core of CORE_VIEWS) {
  assert.equal(owners.has(core), false, "core view must not be owned by a feature plugin: " + core);
}

const developerTools = catalog.find(plugin => plugin.id === "qqai.developer-tools");
assert.ok(developerTools, "developer-tools plugin missing");
assert.equal(developerTools.portal.developerOnly, true);
assert.ok(developerTools.portal.views.includes("health"), "health must belong to developer-tools");
assert.equal(developerTools.portal.defaultView, "health");
assert.ok(developerTools.portal.apiPrefixes.includes("/health"), "health APIs must be gated by developer-tools state");

const groupContextPlugins = catalog.filter(plugin => plugin.portal.groupContext);
assert.ok(groupContextPlugins.length >= 5, "group-context feature families should declare plugin metadata");
assert.equal(developerTools.portal.groupContext, false);

const overviewStart = runtime.indexOf("async function refreshOverview(){");
const overviewEnd = runtime.indexOf("\nvar lastPortalInteractionAt=", overviewStart);
assert.ok(overviewStart >= 0 && overviewEnd > overviewStart, "refreshOverview bounds missing");
const overviewFunction = runtime.slice(overviewStart, overviewEnd);
assert.doesNotMatch(overviewFunction, /api\('/, "core overview must not call feature plugin APIs");
assert.doesNotMatch(overviewFunction, /health|tasks|moderation\/proposals/, "core overview must not depend on diagnostics/tasks/moderation");

assert.match(featureSource, /id: "qqai\.developer-tools"[\s\S]*views: \["health", "platform", "logs", "maintenance"\]/);
assert.doesNotMatch(featureSource, /qqai\.werewolf|狼人殺|狼人杀/i);

const handleStart = runtime.indexOf("async function handlePortalApi");
const handleEnd = runtime.indexOf("async function handleGeminiLiveUpgrade", handleStart);
assert.ok(handleStart >= 0 && handleEnd > handleStart, "handlePortalApi bounds missing");
const handleSource = runtime.slice(handleStart, handleEnd);
const routeLiterals = new Set([
  ...[...handleSource.matchAll(/path\s*===\s*"([^"]+)"/g)].map(match => match[1]),
  ...[...handleSource.matchAll(/path\.startsWith\("([^"]+)"\)/g)].map(match => match[1])
]);
const coreApiExact = new Set(["/heartbeat", "/me", "/groups", "/select-group", "/capabilities", "/plugins", "/plugins/"]);
function isCoreApiPath(path) {
  return coreApiExact.has(path) || path === "/security" || path.startsWith("/security/");
}
const unownedFeatureApis = [...routeLiterals]
  .filter(path => !isCoreApiPath(path))
  .filter(path => !portalPluginForApiPath(path))
  .sort();
assert.deepEqual(unownedFeatureApis, [], "every non-core Portal API literal must have a plugin owner");
for (const path of ["/heartbeat","/me","/groups","/select-group","/capabilities","/plugins","/security/auth-state","/security/password"]) {
  assert.equal(portalPluginForApiPath(path), null, "shared core API must remain plugin-independent: " + path);
}

console.log("verify-portal-core-boundary: ok");
