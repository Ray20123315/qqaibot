import assert from "node:assert/strict";
import fs from "node:fs";
import portalWorker from "./worker.js";
import {
  classifyPortalAuthFailure,
  createPortalAccountBinding,
  createPortalAdminAccountBinding,
  readPortalAccountByQq,
  readPortalAccountByUsername,
  validatePortalLoginUsername,
  validatePortalUsername
} from "./src/portal/auth.js";

class FakeD1 {
  constructor({ failWritePrefix = "" } = {}) { this.map = new Map(); this.failWritePrefix = failWritePrefix; }
  prepare(sql) {
    const db = this;
    return {
      bind(...args) {
        return {
          async first() {
            if (!/^SELECT value FROM kv_store WHERE key = \?$/.test(sql)) throw new Error("unexpected first SQL: " + sql);
            return db.map.has(args[0]) ? { value: db.map.get(args[0]) } : null;
          },
          async run() {
            if (db.failWritePrefix && String(args[0] || "").startsWith(db.failWritePrefix)) {
              throw new Error("D1_ERROR: simulated write failure for " + db.failWritePrefix);
            }
            if (sql.includes("ON CONFLICT(key) DO NOTHING")) {
              if (db.map.has(args[0])) return { success: true, meta: { changes: 0 } };
              db.map.set(args[0], args[1]);
              return { success: true, meta: { changes: 1 } };
            }
            if (sql.includes("ON CONFLICT(key) DO UPDATE SET value = excluded.value")) {
              db.map.set(args[0], args[1]);
              return { success: true, meta: { changes: 1 } };
            }
            if (/^DELETE FROM kv_store WHERE key = \?$/.test(sql)) {
              const existed = db.map.delete(args[0]);
              return { success: true, meta: { changes: existed ? 1 : 0 } };
            }
            throw new Error("unexpected run SQL: " + sql);
          }
        };
      }
    };
  }
}

assert.equal(validatePortalUsername("RayAdmin").ok, true);
assert.equal(validatePortalUsername("Ray.Admin_2026").normalized, "ray.admin_2026");
assert.equal(validatePortalUsername("12345678").ok, false, "username must not be a numeric QQID lookalike");
assert.equal(validatePortalUsername("admin").ok, false, "admin must stay reserved from ordinary registration");
assert.equal(validatePortalLoginUsername("admin").ok, true, "reserved admin must be accepted for login");
assert.equal(validatePortalLoginUsername("root").ok, false, "other reserved names must not become system logins");
assert.equal(validatePortalUsername("a b").ok, false);

assert.equal(classifyPortalAuthFailure(
  Object.assign(new Error("Pbkdf2 failed: iteration counts above 100000 are not supported (requested 120000)."), { code: 9 }),
  "credential_persistence"
).code, "AUTH_PASSWORD_DERIVATION_UNSUPPORTED");
assert.equal(classifyPortalAuthFailure(
  Object.assign(new Error("auth write failed after 3 attempts"), {
    code: "PORTAL_AUTH_STORAGE_UNAVAILABLE",
    cause: new Error("Your account has exceeded D1's free tier daily row write limit.")
  }),
  "credential_persistence"
).code, "AUTH_D1_DAILY_LIMIT");
assert.equal(classifyPortalAuthFailure(
  Object.assign(new Error("auth read failed after 3 attempts"), {
    code: "PORTAL_AUTH_STORAGE_UNAVAILABLE",
    cause: new Error("D1_ERROR: no such table: kv_store")
  }),
  "account_binding"
).code, "AUTH_SCHEMA_MISSING");
assert.equal(classifyPortalAuthFailure(
  Object.assign(new Error("Missing D1 binding for Portal authentication"), {
    code: "PORTAL_AUTH_STORAGE_UNAVAILABLE"
  }),
  "account_binding"
).code, "AUTH_DB_BINDING_MISSING");

const env = { DB: new FakeD1() };
const first = await createPortalAccountBinding(env, { qq: "123456789", username: "RayAdmin" });
assert.equal(first.qq, "123456789");
assert.equal(first.normalizedUsername, "rayadmin");
assert.equal((await readPortalAccountByUsername(env, "RAYADMIN")).qq, "123456789");
assert.equal((await readPortalAccountByQq(env, "123456789")).normalizedUsername, "rayadmin");

const same = await createPortalAccountBinding(env, { qq: "123456789", username: "rayadmin" });
assert.equal(same.qq, "123456789", "same identity+username activation must be idempotent");
await assert.rejects(
  () => createPortalAccountBinding(env, { qq: "987654321", username: "RayAdmin" }),
  error => error?.code === "USERNAME_TAKEN"
);
await assert.rejects(
  () => createPortalAccountBinding(env, { qq: "123456789", username: "DifferentName" }),
  error => error?.code === "ACCOUNT_ALREADY_ACTIVATED"
);


const admin = await createPortalAdminAccountBinding(env, { qq: "123456789" });
assert.equal(admin.username, "admin");
assert.equal(admin.normalizedUsername, "admin");
assert.equal((await readPortalAccountByUsername(env, "ADMIN")).qq, "123456789");
assert.equal((await readPortalAccountByQq(env, "123456789")).normalizedUsername, "admin");
assert.equal(await readPortalAccountByUsername(env, "RayAdmin"), null, "developer migration must remove the old custom username mapping");
await assert.rejects(
  () => createPortalAdminAccountBinding(env, { qq: "987654321" }),
  error => error?.code === "ADMIN_ACCOUNT_ALREADY_BOUND"
);

const worker = fs.readFileSync("worker.js", "utf8");
const registerStart = worker.indexOf("url.pathname === '/api/auth/register'");
const registerEnd = worker.indexOf("url.pathname === '/api/auth/verify-code'", registerStart);
const registerBlock = worker.slice(registerStart, registerEnd);
assert(registerStart >= 0 && registerEnd > registerStart);
assert.match(registerBlock, /const accountType = String\(payload\.accountType/);
assert.match(registerBlock, /const requestedDeveloper = accountType === "developer"/);
assert.match(registerBlock, /const developerAuthorized = isDeveloperId\(env, qq\)/);
assert.match(registerBlock, /DEVELOPER_ID_NOT_AUTHORIZED/);
assert.match(registerBlock, /const developerDirect = requestedDeveloper && developerAuthorized/);
assert.doesNotMatch(registerBlock, /developerPortalBootstrapPolicy|setupKey|PORTAL_AUTH_SECRET|ONEBOT_ACCESS_TOKEN/);
assert.match(registerBlock, /developerDirect \? null : validatePortalUsername\(payload\.username\)/);
assert.match(registerBlock, /verifyPortalVerificationCode/);
assert.match(registerBlock, /developer_admin_password_setup/);
assert.match(registerBlock, /createPortalAdminAccountBinding/);
assert.match(registerBlock, /createPortalAccountBinding/);
assert.match(registerBlock, /createPortalPasswordRecord/);
assert.match(registerBlock, /createPortalSession/);

const directCodeStart = worker.indexOf("url.pathname === '/api/auth/verify-code'");
const directCodeEnd = worker.indexOf("url.pathname === '/api/auth/reset-password'", directCodeStart);
const directCodeBlock = worker.slice(directCodeStart, directCodeEnd);
assert.match(directCodeBlock, /DIRECT_ID_LOGIN_DISABLED/);
assert.match(directCodeBlock, /410/);

const loginStart = worker.indexOf("url.pathname === '/api/auth/login-password'");
const loginEnd = worker.indexOf("url.pathname === '/api/auth/logout'", loginStart);
const loginBlock = worker.slice(loginStart, loginEnd);
assert.match(loginBlock, /payload\.username/);
assert.match(loginBlock, /validatePortalLoginUsername/);
assert.match(loginBlock, /readPortalAccountByUsername/);
assert.doesNotMatch(loginBlock, /payload\.qq/);
assert.match(loginBlock, /username: account\.username/);
assert.doesNotMatch(worker, /PORTAL_DEVELOPER_USERNAME/);
assert.doesNotMatch(worker, /PORTAL_DEVELOPER_INITIAL_PASSWORD/);
assert.doesNotMatch(worker, /developerPortalBootstrapSecrets|developerPortalBootstrapPolicy|DEVELOPER_BOOTSTRAP_SECRET/);

const sessionFailDb = new FakeD1({ failWritePrefix: "portal_session:" });
const registerResponse = await portalWorker.fetch(new Request("https://qqai.ray2025.com/api/auth/register", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    accountType: "developer",
    qq: "123456789",
    username: "admin",
    password: "Str0ngAdmin!2026",
    remember: true
  })
}), {
  DB: sessionFailDb,
  DEVELOPER_IDS: "123456789"
}, { waitUntil() {}, passThroughOnException() {} });
const registerPayload = await registerResponse.json();
assert.equal(registerResponse.status, 200);
assert.equal(registerPayload.ok, true);
assert.equal(registerPayload.code, "ACCOUNT_ACTIVATED_LOGIN_REQUIRED");
assert.equal(registerPayload.redirect, "/login?activated=1");
assert.match(String(registerPayload.failureId || ""), /^[0-9a-f-]{20,}$/i);
assert(sessionFailDb.map.has("portal_auth_password:123456789"), "password must remain persisted when session creation fails");
assert.equal(JSON.parse(sessionFailDb.map.get("portal_account_username:admin")).username, "admin");

console.log("verify-portal-account-auth: ok");
