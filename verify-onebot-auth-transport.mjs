import assert from "node:assert/strict";
import fs from "node:fs";
import { verifyOneBotAccess } from "./src/security/network.js";

const env = { ONEBOT_ACCESS_TOKEN: "test-onebot-secret" };
assert.equal(verifyOneBotAccess(new Request("https://qqai.test/onebot", { headers: { Authorization: "Bearer test-onebot-secret" } }), env), true);
assert.equal(verifyOneBotAccess(new Request("https://qqai.test/onebot", { headers: { Authorization: "bearer  test-onebot-secret  " } }), env), true);
assert.equal(verifyOneBotAccess(new Request("https://qqai.test/onebot?access_token=test-onebot-secret"), env), false);
assert.equal(verifyOneBotAccess(new Request("https://qqai.test/onebot?token=test-onebot-secret"), env), false);
assert.equal(verifyOneBotAccess(new Request("https://qqai.test/onebot", { headers: { Authorization: "Bearer wrong" } }), env), false);

const portalSource = fs.readFileSync("src/portal/runtime.js", "utf8");
const appealApi = portalSource.slice(portalSource.indexOf("async function handleAppealApi"), portalSource.indexOf("function renderAppeal", portalSource.indexOf("async function handleAppealApi")));
assert.doesNotMatch(appealApi, /body\.token|searchParams\.get\(['"]token['"]\)/);
assert.match(appealApi, /headers\.get\(['"]Authorization['"]\)/);

console.log("verify-onebot-auth-transport: ok");
