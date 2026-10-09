
import {clean,qq,isProtected,parseCommand,parseOnebot,authorize,formatForward,isRelayable} from "./core.js";
import {init,get,all,run,digest,makeCode,groupByQq,groupByOpen,roster,recordRoster} from "./store.js";
import {sendGroup} from "./qq-api.js";
let extraReady=false;
async function ready(env){
 await init(env.DB);
 if(!extraReady){
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS bridge_outbox (id TEXT PRIMARY KEY, target_group TEXT NOT NULL, content TEXT NOT NULL, state TEXT NOT NULL, error TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)").run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS bridge_outbox_state_idx ON bridge_outbox(state,created_at)").run();
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS bridge_id_proof (token_hash TEXT PRIMARY KEY, official_confirmed INTEGER NOT NULL DEFAULT 0, qq_id TEXT, verified_at INTEGER NOT NULL DEFAULT 0)").run();
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS bridge_reply_context (group_openid TEXT PRIMARY KEY, msg_id TEXT NOT NULL, expires_at INTEGER NOT NULL)").run();
  extraReady=true;
 }
}
const now=()=>Date.now();
const sanitizeAlias=v=>clean(v,24).replace(/[<>\[\]]/g,"");
const adminRole=role=>role==="owner"||role==="admin";
async function answer(env,group,text,msgId) {
 if(!msgId){
   const ctx=await get(env.DB,"SELECT msg_id FROM bridge_reply_context WHERE group_openid=? AND expires_at>?",group,now());
   msgId=ctx?.msg_id||undefined;
 }
 try {await sendGroup(env,group,text,msgId);return true;}
 catch(e){console.error("ABOT_RESPONSE_FAILED",String(e).slice(0,240));return false;}
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
 if(command.name==="help")return {handled:true,reply:await answer(env,groupOpenid,"指令：/use /代碼 簡寫 /verify /status /stop /resume /leave /rename 名稱 /revoke /code /grant QQ號 manage|stop|both /ungrant QQ號 /id /verifyid",msgId)};
 if(command.name==="use"){
  if(current)return {handled:true,reply:await answer(env,groupOpenid,"本群已有連線或待驗證，請使用 /status。",msgId)};
  const invite=makeCode(12),roomId=crypto.randomUUID(),nonce=makeCode(10);
  await run(env.DB,"INSERT INTO bridge_rooms(id,code_hash,created_at) VALUES(?,?,?)",roomId,await digest(invite),now());
  await initialGroup(env,groupOpenid,roomId,"",nonce);
  const response="連線代碼："+invite+"\n待驗證：請本群群主或管理員送出 /verify "+nonce+"。\n驗證成功後代碼才生效；請勿公開傳到不信任的群。";
  return {handled:true,reply:await answer(env,groupOpenid,response,msgId)};
 }
 if(command.name==="join"){
  if(current)return {handled:true,reply:await answer(env,groupOpenid,"此群已有連線；請先使用 /leave。",msgId)};
  const room=await get(env.DB,"SELECT * FROM bridge_rooms WHERE code_hash=? AND active=1 AND revoked=0",await digest(command.code));
  if(!room)return {handled:true,reply:await answer(env,groupOpenid,"連線代碼無效、未驗證或已撤銷。",msgId)};
  const nonce=makeCode(10);await initialGroup(env,groupOpenid,room.id,command.arg,nonce);
  return {handled:true,reply:await answer(env,groupOpenid,"加入待驗證，請本群群主或管理員輸入 /verify "+nonce,msgId)};
 }
 if(command.name==="id"){
  if(!current?.verified)return {handled:true};
  const nonce=makeCode(12);
  await run(env.DB,"INSERT INTO bridge_pending_ids(token_hash,group_openid,member_openid,expires_at) VALUES(?,?,?,?)",await digest(nonce),groupOpenid,memberOpenid,now()+180000);
  return {handled:true,reply:await answer(env,groupOpenid,"身分配對：請由同一 QQ 帳號送出 @Abot /verifyid "+nonce+"（三分鐘內有效）。",msgId)};
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
  return {handled:true,reply:await answer(env,groupOpenid,"跨群橋接："+status+(group?.alias?"\n簡寫："+group.alias:""),msgId)};
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
async function verifyPair(env,msg,command){
 const hash=await digest(command.arg.toUpperCase());
 const group=await get(env.DB,"SELECT * FROM bridge_groups WHERE pairing_hash=? AND verified=0 AND pairing_expires>?",hash,now());
 if(!group)return false;
 // Only verified Bbot group sender and current trusted roster determine privileges.
 const view=await roster(env.DB,msg.groupId);
 const actor=await get(env.DB,"SELECT role FROM bridge_members WHERE qq_group_id=? AND qq_id=?",msg.groupId,msg.senderQq);
 if(!view.fresh||(!adminRole(actor?.role)&&!isProtected(msg.senderQq))){
  await answer(env,group.group_openid,"只有已驗證的群主／管理員或受保護帳號可以配對。");return true;
 }
 const exists=await groupByQq(env.DB,msg.groupId);
 if(exists&&exists.group_openid!==group.group_openid){
  await answer(env,group.group_openid,"此 QQ 群已綁定另一個連線。");return true;
 }
 await run(env.DB,"UPDATE bridge_groups SET qq_group_id=?, verified=1, pairing_hash=NULL, pairing_expires=0, display_name=? WHERE group_openid=? AND verified=0",
 msg.groupId,clean(msg.groupName||"QQ群 "+msg.groupId,60),group.group_openid);
 await run(env.DB,"UPDATE bridge_rooms SET active=1,creator_qq=COALESCE(creator_qq,?) WHERE id=?",msg.senderQq,group.room_id);
 await answer(env,group.group_openid,"群組驗證成功，跨群橋接已啟用。");
 return true;
}
async function handleControl(env,group,msg,command){
 const name=command.name;
 if(name==="help")return answer(env,group.group_openid,"指令：/use /代碼 簡寫 /verify /status /stop /resume /leave /rename 名稱 /revoke /code /grant QQ號 manage|stop|both /ungrant QQ號 /id /verifyid");
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
   if(!["manage","stop","both"].includes(scope))return answer(env,group.group_openid,"用法：/grant QQ號 manage|stop|both");
   await run(env.DB,"DELETE FROM bridge_acl WHERE qq_group_id=? AND qq_id=?",msg.groupId,target);
   for(const s of scope==="both"?["manage","stop"]:[scope])await run(env.DB,"INSERT INTO bridge_acl(qq_group_id,qq_id,scope) VALUES(?,?,?)",msg.groupId,target,s);
  }
  return answer(env,group.group_openid,"授權設定已更新");
 }
 if(name==="rename"){
  if(!command.arg)return answer(env,group.group_openid,"用法：/rename 新簡寫");
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
 if(msg.senderQq===msg.selfId||msg.senderQq===qq(env.ABOT_QQ_ID))return {ignored:true};
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
  const map=new Map(mapping.map(m=>[m.qq_id,m.member_openid]));
  const mode=String(env.BRIDGE_REAL_MENTIONS||"false")==="true";
  const content=formatForward(group.alias||group.display_name||"QQ群 "+msg.groupId,msg.senderName,msg.parts,id=>mode?map.get(id):null);
  const id=await digest(key+"|"+target.group_openid);
  const result=await run(env.DB,"INSERT OR IGNORE INTO bridge_outbox(id,target_group,content,state,created_at,updated_at) VALUES(?,?,?,'pending',?,?)",id,target.group_openid,content,now(),now());
  if(Number(result.meta?.changes||0))added++;
 }
 // Controlled release: proactive cross-group messaging is subject to Tencent policy.
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
 let sent=0,failed=0;
 for(const item of pending){
  const claim=await run(env.DB,"UPDATE bridge_outbox SET state='sending',updated_at=? WHERE id=? AND state='pending'",now(),item.id);
  if(!Number(claim.meta?.changes||0))continue;
  try{
   await sendGroup(env,item.target_group,item.content);
   await run(env.DB,"UPDATE bridge_outbox SET state='sent',content='',updated_at=? WHERE id=?",now(),item.id);
   await logDelivery(env,item.id,item.target_group,"sent");sent++;
  }catch(e){
   // Ambiguous send failures are not automatically replayed.
   const error=String(e).slice(0,220);
   await run(env.DB,"UPDATE bridge_outbox SET state='failed',content='',error=?,updated_at=? WHERE id=?",error,now(),item.id);
   await logDelivery(env,item.id,item.target_group,"failed",error);failed++;
  }
 }
 await run(env.DB,"DELETE FROM bridge_seen WHERE created_at<?",now()-86400000);
 await run(env.DB,"DELETE FROM bridge_deliveries WHERE created_at<?",now()-7*86400000);
 await run(env.DB,"DELETE FROM bridge_pending_ids WHERE expires_at<?",now());
 return {sent,failed};
}
