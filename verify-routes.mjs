import crypto from 'node:crypto';
import worker from './worker.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const exact = new Map([
  ['GET https://qqai.ray2025.com/live', [200, '442975303baab9496a23faa71f30d466eb3b8b00ab538a0bb6586eef598027c5']],
  ['GET https://qqai.ray2025.com/api/public/nebula', [200, '2c0c8c47f8c1bf6065a949b54eb3e92d67a6b3e02421a763c24c955332ae117a']],
  ['GET https://qqai.ray2025.com/api/appeal/legacy', [410, '742af5935f732e949d512573364e3672fcdc6a01ee0c266510b7582bcf46304e']],
]);
const ctx = { waitUntil() {}, passThroughOnException() {} };

async function get(path) {
  const response = await worker.fetch(new Request('https://qqai.ray2025.com' + path, { method: 'GET' }), {}, ctx);
  return { response, body: await response.text() };
}

let result = await get('/');
assert(result.response.status === 200, 'GET /: expected 200');
assert(result.body.includes('AI Control Center'), 'GET /: public homepage brand missing');
assert(result.body.includes('href="/login"'), 'GET /: login CTA missing');
assert(result.body.includes('href="/register"'), 'GET /: registration CTA missing');
assert(!result.body.includes('qqai-deployment-toast'), 'GET /: Portal-only deployment client must not be injected into public homepage');
assert(/<style>\s*:root\{\s*color-scheme:dark;/.test(result.body), 'GET /: futuristic public CSS must be materialized');
assert(result.body.includes('class="console-preview"'), 'GET /: AI control-center preview missing');
assert(result.body.includes('class="feature-grid"'), 'GET /: core capability grid missing');
assert(!result.body.includes('QQAIbot'), 'GET /: legacy product branding must not leak');
assert(!result.body.includes('${css}'), 'GET /: literal CSS template placeholder leaked');

result = await get('/login');
assert(result.response.status === 200, 'GET /login: expected 200');
assert(result.body.includes('登入你的帳號'), 'GET /login: account login form missing');
assert(result.body.includes('id="username"'), 'GET /login: username input missing');
assert(!result.body.includes('id="qqid"'), 'GET /login: QQID must not be a normal login input');
assert(/<style>\s*:root\{\s*color-scheme:dark;/.test(result.body), 'GET /login: futuristic public CSS must be materialized');
assert(result.body.includes('class="auth-stage"'), 'GET /login: AI auth layout missing');
assert(!result.body.includes('QQAIbot'), 'GET /login: legacy product branding must not leak');
assert(!result.body.includes('${css}'), 'GET /login: literal CSS template placeholder leaked');

result = await get('/register');
assert(result.response.status === 200, 'GET /register: expected 200');
assert(result.body.includes('第一次使用：建立帳號'), 'GET /register: activation page missing');
assert(result.body.includes('id="qqid"'), 'GET /register: first-activation QQID input missing');
assert(/<style>\s*:root\{\s*color-scheme:dark;/.test(result.body), 'GET /register: futuristic public CSS must be materialized');
assert(result.body.includes('class="auth-stage"'), 'GET /register: AI activation layout missing');
assert(!result.body.includes('QQAIbot'), 'GET /register: legacy product branding must not leak');
assert(!result.body.includes('${css}'), 'GET /register: literal CSS template placeholder leaked');

result = await get('/portal');
assert(result.response.status === 302, 'GET /portal without session: expected redirect');
assert(String(result.response.headers.get('location') || '').includes('/login?next='), 'GET /portal: expected login redirect');

result = await get('/matrix');
assert(result.response.status === 302, 'GET /matrix: expected redirect');
assert(String(result.response.headers.get('location') || '').endsWith('/portal#memory'), 'GET /matrix: expected /portal#memory redirect');

result = await get('/appeal');
assert(result.response.status === 302, 'GET /appeal: expected redirect');
assert(String(result.response.headers.get('location') || '').endsWith('/portal#appeals'), 'GET /appeal: expected /portal#appeals redirect');

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

console.log(`verify-routes: ok (${exact.size + 6} routes)`);
