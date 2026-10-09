
import test from "node:test";
import assert from "node:assert/strict";
import {isProtected,authorize,parseOnebot,parseCommand,formatForward,isRelayable} from "../src/core.js";
test("protected QQ identities",()=>{
 assert.equal(isProtected("3569028262"),true);
 assert.equal(isProtected("2681167798"),true);
 assert.equal(isProtected("123456789"),false);
});
test("QQ native slash commands and group code",()=>{
 assert.deepEqual(parseCommand("<@!BOT> /use"),{name:"use",arg:""});
 assert.deepEqual(parseCommand("/ABCDEF2345 遊戲群"),{name:"join",code:"ABCDEF2345",arg:"遊戲群"});
 assert.deepEqual(parseCommand("/grant 123456789 stop"),{name:"grant",arg:"123456789 stop"});
 assert.equal(parseCommand("大家好"),null);
 assert.equal(parseCommand("/not-command"),null);
});
test("protected members block admin stop, leave, revoke and grant",()=>{
 for(const action of ["stop","leave","revoke","grant","ungrant"]){
  assert.equal(authorize({actor:"111111111",role:"owner",protectedPresent:true,rosterFresh:true,action}).ok,false,action);
 }
});
test("protected principal and explicit delegated scopes",()=>{
 assert.equal(authorize({actor:"3569028262",role:"member",protectedPresent:true,rosterFresh:true,action:"grant"}).ok,true);
 assert.equal(authorize({actor:"2681167798",role:"member",protectedPresent:true,rosterFresh:true,action:"stop"}).ok,true);
 assert.equal(authorize({actor:"111111111",role:"admin",protectedPresent:true,rosterFresh:true,scopes:["stop"],action:"stop"}).ok,true);
 assert.equal(authorize({actor:"111111111",role:"admin",protectedPresent:true,rosterFresh:true,scopes:["manage"],action:"stop"}).ok,false);
 assert.equal(authorize({actor:"111111111",role:"admin",protectedPresent:true,rosterFresh:true,scopes:["stop"],action:"grant"}).ok,false);
});
test("unprotected admin allowed; ordinary member blocked",()=>{
 assert.equal(authorize({actor:"111111111",role:"owner",protectedPresent:false,rosterFresh:true,action:"stop"}).ok,true);
 assert.equal(authorize({actor:"111111111",role:"admin",protectedPresent:false,rosterFresh:true,action:"grant"}).ok,true);
 assert.equal(authorize({actor:"111111111",role:"member",protectedPresent:false,rosterFresh:true,action:"stop"}).ok,false);
});
test("stale roster refuses even protected principal",()=>{
 assert.equal(authorize({actor:"3569028262",role:"owner",protectedPresent:false,rosterFresh:false,action:"stop"}).ok,false);
});
test("only structured at segments map to real mention",()=>{
 const event={post_type:"message",message_type:"group",group_id:808882936,user_id:3569028262,self_id:2681167798,
   message_id:78,sender:{role:"member",card:"小明"},message:[
     {type:"text",data:{text:"早安 "}}, {type:"at",data:{qq:"473204883"}},{type:"text",data:{text:" 在嗎"}}
   ]};
 const msg=parseOnebot(event);
 assert.equal(msg.senderQq,"3569028262");
 assert.deepEqual(msg.atIds,["473204883"]);
 assert.equal(formatForward("技術群","小明",msg.parts,()=>null),"[技術群]小明：早安 @473204883 在嗎");
 assert.equal(formatForward("技術群","小明",msg.parts,id=>id==="473204883"?"member_openid_123":null),"[技術群]小明：早安 <@!member_openid_123> 在嗎");
 assert.equal(isRelayable(msg),true);
 assert.equal(isRelayable({...msg,selfId:msg.senderQq}),false);
});
test("bot messages never loop and slash commands are not relayed",()=>{
 const msg=parseOnebot({post_type:"message",message_type:"group",group_id:12345678,user_id:123456789,self_id:999999999,
  message_id:88,message:[{type:"text",data:{text:"/status"}}]});
 assert.equal(isRelayable(msg),false);
});
