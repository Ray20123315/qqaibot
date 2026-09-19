import assert from "node:assert/strict";
import { handleV3PackageManagerApi, listPortalPackageState } from "./src/v3/portal/package-manager.js";
import { trustedBundledPluginCatalog } from "./src/plugins/catalog.js";

const db = new Map();
let now = 1000;
let tx = 0;
const storageAdapter = {
  async get(key){ return db.has(key) ? db.get(key) : null; },
  async put(key,value){ db.set(key,value); },
  async del(key){ db.delete(key); }
};
const env = { V3_RUNTIME_ENABLED:"false", V3_BILIBILI_ENABLED:"false" };
const overrides = {
  storageAdapter,
  qqaiVersion:"3.0.0",
  nowProvider:()=>now,
  transactionIdProvider:()=> "tx-" + (++tx),
  getSession:async()=>({qq:"42"}),
  isDeveloper:()=>true
};

let response = await handleV3PackageManagerApi(new Request("https://example.com/api/portal/v3/packages"), env, null, overrides);
assert.equal(response.status,200);
let payload = await response.json();
assert.equal(payload.ok,true);
assert.equal(payload.catalogCount,1);
assert.equal(payload.packages[0].metadataInstalled,false);
assert.equal(payload.packages[0].runtimeCodeBundled,true);
assert.equal(payload.packages[0].runtimeCodeLoaded,null);
assert.match(payload.notice,/does not load JavaScript/);

response = await handleV3PackageManagerApi(new Request("https://example.com/api/portal/v3/packages/official.bilibili-live/stage",{
  method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"install"})
}),env,null,overrides);
assert.equal(response.status,200);
payload = await response.json();
assert.equal(payload.transaction.type,"install");
assert.equal(payload.state.packages[0].metadataInstalled,false);
assert.equal(payload.state.staged.length,1);

response = await handleV3PackageManagerApi(new Request("https://example.com/api/portal/v3/packages/transactions/tx-1/commit",{method:"POST"}),env,null,overrides);
assert.equal(response.status,200);
payload=await response.json();
assert.equal(payload.state.packages[0].metadataInstalled,true);
assert.equal(payload.state.packages[0].verifiedHash,trustedBundledPluginCatalog()[0].sourceSha256);
assert.equal(payload.state.staged.length,0);

response = await handleV3PackageManagerApi(new Request("https://example.com/api/portal/v3/packages/official.bilibili-live/stage",{
  method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"install"})
}),env,null,overrides);
assert.equal(response.status,400);
assert.equal((await response.json()).code,"PLUGIN_PACKAGE_ACTION_MISMATCH");

response = await handleV3PackageManagerApi(new Request("https://example.com/api/portal/v3/packages/official.bilibili-live/stage",{
  method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"uninstall"})
}),env,null,overrides);
assert.equal(response.status,200);
payload=await response.json();
assert.equal(payload.transaction.type,"uninstall");

response = await handleV3PackageManagerApi(new Request("https://example.com/api/portal/v3/packages/transactions/tx-2",{method:"DELETE"}),env,null,overrides);
assert.equal(response.status,200);
payload=await response.json();
assert.equal(payload.state.staged.length,0);
assert.equal(payload.state.packages[0].metadataInstalled,true);

response = await handleV3PackageManagerApi(new Request("https://example.com/api/portal/v3/packages/official.bilibili-live/stage",{
  method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"uninstall"})
}),env,null,overrides);
assert.equal(response.status,200);
response = await handleV3PackageManagerApi(new Request("https://example.com/api/portal/v3/packages/transactions/tx-3/commit",{method:"POST"}),env,null,overrides);
assert.equal(response.status,200);
payload=await response.json();
assert.equal(payload.state.packages[0].metadataInstalled,false);
const uninstallHistory = payload.state.history.find(row=>row.id==="tx-3");
assert(uninstallHistory);

response = await handleV3PackageManagerApi(new Request("https://example.com/api/portal/v3/packages/history/tx-3/rollback",{method:"POST"}),env,null,overrides);
assert.equal(response.status,200);
payload=await response.json();
assert.equal(payload.state.packages[0].metadataInstalled,true);
assert.equal(payload.result.transaction.type,"rollback");

const stored = [...db.values()].join("\n");
assert.equal(stored.includes("function createBilibiliLivePlugin"), false, "package lock must not persist runtime JavaScript source");
assert.equal(stored.includes("Webhook-free Bilibili live-status polling"), false, "package lock must not persist source/body text");

const unauthOverrides = { ...overrides, getSession:async()=>null };
response = await handleV3PackageManagerApi(new Request("https://example.com/api/portal/v3/packages"),env,null,unauthOverrides);
assert.equal(response.status,401);

const nonDevOverrides = { ...overrides, isDeveloper:()=>false };
response = await handleV3PackageManagerApi(new Request("https://example.com/api/portal/v3/packages"),env,null,nonDevOverrides);
assert.equal(response.status,403);

const state = await listPortalPackageState(env,overrides);
assert.equal(state.packages[0].runtimeCandidateConfigured,false);
console.log("verify-v3-portal-package-manager: ok");
