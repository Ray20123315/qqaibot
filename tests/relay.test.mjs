import test from "node:test";
import assert from "node:assert/strict";
import {parseOnebot,isRelayable} from "../src/core.js";
import {relayOperations,safeMediaUrl,outboundAction} from "../src/relay.js";
import {deliver} from "../src/delivery.js";
import {OneBotHub} from "../worker.js";
const input={post_type:"message",message_type:"group",group_id:808882936,user_id:3569028262,self_id:2681167798,message_id:1001,
 sender:{nickname:"小明"},message:[{type:"text",data:{text:"先看看 "}},
 {type:"at",data:{qq:"473204883"}},{type:"image",data:{file:"abc.jpg",url:"https://gchat.qpic.cn/1.jpg"}},
 {type:"video",data:{url:"https://video.example.org/a.mp4"}},
 {type:"record",data:{file:"audio.silk"}},
 {type:"file",data:{file:"notes.pdf",name:"notes.pdf"}},
 {type:"face",data:{id:"14"}},{type:"reply",data:{id:"88"}}]};
test("OneBot rich media survives ingestion, text not converted to placeholders",()=>{
 const m=parseOnebot(input);
 assert.deepEqual(m.parts.map(x=>x.type),["text","at","image","video","record","file","face","reply"]);
 assert.equal(isRelayable(m),true);
 const ops=relayOperations("群甲","小明",m.parts,{"473204883":"memberOpenID_123456"},{
   realMentions:true,targetMembers:new Set(["473204883"])
 });
 assert.equal(ops[0].content,'[群甲]小明：先看看 <qqbot-at-user id="memberOpenID_123456" />');
 assert.equal(ops[0].segments[2].type,"at");
 assert.equal(ops[1].mediaKind,"image");
 assert.equal(ops[1].mediaUrl,"https://gchat.qpic.cn/1.jpg");
 assert.equal(ops[2].mediaKind,"video");
 assert.equal(ops[3].mediaUrl,"");
 assert.equal(ops[4].mediaKind,"file");
 assert.equal(ops[5].kind,"native");
});
test("cross-group target member absent => textual at in Bbot output",()=>{
 const ops=relayOperations("跨群","客戶",[{type:"at",qq:"473204883"}],{},{
   realMentions:true,targetMembers:new Set()
 });
 assert.equal(ops[0].content,"[跨群]客戶：@473204883");
 assert.equal(ops[0].segments[1].type,"text");
});
test("public media URL sanitization remains available, but Abot upload is disabled",()=>{
 assert.equal(safeMediaUrl("file:///tmp/secret"),"");
 assert.equal(safeMediaUrl("http://localhost/secret"),"");
 assert.equal(safeMediaUrl("https://127.0.0.1/private"),"");
 assert.equal(safeMediaUrl("https://files.example.org/photo.png"),"https://files.example.org/photo.png");
});
test("Bbot-only sends text to a numeric QQ group even when OpenID exists",async()=>{
 let bbot=0,official=0;
 const item={id:"txt",target_group:"old-real-openid",target_qq_group_id:"808882936",
  payload:JSON.stringify({kind:"text",content:"hello",segments:[{type:"text",data:{text:"hello"}}]})};
 const result=await deliver({},item,{sendBbot:async()=>{bbot++;return {ok:true};},
  sendText:async()=>{official++;return {id:"should-not-run"};}});
 assert.equal(result.status,"sent_bbot");
 assert.equal(bbot,1);
 assert.equal(official,0);
});
test("Bbot-only forwards original native media without any Abot upload",async()=>{
 let used=0;
 const item={id:"img",target_group:"historical-openid",target_qq_group_id:"808882936",
  payload:JSON.stringify({kind:"media",mediaKind:"image",content:"[群]甲：",
  segments:[{type:"text",data:{text:"[群]甲："}},{type:"image",data:{file:"native-image.jpg"}}]})};
 const result=await deliver({},item,{sendBbot:async(_env,id,group,segments)=>{
   used++;assert.equal(group,"808882936");assert.equal(segments[1].type,"image");
 }});
 assert.equal(result.status,"sent_bbot");
 assert.equal(used,1);
});
test("missing numeric QQ group ID fails closed; no invented mapping",async()=>{
 let attempts=0;
 const item={id:"bad",target_group:"opaque-openid",target_qq_group_id:"",
  payload:JSON.stringify({kind:"text",content:"hello",segments:[{type:"text",data:{text:"hello"}}]})};
 const result=await deliver({},item,{sendBbot:async()=>{attempts++;}});
 assert.equal(result.status,"failed");
 assert.equal(result.error,"TARGET_QQ_GROUP_UNKNOWN");
 assert.equal(attempts,0);
});
test("Bbot ACK timeout does not cause duplicate sends",async()=>{
 let attempts=0;
 const item={id:"timeout",target_group:"napcat:808882936",target_qq_group_id:"808882936",
  payload:JSON.stringify({kind:"text",content:"hello",segments:[{type:"text",data:{text:"hello"}}]})};
 const result=await deliver({},item,{sendBbot:async()=>{attempts++;throw new Error("ambiguous_timeout");}});
 assert.equal(result.status,"failed_ambiguous");
 assert.equal(attempts,1);
});
test("OneBot outbound action has explicit target and echo",()=>{
 const a=outboundAction("abc","808882936",[{type:"text",data:{text:"hello"}}]);
 assert.equal(a.action,"send_group_msg");
 assert.equal(a.echo,"bridge-send:abc");
 assert.equal(a.params.group_id,808882936);
});
test("DO Bbot adapter requires ACK before claiming sent",async()=>{
 let hub;
 const ws={readyState:1,send(payload){
  const req=JSON.parse(payload);
  queueMicrotask(()=>hub.webSocketMessage(ws,JSON.stringify({echo:req.echo,status:"ok",retcode:0})));
 }};
 const state={getWebSockets:()=>[ws]};
 hub=new OneBotHub(state,{});
 const res=await hub.fetch(new Request("https://internal/send",{method:"POST",
   body:JSON.stringify({id:"m123",groupId:"808882936",segments:[{type:"text",data:{text:"hello"}}]})}));
 assert.equal(res.status,200);
 assert.deepEqual(await res.json(),{ok:true,message_id:null});
});
