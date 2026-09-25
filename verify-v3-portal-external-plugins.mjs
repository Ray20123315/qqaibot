import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import {
  bytesToBase64Url,
  distributionSigningText,
  normalizeSignedPluginDistribution
} from "./src/plugins/distribution.js";
import { sha256Hex } from "./src/plugins/package.js";
import { handleV3PackageManagerApi, injectV3PackageManagerClient } from "./src/v3/portal/package-manager.js";

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const db = new Map();
let now = 1000;
const artifact = new TextEncoder().encode("portal-self-made-plugin-v1");
const hash = await sha256Hex(artifact);
const pair = await crypto.subtle.generateKey({ name:"Ed25519" }, true, ["sign","verify"]);
const publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
const placeholder = normalizeSignedPluginDistribution({
  schemaVersion:1,
  descriptor:{
    id:"self.portal.demo",
    name:"Portal Self Demo",
    version:"1.0.0",
    apiVersion:"1",
    minQQAI:"3.0.0",
    entry:"dist/index.js",
    integrity:"sha256:"+hash,
    capabilities:["message.read"],
    dependencies:{},
    optionalDependencies:{}
  },
  artifact:{
    url:"https://plugins.example.com/self.portal.demo/v1.0.0/plugin.zip",
    immutableRef:"v1.0.0",
    mediaType:"application/zip",
    sizeBytes:artifact.byteLength
  },
  publisher:{keyId:"portal.author:key1",name:"Portal Author"},
  repositoryUrl:"https://github.com/example/self-portal-demo",
  signature:{algorithm:"Ed25519",keyId:"portal.author:key1",value:"A".repeat(86)}
});
const sig = await crypto.subtle.sign({name:"Ed25519"},pair.privateKey,new TextEncoder().encode(distributionSigningText(placeholder)));
const distribution = normalizeSignedPluginDistribution({
  ...placeholder,
  signature:{algorithm:"Ed25519",keyId:"portal.author:key1",value:bytesToBase64Url(new Uint8Array(sig))}
});

let qCounter=0;
const overrides={
  storageAdapter:{
    async get(key){return db.has(key)?db.get(key):null},
    async put(key,value){db.set(key,value)},
    async del(key){db.delete(key)}
  },
  getSession:async()=>({qq:"42"}),
  isDeveloper:()=>true,
  nowProvider:()=>now,
  quarantineIdProvider:()=> "q-"+(++qCounter),
  fetchExternalArtifact:async(url,options)=>{
    assert.equal(url,distribution.artifact.url);
    assert.equal(options.maxBytes,artifact.byteLength);
    return {bytes:artifact,mediaType:"application/zip"};
  }
};

let response=await handleV3PackageManagerApi(new Request("https://example.com/api/portal/v3/packages/external"),{},null,overrides);
assert.equal(response.status,200);
let payload=await response.json();
assert.equal(payload.authors.length,0);
assert.equal(payload.quarantine.length,0);

response=await handleV3PackageManagerApi(new Request("https://example.com/api/portal/v3/packages/authors",{
  method:"POST",headers:{"content-type":"application/json"},
  body:JSON.stringify({keyId:"portal.author:key1",label:"Portal Author",pluginIds:["self.portal.demo"],publicKeyJwk:publicJwk})
}),{},null,overrides);
assert.equal(response.status,200);
payload=await response.json();
assert.equal(payload.author.status,"trusted");
assert.equal(payload.state.authors.length,1);
assert.equal(payload.author.publicKeyJwk.d,undefined);

response=await handleV3PackageManagerApi(new Request("https://example.com/api/portal/v3/packages/authors",{
  method:"POST",headers:{"content-type":"application/json"},
  body:JSON.stringify({keyId:"bad.private:key1",label:"Bad",publicKeyJwk:{...publicJwk,d:"secret"}})
}),{},null,overrides);
assert.equal(response.status,400);
assert.equal((await response.json()).code,"PLUGIN_AUTHOR_PRIVATE_KEY_FORBIDDEN");

response=await handleV3PackageManagerApi(new Request("https://example.com/api/portal/v3/packages/external/verify",{
  method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({distribution})
}),{},null,overrides);
assert.equal(response.status,200);
payload=await response.json();
assert.equal(payload.entry.state,"verified");
assert.equal(payload.entry.verification.signatureVerified,true);
assert.equal(payload.entry.verification.artifactVerified,true);
assert.equal(payload.state.quarantine.length,1);

response=await handleV3PackageManagerApi(new Request("https://example.com/api/portal/v3/packages/external/q-1/approve",{method:"POST"}),{},null,overrides);
assert.equal(response.status,200);
payload=await response.json();
assert.equal(payload.entry.state,"approved");

response=await handleV3PackageManagerApi(new Request("https://example.com/api/portal/v3/packages/external/q-1/reject",{
  method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({reason:"manual rejection"})
}),{},null,overrides);
assert.equal(response.status,200);
payload=await response.json();
assert.equal(payload.entry.state,"rejected");
assert.equal(payload.entry.rejectionReason,"manual rejection");

response=await handleV3PackageManagerApi(new Request("https://example.com/api/portal/v3/packages/authors/portal.author%3Akey1/revoke",{method:"POST"}),{},null,overrides);
assert.equal(response.status,200);
assert.equal((await response.json()).author.status,"revoked");

response=await handleV3PackageManagerApi(new Request("https://example.com/api/portal/v3/packages/external/verify",{
  method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({distribution})
}),{},null,overrides);
assert.equal(response.status,400);
assert.equal((await response.json()).code,"PLUGIN_AUTHOR_KEY_REVOKED");

response=await handleV3PackageManagerApi(new Request("https://example.com/api/portal/v3/packages/external/q-1",{method:"DELETE"}),{},null,overrides);
assert.equal(response.status,200);
assert.equal((await response.json()).state.quarantine.length,0);

response=await handleV3PackageManagerApi(new Request("https://example.com/api/portal/v3/packages/authors/portal.author%3Akey1",{method:"DELETE"}),{},null,overrides);
assert.equal(response.status,200);
assert.equal((await response.json()).state.authors.length,0);

const persisted=[...db.values()].join("\n");
assert.equal(persisted.includes("portal-self-made-plugin-v1"),false,"Portal quarantine must not persist artifact bytes");

const html='<html><head></head><body><div id="v3PluginManagerNav"></div><div id="v3PluginList" class="v3-plugin-grid"></div></body></html>';
const injected=injectV3PackageManagerClient(html);
assert.match(injected,/自制／外部插件/);
assert.match(injected,/v3AuthorPublicJwk/);
assert.match(injected,/v3ExternalDistribution/);
assert.match(injected,/qqai-v3-external-plugin-client/);
assert.match(injected,/加入信任库/);
assert.match(injected,/外部插件隔离区/);
assert.match(injected,/data-q-accept-risk/);
assert.match(injected,/不可强制加载|不可自行承担|系统性/);
assert.doesNotMatch(injected,/Self-made \/ External Plugins|加入 Trust Store|>Quarantine<|不可強制載入|不可自行承擔|系統性/);
assert.equal(injectV3PackageManagerClient(injected),injected);

console.log("verify-v3-portal-external-plugins: ok");
