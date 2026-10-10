import {generateWithExistingSecrets,modelAvailability} from "./model-client.js";
import {sendGroup} from "./qq-api.js";

const clean=(x,max=1500)=>String(x??"").replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,max);
const validOpenid=x=>/^[A-Za-z0-9_-]{8,160}$/.test(String(x||""));
const now=()=>Date.now();
let bootstrapped=false;
async function dbInit(env){
 if(bootstrapped)return;
 if(!env.DB)throw Error("ABOT_AI_DB_MISSING");
 for(const q of [
  "CREATE TABLE IF NOT EXISTS abot_ai_seen (group_openid TEXT NOT NULL,source_id TEXT NOT NULL,user_openid TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'processing',error_code TEXT NOT NULL DEFAULT '',created_at INTEGER NOT NULL,PRIMARY KEY(group_openid,source_id))",
  "CREATE TABLE IF NOT EXISTS abot_ai_history (group_openid TEXT NOT NULL,user_openid TEXT NOT NULL,message_id TEXT NOT NULL,role TEXT NOT NULL,content TEXT NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(group_openid,user_openid,message_id,role))",
  "CREATE INDEX IF NOT EXISTS abot_ai_history_group_idx ON abot_ai_history(group_openid,user_openid,created_at)",
  "CREATE TABLE IF NOT EXISTS abot_ai_settings (group_openid TEXT PRIMARY KEY,ai_enabled INTEGER NOT NULL DEFAULT 1,model_provider TEXT NOT NULL DEFAULT 'gemini',updated_at INTEGER NOT NULL)"
 ])await env.DB.prepare(q).run();
 bootstrapped=true;
}
async function sqlRun(db,sql,...args){return db.prepare(sql).bind(...args).run();}
async function sqlOne(db,sql,...args){return db.prepare(sql).bind(...args).first();}
async function sqlAll(db,sql,...args){const res=await db.prepare(sql).bind(...args).all();return res.results||[];}
export function parseOfficialGroupEvent(packet){
 if(packet?.op!==0 || !["GROUP_AT_MESSAGE_CREATE","GROUP_MESSAGE_CREATE"].includes(packet?.t))return null;
 const d=packet.d||{},group=String(d.group_openid||"");
 const user=String(d.author?.member_openid||d.author?.id||"");
 const id=String(d.id||"");
 if(!validOpenid(group)||!validOpenid(user)||!id||id.length>180)return null;
 // GROUP_MESSAGE_CREATE may contain every ordinary message. Only address the
 // bot if the event explicitly identifies a bot mention.
 if(packet.t==="GROUP_MESSAGE_CREATE"&&!(Array.isArray(d.mentions)&&d.mentions.some(x=>x.is_you===true)))return null;
 const content=clean(d.content||"",1400).replace(/<@!?\d+>/g," ").trim();
 return {group,user,id,content,atEvent:packet.t==="GROUP_AT_MESSAGE_CREATE",receivedAt:now()};
}
export async function onAbotAiEvent(env,packet,{generate=generateWithExistingSecrets,send=sendGroup}={}){
 const message=parseOfficialGroupEvent(packet);
 if(!message)return {ignored:true};
 await dbInit(env);
 const settings=await sqlOne(env.DB,"SELECT ai_enabled,model_provider FROM abot_ai_settings WHERE group_openid=?",message.group);
 if(settings && Number(settings.ai_enabled)===0)return {ignored:true,reason:"ai_off"};
 // The API's group passive reply window is 5 minutes; use only the incoming msg_id.
 const inserted=await sqlRun(env.DB,"INSERT OR IGNORE INTO abot_ai_seen(group_openid,source_id,user_openid,status,error_code,created_at) VALUES(?,?,?,'processing','',?)",
  message.group,message.id,message.user,now());
 if(!Number(inserted.meta?.changes||0))return {ignored:true,reason:"duplicate"};
 const day=Math.floor((now()+28800000)/86400000)*86400000-28800000;
 const [userCount,groupCount]=await Promise.all([
  sqlOne(env.DB,"SELECT COUNT(*) AS n FROM abot_ai_seen WHERE group_openid=? AND user_openid=? AND created_at>=?",message.group,message.user,day),
  sqlOne(env.DB,"SELECT COUNT(*) AS n FROM abot_ai_seen WHERE group_openid=? AND created_at>=?",message.group,day)
 ]);
 const over=Number(userCount?.n||0)>20?"本日個人 AI 額度已用完。":Number(groupCount?.n||0)>120?"本群今日 AI 額度已用完。":"";
 const cmd=message.content.replace(/^(?:\/!|!)\s*/,"").trim();
 const is=(name)=>new RegExp("^"+name+"(?:\\s|$)","i").test(cmd);
 let answer="",provider="gemini";
 try{
  if(is("help")||!message.content){
   answer="【QQAIBOT · Abot AI】\n@我提問，或 @我 !ai 問題。\n!help：說明　!status：狀態　!clear：清除自己的短期 AI 記憶。\n跨群轉發插件預設關閉。";
  }else if(is("status")){
   const availability=modelAvailability(env);
   answer="【Abot AI】\n接收：QQ 官方 Gateway\n發送：QQ 官方被動回覆\nGemini："+(availability.gemini?"已配置":"未配置")+"\nDeepSeek："+(availability.deepseek?"已配置":"未配置")+"\n跨群轉發：預設關閉";
  }else if(is("clear")){
   await sqlRun(env.DB,"DELETE FROM abot_ai_history WHERE group_openid=? AND user_openid=?",message.group,message.user);
   answer="已清除你在本群的 AI 對話記憶。";
  }else if(over)answer=over;
  else{
   const prompt=clean(message.content.replace(/^(?:\/!|!)\s*ai(?:\s+|$)/i,""),1400);
   if(!prompt)answer="請 @我並輸入問題。";
   else {
    provider=String(settings?.model_provider||"gemini");
    if(!["gemini","deepseek"].includes(provider))provider="gemini";
    const history=await sqlAll(env.DB,"SELECT role,content FROM abot_ai_history WHERE group_openid=? AND user_openid=? ORDER BY created_at DESC LIMIT 8",message.group,message.user);
    const messages=[{role:"system",content:"你是 QQ 群裡的 AI 助理。自然、簡潔地回答；依使用者的文字使用繁體或簡體中文。未被呼叫時絕不插話，不聲稱已執行未實際執行的操作。"},...history.reverse().filter(x=>x.role==="user"||x.role==="assistant"),{role:"user",content:prompt}];
    const output=await generate(env,{provider,messages,maxTokens:480});
    answer=clean(output.text,1700);
    await sqlRun(env.DB,"INSERT OR IGNORE INTO abot_ai_history(group_openid,user_openid,message_id,role,content,created_at) VALUES(?,?,?,?,?,?)",message.group,message.user,message.id,"user",prompt,now());
    await sqlRun(env.DB,"INSERT OR IGNORE INTO abot_ai_history(group_openid,user_openid,message_id,role,content,created_at) VALUES(?,?,?,?,?,?)",message.group,message.user,"answer:"+message.id,"assistant",answer,now()+1);
    await sqlRun(env.DB,"DELETE FROM abot_ai_history WHERE group_openid=? AND user_openid=? AND created_at<?",message.group,message.user,now()-3*86400000);
   }
  }
  if(!answer)answer="這次沒有取得 AI 回覆。";
  await send(env,message.group,answer,message.id);
  await sqlRun(env.DB,"UPDATE abot_ai_seen SET status='sent' WHERE group_openid=? AND source_id=?",message.group,message.id);
  console.log("ABOT_AI_PASSIVE_SENT",JSON.stringify({provider,kind:packet.t}));
  return {handled:true,transport:"abot",status:"sent"};
 }catch(error){
  // Do not print API keys, message texts, OpenIDs or model responses.
  const code=Number(error?.code)||Number(error?.status)||0;
  await sqlRun(env.DB,"UPDATE abot_ai_seen SET status='failed',error_code=? WHERE group_openid=? AND source_id=?",String(code||"MODEL_OR_NETWORK"),message.group,message.id).catch(()=>{});
  console.error("ABOT_AI_FAILED",JSON.stringify({stage:answer?"official_send":"model",status:code||"unknown"}));
  return {handled:true,transport:"abot",status:"failed",errorCode:code||"MODEL_OR_NETWORK"};
 }
}
