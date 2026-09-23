import assert from "node:assert/strict";
import fs from "node:fs";
import portalWorker from "./worker.js";
import {
  classifyPortalAuthFailure,
  createPortalAccountBinding,
  createPortalAdminAccountBinding,
  getPortalSession,
  portalAdminCredentialConfig,
  portalEnvironmentWithManagedDeveloperIds,
  readPortalManagedDeveloperIds,
  resolvePortalPasswordLogin,
  readPortalAccountByQq,
  readPortalAccountByUsername,
  validatePortalLoginUsername,
  validatePortalUsername,
  writePortalManagedDeveloperIds
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


await assert.rejects(
  () => createPortalAdminAccountBinding(env, { qq: "123456789" }),
  error => error?.code === "ADMIN_QQ_ALREADY_BOUND_TO_USER"
);
assert.equal((await readPortalAccountByUsername(env, "RayAdmin")).qq, "123456789", "admin bootstrap must preserve an existing ordinary account binding");
assert.equal((await readPortalAccountByQq(env, "123456789")).normalizedUsername, "rayadmin", "admin bootstrap must not promote an existing ordinary account");

const adminEnv = { DB: new FakeD1() };
const admin = await createPortalAdminAccountBinding(adminEnv, { qq: "222333444" });
assert.equal(admin.username, "admin");
assert.equal(admin.normalizedUsername, "admin");
assert.equal((await readPortalAccountByUsername(adminEnv, "ADMIN")).qq, "222333444");
assert.equal((await readPortalAccountByQq(adminEnv, "222333444")).normalizedUsername, "admin");
await assert.rejects(
  () => createPortalAdminAccountBinding(adminEnv, { qq: "987654321" }),
  error => error?.code === "ADMIN_ACCOUNT_ALREADY_BOUND"
);

assert.equal(portalAdminCredentialConfig({}).mode, "legacy");
assert.equal(portalAdminCredentialConfig({ PORTAL_ADMIN_USERNAME: "owner-r2", PORTAL_ADMIN_PASSWORD: "a-secure-admin-password" }).mode, "configured");
assert.equal(portalAdminCredentialConfig({ PORTAL_ADMIN_USERNAME: "owner-r2" }).mode, "invalid", "setting only one admin credential must fail closed");
assert.equal(portalAdminCredentialConfig({ PORTAL_ADMIN_USERNAME: "root", PORTAL_ADMIN_PASSWORD: "a-secure-admin-password" }).mode, "invalid", "reserved names must not be accepted as custom admin usernames");

await writePortalManagedDeveloperIds(adminEnv, ["555555555", "666666666", "555555555"]);
assert.deepEqual(await readPortalManagedDeveloperIds(adminEnv), ["555555555", "666666666"], "managed Developer QQ values must be normalized and deduplicated");
const overlaidEnv = await portalEnvironmentWithManagedDeveloperIds({ DB: adminEnv.DB, DEVELOPER_IDS: "111111111", ROOT_QQ_IDS: "222222222" });
assert.equal(overlaidEnv.qqaiStaticDeveloperIds, "111111111,222222222");
assert.equal(overlaidEnv.DEVELOPER_IDS, "111111111,222222222,555555555,666666666", "runtime developer checks must include managed IDs without hiding static IDs");
await assert.rejects(
  () => writePortalManagedDeveloperIds(adminEnv, ["not-a-qq"]),
  error => error?.code === "DEVELOPER_QQ_INVALID"
);

const envAdmin = {
  ...adminEnv,
  PORTAL_ADMIN_USERNAME: "Ray-Owner-42",
  PORTAL_ADMIN_PASSWORD: "DeploymentAdminPassword2026"
};
const preservedAdminPassword = "legacy-password-hash-must-not-be-used";
envAdmin.DB.map.set("portal_auth_password:222333444", preservedAdminPassword);
const envAdminLogin = await resolvePortalPasswordLogin(envAdmin, "ray-owner-42", "DeploymentAdminPassword2026");
assert.equal(envAdminLogin.source, "environment");
assert.equal(envAdminLogin.account.qq, "222333444");
assert.equal(envAdminLogin.passwordMatches, true);
assert.equal((await resolvePortalPasswordLogin(envAdmin, "admin", "DeploymentAdminPassword2026")).account, null, "custom environment admin username must not also accept the default admin alias");
assert.equal(envAdmin.DB.map.get("portal_auth_password:222333444"), preservedAdminPassword, "environment admin login must leave legacy hash untouched");
await createPortalAccountBinding(envAdmin, { qq: "777777777", username: "Ray-Owner-42" });
assert.equal((await resolvePortalPasswordLogin(envAdmin, "Ray-Owner-42", "DeploymentAdminPassword2026")).errorCode, "ADMIN_USERNAME_COLLISION", "environment admin auth must reject a collision with an existing ordinary account");

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
assert.match(loginBlock, /resolvePortalPasswordLogin/);
assert.doesNotMatch(loginBlock, /payload\.qq/);
assert.match(loginBlock, /username: account\.username/);
assert.doesNotMatch(worker, /PORTAL_DEVELOPER_USERNAME/);
assert.doesNotMatch(worker, /PORTAL_DEVELOPER_INITIAL_PASSWORD/);
assert.doesNotMatch(worker, /developerPortalBootstrapSecrets|developerPortalBootstrapPolicy|DEVELOPER_BOOTSTRAP_SECRET/);

const sessionFailDb = new FakeD1({ failWritePrefix: "portal_session:" });
const registerResponse = await portalWorker.fetch(new Request("https://aibot.ray2025.com/api/auth/register", {
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
const originalAdminHash = sessionFailDb.map.get("portal_auth_password:123456789");
const repeatRegistrationResponse = await portalWorker.fetch(new Request("https://aibot.ray2025.com/api/auth/register", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    accountType: "developer",
    qq: "123456789",
    username: "admin",
    password: "A-Different-Admin-Password-2026",
    remember: true
  })
}), {
  DB: sessionFailDb,
  DEVELOPER_IDS: "123456789"
}, { waitUntil() {}, passThroughOnException() {} });
assert.equal(repeatRegistrationResponse.status, 409, "admin re-registration must be rejected after bootstrap");
assert.equal(sessionFailDb.map.get("portal_auth_password:123456789"), originalAdminHash, "re-registration must not overwrite the stored admin password");

const staleSessionDb = new FakeD1();
const staleToken = "stale-developer-session";
staleSessionDb.map.set("portal_session:" + staleToken, JSON.stringify({
  qq: "123456789",
  username: "admin",
  group: "",
  groupId: "",
  token: staleToken,
  role: "member",
  permissions: { developer: false, aiAdmin: false, groupOps: false },
  persistent: true,
  idleTtlMs: 3600000,
  absoluteTtlMs: 86400000,
  createdAt: Date.now(),
  lastActivityAt: Date.now(),
  expiresAt: Date.now() + 3600000,
  absoluteExpiresAt: Date.now() + 86400000
}));
const refreshedSession = await getPortalSession({ DB: staleSessionDb, DEVELOPER_IDS: "123456789" }, staleToken, { touch: false });
assert.equal(refreshedSession.role, "developer", "developer authority must refresh from current deployment config");
assert.equal(refreshedSession.permissions.developer, true, "stale session permission snapshots must not hide developer features");
assert.equal(refreshedSession.permissions.aiAdmin, true);
assert.equal(refreshedSession.permissions.groupOps, true);

const adminSessionDb = new FakeD1();
const adminSessionToken = "reserved-admin-session";
adminSessionDb.map.set("portal_session:" + adminSessionToken, JSON.stringify({
  qq: "123456789",
  username: "admin",
  group: "",
  groupId: "",
  token: adminSessionToken,
  role: "member",
  permissions: { developer: false, aiAdmin: false, groupOps: false },
  persistent: true,
  idleTtlMs: 3600000,
  absoluteTtlMs: 86400000,
  createdAt: Date.now(),
  lastActivityAt: Date.now(),
  expiresAt: Date.now() + 3600000,
  absoluteExpiresAt: Date.now() + 86400000
}));
const adminSessionWithoutVars = await getPortalSession({ DB: adminSessionDb }, adminSessionToken, { touch: false });
assert.equal(adminSessionWithoutVars.role, "developer", "reserved admin account must retain Developer / Root authority after successful bootstrap");
assert.equal(adminSessionWithoutVars.permissions.developer, true, "reserved admin must be able to manage global plugins even if Dashboard identity vars are later absent");
assert.equal(adminSessionWithoutVars.permissions.aiAdmin, true);
assert.equal(adminSessionWithoutVars.permissions.groupOps, true);

const ordinarySessionDb = new FakeD1();
const ordinarySessionToken = "ordinary-account-session";
ordinarySessionDb.map.set("portal_session:" + ordinarySessionToken, JSON.stringify({
  qq: "555555555",
  username: "rayuser",
  group: "",
  groupId: "",
  token: ordinarySessionToken,
  role: "developer",
  permissions: { developer: true, aiAdmin: true, groupOps: true },
  persistent: true,
  idleTtlMs: 3600000,
  absoluteTtlMs: 86400000,
  createdAt: Date.now(),
  lastActivityAt: Date.now(),
  expiresAt: Date.now() + 3600000,
  absoluteExpiresAt: Date.now() + 86400000
}));
const ordinarySessionWithoutVars = await getPortalSession({ DB: ordinarySessionDb }, ordinarySessionToken, { touch: false });
assert.equal(ordinarySessionWithoutVars.role, "member", "ordinary accounts must not inherit stale developer authority");
assert.equal(ordinarySessionWithoutVars.permissions.developer, false);

const adminDeveloperApiResponse = await portalWorker.fetch(new Request("https://aibot.ray2025.com/api/portal/system/developers", {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminSessionToken}` },
  body: JSON.stringify({ ids: ["888888888", "999999999"] })
}), { DB: adminSessionDb }, { waitUntil() {}, passThroughOnException() {} });
assert.equal(adminDeveloperApiResponse.status, 200, "system admin session must be allowed to manage Developer QQs");
assert.deepEqual((await adminDeveloperApiResponse.json()).managedIds, ["888888888", "999999999"]);

const ordinaryDeveloperApiResponse = await portalWorker.fetch(new Request("https://aibot.ray2025.com/api/portal/system/developers", {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${ordinarySessionToken}` },
  body: JSON.stringify({ ids: ["777777777"] })
}), { DB: ordinarySessionDb }, { waitUntil() {}, passThroughOnException() {} });
assert.equal(ordinaryDeveloperApiResponse.status, 403, "ordinary account session must not be allowed to add Developer QQs");
assert.equal(ordinarySessionDb.map.has("portal_system_developer_ids"), false);

const configuredAdminDb = new FakeD1();
await createPortalAdminAccountBinding({ DB: configuredAdminDb }, { qq: "333444555" });
const configuredAdminLegacyHash = "stored-hash-that-must-remain-unchanged";
configuredAdminDb.map.set("portal_auth_password:333444555", configuredAdminLegacyHash);
const configuredAdminResponse = await portalWorker.fetch(new Request("https://aibot.ray2025.com/api/auth/login-password", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username: "Ray-Worker-Admin", password: "WorkerAdminPassword-Only" })
}), {
  DB: configuredAdminDb,
  PORTAL_ADMIN_USERNAME: "Ray-Worker-Admin",
  PORTAL_ADMIN_PASSWORD: "WorkerAdminPassword-Only"
}, { waitUntil() {}, passThroughOnException() {} });
assert.equal(configuredAdminResponse.status, 200, "deployment credentials must authenticate as the existing D1 admin account");
assert.equal((await configuredAdminResponse.json()).username, "Ray-Worker-Admin");
assert.match(configuredAdminResponse.headers.get("Set-Cookie") || "", /qqai_session=/);
assert.equal(configuredAdminDb.map.get("portal_auth_password:333444555"), configuredAdminLegacyHash, "environment login must preserve the existing D1 password hash");

const firstEnvAdminDb = new FakeD1();
const firstEnvAdminPassword = "FirstDeploymentAdminPassword2026";
const firstEnvAdminConfig = {
  DB: firstEnvAdminDb,
  DEVELOPER_IDS: "444555666",
  PORTAL_ADMIN_USERNAME: "deployment-owner",
  PORTAL_ADMIN_PASSWORD: firstEnvAdminPassword
};
const firstEnvAdminResponse = await portalWorker.fetch(new Request("https://aibot.ray2025.com/api/auth/register", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ accountType: "developer", qq: "444555666", username: "admin", password: firstEnvAdminPassword })
}), firstEnvAdminConfig, { waitUntil() {}, passThroughOnException() {} });
assert.equal(firstEnvAdminResponse.status, 200);
assert.equal(firstEnvAdminDb.map.has("portal_auth_password:444555666"), false, "environment-managed admin bootstrap must never persist its secret in D1");
assert.equal(JSON.parse(firstEnvAdminDb.map.get("portal_account_username:admin")).qq, "444555666");
const repeatEnvAdminResponse = await portalWorker.fetch(new Request("https://aibot.ray2025.com/api/auth/register", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ accountType: "developer", qq: "444555666", username: "admin", password: firstEnvAdminPassword })
}), firstEnvAdminConfig, { waitUntil() {}, passThroughOnException() {} });
assert.equal(repeatEnvAdminResponse.status, 409, "environment-managed admin bootstrap must be one-time");
assert.equal(firstEnvAdminDb.map.has("portal_auth_password:444555666"), false, "repeat bootstrap must leave D1 credentials unchanged");

console.log("verify-portal-account-auth: ok");
