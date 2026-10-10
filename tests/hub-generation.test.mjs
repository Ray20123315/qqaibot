import test from "node:test";
import assert from "node:assert/strict";
import worker from "../worker.js";
import {BBOT_HUB_ID} from "../src/bbot-hub.js";
import {sendUsingBbot} from "../src/delivery.js";

test("health and outbound target the same fresh OneBotHub generation",async()=>{
 assert.equal(BBOT_HUB_ID,"bridge-bbot-ai-v1");
 const seen=[];
 const hub={idFromName:id=>{seen.push(id);return id;},get:()=>({fetch:async input=>{
  if(String(input).endsWith("/status"))return new Response(JSON.stringify({
   connected:false,websocket_count:0,last_event_at:null,last_connected_at:null,last_closed_at:null,
  }),{headers:{"content-type":"application/json"}});
  return new Response(JSON.stringify({ok:true}),{headers:{"content-type":"application/json"}});
 }})};
 const response=await worker.fetch(new Request("https://qqai.example.com/health"),{ONEBOT_HUB:hub,ONEBOT_ACCESS_TOKEN:"secret"});
 const status=await response.json();
 assert.equal(status.mode,"abot-ai-passive");
 assert.equal(status.bbot.connected,false);
 assert.equal(status.bbot.hub_generation,"ai-v1");
 await sendUsingBbot({ONEBOT_HUB:hub},"msg","808882936",[{type:"text",data:{text:"test"}}]);
 assert.deepEqual(seen,[BBOT_HUB_ID,BBOT_HUB_ID]);
});
