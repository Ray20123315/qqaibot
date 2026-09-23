import assert from "node:assert/strict";
import fs from "node:fs";
import { PORTAL_LOCALES, normalizePortalLocale, portalI18nPayload } from "./src/i18n/portal.js";
import { portalPluginCatalog } from "./src/plugins/runtime.js";
import { getPortalHomePage, getPortalLoginPage, getPortalRegisterPage, getPublicLandingPage } from "./src/portal/runtime.js";

const required=["zh-TW","zh-CN","en"], ids=PORTAL_LOCALES.map(x=>x.id);
for(const locale of required) assert.ok(ids.includes(locale),"missing required locale "+locale);
assert.ok(ids.length>=10,"Portal should ship at least ten locales");
assert.equal(normalizePortalLocale("zh-Hant-TW"),"zh-TW");
assert.equal(normalizePortalLocale("zh-Hans-CN"),"zh-CN");
assert.equal(normalizePortalLocale("en-US"),"en");
assert.equal(normalizePortalLocale("pt-PT"),"pt-BR");

const payload=portalI18nPayload();
for(const locale of ids){
  assert.ok(payload.messages[locale],"missing locale pack "+locale);
  for(const key of ["nav.home","nav.plugins","nav.account","footer.rights","public.hero.title","login.title","register.title","plugins.enabled","plugins.disabled","plugins.enable","plugins.disable"]) {
    assert.ok(payload.messages[locale][key], locale+" missing "+key);
  }
}
const catalog=portalPluginCatalog();
assert.ok(catalog.length>=7);
for(const plugin of catalog){
  assert.ok(plugin.portal.views.length,plugin.id+" missing views");
  assert.equal(plugin.portal.defaultEnabled,false,plugin.id+" must default disabled");
  for(const locale of required) assert.ok(plugin.i18n[locale]?.name,plugin.id+" missing "+locale+" name");
}
const landing=getPublicLandingPage(), portal=getPortalHomePage("aibot.ray2025.com");
assert.ok(landing.includes('id="locale"'));
assert.ok(landing.includes('window.__QQAI_PUBLIC_I18N__'));
assert.ok(portal.includes('id="localeSelect"'));
assert.ok(portal.includes('id="accountLocale"'));
assert.ok(portal.includes('window.__QQAI_V4_I18N__'));
for(const page of [landing,portal,getPortalLoginPage(),getPortalRegisterPage()]) assert.ok(page.includes("© 2026 ray20123315. All rights reserved."));
const worker=fs.readFileSync("worker.js","utf8");
assert.doesNotMatch(worker,/toSimplifiedChinese\(getPortalHomePage/);
const wrangler=fs.readFileSync("wrangler.toml","utf8");
assert.match(wrangler,/^keep_vars\s*=\s*true$/m);
assert.match(wrangler,/pattern\s*=\s*"aibot\.ray2025\.com"/);
assert.doesNotMatch(wrangler,/^\s*(?:DEVELOPER_IDS|ROOT_QQ_IDS|DEVELOPER_ID)\s*=/m);

console.log("verify-portal-plugin-i18n: ok");
