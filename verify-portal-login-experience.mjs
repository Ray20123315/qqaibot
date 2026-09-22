import assert from "node:assert/strict";
import fs from "node:fs";

const runtime = fs.readFileSync("src/portal/runtime.js", "utf8");

assert.match(runtime, /<title>AI Control Center<\/title>/);
assert.match(runtime, /data-login-profile="developer"/);
assert.match(runtime, /data-login-profile="instance_admin"/);
assert.match(runtime, /data-login-profile="ai_user"/);
assert.match(runtime, /data-login-profile="community_member"/);
assert.match(runtime, /開發者/);
assert.match(runtime, /實例管理員/);
assert.match(runtime, /AI 使用者/);
assert.match(runtime, /社群成員/);
assert.match(runtime, /入口選擇不會改變任何權限/);
assert.match(runtime, /publicAuthMessage/);
assert.match(runtime, /raw\('\/api\/auth\/request-code'/);
assert.match(runtime, /raw\('\/api\/auth\/verify-code'/);
assert.match(runtime, /raw\('\/api\/auth\/login-password'/);
assert.match(runtime, /raw\('\/api\/auth\/reset-password'/);
assert.match(runtime, /value="totp"/);
assert.match(runtime, /value="backup"/);
assert.match(runtime, /value="qq_code"/);
assert.match(runtime, /id="rememberLogin"/);
assert.match(runtime, /id="loginPasswordReset"/);
assert.match(runtime, /login-role-grid/);
assert.match(runtime, /@media\(max-width:860px\)/);
assert.match(runtime, /@media\(max-width:560px\)/);

const loginStart = runtime.indexOf('<section id="login" class="login">');
const appStart = runtime.indexOf('<div id="app" class="app hidden">', loginStart);
assert(loginStart >= 0 && appStart > loginStart);
const publicLogin = runtime.slice(loginStart, appStart);
for (const forbidden of ["QQAIbot 控制台", "QQ 號", "QQ 号", "QQ 驗證碼", "QQ 验证码", "NapCat"]) {
  assert.equal(publicLogin.includes(forbidden), false, `public login UI must not expose platform-specific label: ${forbidden}`);
}

const profileFunctionStart = runtime.indexOf("function setLoginProfile(");
const profileFunctionEnd = runtime.indexOf("function publicAuthMessage(", profileFunctionStart);
assert(profileFunctionStart >= 0 && profileFunctionEnd > profileFunctionStart);
const profileFunction = runtime.slice(profileFunctionStart, profileFunctionEnd);
assert.doesNotMatch(profileFunction, /permissions\s*=|role\s*=|developer\s*:/, "profile selector must not grant authorization");

const core = fs.readFileSync("src/core/permissions.js", "utf8");
assert.match(core, /function outboundFingerprint/);
assert.match(core, /async function isKnownOutboundMessage/);
assert.match(core, /message_sent plus message/);

const messages = fs.readFileSync("src/onebot/messages.js", "utf8");
assert.match(messages, /async function isIgnoredGroupRobotSender/);
assert.match(messages, /bot_interaction_allow:/);

const worker = fs.readFileSync("worker.js", "utf8");
assert.match(worker, /ENABLE_ONEBOT_HTTP_EVENTS === "true"/);
assert.match(worker, /X-QQAI-Transport/);

console.log("verify-portal-login-experience: ok");
