import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import {
  bytesToBase64Url,
  distributionSigningText,
  normalizeEd25519PublicJwk,
  normalizeSignedPluginDistribution,
  verifyDistributionArtifact,
  verifyDistributionSignature
} from "./src/plugins/distribution.js";
import { sha256Hex } from "./src/plugins/package.js";
import { PLUGIN_AUTHOR_TRUST_KEY, createPluginAuthorTrustStore } from "./src/plugins/trust.js";
import { PLUGIN_QUARANTINE_KEY, createPluginQuarantine } from "./src/plugins/quarantine.js";

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const artifact = new TextEncoder().encode("self-made-plugin-artifact-v1");
const hash = await sha256Hex(artifact);
const pair = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
const publicJwk = normalizeEd25519PublicJwk(await crypto.subtle.exportKey("jwk", pair.publicKey));

const unsigned = {
  schemaVersion: 1,
  descriptor: {
    id: "self.demo.plugin",
    name: "Self Demo",
    version: "1.0.0",
    apiVersion: "1",
    minQQAI: "3.0.0",
    entry: "dist/index.js",
    integrity: "sha256:" + hash,
    capabilities: ["message.read"],
    dependencies: {},
    optionalDependencies: {}
  },
  artifact: {
    url: "https://plugins.example.com/releases/v1.0.0/plugin.zip",
    immutableRef: "v1.0.0",
    mediaType: "application/zip",
    sizeBytes: artifact.byteLength
  },
  publisher: { keyId: "author.demo:key1", name: "Demo Author" },
  repositoryUrl: "https://github.com/example/self-demo",
  signature: { algorithm: "Ed25519", keyId: "author.demo:key1", value: "A".repeat(86) }
};
const temp = normalizeSignedPluginDistribution(unsigned);
const signature = await crypto.subtle.sign({ name: "Ed25519" }, pair.privateKey, new TextEncoder().encode(distributionSigningText(temp)));
const signed = normalizeSignedPluginDistribution({
  ...temp,
  signature: { algorithm: "Ed25519", keyId: "author.demo:key1", value: bytesToBase64Url(new Uint8Array(signature)) }
});

assert.equal((await verifyDistributionSignature(signed, publicJwk)).ok, true);
assert.equal((await verifyDistributionArtifact(signed, artifact)).ok, true);

const tampered = JSON.parse(JSON.stringify(signed));
tampered.artifact.immutableRef = "v1.0.1";
assert.equal((await verifyDistributionSignature(tampered, publicJwk)).ok, false);
await assert.rejects(() => verifyDistributionArtifact(signed, new TextEncoder().encode("tampered")), /PLUGIN_ARTIFACT_SIZE_MISMATCH|PLUGIN_ARTIFACT_HASH_MISMATCH/);
assert.throws(() => normalizeEd25519PublicJwk({ ...publicJwk, d: "secret" }), /PLUGIN_AUTHOR_PRIVATE_KEY_FORBIDDEN/);
assert.throws(() => normalizeSignedPluginDistribution({ ...signed, artifact: { ...signed.artifact, url: "http://localhost/plugin.zip" } }), /PLUGIN_DISTRIBUTION_HTTPS_REQUIRED|PLUGIN_DISTRIBUTION_URL_UNSAFE/);

const db = new Map();
const reads = [];
const storage = {
  async get(key){ reads.push(key); return db.has(key) ? db.get(key) : null; },
  async put(key,value){ db.set(key,value); },
  async del(key){ db.delete(key); }
};
let now = 1000;
const trust = createPluginAuthorTrustStore(storage, { nowProvider:()=>now });
await trust.trust({ keyId:"author.demo:key1", label:"Demo Author", publicKeyJwk:publicJwk, pluginIds:["self.demo.plugin"] }, "42");
assert.equal((await trust.requireTrusted("author.demo:key1","self.demo.plugin")).status, "trusted");
await assert.rejects(() => trust.requireTrusted("author.demo:key1","other.plugin"), /PLUGIN_AUTHOR_KEY_SCOPE_DENIED/);

let fetchCalls = 0;
const quarantine = createPluginQuarantine(storage, {
  trustStore: trust,
  nowProvider:()=>now,
  idProvider:()=> "q-1",
  fetchArtifact: async (url, options) => {
    fetchCalls += 1;
    assert.equal(url, signed.artifact.url);
    assert.equal(options.maxBytes, artifact.byteLength);
    return { bytes: artifact, mediaType:"application/zip" };
  }
});
const record = await quarantine.verifyAndQuarantine(signed, "42");
assert.equal(record.state, "verified");
assert.equal(record.verification.signatureVerified, true);
assert.equal(record.verification.artifactVerified, true);
assert.equal(fetchCalls, 1);
assert.equal((await quarantine.approve("q-1","42")).state, "approved");
assert.equal((await quarantine.reject("q-1","42","manual review")).state, "rejected");

const persisted = [...db.values()].join("\n");
assert.equal(persisted.includes("self-made-plugin-artifact-v1"), false, "quarantine must not persist artifact bytes/source");
assert.equal(db.has(PLUGIN_AUTHOR_TRUST_KEY), true);
assert.equal(db.has(PLUGIN_QUARANTINE_KEY), true);
assert(reads.every(key => [PLUGIN_AUTHOR_TRUST_KEY, PLUGIN_QUARANTINE_KEY].includes(key)), "trust/quarantine use exact keys only");

now = 2000;
await trust.revoke("author.demo:key1","42");
await assert.rejects(() => quarantine.verifyAndQuarantine(signed,"42"), /PLUGIN_AUTHOR_KEY_REVOKED/);

const untrustedPair = await crypto.subtle.generateKey({ name:"Ed25519" }, true, ["sign","verify"]);
const untrustedPublic = normalizeEd25519PublicJwk(await crypto.subtle.exportKey("jwk", untrustedPair.publicKey));
const badSignature = await crypto.subtle.sign({ name:"Ed25519" }, untrustedPair.privateKey, new TextEncoder().encode(distributionSigningText(temp)));
const bad = normalizeSignedPluginDistribution({ ...temp, signature:{ algorithm:"Ed25519", keyId:"author.demo:key1", value:bytesToBase64Url(new Uint8Array(badSignature)) } });
await trust.trust({ keyId:"author.demo:key1", label:"Demo Author", publicKeyJwk:publicJwk, pluginIds:["self.demo.plugin"] }, "42");
assert.equal((await verifyDistributionSignature(bad, untrustedPublic)).ok, true);
assert.equal((await verifyDistributionSignature(bad, publicJwk)).ok, false);
await assert.rejects(() => quarantine.verifyAndQuarantine(bad,"42"), /PLUGIN_SIGNATURE_INVALID/);

console.log("verify-v3-external-plugin-distribution: ok");
