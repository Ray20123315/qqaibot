import assert from "node:assert/strict";
import fs from "node:fs";
import { getPortalHomePage, getPortalLoginPage, getPortalRegisterPage, getPublicLandingPage } from "./src/portal/runtime.js";

const landing = getPublicLandingPage();
for (const marker of [
  "AI Control Center",
  "PLUGIN-FIRST · MINIMAL CORE",
  'id="publicLogo"',
  'id="publicPlugins"',
  'id="locale"',
  'data-i18n="public.hero.title"',
  "© 2026 ray20123315. All rights reserved.",
  "aibot.ray2025.com"
]) assert.ok(landing.includes(marker), "public V4 marker missing: " + marker);
assert.doesNotMatch(landing, /2\.4K|fake metric/i);
assert.doesNotMatch(landing, /cyber-skyline|console-preview|preview-resource-rail/);

const login = getPortalLoginPage();
assert.match(login, /class="auth-stage"/);
assert.match(login, /id="username"/);
assert.match(login, /id="password"/);
assert.match(login, /data-i18n="login\.title"/);

const register = getPortalRegisterPage();
assert.match(register, /ADMIN PASSWORD SETUP/);
assert.match(register, /id="activationMode"/);
assert.match(register, /value="admin"/);

const portal = getPortalHomePage("aibot.ray2025.com");
for (const marker of [
  'id="view-overview"',
  'id="view-plugins"',
  'id="view-account"',
  'id="pluginGrid"',
  'id="overviewPlugins"',
  'id="localeSelect"',
  'id="brandingCard"',
  'id="brandLogoInput"',
  "© 2026 ray20123315. All rights reserved.",
  "Product features in core",
  "Disabled"
]) assert.ok(portal.includes(marker), "Portal V4 marker missing: " + marker);
for (const forbidden of [
  'id="v-groups"','id="v-members"','id="v-models"','id="v-health"','id="v-memory"',
  'id="v-moderation"','id="v-logs"','id="pluginCompatNav"','qqai-member-console-style',
  'qqai-deployment-toast','qqai-portal-layout-v300'
]) assert.equal(portal.includes(forbidden), false, "legacy Portal UI leaked: " + forbidden);
assert.equal((portal.match(/class="view(?: active)?"/g)||[]).length, 3, "Portal V4 must render exactly three first-class views");
assert.match(portal, /:root\[data-theme="dark"\]/);
assert.match(portal, /--surface:#fff/);
assert.match(portal, /--surface:#111722/);

const worker = fs.readFileSync("worker.js", "utf8");
assert.match(worker, /const portalHtml = getPortalHomePage\(url\.host\)/);
assert.doesNotMatch(worker, /injectPortalLayoutClient|injectPortalMembersClient|injectDeploymentPortalClient/);
assert.match(worker, /\/api\/public\/branding/);

console.log("verify-ai-control-center-ui: ok");
