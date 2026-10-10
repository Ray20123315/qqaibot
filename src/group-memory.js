import {parseOnebot,parseCommand,authorize,BRIDGE_ECHO_MARKER} from "./core.js";
import {get,all,run,roster} from "./store.js";
import {isPoliticalTopic} from "./topic-policy.js";

let ready=false;
export async function initGroupMemory(env){
 if(ready)return;
 for(const sql of [
 "CREATE TABLE IF NOT EXISTS bot_memory_groups (qq_group_id TEXT PRIMARY KEY,enabled INTEGER NOT NULL DEFAULT 0,updated_at INTEGER NOT NULL)",
 "CREATE TABLE IF NOT EXISTS bot_memory_items (id TEXT PRIMARY KEY,qq_group_id TEXT NOT NULL,message_id TEXT NOT NULL,sender_qq TEXT NOT NULL,content TEXT NOT NULL,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,UNIQUE(qq_group_id,message_id))",
 "CREATE INDEX IF NOT EXISTS bot_memory_scope_idx ON bot_memory_items(qq_group_id,created_at)",
 "CREATE INDEX IF NOT EXISTS bot_memory_expiry_idx ON bot_memory_items(expires_at)"
 ])await env.DB.prepare(sql).run();
 ready=true;
}
const safeGroup=x=>/^[0-9]{5,20}$/.test(String(x||""));
const safeMessage=x=>/^-?[0-9]{1,20}$/.test(String(x||""));
const ns=group=>"qqaibot-g"+group;
async function idOf(group,message){
 const bytes=new TextEncoder().encode(group+":"+message);
 const digest=new Uint8Array(await crypto.subtle.digest("SHA-256",bytes));
 return Array.from(digest).map(x=>x.toString(16).padStart(2,"0")).join("");
}
function keys(env){return String(env.VECTORIZE_GEMINI_KEYS||"").split(",").map(x=>x.trim()).filter(Boolean);}
export async function embedding(env,text,fetchFn=fetch){
 const key=keys(env)[0];
 if(!key||!env.VECTORIZE)return null;
 const res=await fetchFn("https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent",{
  method:"POST",headers:{"content-type":"application/json","x-goog-api-key":key},
  body:JSON.stringify({model:"models/gemini-embedding-001",content:{parts:[{text:String(text).slice(0,800)}]},outputDimensionality:1024}),
  signal:AbortSignal.timeout(12000)
 });
 if(!res.ok)throw new Error("EMBEDDING_HTTP_"+res.status);
 const payload=await res.json();
 const vector=payload?.embedding?.values;
 if(!Array.isArray(vector)||vector.length!==1024||!vector.every(Number.isFinite))throw Error("EMBEDDING_DIMENSION_INVALID");
 return vector;
}
async function allowed(env,group){
 await initGroupMemory(env);
 const r=await get(env.DB,"SELECT enabled FROM bot_memory_groups WHERE qq_group_id=?",group);
 return Number(r?.enabled||0)===1;
}
export async function memoryCommand(env,event,reply){
 const msg=parseOnebot(event);
 if(!msg)return null;
 const command=msg.text.trim().match(/^(?:\/!|!)memory(?:\s+(on|off|status|clear))?\s*$/i);
 if(!command)return null;
 await initGroupMemory(env);
 const action=(command[1]||"status").toLowerCase(),say=async text=>({handled:true,reply:reply?await reply(text):undefined,replyText:reply?undefined:text});
 if(action==="status")return say("本群記憶收集："+(await allowed(env,msg.groupId)?"已啟用":"已停用")+"\n保存時間：2 天。只收集可讀文字，不記錄圖片、語音、分享卡片。");
 const r=await roster(env.DB,msg.groupId);
 const member=r.fresh?await get(env.DB,"SELECT role FROM bridge_members WHERE qq_group_id=? AND qq_id=?",msg.groupId,msg.senderQq):null;
 const scopes=r.fresh?await all(env.DB,"SELECT scope FROM bridge_acl WHERE qq_group_id=? AND qq_id=?",msg.groupId,msg.senderQq):[];
 const permission=authorize({actor:msg.senderQq,role:member?.role||"member",protectedPresent:r.protectedPresent,rosterFresh:r.fresh&&!!member,scopes:scopes.map(x=>x.scope),action:"rename"});
 if(!permission.ok)return say("記憶設定需要管理權限："+permission.reason);
 if(action==="clear"){
  const rows=await all(env.DB,"SELECT id FROM bot_memory_items WHERE qq_group_id=?",msg.groupId);
  await run(env.DB,"DELETE FROM bot_memory_items WHERE qq_group_id=?",msg.groupId);
  if(env.VECTORIZE&&rows.length)await env.VECTORIZE.deleteByIds(rows.map(x=>x.id)).catch(()=>{});
  return say("本群儲存的記憶已清除。");
 }
 await run(env.DB,"INSERT INTO bot_memory_groups(qq_group_id,enabled,updated_at) VALUES(?,?,?) ON CONFLICT(qq_group_id) DO UPDATE SET enabled=excluded.enabled,updated_at=excluded.updated_at",
  msg.groupId,action==="on"?1:0,Date.now());
 return say(action==="on"?"本群記憶已啟用。僅保留 2 天文字，支持 !memory off 與 !memory clear。":"本群記憶已停用，舊內容仍會到期；可用 !memory clear 刪除。");
}
export async function collectBbotMemory(env,event,{embed=embedding}={}){
 const msg=parseOnebot(event);
 if(!msg||!safeMessage(msg.messageId)||msg.senderQq===msg.selfId||!await allowed(env,msg.groupId))return {stored:false};
 const text=msg.text.trim();
 if(text.length<12||text.length>1000||/^[/!]/.test(text)||text.includes(BRIDGE_ECHO_MARKER)||isPoliticalTopic(text))return {stored:false};
 const cutoff=Date.now()-86400000;
 const daily=await get(env.DB,"SELECT COUNT(*) AS n FROM bot_memory_items WHERE qq_group_id=? AND created_at>=?",msg.groupId,cutoff);
 if(Number(daily?.n||0)>=200)return {stored:false,reason:"daily_limit"};
 const id=await idOf(msg.groupId,msg.messageId),time=Date.now();
 const inserted=await run(env.DB,"INSERT OR IGNORE INTO bot_memory_items(id,qq_group_id,message_id,sender_qq,content,created_at,expires_at) VALUES(?,?,?,?,?,?,?)",
  id,msg.groupId,msg.messageId,msg.senderQq,text,time,time+2*86400000);
 if(!Number(inserted.meta?.changes||0))return {stored:false,reason:"duplicate"};
 try{
  const vector=await embed(env,text);
  if(vector && env.VECTORIZE)await env.VECTORIZE.upsert([{id,values:vector,namespace:ns(msg.groupId),metadata:{kind:"bot_memory"}}]);
 }catch(e){console.warn("BOT_MEMORY_VECTOR_INDEX_FAILED",String(e?.message||"failed").replace(/[^A-Za-z0-9_-]/g,"").slice(0,70));}
 return {stored:true};
}
export async function recallBbotMemory(env,event){
 if(event?.post_type!=="notice"||event?.notice_type!=="group_recall")return {ignored:true};
 const group=String(event.group_id||""),message=String(event.message_id||"");
 if(!safeGroup(group)||!safeMessage(message))return {ignored:true};
 await initGroupMemory(env);
 const row=await get(env.DB,"SELECT id FROM bot_memory_items WHERE qq_group_id=? AND message_id=?",group,message);
 if(!row)return {ignored:true};
 await run(env.DB,"DELETE FROM bot_memory_items WHERE id=?",row.id);
 if(env.VECTORIZE)await env.VECTORIZE.deleteByIds([row.id]).catch(()=>{});
 return {deleted:true};
}
export async function memoryContextForAbot(env,groupOpenid,prompt,{embed=embedding}={}){
 if(!env.DB)return "";
 await initGroupMemory(env);
 // Only use an explicitly verified QQ numeric group<->Abot OpenID mapping.
 const mapping=await get(env.DB,"SELECT qq_group_id FROM bridge_groups WHERE group_openid=? AND verified=1",groupOpenid);
 const group=mapping?.qq_group_id;
 if(!safeGroup(group)||!await allowed(env,group))return "";
 const time=Date.now(),limit=3;
 let candidates=[];
 try{
  const vector=await embed(env,prompt);
  if(vector&&env.VECTORIZE){
   const result=await env.VECTORIZE.query(vector,{topK:limit,namespace:ns(group),returnMetadata:"none"});
   for(const match of result.matches||[]){
    const row=await get(env.DB,"SELECT content FROM bot_memory_items WHERE id=? AND qq_group_id=? AND expires_at>?",match.id,group,time);
    if(row?.content)candidates.push(row.content);
   }
  }
 }catch(e){console.warn("BOT_MEMORY_VECTOR_QUERY_FAILED",String(e?.message||"failed").replace(/[^A-Za-z0-9_-]/g,"").slice(0,60));}
 if(!candidates.length){
  const rows=await all(env.DB,"SELECT content FROM bot_memory_items WHERE qq_group_id=? AND expires_at>? ORDER BY created_at DESC LIMIT 3",group,time);
  candidates=rows.map(x=>x.content);
 }
 return candidates.slice(0,limit).map(x=>"群內近期訊息："+String(x).slice(0,260)).join("\n").slice(0,950);
}

export async function pruneGroupMemory(env,batch=100){
 if(!env.DB || String(env.BOT_MEMORY_ENABLED)!=="true")return {processed:0};
 await initGroupMemory(env);
 const expired=await all(env.DB,"SELECT id FROM bot_memory_items WHERE expires_at<=? LIMIT ?",Date.now(),Math.min(200,Math.max(1,batch)));
 if(!expired.length)return {processed:0};
 if(env.VECTORIZE){
  try{await env.VECTORIZE.deleteByIds(expired.map(x=>x.id));}
  catch{console.warn("BOT_MEMORY_EXPIRY_VECTOR_DELETE_FAILED");}
 }
 for(const x of expired)await run(env.DB,"DELETE FROM bot_memory_items WHERE id=? AND expires_at<=?",x.id,Date.now());
 return {processed:expired.length};
}
