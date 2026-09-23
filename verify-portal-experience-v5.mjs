import assert from "node:assert/strict";
import fs from "node:fs";
import { brandLockupMarkup, brandLogoSvg, brandPublicStyle, brandThemeBootScript } from "./src/portal/brand.js";
import { injectPortalLayoutClient } from "./src/portal/layout.js";
import { getPortalHomePage, getPortalLoginPage, getPortalRegisterPage, getPublicLandingPage } from "./src/portal/runtime.js";

const logo = brandLogoSvg();
assert.match(logo, /ray-logo-ring/);
assert.match(logo, /ray-logo-r/);
assert.match(logo, /qqai-brand-cyan/);
assert.match(logo, /qqai-brand-violet/);
const lockup = brandLockupMarkup();
assert.match(lockup, />RAY AI</);
assert.match(lockup, />QQ AI BOT</);
assert.match(lockup, /AI Control Center/);

const publicStyle = brandPublicStyle();
for (const marker of ["qqai-ray-experience-v500",".ray-particle-canvas",".ray-select-control",".ray-modal-layer",".ray-toast-stack",".public-v4-hero",".auth-stage"]) {
  assert.ok(publicStyle.includes(marker), "missing v5 style marker: " + marker);
}
const boot = brandThemeBootScript();
for (const marker of ["qqai_theme","qqai-ray-experience-client-v500","prefers-reduced-motion","XMLSerializer","role','combobox","aria-haspopup','listbox","ArrowDown","Escape","window.rayConfirm","window.rayToast"]) {
  assert.ok(boot.includes(marker), "missing v5 client marker: " + marker);
}
for (const page of [getPublicLandingPage(), getPortalLoginPage(), getPortalRegisterPage()]) {
  assert.match(page, /qqai-ray-experience-v500/);
  assert.match(page, /qqai-ray-experience-client-v500/);
  assert.match(page, /qqai-brand-logo/);
}
const portal = injectPortalLayoutClient(getPortalHomePage("aibot.ray2025.com"));
assert.match(portal, /qqai-portal-layout-v400/);
assert.match(portal, /qqai-ray-experience-v500/);
assert.match(portal, /qqai-ray-experience-client-v500/);
assert.match(portal, /workspace-hero/);

const experience = fs.readFileSync("src/portal/experience-v5.js", "utf8");
for (const marker of ["MutationObserver","ResizeObserver","requestAnimationFrame","rayEnhanced","selectedIndex","dispatchEvent(new Event('change'"]) {
  assert.ok(experience.includes(marker), "missing experience implementation marker: " + marker);
}
for (const path of ["src/portal/members.js","src/portal/member-cleanup.js","src/portal/community-suite.js"]) {
  const source = fs.readFileSync(path, "utf8");
  assert.doesNotMatch(source, /window\.alert\s*\(/, path + " must not use native alert");
  assert.doesNotMatch(source, /window\.confirm\s*\(/, path + " must not use native confirm");
}
assert.doesNotMatch(fs.readFileSync("src/portal/community-suite.js","utf8"), /!confirm\s*\(/);
console.log("verify-portal-experience-v5: ok");
