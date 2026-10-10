import test from "node:test";
import assert from "node:assert/strict";
import {generateWithExistingSecrets,modelAvailability} from "../src/model-client.js";
import {parseAssistantCommand,routeBotEvent,assistantHealth} from "../src/assistant.js";
import {POLITICAL_REFUSAL} from "../src/topic-policy.js";

const request= (text="hi",id=1) => ({
 post_type:"message",message_type:"group",group_id:808882936,user_id:3569028262,self_id:2681167798,message_id:id,
 sender:{nickname:"測試者"},message:[{type:"text",data:{text}}]
});
class DB {
 constructor(){this.settings=new Map();this.replies=[];this.usage=[];this.history=[];}
 prepare(query){
  const db=this;
  return {
   run:async()=>({meta:{changes:0}}),
   bind(...args){
    return {
     first:async()=>{
      if(query.includes("SELECT ai_enabled,bridge_enabled"))return db.settings.get(args[0])||null;
      if(query.includes("SELECT bot_message_id"))return null;
      if(query.includes("COUNT(*) AS count FROM assistant_usage"))return {count:db.usage.filter(x=>x.group===args[0] && (args.length===2||x.user===args[1])).length};
      if(query.includes("SELECT fetched_at FROM bridge_rosters"))return {fetched_at:Date.now()};
      if(query.includes("COUNT(1) AS count FROM bridge_members"))return {count:0};
      if(query.includes("SELECT role FROM bridge_members"))return {role:"member"};
      if(query.includes("SELECT COUNT(*) AS count FROM assistant_groups"))return {count:0};
      return null;
     },
     all:async()=>({results:query.includes("SELECT role,content FROM assistant_history")?[]:[]}),
     run:async()=>{
      if(query.includes("INSERT OR IGNORE INTO assistant_usage")){
       if(db.usage.some(x=>x.group===args[0]&&x.key===args[2]))return {meta:{changes:0}};
       db.usage.push({group:args[0],user:args[1],key:args[2]});return {meta:{changes:1}};
      }
      if(query.includes("INSERT OR IGNORE INTO assistant_history"))db.history.push(args);
      if(query.includes("INSERT INTO assistant_groups")){
       const old=db.settings.get(args[0])||{};
       if(query.includes("DO UPDATE SET model_provider"))db.settings.set(args[0],{...old,ai_enabled:1,bridge_enabled:0,model_provider:args[1],model_name:""});
       else db.settings.set(args[0],{...old,ai_enabled:query.includes("ai_enabled=excluded")?args[1]:old.ai_enabled??1,bridge_enabled:query.includes("bridge_enabled=excluded")?args[2]:old.bridge_enabled??0});
      }
      if(query.includes("DELETE FROM assistant_history"))db.history=[];
      return {meta:{changes:1}};
     }
    };
   }
  };
 }
}
test("existing Cloudflare Secret names report Gemini and DeepSeek without Workers AI binding",async()=>{
 const health=await assistantHealth({GEMINI_API_KEYS:"gem1,gem2",DEEPSEEK_API_KEY:"deep",DB:new DB()});
 assert.equal(health.configured,true);
 assert.deepEqual(health.providers,["gemini","deepseek"]);
 assert.equal(health.bridge_default,false);
 assert.equal(modelAvailability({GEMINI_API_KEYS:"key"}).gemini,true);
});
test("Gemini request uses existing GEMINI_API_KEYS secret in header, not URL",async()=>{
 let called=false;
 const result=await generateWithExistingSecrets({GEMINI_API_KEYS:"gem-abc",GEMINI_CHAT_MODELS:"gemini-2.5-flash"},
  {messages:[{role:"system",content:"help"},{role:"user",content:"hello"}]},async(url,options)=>{
   called=true;
   assert.ok(url.includes("generativelanguage.googleapis.com"));
   assert.equal(url.includes("gem-abc"),false);
   assert.equal(options.headers["x-goog-api-key"],"gem-abc");
   assert.ok(!options.headers.Authorization);
   const body=JSON.parse(options.body);
   assert.equal(body.contents[0].role,"user");
   assert.match(body.systemInstruction.parts[0].text,/help/);
   return new Response(JSON.stringify({candidates:[{content:{parts:[{text:"你好！"}]}}]}),{status:200});
  });
 assert.equal(called,true);
 assert.equal(result.text,"你好！");
 assert.equal(result.provider,"gemini");
});
test("DeepSeek key used only for explicitly selected provider",async()=>{
 let calls=[];
 const env={GEMINI_API_KEYS:"g-secret",DEEPSEEK_API_KEY:"d-secret",GEMINI_CHAT_MODELS:"gemini-2.5-flash",DEEPSEEK_FLASH_MODEL:"deepseek-chat"};
 const fetchMock=async(url,opt)=>{
  calls.push({url,auth:opt.headers.Authorization||null});
  return new Response(url.includes("deepseek")?JSON.stringify({choices:[{message:{content:"DeepSeek OK"}}]}):JSON.stringify({candidates:[{content:{parts:[{text:"Gemini OK"}]}}]}),{status:200});
 };
 const a=await generateWithExistingSecrets(env,{messages:[{role:"user",content:"hello"}]},fetchMock);
 assert.equal(a.provider,"gemini");
 assert.equal(calls[0].auth,null);
 const b=await generateWithExistingSecrets(env,{provider:"deepseek",messages:[{role:"user",content:"hello"}]},fetchMock);
 assert.equal(b.text,"DeepSeek OK");
 assert.equal(calls[1].auth,"Bearer d-secret");
});
test("normal QQ message never triggers AI and bridge is disabled by default",async()=>{
 const env={DB:new DB(),GEMINI_API_KEYS:"dummy"};
 const response=await routeBotEvent(env,request("早安"),()=>{throw Error("MUST_NOT_SEND");});
 assert.equal(response.ignored,true);
 assert.equal(response.reason,"no_trigger");
});
test("!help responds locally without calling any model API",async()=>{
 const env={DB:new DB(),GEMINI_API_KEYS:"dummy"};
 let sent="";
 const response=await routeBotEvent(env,request("!help",4),async t=>{sent=t;return {ok:true};});
 assert.equal(response.handled,true);
 assert.match(sent,/!plugin list/);
 assert.match(sent,/!model/);
});
test("!ai explicitly triggers Gemini, uses quota, and repeated incoming message is deduplicated",async()=>{
 const original=globalThis.fetch;
 try{
  let count=0;
  globalThis.fetch=async()=>{count++;return new Response(JSON.stringify({candidates:[{content:{parts:[{text:"回答"}]}}]}),{status:200});};
  const env={DB:new DB(),GEMINI_API_KEYS:"existing-key",GEMINI_CHAT_MODELS:"gemini-2.5-flash"};
  let sent="";
  const x=await routeBotEvent(env,request("!ai 幫我想標題",12),async t=>{sent=t;});
  assert.equal(x.handled,true);assert.equal(sent,"回答");
  assert.equal(count,1);
  const dup=await routeBotEvent(env,request("!ai 幫我想標題",12),async()=>{throw Error("duplicate must not send");});
  assert.equal(dup.ignored,true);
  assert.equal(count,1);
 }finally{globalThis.fetch=original;}
});
test("unauthorized QQ member cannot enable bridge plugin without validated member permissions",async()=>{
 const db=new DB();
 const env={DB:db,GEMINI_API_KEYS:"existing-key"};
 let sent="";
 const event=request("!plugin bridge on",30);
 event.user_id=473204883;
 await routeBotEvent(env,event,async t=>{sent=t;});
 assert.match(sent,/權限不足|驗證/);
 assert.equal(db.settings.size,0);
});

test("Bbot AI path also refuses political topic without model request or quota usage",async()=>{
 const db=new DB(),env={DB:db,GEMINI_API_KEYS:"already-configured"};
 let sent="",called=0;
 const original=globalThis.fetch;
 try{
  globalThis.fetch=async()=>{called++;throw Error("must not call provider");};
  const res=await routeBotEvent(env,request("!ai 請分析政黨和總統選舉",77),async msg=>{sent=msg;});
  assert.equal(res.handled,true);
  assert.equal(sent,POLITICAL_REFUSAL);
  assert.equal(called,0);
  assert.equal(db.usage.length,0);
  assert.equal(db.history.length,0);
 }finally{globalThis.fetch=original;}
});
test("Bbot generated political text is replaced, not stored",async()=>{
 const db=new DB(),env={DB:db,GEMINI_API_KEYS:"already-configured",GEMINI_CHAT_MODELS:"gemini-2.5-flash"};
 let sent="";
 const original=globalThis.fetch;
 try{
  globalThis.fetch=async(_url,opts)=>{
   const body=JSON.parse(opts.body);
   assert.match(body.systemInstruction.parts[0].text,/不要討論政治/);
   return new Response(JSON.stringify({candidates:[{content:{parts:[{text:"這位總統的政策值得支持"}]}}]}),{status:200});
  };
  await routeBotEvent(env,request("!ai 番茄怎麼種植",78),async msg=>{sent=msg;});
  assert.equal(sent,POLITICAL_REFUSAL);
  assert.equal(db.history.length,0);
 }finally{globalThis.fetch=original;}
});
