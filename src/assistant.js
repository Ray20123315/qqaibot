import {parseOnebot,clean,qq,isProtected,BRIDGE_ECHO_MARKER,authorize} from "./core.js";
import {get,all,run,roster} from "./store.js";
import {generateWithExistingSecrets,modelAvailability,DEFAULT_GEMINI_MODEL} from "./model-client.js";

const DEFAULT_MODEL=DEFAULT_GEMINI_MODEL;
const DEFAULT_USER_LIMIT=20;
const DEFAULT_GROUP_LIMIT=120;
let initialized=false;
async function ensure(env) {
 if(!env.DB)throw new Error("ASSISTANT_DB_REQUIRED");
 if(initialized)return;
 for(const sql of [
  "CREATE TABLE IF NOT EXISTS assistant_groups (group_id TEXT PRIMARY KEY, ai_enabled INTEGER NOT NULL DEFAULT 1, bridge_enabled INTEGER NOT NULL DEFAULT 0, model_provider TEXT NOT NULL DEFAULT 'gemini', model_name TEXT NOT NULL DEFAULT '', updated_at INTEGER NOT NULL)",
  "CREATE TABLE IF NOT EXISTS assistant_history (group_id TEXT NOT NULL, user_qq TEXT NOT NULL, message_key TEXT NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(group_id,user_qq,message_key,role))",
  "CREATE INDEX IF NOT EXISTS assistant_history_idx ON assistant_history(group_id,user_qq,created_at)",
  "CREATE TABLE IF NOT EXISTS assistant_usage (group_id TEXT NOT NULL, user_qq TEXT NOT NULL, message_key TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(group_id,message_key))",
  "CREATE TABLE IF NOT EXISTS assistant_replies (group_id TEXT NOT NULL, bot_message_id TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(group_id,bot_message_id))"
 ])await env.DB.prepare(sql).run();
 initialized=true;
}
export function parseAssistantCommand(text){
 const match=String(text||"").trim().match(/^(?:\/!|!)(ai|help|status|setting|settings|plugin|clear|model)(?:\s+([\s\S]*))?$/i);
 return match?{name:match[1].toLowerCase(),arg:clean(match[2]||"",1200)}:null;
}
function bool(value){return Number(value||0)===1;}
async function groupSettings(env,groupId){
 await ensure(env);
 const row=await get(env.DB,"SELECT ai_enabled,bridge_enabled,model_provider,model_name FROM assistant_groups WHERE group_id=?",groupId);
 return {aiEnabled:!row||bool(row.ai_enabled),bridgeEnabled:!!row&&bool(row.bridge_enabled),provider:row?.model_provider||"gemini",model:row?.model_name||""};
}
async function privilege(env,msg) {
 const view=await roster(env.DB,msg.groupId);
 if(!view.fresh)return {ok:false,reason:"群員名單尚未驗證，請稍後再試"};
 const member=await get(env.DB,"SELECT role FROM bridge_members WHERE qq_group_id=? AND qq_id=?",msg.groupId,msg.senderQq);
 if(!member)return {ok:false,reason:"無法確認本群身分"};
 const scopes=await all(env.DB,"SELECT scope FROM bridge_acl WHERE qq_group_id=? AND qq_id=?",msg.groupId,msg.senderQq);
 return authorize({actor:msg.senderQq,role:member.role,protectedPresent:view.protectedPresent,rosterFresh:view.fresh,scopes:scopes.map(x=>x.scope),action:"rename"});
}
const help=()=>"【QQAIBOT · AI 助理】\n@Bot 提問、回覆 Bot 或 !ai 問題：與 AI 對話\n!help：指令說明\n!status：AI／NapCat 狀態\n!setting：本群 AI 與插件設定\n!plugin list：插件清單\n!model：查看或切換 Gemini／DeepSeek（管理員）\n!clear：清除自己在本群的 AI 對話記憶\n跨群橋接預設關閉；群管理員可使用 !plugin bridge on 啟用。";
function configSummary(settings,env) {
 return "AI："+(settings.aiEnabled?"開啟":"關閉")+
  "\n模型："+settings.provider+"/"+(settings.model|| (settings.provider==="deepseek"?String(env.DEEPSEEK_FLASH_MODEL||"deepseek-chat"):String(env.GEMINI_CHAT_MODELS||DEFAULT_MODEL).split(",")[0]))+
  "\n跨群插件："+(settings.bridgeEnabled?"已啟用":"關閉（預設）")+
  "\n觸發：@Bot／回覆 Bot／!ai\n主動插話：關閉";
}
async function setOption(env,msg,kind,on){
 await run(env.DB,"INSERT INTO assistant_groups(group_id,ai_enabled,bridge_enabled,updated_at) VALUES(?,?,?,?) ON CONFLICT(group_id) DO UPDATE SET "+
  (kind==="ai"?"ai_enabled=excluded.ai_enabled,updated_at=excluded.updated_at":"bridge_enabled=excluded.bridge_enabled,updated_at=excluded.updated_at"),
  msg.groupId,kind==="ai"?(on?1:0):1,kind==="bridge"?(on?1:0):0,Date.now());
}
async function isBotReply(env,msg){
 const ids=msg.parts.filter(p=>p.type==="reply").map(p=>String(p.data?.id||"")).filter(x=>x&&x.length<80);
 for(const id of ids)if(await get(env.DB,"SELECT bot_message_id FROM assistant_replies WHERE group_id=? AND bot_message_id=?",msg.groupId,id))return true;
 return false;
}
export async function recordAssistantReply(env,groupId,messageId){
 if(!messageId)return;
 await ensure(env);
 await run(env.DB,"INSERT OR IGNORE INTO assistant_replies(group_id,bot_message_id,created_at) VALUES(?,?,?)",groupId,String(messageId),Date.now());
}
function quota(env,name,fallback){
 const x=Number(env[name]);return Number.isSafeInteger(x)&&x>0&&x<=10000?x:fallback;
}
async function useQuota(env,msg){
 const start=Math.floor((Date.now()+28800000)/86400000)*86400000-28800000;
 const [user,group]=await Promise.all([
  get(env.DB,"SELECT COUNT(*) AS count FROM assistant_usage WHERE group_id=? AND user_qq=? AND created_at>=?",msg.groupId,msg.senderQq,start),
  get(env.DB,"SELECT COUNT(*) AS count FROM assistant_usage WHERE group_id=? AND created_at>=?",msg.groupId,start)
 ]);
 if(Number(user?.count||0)>=quota(env,"AI_DAILY_USER_LIMIT",DEFAULT_USER_LIMIT))return "今天的個人 AI 額度已用完，明天重置。";
 if(Number(group?.count||0)>=quota(env,"AI_DAILY_GROUP_LIMIT",DEFAULT_GROUP_LIMIT))return "今天本群 AI 額度已用完，明天重置。";
 // Atomic single event accounting prevents duplicated OneBot delivery from double-billing.
 const key=msg.messageId||"user-"+crypto.randomUUID();
 const inserted=await run(env.DB,"INSERT OR IGNORE INTO assistant_usage(group_id,user_qq,message_key,created_at) VALUES(?,?,?,?)",msg.groupId,msg.senderQq,key,Date.now());
 return Number(inserted.meta?.changes||0)===1?null:"ALREADY_PROCESSED";
}
async function generate(env,msg,prompt,config){
 const history=await all(env.DB,"SELECT role,content FROM assistant_history WHERE group_id=? AND user_qq=? ORDER BY created_at DESC LIMIT 10",msg.groupId,msg.senderQq);
 const messages=[{role:"system",content:"你是 QQ 群中的 AI 助理。依照使用者語言回答（繁體中文、簡體中文或其他語言）。清楚、簡短、有用。不要假裝已操作 QQ 群管理功能，不要主動插話。群組與其他使用者的私人對話內容不可見。"}];
 for(const h of [...history].reverse())if(["user","assistant"].includes(h.role))messages.push({role:h.role,content:h.content});
 messages.push({role:"user",content:prompt});
 const response=await generateWithExistingSecrets(env,{provider:config.provider,model:config.model,messages,maxTokens:480});
 const answer=response.text;
 if(!answer)throw new Error("AI_EMPTY_RESPONSE");
 const created=Date.now(),key=msg.messageId||crypto.randomUUID();
 await run(env.DB,"INSERT OR IGNORE INTO assistant_history(group_id,user_qq,message_key,role,content,created_at) VALUES(?,?,?,?,?,?)",
  msg.groupId,msg.senderQq,key,"user",prompt.slice(0,1400),created);
 await run(env.DB,"INSERT OR IGNORE INTO assistant_history(group_id,user_qq,message_key,role,content,created_at) VALUES(?,?,?,?,?,?)",
  msg.groupId,msg.senderQq,"answer:"+key,"assistant",answer.slice(0,1600),created+1);
 // Each caller keeps a bounded short-term context, not permanent full-chat logging.
 await run(env.DB,"DELETE FROM assistant_history WHERE group_id=? AND user_qq=? AND created_at<?",msg.groupId,msg.senderQq,created-3*86400000);
 return answer.slice(0,1600);
}
export async function routeAssistantEvent(env,event,reply){
 const msg=parseOnebot(event);
 if(!msg)return {ignored:true};
 if(msg.senderQq===msg.selfId||msg.text.includes(BRIDGE_ECHO_MARKER)||msg.senderQq===qq(env.ABOT_QQ_ID))return {ignored:true};
 await ensure(env);
 const config=await groupSettings(env,msg.groupId),cmd=parseAssistantCommand(msg.text);
 if(cmd){
  const say=async text=>reply?{handled:true,reply:await reply(text)}:{handled:true,replyText:text};
  if(cmd.name==="help")return say(help());
  if(cmd.name==="status")return say("【QQAIBOT 狀態】\n"+configSummary(config,env)+"\nNapCat：收到訊息／正在服務\n今日個人上限："+quota(env,"AI_DAILY_USER_LIMIT",DEFAULT_USER_LIMIT));
  if(cmd.name==="settings"||cmd.name==="setting"){
   const change=cmd.arg.match(/^ai\s+(on|off)$/i);
   if(change){
    const permission=await privilege(env,msg);
    if(!permission.ok)return say("權限不足："+permission.reason);
    await setOption(env,msg,"ai",change[1].toLowerCase()==="on");
    return say("本群 AI 已"+(change[1].toLowerCase()==="on"?"啟用":"停用"));
   }
   return say("【本群設定】\n"+configSummary(config,env)+"\n管理員可用 !setting ai on|off、!plugin bridge on|off");
  }
  if(cmd.name==="model"){
   const available=modelAvailability(env);
   if(!cmd.arg){
    return say("【模型】\n目前："+configSummary(config,env).split("\n")[1]+
      "\n可用供應商："+(available.gemini?"Gemini ":"")+(available.deepseek?"DeepSeek":"")+
      "\n切換：!model gemini 或 !model deepseek（僅管理員）");
   }
   const choice=cmd.arg.match(/^(gemini|deepseek)$/i);
   if(!choice)return say("可用：!model gemini、!model deepseek");
   const provider=choice[1].toLowerCase();
   if(!available[provider])return say("此模型的 API Secret 尚未配置。");
   const permission=await privilege(env,msg);
   if(!permission.ok)return say("權限不足："+permission.reason);
   await run(env.DB,"INSERT INTO assistant_groups(group_id,model_provider,updated_at) VALUES(?,?,?) ON CONFLICT(group_id) DO UPDATE SET model_provider=excluded.model_provider,model_name='',updated_at=excluded.updated_at",msg.groupId,provider,Date.now());
   return say("本群 AI 模型已切換為 "+(provider==="gemini"?"Gemini":"DeepSeek")+"；原有 Cloudflare Secret 繼續使用。");
  }
  if(cmd.name==="plugin"){
   if(!cmd.arg||cmd.arg==="list")return say("【插件】\nbridge 跨群轉發："+(config.bridgeEnabled?"已啟用":"關閉")+"（預設關閉）\n管理員：!plugin bridge on|off");
   const action=cmd.arg.match(/^bridge\s+(on|off)$/i);
   if(!action)return say("可用：!plugin list、!plugin bridge on、!plugin bridge off");
   const permission=await privilege(env,msg);
   if(!permission.ok)return say("權限不足："+permission.reason);
   const on=action[1].toLowerCase()==="on";
   await setOption(env,msg,"bridge",on);
   return say("跨群轉發插件已"+(on?"啟用（請使用 !use 建立群組連線）":"關閉，不再自動轉發"));
  }
  if(cmd.name==="clear"){
   await run(env.DB,"DELETE FROM assistant_history WHERE group_id=? AND user_qq=?",msg.groupId,msg.senderQq);
   return say("已清除你在本群的短期 AI 對話記憶。");
  }
  if(cmd.name==="ai"){
   if(!cmd.arg)return say("用法：!ai 你的問題");
   if(!config.aiEnabled)return say("本群 AI 已停用，請聯絡群管理員。");
   return ask(env,msg,cmd.arg,say,config);
  }
 }
 // An unrecognized !command is never fed into an LLM.
 if(/^(?:\/!|!)\S+/.test(msg.text)) {
  if(config.bridgeEnabled)return {bridge:true};
  return {ignored:true,reason:"unknown_command"};
 }
 const atBot=!!msg.selfId&&msg.atIds.includes(msg.selfId);
 const replied=await isBotReply(env,msg);
 if(!atBot&&!replied){
  if(config.bridgeEnabled)return {bridge:true};
  return {ignored:true,reason:"no_trigger"};
 }
 if(!config.aiEnabled)return {ignored:true,reason:"ai_disabled"};
 const prompt=clean(msg.text,1400);
 if(!prompt)return {handled:true,replyText:"請 @我並輸入問題，或使用 !ai 問題。"};
 return ask(env,msg,prompt,async text=>reply?{handled:true,reply:await reply(text),aiReply:true}:{handled:true,replyText:text,aiReply:true},config);
}
async function ask(env,msg,prompt,say,config){
 const over=await useQuota(env,msg);
 if(over==="ALREADY_PROCESSED")return {ignored:true,reason:"duplicate"};
 if(over)return say(over);
 try {
  const output=await generate(env,msg,prompt,config);
  return say(output);
 }catch(e){
  console.error("AI_REQUEST_FAILED",String(e?.message||e).slice(0,150));
  return say("AI 暫時無法回覆，請稍後再試。");
 }
}
export async function routeBotEvent(env,event,reply){
 const result=await routeAssistantEvent(env,event,reply);
 if(result.bridge){
  const bridge=await import("./bridge.js");
  return bridge.onOnebotEvent(env,event,reply);
 }
 return result;
}
export async function routeBotNotice(env,event){
 if(event?.notice_type!=="group_recall")return {ignored:true};
 const groupId=qq(event?.group_id);
 if(!groupId)return {ignored:true};
 const config=await groupSettings(env,groupId);
 if(!config.bridgeEnabled)return {ignored:true,reason:"bridge_off"};
 const bridge=await import("./bridge.js");
 return bridge.onOnebotNotice(env,event);
}
export async function bridgeCanFlush(env) {
 await ensure(env);
 const row=await get(env.DB,"SELECT COUNT(*) AS count FROM assistant_groups WHERE bridge_enabled=1");
 return Number(row?.count||0)>0;
}
export async function assistantHealth(env){
 return {configured:modelAvailability(env).gemini,providers:modelAvailability(env).gemini?["gemini",...(modelAvailability(env).deepseek?["deepseek"]:[])]:modelAvailability(env).deepseek?["deepseek"]:[],trigger:"mention-or-reply-or-!ai",bridge_default:false};
}
