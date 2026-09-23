import assert from "node:assert/strict";
import portalWorker from "./worker.js";
import {
  createPortalAccountBinding,
  createPortalPasswordRecord,
  createPortalSession,
  readPasswordLoginGuard
} from "./src/portal/auth.js";

class FakeD1 {
  constructor() { this.map = new Map(); }
  prepare(sql) {
    const db = this;
    return {
      bind(...args) {
        return {
          async first() {
            if (!/^SELECT value FROM kv_store WHERE key = \?$/.test(sql)) throw new Error("unexpected SQL: " + sql);
            return db.map.has(args[0]) ? { value: db.map.get(args[0]) } : null;
          },
          async run() {
            if (sql.includes("ON CONFLICT(key) DO NOTHING")) {
              if (db.map.has(args[0])) return { success: true, meta: { changes: 0 } };
              db.map.set(args[0], args[1]);
              return { success: true, meta: { changes: 1 } };
            }
            if (sql.includes("ON CONFLICT(key) DO UPDATE SET value = excluded.value")) {
              db.map.set(args[0], args[1]);
              return { success: true, meta: { changes: 1 } };
            }
            if (/^DELETE FROM kv_store WHERE key = \?$/.test(sql)) {
              const existed = db.map.delete(args[0]);
              return { success: true, meta: { changes: existed ? 1 : 0 } };
            }
            throw new Error("unexpected SQL: " + sql);
          }
        };
      }
    };
  }
}

const ctx = { waitUntil() {}, passThroughOnException() {} };
const allowAll = { async limit() { return { success: true }; } };

async function post(path, body, env) {
  return portalWorker.fetch(new Request(`https://aibot.ray2025.com${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }), env, ctx);
}

const db = new FakeD1();
const password = "CorrectHorseBatteryStaple-2026";
await createPortalAccountBinding({ DB: db }, { qq: "123456789", username: "member" });
db.map.set("portal_auth_password:123456789", JSON.stringify(await createPortalPasswordRecord(password)));
const loginKeys = [];
const env = {
  DB: db,
  MY_RATE_LIMITER: { async limit({ key }) { loginKeys.push(key); return { success: true }; } }
};

for (let attempt = 1; attempt <= 5; attempt += 1) {
  const response = await post("/api/auth/request-login-factor", { username: "member", password: "wrong-password" }, env);
  assert.equal(response.status, 401, `factor request ${attempt} should reject a wrong password`);
}
const guard = await readPasswordLoginGuard(env, "123456789");
assert(guard.lockUntil > Date.now(), "five failed factor requests must activate the shared login lockout");

const factorWhileLocked = await post("/api/auth/request-login-factor", { username: "member", password }, env);
assert.equal(factorWhileLocked.status, 429, "request-login-factor must honor the password login lockout");
assert.equal((await factorWhileLocked.json()).code, "PASSWORD_LOGIN_LOCKED");
const passwordWhileLocked = await post("/api/auth/login-password", { username: "member", password }, env);
assert.equal(passwordWhileLocked.status, 429, "password login must share that same lockout");
assert.equal((await passwordWhileLocked.json()).code, "PASSWORD_LOGIN_LOCKED");
assert(new Set(loginKeys).size === 1, "login and factor endpoints must consume the same per-account Cloudflare rate-limit key");

const rejectedDb = new FakeD1();
let deniedTransportCalls = 0;
const deniedCodeResponse = await post("/api/auth/request-code", { qq: "987654321" }, {
  DB: rejectedDb,
  MY_RATE_LIMITER: { async limit() { return { success: false }; } },
  ONEBOT_HUB: { idFromName() { return "default"; }, get() { return { async fetch() { deniedTransportCalls += 1; throw new Error("must not send"); } }; } }
});
assert.equal(deniedCodeResponse.status, 429, "rate-limited verification-code requests must return 429");
assert.equal(rejectedDb.map.size, 0, "rate limiting must happen before writing a verification code");
assert.equal(deniedTransportCalls, 0, "rate limiting must happen before contacting OneBot");

const unconfiguredLimiterResponse = await post("/api/auth/request-code", { qq: "987654321" }, { DB: new FakeD1() });
assert.equal(unconfiguredLimiterResponse.status, 503, "authentication routes must fail closed without the production limiter binding");

const liveDb = new FakeD1();
const adminSession = await createPortalSession({ DB: liveDb }, { qq: "222333444", username: "admin", persistent: false });
const unauthenticatedLive = await portalWorker.fetch(new Request("https://aibot.ray2025.com/live"), { DB: liveDb }, ctx);
assert.equal(unauthenticatedLive.status, 302, "public Live page must require an admin or Developer session");
const authorizedLivePage = await portalWorker.fetch(new Request("https://aibot.ray2025.com/live", {
  headers: { Cookie: `qqai_session=${adminSession.token}` }
}), { DB: liveDb }, ctx);
assert.equal(authorizedLivePage.status, 200, "system admin session must retain access to the Live page");

const rejectedLiveUpgrade = await portalWorker.fetch(new Request("https://aibot.ray2025.com/live", {
  headers: { Upgrade: "websocket", Origin: "https://aibot.ray2025.com", Cookie: `qqai_session=${adminSession.token}` }
}), {
  DB: liveDb,
  MY_RATE_LIMITER: { async limit() { return { success: false }; } }
}, ctx);
assert.equal(rejectedLiveUpgrade.status, 429, "Live WebSocket connections must be rate-limited before opening upstream sockets");

const crossOriginLiveUpgrade = await portalWorker.fetch(new Request("https://aibot.ray2025.com/live", {
  headers: { Upgrade: "websocket", Origin: "https://attacker.example" }
}), { DB: liveDb }, ctx);
assert.equal(crossOriginLiveUpgrade.status, 403, "Live WebSocket upgrades must reject cross-origin requests");

for (const path of ["/health", "/healthz"]) {
  const response = await portalWorker.fetch(new Request(`https://aibot.ray2025.com${path}`), {}, ctx);
  assert.equal(response.status, 200);
  assert.deepEqual(Object.keys(await response.json()).sort(), ["ok", "service", "version"], "public health must expose only minimal liveness data");
}

console.log("verify-portal-auth-hardening: ok");
