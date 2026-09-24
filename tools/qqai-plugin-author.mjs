#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { webcrypto } from "node:crypto";
import {
  bytesToBase64Url,
  distributionSigningText,
  normalizeEd25519PublicJwk,
  normalizeSignedPluginDistribution,
  verifyDistributionArtifact,
  verifyDistributionSignature
} from "../src/plugins/distribution.js";
import { normalizePluginPackageDescriptor, sha256Hex } from "../src/plugins/package.js";

if (!globalThis.crypto) globalThis.crypto = webcrypto;

function die(message) {
  console.error(message);
  process.exit(1);
}

function args(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const value = argv[i];
    if (!value.startsWith("--")) { out._.push(value); continue; }
    const key = value.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) out[key] = true;
    else { out[key] = next; i += 1; }
  }
  return out;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.resolve(file), "utf8"));
}

function writeJson(file, value, mode = 0o644) {
  const target = path.resolve(file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(value, null, 2) + "\n", { mode });
}

async function keygen(options) {
  const prefix = String(options.out || ".qqai-author").trim();
  const pair = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  const publicJwk = normalizeEd25519PublicJwk(await crypto.subtle.exportKey("jwk", pair.publicKey));
  const privateJwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  writeJson(prefix + ".public.jwk", publicJwk, 0o644);
  writeJson(prefix + ".private.jwk", privateJwk, 0o600);
  console.log("created", prefix + ".public.jwk", "and", prefix + ".private.jwk");
  console.log("Keep the private JWK secret. Only import the public JWK into QQAI.");
}

async function sign(options) {
  for (const name of ["manifest","artifact","artifact-url","immutable-ref","key","key-id","out"]) if (!options[name]) die("--" + name + " is required");
  const manifest = readJson(options.manifest);
  const artifact = fs.readFileSync(path.resolve(options.artifact));
  const integrity = "sha256:" + await sha256Hex(artifact);
  const descriptor = normalizePluginPackageDescriptor({ ...manifest, integrity });
  const privateJwk = readJson(options.key);
  if (privateJwk.kty !== "OKP" || privateJwk.crv !== "Ed25519" || !privateJwk.d) die("private key must be an Ed25519 JWK");
  const unsigned = {
    schemaVersion: 1,
    descriptor,
    artifact: {
      url: String(options["artifact-url"]),
      immutableRef: String(options["immutable-ref"]),
      mediaType: String(options["media-type"] || "application/zip"),
      sizeBytes: artifact.byteLength
    },
    publisher: {
      keyId: String(options["key-id"]).toLowerCase(),
      name: String(options["publisher"] || manifest.author || "")
    },
    repositoryUrl: String(options["repository-url"] || ""),
    signature: {
      algorithm: "Ed25519",
      keyId: String(options["key-id"]).toLowerCase(),
      value: "A".repeat(86)
    }
  };
  const temporary = normalizeSignedPluginDistribution(unsigned);
  const key = await crypto.subtle.importKey("jwk", privateJwk, { name: "Ed25519" }, false, ["sign"]);
  const signature = await crypto.subtle.sign({ name: "Ed25519" }, key, new TextEncoder().encode(distributionSigningText(temporary)));
  const signed = normalizeSignedPluginDistribution({
    ...temporary,
    signature: { algorithm: "Ed25519", keyId: temporary.signature.keyId, value: bytesToBase64Url(new Uint8Array(signature)) }
  });
  writeJson(options.out, signed);
  console.log("signed", signed.descriptor.id, signed.descriptor.version, "->", options.out);
}

async function verify(options) {
  for (const name of ["distribution","public-key","artifact"]) if (!options[name]) die("--" + name + " is required");
  const distribution = readJson(options.distribution);
  const publicJwk = readJson(options["public-key"]);
  const signature = await verifyDistributionSignature(distribution, publicJwk);
  if (!signature.ok) die("signature verification failed");
  const artifact = fs.readFileSync(path.resolve(options.artifact));
  await verifyDistributionArtifact(distribution, artifact);
  console.log("ok:", distribution.descriptor?.id, distribution.descriptor?.version);
}

const options = args(process.argv.slice(2));
const command = options._[0];
if (command === "keygen") await keygen(options);
else if (command === "sign") await sign(options);
else if (command === "verify") await verify(options);
else {
  console.log([
    "QQAI self-made plugin author tool",
    "",
    "keygen:",
    "  node tools/qqai-plugin-author.mjs keygen --out .qqai-author",
    "",
    "sign:",
    "  node tools/qqai-plugin-author.mjs sign --manifest qqai-plugin.json --artifact plugin.zip --artifact-url https://example.com/plugin.zip --immutable-ref v1.0.0 --key .qqai-author.private.jwk --key-id yourname:key1 --out qqai-distribution.json",
    "",
    "verify:",
    "  node tools/qqai-plugin-author.mjs verify --distribution qqai-distribution.json --public-key .qqai-author.public.jwk --artifact plugin.zip"
  ].join("\n"));
}
