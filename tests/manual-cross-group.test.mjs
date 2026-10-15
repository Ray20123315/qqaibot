import test from "node:test";
import assert from "node:assert/strict";
import {parseManualRelay} from "../src/manual-relay.js";
import {onOnebotEvent,flushOutbox} from "../src/bridge.js";
import {routeBbotBridgeOnly,bridgeCanFlush} from "../src/assistant.js";

const msg=(text,id=42)=>({post_type:"message",message_type:"group",group_id:808882936,user_id:3569028262,self_id:2681167798,message_id:id,sender:{nickname:"測試者"},message:[{type:"text",data:{text}}]});
class DB {
 constructor(){
  this.outbox=[];
  this.groups=[
   {group_openid:"napcat:808882936",room_id:"room-a",qq_group_id:"808882936",verified:1,stopped:0,receive_only:0,alias:"主群"},
   {group_openid:"napcat:810000111",room_id:"room-a",qq_group_id:"810000111",verified:1,stopped:0,receive_only:1,alias:"僅接收群"},
   {group_openid:"napcat:810000222",room_id:"room-a",qq_group_id:"810000222",verified:1,stopped:0,receive_only:0,alias:"群三"},
   {group_openid:"napcat:810000333",room_id:"room-a",qq_group_id:"810000333",verified:1,stopped:1,receive_only:0,alias:"暫停群"},
   {group_openid:"napcat:820000000",room_id:"room-b",qq_group_id:"820000000",verified:1,stopped:0,receive_only:0,alias:"其他連線"}
  ];
 }
 prepare(sql){
  const db=this;
  return {
   run:async()=>({meta:{changes:0}}),
   bind(...a){return {
    first:async()=>{
     if(sql.includes("SELECT * FROM bridge_groups WHERE qq_group_id="))return db.groups.find(x=>x.qq_group_id===a[0])||null;
     if(sql.includes("SELECT fetched_at FROM bridge_rosters"))return {fetched_at:Date.now()};
     if(sql.includes("COUNT(1) AS count FROM bridge_members"))return {count:0};
     if(sql.includes("SELECT ai_enabled,bridge_enabled"))return {ai_enabled:1,bridge_enabled:1,model_provider:"gemini"};
     if(sql.includes("SELECT stopped,verified,qq_group_id FROM bridge_groups WHERE group_openid="))return db.groups.find(x=>x.group_openid===a[0])||null;
     return null;
    },
    all:async()=>({results:
     sql.includes("SELECT * FROM bridge_groups WHERE room_id=")?db.groups.filter(x=>x.room_id===a[0]&&x.verified&&!x.stopped&&x.group_openid!==a[1]):
     sql.includes("SELECT * FROM bridge_outbox")?db.outbox.filter(x=>x.state==="pending"&&x.id.startsWith("manual-v1:")).map(x=>({...x,payload:JSON.stringify(x.payload)})):
     []}),
    run:async()=>{
     if(sql.includes("INSERT OR IGNORE INTO bridge_outbox")){
      if(db.outbox.some(x=>x.id===a[0]))return {meta:{changes:0}};
      db.outbox.push({id:a[0],target_group:a[1],target_qq_group_id:a[2],payload:JSON.parse(a[4]),state:"pending"});
      return {meta:{changes:1}};
     }
     if(sql.includes("UPDATE bridge_outbox SET state='cancelled'")&&sql.includes("id NOT LIKE")){
      for(const x of db.outbox)if(x.state==="pending"&&!x.id.startsWith("manual-v1:"))x.state="cancelled";
     }
     if(sql.includes("UPDATE bridge_outbox SET state='sending'")){
      const item=db.outbox.find(x=>x.id===a[1]&&x.state==="pending");
      if(item){item.state="sending";return {meta:{changes:1}};}
      return {meta:{changes:0}};
     }
     if(sql.startsWith("UPDATE bridge_outbox SET state=?")){
      const item=db.outbox.find(x=>x.id===a[3]);if(item)item.state=a[0];
     }
     return {meta:{changes:1}};
    }
   }}
  };
 }
}

test("exact slash trigger: no aliases, suffixes, missing content, or truncation",()=>{
 for(const x of ["hello","@AIBot hello","/跨群測試 abc","!跨群 abc","/!跨群 abc","hello /跨群 abc"," /跨群 abc"]){
  assert.equal(parseManualRelay(x),null,x);
 }
 assert.deepEqual(parseManualRelay("/跨群 你好"),{matched:true,text:"你好",error:null});
 assert.equal(parseManualRelay("/跨群").error,"missing_text");
 assert.equal(parseManualRelay("/跨群 "+"長".repeat(1201)).error,"too_long");
});

test("ordinary messages never enqueue even with legacy bridge_enabled=1",async()=>{
 const env={DB:new DB(),ASSISTANT_MODE:"true"};
 for(const text of ["hello","早安","/跨群測試 早安","!plugin bridge on"]){
  const result=await routeBbotBridgeOnly(env,msg(text,10),async()=>{});
  assert.ok(!result?.forwarded,text);
 }
 assert.equal(env.DB.outbox.length,0);
});

test("one manual command reaches each verified active target in same room only; duplicate deduplicated",async()=>{
 const env={DB:new DB(),ASSISTANT_MODE:"true"};
 const result=await routeBbotBridgeOnly(env,msg("/跨群 大家好",101),async()=>{});
 assert.equal(result.forwarded,2);
 assert.deepEqual(new Set(env.DB.outbox.map(x=>x.target_qq_group_id)),new Set(["810000111","810000222"]));
 for(const out of env.DB.outbox){
  assert.match(out.id,/^manual-v1:/);
  assert.equal(out.payload.manualRelay,true);
  assert.equal(out.payload.content,"[主群]測試者：大家好");
  assert.equal(out.payload.segments.map(x=>x.data.text).join(""),"[主群]測試者：大家好");
 }
 const repeated=await routeBbotBridgeOnly(env,msg("/跨群 大家好",101),async()=>{});
 assert.equal(repeated.forwarded,0);
 assert.equal(env.DB.outbox.length,2);
});

test("empty command, stopped sender and receive-only sender do not broadcast",async()=>{
 const env={DB:new DB()},out=[];
 const reply=async value=>out.push(value);
 await onOnebotEvent(env,msg("/跨群",1),reply);
 assert.match(out[0],/用法/);
 env.DB.groups[0].stopped=1;
 await onOnebotEvent(env,msg("/跨群 Hello",2),reply);
 assert.match(out.at(-1),/已停止/);
 env.DB.groups[0].stopped=0;env.DB.groups[0].receive_only=1;
 await onOnebotEvent(env,msg("/跨群 Hello",3),reply);
 assert.match(out.at(-1),/僅接收/);
 assert.equal(env.DB.outbox.length,0);
 assert.equal(await bridgeCanFlush(env),true);
});

test("outbox dispatch ignores all historical automatic rows",async()=>{
 const db=new DB(),env={DB:db};
 await onOnebotEvent(env,msg("/跨群 新指令",202),async()=>{});
 db.outbox.push({id:"old-automatic-message",target_group:"napcat:810000111",target_qq_group_id:"810000111",payload:{segments:[{type:"text",data:{text:"舊訊息"}}]},state:"pending"});
 const sent=[];
 const result=await flushOutbox(env,20,{sendBbot:async(_e,id,group,segments)=>{
  sent.push({id,group,segments});return {message_id:null};
 }});
 assert.equal(result.sent,2);
 assert.equal(sent.length,2);
 assert.ok(sent.every(x=>x.id.startsWith("manual-v1:")));
 assert.equal(db.outbox.at(-1).state,"cancelled");
});
