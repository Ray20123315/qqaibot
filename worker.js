import {BBOT_HUB_ID} from "./src/bbot-hub.js";

import {routeBbotBridgeOnly,routeBotNotice,bridgeCanFlush,assistantHealth,recordAssistantReply} from "./src/assistant.js";
import {accessToken,qqRequest} from "./src/qq-api.js";
import {onAbotAiEvent} from "./src/abot-ai.js";
import {qq,parseOnebot} from "./src/core.js";
import {roster,init} from "./src/store.js";
import {outboundAction} from "./src/relay.js";
import {memoryCommand,collectBbotMemory,recallBbotMemory,pruneGroupMemory} from "./src/group-memory.js";
import {CODEX_BRIDGE_PROTOCOL} from "./src/codex-bridge.js";
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
async function secretMatches(request,secret){
 if(!secret)return false;
 const provided=request.headers.get("authorization")?.replace(/^Bearer\s+/i,"")||request.headers.get("x-onebot-token")||"";
 const a=new TextEncoder().encode(provided),b=new TextEncoder().encode(secret);
 if(a.length!==b.length||!a.length)return false;
 const [x,y]=await Promise.all([crypto.subtle.digest("SHA-256",a),crypto.subtle.digest("SHA-256",b)]);
 return Array.from(new Uint8Array(x)).every((v,i)=>v===new Uint8Array(y)[i]);
}
const hub=env=>env.ONEBOT_HUB.get(env.ONEBOT_HUB.idFromName(BBOT_HUB_ID));
// Retain the legacy QQ_OPEN_GATEWAY binding and Durable Object migration, but
// make the official gateway passive and ask both historical instances to close.
const oldGatewayNames=["bridge-abot","bridge-abot-commands-v2"];
const newAbotGateway=env=>env.QQ_OPEN_GATEWAY.get(env.QQ_OPEN_GATEWAY.idFromName("qqai-abot-passive-ai-v1"));
async function stopOldGateways(env){
 if(!env.QQ_OPEN_GATEWAY)return;
 await Promise.allSettled(oldGatewayNames.map(name=>{
  const stub=env.QQ_OPEN_GATEWAY.get(env.QQ_OPEN_GATEWAY.idFromName(name));
  return stub.fetch("https://internal/shutdown",{method:"POST"});
 }));
}
export default {
 async fetch(request,env){
  const path=new URL(request.url).pathname;
  if(path==="/health"&&request.method==="GET"){
   const b=await hub(env).fetch("https://internal/status").catch(()=>null);
   const c=await hub(env).fetch("https://internal/codex/status").catch(()=>null);
   const codex=c?.ok?await c.json():{connected:false};
   const bbot=b?.ok?await b.json():{connected:false};
   const a=String(env.QQ_AI_ABOT_ENABLED)==="true"?await newAbotGateway(env).fetch("https://internal/status").catch(()=>null):null;
   const abot=a?.ok?await a.json():{connected:false,session_ready:false,enabled:false};
   return json({service:"qqaibot-ai-assistant",ai:true,configured:!!env.QQ_OPEN_APP_ID&&!!env.QQ_OPEN_CLIENT_SECRET,
    mode:"abot-ai-passive",abot:{connected:!!abot.connected,session_ready:!!abot.session_ready,enabled:!!abot.enabled,last_event_at:abot.last_event_at||null,last_error:abot.last_error||null},
    bbot:{connected:!!bbot.connected,hub_generation:"ai-v1",websocket_count:Number(bbot.websocket_count||0),
     last_connected_at:bbot.last_connected_at||null,last_event_at:bbot.last_event_at||null,
     last_closed_at:bbot.last_closed_at||null},
    command_prefix:"/! or !",relay:{mode:"parallel",max_parallel_groups:4},
    verification:"napcat",primary_command_transport:"abot",assistant:await assistantHealth(env),
    codex:{connected:!!codex.connected,model:"gpt-6-luna",reasoning_effort:"none"},
    memory:{collection_available:String(env.BOT_MEMORY_ENABLED)==="true",vectorize_bound:!!env.VECTORIZE}});
  }
  if(path==="/v3/codex-bridge"){
   if(request.headers.get("upgrade")?.toLowerCase()!=="websocket")return json({error:"upgrade_required"},426);
   if(!await secretMatches(request,env.CODEX_BRIDGE_ACCESS_TOKEN))return json({error:"unauthorized"},401);
   return hub(env).fetch(new Request("https://internal/codex/bridge",{headers:request.headers}));
  }
  if(path==="/onebot" || path==="/onebot/roster"){
   if(!await secretMatches(request,env.ONEBOT_ACCESS_TOKEN))return json({error:"unauthorized"},401);
   if(path==="/onebot"&&request.headers.get("upgrade")?.toLowerCase()==="websocket")
    return hub(env).fetch(new Request("https://internal/ws",{headers:request.headers}));
   if(request.method!=="POST")return json({error:"method_not_allowed"},405);
   let data;try{data=await request.json();}catch{return json({error:"invalid_json"},400);}
   try{
    if(path==="/onebot/roster"){
     if(!data?.group_id||!Array.isArray(data?.members))return json({error:"invalid_roster"},400);
     const {onOnebotRoster}=await import("./src/bridge.js");
     return json(await onOnebotRoster(env,data.group_id,data.members,data.group_name));
    }
    if(data?.post_type==="notice"&&data.notice_type==="group_recall"){
      await recallBbotMemory(env,data).catch(()=>console.warn("BOT_MEMORY_RECALL_FAILED"));
      return json(await routeBotNotice(env,data));
    }
    const control=await memoryCommand(env,data);
    if(control)return json(control);
    if(String(env.BOT_MEMORY_ENABLED)==="true")
     await collectBbotMemory(env,data).catch(()=>console.warn("BOT_MEMORY_STORE_FAILED"));
    return json(await routeBbotBridgeOnly(env,data));
   }catch(e){console.error("ONEBOT_HTTP_ERROR",String(e).slice(0,300));return json({error:"ingest_failed"},503);}
  }
  return json({error:"not_found"},404);
 },
 async scheduled(event,env,ctx){
  ctx.waitUntil(stopOldGateways(env));
  ctx.waitUntil(pruneGroupMemory(env).catch(()=>console.warn("BOT_MEMORY_PRUNE_FAILED")));
  if(String(env.QQ_AI_ABOT_ENABLED)==="true")
   ctx.waitUntil(newAbotGateway(env).fetch("https://internal/ensure").catch(e=>console.error("ABOT_GATEWAY_ENSURE",String(e?.message||"failed").slice(0,90))));
  ctx.waitUntil(bridgeCanFlush(env).then(enabled=>enabled?hub(env).fetch("https://internal/flush"):null).catch(e=>console.error("PLUGIN_SCHEDULE",String(e).slice(0,180))));
 }
};
export class OneBotHub {
 constructor(state,env){this.state=state;this.env=env;this.pending=new Map();this.inflight=new Map();this.codexPending=new Map();this.lastRosterRequested=new Map();}
 async fetch(request){
  const pathname=new URL(request.url).pathname;
  if(pathname==="/codex/status"&&request.method==="GET")return json({connected:!!this.codexSocket(),model:"gpt-6-luna",reasoning_effort:"none",session:"persistent-by-user"});
  if(pathname==="/codex/chat"&&request.method==="POST"){
    const body=await request.json().catch(()=>null);
    if(!body||body.protocol!==CODEX_BRIDGE_PROTOCOL||body.model!=="gpt-6-luna"||body.reasoningEffort!=="none")return json({ok:false,reason:"invalid_codex_request"},400);
    const ws=this.codexSocket();
    if(!ws)return json({ok:false,reason:"codex_offline"},503);
    const id=crypto.randomUUID();
    return new Promise(resolve=>{
      const timer=setTimeout(()=>{this.codexPending.delete(id);resolve(json({ok:false,reason:"codex_timeout"},504));},Math.min(60000,Math.max(1000,Number(body.timeoutMs||35000))));
      this.codexPending.set(id,{resolve,timer});
      try{ws.send(JSON.stringify({...body,type:"request",id}));}
      catch{clearTimeout(timer);this.codexPending.delete(id);resolve(json({ok:false,reason:"codex_disconnected"},503));}
    });
  }
  if(pathname==="/codex/bridge"&&request.headers.get("upgrade")?.toLowerCase()==="websocket"){
   for(const existing of this.state.getWebSockets("codex"))try{existing.close(1000,"reconnected");}catch{}
   const pair=new WebSocketPair(),[client,server]=Object.values(pair);
   this.state.acceptWebSocket(server,["codex"]);
   console.log("CODEX_LUNA_WS_CONNECTED");
   return new Response(null,{status:101,webSocket:client});
  }
  if(pathname==="/status" && request.method==="GET"){
   const sockets=this.state.getWebSockets().filter(ws=>!this.state.getTags?.(ws)?.includes("codex"));
   const [lastConnected,lastEvent,lastClosed]=await Promise.all([
    this.state.storage.get("last_connected_at"),
    this.state.storage.get("last_event_at"),
    this.state.storage.get("last_closed_at")
   ]);
   return json({connected:!!this.socket(),websocket_count:sockets.length,
    last_connected_at:lastConnected||null,last_event_at:lastEvent||null,last_closed_at:lastClosed||null});
  }
  if(pathname==="/flush"&&request.method==="GET"){
   if(!this.socket())return json({scheduled:false,reason:"bbot_disconnected"},503);
   await this.state.storage.setAlarm(Date.now()+50);
   return json({scheduled:true});
  }
  if(pathname==="/recall" && request.method==="POST"){
   const data=await request.json().catch(()=>null);
   if(!data||!/^-?[0-9]{1,16}$/.test(String(data.messageId||"")))return json({ok:false,reason:"invalid_message_id"},400);
   const ws=this.socket();
   if(!ws)return json({ok:false,reason:"bbot_disconnected"},503);
   return this.dispatchAction(ws,"delete_msg",{message_id:Number(data.messageId)},"recall-"+crypto.randomUUID());
  }
  if(pathname==="/send" && request.method==="POST"){
   let data;try{data=await request.json();}catch{return json({ok:false,reason:"invalid_payload"},400);}
   const ws=this.socket();
   if(!ws)return json({ok:false,reason:"bbot_disconnected"},503);
   try{return await this.dispatch(ws,data.id,data.groupId,data.segments);}
   catch{return json({ok:false,reason:"invalid_action"},400);}
  }
  if(pathname!=="/ws" || request.headers.get("upgrade")?.toLowerCase()!=="websocket")return json({error:"not_found"},404);
  for(const existing of this.state.getWebSockets().filter(ws=>!this.state.getTags?.(ws)?.includes("codex")))try{existing.close(1000,"reconnected");}catch{}
  const pair=new WebSocketPair(),[client,server]=Object.values(pair);
  this.state.acceptWebSocket(server,["bbot"]);
  await this.state.storage.put("last_connected_at",new Date().toISOString());
  console.log("BBOT_WS_CONNECTED");
  return new Response(null,{status:101,webSocket:client});
 }
 codexSocket(){return this.state.getWebSockets("codex").find(ws=>ws.readyState===1);}
 socket(){return this.state.getWebSockets().find(ws=>ws.readyState===1&&!this.state.getTags?.(ws)?.includes("codex"));}
 async dispatchAction(ws,action,params,id){
  const echo="bridge-send:"+String(id||crypto.randomUUID());
  if(this.inflight.has(echo))return json({ok:false,reason:"duplicate_inflight"},409);
  return new Promise(resolve=>{
   const timer=setTimeout(()=>{this.inflight.delete(echo);resolve(json({ok:false,reason:"ambiguous_timeout"},504));},10000);
   this.inflight.set(echo,{resolve,timer});
   try{ws.send(JSON.stringify({action,params,echo}));}
   catch{clearTimeout(timer);this.inflight.delete(echo);resolve(json({ok:false,reason:"bbot_socket_unavailable"},503));}
  });
 }
 async dispatch(ws,id,groupId,segments){
  const outbound=outboundAction(String(id||""),groupId,segments);
  return this.dispatchAction(ws,outbound.action,outbound.params,id);
 }
 async recallMessage(ws,messageId){
  if(!/^-?[0-9]{1,16}$/.test(String(messageId||"")))throw new Error("INVALID_RECALL_MESSAGE_ID");
  const response=await this.dispatchAction(ws,"delete_msg",{message_id:Number(messageId)},"recall-"+crypto.randomUUID());
  const result=await response.json();
  if(!response.ok||!result.ok)throw new Error("RECALL_"+(result.reason||"FAILED"));
  return result;
 }
 async replyFromBbot(ws,groupId,text){
  if(String(text).length>1900)throw Error("BBOT_REPLY_TOO_LONG_REWRITE_REQUIRED");
  const segments=[{type:"text",data:{text:String(text)}}];
  const result=await this.dispatch(ws,"cmd-"+crypto.randomUUID(),groupId,segments);
  if(!result.ok)throw new Error("BBOT_COMMAND_SEND_"+result.status);
  const obj=await result.json();
  if(!obj.ok)throw new Error("BBOT_COMMAND_SEND_"+obj.reason);
  if(obj.message_id!==null&&obj.message_id!==undefined)
   await recordAssistantReply(this.env,groupId,String(obj.message_id));
  console.log("BBOT_ASSISTANT_REPLY_OK");
  return obj;
 }
 async afterHandled(result){
  if(result?.forwarded>0){
   if(this.flushing)this.needsFlush=true;
   await this.state.storage.setAlarm(Date.now()+50);
  }
 }
 async alarm(){
  const ws=this.socket();
  if(!ws)return;
  if(this.flushing){this.needsFlush=true;return;}
  this.flushing=true;
  let result=null,recalled=null;
  try{
   if(!await bridgeCanFlush(this.env))return;
   const {flushRecalls,flushOutbox}=await import("./src/bridge.js");
   recalled=await flushRecalls(this.env,id=>this.recallMessage(ws,id),20);
   result=await flushOutbox(this.env,20,{sendBbot:async (_env,id,group,segments)=>{
    const response=await this.dispatch(ws,id,group,segments);
    const ack=await response.json();
    if(!response.ok||!ack?.ok)throw new Error("BBOT_"+(ack?.reason||"ACK_FAILED"));
    return ack;
   }});
   // A busy relay should drain the next batch immediately, not wait for cron.
  }catch(e){console.error("BBOT_RELAY_FLUSH",String(e).slice(0,160));}
  finally{
   this.flushing=false;
   if(this.needsFlush||result?.processed>=20||result?.lateRecalls>0||recalled?.processed>=20){
    this.needsFlush=false;
    await this.state.storage.setAlarm(Date.now()+50);
   }
  }
 }

 requestRoster(ws,group){
  const current=Date.now();
  if(current-(this.lastRosterRequested.get(group)||0)<3000)return;
  this.lastRosterRequested.set(group,current);
  ws.send(JSON.stringify({action:"get_group_member_list",params:{group_id:Number(group),no_cache:true},echo:"bridge-roster:"+group}));
  ws.send(JSON.stringify({action:"get_group_info",params:{group_id:Number(group),no_cache:true},echo:"bridge-info:"+group}));
 }
 async webSocketMessage(ws,message){
  if(this.state.getTags?.(ws)?.includes("codex")){
    let packet;try{packet=JSON.parse(typeof message==="string"?message:new TextDecoder().decode(message));}catch{return;}
    if(packet?.protocol!==CODEX_BRIDGE_PROTOCOL)return;
    if(packet.type==="hello"){ws.send(JSON.stringify({type:"hello",protocol:CODEX_BRIDGE_PROTOCOL,role:"worker",model:"gpt-6-luna",reasoningEffort:"none"}));return;}
    if(packet.type==="response"){
      const pending=this.codexPending.get(String(packet.id||""));
      if(!pending)return;
      clearTimeout(pending.timer);this.codexPending.delete(String(packet.id));
      const answer=typeof packet.text==="string"?packet.text:"";
      pending.resolve(json(packet.ok===true&&answer.trim()?{ok:true,text:answer,model:String(packet.model||"").slice(0,80)}:{ok:false,reason:"codex_error"},packet.ok===true&&answer.trim()?200:502));
    }
    return;
  }
  const eventTime=Date.now();
  if(eventTime-(this.lastRecordedEvent||0)>=15000){
   this.lastRecordedEvent=eventTime;
   if(this.state.storage?.put)await this.state.storage.put("last_event_at",new Date(eventTime).toISOString());
  }
  let data;try{data=JSON.parse(typeof message==="string"?message:new TextDecoder().decode(message));}catch{return;}
  const echo=String(data?.echo||"");
  if(echo.startsWith("bridge-send:")){
   const pending=this.inflight.get(echo);
   if(pending){
    clearTimeout(pending.timer);this.inflight.delete(echo);
    const success=data?.status==="ok" && Number(data?.retcode||0)===0;
    pending.resolve(json(success?{ok:true,message_id:data?.data?.message_id??null}:{ok:false,reason:"qq_rejected_"+String(data?.retcode||"unknown")},success?200:422));
   }
   return;
  }
  if(echo.startsWith("bridge-roster:")){
   const group=echo.slice(14);
   if(data?.status==="ok"&&Array.isArray(data.data)){
    const {onOnebotRoster}=await import("./src/bridge.js");
    await onOnebotRoster(this.env,group,data.data);
    const queueKey="queue:"+group;
    const queued=(await this.state.storage.get(queueKey))||[];
    await this.state.storage.delete(queueKey);
    const name=(await this.state.storage.get("groupname:"+group))||"";
    for(const evt of queued){
     evt.__bridge_group_name=name;
     const answer=text=>this.replyFromBbot(ws,group,text);
     const command=await memoryCommand(this.env,evt,answer);
     if(command)continue;
     if(String(this.env.BOT_MEMORY_ENABLED)==="true")
      await collectBbotMemory(this.env,evt).catch(()=>console.warn("BOT_MEMORY_STORE_FAILED"));
     const result=await routeBbotBridgeOnly(this.env,evt,answer);
     await this.afterHandled(result);
    }
   }else{await this.state.storage.delete("queue:"+group);console.error("BBOT_ROSTER_FAILED",echo,String(data?.retcode||""));}
   return;
  }
  if(echo.startsWith("bridge-info:")){
   const group=echo.slice(12);
   if(data.status==="ok"&&data.data?.group_name){
    await this.state.storage.put("groupname:"+group,String(data.data.group_name).slice(0,60));
    await this.env.DB.prepare("UPDATE bridge_groups SET display_name=? WHERE qq_group_id=?").bind(String(data.data.group_name).slice(0,60),group).run();
   }
   return;
  }
  if(data?.post_type==="notice"&&data.notice_type==="group_recall"){
   try{
    await recallBbotMemory(this.env,data).catch(()=>console.warn("BOT_MEMORY_RECALL_FAILED"));
    const result=await routeBotNotice(this.env,data);
    if(result?.recalls>0)await this.afterHandled({forwarded:result.recalls});
   }catch(e){console.error("BBOT_RECALL_EVENT_FAILED",String(e).slice(0,180));}
   return;
  }
  const msg=parseOnebot(data);
  if(!msg)return;
  await init(this.env.DB);
  const r=await roster(this.env.DB,msg.groupId);
  if(!r.fresh){
   const key="queue:"+msg.groupId;
   let queued=(await this.state.storage.get(key))||[];
   if(queued.length>=50)queued=queued.slice(-49);
   queued.push(data);await this.state.storage.put(key,queued);
   this.requestRoster(ws,msg.groupId);
   return;
  }
  try{
   const control=await memoryCommand(this.env,data,text=>this.replyFromBbot(ws,msg.groupId,text));
   if(control)return;
   if(String(this.env.BOT_MEMORY_ENABLED)==="true")
    await collectBbotMemory(this.env,data).catch(()=>console.warn("BOT_MEMORY_STORE_FAILED"));
   const result=await routeBbotBridgeOnly(this.env,data,text=>this.replyFromBbot(ws,msg.groupId,text));
   await this.afterHandled(result);
  }catch(e){console.error("ASSISTANT_EVENT_FAILED",String(e).slice(0,250));}
 }
 async webSocketClose(ws,code,reason){
  if(this.state.getTags?.(ws)?.includes("codex")){
   for(const [id,pending] of this.codexPending){clearTimeout(pending.timer);pending.resolve(json({ok:false,reason:"codex_disconnected"},503));this.codexPending.delete(id);}
   return;
  }
  await this.state.storage.put("last_closed_at",new Date().toISOString());
  console.warn("BBOT_WS_CLOSED",code);
  try{ws.close(code,reason);}catch{}
 }
 async webSocketError(ws,error){
  if(this.state.getTags?.(ws)?.includes("codex")){console.warn("CODEX_LUNA_WS_ERROR");return;}
  await this.state.storage.put("last_closed_at",new Date().toISOString());
  console.error("BBOT_SOCKET_ERROR",String(error).slice(0,150));
 }
}
// Kept only because Cloudflare's historical durable-object migrations refer to
// this class. There is NO connect, token fetch, command handling or heartbeat.
// QQ Official Gateway powers AI via passive msg_id replies. It is independent
// of NapCat/Bbot and never attempts proactive group sends.
export class QqOpenGateway {
 constructor(state,env){
  this.state=state;this.env=env;this.ws=null;this.token="";
  this.seq=null;this.sessionId="";this.interval=30000;this.connecting=false;this.ready=false;
 }
 async fetch(request){
  const path=new URL(request.url).pathname;
  if(path==="/status"){
   const lastEvent=await this.state.storage?.get?.("last_event_at");
   const lastError=await this.state.storage?.get?.("last_error");
   return json({connected:this.ws?.readyState===1,session_ready:this.ready,
    enabled:String(this.env.QQ_AI_ABOT_ENABLED)==="true",
    last_event_at:lastEvent||null,last_error:lastError||null});
  }
  if(path==="/shutdown"){
   await this.shutdown();return json({disabled:true});
  }
  if(path!=="/ensure")return json({error:"not_found"},404);
  if(String(this.env.QQ_AI_ABOT_ENABLED)!=="true")return json({enabled:false});
  try{await this.ensure();return json({enabled:true,connecting:this.connecting,connected:this.ws?.readyState===1,ready:this.ready});}
  catch(e){
   await this.recordError("CONNECT_"+String(e?.code||e?.status||"FAILED"));
   await this.state.storage.setAlarm(Date.now()+60000);
   return json({enabled:true,error:"gateway_unavailable"},503);
  }
 }
 async recordError(code){
  const safe=String(code||"unknown").replace(/[^A-Za-z0-9_-]/g,"").slice(0,60);
  await this.state.storage?.put?.("last_error",safe);
  console.error("ABOT_GATEWAY_ERROR",safe);
 }
 async ensure(){
  if(String(this.env.QQ_AI_ABOT_ENABLED)!=="true")return;
  if(this.ws&&[0,1].includes(this.ws.readyState))return;
  if(this.connecting)return;
  this.connecting=true;
  try{
   this.token=await accessToken(this.env);
   const data=await qqRequest(this.env,"/gateway");
   if(!/^wss:\/\//i.test(data?.url||""))throw new Error("BAD_GATEWAY_URL");
   const ws=new WebSocket(data.url);this.ws=ws;this.ready=false;
   ws.addEventListener("open",()=>{this.connecting=false;});
   ws.addEventListener("message",e=>this.handleMessage(e.data).catch(err=>this.recordError("EVENT_"+String(err?.status||"FAILED"))));
   ws.addEventListener("close",()=>{
    if(this.ws===ws){this.ws=null;this.ready=false;this.connecting=false;}
    this.state.storage.setAlarm(Date.now()+15000).catch(()=>{});
   });
   ws.addEventListener("error",()=>{this.connecting=false;});
   await this.state.storage.setAlarm(Date.now()+30000);
  }finally{this.connecting=false;}
 }
 async handleMessage(input){
  let p;try{p=JSON.parse(typeof input==="string"?input:new TextDecoder().decode(input));}catch{return;}
  if(Number.isInteger(p?.s))this.seq=p.s;
  if(p?.op===10){
   this.interval=Math.min(120000,Math.max(5000,Number(p?.d?.heartbeat_interval||30000)));
   const intents=Number(this.env.QQ_OPEN_INTENTS||100663296);
   this.ws?.send(JSON.stringify({op:2,d:{token:"QQBot "+this.token,intents,shard:[0,1],
    properties:{"$os":"cloudflare","$browser":"QQAIBOT-Abot-AI","$device":"QQAIBOT-Abot-AI"}}}));
   await this.state.storage.setAlarm(Date.now()+this.interval);
   return;
  }
  if(p?.op===0){
   if(p.t==="READY"||p.t==="RESUMED"){
    this.ready=true;this.sessionId=String(p?.d?.session_id||this.sessionId);
    await this.state.storage.put("last_error","");
    console.log("ABOT_AI_GATEWAY_READY");
    return;
   }
   if(p.t==="GROUP_AT_MESSAGE_CREATE"||p.t==="GROUP_MESSAGE_CREATE"){
    await this.state.storage.put("last_event_at",new Date().toISOString());
    const result=await onAbotAiEvent(this.env,p);
    if(result?.status==="failed")await this.recordError("SEND_OR_MODEL_"+String(result.errorCode||"UNKNOWN"));
   }
  }
  if(p?.op===7||p?.op===9){
   try{this.ws?.close(1000,"gateway_reconnect");}catch{}
   this.ws=null;this.ready=false;
   await this.state.storage.setAlarm(Date.now()+20000);
  }
 }
 async alarm(){
  if(String(this.env.QQ_AI_ABOT_ENABLED)!=="true"){await this.shutdown();return;}
  if(this.ws?.readyState===1){
   try{this.ws.send(JSON.stringify({op:1,d:this.seq}));}
   catch{await this.recordError("HEARTBEAT_SEND_FAILED");}
   await this.state.storage.setAlarm(Date.now()+this.interval);
  }else{
   try{await this.ensure();}
   catch(e){await this.recordError("RECONNECT_"+String(e?.status||"FAILED"));await this.state.storage.setAlarm(Date.now()+60000);}
  }
 }
 async shutdown(){
  try{this.ws?.close(1000,"operator_shutdown");}catch{}
  this.ws=null;this.ready=false;
  try{await this.state.storage.deleteAlarm();}catch{}
 }
}
