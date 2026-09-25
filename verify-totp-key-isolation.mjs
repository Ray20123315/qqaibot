import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { bytesToBase64Url, decryptPortalAuthSecret, encryptPortalAuthSecret, portalAuthEncryptionMaterial } from "./src/portal/auth.js";

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const legacyBotToken = "legacy-onebot-token-test-value-4829";
assert.throws(() => portalAuthEncryptionMaterial({ ONEBOT_ACCESS_TOKEN: legacyBotToken }), { code: "PORTAL_AUTH_SECRET_MISSING" });
await assert.rejects(encryptPortalAuthSecret({ ONEBOT_ACCESS_TOKEN: legacyBotToken }, "totp-secret"), { code: "PORTAL_AUTH_SECRET_MISSING" });

const dedicatedEnv = { TOTP_ENCRYPTION_KEY: "dedicated-totp-encryption-secret-2026" };
const encrypted = await encryptPortalAuthSecret(dedicatedEnv, "new-totp-secret");
assert.equal(encrypted.version, 2);
assert.equal(await decryptPortalAuthSecret(dedicatedEnv, encrypted), "new-totp-secret");

const keyMaterial = new TextEncoder().encode(legacyBotToken);
const digest = await crypto.subtle.digest("SHA-256", keyMaterial);
const legacyKey = await crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt"]);
const iv = new Uint8Array(12).fill(7);
const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, legacyKey, new TextEncoder().encode("legacy-totp-secret"));
const legacyPayload = { version: 1, iv: bytesToBase64Url(iv), data: bytesToBase64Url(new Uint8Array(ciphertext)) };
assert.equal(await decryptPortalAuthSecret({ ONEBOT_ACCESS_TOKEN: legacyBotToken, ...dedicatedEnv }, legacyPayload), "legacy-totp-secret");

console.log("verify-totp-key-isolation: ok");
