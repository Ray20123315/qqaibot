import assert from "node:assert/strict";
import fs from "node:fs";
import { webcrypto } from "node:crypto";
import { DEFAULTS } from "./src/config/runtime.js";
import {
  createPortalSession,
  createPortalRememberToken,
  restorePortalRememberToken,
  revokePortalRememberToken,
  bytesToBase64Url,
  createPortalPasswordRecord,
  derivePortalPassword,
  getPortalSession,
  normalizePortalAdminUsername,
  normalizePortalManagedDeveloperIds,
  needsPortalPasswordRehash,
  portalAdminCredentialConfig,
  portalEnvironmentWithManagedDeveloperIds,
  portalTemporaryAdminCredentialConfig,
  readPortalManagedDeveloperIds,
  rehashPortalPasswordIfNeeded,
  sendPortalVerificationMessage,
  verifyPortalAdminCredentials,
  verifyPortalTemporaryAdminCredentials,
  writePortalManagedDeveloperIds
} from "./src/portal/auth.js";

if (!globalThis.crypto) globalThis.crypto = webcrypto;

class MemoryD1 {
  values = new Map();

  prepare(sql) {
    const statement = {
      parameters: [],
      bind(...parameters) { this.parameters = parameters; return this; },
      async first() {
        if (!/SELECT value FROM kv_store WHERE key = \?/i.test(sql)) throw new Error(`Unexpected query: ${sql}`);
        const value = this.values.get(this.parameters[0]);
        return value === undefined ? null : { value };
      },
      async run() {
        if (/INSERT INTO kv_store/i.test(sql)) {
          this.values.set(this.parameters[0], this.parameters[1]);
          return { success: true, meta: { changes: 1 } };
        }
        if (/UPDATE kv_store SET value = \? WHERE key = \? AND value = \?/i.test(sql)) {
          const [value, key, expected] = this.parameters;
          if (this.values.get(key) !== expected) return { success: true, meta: { changes: 0 } };
          this.values.set(key, value);
          return { success: true, meta: { changes: 1 } };
        }
        if (/DELETE FROM kv_store/i.test(sql)) {
          const deleted = this.values.delete(this.parameters[0]);
          return { success: true, meta: { changes: deleted ? 1 : 0 } };
        }
        throw new Error(`Unexpected query: ${sql}`);
      }
    };
    statement.values = this.values;
    return statement;
  }
}

const password = "a-long-random-test-password-482!";
const adminEnv = { PORTAL_ADMIN_USERNAME: "Ops.Root", PORTAL_ADMIN_PASSWORD: password };
assert.equal(portalAdminCredentialConfig({}).mode, "unconfigured");
assert.equal(portalAdminCredentialConfig({ PORTAL_ADMIN_USERNAME: "Ops.Root" }).mode, "invalid");
assert.equal(portalAdminCredentialConfig({ PORTAL_ADMIN_USERNAME: "123456", PORTAL_ADMIN_PASSWORD: password }).mode, "invalid");
assert.equal(portalAdminCredentialConfig(adminEnv).mode, "configured");
assert.equal(normalizePortalAdminUsername("  OPS.ROOT "), "ops.root");
assert.equal(verifyPortalAdminCredentials(adminEnv, "ops.root", password).ok, true);
assert.equal(verifyPortalAdminCredentials(adminEnv, "ops.root", `${password}wrong`).ok, false);

const tempNow = Date.parse("2026-09-29T04:30:00+08:00");
const tempExpiry = tempNow + 48 * 60 * 60 * 1000;
const tempAdminEnv = {
  PORTAL_TEMP_ADMIN_USERNAME: "Temp.Root",
  PORTAL_TEMP_ADMIN_PASSWORD: "temporary-system-admin-2026!",
  PORTAL_TEMP_ADMIN_EXPIRES_AT: String(tempExpiry)
};
assert.equal(portalTemporaryAdminCredentialConfig({}, tempNow).mode, "unconfigured");
assert.equal(portalTemporaryAdminCredentialConfig({ ...tempAdminEnv, PORTAL_TEMP_ADMIN_PASSWORD: "" }, tempNow).mode, "invalid");
assert.equal(portalTemporaryAdminCredentialConfig(tempAdminEnv, tempNow).mode, "configured");
assert.equal(portalTemporaryAdminCredentialConfig(tempAdminEnv, tempExpiry + 1).mode, "expired");
assert.equal(verifyPortalTemporaryAdminCredentials(tempAdminEnv, "temp.root", "temporary-system-admin-2026!", tempNow).ok, true);
assert.equal(verifyPortalTemporaryAdminCredentials(tempAdminEnv, "temp.root", "wrong-password-value", tempNow).ok, false);

assert.deepEqual(normalizePortalManagedDeveloperIds(["12345", "67890", "12345"]), ["12345", "67890"]);
assert.throws(() => normalizePortalManagedDeveloperIds(["1234x"]), { code: "DEVELOPER_QQ_INVALID" });
assert.throws(() => normalizePortalManagedDeveloperIds(Array.from({ length: 51 }, (_, index) => String(10000 + index))), { code: "DEVELOPER_QQ_LIMIT" });

const DB = new MemoryD1();
const env = { DB, DEVELOPER_IDS: "11111", ROOT_QQ_IDS: "22222" };
await writePortalManagedDeveloperIds(env, ["33333", "44444"]);
assert.deepEqual(await readPortalManagedDeveloperIds(env), ["33333", "44444"]);
const mergedEnv = await portalEnvironmentWithManagedDeveloperIds(env);
assert.deepEqual(String(mergedEnv.DEVELOPER_IDS).split(",").sort(), ["11111", "22222", "33333", "44444"]);
assert.deepEqual(String(mergedEnv.qqaiStaticDeveloperIds).split(",").sort(), ["11111", "22222"]);

const session = await createPortalSession(env, { systemAdmin: true, username: "Ops.Root", persistent: true });
assert.equal(session.systemAdmin, true);
assert.equal(session.qq, "system-admin");
assert.equal(session.role, "developer");
assert.equal(session.persistent, true);
assert.equal(session.idleTtlMs, DEFAULTS.portalSessionTtlMs);
assert.equal(session.absoluteTtlMs, DEFAULTS.portalSessionAbsoluteTtlMs);
assert.equal(JSON.stringify(session).includes(password), false);
const restored = await getPortalSession(env, session.token, { touch: false });
assert.equal(restored?.systemAdmin, true);
const privilegedQqSession = await createPortalSession(env, { qq: "11111", persistent: true });
assert.equal(privilegedQqSession.role, "developer");
assert.equal(privilegedQqSession.persistent, true, "remember-login must persist the cookie even for developer sessions");
assert.equal(privilegedQqSession.idleTtlMs, DEFAULTS.portalSessionTtlMs);
assert.equal(privilegedQqSession.absoluteTtlMs, DEFAULTS.portalSessionAbsoluteTtlMs);
const privilegedTemporary = await createPortalSession(env, { qq: "11111", persistent: false });
assert.equal(privilegedTemporary.persistent, false, "unchecked remember-login must remain a browser-session cookie");
assert.equal(privilegedTemporary.idleTtlMs, 30 * 60 * 1000);
assert.equal(privilegedTemporary.absoluteTtlMs, 8 * 60 * 60 * 1000);

const remember = await createPortalRememberToken(env, privilegedQqSession);
assert.ok(String(remember?.token || "").length >= 40);
env.DB.values.delete(`portal_session:${privilegedQqSession.token}`);
const restoredRemember = await restorePortalRememberToken(env, remember.token);
assert.equal(restoredRemember?.session?.qq, "11111");
assert.notEqual(restoredRemember?.session?.token, privilegedQqSession.token, "remember credential must rebuild a new server session when the old session record is gone");
assert.equal(restoredRemember?.session?.persistent, true);
assert.ok(Number(restoredRemember?.session?.absoluteExpiresAt || 0) <= Number(remember.expiresAt || 0), "rebuilt session must not outlive the remember credential");
assert.notEqual(restoredRemember?.rememberToken, remember.token, "remember token must rotate after restore");
assert.equal(await restorePortalRememberToken(env, remember.token), null, "used remember token must not be reusable");
assert.equal(await revokePortalRememberToken(env, restoredRemember.rememberToken), true);
assert.equal(await restorePortalRememberToken(env, restoredRemember.rememberToken), null, "revoked remember token must stay invalid");

const { default: worker } = await import("./worker.js");
const portalEnv = {
  DB: new MemoryD1(),
  DEVELOPER_IDS: "11111",
  PORTAL_ADMIN_USERNAME: "Ops.Root",
  PORTAL_ADMIN_PASSWORD: password,
  MY_RATE_LIMITER: { limit: async () => ({ success: true }) }
};
portalEnv.DB.values.set("portal_auth_password:55555", "existing-user-password-record");
portalEnv.DB.values.set("known_groups", JSON.stringify([{ group_id: "12345", group_name: "Unified Admin Test" }]));
portalEnv.DB.values.set("group_whitelist:12345", "true");
const postJson = (path, body, origin = "https://qqai.test", cookie = "") => new Request(`https://qqai.test${path}`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: origin, ...(cookie ? { Cookie: cookie } : {}) },
  body: JSON.stringify(body)
});
const responseSetCookies = response => typeof response.headers.getSetCookie === "function"
  ? response.headers.getSetCookie()
  : [response.headers.get("Set-Cookie") || ""].filter(Boolean);
const cookiePair = (response, name) => {
  const prefix = `${name}=`;
  const raw = responseSetCookies(response).find(value => String(value).startsWith(prefix)) || "";
  return raw ? raw.split(";")[0] : "";
};


const tempPortalEnv = {
  DB: new MemoryD1(),
  PORTAL_TEMP_ADMIN_USERNAME: "Temp.Root",
  PORTAL_TEMP_ADMIN_PASSWORD: "temporary-system-admin-2026!",
  PORTAL_TEMP_ADMIN_EXPIRES_AT: String(Date.now() + 60 * 60 * 1000),
  MY_RATE_LIMITER: { limit: async () => { throw new Error("rate limiter unavailable"); } }
};
const tempLoginResponse = await worker.fetch(postJson("/api/auth/login-password", { username: "temp.root", password: "temporary-system-admin-2026!" }), tempPortalEnv, {});
const tempLogin = await tempLoginResponse.json();
assert.equal(tempLoginResponse.status, 200, JSON.stringify(tempLogin));
assert.equal(tempLogin.systemAdmin, true);
assert.equal(tempLogin.temporary, true);
assert.ok(Number(tempLogin.expiresAt) > Date.now());
assert.match(tempLoginResponse.headers.get("Set-Cookie") || "", /HttpOnly/);
const tempSessionToken = decodeURIComponent(cookiePair(tempLoginResponse, "qqai_session").split("=")[1] || "");
const tempSession = await getPortalSession(tempPortalEnv, tempSessionToken, { touch: false });
assert.equal(tempSession?.systemAdmin, true);
assert.equal(tempSession?.role, "developer");
assert.equal(tempSession?.authMethod, "temporary_environment_admin_password");
const tempSecondResponse = await worker.fetch(postJson("/api/auth/login-password", { username: "temp.root", password: "temporary-system-admin-2026!" }), tempPortalEnv, {});
assert.equal(tempSecondResponse.status, 429, "D1 fallback must rate-limit immediate repeated TEMP admin login");
const expiredTempEnv = {
  DB: new MemoryD1(),
  PORTAL_TEMP_ADMIN_USERNAME: "Temp.Root",
  PORTAL_TEMP_ADMIN_PASSWORD: "temporary-system-admin-2026!",
  PORTAL_TEMP_ADMIN_EXPIRES_AT: String(Date.now() - 1),
  MY_RATE_LIMITER: { limit: async () => ({ success: true }) }
};
const expiredTempResponse = await worker.fetch(postJson("/api/auth/login-password", { username: "temp.root", password: "temporary-system-admin-2026!" }), expiredTempEnv, {});
assert.equal(expiredTempResponse.status, 403);
assert.equal((await expiredTempResponse.json()).code, "TEMP_ADMIN_EXPIRED");

const previewLoginEnv = {
  DB: new MemoryD1(),
  V4_PREVIEW_TEST_LOGIN: "true",
  V4_PREVIEW_TEST_EXPIRES_AT: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  QQ_OPEN_ENABLED: "false",
  MY_RATE_LIMITER: { limit: async () => ({ success: true }) }
};
const previewLoginRequest = new Request("https://feature-v4-public-bot-qqai.ray20123315.workers.dev/api/auth/preview-test-login", {
  method: "POST",
  headers: { Origin: "https://feature-v4-public-bot-qqai.ray20123315.workers.dev" }
});
const previewLoginResponse = await worker.fetch(previewLoginRequest, previewLoginEnv, {});
const previewLogin = await previewLoginResponse.json();
assert.equal(previewLoginResponse.status, 200, JSON.stringify(previewLogin));
assert.equal(previewLogin.systemAdmin, true);
assert.equal(previewLogin.preview, true);
assert.ok(String(previewLogin.resumeToken || "").length >= 40, "Preview login must issue a separate resume token");
assert.ok(Number(previewLogin.resumeExpiresAt) > Date.now());
const previewCookies = responseSetCookies(previewLoginResponse);
assert.equal(previewCookies.some(value => /^qqai_session=/.test(value) && /HttpOnly/.test(value) && /Max-Age=/.test(value)), true, "Preview login must issue a persistent session cookie");
assert.equal(previewCookies.some(value => /^qqai_remember=/.test(value) && /HttpOnly/.test(value) && /Max-Age=/.test(value)), true, "Preview login must issue a separate HttpOnly remember cookie");
const previewSessionCookie = cookiePair(previewLoginResponse, "qqai_session");
const previewRememberCookie = cookiePair(previewLoginResponse, "qqai_remember");
const previewToken = decodeURIComponent(previewSessionCookie.split("=")[1] || "");
const previewSession = await getPortalSession(previewLoginEnv, previewToken, { touch: false });
assert.equal(previewSession?.systemAdmin, true);
assert.equal(previewSession?.role, "developer");
assert.equal(previewSession?.authMethod, "v4_preview_test");

const previewCookieOnlyMe = await worker.fetch(new Request("https://feature-v4-public-bot-qqai.ray20123315.workers.dev/api/portal/me", {
  headers: { Cookie: previewRememberCookie }
}), previewLoginEnv, {});
assert.equal(previewCookieOnlyMe.status, 200, "GET /api/portal/me must restore from the HttpOnly remember cookie when qqai_session is missing");
assert.equal((await previewCookieOnlyMe.clone().json()).session.systemAdmin, true);
const previewRotatedSessionCookie = cookiePair(previewCookieOnlyMe, "qqai_session");
const previewRotatedRememberCookie = cookiePair(previewCookieOnlyMe, "qqai_remember");
assert.match(previewRotatedSessionCookie, /^qqai_session=/);
assert.match(previewRotatedRememberCookie, /^qqai_remember=/);
assert.notEqual(previewRotatedRememberCookie, previewRememberCookie, "server-side /me restore must rotate the remember cookie");

const previewResumeRequest = new Request("https://feature-v4-public-bot-qqai.ray20123315.workers.dev/api/auth/preview-resume", {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: "https://feature-v4-public-bot-qqai.ray20123315.workers.dev" },
  body: JSON.stringify({ resumeToken: previewLogin.resumeToken })
});
const previewResumeResponse = await worker.fetch(previewResumeRequest, previewLoginEnv, {});
const previewResume = await previewResumeResponse.json();
assert.equal(previewResumeResponse.status, 200, JSON.stringify(previewResume));
assert.equal(previewResume.preview, true);
assert.ok(String(previewResume.resumeToken || "").length >= 40);
assert.notEqual(previewResume.resumeToken, previewLogin.resumeToken, "Preview resume token must rotate after use");
assert.match(previewResumeResponse.headers.get("Set-Cookie") || "", /HttpOnly/);
const resumedCookie = cookiePair(previewResumeResponse, "qqai_session");
const resumedMeResponse = await worker.fetch(new Request("https://feature-v4-public-bot-qqai.ray20123315.workers.dev/api/portal/me", { headers: { Cookie: resumedCookie } }), previewLoginEnv, {});
assert.equal(resumedMeResponse.status, 200, "Restored Preview session cookie must authenticate /api/portal/me");
assert.equal((await resumedMeResponse.json()).session.systemAdmin, true);

const reusedPreviewResume = await worker.fetch(previewResumeRequest, previewLoginEnv, {});
assert.equal(reusedPreviewResume.status, 401, "Rotated Preview resume token must not be reusable");

const previewLogout = await worker.fetch(new Request("https://feature-v4-public-bot-qqai.ray20123315.workers.dev/api/auth/logout", {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: "https://feature-v4-public-bot-qqai.ray20123315.workers.dev", Cookie: resumedCookie },
  body: JSON.stringify({ previewResumeToken: previewResume.resumeToken })
}), previewLoginEnv, {});
assert.equal(previewLogout.status, 200);
const revokedPreviewResume = await worker.fetch(new Request("https://feature-v4-public-bot-qqai.ray20123315.workers.dev/api/auth/preview-resume", {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: "https://feature-v4-public-bot-qqai.ray20123315.workers.dev" },
  body: JSON.stringify({ resumeToken: previewResume.resumeToken })
}), previewLoginEnv, {});
assert.equal(revokedPreviewResume.status, 401, "Logout must revoke the Preview resume token");

const previewWrongHost = await worker.fetch(new Request("https://aibot.ray2025.com/api/auth/preview-test-login", { method: "POST" }), previewLoginEnv, {});
assert.equal(previewWrongHost.status, 404, "Preview test login must not work on production host");

const previewExpiredEnv = { ...previewLoginEnv, DB: new MemoryD1(), V4_PREVIEW_TEST_EXPIRES_AT: new Date(Date.now() - 1000).toISOString() };
const previewExpired = await worker.fetch(previewLoginRequest, previewExpiredEnv, {});
assert.equal(previewExpired.status, 403);
assert.equal((await previewExpired.json()).code, "PREVIEW_TEST_LOGIN_EXPIRED");

const previewUnsafeEnv = { ...previewLoginEnv, DB: new MemoryD1(), QQ_OPEN_ENABLED: "true" };
const previewUnsafe = await worker.fetch(previewLoginRequest, previewUnsafeEnv, {});
assert.equal(previewUnsafe.status, 403);
assert.equal((await previewUnsafe.json()).code, "PREVIEW_TEST_LOGIN_UNSAFE");

const loginResponse = await worker.fetch(postJson("/api/auth/login-password", { username: "ops.root", password, remember: true }), portalEnv, {});
const login = await loginResponse.json();
assert.equal(loginResponse.status, 200);
assert.equal(login.systemAdmin, true);
const loginCookies = responseSetCookies(loginResponse);
assert.equal(loginCookies.some(value => /^qqai_session=/.test(value) && /HttpOnly/.test(value) && /Max-Age=/.test(value)), true, "system admin remember-login must issue a persistent session cookie");
assert.equal(loginCookies.some(value => /^qqai_remember=/.test(value) && /HttpOnly/.test(value) && /Max-Age=/.test(value)), true, "system admin remember-login must issue a separate HttpOnly remember cookie");
const originalRememberCookie = cookiePair(loginResponse, "qqai_remember");

const cookieOnlyMe = await worker.fetch(new Request("https://qqai.test/api/portal/me", { headers: { Cookie: originalRememberCookie } }), portalEnv, {});
assert.equal(cookieOnlyMe.status, 200, "server-side /me must restore a remembered admin without the original session cookie");
assert.equal((await cookieOnlyMe.clone().json()).session.systemAdmin, true);
let adminCookie = cookiePair(cookieOnlyMe, "qqai_session");
let rotatedRememberCookie = cookiePair(cookieOnlyMe, "qqai_remember");
assert.match(adminCookie, /^qqai_session=/);
assert.match(rotatedRememberCookie, /^qqai_remember=/);
assert.notEqual(rotatedRememberCookie, originalRememberCookie, "server-side /me restore must rotate the remember cookie");

const recoveredAdminToken = decodeURIComponent(adminCookie.split("=")[1] || "");
portalEnv.DB.values.delete(`portal_session:${recoveredAdminToken}`);
const groupsAfterSessionLoss = await worker.fetch(new Request("https://qqai.test/api/portal/groups", {
  headers: { Cookie: [adminCookie, rotatedRememberCookie].join("; ") }
}), portalEnv, {});
assert.equal(groupsAfterSessionLoss.status, 200, "ordinary Portal APIs must restore from remember instead of racing the UI back to login");
assert.deepEqual((await groupsAfterSessionLoss.clone().json()).groups.map(group => group.groupId), ["12345"]);
const raceRecoveredSessionCookie = cookiePair(groupsAfterSessionLoss, "qqai_session");
const raceRotatedRememberCookie = cookiePair(groupsAfterSessionLoss, "qqai_remember");
assert.match(raceRecoveredSessionCookie, /^qqai_session=/);
assert.match(raceRotatedRememberCookie, /^qqai_remember=/);
adminCookie = raceRecoveredSessionCookie;
rotatedRememberCookie = raceRotatedRememberCookie;

const reusedRememberResponse = await worker.fetch(new Request("https://qqai.test/api/portal/me", { headers: { Cookie: originalRememberCookie } }), portalEnv, {});
assert.equal(reusedRememberResponse.status, 401, "rotated remember cookie must not be reusable");
assert.equal(portalEnv.DB.values.get("portal_auth_password:55555"), "existing-user-password-record", "admin sign-in must not replace another account's password data");
assert.equal([...portalEnv.DB.values.keys()].some(key => /PORTAL_ADMIN_PASSWORD|Ops\.Root/.test(key)), false, "admin credentials must not be stored in D1");

portalEnv.DB.values.set("portal_account_username:ops.root", "55555");
const collisionResponse = await worker.fetch(postJson("/api/auth/login-password", { username: "ops.root", password }), portalEnv, {});
const collision = await collisionResponse.json();
assert.equal(collisionResponse.status, 409);
assert.equal(collision.code, "ADMIN_USERNAME_COLLISION");
assert.equal(portalEnv.DB.values.get("portal_auth_password:55555"), "existing-user-password-record", "admin username collision must preserve the existing account password");
portalEnv.DB.values.delete("portal_account_username:ops.root");

const getDevelopers = await worker.fetch(new Request("https://qqai.test/api/system-admin/developers", { headers: { Cookie: adminCookie } }), portalEnv, {});
assert.equal(getDevelopers.status, 200);
assert.deepEqual((await getDevelopers.json()).environmentIds, ["11111"]);
const updateDevelopers = await worker.fetch(postJson("/api/system-admin/developers", { ids: ["22222", "33333"] }, "https://qqai.test", adminCookie), portalEnv, {});
assert.equal(updateDevelopers.status, 200);
assert.deepEqual((await updateDevelopers.json()).managedIds, ["22222", "33333"]);
const crossOriginUpdate = await worker.fetch(postJson("/api/system-admin/developers", { ids: ["44444"] }, "https://attacker.test", adminCookie), portalEnv, {});
assert.equal(crossOriginUpdate.status, 403);
const invalidUpdate = await worker.fetch(postJson("/api/system-admin/developers", { ids: ["bad-qq"] }, "https://qqai.test", adminCookie), portalEnv, {});
assert.equal(invalidUpdate.status, 400);
assert.deepEqual(await readPortalManagedDeveloperIds(portalEnv), ["22222", "33333"], "invalid updates must leave the saved list unchanged");

const portalGroups = await worker.fetch(new Request("https://qqai.test/api/portal/groups", { headers: { Cookie: adminCookie } }), portalEnv, {});
assert.equal(portalGroups.status, 200);
const portalGroupsBody = await portalGroups.json();
assert.deepEqual(portalGroupsBody.groups.map(group => group.groupId), ["12345"], "system admin must see whitelisted groups without requiring a QQ membership identity");

const selectAdminGroup = await worker.fetch(postJson("/api/portal/select-group", { groupId: "12345" }, "https://qqai.test", adminCookie), portalEnv, {});
assert.equal(selectAdminGroup.status, 200);
const selectedAdminSession = (await selectAdminGroup.json()).session;
assert.equal(selectedAdminSession.systemAdmin, true);
assert.equal(selectedAdminSession.groupId, "12345");
assert.equal(selectedAdminSession.role, "developer");
assert.equal(selectedAdminSession.permissions.developer, true);

const systemAdminPage = await worker.fetch(new Request("https://qqai.test/system-admin", { headers: { Cookie: adminCookie }, redirect: "manual" }), portalEnv, {});
assert.equal(systemAdminPage.status, 302);
assert.equal(systemAdminPage.headers.get("Location"), "https://qqai.test/portal#systemadmin");
const unauthenticatedSystemAdminPage = await worker.fetch(new Request("https://qqai.test/system-admin", { redirect: "manual" }), portalEnv, {});
assert.equal(unauthenticatedSystemAdminPage.status, 302);
assert.equal(unauthenticatedSystemAdminPage.headers.get("Location"), "https://qqai.test/");
const unauthenticatedDevelopers = await worker.fetch(new Request("https://qqai.test/api/system-admin/developers"), portalEnv, {});
assert.equal(unauthenticatedDevelopers.status, 401);

const rememberedLogout = await worker.fetch(postJson(
  "/api/auth/logout",
  {},
  "https://qqai.test",
  [adminCookie, rotatedRememberCookie].filter(Boolean).join("; ")
), portalEnv, {});
assert.equal(rememberedLogout.status, 200);
const logoutCookies = responseSetCookies(rememberedLogout);
assert.equal(logoutCookies.some(value => /^qqai_session=/.test(value) && /Max-Age=0/.test(value)), true, "logout must clear the session cookie");
assert.equal(logoutCookies.some(value => /^qqai_remember=/.test(value) && /Max-Age=0/.test(value)), true, "logout must clear the remember cookie");
const revokedCookieOnlyMe = await worker.fetch(new Request("https://qqai.test/api/portal/me", { headers: { Cookie: rotatedRememberCookie } }), portalEnv, {});
assert.equal(revokedCookieOnlyMe.status, 401, "logout must revoke the current remember cookie server-side");

const legacyPasswordEnv = {
  DB: new MemoryD1(),
  MY_RATE_LIMITER: { limit: async () => ({ success: true }) }
};
const legacySalt = new Uint8Array(16).fill(9);
const legacyRecord = {
  version: 1,
  algorithm: "PBKDF2-SHA-256",
  iterations: 120000,
  salt: bytesToBase64Url(legacySalt),
  hash: bytesToBase64Url(await derivePortalPassword(password, legacySalt, 120000)),
  updatedAt: Date.now()
};
legacyPasswordEnv.DB.values.set("portal_auth_password:88888", JSON.stringify(legacyRecord));
assert.equal(needsPortalPasswordRehash(legacyRecord), true);
const legacyLogin = await worker.fetch(postJson("/api/auth/login-password", { qq: "88888", password }), legacyPasswordEnv, {});
assert.equal(legacyLogin.status, 200, "legacy hashes must remain usable during login migration");
const upgradedRecord = JSON.parse(legacyPasswordEnv.DB.values.get("portal_auth_password:88888"));
assert.equal(upgradedRecord.iterations, 600000, "a successful password login must upgrade the stored hash work factor");
const conflictingRecord = await createPortalPasswordRecord("replacement-long-password-482!");
legacyPasswordEnv.DB.values.set("portal_auth_password:88888", JSON.stringify(conflictingRecord));
assert.equal(await rehashPortalPasswordIfNeeded(legacyPasswordEnv, "88888", password, legacyRecord), false, "rehash must not overwrite a password that changed after verification");
assert.equal(legacyPasswordEnv.DB.values.get("portal_auth_password:88888"), JSON.stringify(conflictingRecord));

const deliveryEnv = {
  ...portalEnv,
  ONEBOT_HUB: {
    idFromName: () => "default",
    get: () => ({ fetch: async (_url, init) => {
      const request = JSON.parse(init.body);
      assert.equal(request.action, "send_private_msg");
      assert.equal(request.params.user_id, 66666);
      assert.match(request.params.message, /验证码：\d{6}/);
      return Response.json({ ok: true, data: { message_id: "mock-message" } });
    } })
  }
};
const delivered = await worker.fetch(postJson("/api/auth/request-code", { qq: "66666" }), deliveryEnv, {});
const deliveredBody = await delivered.json();
assert.equal(delivered.status, 200, JSON.stringify(deliveredBody));
assert.equal(deliveredBody.transport, "websocket:send_private_msg");
assert.equal(deliveredBody.ttl_seconds, 300);
assert.doesNotMatch(JSON.stringify(deliveredBody), /\b\d{6}\b/, "successful responses must not echo the verification code");
assert.match(deliveryEnv.DB.values.get("portal_auth_code:66666"), /\"code\":\"\d{6}\"/);

const originalFetch = globalThis.fetch;
let httpActionCount = 0;
globalThis.fetch = async (_url, init) => {
  httpActionCount += 1;
  const payload = JSON.parse(init.body);
  assert.equal(payload.user_id, 77777);
  return Response.json({ status: "ok", data: { message_id: "mock-http-message" } });
};
try {
  const fallbackDelivery = await sendPortalVerificationMessage({
    ONEBOT_HTTP_URL: "https://napcat.test/api",
    ONEBOT_HUB: {
      idFromName: () => "default",
      get: () => ({ fetch: async url => url.endsWith("/status")
        ? Response.json({ connected: false })
        : Response.json({ ok: false, error: "ONEBOT_NOT_CONNECTED" }) })
    }
  }, "77777", "mock verification");
  assert.equal(fallbackDelivery.ok, true);
  assert.equal(fallbackDelivery.transport, "http:send_private_msg");
  assert.equal(httpActionCount, 1);
} finally {
  globalThis.fetch = originalFetch;
}

const deliveryFailure = await worker.fetch(postJson("/api/auth/request-code", { qq: "55555" }), portalEnv, {});
const deliveryFailureBody = await deliveryFailure.json();
assert.equal(deliveryFailure.status, 503);
assert.equal(deliveryFailureBody.code, "VERIFICATION_DELIVERY_FAILED");
assert.deepEqual(deliveryFailureBody.diagnostics, { websocketConnected: false, httpConfigured: false });
assert.equal(portalEnv.DB.values.has("portal_auth_code:55555"), false, "a code that was not delivered must not remain valid");
assert.doesNotMatch(JSON.stringify(deliveryFailureBody), /\b\d{6}\b/, "delivery failure must not expose an undelivered code");

const workerSource = fs.readFileSync("worker.js", "utf8");
const portal = fs.readFileSync("src/portal/runtime.js", "utf8");
const loginStart = workerSource.indexOf("url.pathname === '/api/auth/login-password'");
const loginEnd = workerSource.indexOf("url.pathname === '/api/auth/logout'", loginStart);
const loginRoute = workerSource.slice(loginStart, loginEnd);
assert.ok(loginStart >= 0 && loginEnd > loginStart, "password login route must remain present");
assert.match(loginRoute, /portalAdminCredentialConfig\(env\)/);
assert.match(loginRoute, /portalTemporaryAdminCredentialConfig\(env\)/);
assert.match(loginRoute, /temporary_environment_admin_password/);
assert.match(workerSource, /checkPortalAuthRateLimitD1/);
assert.match(loginRoute, /verifyPortalAdminCredentials\(env, loginName, password\)/);
assert.match(loginRoute, /createPortalSession\(env, \{ systemAdmin: true/);
assert.match(workerSource, /url\.pathname === "\/api\/system-admin\/developers"/);
assert.match(workerSource, /origin !== url\.origin/);
assert.match(workerSource, /writePortalManagedDeveloperIds\(env, payload\.ids\)/);
assert.match(workerSource, /portalEnvironmentWithManagedDeveloperIds\(env\)/);
assert.match(portal, /管理員帳號或 QQ 号/);
assert.doesNotMatch(portal, /location\.replace\('\/system-admin'\)/);
assert.match(portal, /addView\('systemadmin','系统管理'\)/);
assert.match(portal, /\/api\/system-admin\/developers/);
assert.match(portal, /session\.systemAdmin/);
assert.match(workerSource, /\/portal#systemadmin/);
assert.doesNotMatch(workerSource, /<title>系統管理員<\/title>/);

console.log("verify-system-admin-auth: ok");
