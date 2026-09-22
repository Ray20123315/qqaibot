import assert from "node:assert/strict";
import fs from "node:fs";
import {
  getPortalHomePage,
  getPortalLoginPage,
  getPortalRegisterPage,
  getPublicLandingPage
} from "./src/portal/runtime.js";
import { injectPortalLayoutClient } from "./src/portal/layout.js";
import { injectPortalMembersClient } from "./src/portal/members.js";
import { injectWerewolfPortalClient } from "./src/games/werewolf.js";
import { injectDeploymentPortalClient } from "./src/deployment/notifications.js";

const landing = getPublicLandingPage();
assert.match(landing, /<meta name="theme-color" content="#020714">/);
assert.match(landing, /class="brand-mark"/);
assert.match(landing, /class="console-preview"/);
assert.match(landing, /class="flow-nodes"/);
assert.match(landing, /class="feature-grid"/);
assert.match(landing, /class="role-grid"/);
assert.match(landing, /BYOR/);
assert.match(landing, /Cloudflare/);
assert.match(landing, /YOUR AI · YOUR PLUGINS · YOUR RESOURCES/);
assert.doesNotMatch(landing, /QQAIbot/);
assert.doesNotMatch(landing, /<style>\s*\$\{css\}/);

const login = getPortalLoginPage();
assert.match(login, /class="auth-stage"/);
assert.match(login, /SECURE ACCOUNT ACCESS/);
assert.match(login, /id="username"/);
assert.match(login, /id="password"/);
assert.match(login, /\/api\/auth\/login-password/);
assert.doesNotMatch(login, /id="qqid"/i);
assert.doesNotMatch(login, /QQAIbot/);

const register = getPortalRegisterPage();
assert.match(register, /class="auth-stage"/);
assert.match(register, /FIRST ACTIVATION/);
assert.match(register, /id="qqid"/);
assert.match(register, /id="username"/);
assert.match(register, /\/api\/auth\/register/);
assert.doesNotMatch(register, /QQAIbot/);

const portalBase = getPortalHomePage("qqai.ray2025.com");
assert.match(portalBase, /<b>AI Control Center<\/b>/);
assert.match(portalBase, /AI · Automation · BYOR/);
assert.match(portalBase, /AI CONTROL CENTER/);
assert.match(portalBase, /YOUR AI · YOUR PLUGINS · YOUR RESOURCES/);
assert.match(portalBase, /t==='light'\?'light':'dark'/);
assert.match(portalBase, /id="v-overview"/);
assert.match(portalBase, /id="v-health"/);
assert.match(portalBase, /id="v-models"/);
assert.match(portalBase, /id="v-groups"/);
assert.match(portalBase, /id="v-memory"/);
assert.match(portalBase, /id="v-logs"/);

const withFeatures = injectWerewolfPortalClient(injectPortalMembersClient(injectDeploymentPortalClient(portalBase)));
const full = injectPortalLayoutClient(withFeatures);
assert.match(full, /id="qqai-member-console-style"/);
assert.match(full, /id="qqai-werewolf-style"/);
assert.match(full, /id="qqai-deployment-toast"/);
assert.match(full, /id="qqai-portal-layout-v274"/);
assert.ok(full.lastIndexOf("qqai-portal-layout-v274") > full.lastIndexOf("qqai-werewolf-style"), "AI design layer must be after werewolf feature styles");
assert.ok(full.lastIndexOf("qqai-portal-layout-v274") > full.lastIndexOf("qqai-member-console-style"), "AI design layer must be after member feature styles");
assert.match(full, /--ai-cyan:#31ddff/);
assert.match(full, /\.member-console-toolbar\{grid-template-columns/);
assert.match(full, /\.cleanup-summary\{grid-template-columns/);
assert.match(full, /\.ww-layout\{grid-template-columns/);
assert.match(full, /#qqai-deployment-toast\{/);

const runtime = fs.readFileSync("src/portal/runtime.js", "utf8");
assert.match(runtime, /document\.documentElement\.dataset\.theme=t==='light'\?'light':'dark'/);
assert.match(runtime, /class="side-brand"[\s\S]*AI Control Center/);
assert.match(runtime, /class="top-kicker">AI CONTROL CENTER/);
assert.doesNotMatch(runtime, /<div class="side-brand"[\s\S]{0,160}<b>QQAIbot<\/b>/);

const layoutSource = fs.readFileSync("src/portal/layout.js", "utf8");
for (const selector of [
  ".overview-hero:after",
  ".status-strip",
  ".action-card",
  ".qqai-nav-glyph",
  ".member-action-row",
  ".suite-grid",
  ".cleanup-summary",
  ".ww-layout",
  "#qqai-deployment-toast",
  ".qqai-modal-card"
]) assert.ok(layoutSource.includes(selector), "missing AI design selector: " + selector);

console.log("verify-ai-control-center-ui: ok");
