import assert from "node:assert/strict";
import fs from "node:fs";

const runtime = fs.readFileSync("src/portal/runtime.js", "utf8");
const worker = fs.readFileSync("worker.js", "utf8");

assert.match(runtime, /function getPublicLandingPage\(/);
assert.match(runtime, /function getPortalLoginPage\(/);
assert.match(runtime, /function getPortalRegisterPage\(/);
assert.match(runtime, /帳號密碼登入/);
assert.match(runtime, /第一次使用：建立帳號/);
assert.match(runtime, /QQID（僅首次身份驗證）/);

const loginStart = runtime.indexOf("function getPortalLoginPage()");
const registerStart = runtime.indexOf("function getPortalRegisterPage()", loginStart);
assert(loginStart >= 0 && registerStart > loginStart);
const publicLogin = runtime.slice(loginStart, registerStart);
assert.match(publicLogin, /id="username"/);
assert.match(publicLogin, /id="password"/);
assert.match(publicLogin, /\/api\/auth\/login-password/);
assert.match(publicLogin, /\/api\/auth\/request-login-factor/);
assert.doesNotMatch(publicLogin, /id="qqid"/i);
assert.doesNotMatch(publicLogin, /QQID/);

const registerEnd = runtime.indexOf("function getPortalHomePage", registerStart);
const registerPage = runtime.slice(registerStart, registerEnd);
assert.match(registerPage, /id="qqid"/);
assert.match(registerPage, /\/api\/auth\/register\/request-code/);
assert.match(registerPage, /\/api\/auth\/register/);
assert.match(registerPage, /建立登入帳號/);
assert.match(registerPage, /已有帳號但忘記密碼/);

assert.match(worker, /url\.pathname === '\/'/);
assert.match(worker, /\['\/login', '\/register'\]/);
assert.match(worker, /url\.pathname === '\/portal'/);
assert.match(worker, /\/login\?next=/);
assert.match(worker, /\/portal#memory/);
assert.match(worker, /\/portal#appeals/);
assert.match(runtime, /function showLogin\(\)\{location\.replace\('\/login'\)\}/);
assert.match(runtime, /session\.username\|\|'已登入帳號'/);

const core = fs.readFileSync("src/core/permissions.js", "utf8");
assert.match(core, /function outboundFingerprint/);
assert.match(core, /async function isKnownOutboundMessage/);
assert.match(core, /message_sent plus message/);

const messages = fs.readFileSync("src/onebot/messages.js", "utf8");
assert.match(messages, /async function isIgnoredGroupRobotSender/);
assert.match(messages, /bot_interaction_allow:/);

assert.match(worker, /ENABLE_ONEBOT_HTTP_EVENTS === "true"/);
assert.match(worker, /X-QQAI-Transport/);

console.log("verify-portal-login-experience: ok");
