import crypto from 'node:crypto';
import worker from './worker.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const exact = new Map([
  ['GET https://aibot.ray2025.com/api/public/nebula', [200, '2c0c8c47f8c1bf6065a949b54eb3e92d67a6b3e02421a763c24c955332ae117a']],
  ['GET https://aibot.ray2025.com/api/appeal/legacy', [410, '742af5935f732e949d512573364e3672fcdc6a01ee0c266510b7582bcf46304e']],
]);
const ctx = { waitUntil() {}, passThroughOnException() {} };

async function get(path) {
  const response = await worker.fetch(new Request('https://aibot.ray2025.com' + path, { method: 'GET' }), {}, ctx);
  return { response, body: await response.text() };
}

let legacy = await worker.fetch(new Request('https://qqai.ray2025.com/login', { method: 'GET' }), {}, ctx);
assert(legacy.status === 308, 'legacy HTTP host must redirect to canonical domain');
assert(String(legacy.headers.get('location') || '').startsWith('https://aibot.ray2025.com/login'), 'legacy redirect target must use aibot.ray2025.com');

let live = await get('/live');
assert(live.response.status === 302, 'GET /live: unauthenticated visitors must be redirected to login');
assert(String(live.response.headers.get('location') || '').includes('/login?next=%2Flive'), 'GET /live: login redirect must preserve the destination');

let result = await get('/');
assert(result.response.status === 200, 'GET /: expected 200');
assert(result.body.includes('AI Control Center'), 'GET /: public homepage brand missing');
assert(result.body.includes('href="/login"'), 'GET /: login CTA missing');
assert(result.body.includes('href="/register"'), 'GET /: registration CTA missing');
assert(!result.body.includes('qqai-deployment-toast'), 'GET /: Portal-only deployment client must not be injected into public homepage');
assert(/<style>\s*:root\{\s*color-scheme:dark;/.test(result.body), 'GET /: futuristic public CSS must be materialized');
assert(result.body.includes('class="public-home-v4 ray-landing"'), 'GET /: canonical v6 landing missing');
assert(result.body.includes('class="public-v4-hero ray-landing-hero"'), 'GET /: canonical v6 hero missing');
assert(result.body.includes('class="qqai-brand-logo'), 'GET /: canonical logo missing');
assert(result.body.includes('SMALL CORE · PLUGIN FIRST · BYOR'), 'GET /: plugin-first architecture message missing');
assert(result.body.includes('qqai.community'), 'GET /: plugin family contract missing');
assert(result.body.includes('ray-feature-strip'), 'GET /: canonical v6 feature strip missing');
assert(result.body.includes('qqai-ray-experience-v600'), 'GET /: v6 shared experience missing');
assert(result.body.includes('id="publicTheme"'), 'GET /: public theme toggle missing');
assert(!result.body.includes('2.4K'), 'GET /: fake API metric must not be rendered');
assert(!result.body.includes('class="console-preview"'), 'GET /: legacy dashboard preview must not return');
assert(!result.body.includes('QQAIbot'), 'GET /: legacy product branding must not leak');
assert(!result.body.includes('${css}'), 'GET /: literal CSS template placeholder leaked');

result = await get('/login');
assert(result.response.status === 200, 'GET /login: expected 200');
assert(result.body.includes('data-i18n="login.title"'), 'GET /login: localized account login heading missing');
assert(result.body.includes('id="username"'), 'GET /login: username input missing');
assert(!result.body.includes('id="qqid"'), 'GET /login: QQID must not be a normal login input');
assert(/<style>\s*:root\{\s*color-scheme:dark;/.test(result.body), 'GET /login: futuristic public CSS must be materialized');
assert(result.body.includes('class="auth-stage"'), 'GET /login: AI auth layout missing');
assert(!result.body.includes('QQAIbot'), 'GET /login: legacy product branding must not leak');
assert(!result.body.includes('${css}'), 'GET /login: literal CSS template placeholder leaked');
assert(result.body.includes("get('activated')==='1'"), 'GET /login: activation fallback notice missing');

result = await get('/register');
assert(result.response.status === 200, 'GET /register: expected 200');
assert(result.body.includes('第一次使用：設定登入'), 'GET /register: activation page missing');
assert(result.body.includes('id="qqid"'), 'GET /register: first-activation QQID input missing');
assert(result.body.includes('id="activationMode"'), 'GET /register: activation mode selector missing');
assert(result.body.includes('id="developerUsername"'), 'GET /register: fixed developer username display missing');
assert(result.body.includes('value="admin"'), 'GET /register: reserved admin username missing');
assert(result.body.includes('開發者 / Root：設定 admin 密碼'), 'GET /register: admin password setup option missing');
assert(result.body.includes("accountType:dev?'developer':'member'"), 'GET /register: explicit developer accountType payload missing');
assert(!result.body.includes('id="bootstrapKey"'), 'GET /register: obsolete developer bootstrap key must not exist');
assert(/<style>\s*:root\{\s*color-scheme:dark;/.test(result.body), 'GET /register: futuristic public CSS must be materialized');
assert(result.body.includes('class="auth-stage"'), 'GET /register: AI activation layout missing');
assert(!result.body.includes('QQAIbot'), 'GET /register: legacy product branding must not leak');
assert(!result.body.includes('${css}'), 'GET /register: literal CSS template placeholder leaked');
assert(!result.body.includes('PORTAL_DEVELOPER_INITIAL_PASSWORD'), 'GET /register: removed developer password env must not leak');
assert(result.body.includes("r.redirect||'/portal'"), 'GET /register: activation login fallback redirect missing');
assert(result.body.includes('Failure ID'), 'GET /register: failure identifier UI missing');

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

console.log(`verify-routes: ok (${exact.size + 8} routes)`);
