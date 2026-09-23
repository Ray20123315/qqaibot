import assert from "node:assert/strict";
import fs from "node:fs";
import { brandFaviconLink, brandLockupMarkup, brandLogoSvg, brandPublicStyle, brandThemeBootScript } from "./src/portal/brand.js";
import { getPortalHomePage, getPortalLoginPage, getPortalRegisterPage, getPublicLandingPage } from "./src/portal/runtime.js";

const logo = brandLogoSvg();
assert.match(logo, /<svg class="qqai-brand-logo"/);
assert.match(logo, /qqai-brand-cyan/);
assert.match(logo, /qqai-brand-violet/);
assert.doesNotMatch(logo, /https?:\/\//);

const lockup = brandLockupMarkup();
assert.match(lockup, /AI Control Center/);
assert.match(lockup, /AI · PLUGINS · BYOR/);
assert.match(brandFaviconLink(), /data:image\/svg\+xml/);
assert.match(brandPublicStyle(), /ray-landing-hero/);
assert.match(brandPublicStyle(), /:root\[data-theme="light"\]/);
assert.match(brandThemeBootScript(), /qqai_theme/);

const landing = getPublicLandingPage();
assert.match(landing, /public-home-v4/);
assert.match(landing, /qqai-brand-logo ray-core-logo/);
assert.match(landing, /SMALL CORE · PLUGIN FIRST · BYOR/);
assert.doesNotMatch(landing, /2\.4K|28 個|28 plugins/i);

for (const page of [landing, getPortalLoginPage(), getPortalRegisterPage()]) {
  assert.match(page, /qqai-brand-logo/);
  assert.match(page, /qqai-brand-theme-boot/);
  assert.match(page, /qqai-brand-public-v4/);
  assert.match(page, /qqai-ray-experience-v600/);
}
const portal = getPortalHomePage("aibot.ray2025.com");
assert.match(portal, /qqai-brand-logo portal-brand-logo/);
assert.match(portal, /qqai-brand-logo portal-hero-logo/);
assert.match(portal, /workspace-shell/);
assert.match(portal, /id="pluginBack"/);
assert.match(portal, /SMALL CORE/);

const runtime = fs.readFileSync("src/portal/runtime.js","utf8");
assert.match(runtime, /document\.documentElement\.classList\.toggle\('plugin-workspace',pluginOwned\)/);
const layout = fs.readFileSync("src/portal/layout.js","utf8");
assert.match(layout, /qqai-portal-layout-v400/);
assert.doesNotMatch(layout, /qqai-portal-layout-v300/);

console.log("verify-portal-brand-workspace: ok");
