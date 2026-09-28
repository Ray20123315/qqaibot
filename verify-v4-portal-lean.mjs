import assert from "node:assert/strict";
import fs from "node:fs";
import { injectV4LeanPortalClient } from "./src/v4/portal/lean-dashboard.js";

const sample = '<!doctype html><html><head></head><body><nav id="nav"></nav><main><div class="content"><section class="view active" id="v-overview"></section></div></main></body></html>';
const html = injectV4LeanPortalClient(sample);
assert.match(html, /qqai-v4-lean-portal-style/);
assert.match(html, /qqai-v4-lean-portal-client/);
assert.match(html, /prefers-reduced-motion:reduce/);
assert.match(html, /v4LeanNav/);
for (const label of ["总览", "AI 与资料", "QQ Open", "群管理", "AI \/ Codex", "插件", "系统"]) assert.match(html, new RegExp(label));
assert.match(html, /\/api\/portal\/v4\/qqopen\/status/);
assert.match(html, /\/api\/portal\/v4\/qqopen\/gateway\/connect/);
assert.match(html, /\/api\/portal\/v4\/qqopen\/gateway\/disconnect/);
assert.match(html, /remove-members/);
assert.match(html, /join-request/);
assert.match(html, /拒绝并拉黑/);
assert.match(html, /图片、影片、语音、文件/);
assert.match(html, /活动\/投票/);
assert.match(html, /showCustom\('v4overview','总览'\)/);
assert.match(html, /v4DeveloperInput/);
assert.match(html, /proxy='开发者模式'/);
assert.match(html, /raw==='00000'/);
assert.match(html, /\/api\/portal\/v4\/resources/);
assert.match(html, /v4-dev-only/);
assert.match(html, /新增 AI/);
assert.match(html, /连接资料储存/);
assert.doesNotMatch(html, /window\.prompt|window\.confirm|\bprompt\(|\bconfirm\(/);

const worker = fs.readFileSync("worker.js", "utf8");
assert.match(worker, /injectV4LeanPortalClient/);
assert.match(worker, /handleV4QqOpenPortalApi/);

const api = fs.readFileSync("src/v4/portal/api.js", "utf8");
for (const path of [
  "/group/info",
  "/group/members",
  "/group/blacklist",
  "/group/join-requests",
  "/group/mutes",
  "/group/remove-members",
  "/group/join-request",
  "/group/mute",
  "/gateway/connect",
  "/gateway/disconnect"
]) assert(api.includes(path), `missing portal route ${path}`);
assert.match(api, /session\.systemAdmin \|\| isDeveloperId/);
assert.match(api, /QQ_OPEN_PERMISSION_REQUIRED/);

const codex = fs.readFileSync("src/v3/ai/codex-command-runtime.js", "utf8");
assert.match(codex, /qqaibot:principal:\$\{principalId\}:codex/);
assert.match(codex, /context\.principalId \|\| context\.userId/);
assert.doesNotMatch(codex, /qqaibot:\$\{scope\}:user:\$\{context\.userId\}:codex/);

console.log("verify-v4-portal-lean: ok");
