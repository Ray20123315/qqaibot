import assert from "node:assert/strict";
import {
  portalPluginCatalog,
  portalPluginCatalogState,
  portalPluginForApiPath,
  portalPluginForView,
  readPortalPluginEnabled,
  setPortalPluginEnabled
} from "./src/plugins/runtime.js";

class FakeD1 {
  constructor() { this.map = new Map(); }
  prepare(sql) {
    const db = this;
    return {
      bind(...args) {
        return {
          async first() {
            if (!/SELECT value FROM kv_store WHERE key = \?/.test(sql)) throw new Error("unexpected SELECT: " + sql);
            const value = db.map.get(String(args[0]));
            return value === undefined ? null : { value };
          },
          async run() {
            if (!/INSERT INTO kv_store/.test(sql)) throw new Error("unexpected write: " + sql);
            db.map.set(String(args[0]), String(args[1]));
            return { success: true };
          }
        };
      }
    };
  }
}

const catalog = portalPluginCatalog();
assert.equal(catalog.some(plugin => plugin.id === "qqai.werewolf"), false, "werewolf must be deleted");
assert.equal(portalPluginForView("members")?.id, "qqai.community");
assert.equal(portalPluginForApiPath("/members")?.id, "qqai.community");
assert.equal(portalPluginForApiPath("/members/history")?.id, "qqai.community");
assert.equal(portalPluginForApiPath("/tasks")?.id, "qqai.automation");
assert.equal(portalPluginForApiPath("/models")?.id, "qqai.models");
assert.equal(portalPluginForApiPath("/integrations/bilibili")?.id, "qqai.integrations");
assert.equal(portalPluginForView("health")?.id, "qqai.developer-tools");
assert.equal(portalPluginForApiPath("/health")?.id, "qqai.developer-tools");
assert.equal(portalPluginForApiPath("/health/model-check")?.id, "qqai.developer-tools");
assert.equal(portalPluginForApiPath("/root/appeals")?.id, "qqai.moderation");
assert.equal(portalPluginForApiPath("/root/schedules")?.id, "qqai.automation");
assert.equal(portalPluginForApiPath("/root/members")?.id, "qqai.community");
assert.equal(portalPluginForApiPath("/root/quotas")?.id, "qqai.models");
assert.equal(portalPluginForApiPath("/root/state")?.id, "qqai.developer-tools");
assert.equal(portalPluginForApiPath("/admin/state")?.id, "qqai.community");
assert.equal(portalPluginForApiPath("/admin/logs")?.id, "qqai.developer-tools");
assert.equal(portalPluginForApiPath("/group-work/decision")?.id, "qqai.moderation");
assert.equal(portalPluginForApiPath("/settings")?.id, "qqai.community");
assert.equal(portalPluginForApiPath("/security/auth-state"), null, "core security routes must not belong to a plugin");

const db = new FakeD1();
const env = { DB: db };
assert.equal(await readPortalPluginEnabled(env, "qqai.community"), false);
assert.equal(await readPortalPluginEnabled(env, "qqai.moderation"), false);
assert.equal(await readPortalPluginEnabled(env, "qqai.automation"), false);
assert.equal(await readPortalPluginEnabled(env, "qqai.knowledge"), false);
assert.equal(await readPortalPluginEnabled(env, "qqai.models"), false);
assert.equal(await readPortalPluginEnabled(env, "qqai.integrations"), false);
assert.equal(await readPortalPluginEnabled(env, "qqai.developer-tools"), false);

let result = await setPortalPluginEnabled(env, "qqai.automation", true);
assert.equal(result.ok, true);
assert.equal(await readPortalPluginEnabled(env, "qqai.automation"), true);
assert.equal(db.map.get("portal_plugin_enabled:qqai.automation"), "true");

result = await setPortalPluginEnabled(env, "qqai.community", false);
assert.equal(result.ok, true);
assert.equal(await readPortalPluginEnabled(env, "qqai.community"), false);

const developerCatalog = await portalPluginCatalogState(env, { developer: true });
assert.equal(developerCatalog.some(plugin => plugin.id === "qqai.community" && plugin.enabled === false), true, "Developer must see disabled plugins so they can re-enable them");
assert.equal(developerCatalog.some(plugin => plugin.id === "qqai.automation" && plugin.enabled === true), true);

const memberCatalog = await portalPluginCatalogState(env, { developer: false });
assert.equal(memberCatalog.some(plugin => plugin.id === "qqai.community"), false, "ordinary users must not see disabled plugins");
assert.equal(memberCatalog.some(plugin => plugin.id === "qqai.automation" && plugin.enabled === true), true);
assert.equal(memberCatalog.some(plugin => plugin.portal.developerOnly), false);

console.log("verify-portal-plugin-state: ok");
