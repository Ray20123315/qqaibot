import fs from 'node:fs';
import path from 'node:path';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const root = process.cwd();
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const wrangler = fs.readFileSync(path.join(root, 'wrangler.toml'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'worker.js'), 'utf8');
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
const configSource = fs.readFileSync(path.join(root, 'src/config/runtime.js'), 'utf8');
const versionMatch = configSource.match(/const VERSION\s*=\s*"([^"]+)"/);
const moduleFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && entry.name.endsWith('.js')) moduleFiles.push(full);
  }
}
walk(path.join(root, 'src'));

assert(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(pkg.version), `package.json version must be valid SemVer, got ${pkg.version}`);
assert(versionMatch?.[1] === pkg.version, `Worker version ${versionMatch?.[1] || 'missing'} must match package version ${pkg.version}`);
assert(pkg.type === 'module', 'package.json must keep ES module mode');
assert(!pkg.dependencies?.['@cloudflare/puppeteer'], 'Removed screenshot feature must not retain Puppeteer');
assert(/^name\s*=\s*"qqai"/m.test(wrangler), 'Cloudflare Worker name must remain qqai');
assert(/^main\s*=\s*"worker\.js"/m.test(wrangler), 'Single Worker entry must remain worker.js');
assert(!/^\[browser\]/m.test(wrangler), 'Removed screenshot feature must not retain browser binding');
assert(moduleFiles.length >= 17, `Expected at least 17 JavaScript modules, found ${moduleFiles.length}`);
assert((worker.match(/^import\s/mg) || []).length >= 17, 'worker.js must import the extracted modules');
assert(/export default QQAIWorker;/.test(worker), 'worker.js must keep the default Worker export');
assert(/export class OneBotHub/.test(worker), 'worker.js must keep the OneBotHub export');
assert(worker.includes('export { QqOpenGateway } from "./src/v4/qqopen/runtime.js";'), 'worker.js must keep the QqOpenGateway export');
assert(!worker.includes('!截图') && !worker.includes('!截圖'), 'Screenshot command must not exist in worker.js');
assert(!readme.includes('!截图') && !readme.includes('!截圖'), 'Screenshot command must not exist in README.md');
assert(worker.includes("cleanMessage.startsWith('//')"), 'Same-account // chat trigger must remain');
assert(worker.includes('isKnownOutboundMessage'), 'Same-account outbound loop protection must remain');
console.log(`verify-config: ok (${moduleFiles.length} modules, single worker.js entry)`);

const retiredProdVars = [
  "AUTO_CHECKIN_CONCURRENCY",
  "AUTO_CHECKIN_ENABLED",
  "AUTO_CHECKIN_RETRY_INTERVAL_MS",
  "DEEPSEEK_PRO_MODEL",
  "DEPLOY_NOTIFY_DEVELOPER_IDS",
  "DEPLOY_NOTIFY_START_COOLDOWN_SECONDS",
  "DEVELOPER_ID",
  "ENABLE_ONEBOT_HTTP_EVENTS",
  "GEMINI_IMAGE_MODELS",
  "IMAGEN_MODELS",
  "PLUGIN_SECURITY_GPT_MODEL"
];
for (const name of retiredProdVars) {
  assert(!wrangler.includes(name + " ="), "retired production var still declared: " + name);
}
assert(wrangler.includes('QQ_OPEN_ENABLED = "true"'), "QQ Open production vars missing: QQ_OPEN_ENABLED");
assert(wrangler.includes('QQ_OPEN_APP_ID = "1905687174"'), "QQ Open production vars missing: QQ_OPEN_APP_ID");
assert(wrangler.includes('QQ_OPEN_INTENTS = "100663296"'), "QQ Open production vars missing INTERACTION intent");
assert(wrangler.includes('QQ_OPEN_TRANSPORT = "websocket"'), "QQ Open production vars missing: QQ_OPEN_TRANSPORT");
