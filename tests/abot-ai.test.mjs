import test from "node:test";
import assert from "node:assert/strict";
import {parseOfficialGroupEvent,onAbotAiEvent} from "../src/abot-ai.js";
import {QqOpenGateway} from "../worker.js";
import {isPoliticalTopic,POLITICAL_REFUSAL} from "../src/topic-policy.js";

const packet=(content="!ai 你好",id="event-1")=>({op:0,t:"GROUP_AT_MESSAGE_CREATE",d:{
 id,group_openid:"group-openid-123456789",author:{member_openid:"member-openid-123456789"},content
}});
class FakeD1 {
 constructor(){this.seen=[];this.history=[];this.sent=[];this.settings=new Map();}
 prepare(sql){
  const db=this;
  return {run:async()=>({meta:{changes:0}}),bind(...args){return {
   first:async()=>{
    if(sql.includes("FROM abot_ai_settings"))return db.settings.get(args[0])||null;
    if(sql.includes("COUNT(*) AS n FROM abot_ai_seen"))return {n:db.seen.filter(x=>x.group===args[0]&&(args.length===2||x.user===args[1])).length};
    throw Error("UNEXPECTED_FIRST "+sql);
   },
   all:async()=>({results:sql.includes("FROM abot_ai_history")?db.history.filter(x=>x.group===args[0]&&x.user===args[1]).map(x=>({role:x.role,content:x.content})):[]}),
   run:async()=>{
    if(sql.startsWith("INSERT OR IGNORE INTO abot_ai_seen")){
     if(db.seen.some(x=>x.group===args[0]&&x.id===args[1]))return {meta:{changes:0}};
     db.seen.push({group:args[0],id:args[1],user:args[2],status:"processing"});return {meta:{changes:1}};
    }
    if(sql.startsWith("UPDATE abot_ai_seen")){const entry=db.seen.find(x=>x.group===args.at(-2)&&x.id===args.at(-1));if(entry)entry.status=sql.includes("status='sent'")?"sent":"failed";return {meta:{changes:1}};}
    if(sql.startsWith("INSERT OR IGNORE INTO abot_ai_history")){db.history.push({group:args[0],user:args[1],role:args[3],content:args[4]});return {meta:{changes:1}};}
    if(sql.startsWith("DELETE FROM abot_ai_history"))db.history=db.history.filter(x=>x.group!==args[0]||x.user!==args[1]);
    return {meta:{changes:1}};
   }
  }}};
 }
}
test("Abot accepts official GROUP_AT events with real OpenIDs",()=>{
 const p=parseOfficialGroupEvent(packet("@Bot 你好"));
 assert.equal(p.group,"group-openid-123456789");
 assert.equal(p.user,"member-openid-123456789");
 assert.equal(p.id,"event-1");
 assert.equal(p.content,"@Bot 你好");
});
test("Abot ignores ordinary group message and C2C; no AI group noise",()=>{
 assert.equal(parseOfficialGroupEvent({...packet(),t:"GROUP_MESSAGE_CREATE"}),null);
 assert.equal(parseOfficialGroupEvent({...packet(),t:"C2C_MESSAGE_CREATE"}),null);
 assert.ok(parseOfficialGroupEvent({...packet(),t:"GROUP_MESSAGE_CREATE",d:{...packet().d,mentions:[{is_you:true}]}}));
});
test("Abot official passive reply passes original msg_id and never a numeric QQ group ID",async()=>{
 const db=new FakeD1(),env={DB:db};
 let modelCalls=0,sends=[];
 const generated=async(_env,x)=>{modelCalls++;assert.equal(x.provider,"gemini");return {text:"AI回答"};};
 const send=async(_env,group,text,msgId)=>{sends.push({group,text,msgId});return {id:"official-sent"};};
 const a=await onAbotAiEvent(env,packet(),{generate:generated,send});
 assert.equal(a.status,"sent");
 assert.deepEqual(sends,[{group:"group-openid-123456789",text:"AI回答",msgId:"event-1"}]);
 assert.equal(modelCalls,1);
 const again=await onAbotAiEvent(env,packet(),{generate:generated,send});
 assert.equal(again.reason,"duplicate");
 assert.equal(sends.length,1);
});
test("!help is answered from official passive API without any model call",async()=>{
 const db=new FakeD1();
 let sendArgs;
 const result=await onAbotAiEvent({DB:db},packet("!help","event-help"),{
  generate:()=>{throw Error("MODEL_MUST_NOT_RUN");},
  send:async(_env,group,text,msgId)=>{sendArgs={group,text,msgId};}
 });
 assert.equal(result.status,"sent");
 assert.match(sendArgs.text,/Abot AI/);
 assert.equal(sendArgs.msgId,"event-help");
});
test("official API 4xx is returned as failure, never silently passed to Bbot",async()=>{
 const db=new FakeD1();let sends=0;
 const result=await onAbotAiEvent({DB:db},packet("!ai 你好","event-4xx"),{
  generate:async()=>({text:"回覆"}),
  send:async()=>{sends++;throw Object.assign(new Error("QQ_API"),{status:403,code:40034105});}
 });
 assert.equal(result.status,"failed");
 assert.equal(result.errorCode,40034105);
 assert.equal(sends,1);
 assert.equal(db.seen[0].status,"failed");
 const repeat=await onAbotAiEvent({DB:db},packet("!ai 你好","event-4xx"),{send:async()=>{throw Error("must not replay")}});
 assert.equal(repeat.ignored,true);
});
test("new QQ gateway identifies using official token, no Bbot secret",async()=>{
 const state={storage:{setAlarm:async()=>{},get:async()=>null,put:async()=>{},deleteAlarm:async()=>{}}};
 const gateway=new QqOpenGateway(state,{QQ_AI_ABOT_ENABLED:"true",QQ_OPEN_INTENTS:"100663296"});
 const sent=[];gateway.token="official-token";gateway.ws={readyState:1,send:x=>sent.push(JSON.parse(x))};
 await gateway.handleMessage(JSON.stringify({op:10,d:{heartbeat_interval:30000}}));
 assert.equal(sent[0].op,2);
 assert.equal(sent[0].d.token,"QQBot official-token");
 assert.equal(sent[0].d.intents,100663296);
 await gateway.handleMessage(JSON.stringify({op:0,t:"READY",d:{session_id:"sess"},s:15}));
 assert.equal(gateway.ready,true);
 assert.equal(gateway.seq,15);
});
test("old QQ gateway stays disabled unless explicitly enabled; no Abot session on Bbot-only configuration",async()=>{
 const state={storage:{get:async()=>null,put:async()=>{},deleteAlarm:async()=>{},setAlarm:async()=>{}}};
 const gateway=new QqOpenGateway(state,{QQ_AI_ABOT_ENABLED:"false"});
 const status=await gateway.fetch(new Request("https://internal/status"));
 assert.equal((await status.json()).enabled,false);
 const ensure=await gateway.fetch(new Request("https://internal/ensure"));
 assert.deepEqual(await ensure.json(),{enabled:false});
});

test("political questions are refused before any Gemini/DeepSeek call",async()=>{
 const db=new FakeD1(),sent=[];
 const input=packet("!ai 你怎麼看今年的總統選舉？","politics-in-1");
 const r=await onAbotAiEvent({DB:db},input,{
  generate:async()=>{throw new Error("POLITICAL_REQUEST_MUST_NOT_REACH_MODEL");},
  send:async(_env,group,body,msgId)=>sent.push({group,body,msgId})
 });
 assert.equal(r.status,"sent");
 assert.deepEqual(sent,[{group:input.d.group_openid,body:POLITICAL_REFUSAL,msgId:input.d.id}]);
 assert.equal(db.history.length,0);
});
test("model-generated political response is suppressed and never persisted in conversation history",async()=>{
 const db=new FakeD1(),sent=[];
 const r=await onAbotAiEvent({DB:db},packet("!ai 介紹番茄炒蛋","politics-out-1"),{
  generate:async(_env,x)=>{
   assert.match(x.messages[0].content,/不要討論政治/);
   return {text:"總統應該支持這個政黨，理由如下："};
  },
  send:async(_env,group,body)=>sent.push(body)
 });
 assert.equal(r.status,"sent");
 assert.deepEqual(sent,[POLITICAL_REFUSAL]);
 assert.equal(db.history.length,0);
});
test("political-language checks support traditional, simplified, English and spaced words, but not ordinary chat",()=>{
 for(const input of ["聊聊政 治", "比较两岸关系", "谁当选总统", "Who wins the presidential election?", "Donald Trump", "國民黨是什麼"])assert.equal(isPoliticalTopic(input),true,input);
 for(const input of ["教我學 Python", "今天的天氣如何", "幫我整理番茄炒蛋食譜", "我想投票選披薩口味"])assert.equal(isPoliticalTopic(input),false,input);
});
