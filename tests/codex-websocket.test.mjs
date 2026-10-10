import test from "node:test";
import assert from "node:assert/strict";
import worker,{OneBotHub} from "../worker.js";
import {CODEX_BRIDGE_PROTOCOL} from "../src/codex-bridge.js";

test("Codex and NapCat stay separated by WebSocket tags",async()=>{
 const codex={readyState:1,send:()=>{}},napcat={readyState:1,send:()=>{}};
 const state={
  storage:{get:async()=>null},
  getWebSockets:tag=>tag==="codex"?[codex]:tag==="bbot"?[napcat]:[codex,napcat],
  getTags:ws=>ws===codex?["codex"]:["bbot"]
 };
 const hub=new OneBotHub(state,{});
 assert.equal(hub.socket(),napcat);
 assert.equal(hub.codexSocket(),codex);
 assert.equal((await (await hub.fetch(new Request("https://internal/codex/status"))).json()).connected,true);
 assert.equal((await (await hub.fetch(new Request("https://internal/status"))).json()).websocket_count,1);
});
test("Codex bridge accepts Luna non-thinking request and resolves matching response only",async()=>{
 let hub;const ws={readyState:1,send:packet=>{
  const data=JSON.parse(packet);
  assert.equal(data.model,"gpt-6-luna");
  assert.equal(data.reasoningEffort,"none");
  assert.equal(data.protocol,CODEX_BRIDGE_PROTOCOL);
  assert.equal(data.sessionKey,"qqaibot:ai:test");
  queueMicrotask(()=>hub.webSocketMessage(ws,JSON.stringify({protocol:CODEX_BRIDGE_PROTOCOL,type:"response",id:data.id,ok:true,text:"Codex 回覆",model:"gpt-6-luna"})));
 }};
 const state={getWebSockets:tag=>tag==="codex"?[ws]:[ws],getTags:()=>["codex"]};
 hub=new OneBotHub(state,{});
 const payload={protocol:CODEX_BRIDGE_PROTOCOL,model:"gpt-6-luna",reasoningEffort:"none",sessionKey:"qqaibot:ai:test",messages:[{role:"user",content:"hi"}]};
 const res=await hub.fetch(new Request("https://internal/codex/chat",{method:"POST",body:JSON.stringify(payload),headers:{"content-type":"application/json"}}));
 assert.equal(res.status,200);
 assert.deepEqual(await res.json(),{ok:true,text:"Codex 回覆",model:"gpt-6-luna"});
 assert.equal(hub.codexPending.size,0);
});
test("Worker never accepts unauthenticated Codex websocket upgrade",async()=>{
 const res=await worker.fetch(new Request("https://aibot.ray2025.com/v3/codex-bridge",{headers:{upgrade:"websocket",authorization:"Bearer wrong"}}),{
  CODEX_BRIDGE_ACCESS_TOKEN:"valid-secret"
 });
 assert.equal(res.status,401);
});
test("Worker cannot be tricked into a Codex chat with another model or effort",async()=>{
 const ws={readyState:1,send:()=>{throw Error("invalid request must not send")}};
 const state={getWebSockets:tag=>tag==="codex"?[ws]:[ws],getTags:()=>["codex"]};
 const hub=new OneBotHub(state,{});
 const res=await hub.fetch(new Request("https://internal/codex/chat",{method:"POST",body:JSON.stringify({
  protocol:CODEX_BRIDGE_PROTOCOL,model:"gpt-6-luna",reasoningEffort:"high"
 })}));
 assert.equal(res.status,400);
});
