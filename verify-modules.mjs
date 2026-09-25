import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const files = ['worker.js'];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && entry.name.endsWith('.js')) files.push(full);
  }
}
walk('src');
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  assert(result.status === 0, `Syntax check failed for ${file}:\n${result.stderr || result.stdout}`);
}
const manifest = JSON.parse(fs.readFileSync('src/module-manifest.json', 'utf8'));
assert(manifest.sourceSha256 === '9ec5204125c3b9e85f3fe759193c6ed176be1e69f3c3d2877faa4b04d494464f', 'Backup source checksum changed');
assert(manifest.entryStatements === 26, `Unexpected entry statement count: ${manifest.entryStatements}`);
assert(manifest.modules.length === 17, `Unexpected module count: ${manifest.modules.length}`);
assert(manifest.modules.reduce((sum, item) => sum + item.statements, 0) + manifest.entryStatements === 572, 'Top-level declaration count changed');
console.log(`verify-modules: ok (${files.length} JavaScript files)`);
