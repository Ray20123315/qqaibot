import assert from "node:assert/strict";
import fs from "node:fs";
import {
  getPortalLoginPage,
  getPortalRegisterPage,
  getPublicLandingPage
} from "./src/portal/runtime.js";

const runtime = fs.readFileSync("src/portal/runtime.js", "utf8");
const worker = fs.readFileSync("worker.js", "utf8");
const landing = getPublicLandingPage();
const login = getPortalLoginPage();
const register = getPortalRegisterPage();

assert.match(landing, /AI Control Center/);
assert.match(landing, /class="console-preview"/);
assert.match(landing, /class="feature-grid"/);

assert.match(login, /登入你的帳號/);
assert.match(login, /id="username"/);
assert.match(login, /id="password"/);
assert.match(login, /\/api\/auth\/login-password/);
assert.match(login, /\/api\/auth\/request-login-factor/);
assert.match(login, /class="auth-stage"/);
assert.doesNotMatch(login, /id="qqid"/i);
assert.doesNotMatch(login, /QQID/);

assert.match(register, /第一次使用：建立帳號/);
assert.match(register, /QQID（僅首次身份驗證）/);
assert.match(register, /id="qqid"/);
assert.match(register, /\/api\/auth\/register\/request-code/);
assert.match(register, /\/api\/auth\/register/);
assert.match(register, /建立登入帳號/);
assert.match(register, /已有帳號但忘記密碼/);
assert.match(register, /class="auth-stage"/);

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
