import test from "node:test";
import assert from "node:assert/strict";
import {parseCommand,isRelayable,parseOnebot} from "../src/core.js";
const inputs=["/!use","!use","/use","@AIBot /!use","@AIBot !use","<@!123456789> /!use","[CQ:at,qq=123456789] !use"];
test("primary ! command syntax works independently of stale QQ slash UI",()=>{
 for (const x of inputs) assert.deepEqual(parseCommand(x),{name:"use",arg:""},x);
});
test("command variations, join codes, and preserved protection commands",()=>{
 assert.deepEqual(parseCommand("/!status"),{name:"status",arg:""});
 assert.deepEqual(parseCommand("!grant 473204883 stop"),{name:"grant",arg:"473204883 stop"});
 assert.deepEqual(parseCommand("/!verify ABCD234567"),{name:"verify",arg:"ABCD234567"});
 assert.deepEqual(parseCommand("@AIBot /!ABCDEF2345 測試群"),{name:"join",code:"ABCDEF2345",arg:"測試群"});
 assert.deepEqual(parseCommand("!ABCDEF2345 小群"),{name:"join",code:"ABCDEF2345",arg:"小群"});
 assert.equal(parseCommand("hello !use"),null);
 assert.equal(parseCommand("/!设置插话率"),null);
});
test("unknown /! and ! commands must not relay to other groups",()=>{
 for(const content of ["!unknown","/!设置插话率","/unknown","/!use","!use"]){
   const m=parseOnebot({post_type:"message",message_type:"group",group_id:808882936,user_id:3569028262,self_id:2681167798,
   message_id:202,message:[{type:"text",data:{text:content}}]});
   assert.equal(isRelayable(m),false,content);
 }
});
test("public /health reports only limited connection state without secrets",async()=>{
 const {default:worker}=await import("../worker.js");
 const fake={get:()=>({fetch:async()=>new Response(JSON.stringify({connected:true}))}),idFromName:()=>({})};
 const forbidden={get:()=>{throw Error("ABOT_GATEWAY_MUST_NOT_BE_QUERIED")},idFromName:()=>{throw Error("ABOT_GATEWAY_MUST_NOT_BE_QUERIED")}};
 const res=await worker.fetch(new Request("https://example.com/health"),{ONEBOT_HUB:fake,QQ_OPEN_GATEWAY:forbidden,
   ONEBOT_ACCESS_TOKEN:"secret_1",QQ_OPEN_APP_ID:"id",QQ_OPEN_CLIENT_SECRET:"secret_2"});
 const s=await res.json();
 assert.equal(s.command_prefix,"/! or !");
 assert.equal(s.bbot.connected,true);
 assert.equal(s.bbot.websocket_count,0);
 assert.equal(s.relay.mode,"parallel");
 assert.equal(s.relay.max_parallel_groups,4);
 assert.deepEqual(s.abot,{connected:false,session_ready:false,enabled:false});
 assert.equal(s.mode,"bbot-only");
 assert.equal(s.configured,true);
 assert.equal(JSON.stringify(s).includes("secret_"),false);
 assert.equal(s.primary_command_transport,"bbot");
});
