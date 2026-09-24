import crypto from 'node:crypto';
import worker from './worker.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const exact = new Map([
  ['GET https://qqai.ray2025.com/live', [200, '442975303baab9496a23faa71f30d466eb3b8b00ab538a0bb6586eef598027c5']],
  ['GET https://qqai.ray2025.com/appeal', [302, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855']],
  ['GET https://qqai.ray2025.com/api/public/nebula', [200, '2c0c8c47f8c1bf6065a949b54eb3e92d67a6b3e02421a763c24c955332ae117a']],
  ['GET https://qqai.ray2025.com/api/appeal/legacy', [410, '742af5935f732e949d512573364e3672fcdc6a01ee0c266510b7582bcf46304e']],
]);
const ctx = { waitUntil() {}, passThroughOnException() {} };

let portalHash = '';
for (const path of ['/', '/portal', '/matrix']) {
  const key = `GET https://qqai.ray2025.com${path}`;
  const response = await worker.fetch(new Request(`https://qqai.ray2025.com${path}`, { method: 'GET' }), {}, ctx);
  const body = await response.text();
  const hash = crypto.createHash('sha256').update(body).digest('hex');
  assert(response.status === 200, `${key}: expected status 200, got ${response.status}`);
  assert(body.includes('qqai-deployment-toast'), `${key}: deployment notification client missing`);
  if (!portalHash) portalHash = hash;
  else assert(hash === portalHash, `${key}: Portal route variants must remain identical`);
}

for (const [key, [expectedStatus, expectedHash]] of exact) {
  const splitAt = key.indexOf(' ');
  const method = key.slice(0, splitAt);
  const url = key.slice(splitAt + 1);
  const response = await worker.fetch(new Request(url, { method }), {}, ctx);
  const body = await response.text();
  const hash = crypto.createHash('sha256').update(body).digest('hex');
  assert(response.status === expectedStatus, `${key}: expected status ${expectedStatus}, got ${response.status}`);
  assert(hash === expectedHash, `${key}: response body changed (${hash})`);
}
console.log(`verify-routes: ok (${exact.size + 3} public routes)`);
