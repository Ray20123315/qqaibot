import { normalizePluginPackageDescriptor, sha256Hex } from "./package.js";

const PLUGIN_DISTRIBUTION_SCHEMA_VERSION = 1;
const PLUGIN_SIGNATURE_ALGORITHM = "Ed25519";
const PLUGIN_AUTHOR_KEY_ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{2,119}$/i;
const PLUGIN_IMMUTABLE_REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/@:+-]{2,239}$/;
const PLUGIN_SIGNATURE_VALUE_PATTERN = /^[A-Za-z0-9_-]{80,120}$/;
const PLUGIN_MAX_ARTIFACT_BYTES = 5 * 1024 * 1024;
const PLUGIN_ALLOWED_ARTIFACT_TYPES = Object.freeze([
  "application/zip",
  "application/x-zip-compressed",
  "application/octet-stream",
  "application/javascript",
  "text/javascript"
]);

function cleanText(value, max = 240) {
  return String(value ?? "").trim().slice(0, max);
}

function isPrivateHost(hostname) {
  const h = String(hostname || "").trim().toLowerCase().replace(/^\[|\]$/g, "");
  if (!h || h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return true;
  if (h === "::1" || h.startsWith("fe80:") || h.startsWith("fc") || h.startsWith("fd")) return true;
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const a = m.slice(1).map(Number);
  if (a.some(n => n > 255)) return true;
  return a[0] === 10 || a[0] === 127 || a[0] === 0
    || (a[0] === 169 && a[1] === 254)
    || (a[0] === 172 && a[1] >= 16 && a[1] <= 31)
    || (a[0] === 192 && a[1] === 168)
    || (a[0] === 100 && a[1] >= 64 && a[1] <= 127)
    || a[0] >= 224;
}

function normalizeExternalHttpsUrl(value, label = "url") {
  let url;
  try { url = new URL(String(value || "")); }
  catch { throw new Error("PLUGIN_DISTRIBUTION_URL_INVALID:" + label); }
  if (url.protocol !== "https:") throw new Error("PLUGIN_DISTRIBUTION_HTTPS_REQUIRED:" + label);
  if (url.username || url.password || isPrivateHost(url.hostname)) throw new Error("PLUGIN_DISTRIBUTION_URL_UNSAFE:" + label);
  url.hash = "";
  return url.toString();
}

function normalizeEd25519PublicJwk(input) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const kty = cleanText(source.kty, 20);
  const crv = cleanText(source.crv, 40);
  const x = cleanText(source.x, 100);
  if (kty !== "OKP" || crv !== "Ed25519" || !/^[A-Za-z0-9_-]{43}$/.test(x)) {
    throw new Error("PLUGIN_AUTHOR_PUBLIC_KEY_INVALID");
  }
  if (source.d) throw new Error("PLUGIN_AUTHOR_PRIVATE_KEY_FORBIDDEN");
  return Object.freeze({ kty: "OKP", crv: "Ed25519", x, ext: true, key_ops: Object.freeze(["verify"]) });
}

function normalizeSignature(input) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const algorithm = cleanText(source.algorithm || source.alg, 40);
  const keyId = cleanText(source.keyId || source.key_id, 120).toLowerCase();
  const value = cleanText(source.value || source.signature, 180);
  if (algorithm !== PLUGIN_SIGNATURE_ALGORITHM) throw new Error("PLUGIN_SIGNATURE_ALGORITHM_UNSUPPORTED");
  if (!PLUGIN_AUTHOR_KEY_ID_PATTERN.test(keyId)) throw new Error("PLUGIN_SIGNATURE_KEY_ID_INVALID");
  if (!PLUGIN_SIGNATURE_VALUE_PATTERN.test(value)) throw new Error("PLUGIN_SIGNATURE_VALUE_INVALID");
  return Object.freeze({ algorithm, keyId, value });
}

function normalizeSignedPluginDistribution(input) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const schemaVersion = Number(source.schemaVersion || source.schema_version || 0);
  if (schemaVersion !== PLUGIN_DISTRIBUTION_SCHEMA_VERSION) throw new Error("PLUGIN_DISTRIBUTION_SCHEMA_UNSUPPORTED");

  const descriptor = normalizePluginPackageDescriptor(source.descriptor || source.package || {});
  const artifactSource = source.artifact && typeof source.artifact === "object" ? source.artifact : {};
  const artifactUrl = normalizeExternalHttpsUrl(artifactSource.url || source.artifactUrl, "artifact");
  const immutableRef = cleanText(artifactSource.immutableRef || artifactSource.ref || source.immutableRef, 240);
  if (!PLUGIN_IMMUTABLE_REF_PATTERN.test(immutableRef)) throw new Error("PLUGIN_DISTRIBUTION_IMMUTABLE_REF_INVALID");
  const mediaType = cleanText(artifactSource.mediaType || "application/zip", 100).toLowerCase();
  if (!PLUGIN_ALLOWED_ARTIFACT_TYPES.includes(mediaType)) throw new Error("PLUGIN_DISTRIBUTION_MEDIA_TYPE_UNSUPPORTED");
  const sizeBytes = Number(artifactSource.sizeBytes || 0);
  if (!Number.isInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > PLUGIN_MAX_ARTIFACT_BYTES) throw new Error("PLUGIN_DISTRIBUTION_SIZE_INVALID");

  const repositoryUrl = source.repositoryUrl ? normalizeExternalHttpsUrl(source.repositoryUrl, "repository") : "";
  const signature = normalizeSignature(source.signature);
  const publisher = source.publisher && typeof source.publisher === "object" ? source.publisher : {};
  const publisherKeyId = cleanText(publisher.keyId || signature.keyId, 120).toLowerCase();
  if (publisherKeyId !== signature.keyId) throw new Error("PLUGIN_DISTRIBUTION_KEY_ID_MISMATCH");

  return Object.freeze({
    schemaVersion: PLUGIN_DISTRIBUTION_SCHEMA_VERSION,
    descriptor,
    artifact: Object.freeze({
      url: artifactUrl,
      immutableRef,
      mediaType,
      sizeBytes,
      sha256: descriptor.integrity.slice("sha256:".length)
    }),
    publisher: Object.freeze({
      keyId: publisherKeyId,
      name: cleanText(publisher.name, 120)
    }),
    repositoryUrl,
    signature
  });
}

function unsignedDistributionPayload(input) {
  const normalized = normalizeSignedPluginDistribution(input);
  return Object.freeze({
    schemaVersion: normalized.schemaVersion,
    descriptor: normalized.descriptor,
    artifact: normalized.artifact,
    publisher: normalized.publisher,
    repositoryUrl: normalized.repositoryUrl
  });
}

function stableJson(value) {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("PLUGIN_SIGNING_VALUE_INVALID");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return "[" + value.map(stableJson).join(",") + "]";
  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort();
    return "{" + keys.map(key => JSON.stringify(key) + ":" + stableJson(value[key])).join(",") + "}";
  }
  throw new Error("PLUGIN_SIGNING_VALUE_INVALID");
}

function distributionSigningText(input) {
  return stableJson(unsignedDistributionPayload(input));
}

function base64UrlToBytes(value) {
  const text = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = text + "=".repeat((4 - text.length % 4) % 4);
  let binary;
  try { binary = atob(padded); } catch { throw new Error("PLUGIN_SIGNATURE_VALUE_INVALID"); }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64Url(value) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function importEd25519PublicKey(publicKeyJwk) {
  const jwk = normalizeEd25519PublicJwk(publicKeyJwk);
  if (!globalThis.crypto?.subtle) throw new Error("PLUGIN_CRYPTO_UNAVAILABLE");
  try {
    return await globalThis.crypto.subtle.importKey("jwk", jwk, { name: "Ed25519" }, false, ["verify"]);
  } catch {
    throw new Error("PLUGIN_AUTHOR_PUBLIC_KEY_IMPORT_FAILED");
  }
}

async function verifyDistributionSignature(input, publicKeyJwk) {
  const normalized = normalizeSignedPluginDistribution(input);
  const key = await importEd25519PublicKey(publicKeyJwk);
  const payload = new TextEncoder().encode(distributionSigningText(normalized));
  const signature = base64UrlToBytes(normalized.signature.value);
  const ok = await globalThis.crypto.subtle.verify({ name: "Ed25519" }, key, signature, payload);
  return Object.freeze({ ok: Boolean(ok), keyId: normalized.signature.keyId, algorithm: PLUGIN_SIGNATURE_ALGORITHM });
}

async function verifyDistributionArtifact(input, artifactBytes) {
  const normalized = normalizeSignedPluginDistribution(input);
  const bytes = artifactBytes instanceof Uint8Array ? artifactBytes : new Uint8Array(artifactBytes);
  if (bytes.byteLength !== normalized.artifact.sizeBytes) throw new Error("PLUGIN_ARTIFACT_SIZE_MISMATCH");
  if (bytes.byteLength > PLUGIN_MAX_ARTIFACT_BYTES) throw new Error("PLUGIN_ARTIFACT_TOO_LARGE");
  const hash = await sha256Hex(bytes);
  if (hash !== normalized.artifact.sha256) throw new Error("PLUGIN_ARTIFACT_HASH_MISMATCH");
  return Object.freeze({ ok: true, hash, sizeBytes: bytes.byteLength, mediaType: normalized.artifact.mediaType });
}

export {
  PLUGIN_ALLOWED_ARTIFACT_TYPES,
  PLUGIN_AUTHOR_KEY_ID_PATTERN,
  PLUGIN_DISTRIBUTION_SCHEMA_VERSION,
  PLUGIN_IMMUTABLE_REF_PATTERN,
  PLUGIN_MAX_ARTIFACT_BYTES,
  PLUGIN_SIGNATURE_ALGORITHM,
  base64UrlToBytes,
  bytesToBase64Url,
  distributionSigningText,
  importEd25519PublicKey,
  normalizeEd25519PublicJwk,
  normalizeExternalHttpsUrl,
  normalizeSignedPluginDistribution,
  stableJson,
  unsignedDistributionPayload,
  verifyDistributionArtifact,
  verifyDistributionSignature
};
