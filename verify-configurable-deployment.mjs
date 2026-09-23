import assert from "node:assert/strict";
import fs from "node:fs";

import {
  developerId,
  developerIds,
  envBoolean,
  envInteger,
  normalizePublicBaseUrl,
  publicBaseUrl,
  publicLiveUrl,
  publicPortalUrl
} from "./src/config/deployment.js";
import { DEFAULT_DEVELOPER_ID, VERSION } from "./src/config/runtime.js";

assert.equal(VERSION, "2.7.12");
assert.equal(DEFAULT_DEVELOPER_ID, "", "Source must not grant the maintainer account implicit developer authority");

const multiEnv = {
  DEVELOPER_IDS: "111111111, 222222222\n111111111",
  ROOT_QQ_IDS: "333333333",
  DEVELOPER_ID: "444444444"
};
assert.deepEqual(developerIds(multiEnv), ["111111111", "222222222", "333333333", "444444444"]);
assert.equal(developerId(multiEnv), "111111111");
assert.deepEqual(developerIds({ DEVELOPER_IDS: "invalid,123,555555555" }), ["555555555"]);
assert.deepEqual(developerIds({}), []);

assert.equal(normalizePublicBaseUrl("bot.example.com/"), "https://bot.example.com");
assert.equal(normalizePublicBaseUrl("https://bot.example.com/path///?x=1#hash"), "https://bot.example.com/path");
assert.equal(normalizePublicBaseUrl("javascript:alert(1)"), "");
assert.equal(publicBaseUrl({ PUBLIC_BASE_URL: "https://public.example" }, "https://request.example"), "https://public.example");
assert.equal(publicBaseUrl({}, "https://request.example/"), "https://request.example");
assert.equal(publicPortalUrl({}, "https://request.example"), "https://request.example/");
assert.equal(publicLiveUrl({}, "https://request.example"), "https://request.example/live");

assert.equal(envBoolean("true", false), true);
assert.equal(envBoolean("关闭", true), false);
assert.equal(envInteger("99", 12, 1, 30), 30);
assert.equal(envInteger("bad", 12, 1, 30), 12);

const activeWrangler = fs.readFileSync("wrangler.toml", "utf8");
assert.match(activeWrangler, /^keep_vars\s*=\s*true$/m, "Dashboard-managed vars must survive deploy");
assert.match(activeWrangler, /pattern\s*=\s*"aibot\.ray2025\.com"/);
assert.match(activeWrangler, /PUBLIC_BASE_URL\s*=\s*"https:\/\/aibot\.ray2025\.com"/);
assert.match(activeWrangler, /AUTO_CHECKIN_ENABLED\s*=\s*"true"/);
assert.doesNotMatch(activeWrangler, /^\s*(?:DEVELOPER_IDS|ROOT_QQ_IDS|DEVELOPER_ID)\s*=/m, "production identity vars must stay Dashboard-managed");

const exampleWrangler = fs.readFileSync("wrangler.example.toml", "utf8");
assert.match(exampleWrangler, /^keep_vars\s*=\s*true$/m);
assert.match(exampleWrangler, /REPLACE_WITH_D1_DATABASE_ID/);
assert.match(exampleWrangler, /REPLACE_WITH_RATE_LIMITER_NAMESPACE_ID/);
assert.doesNotMatch(exampleWrangler, /^\s*(?:DEVELOPER_IDS|ROOT_QQ_IDS|DEVELOPER_ID)\s*=/m);
assert.match(exampleWrangler, /PUBLIC_BASE_URL\s*=\s*"https:\/\/bot\.example\.com"/);
assert.match(exampleWrangler, /AUTO_CHECKIN_RETRY_INTERVAL_MS/);
assert.match(exampleWrangler, /\[observability\]/);

const devVars = fs.readFileSync(".dev.vars.example", "utf8");
assert.match(devVars, /replace_with_google_api_key/);
assert.match(devVars, /replace_with_random_onebot_token/);
assert.doesNotMatch(devVars, /AIza[0-9A-Za-z_-]{20,}|sk-[0-9A-Za-z_-]{20,}/);

const identity = fs.readFileSync("src/core/identity.js", "utf8");
assert.match(identity, /from "\.\.\/config\/deployment\.js"/);
assert.doesNotMatch(identity, /env\?\.DEVELOPER_ID \|\| DEFAULT_DEVELOPER_ID/);

const deploymentNotifications = fs.readFileSync("src/deployment/notifications.js", "utf8");
assert.match(deploymentNotifications, /DEPLOY_NOTIFY_DEVELOPER_IDS/);
assert.doesNotMatch(deploymentNotifications, /DEFAULT_DEVELOPER_ID/);

const help = fs.readFileSync("src/help/commands.js", "utf8");
assert.match(help, /QQAI \$\{VERSION\} 指令帮助/);
assert.doesNotMatch(help, /qqai\.ray2025\.com/);

const worker = fs.readFileSync("worker.js", "utf8");
assert.match(worker, /publicBaseUrl/);
assert.match(worker, /publicLiveUrl/);
assert.match(worker, /url\.hostname === "qqai\.ray2025\.com"/);
assert.match(worker, /target\.hostname = "aibot\.ray2025\.com"/);
assert.doesNotMatch(worker, /portalUrl:\s*['"]https:\/\/qqai\.ray2025\.com/);

const scheduler = fs.readFileSync("src/scheduler/runtime.js", "utf8");
assert.match(scheduler, /AUTO_CHECKIN_ENABLED/);
assert.match(scheduler, /envBoolean/);

const readme = fs.readFileSync("README.md", "utf8");
for (const marker of [
  "五層設定模型",
  "DEVELOPER_IDS",
  "PUBLIC_BASE_URL",
  "Cloudflare Bindings",
  "Secrets",
  "Portal／群組動態設定",
  "不提供成任意開關的項目",
  "從 2.7.11 升級",
  "wrangler.example.toml",
  ".dev.vars.example"
]) assert.match(readme, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
assert.doesNotMatch(readme, /3569028262/);

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const packageLock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
assert.equal(packageJson.version, "2.7.12");
assert.equal(packageLock.version, packageJson.version, "npm lockfile must match package.json");
assert.equal(packageLock.packages[""].devDependencies.wrangler, packageJson.devDependencies.wrangler, "locked Wrangler must match package.json");
assert.match(packageJson.scripts.check, /verify-configurable-deployment\.mjs/);
assert.match(packageJson.scripts.deploy, /check:bundle/);
assert.match(packageJson.scripts["deploy:prod"], /--keep-vars/);

console.log("Configurable deployment and README regression passed.");
