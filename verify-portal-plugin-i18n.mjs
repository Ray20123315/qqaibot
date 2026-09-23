import assert from "node:assert/strict";
import fs from "node:fs";
import { PORTAL_LOCALES, PORTAL_MESSAGES, normalizePortalLocale, portalI18nPayload, portalMessage } from "./src/i18n/portal.js";
import { PORTAL_LEGACY_PHRASES } from "./src/i18n/portal-legacy.js";
import { portalPluginCatalog } from "./src/plugins/runtime.js";
import { getPortalHomePage, getPortalLoginPage, getPortalRegisterPage, getPublicLandingPage } from "./src/portal/runtime.js";

const required = ["zh-TW", "zh-CN", "en"];
const ids = PORTAL_LOCALES.map(x => x.id);
for (const locale of required) assert.ok(ids.includes(locale), "missing required locale " + locale);
assert.ok(ids.length >= 10, "Portal should ship a broad locale set");
assert.equal(normalizePortalLocale("zh-Hant-TW"), "zh-TW");
assert.equal(normalizePortalLocale("zh-Hans-CN"), "zh-CN");
assert.equal(normalizePortalLocale("en-US"), "en");
assert.equal(normalizePortalLocale("pt-PT"), "pt-BR");

const payload = portalI18nPayload();
assert.equal(payload.fallbackLocale, "en");
const referenceKeys = Object.keys(PORTAL_MESSAGES.en).sort();
assert.ok(referenceKeys.length >= 80, "English locale should define the complete UI contract");
for (const locale of ids) {
  assert.deepEqual(Object.keys(PORTAL_MESSAGES[locale]).sort(), referenceKeys, locale + " must have the same translation key set as English");
}
assert.equal(portalMessage("ja", "view.members"), "メンバー");
assert.equal(portalMessage("xx-YY", "view.members"), "Members");
assert.ok(Object.keys(PORTAL_LEGACY_PHRASES).length >= 80, "legacy compatibility surface should have broad translation coverage");
for (const [source, row] of Object.entries(PORTAL_LEGACY_PHRASES)) {
  for (const locale of ["zh-TW", "zh-CN", "en"]) assert.ok(row[locale], source + " missing required legacy translation " + locale);
}
for (const locale of ids) {
  assert.ok(payload.messages[locale], "missing locale message pack " + locale);
  for (const key of ["nav.home","nav.plugins","nav.account","footer.rights","public.hero.title","login.title","register.title"]) {
    assert.ok(payload.messages[locale][key], locale + " missing " + key);
  }
}

const catalog = portalPluginCatalog();
assert.ok(catalog.length >= 8);
for (const plugin of catalog) {
  assert.ok(plugin.portal.views.length, plugin.id + " missing views");
  for (const locale of required) assert.ok(plugin.i18n[locale]?.name, plugin.id + " missing " + locale + " plugin name");
}
assert.ok(catalog.some(x => x.id === "qqai.developer-tools" && x.portal.developerOnly));

const portal = getPortalHomePage("aibot.ray2025.com");
for (const marker of ['data-view="overview"','data-view="plugins"','data-view="account"','id="pluginCompatNav"','id="localeSelect"']) {
  assert.ok(portal.includes(marker), "missing core shell marker " + marker);
}
assert.match(portal, /function portalTitle\(name\).*view\./s);
assert.match(portal, /function localizeLegacyNode/);
assert.match(portal, /MutationObserver/);
assert.match(portal, /legacyPhrases/);
assert.doesNotMatch(portal, /var titles=\{overview:/);
for (const page of [getPublicLandingPage(), getPortalLoginPage(), getPortalRegisterPage()]) {
  assert.ok(page.includes('id="publicLocale"'), "public/auth surface missing locale selector");
  assert.ok(page.includes("© 2026 ray20123315. All rights reserved."), "public/auth surface missing rights notice");
  assert.ok(page.includes("qqai-public-i18n"), "public/auth surface missing i18n runtime");
}

const worker = fs.readFileSync("worker.js", "utf8");
assert.doesNotMatch(worker, /toSimplifiedChinese\(getPortalHomePage/);
const wrangler = fs.readFileSync("wrangler.toml", "utf8");
assert.match(wrangler, /^keep_vars\s*=\s*true$/m);
assert.match(wrangler, /pattern\s*=\s*"aibot\.ray2025\.com"/);
assert.doesNotMatch(wrangler, /^\s*(?:DEVELOPER_IDS|ROOT_QQ_IDS|DEVELOPER_ID)\s*=/m);

console.log("verify-portal-plugin-i18n: ok");
