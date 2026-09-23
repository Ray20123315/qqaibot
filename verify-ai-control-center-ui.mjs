import assert from "node:assert/strict";
import fs from "node:fs";
import { getPortalHomePage, getPortalLoginPage, getPortalRegisterPage, getPublicLandingPage } from "./src/portal/runtime.js";
import { injectPortalLayoutClient } from "./src/portal/layout.js";
import { injectPortalMembersClient } from "./src/portal/members.js";
import { injectDeploymentPortalClient } from "./src/deployment/notifications.js";

const landing = getPublicLandingPage();
assert.match(landing, /AI Control Center/);
assert.match(landing, /id="publicLocale"/);
assert.match(landing, /© 2026 ray20123315\. All rights reserved\./);
assert.match(landing, /class="public-home-v4 ray-landing"/);
assert.match(landing, /class="public-v4-hero ray-landing-hero"/);
assert.match(landing, /class="qqai-brand-logo/);
assert.match(landing, /id="publicTheme"/);
assert.match(landing, /ray-feature-strip/);
assert.match(landing, /qqai-ray-experience-v600/);
assert.doesNotMatch(landing, /2\.4K/);

const login = getPortalLoginPage();
assert.match(login, /class="auth-stage"/);
assert.match(login, /id="username"/);
assert.match(login, /id="password"/);
assert.match(login, /id="publicLocale"/);
assert.match(login, /data-i18n="login\.title"/);
assert.match(login, /© 2026 ray20123315\. All rights reserved\./);
assert.match(login, /class="qqai-brand-logo/);
assert.match(login, /id="publicTheme"/);

const register = getPortalRegisterPage();
assert.match(register, /ADMIN PASSWORD SETUP/);
assert.match(register, /id="activationMode"/);
assert.match(register, /value="admin"/);
assert.match(register, /id="publicLocale"/);
assert.match(register, /data-i18n="register\.title"/);
assert.match(register, /© 2026 ray20123315\. All rights reserved\./);
assert.match(register, /class="qqai-brand-logo/);
assert.match(register, /id="publicTheme"/);

const portalBase = getPortalHomePage("aibot.ray2025.com");
for (const marker of [
  'data-view="overview"',
  'data-view="plugins"',
  'data-view="account"',
  'id="pluginCompatNav"',
  'id="pluginGrid"',
  'id="overviewPluginGrid"',
  'id="localeSelect"',
  'id="pluginBack"',
  'id="rayCommandSearch"',
  'id="rayAccountMenu"',
  'class="ray-dashboard-grid"',
  'class="app workspace-shell"',
  'class="qqai-brand-logo portal-brand-logo"',
  'class="qqai-brand-logo portal-hero-logo"',
  'window.__QQAI_PORTAL_PLUGINS__',
  'window.__QQAI_PORTAL_I18N__',
  '© 2026 ray20123315. All rights reserved.'
]) assert.ok(portalBase.includes(marker), "missing rebuilt Portal marker: " + marker);
assert.doesNotMatch(portalBase, /return toSimplifiedChinese\(String\.raw/);

const withFeatures = injectPortalMembersClient(injectDeploymentPortalClient(portalBase));
const full = injectPortalLayoutClient(withFeatures);
assert.match(full, /id="qqai-member-console-style"/);
assert.match(full, /id="qqai-deployment-toast"/);
assert.match(full, /id="qqai-portal-layout-v400"/);
assert.ok(full.lastIndexOf("qqai-portal-layout-v400") > full.lastIndexOf("qqai-member-console-style"));

const runtime = fs.readFileSync("src/portal/runtime.js", "utf8");
assert.match(runtime, /function renderPluginCatalog/);
assert.match(runtime, /function setPortalLocale/);
assert.match(runtime, /function organizeSidebarNavigation/);
assert.match(runtime, /var core=\['overview','plugins','account'\]/);
assert.doesNotMatch(runtime, /var core=\[[^\]]*health/);
assert.match(runtime, /plugin-compat-nav/);
assert.match(runtime, /data-plugin-toggle/);
assert.match(runtime, /PLUGIN_DISABLED/);
assert.match(runtime, /function pluginUsesGroupContext/);
assert.match(runtime, /async function ensurePluginContext/);
assert.match(runtime, /class="plugin-context-control hidden"/);

const layout = fs.readFileSync("src/portal/layout.js", "utf8");
assert.match(layout, /--sidebar-bg:rgba\(255,255,255,\.94\)/);
assert.match(layout, /:root\[data-theme="dark"\]/);
assert.match(layout, /background:var\(--panel\)!important/);
assert.match(layout, /\.plugin-grid\{/);
assert.match(layout, /\.workspace-hero\{/);
assert.match(layout, /\.workspace-status-grid\{/);
assert.match(layout, /\.plugin-back\{/);
assert.match(layout, /\.nav>\.qqai-nav-entry/);
assert.doesNotMatch(layout, /--bg:#020713!important/);

console.log("verify-ai-control-center-ui: ok");

assert.doesNotMatch(fs.readFileSync("worker.js", "utf8"), /werewolf|狼人殺|狼人杀/i);
