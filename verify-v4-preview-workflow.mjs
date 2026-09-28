import assert from "node:assert/strict";
import fs from "node:fs";

const workflow=fs.readFileSync(".github/workflows/v4-preview-deploy.yml","utf8");
assert.match(workflow,/workflow_dispatch/);
assert.doesNotMatch(workflow,/\n\s*push:\s*\n/);
assert.match(workflow,/secrets\.CLOUDFLARE_API_TOKEN/);
assert.match(workflow,/secrets\.CLOUDFLARE_ACCOUNT_ID/);
assert.match(workflow,/wrangler preview --config wrangler\.toml --name feature-v4-public-bot/);
assert.match(workflow,/--ignore-base-config/);
assert.match(workflow,/wrangler d1 execute DB --remote --config wrangler\.toml --file tools\/v4public-preview-bootstrap\.sql/);
assert.match(workflow,/npm run check:v4/);
assert.match(workflow,/npm run check:bundle/);
assert.match(workflow,/Cloudflare GitHub secrets are not configured; Preview deploy steps will be skipped/);
assert.match(workflow,/if: steps\.cf_creds\.outputs\.available == 'true'/);
assert.match(workflow,/Smoke test live Preview/);
assert.match(workflow,/插件安全检测中心/);
assert.match(workflow,/upload-artifact@v4/);
assert.doesNotMatch(workflow,/wrangler deploy --config wrangler\.toml(?! --dry-run)/);
assert.doesNotMatch(workflow,/CLOUDFLARE_API_TOKEN:\s*["']?[A-Za-z0-9_-]{20,}/);
assert.doesNotMatch(workflow,/CLOUDFLARE_ACCOUNT_ID:\s*["']?[a-f0-9]{32}/i);

const wrangler=fs.readFileSync("wrangler.toml","utf8");
const preview=wrangler.slice(wrangler.indexOf("# V4 branch Preview:"));
assert.match(preview,/QQAI_DB_TABLE = "kv_store_v4public_preview"/);
assert.match(preview,/QQ_OPEN_ENABLED = "false"/);
assert.match(preview,/database_id = "569a01fe-3297-40e1-832f-09c3793056ed"/);
assert.doesNotMatch(preview,/\[\[previews\.vectorize\]\]/);

console.log("verify-v4-preview-workflow: ok");
