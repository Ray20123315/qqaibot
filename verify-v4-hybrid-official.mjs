import assert from "node:assert/strict";
import fs from "node:fs";
import {
  commandFromCallback,
  interactionControlAction,
  interactionRequiresAck,
  normalizeInteractionEvent,
  normalizePushPermissionEvent,
  parseFeatureCommandMap
} from "./src/v4/qqopen/official-events.js";
import {
  hybridObservationRow,
  hybridPrimaryTransport,
  hybridStatus,
  isAuxiliaryOneBotMessage,
  oneBotGroupForQqOpen,
  parseGroupMap,
  qqOpenGroupForOneBot
} from "./src/v4/hybrid/ownership.js";

assert.equal(hybridPrimaryTransport({}), "qq-open");
assert.equal(hybridPrimaryTransport({ QQ_HYBRID_PRIMARY:"onebot" }), "onebot");
const groupEnv={ QQ_HYBRID_GROUP_MAP: JSON.stringify({ "808882936":"GROUP_OPEN_A" }) };
assert.equal(qqOpenGroupForOneBot(groupEnv,"808882936"),"GROUP_OPEN_A");
assert.equal(oneBotGroupForQqOpen(groupEnv,"GROUP_OPEN_A"),"808882936");
assert.equal(parseGroupMap(groupEnv).oneBotToQqOpen["808882936"],"GROUP_OPEN_A");
assert.throws(()=>parseGroupMap({QQ_HYBRID_GROUP_MAP:"not-json"}),/INVALID_JSON/);
assert.equal(hybridStatus(groupEnv).mappedGroups,1);
assert.equal(isAuxiliaryOneBotMessage({}, {post_type:"message",message_type:"group"}),false);
assert.equal(isAuxiliaryOneBotMessage({}, {post_type:"message",message_type:"group"},{explicit:true}),true);
assert.equal(isAuxiliaryOneBotMessage({}, {post_type:"message",message_type:"group"},{fullGroupOwned:true}),true);
assert.equal(isAuxiliaryOneBotMessage({}, {post_type:"notice",notice_type:"group_increase"}),false);
assert.equal(isAuxiliaryOneBotMessage({}, {post_type:"message",message_type:"group",__qqai_platform:"qq-open"}),false);
const observation=hybridObservationRow({
  post_type:"message",message_type:"group",group_id:808882936,user_id:123,message_id:99,
  sender:{card:"Tester",role:"admin"}
},{mappedQqOpenGroupId:"GROUP_OPEN_A",text:"hello",mentions:["456"],mediaTypes:["image"]});
assert.equal(observation.oneBotGroupId,"808882936");
assert.equal(observation.qqOpenGroupId,"GROUP_OPEN_A");
assert.equal(observation.senderRole,"admin");

const c2cOn=normalizePushPermissionEvent({t:"C2C_MSG_RECEIVE",d:{openid:"USER_A",timestamp:1784570617}});
assert.deepEqual({scope:c2cOn.scope,targetId:c2cOn.targetId,allowed:c2cOn.allowed},{scope:"c2c",targetId:"USER_A",allowed:true});
const c2cOff=normalizePushPermissionEvent({t:"C2C_MSG_REJECT",d:{openid:"USER_A",timestamp:1784570618}});
assert.equal(c2cOff.allowed,false);
const groupOn=normalizePushPermissionEvent({t:"GROUP_MSG_RECEIVE",d:{group_openid:"GROUP_A",op_member_openid:"ADMIN_A",timestamp:1784570619}});
assert.deepEqual({scope:groupOn.scope,targetId:groupOn.targetId,operatorId:groupOn.operatorId,allowed:groupOn.allowed},{scope:"group",targetId:"GROUP_A",operatorId:"ADMIN_A",allowed:true});
assert.equal(normalizePushPermissionEvent({t:"GROUP_AT_MESSAGE_CREATE",d:{}}),null);

assert.equal(interactionRequiresAck(11),true);
assert.equal(interactionRequiresAck(12),true);
assert.equal(interactionRequiresAck(13),false);
const base64=Buffer.from(JSON.stringify({command:"!status"}),"utf8").toString("base64");
assert.equal(commandFromCallback({buttonData:base64}),"!status");
assert.equal(commandFromCallback({buttonData:"!帮助"}),"!帮助");
assert.equal(commandFromCallback({featureId:"status",featureMap:{status:"!status"}}),"!status");
assert.equal(commandFromCallback({buttonData:"confirm:once"}),"");
assert.deepEqual(parseFeatureCommandMap('{"status":"!status"}'),{status:"!status"});

const interaction=normalizeInteractionEvent({t:"INTERACTION_CREATE",d:{
  id:"I1",type:11,scene:"group",group_openid:"G1",group_member_openid:"U1",
  timestamp:"2026-07-20T21:53:54+08:00",
  data:{type:11,resolved:{button_data:base64,button_id:"b1"}}
}});
assert.equal(interaction.id,"I1");
assert.equal(interaction.requiresAck,true);
assert.equal(interaction.command,"!status");
assert.equal(interactionControlAction(interaction),"command");

const feedback=normalizeInteractionEvent({t:"INTERACTION_CREATE",d:{id:"I2",type:13,scene:"c2c",user_openid:"U2",data:{type:13,resolved:{feedback_opt:"LIKE",checked:1,message_id:"M1"}}}});
assert.equal(interactionControlAction(feedback),"feedback");
assert.equal(feedback.resolved.feedbackOpt,"LIKE");
const clear=normalizeInteractionEvent({t:"INTERACTION_CREATE",d:{id:"I3",type:14,scene:"c2c",user_openid:"U3",data:{type:14,resolved:{}}}});
assert.equal(interactionControlAction(clear),"clear_session");
const model=normalizeInteractionEvent({t:"INTERACTION_CREATE",d:{id:"I4",type:16,scene:"c2c",user_openid:"U4",data:{type:16,resolved:{action:"gemini"}}}});
assert.equal(interactionControlAction(model),"switch_model");
const auth=normalizeInteractionEvent({t:"INTERACTION_CREATE",d:{id:"I5",type:18,scene:"c2c",user_openid:"U5",data:{type:18,resolved:{authorize_data:{scope:"c2c_push",opt_scene:"setting"}}}}});
assert.equal(interactionControlAction(auth),"authorization");
assert.equal(auth.resolved.authorizeScope,"c2c_push");

const worker=fs.readFileSync("worker.js","utf8");
const runtime=fs.readFileSync("src/v4/qqopen/runtime.js","utf8");
const api=fs.readFileSync("src/v4/qqopen/api.js","utf8");
const portal=fs.readFileSync("src/v4/portal/lean-dashboard.js","utf8");
const config=fs.readFileSync("wrangler.toml","utf8");

assert.match(worker,/isAuxiliaryOneBotMessage\(this\.env, body, \{/);
assert.match(worker,/recordAuxiliaryOneBotObservation/);
assert(worker.indexOf("isAuxiliaryOneBotMessage(this.env, body)") < worker.indexOf("const v3PluginBody = body"));
assert.match(worker,/\/v4\/qqopen\/control/);
assert.match(worker,/clearChatSessionHistory/);
assert.match(worker,/qqopen_push_permission:/);
assert.match(runtime,/handlePushPermissionEvent/);
assert.match(runtime,/handleInteractionEvent/);
assert.match(runtime,/respondInteraction/);
assert.match(runtime,/event_id/);
assert.match(api,/\/interactions\/\$\{encodePath\(interactionId/);
assert.match(portal,/v4QqInteractions/);
assert.match(portal,/v4QqPush/);
assert.match(config,/QQ_HYBRID_PRIMARY\s*=\s*"qq-open"/);
assert.match(config,/QQ_OPEN_INTENTS\s*=\s*"33554432"/);
assert(!config.includes('QQ_OPEN_INTENTS = "100663296"'),"interaction intent must remain opt-in");
assert.match(config,/QQ_HYBRID_GROUP_MAP\s*=\s*"\{\}"/);

console.log("verify-v4-hybrid-official: ok");

const scheduler=fs.readFileSync("src/scheduler/runtime.js","utf8");
assert.match(scheduler,/async function sendHybridGroupMessage/);
assert.match(scheduler,/qqOpenGroupPushAllowed/);
assert.match(scheduler,/qqopen_push_permission:group:/);
assert.match(scheduler,/NUMERIC_MENTION_REQUIRES_ONEBOT/);
assert.match(scheduler,/hybrid_active_send_fallback/);
assert.match(scheduler,/sendHybridGroupMessage\(env, item\.groupId, outboundMessage/);
assert.match(scheduler,/sendHybridGroupMessage\(env, groupId, result\.text/);

assert.match(worker,/qqopen_full_group_active:/);
assert.match(worker,/hybridFullGroupOwned/);
assert.match(runtime,/full_group_observed/);
assert.match(runtime,/GROUP_MESSAGE_CREATE/);
