import test from "node:test";
import assert from "node:assert/strict";
import {parseOnebot,parseCommand} from "../src/core.js";
import {readableCard,relayOperations} from "../src/relay.js";
import {parseRecallEvent,recordRelayMessage,handleRecallEvent,drainRecalls} from "../src/recall.js";
import {OneBotHub} from "../worker.js";

test("genuine QQ at kept native in destination group; absent target shows nickname not digits",()=>{
 const p=[{type:"at",qq:"473204883"}];
 const a=relayOperations("群","乙",p,{}, {nativeBatch:true,targetMembers:new Set(["473204883"]),sourceMembers:new Map([["473204883","小熊"]])});
 assert.equal(a[0].segments[1].type,"at");
 const b=relayOperations("群","乙",p,{}, {nativeBatch:true,targetMembers:new Set(),sourceMembers:new Map([["473204883","小熊"]])});
 assert.equal(b[0].segments[1].data.text,"@小熊");
 assert.equal(b[0].content.includes("473204883"),false);
});
test("Bilibili JSON card stays plain text rather than raw JSON card",()=>{
 const raw=JSON.stringify({prompt:"嗶哩嗶哩",meta:{detail_1:{title:"精彩視頻",qqdocurl:"https://www.bilibili.com/video/BV123"}}});
 const p=parseOnebot({post_type:"message",message_type:"group",group_id:808882936,user_id:3569028262,message_id:123,
  message:[{type:"json",data:{data:raw}}]});
 const seg=relayOperations("群","作者",p.parts,{}, {nativeBatch:true})[0].segments;
 assert.deepEqual(seg.map(s=>s.type),["text","text"]);
 assert.match(seg[1].data.text,/B站分享/);
 assert.match(seg[1].data.text,/精彩視頻/);
 assert.match(seg[1].data.text,/https:\/\/www\.bilibili\.com\/video\/BV123/);
 assert.equal(readableCard("json",raw).includes("https://www.bilibili.com/video/BV123"),true);
});
test("QQ face remains face; mface retains native package id not image",()=>{
 const event={post_type:"message",message_type:"group",group_id:808882936,user_id:3569028262,message_id:123,
  message:[{type:"face",data:{id:"66"}},{type:"mface",data:{emoji_id:"5544",emoji_package_id:"9922",key:"key",summary:"貓貓"}}]};
 const p=parseOnebot(event);
 const parts=relayOperations("群","人",p.parts,{}, {nativeBatch:true})[0].segments;
 assert.deepEqual(parts.map(s=>s.type),["text","face","mface"]);
 assert.deepEqual(parts[2].data,{emoji_id:"5544",emoji_package_id:"9922",key:"key",summary:"貓貓"});
});
test("QQ notice validates group recall event but ignores other arbitrary notices",()=>{
 assert.deepEqual(parseRecallEvent({post_type:"notice",notice_type:"group_recall",group_id:808882936,message_id:120}),
  {sourceGroup:"808882936",sourceMessage:"120"});
 assert.equal(parseRecallEvent({post_type:"notice",notice_type:"group_increase",group_id:808882936,message_id:120}),null);
 assert.equal(parseRecallEvent({post_type:"notice",notice_type:"group_recall",group_id:808882936,message_id:"xxx"}),null);
});
class RecallDB{
 constructor(){this.link=[];this.recalled=[];this.queue=[];this.outbox=[];}
 prepare(q){const db=this;return {run:async()=>({meta:{changes:0}}),bind(...a){return {
  first:async()=>{
   if(q.includes("SELECT source_message FROM bridge_recalled_sources"))return db.recalled.find(x=>x.g===a[0]&&x.m===a[1])||null;
   throw Error("DB FIRST "+q);
  },
  all:async()=>{
   if(q.includes("SELECT target_group,target_message FROM bridge_recall_map"))return {results:db.link.filter(x=>x.g===a[0]&&x.m===a[1]).map(x=>({target_group:x.tg,target_message:x.tm}))};
   if(q.includes("SELECT * FROM bridge_recall_queue"))return {results:db.queue.filter(x=>x.state==="pending").slice(0,a[0])};
   throw Error("DB ALL "+q);
  },
  run:async()=>{
   if(q.includes("INSERT OR IGNORE INTO bridge_recall_map")){
    db.link.push({g:a[0],m:a[1],tg:a[2],tm:a[3]});return {meta:{changes:1}};
   }
   if(q.includes("INSERT OR IGNORE INTO bridge_recalled_sources")){
    if(db.recalled.some(x=>x.g===a[0]&&x.m===a[1]))return {meta:{changes:0}};
    db.recalled.push({g:a[0],m:a[1]});return {meta:{changes:1}};
   }
   if(q.includes("INSERT OR IGNORE INTO bridge_recall_queue")){
    if(db.queue.some(x=>x.g===a[0]&&x.m===a[1]&&x.tg===a[2]&&x.tm===a[3]))return {meta:{changes:0}};
    db.queue.push({g:a[0],m:a[1],tg:a[2],tm:a[3],state:"pending",target_group:a[2],target_message:a[3],source_group:a[0],source_message:a[1]});
    return {meta:{changes:1}};
   }
   if(q.includes("UPDATE bridge_recall_queue SET state='sending'")){
    const x=db.queue.find(x=>x.g===a[0]&&x.m===a[1]&&x.tg===a[2]&&x.tm===a[3]);if(!x||x.state!=="pending")return {meta:{changes:0}};
    x.state="sending";return {meta:{changes:1}};
   }
   if(q.includes("UPDATE bridge_recall_queue SET state=?")){
    db.queue.find(x=>x.g===a[1]&&x.m===a[2]&&x.tg===a[3]&&x.tm===a[4]).state=a[0];return {meta:{changes:1}};
   }
   if(q.includes("UPDATE bridge_outbox")||q.includes("DELETE FROM"))return {meta:{changes:0}};
   throw Error("DB RUN "+q);
  }
 }}};
 }
}
test("recalled original removes only mapped Bbot copies in multiple target QQ groups",async()=>{
 const db=new RecallDB();
 const origin=(t,id)=>({payload:JSON.stringify({sourceGroupId:"808882936",sourceMessageId:"456"}),target_qq_group_id:t,id});
 await recordRelayMessage(db,origin("810000111","a"),1001);
 await recordRelayMessage(db,origin("810000222","b"),1002);
 const evt={post_type:"notice",notice_type:"group_recall",group_id:808882936,message_id:456,operator_id:123};
 const handled=await handleRecallEvent(db,evt);
 assert.equal(handled.recalls,2);
 const deleted=[];
 const flush=await drainRecalls(db,async(mid,group)=>deleted.push({mid,group}));
 assert.equal(flush.sent,2);
 assert.deepEqual(deleted,[{mid:"1001",group:"810000111"},{mid:"1002",group:"810000222"}]);
 const second=await handleRecallEvent(db,evt);
 assert.equal(second.recalls,0);
 assert.equal((await drainRecalls(db,async()=>{throw Error("duplicate recall")})).processed,0);
});
test("a recall before ACK mapping is remembered and applied once mapping arrives",async()=>{
 const db=new RecallDB();
 await handleRecallEvent(db,{post_type:"notice",notice_type:"group_recall",group_id:808882936,message_id:456});
 await recordRelayMessage(db,{payload:JSON.stringify({sourceGroupId:"808882936",sourceMessageId:"456"}),target_qq_group_id:"810000111"},1001);
 assert.equal(db.queue.length,1);
});
test("Bbot OneBot sends ACK with message_id necessary to implement synchronized recall",async()=>{
 let hub;
 const ws={readyState:1,send(payload){const a=JSON.parse(payload);
  queueMicrotask(()=>hub.webSocketMessage(ws,JSON.stringify({echo:a.echo,status:"ok",retcode:0,data:{message_id:76543}})));
 }};
 hub=new OneBotHub({getWebSockets:()=>[ws]},{});
 const result=await hub.dispatch(ws,"relay-id","808882936",[{type:"text",data:{text:"hello"}}]);
 assert.equal((await result.json()).message_id,76543);
});

test("QQ non-Bilibili card URLs stay plain readable but do not expose actionable raw link",()=>{
 const qq=JSON.stringify({prompt:"網站卡片",meta:{detail_1:{title:"例子",qqdocurl:"https://example.org/abc"}}});
 const res=readableCard("json",qq);
 assert.match(res,/例子/);
 assert.doesNotMatch(res,/https:\/\/example\.org/);
});
