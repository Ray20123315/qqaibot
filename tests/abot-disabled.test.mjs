import test from "node:test";
import assert from "node:assert/strict";
import worker,{QqOpenGateway} from "../worker.js";

// QQ_OPEN_GATEWAY class must remain for Cloudflare Durable Object migrations,
// but may never create a WebSocket, query token credentials or receive events.
test("old Bbot-only gateway can be shut down and Abot passive AI is opt-in",async()=>{
 let closed=0;const state={storage:{get:async()=>null,put:async()=>{},deleteAlarm:async()=>{},setAlarm:async()=>{}}};
 const gateway=new QqOpenGateway(state,{QQ_AI_ABOT_ENABLED:"false"});
 gateway.ws={close:()=>{closed++;},readyState:1};
 const status=await gateway.fetch(new Request("https://internal/status"));
 assert.equal((await status.json()).enabled,false);
 const shut=await gateway.fetch(new Request("https://internal/shutdown",{method:"POST"}));
 assert.deepEqual(await shut.json(),{disabled:true});
 assert.equal(closed,1);
 await gateway.alarm();
 assert.equal(gateway.ws,null);
});
test("cron starts only dedicated official Abot gateway and shuts down historical instances",async()=>{
 const names=[];
 const gateway={idFromName:n=>n,get:id=>({fetch:async()=>{names.push(id);return new Response(JSON.stringify({connected:false}));}})};
 const hub={idFromName:n=>n,get:()=>({fetch:async()=>new Response(JSON.stringify({connected:false}))})};
 const db={prepare:()=>({run:async()=>({meta:{changes:0}}),bind:()=>({first:async()=>({count:0})})})};
 const tasks=[];const ctx={waitUntil:p=>tasks.push(p)};
 await worker.scheduled({}, {QQ_AI_ABOT_ENABLED:"true",QQ_OPEN_GATEWAY:gateway,ONEBOT_HUB:hub,DB:db},ctx);
 await Promise.all(tasks);
 assert.ok(names.includes("qqai-abot-passive-ai-v1"));
 assert.ok(names.includes("bridge-abot"));
 assert.ok(names.includes("bridge-abot-commands-v2"));
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
