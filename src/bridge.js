
import {BRIDGE_ECHO_MARKER,clean,qq,isProtected,parseCommand,parseOnebot,authorize,formatForward,isRelayable} from "./core.js";
import {init,get,all,run,digest,makeCode,groupByQq,groupByOpen,roster,recordRoster} from "./store.js";
import {sendGroup,groupBotState} from "./qq-api.js";
import {relayOperations} from "./relay.js";
import {deliver} from "./delivery.js";
import {pairCanFinalize} from "./pairing.js";
let extraReady=false;
async function ready(env){
 await init(env.DB);
 if(!extraReady){
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS bridge_outbox (id TEXT PRIMARY KEY, target_group TEXT NOT NULL, target_qq_group_id TEXT NOT NULL, content TEXT NOT NULL, payload TEXT NOT NULL, state TEXT NOT NULL, error TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)").run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS bridge_outbox_state_idx ON bridge_outbox(state,created_at)").run();
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS bridge_id_proof (token_hash TEXT PRIMARY KEY, official_confirmed INTEGER NOT NULL DEFAULT 0, qq_id TEXT, verified_at INTEGER NOT NULL DEFAULT 0)").run();
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS bridge_reply_context (group_openid TEXT PRIMARY KEY, msg_id TEXT NOT NULL, expires_at INTEGER NOT NULL)").run();
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS bridge_pair_proof (token_hash TEXT PRIMARY KEY, group_openid TEXT NOT NULL, bbot_group TEXT NOT NULL DEFAULT '', actor_qq TEXT NOT NULL DEFAULT '', display_name TEXT NOT NULL DEFAULT '', official_seen INTEGER NOT NULL DEFAULT 0, bbot_seen INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL)").run();
  extraReady=true;
 }
}
const now=()=>Date.now();
const sanitizeAlias=v=>clean(v,24).replace(/[<>\[\]]/g,"");
const adminRole=role=>role==="owner"||role==="admin";
export async function answer(env,group,text,msgId,sendImpl=sendGroup) {
 // Use the inbound message ID for passive replies. A definite 40034024
 // means the platform rejected that ID; a single proactive send is safe.
 if(!msgId){
   const ctx=await get(env.DB,"SELECT msg_id FROM bridge_reply_context WHERE group_openid=? AND expires_at>?",group,now());
   msgId=ctx?.msg_id||undefined;
 }
 const content=text+BRIDGE_ECHO_MARKER;
 try {await sendImpl(env,group,content,msgId);return true;}
 catch(e){
   if(msgId && Number(e?.code)===40034024){
     console.warn("ABOT_REPLY_INVALID_MSG_ID_PROACTIVE_RETRY");
     try {await sendImpl(env,group,content);return true;}
     catch(fallbackError){
       console.error("ABOT_PROACTIVE_REPLY_FAILED",String(fallbackError).slice(0,240));
       return false;
     }
   }
   console.error("ABOT_RESPONSE_FAILED",String(e).slice(0,240));
   return false;
 }
}
async function logDelivery(env,id,target,state,error=""){
 await run(env.DB,"INSERT OR REPLACE INTO bridge_deliveries(id,target_group,status,error,created_at) VALUES(?,?,?,?,?)",id,target,state,clean(error,220),now());
}
async function initialGroup(env,groupOpenid,roomId,alias,nonce){
 const hashed=await digest(nonce);
 await run(env.DB,`INSERT INTO bridge_groups(group_openid,room_id,alias,verified,stopped,pairing_hash,pairing_expires,created_at)
 VALUES(?,?,?,0,0,?,?,?)`,groupOpenid,roomId,sanitizeAlias(alias),hashed,now()+300000,now());
}
export async function onOfficialEvent(env,payload){
 const d=payload?.d||{},kind=String(payload?.t||"");
 if(!["GROUP_AT_MESSAGE_CREATE","GROUP_MESSAGE_CREATE"].includes(kind))return {ignored:true};
 const groupOpenid=clean(d.group_openid,256),memberOpenid=clean(d.author?.member_openid||d.author?.user_openid,256);
 if(!groupOpenid||!memberOpenid)return {ignored:true};
 const command=parseCommand(d.content);
 if(!command)return {ignored:true};
 await ready(env);
 // QQ official messages are trusted only for opaque OpenIDs; numeric IDs are never inferred.
 const current=await groupByOpen(env.DB,groupOpenid);
 const msgId=clean(d.id,128);
 if(msgId)await run(env.DB,"INSERT INTO bridge_reply_context(group_openid,msg_id,expires_at) VALUES(?,?,?) ON CONFLICT(group_openid) DO UPDATE SET msg_id=excluded.msg_id,expires_at=excluded.expires_at",groupOpenid,msgId,now()+120000);
 if(command.name==="help")return {handled:true,reply:await answer(env,groupOpenid,"指令：/!use /!代碼 簡寫 /!verify /!status /!stop /!resume /!leave /!rename 名稱 /!revoke /!code /!grant QQ號 manage|stop|both /!ungrant QQ號 /!id /!verifyid",msgId)};
 if(command.name==="use"){
  if(current?.verified)return {handled:true,reply:await answer(env,groupOpenid,"本群已建立連線，請使用 /!status。",msgId)};
  const invite=makeCode(12),roomId=crypto.randomUUID(),nonce=makeCode(10);
  await run(env.DB,"INSERT INTO bridge_rooms(id,code_hash,created_at) VALUES(?,?,?)",roomId,await digest(invite),now());
  if(current){
    // A prior /use might have created data before the response was rejected.
    // Regenerate both codes so the group is never stranded in pending state.
    await run(env.DB,"UPDATE bridge_groups SET room_id=?,pairing_hash=?,pairing_expires=?,stopped=0 WHERE group_openid=? AND verified=0",
      roomId,await digest(nonce),now()+300000,groupOpenid);
    await run(env.DB,"UPDATE bridge_rooms SET revoked=1 WHERE id=?",current.room_id);
  }else{
    await initialGroup(env,groupOpenid,roomId,"",nonce);
  }
  const response="連線代碼："+invite+"\n待驗證：請本群群主或管理員在這個群送出 @AIBot /!verify "+nonce+"。\nAbot 和 Bbot 都收到後才會配對；請勿把驗證碼轉給其他群。";
  return {handled:true,reply:await answer(env,groupOpenid,response,msgId)};
 }
 if(command.name==="join"){
  if(current)return {handled:true,reply:await answer(env,groupOpenid,"此群已有連線；請先使用 /!leave。",msgId)};
  const room=await get(env.DB,"SELECT * FROM bridge_rooms WHERE code_hash=? AND active=1 AND revoked=0",await digest(command.code));
  if(!room)return {handled:true,reply:await answer(env,groupOpenid,"連線代碼無效、未驗證或已撤銷。",msgId)};
  const nonce=makeCode(10);await initialGroup(env,groupOpenid,room.id,command.arg,nonce);
  return {handled:true,reply:await answer(env,groupOpenid,"加入待驗證，請本群群主或管理員在本群輸入 @AIBot /!verify "+nonce,msgId)};
 }
 if(command.name==="verify"){
  const hash=await digest(command.arg.toUpperCase());
  const g=await get(env.DB,"SELECT * FROM bridge_groups WHERE group_openid=? AND pairing_hash=? AND verified=0 AND pairing_expires>?",groupOpenid,hash,now());
  if(!g)return {handled:true,reply:await answer(env,groupOpenid,"驗證碼無效，或不是本群產生的代碼。",msgId)};
  await run(env.DB,"INSERT OR IGNORE INTO bridge_pair_proof(token_hash,group_openid,official_seen,updated_at) VALUES(?,?,1,?)",hash,groupOpenid,now());
  await run(env.DB,"UPDATE bridge_pair_proof SET official_seen=1,updated_at=? WHERE token_hash=? AND group_openid=?",now(),hash,groupOpenid);
  const joined=await finishPair(env,hash);
  return {handled:true,reply:await answer(env,groupOpenid,joined?"群組雙重驗證成功，橋接已啟用。":"Abot 已確認本群，等待 Bbot 核對 QQ 群號及群主／管理員身分。",msgId)};
 }
 if(command.name==="id"){
  if(!current?.verified)return {handled:true};
  const nonce=makeCode(12);
  await run(env.DB,"INSERT INTO bridge_pending_ids(token_hash,group_openid,member_openid,expires_at) VALUES(?,?,?,?)",await digest(nonce),groupOpenid,memberOpenid,now()+180000);
  return {handled:true,reply:await answer(env,groupOpenid,"身分配對：請由同一 QQ 帳號送出 @AIBot /!verifyid "+nonce+"（三分鐘內有效）。",msgId)};
 }
 if(command.name==="verifyid"){
  const hash=await digest(command.arg.toUpperCase());
  const pending=await get(env.DB,"SELECT * FROM bridge_pending_ids WHERE token_hash=?",hash);
  if(!pending||pending.group_openid!==groupOpenid||pending.member_openid!==memberOpenid||pending.expires_at<now())
   return {handled:true,reply:await answer(env,groupOpenid,"配對碼無效或發送者不一致。",msgId)};
  await run(env.DB,"INSERT INTO bridge_id_proof(token_hash,official_confirmed,verified_at) VALUES(?,1,?) ON CONFLICT(token_hash) DO UPDATE SET official_confirmed=1, verified_at=excluded.verified_at",hash,now());
  await finishIdentity(env,hash);
  return {handled:true,reply:await answer(env,groupOpenid,"已收到 Abot 識別，等候 Bbot 的 QQ ID 核對。",msgId)};
 }
 if(command.name==="status"){
  const group=current;
  const status=!group?"未連線":group.verified?(group.stopped?"已停止":"運作中"):"待 Bbot 驗證";
  let proactive="未知（狀態 API 可能未開放）";
  try {const state=await groupBotState(env,groupOpenid);
    if(typeof state.allow_proactive_msg==="boolean")proactive=state.allow_proactive_msg?"已開啟":"未開啟（請群主在 QQ 群機器人設定開啟）";
  }catch{};
  return {handled:true,reply:await answer(env,groupOpenid,"跨群橋接："+status+(group?.alias?"\n簡寫："+group.alias:"")+"\nAbot 主動發言："+proactive,msgId)};
 }
 return {handled:false}; // Sensitive operations are authorized ONLY by trusted Bbot numeric IDs.
}
async function finishIdentity(env,hash){
 const pending=await get(env.DB,"SELECT * FROM bridge_pending_ids WHERE token_hash=?",hash);
 const proof=await get(env.DB,"SELECT * FROM bridge_id_proof WHERE token_hash=?",hash);
 if(!pending||!proof?.official_confirmed||!qq(proof.qq_id)||pending.expires_at<now())return false;
 const group=await groupByOpen(env.DB,pending.group_openid);
 const auth=group&&await roster(env.DB,group.qq_group_id);
 const inGroup=group&&await get(env.DB,"SELECT qq_id FROM bridge_members WHERE qq_group_id=? AND qq_id=?",group.qq_group_id,proof.qq_id);
 if(!group?.verified || !auth?.fresh || !inGroup)return false;
 await run(env.DB,"INSERT INTO bridge_identities(group_openid,qq_id,member_openid,bound_at) VALUES(?,?,?,?) ON CONFLICT(group_openid,qq_id) DO UPDATE SET member_openid=excluded.member_openid,bound_at=excluded.bound_at",group.group_openid,proof.qq_id,pending.member_openid,now());
 await run(env.DB,"DELETE FROM bridge_pending_ids WHERE token_hash=?",hash);
 await run(env.DB,"DELETE FROM bridge_id_proof WHERE token_hash=?",hash);
 return true;
}
async function finishPair(env,hash){
 const group=await get(env.DB,"SELECT * FROM bridge_groups WHERE pairing_hash=? AND verified=0 AND pairing_expires>?",hash,now());
 const proof=await get(env.DB,"SELECT * FROM bridge_pair_proof WHERE token_hash=?",hash);
 if(!group||!proof||!qq(proof.bbot_group))return false;
 const view=await roster(env.DB,proof.bbot_group);
 const actor=await get(env.DB,"SELECT role FROM bridge_members WHERE qq_group_id=? AND qq_id=?",proof.bbot_group,proof.actor_qq);
 const exists=await groupByQq(env.DB,proof.bbot_group);
 if(!pairCanFinalize(group,proof,view,actor,exists))return false;
 const result=await run(env.DB,"UPDATE bridge_groups SET qq_group_id=?,verified=1,pairing_hash=NULL,pairing_expires=0,display_name=? WHERE group_openid=? AND verified=0",
 proof.bbot_group,clean(proof.display_name||"QQ群 "+proof.bbot_group,60),group.group_openid);
 if(!Number(result.meta?.changes||0))return false;
 await run(env.DB,"UPDATE bridge_rooms SET active=1,creator_qq=COALESCE(creator_qq,?) WHERE id=?",proof.actor_qq,group.room_id);
 await run(env.DB,"DELETE FROM bridge_pair_proof WHERE token_hash=?",hash);
 return true;
}
async function verifyPair(env,msg,command){
 const hash=await digest(command.arg.toUpperCase());
 const group=await get(env.DB,"SELECT * FROM bridge_groups WHERE pairing_hash=? AND verified=0 AND pairing_expires>?",hash,now());
 if(!group)return false;
 const view=await roster(env.DB,msg.groupId);
 const actor=await get(env.DB,"SELECT role FROM bridge_members WHERE qq_group_id=? AND qq_id=?",msg.groupId,msg.senderQq);
 if(!view.fresh||(!adminRole(actor?.role)&&!isProtected(msg.senderQq))){
  await answer(env,group.group_openid,"只有已驗證的群主／管理員或受保護帳號可以配對。");return true;
 }
 const exists=await groupByQq(env.DB,msg.groupId);
 if(exists&&exists.group_openid!==group.group_openid){
  await answer(env,group.group_openid,"此 QQ 群已綁定另一個連線。");return true;
 }
 await run(env.DB,"INSERT OR IGNORE INTO bridge_pair_proof(token_hash,group_openid,bbot_group,actor_qq,display_name,bbot_seen,updated_at) VALUES(?,?,?,?,?,1,?)",
 hash,group.group_openid,msg.groupId,msg.senderQq,clean(msg.groupName||"QQ群 "+msg.groupId,60),now());
 const recorded=await get(env.DB,"SELECT * FROM bridge_pair_proof WHERE token_hash=?",hash);
 if(recorded.group_openid!==group.group_openid||(recorded.bbot_group&&recorded.bbot_group!==msg.groupId))return true;
 await run(env.DB,"UPDATE bridge_pair_proof SET bbot_group=?,actor_qq=?,display_name=?,bbot_seen=1,updated_at=? WHERE token_hash=? AND group_openid=? AND (bbot_group='' OR bbot_group=?)",
 msg.groupId,msg.senderQq,clean(msg.groupName||"QQ群 "+msg.groupId,60),now(),hash,group.group_openid,msg.groupId);
 const joined=await finishPair(env,hash);
 if(joined)await answer(env,group.group_openid,"群組雙重驗證成功，跨群橋接已啟用。");
 return true;
}

async function handleControl(env,group,msg,command){
 const name=command.name;
 if(name==="help")return answer(env,group.group_openid,"指令：/!use /!代碼 簡寫 /!verify /!status /!stop /!resume /!leave /!rename 名稱 /!revoke /!code /!grant QQ號 manage|stop|both /!ungrant QQ號 /!id /!verifyid");
 if(name==="status"){
  const room=await get(env.DB,"SELECT COUNT(*) AS total FROM bridge_groups WHERE room_id=? AND verified=1",group.room_id);
  return answer(env,group.group_openid,"群組："+(group.alias||group.display_name)+"\n狀態："+(group.stopped?"已停止":"運作中")+"\n連線群數："+room.total+"\nAI 聊天：已停用");
 }
 if(name==="verifyid"){
  const hash=await digest(command.arg.toUpperCase());
  const pending=await get(env.DB,"SELECT * FROM bridge_pending_ids WHERE token_hash=?",hash);
  if(!pending||pending.group_openid!==group.group_openid||pending.expires_at<now())return false;
  await run(env.DB,"INSERT INTO bridge_id_proof(token_hash,qq_id,verified_at) VALUES(?,?,?) ON CONFLICT(token_hash) DO UPDATE SET qq_id=excluded.qq_id, verified_at=excluded.verified_at",hash,msg.senderQq,now());
  await finishIdentity(env,hash);return true;
 }
 const sensitive=new Set(["stop","resume","leave","rename","revoke","code","grant","ungrant"]);
 if(!sensitive.has(name))return false;
 const view=await roster(env.DB,msg.groupId);
 const actor=await get(env.DB,"SELECT role FROM bridge_members WHERE qq_group_id=? AND qq_id=?",msg.groupId,msg.senderQq);
 const grants=await all(env.DB,"SELECT scope FROM bridge_acl WHERE qq_group_id=? AND qq_id=?",msg.groupId,msg.senderQq);
 const allowed=authorize({actor:msg.senderQq,role:actor?.role||"member",protectedPresent:view.protectedPresent,rosterFresh:view.fresh,scopes:grants.map(x=>x.scope),action:name});
 if(!allowed.ok)return answer(env,group.group_openid,"操作遭拒："+allowed.reason);
 if(name==="grant"||name==="ungrant"){
  const [target,scope]=command.arg.split(/\s+/);
  if(!qq(target))return answer(env,group.group_openid,"請輸入有效 QQ 號");
  const exists=await get(env.DB,"SELECT qq_id FROM bridge_members WHERE qq_group_id=? AND qq_id=?",msg.groupId,target);
  if(!exists)return answer(env,group.group_openid,"只能授權本群內、且已經 Bbot 驗證的成員");
  if(name==="ungrant")await run(env.DB,"DELETE FROM bridge_acl WHERE qq_group_id=? AND qq_id=?",msg.groupId,target);
  else {
   if(!["manage","stop","both"].includes(scope))return answer(env,group.group_openid,"用法：/!grant QQ號 manage|stop|both");
   await run(env.DB,"DELETE FROM bridge_acl WHERE qq_group_id=? AND qq_id=?",msg.groupId,target);
   for(const s of scope==="both"?["manage","stop"]:[scope])await run(env.DB,"INSERT INTO bridge_acl(qq_group_id,qq_id,scope) VALUES(?,?,?)",msg.groupId,target,s);
  }
  return answer(env,group.group_openid,"授權設定已更新");
 }
 if(name==="rename"){
  if(!command.arg)return answer(env,group.group_openid,"用法：/!rename 新簡寫");
  await run(env.DB,"UPDATE bridge_groups SET alias=? WHERE group_openid=?",sanitizeAlias(command.arg),group.group_openid);
  return answer(env,group.group_openid,"簡寫已更新");
 }
 if(name==="stop"||name==="resume"){
  await run(env.DB,"UPDATE bridge_groups SET stopped=? WHERE group_openid=?",name==="stop"?1:0,group.group_openid);
  return answer(env,group.group_openid,name==="stop"?"本群跨群轉發已停止":"本群跨群轉發已恢復");
 }
 if(name==="leave"){
  await run(env.DB,"DELETE FROM bridge_groups WHERE group_openid=?",group.group_openid);
  await run(env.DB,"DELETE FROM bridge_acl WHERE qq_group_id=?",msg.groupId);
  return answer(env,group.group_openid,"本群已退出連線");
 }
 if(name==="revoke"){
  await run(env.DB,"UPDATE bridge_rooms SET revoked=1 WHERE id=?",group.room_id);
  return answer(env,group.group_openid,"原邀請代碼已撤銷，既有連線保持運作");
 }
 if(name==="code"){
  const newCode=makeCode(12);
  await run(env.DB,"UPDATE bridge_rooms SET code_hash=?,revoked=0 WHERE id=?",await digest(newCode),group.room_id);
  return answer(env,group.group_openid,"新連線代碼："+newCode);
 }
}
export async function onOnebotEvent(env,event){
 const msg=parseOnebot(event);if(!msg)return {ignored:true};
 if(msg.senderQq===msg.selfId||msg.senderQq===qq(env.ABOT_QQ_ID)||msg.text.includes(BRIDGE_ECHO_MARKER))return {ignored:true};
 await ready(env);
 const command=parseCommand(msg.text);
 if(command?.name==="verify")return {handled:await verifyPair(env,msg,command)};
 const group=await groupByQq(env.DB,msg.groupId);
 if(!group?.verified)return {ignored:true,reason:"group_not_paired"};
 if(command){
  if(["use","join","id","verify","status","help"].includes(command.name))return {ignored:true,reason:"official_command"};
  return {handled:await handleControl(env,group,msg,command)};
 }
 if(group.stopped||!isRelayable(msg))return {ignored:true};
 const key=msg.groupId+":"+msg.messageId;
 if(!msg.messageId)return {ignored:true,reason:"missing_message_id"};
 const destinations=await all(env.DB,"SELECT * FROM bridge_groups WHERE room_id=? AND verified=1 AND stopped=0 AND group_openid<>?",group.room_id,group.group_openid);
 let added=0;
 for(const target of destinations){
  const mapping=await all(env.DB,"SELECT qq_id,member_openid FROM bridge_identities WHERE group_openid=?",target.group_openid);
  const idMap=Object.fromEntries(mapping.map(m=>[m.qq_id,m.member_openid]));
  const memberRoster=target.qq_group_id?await roster(env.DB,target.qq_group_id):{fresh:false};
  const members=memberRoster.fresh?await all(env.DB,"SELECT qq_id FROM bridge_members WHERE qq_group_id=?",target.qq_group_id):[];
  const enabled=String(env.BRIDGE_REAL_MENTIONS||"false")==="true";
  const ops=relayOperations(group.alias||group.display_name||"QQ群 "+msg.groupId,msg.senderName,msg.parts,idMap,{
   realMentions:enabled,targetMembers:new Set(members.map(x=>x.qq_id))
  });
  for(const operation of ops){
   const id=await digest(key+"|"+target.group_openid+"|"+operation.index);
   const result=await run(env.DB,"INSERT OR IGNORE INTO bridge_outbox(id,target_group,target_qq_group_id,content,payload,state,created_at,updated_at) VALUES(?,?,?,?,?,'pending',?,?)",
     id,target.group_openid,target.qq_group_id||"",operation.content,JSON.stringify(operation),now()+operation.index,now());
   if(Number(result.meta?.changes||0))added++;
  }
 }
 if(added)await flushOutbox(env,3);
 return {forwarded:added,total:destinations.length};
}
export async function onOnebotRoster(env,groupId,members,groupName){
 await ready(env);
 await recordRoster(env.DB,qq(groupId),members);
 if(groupName){
  await run(env.DB,"UPDATE bridge_groups SET display_name=? WHERE qq_group_id=?",clean(groupName,60),qq(groupId));
 }
 return {ok:true};
}
export async function flushOutbox(env,limit=15){
 await ready(env);
 const pending=await all(env.DB,"SELECT * FROM bridge_outbox WHERE state='pending' ORDER BY created_at ASC LIMIT ?",limit);
 let sent=0,failed=0,bbot=0;
 for(const item of pending){
  const active=await get(env.DB,"SELECT stopped,verified,qq_group_id FROM bridge_groups WHERE group_openid=?",item.target_group);
  if(!active?.verified||active.stopped||active.qq_group_id!==item.target_qq_group_id){
    await run(env.DB,"UPDATE bridge_outbox SET state='cancelled',content='',payload='',updated_at=? WHERE id=? AND state='pending'",now(),item.id);
    continue;
  }
  const claim=await run(env.DB,"UPDATE bridge_outbox SET state='sending',updated_at=? WHERE id=? AND state='pending'",now(),item.id);
  if(!Number(claim.meta?.changes||0))continue;
  const result=await deliver(env,item);
  await run(env.DB,"UPDATE bridge_outbox SET state=?,content='',payload='',error=?,updated_at=? WHERE id=?",
    result.status,result.error||"",now(),item.id);
  await logDelivery(env,item.id,item.target_group,result.status,result.error||"");
  if(result.status==="sent_abot")sent++;
  else if(result.status==="sent_bbot"){sent++;bbot++;}
  else failed++;
 }
 await run(env.DB,"DELETE FROM bridge_seen WHERE created_at<?",now()-86400000);
 await run(env.DB,"DELETE FROM bridge_deliveries WHERE created_at<?",now()-7*86400000);
 await run(env.DB,"DELETE FROM bridge_pending_ids WHERE expires_at<?",now());
 return {sent,failed,bbot};
}
