import assert from "node:assert/strict";
import fs from "node:fs";
import { webcrypto } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { getEffectivePermissions, listExplicitPrivateAccess, setExplicitPermission, setPrivateAccessMode } from "./src/core/permissions.js";
import { dbAppendJsonArrayCapped, dbCompareAndSwapStrict, dbDel, dbDeletePrefix, dbGet, dbPut } from "./src/data/store.js";

if (!globalThis.crypto) globalThis.crypto = webcrypto;

class SqliteD1 {
  constructor() {
    this.sqlite = new DatabaseSync(":memory:");
    this.sqlite.exec("CREATE TABLE kv_store (key TEXT PRIMARY KEY COLLATE NOCASE, value TEXT NOT NULL)");
  }
  prepare(sql) {
    const database = this.sqlite;
    return {
      parameters: [],
      bind(...parameters) { this.parameters = parameters; return this; },
      async first() { return database.prepare(sql).get(...this.parameters) || null; },
      async all() { return { results: database.prepare(sql).all(...this.parameters) }; },
      async run() {
        const result = database.prepare(sql).run(...this.parameters);
        return { success: true, meta: { changes: Number(result.changes || 0) } };
      }
    };
  }
  set(key, value) { this.sqlite.prepare("INSERT INTO kv_store (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value); }
  get(key) { return this.sqlite.prepare("SELECT value FROM kv_store WHERE key = ?").get(key)?.value ?? null; }
  close() { this.sqlite.close(); }
}

const DB = new SqliteD1();
const env = { DB };
await setPrivateAccessMode(env, "12345", "commands", "90000", "77777");
assert.deepEqual(await listExplicitPrivateAccess(env), [{ qq: "12345", privateAccess: "commands" }]);
assert.deepEqual(JSON.parse(DB.get("private_access:index")), ["12345"]);

await setPrivateAccessMode(env, "12345", "full", "90000", "77777");
assert.deepEqual(await listExplicitPrivateAccess(env), [{ qq: "12345", privateAccess: "full" }]);
await setPrivateAccessMode(env, "12345", "none", "90000", "77777");
assert.deepEqual(await listExplicitPrivateAccess(env), []);
assert.deepEqual(JSON.parse(DB.get("private_access:index")), []);
DB.set("private_access:67890", "full");
assert.deepEqual(await listExplicitPrivateAccess(env), [{ qq: "67890", privateAccess: "full" }], "legacy private access entries must appear even before their index is backfilled");

await setExplicitPermission(env, "77777", "54321", "group_ops", true, "90000");
assert.equal(DB.get("permission:77777:54321:group_ops"), "true");
assert.deepEqual(JSON.parse(DB.get("permission_explicit_index:77777")), ["54321"]);
const globalAudit = JSON.parse(DB.get("audit:system:global"));
const privateAudit = globalAudit.filter(item => item.action?.startsWith("set:private_access:"));
assert.equal(privateAudit.length, 3);
assert.ok(privateAudit.every(item => item.actorId === "90000" && item.scope === "global" && item.groupId === "77777"));
assert.ok(globalAudit.some(item => item.type === "permission" && item.actorId === "90000" && item.targetId === "54321" && item.action === "grant:group_ops"));
DB.set("admin_auth:24680", "true");
assert.equal((await getEffectivePermissions(env, "77777", "24680", "member", false)).aiAdmin, false, "unscoped legacy admin grants must be disabled by default");
assert.equal((await getEffectivePermissions({ ...env, ALLOW_LEGACY_ADMIN_AUTH: "true" }, "77777", "24680", "member", false)).aiAdmin, true, "legacy grants remain available only as an explicit migration switch");
const casResults = await Promise.all(Array.from({ length: 20 }, (_, index) => dbCompareAndSwapStrict(env, "cas:test", null, String(index))));
assert.equal(casResults.filter(Boolean).length, 1, "only one writer may create a key with an empty-value compare-and-swap");
await Promise.all(Array.from({ length: 40 }, (_, index) => dbAppendJsonArrayCapped(env, "append:test", { index }, 100)));
assert.equal(JSON.parse(DB.get("append:test")).length, 40, "concurrent JSON appends must not lose audit/index entries");
DB.close();

const brokenDb = { prepare() { return { bind() { return this; }, async first() { throw new Error("unavailable"); }, async run() { throw new Error("unavailable"); } }; } };
const originalConsoleError = console.error;
console.error = () => {};
try {
  await assert.rejects(dbGet({ DB: brokenDb }, "read-fails"), { code: "D1_STORAGE_UNAVAILABLE" });
  await assert.rejects(dbPut({ DB: brokenDb }, "write-fails", "x"), { code: "D1_STORAGE_UNAVAILABLE" });
  await assert.rejects(dbDel({ DB: brokenDb }, "delete-fails"), { code: "D1_STORAGE_UNAVAILABLE" });
  await assert.rejects(dbDeletePrefix({ DB: brokenDb }, "prefix:"), { code: "D1_STORAGE_UNAVAILABLE" });
} finally {
  console.error = originalConsoleError;
}

const portal = fs.readFileSync("src/portal/runtime.js", "utf8");
const auth = fs.readFileSync("src/portal/auth.js", "utf8");
const worker = fs.readFileSync("worker.js", "utf8");
assert.match(portal, /私聊权限（全站生效）/);
assert.ok(portal.includes("/root/private-access"));
assert.ok(portal.includes("privateAccess:$('privateAccessMode').value"));
assert.ok(portal.includes("function themePreference(){return document.documentElement.dataset.themePreference||'system'}"));
assert.ok(portal.includes("prefers-color-scheme: dark"));
assert.ok(portal.includes("bindSystemThemeChanges()"));
assert.ok(portal.includes("e.key==='Tab'"));
assert.ok(portal.includes("returnFocus.focus()"));
assert.ok(portal.includes("@media(forced-colors:active)"));
assert.ok(portal.includes("aria-labelledby','qqaiModalTitle'"));
assert.ok(portal.includes("code: \"CSRF_REJECTED\""));
assert.ok(auth.includes("Strict-Transport-Security\": \"max-age=31536000\""));
assert.ok(worker.includes("Strict-Transport-Security\": \"max-age=31536000\""));

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
assert.match(pkg.scripts.check, /verify-permission-ui-accessibility\.mjs/);
console.log("verify-permission-ui-accessibility: ok");
