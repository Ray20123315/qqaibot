import test from "node:test";
import assert from "node:assert/strict";
import {toPlainText,completeShortReply,PLAIN_REPLY_RULE} from "../src/reply-style.js";
import {codexWsRequest,generateWithCodexPreference} from "../src/codex-bridge.js";
import {collectBbotMemory,recallBbotMemory,memoryContextForAbot,embedding} from "../src/group-memory.js";

test("QQ AI answer is pure text, without Markdown, while preserving content",()=>{
 const input="# 標題\n**結論**：使用 \x60Python\x60\n- 第一件事\n- 第二件事\n[文件](https://example.com)";
 const output=toPlainText(input.replace(/\\x60/g,String.fromCharCode(96)));
 assert.equal(output,"標題\n結論：使用 Python\n• 第一件事\n• 第二件事\n文件：https://example.com");
 assert.match(PLAIN_REPLY_RULE,/不.*Markdown/);
});
test("long answer is fully rewritten, not silently sliced mid-sentence",async()=>{
 const original="我會逐步解釋這件事情。".repeat(230);
 let received="";
 const text=await completeShortReply(original,{regenerate:async full=>{received=full;return "這個問題的完整結論是：可以安全完成。";}});
 assert.equal(received,original);
 assert.equal(text,"這個問題的完整結論是：可以安全完成。");
 const without=await completeShortReply(original);
 assert.match(without,/請把問題拆成兩個部分/);
 assert.equal(without.includes(original.slice(0,40)),false);
});
test("Codex requests pin Luna non-think with stable session key",()=>{
 const req=codexWsRequest({sessionKey:"qqaibot:ai:demo",messages:[{role:"system",content:"純文字"},{role:"user",content:"你好"}]});
 assert.equal(req.model,"gpt-6-luna");
 assert.equal(req.reasoningEffort,"none");
 assert.equal(req.sessionKey,"qqaibot:ai:demo");
 assert.equal(req.task,"chat");
});
test("Connected old EXE is preferred over Gemini and retains per-person session",async()=>{
 let n=0;
 const stub={fetch:async(url,options)=>{
  if(url.endsWith("/codex/status"))return Response.json({connected:true});
  assert.ok(url.endsWith("/codex/chat"));
  const request=JSON.parse(options.body);n++;
  assert.equal(request.model,"gpt-6-luna");
  assert.equal(request.reasoningEffort,"none");
  assert.match(request.sessionKey,/^qqaibot:ai:/);
  return Response.json({ok:true,text:"本機 Codex 回覆"});
 }};
 const env={ONEBOT_HUB:{idFromName:()=>({}),get:()=>stub}};
 const input={messages:[{role:"user",content:"Hello"}],groupOpenid:"group_open_123",userOpenid:"user_open_456"};
 const r=await generateWithCodexPreference(env,input);
 assert.equal(r.provider,"codex");
 assert.equal(r.text,"本機 Codex 回覆");
 assert.equal(n,1);
});
test("Gemini is used when EXE is offline; no artificial Workers AI binding",async()=>{
 const stub={fetch:async()=>Response.json({connected:false})};
 const env={ONEBOT_HUB:{idFromName:()=>({}),get:()=>stub},GEMINI_API_KEYS:"dummy",GEMINI_CHAT_MODELS:"gemini-2.5-flash"};
 const old=globalThis.fetch;
 try{
  globalThis.fetch=async(url,options)=>{
   assert.match(url,/generativelanguage.googleapis.com/);
   assert.equal(options.headers["x-goog-api-key"],"dummy");
   return Response.json({candidates:[{content:{parts:[{text:"Gemini 回覆"}]}}]});
  };
  const r=await generateWithCodexPreference(env,{messages:[{role:"user",content:"hi"}]});
  assert.equal(r.provider,"gemini");
  assert.equal(r.text,"Gemini 回覆");
 }finally{globalThis.fetch=old;}
});
const event=(id=101)=>({post_type:"message",message_type:"group",group_id:808882936,user_id:3569028262,self_id:2681167798,message_id:id,
 sender:{nickname:"小南"},message:[{type:"text",data:{text:"這裡是關於 JavaScript 語法的正常群聊紀錄"}}]});
class DB{
 constructor(){this.enabled=true;this.records=[];this.deleted=[];this.queries=[];}
 prepare(sql){
  const db=this;
  return {run:async()=>({meta:{changes:0}}),bind(...args){return {
   first:async()=>{
    if(sql.includes("SELECT enabled FROM bot_memory_groups"))return {enabled:db.enabled?1:0};
    if(sql.includes("COUNT(*) AS n FROM bot_memory_items"))return {n:db.records.length};
    if(sql.includes("SELECT id FROM bot_memory_items"))return db.records.find(x=>x.group===args[0]&&x.message===args[1])||null;
    if(sql.includes("SELECT qq_group_id FROM bridge_groups"))return {qq_group_id:"808882936"};
    if(sql.includes("SELECT content FROM bot_memory_items"))return db.records.find(x=>x.id===args[0]&&x.group===args[1])||null;
    throw Error("Unexpected SQL get "+sql);
   },
   all:async()=>{
    if(sql.includes("SELECT content FROM bot_memory_items"))return {results:db.records.filter(x=>x.group===args[0]).map(x=>({content:x.content}))};
    return {results:[]};
   },
   run:async()=>{
    if(sql.includes("INSERT OR IGNORE INTO bot_memory_items")){
     if(db.records.some(x=>x.id===args[0]))return {meta:{changes:0}};
     db.records.push({id:args[0],group:args[1],message:args[2],content:args[4]});return {meta:{changes:1}};
    }
    if(sql.includes("DELETE FROM bot_memory_items WHERE id=")){db.records=db.records.filter(x=>x.id!==args[0]);return {meta:{changes:1}};}
    return {meta:{changes:1}};
   }
  }}};
 }
}
test("Bbot memory is opt-in per QQ group and deduplicated in D1",async()=>{
 const db=new DB(),env={DB:db};
 db.enabled=false;
 assert.equal((await collectBbotMemory(env,event(),{embed:async()=>null})).stored,false);
 assert.equal(db.records.length,0);
 db.enabled=true;
 assert.equal((await collectBbotMemory(env,event(),{embed:async()=>null})).stored,true);
 assert.equal((await collectBbotMemory(env,event(),{embed:async()=>null})).reason,"duplicate");
 assert.equal(db.records.length,1);
});
test("verified group mapping gates Abot memory, and recall deletes source record",async()=>{
 const db=new DB(),env={DB:db};
 await collectBbotMemory(env,event(),{embed:async()=>null});
 const context=await memoryContextForAbot(env,"group-openid-123456789","JavaScript",{embed:async()=>null});
 assert.match(context,/JavaScript/);
 const recalled=await recallBbotMemory(env,{post_type:"notice",notice_type:"group_recall",group_id:808882936,message_id:101});
 assert.equal(recalled.deleted,true);
 assert.equal(db.records.length,0);
});
test("1024-dimensional existing Google embedding key is used, not chat key",async()=>{
 const env={VECTORIZE:{},VECTORIZE_GEMINI_KEYS:"embedding-secret",GEMINI_API_KEYS:"wrong"};
 const vector=await embedding(env,"關於 JavaScript",async(url,opt)=>{
  assert.match(url,/gemini-embedding-001/);
  assert.equal(opt.headers["x-goog-api-key"],"embedding-secret");
  assert.equal(JSON.parse(opt.body).outputDimensionality,1024);
  return Response.json({embedding:{values:new Array(1024).fill(0.01)}});
 });
 assert.equal(vector.length,1024);
});
