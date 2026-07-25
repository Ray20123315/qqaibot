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

assert(pkg.version === '2.0.0', 'package.json version must be 2.0.0');
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
assert(!worker.includes('!截图') && !worker.includes('!截圖'), 'Screenshot command must not exist in worker.js');
assert(!readme.includes('!截图') && !readme.includes('!截圖'), 'Screenshot command must not exist in README.md');
assert(worker.includes("cleanMessage.startsWith('//')"), 'Same-account // chat trigger must remain');
assert(worker.includes('isKnownOutboundMessage'), 'Same-account outbound loop protection must remain');
console.log(`verify-config: ok (${moduleFiles.length} modules, single worker.js entry)`);
