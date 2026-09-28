import assert from "node:assert/strict";
import fs from "node:fs";
import {
  STORAGE_CONNECTOR_TYPES,
  namespacedStorageKey,
  normalizeStorageConnector,
  normalizeStoragePurposes
} from "./src/v4/public/storage-registry.js";
import { portalPrincipal, qqOpenPrincipal } from "./src/v4/public/resource-tickets.js";
import { privateSettingsMenu } from "./src/v4/public/private-settings.js";
import { resourceConnectPage } from "./src/v4/portal/resource-page.js";
import { USER_PERSISTENCE_POLICY } from "./src/v4/public/user-persistence.js";

const d1 = normalizeStorageConnector({
  id: "my-d1",
  type: "cloudflare_d1",
  ownerPrincipalId: "qq:3569028262",
  label: "我的 D1",
  accountId: "0123456789abcdef0123456789abcdef",
  resourceId: "11111111-2222-3333-4444-555555555555",
  purposes: ["settings", "memory", "unknown"]
});
assert.equal(d1.type, "cloudflare_d1");
assert.equal(d1.ownerPrincipalId, "qq:3569028262");
assert.deepEqual(d1.purposes, ["settings", "memory"]);
assert.deepEqual(STORAGE_CONNECTOR_TYPES, ["cloudflare_d1", "cloudflare_kv"]);
assert.deepEqual(normalizeStoragePurposes(["plugin_data", "plugin_data", "chat_history"]), ["plugin_data", "chat_history"]);
assert.equal(
  namespacedStorageKey("qq:3569028262", "memory:abc"),
  "qqaibot:v4:qq:3569028262:memory:abc"
);
assert.throws(() => normalizeStorageConnector({
  id: "bad",
  type: "unknown",
  ownerPrincipalId: "qq:1",
  accountId: "x",
  resourceId: "y"
}), /TYPE_INVALID/);

assert.equal(portalPrincipal({ qq: "3569028262" }), "qq:3569028262");
assert.equal(portalPrincipal({ systemAdmin: true, qq: "system-admin" }), "");
assert.equal(qqOpenPrincipal("OPENID_ABC"), "qqopen:OPENID_ABC");
assert.equal(USER_PERSISTENCE_POLICY.controlPlane, "platform_d1");
assert.equal(USER_PERSISTENCE_POLICY.userContent, "user_storage_required");
assert.equal(USER_PERSISTENCE_POLICY.fallback, "none");

const menu = privateSettingsMenu({ aiCount: 2, storageCount: 1, persistenceReady: true, developer: true });
assert.match(menu, /AI 服務：2 個/);
assert.match(menu, /資料儲存：1 個/);
assert.match(menu, /長期保存：已啟用/);
assert.match(menu, /!資料庫 D1/);
assert.match(menu, /!白名單/);

const page = resourceConnectPage();
assert.match(page, /AIBot Secure Connect/);
assert.match(page, /Cloudflare D1/);
assert.match(page, /Cloudflare KV/);
assert.match(page, /type="password"/);
assert.doesNotMatch(page, /<select\b/i, "secure resource page must use custom choices, not native select");
assert.doesNotMatch(page, /localStorage|sessionStorage/i, "secrets/tickets must not be copied into browser storage");

const storageSource = fs.readFileSync("src/v4/public/storage-registry.js", "utf8");
assert.match(storageSource, /\/storage\/kv\/namespaces\//);
assert.doesNotMatch(storageSource, /\/workers\/namespaces\//, "deprecated KV API path must not be used");
assert.match(storageSource, /\/d1\/database\//);
assert.match(storageSource, /Authorization: `Bearer/);
assert.match(storageSource, /qqaibot_kv/);

const apiSource = fs.readFileSync("src/v4/portal/resources-api.js", "utf8");
assert.match(apiSource, /getPortalSession/);
assert.match(apiSource, /qqai_session/);
assert.match(apiSource, /consumeResourceInputTicket/);
assert.match(apiSource, /upsertProviderAccount/);
assert.match(apiSource, /upsertStorageConnector/);
assert.match(apiSource, /userPersistenceState/);

const runtime = fs.readFileSync("src/v4/qqopen/runtime.js", "utf8");
const privateIntercept = runtime.indexOf("const privateSettings = await handleV4PrivateSettingsMessage");
const bridgeSend = runtime.indexOf("await this.sendApplicationReplies(message, payload, deliveryKey)");
assert.ok(privateIntercept > 0 && bridgeSend > privateIntercept, "QQ private settings must intercept before the general chat bridge");
assert.match(runtime, /lastApplicationKind = "private_settings"/);

const worker = fs.readFileSync("worker.js", "utf8");
assert.match(worker, /handleV4ResourcePortalApi/);
assert.match(worker, /url\.pathname === '\/connect-resource'/);
assert.match(worker, /resourceConnectPage/);

console.log("verify-v4-user-resources: ok");
