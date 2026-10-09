import test from "node:test";
import assert from "node:assert/strict";
import {fanoutByGroup} from "../src/batch.js";
import {relayOperations} from "../src/relay.js";
import {flushOutbox} from "../src/bridge.js";
import {OneBotHub} from "../worker.js";

const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const sample=(id,group)=>({id,target_group:"napcat:"+group,target_qq_group_id:group,
 payload:JSON.stringify({kind:"native",content:"msg",segments:[{type:"text",data:{text:"msg"}}]})});

test("four-worker fanout can send to three QQ groups simultaneously",async()=>{
 const gate=deferred(),started=deferred(),seen=[];
 const items=[sample("one","808882936"),sample("two","810000111"),sample("three","810000222")];
 const action=fanoutByGroup(items,async(item)=>{
  seen.push(item.id);
  if(seen.length===3)started.resolve();
  await gate.promise;
 },{concurrency:4});
 await Promise.race([started.promise,new Promise((_,reject)=>setTimeout(()=>reject(new Error("fanout was sequential")),1500))]);
 assert.deepEqual(new Set(seen),new Set(["one","two","three"]));
 gate.resolve();
 const result=await action;
 assert.equal(result.parallel,3);
 assert.equal(result.groups,3);
});
test("same QQ group preserves message order while other groups proceed",async()=>{
 const gate=deferred(),bothStarted=deferred(),trace=[];
 const items=[sample("A1","808882936"),sample("A2","808882936"),sample("B1","810000111")];
 const work=fanoutByGroup(items,async(item)=>{
  trace.push(item.id);
  if(trace.length===2)bothStarted.resolve();
  if(item.id==="A1")await gate.promise;
 });
 await Promise.race([bothStarted.promise,new Promise((_,reject)=>setTimeout(()=>reject(new Error("groups did not overlap")),1500))]);
 assert.deepEqual(new Set(trace),new Set(["A1","B1"]));
 gate.resolve();
 await work;
 assert.deepEqual(trace,["A1","B1","A2"]);
});
test("Bbot native batch sends mixed text, picture and face as one OneBot message",()=>{
 const operations=relayOperations("甲群","甲",[
  {type:"text",text:"hello"},
  {type:"image",data:{file:"abc.jpg"}},
  {type:"face",data:{id:"14"}},
  {type:"text",text:"world"},
  {type:"at",qq:"473204883"}
 ],{}, {nativeBatch:true,targetMembers:new Set(["473204883"])});
 assert.equal(operations.length,1);
 assert.equal(operations[0].index,0);
 assert.deepEqual(operations[0].segments.map(x=>x.type),["text","text","image","face","text","at"]);
 assert.equal(operations[0].segments[0].data.text,"[甲群]甲：");
});
test("outbox delivers to three destinations concurrently, ACK must be awaited",async()=>{
 const messages=[sample("a","808882936"),sample("b","810000111"),sample("c","810000222")];
 let seen=[],released=deferred(),three=deferred();
 const db={prepare(sql){
  return {
   run:async()=>({meta:{changes:0}}),
   bind(...args){return {
    first:async()=>({verified:1,stopped:0,qq_group_id:messages.find(x=>x.target_group===args[0])?.target_qq_group_id}),
    all:async()=>({results:sql.includes("SELECT * FROM bridge_outbox")?messages:[]}),
    run:async()=>({meta:{changes:1}})
   }; }
  };
 }};
 const action=flushOutbox({DB:db},15,{sendBbot:async(_env,id)=>{
  seen.push(id);if(seen.length===3)three.resolve();await released.promise;
 }});
 await Promise.race([three.promise,new Promise((_,reject)=>setTimeout(()=>reject(new Error("outbox did not fan out")),1500))]);
 assert.equal(seen.length,3);
 released.resolve();
 const result=await action;
 assert.equal(result.sent,3);
 assert.equal(result.parallel,3);
 assert.equal(result.processed,3);
});
test("health reports socket diagnostics, not last activity as false live connection",async()=>{
 const state={getWebSockets:()=>[],storage:{get:async key=>key==="last_event_at"?"2026-10-09T17:12:15Z":null}};
 const hub=new OneBotHub(state,{});
 const result=await hub.fetch(new Request("https://internal/status"));
 const status=await result.json();
 assert.equal(status.connected,false);
 assert.equal(status.websocket_count,0);
 assert.equal(status.last_event_at,"2026-10-09T17:12:15Z");
});
