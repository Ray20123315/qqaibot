import test from "node:test";
import assert from "node:assert/strict";
import {OneBotHub} from "../worker.js";
import {BRIDGE_ECHO_MARKER} from "../src/core.js";

test("Bbot native group command reply requires OneBot ACK",async()=>{
 let hub;
 const sent=[];
 const ws={readyState:1,send(payload){
  const action=JSON.parse(payload);
  sent.push(action);
  queueMicrotask(()=>hub.webSocketMessage(ws,JSON.stringify({echo:action.echo,status:"ok",retcode:0})));
 }};
 hub=new OneBotHub({getWebSockets:()=>[ws]},{});
 await hub.replyFromBbot(ws,"808882936","跨群已建立");
 assert.equal(sent.length,1);
 assert.equal(sent[0].action,"send_group_msg");
 assert.equal(sent[0].params.group_id,808882936);
 assert.equal(sent[0].params.message[0].data.text,"跨群已建立");
});

test("Bbot command responses are marked and ignored as already forwarded",async()=>{
 const {onOnebotEvent}=await import("../src/bridge.js");
 const result=await onOnebotEvent({},{
  post_type:"message",message_type:"group",group_id:808882936,
  user_id:3569028262,self_id:2681167798,message_id:"993",
  sender:{nickname:"reply"},message:[{type:"text",data:{text:"已建立"+BRIDGE_ECHO_MARKER}}]});
 assert.equal(result.ignored,true);
});

test("Abot official HTTP response handlers have no active route",async()=>{
 const {default:worker}=await import("../worker.js");
 const res=await worker.fetch(new Request("https://example.com/qq-open/events",{method:"POST"}),{});
 assert.equal(res.status,404);
});
