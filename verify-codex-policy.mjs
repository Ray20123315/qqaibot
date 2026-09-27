import assert from "node:assert/strict";
import {
  consumePublicCodexQuota,
  publicCodexQuotaConfig,
  publicCodexQuotaKey,
  readPublicCodexQuota,
  refundPublicCodexQuota
} from "./src/v3/ai/codex-policy.js";

function fakeDb() {
  const values = new Map();
  return {
    values,
    prepare(sql) {
      let binds = [];
      return {
        bind(...args) { binds = args; return this; },
        async first() {
          const key = String(binds[0] || "");
          if (sql.startsWith("SELECT value")) return values.has(key) ? { value: values.get(key) } : null;
          if (sql.startsWith("INSERT INTO kv_store")) {
            const limit = Number(binds[1]);
            const current = Number(values.get(key) || 0);
            if (current >= limit) return null;
            const next = current + 1;
            values.set(key, String(next));
            return { used: next };
          }
          throw new Error("unexpected first SQL");
        },
        async run() {
          const key = String(binds[0] || "");
          if (sql.startsWith("UPDATE kv_store")) {
            const current = Number(values.get(key) || 0);
            values.set(key, String(Math.max(0, current - 1)));
            return { success: true, meta: { changes: 1 } };
          }
          throw new Error("unexpected run SQL");
        }
      };
    }
  };
}

const DB = fakeDb();
const env = { DB, CODEX_PUBLIC_DAILY_REQUESTS: "2", CODEX_PUBLIC_MAX_OUTPUT_TOKENS: "900" };
assert.equal(publicCodexQuotaConfig(env).dailyRequests, 2);
assert.equal(publicCodexQuotaConfig(env).maxOutputTokens, 900);
assert.match(publicCodexQuotaKey("12345", Date.UTC(2026, 8, 27)), /^codex_public_quota:/);

let state = await readPublicCodexQuota(env, "12345", Date.UTC(2026, 8, 27));
assert.equal(state.remaining, 2);
state = await consumePublicCodexQuota(env, "12345", Date.UTC(2026, 8, 27));
assert.equal(state.ok, true);
assert.equal(state.remaining, 1);
state = await consumePublicCodexQuota(env, "12345", Date.UTC(2026, 8, 27));
assert.equal(state.ok, true);
assert.equal(state.remaining, 0);
state = await consumePublicCodexQuota(env, "12345", Date.UTC(2026, 8, 27));
assert.equal(state.ok, false);
assert.equal(state.code, "CODEX_PUBLIC_DAILY_QUOTA_EXHAUSTED");
assert.equal(await refundPublicCodexQuota(env, "12345", Date.UTC(2026, 8, 27)), true);
state = await readPublicCodexQuota(env, "12345", Date.UTC(2026, 8, 27));
assert.equal(state.remaining, 1);

console.log("Public Codex per-user daily quota checks passed.");