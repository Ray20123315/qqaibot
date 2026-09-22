import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function walk(dir) {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) out.push(...walk(full));
    else if (/\.js$/.test(name)) out.push(full);
  }
  return out;
}

const docs = fs.readFileSync("docs/ENVIRONMENT.md", "utf8");
const wrangler = fs.readFileSync("wrangler.example.toml", "utf8");
const devvars = fs.readFileSync(".dev.vars.example", "utf8");
const auth = fs.readFileSync("src/portal/auth.js", "utf8");
const worker = fs.readFileSync("worker.js", "utf8");
const operations = fs.readFileSync("src/operations/runtime.js", "utf8");

const found = new Set();
for (const file of ["worker.js", ...walk("src")]) {
  const source = fs.readFileSync(file, "utf8");
  for (const re of [
    /\benv(?:\?\.|\.)([A-Z][A-Z0-9_]*)/g,
    /\bthis\.env(?:\?\.|\.)([A-Z][A-Z0-9_]*)/g,
    /\benv(?:\?\.)?\[["']([A-Z][A-Z0-9_]*)["']\]/g
  ]) for (const match of source.matchAll(re)) found.add(match[1]);
}

for (const name of [...found].sort()) {
  assert.ok(docs.includes(`\`${name}\``), `docs/ENVIRONMENT.md missing source env/binding: ${name}`);
}

for (const name of [
  "ROOT_QQ_IDS",
  "GEMINI_DECISION_MODELS",
  "GEMINI_SEARCH_MODELS",
  "GEMINI_VISION_MODELS",
  "GEMMA_CHAT_MODELS",
  "GEMMA_LAST_RESORT_MODELS",
  "IMAGE_INSPECTION_ENABLED",
  "MODEL_COST_POLICY",
  "DEEPSEEK_EMERGENCY_FALLBACK",
  "QQAI_PUBLIC_INTERNAL_FALLBACK"
]) assert.ok(wrangler.includes(name), `wrangler.example.toml missing public var ${name}`);

for (const name of [
  "TOTP_ENCRYPTION_KEY",
  "ONEBOT_HTTP_ACCESS_TOKEN",
  "GEMINI_DECISION_API_KEYS",
  "VECTORIZE_GEMINI_KEYS",
  "DEEPSEEK_API_KEY",
  "ONEBOT_TOKEN",
  "NAPCAT_ACCESS_TOKEN"
]) assert.ok(devvars.includes(name), `.dev.vars.example missing secret/alias ${name}`);

assert.match(auth, /env\.TOTP_ENCRYPTION_KEY \|\| env\.PORTAL_AUTH_SECRET/);
assert.match(auth, /env\.ONEBOT_HTTP_ACCESS_TOKEN \|\| env\.ONEBOT_ACCESS_TOKEN/);
assert.doesNotMatch(operations, /env\.ONEBOT_WS/);
assert.match(operations, /env\.ONEBOT_HUB/);

const registerStart = worker.indexOf("url.pathname === '/api/auth/register'");
const registerEnd = worker.indexOf("url.pathname === '/api/auth/verify-code'", registerStart);
const registerBlock = worker.slice(registerStart, registerEnd);
assert.match(registerBlock, /const developerDirect = isDeveloperId\(env, qq\)/);
assert.match(registerBlock, /developerPortalBootstrapPolicy\(env, \{ qq, setupKey \}\)/);
assert.match(registerBlock, /if \(developerDirect\)/);
assert.match(registerBlock, /verifyPortalVerificationCode/);
assert.match(worker, /developerPortalBootstrapSecrets/);
assert.match(worker, /env\.PORTAL_AUTH_SECRET/);
assert.match(worker, /env\.ONEBOT_ACCESS_TOKEN/);
assert.match(worker, /constantTimeEqual\(secret, supplied\)/);
assert.doesNotMatch(worker, /PORTAL_DEVELOPER_USERNAME/);
assert.doesNotMatch(worker, /PORTAL_DEVELOPER_INITIAL_PASSWORD/);
assert.doesNotMatch(wrangler, /PORTAL_DEVELOPER_USERNAME\s*=/);
assert.doesNotMatch(devvars, /PORTAL_DEVELOPER_INITIAL_PASSWORD\s*=/);
assert.ok(docs.includes("KV") && docs.includes("R2") && docs.includes("目前不是 production source 直接讀取的 binding"));

console.log(`verify-environment-contract: ok (${found.size} source env/binding names documented)`);
