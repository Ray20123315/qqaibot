import assert from "node:assert/strict";
import fs from "node:fs";

const wrangler = fs.readFileSync("wrangler.v3test.toml", "utf8");
const workflow = fs.readFileSync(".github/workflows/v3-test-deploy.yml", "utf8");
const bootstrap = fs.readFileSync("tools/v3test-bootstrap.sql", "utf8");

assert.match(wrangler, /^name = "qqai-v3test"$/m);
assert.match(wrangler, /^workers_dev = true$/m);
assert.match(wrangler, /^preview_urls = true$/m);
assert.match(wrangler, /^\[\[d1_databases\]\]$/m);
assert.match(wrangler, /^binding = "DB"$/m);
assert.match(wrangler, /^V3_RUNTIME_ENABLED = "true"$/m);
assert.match(wrangler, /^V3_BILIBILI_ENABLED = "false"$/m);
assert.match(wrangler, /^AUTO_CHECKIN_ENABLED = "false"$/m);
assert.match(wrangler, /^PLUGIN_SECURITY_GPT_ENABLED = "false"$/m);

for (const forbidden of [
  "qqai.ray2025.com",
  "569a01fe-3297-40e1-832f-09c3793056ed",
  "REPLACE_WITH_D1_DATABASE_ID",
  "[[routes]]",
  "[triggers]",
  "database_id =",
  "index_name =",
  "namespace_id =",
  "[[durable_objects.bindings]]",
  "ONEBOT_ACCESS_TOKEN",
  "GEMINI_API",
  "OPENAI_API_KEY"
]) {
  assert.equal(wrangler.includes(forbidden), false, `staging config must not contain ${forbidden}`);
}

assert.match(workflow, /^\s*workflow_dispatch:\s*$/m);
assert.doesNotMatch(workflow, /^\s*push:\s*$/m);
assert.match(workflow, /secrets\.CLOUDFLARE_API_TOKEN/);
assert.match(workflow, /secrets\.CLOUDFLARE_ACCOUNT_ID/);
assert.match(workflow, /npm run check/);
assert.match(workflow, /wrangler deploy --config wrangler\.v3test\.toml --dry-run/);
assert.match(workflow, /Verify Cloudflare CI credentials exist/);
assert.match(workflow, /Deploy isolated V3 test Worker/);
assert.match(workflow, /wrangler d1 execute DB --remote --config wrangler\.v3test\.toml/);
assert.match(workflow, /\/plugin-security/);
assert.match(workflow, /\/api\/v3\/plugin-security/);
assert.match(workflow, /\/portal/);
assert.doesNotMatch(workflow, /CLOUDFLARE_API_TOKEN:\s*["']?[A-Za-z0-9_-]{20,}/);
assert.doesNotMatch(workflow, /CLOUDFLARE_ACCOUNT_ID:\s*["']?[a-f0-9]{32}/i);
assert.doesNotMatch(workflow, /wrangler\.toml --no-assets/);

const regressionPos = workflow.indexOf("Run repository regression checks");
const dryRunPos = workflow.indexOf("Validate isolated V3 test config");
const credentialPos = workflow.indexOf("Verify Cloudflare CI credentials exist");
const deployPos = workflow.indexOf("Deploy isolated V3 test Worker");
assert(regressionPos >= 0 && dryRunPos > regressionPos && credentialPos > dryRunPos && deployPos > credentialPos,
  "regression and dry-run must complete before the credential gate and live deploy");

assert.match(bootstrap, /CREATE TABLE IF NOT EXISTS kv_store/);
assert.match(bootstrap, /CREATE INDEX IF NOT EXISTS idx_kv_store_key_nocase/);
assert.doesNotMatch(bootstrap, /\bDROP\s+(?:TABLE|DATABASE)\b/i);
assert.doesNotMatch(bootstrap, /\bDELETE\s+FROM\b/i);
assert.doesNotMatch(bootstrap, /\bUPDATE\s+kv_store\b/i);
assert.doesNotMatch(bootstrap, /\bINSERT\s+INTO\b/i);

console.log("verify-v3-test-deployment: ok");
