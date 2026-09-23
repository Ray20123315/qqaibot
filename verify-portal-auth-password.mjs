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
const resetEnd = worker.indexOf("url.pathname === '/api/auth/login-password'", resetStart);
const resetBlock = worker.slice(resetStart, resetEnd);
assert.ok(resetStart >= 0 && resetEnd > resetStart);
assert.match(resetBlock, /verifyPortalVerificationCode\(env, qq, code, \{ consume: false \}\)/);
assert.match(resetBlock, /createPortalPasswordRecord\(validation\.value\)/);
assert.match(resetBlock, /authDbPutStrict\(env, `portal_auth_password:\$\{qq\}`/);
assert.match(resetBlock, /authDbDelStrict\(env, `portal_auth_code:\$\{qq\}`\)/);
assert.match(worker, /PASSWORD_RECORD_INVALID/);
assert.match(runtime, /id="loginPasswordReset"/);
assert.match(runtime, /raw\('\/api\/auth\/reset-password'/);
assert.match(runtime, /passwordResetSendCode/);
assert.match(auth, /function isValidPortalPasswordRecord/);
console.log("verify-portal-auth-password: ok");
