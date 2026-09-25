import assert from "node:assert/strict";
import { rewriteV3TestSql, withV3TestDatabaseNamespace } from "./src/v3/testing/db-namespace.js";

assert.equal(
  rewriteV3TestSql("SELECT value FROM kv_store WHERE key = ?", "kv_store_v3test_20260924"),
  "SELECT value FROM kv_store_v3test_20260924 WHERE key = ?"
);
const prepared=[];
const base={
  prepare(sql){ prepared.push(sql); return { bind(){ return this; }, async first(){ return null; } }; },
  batch(x){ return x; },
  exec(sql){ prepared.push(sql); return Promise.resolve(); },
  dump(){ return Promise.resolve(new ArrayBuffer(0)); }
};
const env=withV3TestDatabaseNamespace({DB:base,V3_TEST_DB_TABLE:"kv_store_v3test_20260924"});
env.DB.prepare("SELECT value FROM kv_store WHERE key = ?");
assert.match(prepared[0], /kv_store_v3test_20260924/);
assert.throws(()=>withV3TestDatabaseNamespace({DB:base,V3_TEST_DB_TABLE:"kv_store;DROP TABLE kv_store"}),/INVALID_V3_TEST_DB_TABLE/);
console.log("verify-v3-test-db-namespace: ok");
