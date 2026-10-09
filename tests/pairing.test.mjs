import test from "node:test";
import assert from "node:assert/strict";
import {pairCanFinalize} from "../src/pairing.js";
import {BRIDGE_ECHO_MARKER} from "../src/core.js";
import {onOnebotEvent} from "../src/bridge.js";
const group={group_openid:"opaqueGroupA",verified:0};
const proof={group_openid:"opaqueGroupA",bbot_group:"808882936",actor_qq:"111111111",official_seen:1,bbot_seen:1};
const current={fresh:true},actor={role:"owner"};
test("group bridge pairing must have BOTH official Abot and numeric Bbot proof",()=>{
 assert.equal(pairCanFinalize(group,proof,current,actor,null),true);
 assert.equal(pairCanFinalize(group,{...proof,official_seen:0},current,actor,null),false);
 assert.equal(pairCanFinalize(group,{...proof,bbot_seen:0},current,actor,null),false);
 assert.equal(pairCanFinalize(group,{...proof,group_openid:"other"},current,actor,null),false);
 assert.equal(pairCanFinalize(group,{...proof,bbot_group:"no-qq"},current,actor,null),false);
});
test("unverified actor, stale group roster, or conflicting QQ group cannot finalize",()=>{
 assert.equal(pairCanFinalize(group,proof,{fresh:false},actor,null),false);
 assert.equal(pairCanFinalize(group,proof,current,{role:"member"},null),false);
 assert.equal(pairCanFinalize(group,proof,current,actor,{group_openid:"other"}),false);
 assert.equal(pairCanFinalize({...group,verified:1},proof,current,actor,null),false);
 assert.equal(pairCanFinalize(group,{...proof,actor_qq:"3569028262"},current,{role:"member"},null),true);
});
test("outbound echoed Abot text marker cannot be rebroadcast via Bbot",async()=>{
 assert.ok(BRIDGE_ECHO_MARKER.length>=2);
 const e={post_type:"message",message_type:"group",group_id:808882936,user_id:111111111,self_id:2681167798,
 message_id:889,sender:{nickname:"官方機器人"},message:[{type:"text",data:{text:"[技術群]甲：hello"+BRIDGE_ECHO_MARKER}}]};
 const result=await onOnebotEvent({},e);
 assert.equal(result.ignored,true);
});
