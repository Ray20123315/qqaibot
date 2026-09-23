import assert from "node:assert/strict";
import portalWorker from "./worker.js";
import { sendPortalVerificationMessage } from "./src/portal/auth.js";

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

function hubBinding({ rpc, connected = false }) {
  return {
    idFromName(name) { return name; },
    get() {
      return {
        async fetch(url) {
          if (String(url).endsWith("/status")) return Response.json({ connected });
          return rpc();
        }
      };
    }
  };
}

const message = "【AI Control Center】验证码：123456";
let delivered = await sendPortalVerificationMessage({
  ONEBOT_HUB: hubBinding({ rpc: () => Response.json({ ok: true, data: { message_id: 1 } }) })
}, "123456789", message);
assert.deepEqual(delivered, { ok: true, transport: "websocket:send_private_msg" });

const originalFetch = globalThis.fetch;
try {
  let httpCalls = 0;
  globalThis.fetch = async () => {
    httpCalls += 1;
    return Response.json({ status: "ok", retcode: 0, data: { message_id: 2 } });
  };
  delivered = await sendPortalVerificationMessage({
    ONEBOT_HUB: hubBinding({ rpc: () => Response.json({ ok: false, error: "NAPCAT_NOT_CONNECTED" }, { status: 503 }) }),
    ONEBOT_HTTP_URL: "https://napcat.example.invalid"
  }, "123456789", message);
  assert.equal(delivered.ok, true, "HTTP fallback must send the code after both WebSocket actions fail");
  assert.equal(delivered.transport, "http:send_private_msg");
  assert.equal(httpCalls, 1);

  globalThis.fetch = async () => { throw new Error("private endpoint secret-value"); };
  const failed = await sendPortalVerificationMessage({
    ONEBOT_HUB: hubBinding({ rpc: () => Response.json({ ok: false, error: "NAPCAT_NOT_CONNECTED token=do-not-log" }, { status: 503 }) }),
    ONEBOT_HTTP_URL: "https://napcat.example.invalid/private-secret"
  }, "123456789", message);
  assert.equal(failed.ok, false);
  assert.equal(failed.websocketConnected, false);
  assert.equal(failed.httpConfigured, true);
  assert(failed.errors.every(error => !error.includes("do-not-log") && !error.includes("private-secret") && !error.includes("secret-value")), "delivery diagnostics must not expose tokens or endpoint URLs");
} finally {
  globalThis.fetch = originalFetch;
}

const failedDb = new FakeD1();
const failedResponse = await portalWorker.fetch(new Request("https://aibot.ray2025.com/api/auth/request-code", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ qq: "123456789" })
}), {
  DB: failedDb,
  MY_RATE_LIMITER: { async limit() { return { success: true }; } },
  ONEBOT_HUB: hubBinding({ rpc: () => Response.json({ ok: false, error: "NAPCAT_NOT_CONNECTED secret-token" }, { status: 503 }) }),
  DEVELOPER_IDS: "123456789"
}, { waitUntil() {}, passThroughOnException() {} });
const failedPayload = await failedResponse.json();
assert.equal(failedResponse.status, 503);
assert.equal(failedPayload.code, "VERIFICATION_DELIVERY_FAILED");
assert.equal(failedPayload.diagnostics.websocketConnected, false);
assert.match(failedPayload.message, /NapCat WebSocket 尚未连线/);
assert.equal(failedDb.map.has("portal_auth_code:123456789"), false, "a code that could not be delivered must not remain valid in D1");
assert(![...failedDb.map.values()].join(" ").includes("secret-token"), "audit records must contain only sanitized delivery error codes");

console.log("verify-portal-verification-delivery: ok");
