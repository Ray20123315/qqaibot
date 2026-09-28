import assert from "node:assert/strict";
import fs from "node:fs";
import { normalizeMessages } from "./src/ai/provider-client.js";
import { politicalGuardDecision, politicalTextPrefilter } from "./src/v4/public/politics.js";
import { principalKind, principalValue } from "./src/v4/public/membership.js";

assert.deepEqual(normalizeMessages({
  system: "sys",
  contents: [
    { role: "user", parts: [{ text: "hello" }] },
    { role: "model", parts: [{ text: "world" }] }
  ]
}), [
  { role: "system", content: "sys" },
  { role: "user", content: "hello" },
  { role: "assistant", content: "world" }
]);

assert.equal(principalKind("qqopen:abc"), "qqopen");
assert.equal(principalKind("qq:3569028262"), "qq");
assert.equal(principalValue("qqopen:abc"), "abc");

assert.equal(politicalTextPrefilter("候選人政策比較").decision, "block");
assert.equal(politicalTextPrefilter("政府的個資保護規定").decision, "review");
assert.equal((await politicalGuardDecision("政府的個資保護規定", {
  classify: async () => "NON_POLITICAL"
})).blocked, false);
assert.equal((await politicalGuardDecision("政府最近表現如何", {
  classify: async () => "POLITICAL"
})).blocked, true);

const providerClient = fs.readFileSync("src/ai/provider-client.js", "utf8");
assert.match(providerClient, /async function callUserProviderRoute/);
assert.match(providerClient, /providerGroupAccessDecision/);
assert.match(providerClient, /membershipResolver/);

const resourceTickets = fs.readFileSync("src/v4/public/resource-tickets.js", "utf8");
assert.match(resourceTickets, /IDENTITY_REVERSE_PREFIX/);
assert.match(resourceTickets, /resolveQqOpenPrincipalForCanonical/);

const membership = fs.readFileSync("src/v4/public/membership.js", "utf8");
assert.match(membership, /get_group_member_info/);
assert.match(membership, /QQ_OPEN_GATEWAY/);
assert.match(membership, /ONEBOT_HUB/);

const host = fs.readFileSync("src/v3/host/adapter.js", "utf8");
assert.match(host, /callUserProviderRoute/);
assert.match(host, /createLiveGroupMembershipResolver/);
assert.match(host, /enforcePluginPoliticalGuard/);
assert.ok(host.indexOf("callUserProviderRoute") < host.indexOf("callProviderRoute(env, \"chat\""), "user provider must be attempted before platform configured route");

const worker = fs.readFileSync("worker.js", "utf8");
assert.match(worker, /callUserProviderRoute/);
assert.match(worker, /layeredPoliticalGuard/);
assert.match(worker, /political_output_blocked/);
assert.ok(worker.indexOf("callUserProviderRoute(env, \"chat\"") < worker.indexOf("generateHybridReply(env"), "user provider must be attempted before platform hybrid generation");
assert.ok(worker.indexOf("political_output_blocked") < worker.indexOf("appendChatHistoryTurn(env, sessionKey"), "political output must be blocked before chat history persistence");

const privateSettings = fs.readFileSync("src/v4/public/private-settings.js", "utf8");
assert.match(privateSettings, /!AI分享/);
assert.match(privateSettings, /!AI群友私聊/);
assert.match(privateSettings, /updateProviderSharing/);

console.log("verify-v4-user-ai-routing: ok");
