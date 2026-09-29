import assert from "node:assert/strict";
import fs from "node:fs";

const config = fs.readFileSync("wrangler.v4test.toml", "utf8");
const worker = fs.readFileSync("worker.v4test.js", "utf8");

assert.match(config, /name\s*=\s*"qqai-v4test"/);
assert.match(config, /main\s*=\s*"worker\.v4test\.js"/);
assert.match(config, /name\s*=\s*"QQ_OPEN_GATEWAY"[\s\S]*?class_name\s*=\s*"QqOpenGateway"/);
assert.match(config, /tag\s*=\s*"v4test_qqopen_gateway_v1"/);
assert.match(config, /new_sqlite_classes\s*=\s*\["QqOpenGateway"\]/);
assert.match(config, /QQ_OPEN_ENABLED\s*=\s*"true"/);
assert.match(config, /QQ_OPEN_INTENTS\s*=\s*"100663296"/);
assert.match(config, /workers_dev\s*=\s*true/);
assert.match(config, /preview_urls\s*=\s*true/);
assert.match(config, /keep_vars\s*=\s*true/);

for (const forbidden of [
  "aibot.ray2025.com",
  "qqai.ray2025.com",
  "569a01fe-3297-40e1-832f-09c3793056ed",
  "[[d1_databases]]",
  "[[routes]]",
  "[triggers]",
  "ONEBOT_HUB",
  "Vectorize",
  "VECTORIZE"
]) {
  assert(!config.includes(forbidden), `V4 test config must not include production or quota-consuming resource: ${forbidden}`);
}

assert(!config.includes("QQ_OPEN_CLIENT_SECRET"), "QQ_OPEN_CLIENT_SECRET must stay a Worker Secret");
assert.match(worker, /productionResources:false/);
assert.match(worker, /worker:"qqai-v4test"/);
assert.match(worker, /\/api\/status/);
assert.match(worker, /\/api\/ensure/);
assert.match(worker, /連接 \/ 重試/);
assert.match(worker, /QQ_OPEN_CLIENT_SECRET/);
assert.match(worker, /!qqping/);
assert.match(worker, /!qqecho hello/);
assert.doesNotMatch(worker, /src\/portal\//);
assert.doesNotMatch(worker, /ONEBOT_HUB/);
assert.doesNotMatch(worker, /env\.DB/);
assert.doesNotMatch(worker, /async scheduled/);

console.log("verify-v4-test-deployment: ok");
