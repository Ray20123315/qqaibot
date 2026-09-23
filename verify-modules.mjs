import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
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
assert(manifest.entry === 'worker.js', `Unexpected Worker entry point: ${manifest.entry}`);
assert(Array.isArray(manifest.modules) && manifest.modules.length > 0, 'Module manifest is empty');
const modulePaths = manifest.modules.map(item => item.file);
assert(new Set(modulePaths).size === modulePaths.length, 'Module manifest contains duplicate source paths');
for (const file of modulePaths) assert(fs.existsSync(file) && file.startsWith('src/'), `Manifest source does not exist: ${file}`);
const sourceHash = createHash('sha256');
for (const file of [...files].sort()) {
  sourceHash.update(file.replaceAll(path.sep, '/'));
  sourceHash.update('\0');
  sourceHash.update(fs.readFileSync(file));
  sourceHash.update('\0');
}
assert(manifest.sourceSha256 === sourceHash.digest('hex'), 'JavaScript source checksum does not match src/module-manifest.json; refresh it with the reviewed source changes');
console.log(`verify-modules: ok (${files.length} JavaScript files)`);
