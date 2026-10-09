import test from "node:test";
import assert from "node:assert/strict";
import worker,{QqOpenGateway} from "../worker.js";

// QQ_OPEN_GATEWAY class must remain for Cloudflare Durable Object migrations,
// but may never create a WebSocket, query token credentials or receive events.
test("Abot gateway legacy endpoints are disabled and never connect",async()=>{
 let closeCount=0,alarmCount=0;
 const state={storage:{deleteAlarm:async()=>{alarmCount++;}}};
 const gateway=new QqOpenGateway(state,{QQ_OPEN_APP_ID:"test",QQ_OPEN_CLIENT_SECRET:"not-used"});
 gateway.ws={close:()=>{closeCount++;}};
 const ensure=await gateway.fetch(new Request("https://internal/ensure"));
 assert.equal(ensure.status,410);
 assert.equal((await ensure.json()).disabled,true);
 const shut=await gateway.fetch(new Request("https://internal/shutdown",{method:"POST"}));
 assert.deepEqual(await shut.json(),{disabled:true});
 assert.equal(closeCount,1);
 assert.equal(alarmCount,1);
 await gateway.alarm();
 assert.equal(alarmCount,2);
 const status=await gateway.fetch(new Request("https://internal/status"));
 assert.deepEqual(await status.json(),{connected:false,ready:false,disabled:true});
});

test("scheduled worker never requests Abot gateway ensure or official API",async()=>{
 const gateways=[];
 const gateway={
  idFromName:name=>name,
  get:id=>({fetch:async request=>{gateways.push({id,url:typeof request==="string"?request:request.url});return new Response(JSON.stringify({disabled:true}));}})
 };
 const calls=[];
 // Worker scheduled cron may attempt outbox only if authenticated Bbot is connected.
 const hub={idFromName:name=>name,get:()=>({fetch:async request=>{
  calls.push(typeof request==="string"?request:request.url);return new Response(JSON.stringify({connected:false}),{headers:{"content-type":"application/json"}});
 }})};
 const db={prepare:sql=>({run:async()=>({meta:{changes:0}}),bind:()=>({first:async()=>({count:0})})})};
 const contexts=[];
 const ctx={waitUntil:p=>contexts.push(p)};
 await worker.scheduled({}, {QQ_OPEN_GATEWAY:gateway,ONEBOT_HUB:hub,DB:db},ctx);
 await Promise.all(contexts);
 assert.deepEqual(gateways.map(x=>x.id).sort(),["bridge-abot","bridge-abot-commands-v2"]);
 assert.ok(gateways.every(x=>String(x.url).endsWith("/shutdown")));
 assert.equal(calls.some(x=>x.endsWith("/flush")),false);
 assert.equal(calls.some(x=>x.endsWith("/status")),false);
});

test("no official group API use in Bbot-only outbound, including historical OpenID groups",async()=>{
 const {deliver}=await import("../src/delivery.js");
 const item={id:"existing-room-item",target_group:"historical-opaque-group-openid",target_qq_group_id:"808882936",
  payload:JSON.stringify({kind:"text",content:"bridge",segments:[{type:"text",data:{text:"hi"}}]})};
 let usedBbot=0;
 const out=await deliver({},item,{sendBbot:async()=>{usedBbot++;return {ok:true};},
  sendText:async()=>{throw Error("OFFICIAL_TEXT_MUST_NOT_RUN")},
  sendAttachment:async()=>{throw Error("OFFICIAL_MEDIA_MUST_NOT_RUN")}});
 assert.equal(out.status,"sent_bbot");
 assert.equal(usedBbot,1);
 const missing=await deliver({}, {...item,target_qq_group_id:""},{sendBbot:async()=>{throw Error("MUST_NOT_CALL_WITHOUT_QQ_ID");}});
 assert.equal(missing.status,"failed");
 assert.equal(missing.error,"TARGET_QQ_GROUP_UNKNOWN");
});
