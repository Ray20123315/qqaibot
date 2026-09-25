import assert from "node:assert/strict";
import fs from "node:fs";
import { verifyOneBotAccess } from "./src/security/network.js";

const env = { ONEBOT_ACCESS_TOKEN: "test-onebot-secret" };
assert.equal(verifyOneBotAccess(new Request("https://qqai.test/onebot", { headers: { Authorization: "Bearer test-onebot-secret" } }), env), true);
assert.equal(verifyOneBotAccess(new Request("https://qqai.test/onebot", { headers: { Authorization: "bearer  test-onebot-secret  " } }), env), true);
assert.equal(verifyOneBotAccess(new Request("https://qqai.test/onebot?access_token=test-onebot-secret"), env), false);
assert.equal(verifyOneBotAccess(new Request("https://qqai.test/onebot?token=test-onebot-secret"), env), false);
assert.equal(verifyOneBotAccess(new Request("https://qqai.test/onebot", { headers: { Authorization: "Bearer wrong" } }), env), false);

const networkSource = fs.readFileSync("src/security/network.js", "utf8");
const verifyStart = networkSource.indexOf("function verifyOneBotAccess");
const verifyEnd = networkSource.indexOf("async function getFeatureFlag", verifyStart);
const verifySource = verifyStart >= 0 && verifyEnd > verifyStart ? networkSource.slice(verifyStart, verifyEnd) : "";
assert.match(verifySource, /headers\.get\(["']Authorization["']\)/);
assert.doesNotMatch(verifySource, /searchParams|access_token|[?&]token=/i, "OneBot auth must not accept URL query credentials");

console.log("verify-onebot-auth-transport: ok");
