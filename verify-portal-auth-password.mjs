import assert from "node:assert/strict";
import fs from "node:fs";
import {
  createPortalPasswordRecord,
  isValidPortalPasswordRecord,
  verifyPortalPassword
} from "./src/portal/auth.js";

const password = "correct horse battery staple 279";
const record = await createPortalPasswordRecord(password);
assert.equal(record.algorithm, "PBKDF2-SHA-256");
assert.equal(isValidPortalPasswordRecord(record), true);
assert.equal(await verifyPortalPassword(password, record), true, "correct password must verify");
assert.equal(await verifyPortalPassword("wrong password value", record), false, "wrong password must fail");
assert.equal(isValidPortalPasswordRecord({ ...record, salt: "%%%" }), false, "malformed salt must be rejected");
assert.equal(await verifyPortalPassword(password, { ...record, hash: "%%%" }), false, "malformed record must fail safely");

const worker = fs.readFileSync("worker.js", "utf8");
const runtime = fs.readFileSync("src/portal/runtime.js", "utf8");
const auth = fs.readFileSync("src/portal/auth.js", "utf8");

assert.match(worker, /url\.pathname === '\/api\/auth\/reset-password'/);
const resetStart = worker.indexOf("url.pathname === '/api/auth/reset-password'");
const resetEnd = worker.indexOf("url.pathname === '/api/auth/request-login-factor'", resetStart);
const resetBlock = worker.slice(resetStart, resetEnd);
assert.ok(resetStart >= 0 && resetEnd > resetStart);
assert.match(resetBlock, /verifyPortalVerificationCode\(env, qq, code, \{ consume: false \}\)/);
assert.match(resetBlock, /createPortalPasswordRecord\(validation\.value\)/);
assert.match(resetBlock, /portal_auth_password/);
assert.match(resetBlock, /portal_auth_code/);

const loginStart = worker.indexOf("url.pathname === '/api/auth/login-password'");
const loginEnd = worker.indexOf("url.pathname === '/api/auth/logout'", loginStart);
const loginBlock = worker.slice(loginStart, loginEnd);
assert.match(loginBlock, /payload\.username/);
assert.match(loginBlock, /readPortalAccountByUsername/);
assert.doesNotMatch(loginBlock, /const qq = String\(payload\.qq/);
assert.match(loginBlock, /TWO_FACTOR_REQUIRED/);
assert.match(loginBlock, /verifyTotpCode/);
assert.match(loginBlock, /hashBackupCode/);
assert.match(loginBlock, /verifyPortalVerificationCode/);

assert.match(runtime, /getPortalLoginPage/);
assert.match(runtime, /getPortalRegisterPage/);
assert.match(auth, /function isValidPortalPasswordRecord/);
assert.match(auth, /function validatePortalUsername/);
console.log("verify-portal-auth-password: ok");
