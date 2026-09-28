import assert from "node:assert/strict";
import fs from "node:fs";
import {
  configuredDatabaseTable,
  normalizeDatabaseTableName,
  rewriteDatabaseSql,
  withConfiguredDatabaseNamespace
} from "./src/data/db-namespace.js";
import { withV3TestDatabaseNamespace } from "./src/v3/testing/db-namespace.js";

assert.equal(normalizeDatabaseTableName("kv_store_v4public_preview"), "kv_store_v4public_preview");
assert.throws(() => normalizeDatabaseTableName("kv_store;DROP TABLE kv_store"), /INVALID_DATABASE_TABLE_NAMESPACE/);
assert.equal(
  rewriteDatabaseSql("SELECT value FROM kv_store WHERE key = ?", "kv_store_v4public_preview"),
  "SELECT value FROM kv_store_v4public_preview WHERE key = ?"
);
assert.equal(configuredDatabaseTable({ QQAI_DB_TABLE: "kv_store_v4public_preview" }), "kv_store_v4public_preview");
assert.equal(configuredDatabaseTable({ V3_TEST_DB_TABLE: "kv_store_v3test_20260924" }), "kv_store_v3test_20260924");

const prepared=[];
const execs=[];
const base={
  prepare(sql){
    prepared.push(String(sql));
    return { bind(){ return this; }, first(){ return Promise.resolve(null); }, all(){ return Promise.resolve({results:[]}); }, run(){ return Promise.resolve({success:true}); } };
  },
  batch(statements){ return Promise.resolve(statements); },
  exec(sql){ execs.push(String(sql)); return Promise.resolve({}); },
  dump(){ return Promise.resolve(new ArrayBuffer(0)); }
};
const env=withConfiguredDatabaseNamespace({DB:base,QQAI_DB_TABLE:"kv_store_v4public_preview",OTHER:"kept"});
env.DB.prepare("SELECT value FROM kv_store WHERE key = ?");
env.DB.exec("DELETE FROM kv_store WHERE key = 'x'");
assert.match(prepared[0], /kv_store_v4public_preview/);
assert.match(execs[0], /kv_store_v4public_preview/);
assert.equal(env.OTHER, "kept");
assert.equal(env.QQAI_ACTIVE_DB_TABLE, "kv_store_v4public_preview");

const v3env=withV3TestDatabaseNamespace({DB:base,V3_TEST_DB_TABLE:"kv_store_v3test_20260924"});
v3env.DB.prepare("SELECT value FROM kv_store WHERE key = ?");
assert.match(prepared.at(-1), /kv_store_v3test_20260924/);

const worker=fs.readFileSync("worker.js","utf8");
assert.match(worker,/import \{ withConfiguredDatabaseNamespace \} from "\.\/src\/data\/db-namespace\.js";/);
assert.doesNotMatch(worker,/withV3TestDatabaseNamespace\(env\)/);
assert.match(worker,/env = withConfiguredDatabaseNamespace\(env\);/);
assert.match(worker,/this\.env = withConfiguredDatabaseNamespace\(env\);/);

const qqopen=fs.readFileSync("src/v4/qqopen/runtime.js","utf8");
assert.match(qqopen,/withConfiguredDatabaseNamespace/);
assert.match(qqopen,/this\.env = withConfiguredDatabaseNamespace\(env\);/);

const wrangler=fs.readFileSync("wrangler.toml","utf8");
assert.match(wrangler,/\[\[previews\.d1_databases\]\][\s\S]*?binding = "DB"[\s\S]*?database_name = "qqaibot"[\s\S]*?database_id = "569a01fe-3297-40e1-832f-09c3793056ed"/);
assert.match(wrangler,/\[previews\.vars\][\s\S]*?QQAI_DB_TABLE = "kv_store_v4public_preview"/);
assert.match(wrangler,/\[previews\.vars\][\s\S]*?QQ_OPEN_ENABLED = "false"/);
assert.match(wrangler,/\[\[previews\.durable_objects\.bindings\]\][\s\S]*?name = "ONEBOT_HUB"/);
assert.match(wrangler,/\[\[previews\.durable_objects\.bindings\]\][\s\S]*?name = "QQ_OPEN_GATEWAY"/);
const previewSection=wrangler.slice(wrangler.indexOf("# V4 branch Preview:"));
assert.doesNotMatch(previewSection,/\[\[previews\.vectorize\]\]/);

const bootstrap=fs.readFileSync("tools/v4public-preview-bootstrap.sql","utf8");
assert.match(bootstrap,/CREATE TABLE IF NOT EXISTS kv_store_v4public_preview/);
assert.doesNotMatch(bootstrap,/\bDROP\s+(?:TABLE|DATABASE)\b/i);
assert.doesNotMatch(bootstrap,/CREATE TABLE IF NOT EXISTS kv_store\s*\(/);

console.log("verify-v4-preview-db-namespace: ok");
