
import {onOnebotEvent,onOnebotRoster,onOfficialEvent,flushOutbox} from "./src/bridge.js";
import {qqRequest,accessToken} from "./src/qq-api.js";
import {qq,parseOnebot} from "./src/core.js";
import {roster,init} from "./src/store.js";
import {outboundAction} from "./src/relay.js";
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
async function secretMatches(request,secret){
 if(!secret)return false;
 const provided=request.headers.get("authorization")?.replace(/^Bearer\s+/i,"")||request.headers.get("x-onebot-token")||"";
 const a=new TextEncoder().encode(provided),b=new TextEncoder().encode(secret);
 if(a.length!==b.length||!a.length)return false;
 const [x,y]=await Promise.all([crypto.subtle.digest("SHA-256",a),crypto.subtle.digest("SHA-256",b)]);
 return Array.from(new Uint8Array(x)).every((v,i)=>v===new Uint8Array(y)[i]);
}
const hub=env=>env.ONEBOT_HUB.get(env.ONEBOT_HUB.idFromName("bridge-bbot"));
// New Durable Object identity: supersedes the gateway instance left active across
// the 2026-10-09 main cutover. Future revisions should keep this stable.
const gateway=env=>env.QQ_OPEN_GATEWAY.get(env.QQ_OPEN_GATEWAY.idFromName("bridge-abot-commands-v2"));
export default {
 async fetch(request,env){
  const path=new URL(request.url).pathname;
  if(path==="/health"&&request.method==="GET"){
   const [b,g]=await Promise.allSettled([hub(env).fetch("https://internal/status"),gateway(env).fetch("https://internal/status")]);
   const bbot=b.status==="fulfilled"&&b.value.ok?await b.value.json():{connected:false};
   const abot=g.status==="fulfilled"&&g.value.ok?await g.value.json():{connected:false};
   return json({service:"qq-cross-group-bridge",ai:false,configured:!!(env.ONEBOT_ACCESS_TOKEN&&env.QQ_OPEN_APP_ID&&env.QQ_OPEN_CLIENT_SECRET),
    bbot:{connected:!!bbot.connected},abot:{connected:!!abot.connected,session_ready:!!abot.ready},command_prefix:"/! or !",
    verification:"napcat",primary_command_transport:"bbot"});
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
     return json(await onOnebotRoster(env,data.group_id,data.members,data.group_name));
    }
    return json(await onOnebotEvent(env,data));
   }catch(e){console.error("ONEBOT_HTTP_ERROR",String(e).slice(0,300));return json({error:"ingest_failed"},503);}
  }
  return json({error:"not_found"},404);
 },
 async scheduled(event,env,ctx){
  ctx.waitUntil(gateway(env).fetch("https://internal/ensure").catch(e=>console.error("ABOT_GATEWAY",String(e).slice(0,220))));
  ctx.waitUntil(flushOutbox(env,15).catch(e=>console.error("RELAY_FLUSH",String(e).slice(0,220))));
 }
};
export class OneBotHub {
 constructor(state,env){this.state=state;this.env=env;this.pending=new Map();this.inflight=new Map();this.lastRosterRequested=new Map();}
 async fetch(request){
  const pathname=new URL(request.url).pathname;
  if(pathname==="/status" && request.method==="GET")return json({connected:!!this.socket()});
  if(pathname==="/send" && request.method==="POST"){
   let data;try{data=await request.json();}catch{return json({ok:false,reason:"invalid_payload"},400);}
   const ws=this.socket();
   if(!ws)return json({ok:false,reason:"bbot_disconnected"},503);
   try{return await this.dispatch(ws,data.id,data.groupId,data.segments);}
   catch{return json({ok:false,reason:"invalid_action"},400);}
  }
  if(pathname!=="/ws" || request.headers.get("upgrade")?.toLowerCase()!=="websocket")return json({error:"not_found"},404);
  for(const existing of this.state.getWebSockets())try{existing.close(1000,"reconnected");}catch{}
  const pair=new WebSocketPair(),[client,server]=Object.values(pair);
  this.state.acceptWebSocket(server);
  console.log("BBOT_WS_CONNECTED");
  return new Response(null,{status:101,webSocket:client});
 }
 socket(){return this.state.getWebSockets().find(ws=>ws.readyState===1);}
 async dispatch(ws,id,groupId,segments){
  const outbound=outboundAction(String(id||""),groupId,segments);
  if(this.inflight.has(outbound.echo))return json({ok:false,reason:"duplicate_inflight"},409);
  return await new Promise(resolve=>{
   const timer=setTimeout(()=>{this.inflight.delete(outbound.echo);resolve(json({ok:false,reason:"ambiguous_timeout"},504));},10000);
   this.inflight.set(outbound.echo,{resolve,timer});
   try{ws.send(JSON.stringify(outbound));}
   catch{clearTimeout(timer);this.inflight.delete(outbound.echo);resolve(json({ok:false,reason:"bbot_socket_unavailable"},503));}
  });
 }
 async replyFromBbot(ws,groupId,text){
  const segments=[{type:"text",data:{text:String(text).slice(0,1900)}}];
  const result=await this.dispatch(ws,"cmd-"+crypto.randomUUID(),groupId,segments);
  if(!result.ok)throw new Error("BBOT_COMMAND_SEND_"+result.status);
  const obj=await result.json();
  if(!obj.ok)throw new Error("BBOT_COMMAND_SEND_"+obj.reason);
  console.log("BBOT_COMMAND_REPLY_OK");
 }
 async afterHandled(result){
  if(result?.forwarded>0)await this.state.storage.setAlarm(Date.now()+1000);
 }
 async alarm(){
  if(this.socket())try{await flushOutbox(this.env,12);}catch(e){console.error("BBOT_RELAY_FLUSH",String(e).slice(0,130));}
 }

 requestRoster(ws,group){
  const current=Date.now();
  if(current-(this.lastRosterRequested.get(group)||0)<3000)return;
  this.lastRosterRequested.set(group,current);
  ws.send(JSON.stringify({action:"get_group_member_list",params:{group_id:Number(group),no_cache:true},echo:"bridge-roster:"+group}));
  ws.send(JSON.stringify({action:"get_group_info",params:{group_id:Number(group),no_cache:true},echo:"bridge-info:"+group}));
 }
 async webSocketMessage(ws,message){
  let data;try{data=JSON.parse(typeof message==="string"?message:new TextDecoder().decode(message));}catch{return;}
  const echo=String(data?.echo||"");
  if(echo.startsWith("bridge-send:")){
   const pending=this.inflight.get(echo);
   if(pending){
    clearTimeout(pending.timer);this.inflight.delete(echo);
    const success=data?.status==="ok" && Number(data?.retcode||0)===0;
    pending.resolve(json(success?{ok:true}:{ok:false,reason:"qq_rejected_"+String(data?.retcode||"unknown")},success?200:422));
   }
   return;
  }
  if(echo.startsWith("bridge-roster:")){
   const group=echo.slice(14);
   if(data?.status==="ok"&&Array.isArray(data.data)){
    await onOnebotRoster(this.env,group,data.data);
    const queueKey="queue:"+group;
    const queued=(await this.state.storage.get(queueKey))||[];
    await this.state.storage.delete(queueKey);
    const name=(await this.state.storage.get("groupname:"+group))||"";
    for(const evt of queued){
     evt.__bridge_group_name=name;
     const result=await onOnebotEvent(this.env,evt,text=>this.replyFromBbot(ws,group,text));
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
   const result=await onOnebotEvent(this.env,data,text=>this.replyFromBbot(ws,msg.groupId,text));
   await this.afterHandled(result);
  }catch(e){console.error("BBOT_EVENT_FAILED",String(e).slice(0,250));}
 }
 async webSocketClose(ws,code,reason){try{ws.close(code,reason);}catch{}}
 async webSocketError(ws,error){console.error("BBOT_SOCKET_ERROR",String(error).slice(0,150));}
}
export class QqOpenGateway {
 constructor(state,env){this.state=state;this.env=env;this.ws=null;this.token="";this.seq=null;this.sessionId="";this.interval=30000;this.connecting=false;}
 async fetch(request){
  const path=new URL(request.url).pathname;
  if(path==="/status" && request.method==="GET")return json({connected:this.ws?.readyState===1,ready:!!this.sessionId});
  if(path!=="/ensure")return json({error:"not_found"},404);
  try{await this.ensure();return json({active:!!this.ws,connecting:this.connecting,ready:!!this.sessionId});}
  catch(e){console.error("QQ_OPEN_CONNECT_FAILED",String(e).slice(0,200));await this.state.storage.setAlarm(Date.now()+30000);return json({error:"gateway_failed"},503);}
 }
 async ensure(){
  if(this.ws&&[0,1].includes(this.ws.readyState))return;
  if(this.connecting)return;
  this.connecting=true;
  try{
   this.token=await accessToken(this.env);
   const data=await qqRequest(this.env,"/gateway");
   if(!/^wss:\/\//.test(data?.url||""))throw new Error("INVALID_GATEWAY_URL");
   const ws=new WebSocket(data.url);this.ws=ws;
   ws.addEventListener("open",()=>{this.connecting=false;});
   ws.addEventListener("message",event=>{this.handleMessage(event.data).catch(e=>console.error("QQ_OPEN_EVENT_FAILED",String(e).slice(0,250)));});
   ws.addEventListener("close",event=>{console.warn("ABOT_GATEWAY_CLOSED",event.code);if(this.ws===ws){this.ws=null;this.connecting=false;this.sessionId="";}this.state.storage.setAlarm(Date.now()+10000).catch(()=>{});});
   ws.addEventListener("error",()=>{this.connecting=false;});
   await this.state.storage.setAlarm(Date.now()+30000);
  }finally{this.connecting=false;}
 }
 async handleMessage(message){
  let payload;try{payload=JSON.parse(message);}catch{return;}
  if(Number.isInteger(payload?.s))this.seq=payload.s;
  const op=payload?.op;
  if(op===10){
   this.interval=Math.max(5000,Number(payload.d?.heartbeat_interval||30000));
   this.ws?.send(JSON.stringify({op:2,d:{token:"QQBot "+this.token,intents:Number(this.env.QQ_OPEN_INTENTS||100663296),shard:[0,1],properties:{"$os":"cloudflare","$browser":"QQAIBOT-bridge","$device":"QQAIBOT-bridge"}}}));
   await this.state.storage.setAlarm(Date.now()+this.interval);
  }
  if(op===0){
   if(payload.t==="READY"){this.sessionId=payload.d?.session_id||"";console.log("ABOT_GATEWAY_READY");}
   if(payload.t==="GROUP_AT_MESSAGE_CREATE"||payload.t==="GROUP_MESSAGE_CREATE"){
     // Log event type only; do not retain message content or QQ user data.
     console.log("ABOT_GROUP_EVENT_RECEIVED",payload.t);
     const outcome=await onOfficialEvent(this.env,payload);
     console.log("ABOT_GROUP_COMMAND_RESULT",JSON.stringify({handled:!!outcome?.handled,ignored:!!outcome?.ignored,reply:outcome?.reply??null}));
   }
  }
  if(op===7||op===9){try{this.ws?.close();}catch{}this.ws=null;await this.state.storage.setAlarm(Date.now()+10000);}
 }
 async alarm(){
  if(this.ws?.readyState===1){
   try{this.ws.send(JSON.stringify({op:1,d:this.seq}));}catch(e){console.error("QQ_HEARTBEAT",String(e).slice(0,100));}
   await this.state.storage.setAlarm(Date.now()+this.interval);
  }else{
   try{await this.ensure();}catch(e){console.error("QQ_RECONNECT",String(e).slice(0,170));await this.state.storage.setAlarm(Date.now()+30000);}
  }
 }
}
