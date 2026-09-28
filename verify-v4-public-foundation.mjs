import assert from "node:assert/strict";
import {
  legalStatementVersion,
  platformRoleLabel,
  resolvePlatformRole
} from "./src/v4/public/access.js";
import {
  normalizeClassifierDecision,
  politicalGuardDecision,
  politicalTextPrefilter
} from "./src/v4/public/politics.js";
import {
  classifyOfficialCapabilityError,
  prepareOneBotFallbackPayload,
  shouldFallbackToOneBot
} from "./src/v4/hybrid/capability-router.js";
import {
  normalizeProviderAccount,
  providerGroupAccessDecision
} from "./src/ai/provider-registry.js";
import { runtimeSecurityFinding } from "./src/plugins/runtime-guard.js";
import fs from "node:fs";

assert.equal(resolvePlatformRole({}), "authorized_member");
assert.equal(resolvePlatformRole({ aiProvider:true }), "ai_provider");
assert.equal(resolvePlatformRole({ administrator:true, aiProvider:true }), "administrator");
assert.equal(resolvePlatformRole({ developer:true, administrator:true }), "developer");
assert.equal(platformRoleLabel("ai_provider"), "AI 提供者");
assert.equal(legalStatementVersion({}), "2026-09-28-v1");

assert.equal(politicalTextPrefilter("總統選舉要投誰").decision, "block");
assert.equal(politicalTextPrefilter("今天天氣如何").decision, "pass");
assert.equal(politicalTextPrefilter("政府的個人資料保護規範").decision, "review");
assert.equal(normalizeClassifierDecision("NON_POLITICAL"), "non_political");
assert.equal((await politicalGuardDecision("政府的個人資料保護規範", { classify: async()=> "NON_POLITICAL" })).blocked, false);
assert.equal((await politicalGuardDecision("政府最近做得如何", { classify: async()=> "POLITICAL" })).blocked, true);

const unsupported=classifyOfficialCapabilityError(new Error("QQ_OPEN_LEGACY_ACTION_UNSUPPORTED:set_group_whole_ban"));
assert.equal(unsupported.kind, "unavailable");
assert.equal(shouldFallbackToOneBot(unsupported), true);
assert.equal(shouldFallbackToOneBot(classifyOfficialCapabilityError(new Error("QQ_OPEN_API_502:upstream timeout"))), false);
const groupFallback=prepareOneBotFallbackPayload({action:"set_group_whole_ban",params:{group_id:"OPEN_GROUP",enable:true}}, {oneBotGroupId:"808882936",officialGroupId:"OPEN_GROUP",reason:"unavailable"});
assert.equal(groupFallback.params.group_id,808882936);
assert.throws(()=>prepareOneBotFallbackPayload({action:"set_group_kick",params:{group_id:"OPEN_GROUP",user_id:"OPEN_MEMBER"}},{oneBotGroupId:"808882936"}),/IDENTITY_REQUIRED/);
assert.throws(()=>prepareOneBotFallbackPayload({action:"delete_msg",params:{message_id:"OPEN_MESSAGE"}},{oneBotGroupId:"808882936"}),/MESSAGE_ID_UNSAFE/);

const account=normalizeProviderAccount({
  id:"member-gemini",
  provider:"google_gemini",
  label:"我的 Gemini",
  ownerPrincipalId:"OPEN_OWNER",
  tasks:["chat"],
  sharedGroupIds:["GROUP_A"],
  allowGroupMemberPrivateChat:true
});
assert.equal(account.scope,"user");
assert.deepEqual(account.sharedGroupIds,["GROUP_A"]);
assert.equal((await providerGroupAccessDecision(account,{principalId:"OPEN_OWNER"})).ok,true);
assert.equal((await providerGroupAccessDecision(account,{principalId:"OPEN_MEMBER",groupId:"GROUP_B",membershipResolver:async()=>true})).reason,"group_not_shared");
const membership=async ({principalId})=>["OPEN_OWNER","OPEN_MEMBER"].includes(principalId);
assert.equal((await providerGroupAccessDecision(account,{principalId:"OPEN_MEMBER",groupId:"GROUP_A",membershipResolver:membership})).ok,true);
assert.equal((await providerGroupAccessDecision(account,{principalId:"OPEN_MEMBER",groupId:"GROUP_A",membershipResolver:async({principalId})=>principalId!=="OPEN_OWNER"})).reason,"provider_left_group");

const finding=runtimeSecurityFinding({code:"cross-tenant-write",impacts:["cross_tenant"],summaryZh:"測試"});
assert.equal(finding.overrideAllowed,false);

const permissions=fs.readFileSync("src/core/permissions.js","utf8");
assert.match(permissions,/resolveOneBotGroupForQqOpen/);
assert.match(permissions,/classifyOfficialCapabilityError/);
assert.match(permissions,/prepareOneBotFallbackPayload/);
assert.match(permissions,/callOneBotRpc/);

const license=fs.readFileSync("LICENSE","utf8");
assert.match(license,/Copyright © 2026 Ray Chen\. All rights reserved\./);
assert.match(license,/No license is granted/i);

console.log("verify-v4-public-foundation: ok");
