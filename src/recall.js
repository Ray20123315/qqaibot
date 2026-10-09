import {qq,clean} from "./core.js";
import {get,all,run} from "./store.js";

const messageIdValid=value=>/^-?[0-9]{1,16}$/.test(String(value||"")) && Number.isSafeInteger(Number(value));
export function parseRecallEvent(event){
 if(event?.post_type!=="notice"||event.notice_type!=="group_recall")return null;
 const group=qq(event.group_id),msg=clean(event.message_id,32);
 if(!group||!messageIdValid(msg))return null;
 return {sourceGroup:group,sourceMessage:msg};
}
export async function initRecall(db){
 await db.prepare("CREATE TABLE IF NOT EXISTS bridge_recalled_sources (source_group TEXT NOT NULL,source_message TEXT NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(source_group,source_message))").run();
 await db.prepare("CREATE TABLE IF NOT EXISTS bridge_recall_map (source_group TEXT NOT NULL,source_message TEXT NOT NULL,target_group TEXT NOT NULL,target_message TEXT NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(source_group,source_message,target_group,target_message))").run();
 await db.prepare("CREATE TABLE IF NOT EXISTS bridge_recall_queue (source_group TEXT NOT NULL,source_message TEXT NOT NULL,target_group TEXT NOT NULL,target_message TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'pending',created_at INTEGER NOT NULL,PRIMARY KEY(source_group,source_message,target_group,target_message))").run();
}
export async function queueRecall(db,sourceGroup,sourceMessage,targetGroup,targetMessage){
 if(!qq(sourceGroup)||!qq(targetGroup)||!messageIdValid(sourceMessage)||!messageIdValid(targetMessage))return false;
 const res=await run(db,"INSERT OR IGNORE INTO bridge_recall_queue(source_group,source_message,target_group,target_message,state,created_at) VALUES(?,?,?,?,'pending',?)",sourceGroup,String(sourceMessage),targetGroup,String(targetMessage),Date.now());
 return Number(res.meta?.changes||0)>0;
}
export async function recordRelayMessage(db,item,targetMessage){
 const payload=JSON.parse(item.payload||"{}"),sg=qq(payload.sourceGroupId),sm=String(payload.sourceMessageId||"");
 if(!sg||!messageIdValid(sm)||!messageIdValid(targetMessage))return false;
 await run(db,"INSERT OR IGNORE INTO bridge_recall_map(source_group,source_message,target_group,target_message,created_at) VALUES(?,?,?,?,?)",sg,sm,item.target_qq_group_id,String(targetMessage),Date.now());
 const recall=await get(db,"SELECT source_message FROM bridge_recalled_sources WHERE source_group=? AND source_message=?",sg,sm);
 if(recall)return await queueRecall(db,sg,sm,item.target_qq_group_id,String(targetMessage));
 return false;
}
export async function handleRecallEvent(db,event){
 const e=parseRecallEvent(event);
 if(!e)return {ignored:true};
 // No untrusted user-provided target_message is accepted: targets come only
 // from authenticated Bbot send_group_msg ACKs stored in bridge_recall_map.
 await run(db,"INSERT OR IGNORE INTO bridge_recalled_sources(source_group,source_message,created_at) VALUES(?,?,?)",e.sourceGroup,e.sourceMessage,Date.now());
 const originals=await all(db,"SELECT target_group,target_message FROM bridge_recall_map WHERE source_group=? AND source_message=?",e.sourceGroup,e.sourceMessage);
 let added=0;
 for(const target of originals)if(await queueRecall(db,e.sourceGroup,e.sourceMessage,target.target_group,target.target_message))added++;
 // Prevent pending messages from being forwarded after an original is recalled.
 await run(db,"UPDATE bridge_outbox SET state='cancelled',content='',payload='',updated_at=? WHERE state='pending' AND json_extract(payload,'$.sourceGroupId')=? AND json_extract(payload,'$.sourceMessageId')=?",Date.now(),e.sourceGroup,e.sourceMessage);
 return {handled:true,recalls:added,forwarded:added};
}
export async function drainRecalls(db,deleteBbot,limit=20){
 const pending=await all(db,"SELECT * FROM bridge_recall_queue WHERE state='pending' ORDER BY created_at ASC LIMIT ?",limit);
 let sent=0,failed=0;
 for(const item of pending){
  const claim=await run(db,"UPDATE bridge_recall_queue SET state='sending' WHERE source_group=? AND source_message=? AND target_group=? AND target_message=? AND state='pending'",item.source_group,item.source_message,item.target_group,item.target_message);
  if(!Number(claim.meta?.changes||0))continue;
  let status="done";
  try{await deleteBbot(item.target_message,item.target_group);sent++;}
  catch(e){status="failed";failed++;console.warn("BBOT_RECALL_FAILED",String(e).slice(0,140));}
  await run(db,"UPDATE bridge_recall_queue SET state=? WHERE source_group=? AND source_message=? AND target_group=? AND target_message=?",status,item.source_group,item.source_message,item.target_group,item.target_message);
 }
 await run(db,"DELETE FROM bridge_recall_map WHERE created_at<?",Date.now()-7*86400000);
 await run(db,"DELETE FROM bridge_recalled_sources WHERE created_at<?",Date.now()-7*86400000);
 return {processed:pending.length,sent,failed};
}
