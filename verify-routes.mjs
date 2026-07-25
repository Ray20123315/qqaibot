import crypto from 'node:crypto';
import worker from './worker.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const expected = new Map([
  ['GET https://qqai.ray2025.com/', [200, '50d155bf2b48270d1c377c2ac2c0ee5a40d4c1253bf09a0dc12f938d7c769a15']],
  ['GET https://qqai.ray2025.com/portal', [200, '50d155bf2b48270d1c377c2ac2c0ee5a40d4c1253bf09a0dc12f938d7c769a15']],
  ['GET https://qqai.ray2025.com/matrix', [200, '50d155bf2b48270d1c377c2ac2c0ee5a40d4c1253bf09a0dc12f938d7c769a15']],
  ['GET https://qqai.ray2025.com/live', [200, '442975303baab9496a23faa71f30d466eb3b8b00ab538a0bb6586eef598027c5']],
  ['GET https://qqai.ray2025.com/appeal', [302, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855']],
  ['GET https://qqai.ray2025.com/api/public/nebula', [200, '2c0c8c47f8c1bf6065a949b54eb3e92d67a6b3e02421a763c24c955332ae117a']],
  ['GET https://qqai.ray2025.com/api/appeal/legacy', [410, '742af5935f732e949d512573364e3672fcdc6a01ee0c266510b7582bcf46304e']],
]);
const ctx = { waitUntil() {}, passThroughOnException() {} };
for (const [key, [expectedStatus, expectedHash]] of expected) {
  const splitAt = key.indexOf(' ');
  const method = key.slice(0, splitAt);
  const url = key.slice(splitAt + 1);
  const response = await worker.fetch(new Request(url, { method }), {}, ctx);
  const body = await response.text();
  const hash = crypto.createHash('sha256').update(body).digest('hex');
  assert(response.status === expectedStatus, `${key}: expected status ${expectedStatus}, got ${response.status}`);
  assert(hash === expectedHash, `${key}: response body changed (${hash})`);
}
console.log(`verify-routes: ok (${expected.size} public routes)`);
