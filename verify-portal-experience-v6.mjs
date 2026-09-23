import assert from "node:assert/strict";
import fs from "node:fs";
import { brandLockupMarkup, brandLogoSvg, brandPublicStyle, brandThemeBootScript } from "./src/portal/brand.js";
import { rayAiExperienceScript } from "./src/portal/experience-v6.js";
import { injectPortalLayoutClient } from "./src/portal/layout.js";
import { getPortalHomePage, getPortalLoginPage, getPortalRegisterPage, getPublicLandingPage } from "./src/portal/runtime.js";

const style = brandPublicStyle();
for (const marker of ["qqai-ray-experience-v600",".ray-landing-hero",".ray-hero-core",".ray-feature-strip",".ray-select-control",".ray-modal-layer",".ray-command-search",".workspace-status-grid"]) {
  assert.ok(style.includes(marker), "missing v6 style marker: " + marker);
}
const boot = brandThemeBootScript();
for (const marker of ["qqai-ray-experience-client-v600","IntersectionObserver","document.hidden","requestAnimationFrame","rayEnhanced","role','combobox","ArrowDown","window.rayConfirm","window.rayToast"]) {
  assert.ok(boot.includes(marker), "missing v6 client marker: " + marker);
}
const script = rayAiExperienceScript("public");
assert.equal(script.endsWith("</script>"), true, "v6 client must emit a real HTML closing tag");
assert.equal(script.includes("<\\/script>"), false, "v6 runtime HTML must not contain a literal backslash closing tag");

const source = fs.readFileSync("src/portal/experience-v6.js","utf8");
assert.doesNotMatch(source,/shadowBlur\s*=/,"particle renderer must not use per-frame shadowBlur");
assert.match(source,/mobile\?84:220/,"particle budget must stay capped");
assert.match(source,/minFrame=mobile\?34:22/,"particle renderer must frame-cap mobile");
assert.match(source,/IntersectionObserver/);
assert.match(source,/visibilitychange/);
const broadBackdrop = (source.match(/backdrop-filter/g)||[]).length;
assert.ok(broadBackdrop <= 0, "v6 must avoid expensive backdrop-filter surfaces");

const landing=getPublicLandingPage(),login=getPortalLoginPage(),register=getPortalRegisterPage();
for(const marker of ['class="public-home-v4 ray-landing"','class="public-v4-hero ray-landing-hero"','ray-feature-strip','ray-core-logo','RAY AI']){
  assert.ok(landing.includes(marker),"landing missing canonical marker "+marker);
}
assert.match(login,/class="ray-page-login"/);assert.match(login,/ray-auth-card-brand/);assert.match(login,/id="username"/);assert.match(login,/id="password"/);
assert.match(register,/class="ray-page-register"/);assert.match(register,/ray-auth-card-brand/);assert.match(register,/id="activationMode"/);assert.match(register,/id="qqid"/);
const portal=injectPortalLayoutClient(getPortalHomePage("aibot.ray2025.com"));
for(const marker of ['id="rayCommandSearch"','id="rayAccountMenu"','ray-dashboard-grid','ray-dashboard-rail','workspace-hero','workspace-status-grid']){
  assert.ok(portal.includes(marker),"portal missing canonical marker "+marker);
}
assert.match(portal,/dataset\.theme=t==='light'\?'light':'dark'/);
assert.match(brandLockupMarkup(),/>RAY AI</);
assert.match(brandLogoSvg(),/ray-logo-r/);
console.log("verify-portal-experience-v6: ok");
