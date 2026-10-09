import {BRIDGE_ECHO_MARKER,qq,parseCommand,parseOnebot,isRelayable} from "./core.js";
import {init,get,all,run,digest,roster,recordRoster,groupByQq} from "./store.js";
import {relayOperations} from "./relay.js";
import {deliver} from "./delivery.js";
import {handleNapcatCommand} from "./napcat-control.js";

// No Abot event subscription or QQ Open Platform API use in Bbot-only mode.
// Keep the original D1 tables and records intact for a possible future re-enable.
let extraReady=false;
async function ready(env){
 await init(env.DB);
 if(!extraReady){
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS bridge_outbox (id TEXT PRIMARY KEY, target_group TEXT NOT NULL, target_qq_group_id TEXT NOT NULL, content TEXT NOT NULL, payload TEXT NOT NULL, state TEXT NOT NULL, error TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)").run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS bridge_outbox_state_idx ON bridge_outbox(state,created_at)").run();
  extraReady=true;
 }
}
const now=()=>Date.now();
async function logDelivery(env,id,target,status,error=""){
 await run(env.DB,"INSERT OR REPLACE INTO bridge_deliveries(id,target_group,status,error,created_at) VALUES(?,?,?,?,?)",id,target,status,String(error).slice(0,220),now());
}
// Called only from the authenticated OneBot WebSocket or authenticated OneBot HTTP endpoint.
export async function onOnebotEvent(env,event,reply){
 const msg=parseOnebot(event);
 if(!msg)return {ignored:true};
 if(msg.senderQq===msg.selfId||msg.senderQq===qq(env.ABOT_QQ_ID)||msg.text.includes(BRIDGE_ECHO_MARKER))
  return {ignored:true,reason:"self_or_echo"};
 await ready(env);
 const command=parseCommand(msg.text);
 if(command)return handleNapcatCommand(env,msg,command,reply);
 const source=await groupByQq(env.DB,msg.groupId);
 if(!source?.verified)return {ignored:true,reason:"group_not_paired"};
 if(source.stopped||!isRelayable(msg))return {ignored:true,reason:"not_relayable"};
 if(!msg.messageId)return {ignored:true,reason:"missing_message_id"};
 const targets=await all(env.DB,
  "SELECT * FROM bridge_groups WHERE room_id=? AND verified=1 AND stopped=0 AND group_openid<>?",
  source.room_id,source.group_openid);
 let added=0;
 for(const target of targets){
  // A numeric QQ group ID is essential to Bbot. An OpenID is never substituted.
  if(!qq(target.qq_group_id)){
   console.warn("BBOT_TARGET_MISSING_QQ_ID");
   continue;
  }
  const rosterState=await roster(env.DB,target.qq_group_id);
  const members=rosterState.fresh?await all(env.DB,
   "SELECT qq_id FROM bridge_members WHERE qq_group_id=?",target.qq_group_id):[];
  const operations=relayOperations(source.alias||source.display_name||"QQ群 "+msg.groupId,
   msg.senderName,msg.parts,{},{
    realMentions:false,
    targetMembers:new Set(members.map(x=>x.qq_id))
   });
  for(const operation of operations){
   const id=await digest(msg.groupId+":"+msg.messageId+"|"+target.group_openid+"|"+operation.index);
   const result=await run(env.DB,
    "INSERT OR IGNORE INTO bridge_outbox(id,target_group,target_qq_group_id,content,payload,state,created_at,updated_at) VALUES(?,?,?,?,?,'pending',?,?)",
    id,target.group_openid,target.qq_group_id,operation.content,JSON.stringify(operation),now()+operation.index,now());
   if(Number(result.meta?.changes||0))added++;
  }
 }
 return {forwarded:added,total:targets.length};
}
export async function onOnebotRoster(env,groupId,members,groupName){
 await ready(env);
 const id=qq(groupId);
 if(!id)throw new Error("INVALID_GROUP_ID");
 await recordRoster(env.DB,id,members);
 if(groupName)await run(env.DB,"UPDATE bridge_groups SET display_name=? WHERE qq_group_id=?",String(groupName).slice(0,60),id);
 return {ok:true};
}
export async function flushOutbox(env,limit=15,deliveryOptions={}){
 await ready(env);
 // Do not claim and discard queued messages when Bbot's WebSocket is offline.
 // The cron can pick them up after reconnection.
 if(!deliveryOptions.sendBbot){
  const hub=env.ONEBOT_HUB?.get(env.ONEBOT_HUB.idFromName("bridge-bbot-napcat-v2"));
  if(!hub)return {sent:0,failed:0,offline:true};
  const status=await hub.fetch("https://internal/status").catch(()=>null);
  const connected=status?.ok&&((await status.json().catch(()=>({})))?.connected);
  if(!connected)return {sent:0,failed:0,offline:true};
 }
 const pending=await all(env.DB,
  "SELECT * FROM bridge_outbox WHERE state='pending' ORDER BY created_at ASC LIMIT ?",limit);
 let sent=0,failed=0;
 for(const item of pending){
  const target=await get(env.DB,
   "SELECT stopped,verified,qq_group_id FROM bridge_groups WHERE group_openid=?",item.target_group);
  if(!target?.verified||target.stopped||target.qq_group_id!==item.target_qq_group_id){
   await run(env.DB,"UPDATE bridge_outbox SET state='cancelled',content='',payload='',updated_at=? WHERE id=? AND state='pending'",now(),item.id);
   continue;
  }
  const claimed=await run(env.DB,
   "UPDATE bridge_outbox SET state='sending',updated_at=? WHERE id=? AND state='pending'",now(),item.id);
  if(!Number(claimed.meta?.changes||0))continue;
  // For DO alarms, supply a direct same-WebSocket sender to prevent self-stub deadlocks.
  const result=await deliver(env,item,deliveryOptions);
  await run(env.DB,"UPDATE bridge_outbox SET state=?,content='',payload='',error=?,updated_at=? WHERE id=?",
   result.status,result.error||"",now(),item.id);
  await logDelivery(env,item.id,item.target_group,result.status,result.error);
  if(result.status==="sent_bbot")sent++;else failed++;
 }
 await run(env.DB,"DELETE FROM bridge_seen WHERE created_at<?",now()-86400000);
 await run(env.DB,"DELETE FROM bridge_deliveries WHERE created_at<?",now()-7*86400000);
 await run(env.DB,"DELETE FROM bridge_pending_ids WHERE expires_at<?",now());
 return {sent,failed};
}
