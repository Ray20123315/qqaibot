import test from 'node:test';
import assert from 'node:assert/strict';
import {approxTokens,contextBudget,scopeKey,appendMessage,loadContext,compactOneBatch,getMemoryStats} from '../conversation-memory.js';
import {validFile,citationContext,lookupSupport} from '../support-knowledge.js';
import {parseCommand,commandResult} from '../qq-commands.js';
import {chat,summarizeConversation} from '../role-router.js';
import worker from '../worker.js';
function database(){
 let seq=0;const msgs=[],summaries=new Map();
 function query(sql,args,type){
  const scope=args[0];
  if(sql.startsWith('INSERT OR IGNORE INTO qq_message_log')){
   const [s,id,author,role,content]=args;
   if(msgs.some(x=>x.scope===s&&x.event_id===id&&x.role===role))return {meta:{changes:0}};
   msgs.push({seq:++seq,scope:s,event_id:id,author,role,content});
   return {meta:{changes:1}};
  }
  if(sql.startsWith('SELECT through_seq,revision,summary FROM'))return summaries.get(scope)||null;
  if(sql.startsWith('SELECT seq,role,content FROM qq_message_log WHERE scope=? ORDER')){
   return {results:msgs.filter(x=>x.scope===scope).slice(-args[1]).reverse().map(x=>({seq:x.seq,role:x.role,content:x.content}))};
  }
  if(sql.startsWith('SELECT seq,role,content FROM qq_message_log WHERE scope=? AND seq>?')){
   return {results:msgs.filter(x=>x.scope===scope&&x.seq>args[1]).slice(0,args[2]).map(x=>({seq:x.seq,role:x.role,content:x.content}))};
  }
  if(sql.startsWith('INSERT OR IGNORE INTO qq_compaction')){
   if(!summaries.has(scope))summaries.set(scope,{through_seq:0,revision:0,summary:''});
   return {meta:{changes:1}};
  }
  if(sql.startsWith('UPDATE qq_compaction')){
   const [summary,through,key,expected]=args,entry=summaries.get(key);
   if(!entry||entry.through_seq!==expected)return {meta:{changes:0}};
   Object.assign(entry,{summary,through_seq:through,revision:entry.revision+1});
   return {meta:{changes:1}};
  }
  if(sql.startsWith('SELECT COUNT(*) count')){
   const subset=msgs.filter(x=>x.scope===scope);
   return {count:subset.length,last_seq:subset.at(-1)?.seq||0};
  }
  if(sql.startsWith('SELECT through_seq,revision FROM')){
   return summaries.get(scope)||null;
  }
  throw Error('mock: unsupported sql '+sql);
 }
 return {msgs,summaries,prepare(sql){return {bind(...args){return {run:async()=>query(sql,args,'run'),all:async()=>query(sql,args,'all'),first:async()=>query(sql,args,'first')}}}},exec:async()=>{}};
}
test('memory preserves raw records across non-destructive compression, and deduplicates signed retry',async()=>{
 const db=database(),scope='abcd';
 for(let i=0;i<48;i++)await appendMessage(db,scope,'evt'+i,i%2?'assistant':'user','turn '+i);
 await appendMessage(db,scope,'evt0','user','turn 0');
 assert.equal(db.msgs.length,48);
 const before=await loadContext(db,scope,{window:8192});
 assert.equal(before.messages.length,48);
 const compact=await compactOneBatch(db,scope,async(prev,turns)=>'summary '+turns.length);
 assert.equal(compact.compacted,true);
 assert.equal(compact.through,24);
 const after=await loadContext(db,scope,{window:8192});
 assert.equal(after.messages.length,24);
 assert.equal(after.summary,'summary 24');
 const stats=await getMemoryStats(db,scope);
 assert.equal(stats.storedMessages,48,'compaction does not delete raw messages');
 assert.equal(stats.revisions,1);
 const skipped=await compactOneBatch(db,scope,async()=>{throw Error('must not execute');});
 assert.equal(skipped.compacted,false);
});
test('independent scope hashes and context physical maximum clamp',async()=>{
 const env={QQ_APP_ID:'app',QQ_APP_SECRET:'private-seed'};
 const a=await scopeKey(env,{isGroup:true,target:'group-x'});
 const b=await scopeKey(env,{isGroup:false,target:'group-x'});
 assert.notEqual(a,b);assert.equal(a.length,64);
 assert.equal(contextBudget(999999).configured,262144);
 assert.equal(contextBudget(2048).configured,4096);
 assert.ok(approxTokens('您好')>0);
});
test('prompt routes actual multi-turn messages and summary; compactor cannot search web',async()=>{
 const env={UNSLOTH_API_KEY:'test-key',UNSLOTH_MODEL:'test-chat'};
 let body;
 const fetched=async(url,opts)=>{body=JSON.parse(opts.body);return new Response(JSON.stringify({choices:[{message:{content:'我还记得那个笑话。'}}]}),{headers:{'content-type':'application/json'}});};
 const result=await chat(env,'没看懂',fetched,{history:[{role:'user',content:'0 遇到 8，说你胖了'},{role:'assistant',content:'哈哈，是因为 8 像系了腰带'}],summary:'先前在聊数字笑话'});
 assert.equal(result.text,'我还记得那个笑话。');
 assert.deepEqual(body.messages.map(x=>x.role),['system','system','user','assistant','user']);
 assert.equal(body.messages.at(-1).content,'没看懂');
 const sum=await summarizeConversation(env,'旧摘要',[{role:'user',content:'你好'},{role:'assistant',content:'欢迎'}],fetched);
 assert.equal(sum,'我还记得那个笑话。');
 assert.equal(body.enable_tools,false);
 assert.deepEqual(body.enabled_tools,[]);
 assert.equal(body.mcp_enabled,false);
});
test('public support upload validates names and search citations are untrusted',async()=>{
 const blob=new Blob(['客服问答']);Object.defineProperty(blob,'name',{value:'support.md'});
 assert.equal(validFile(blob),true);
 const other=new Blob(['x']);Object.defineProperty(other,'name',{value:'secret.exe'});
 assert.equal(validFile(other),false);
 let input;
 const knowledge=await lookupSupport({SUPPORT_SEARCH:{search:async query=>{input=query;return {chunks:[{score:0.8,text:'请按步骤操作',item:{key:'faq.md'}}]};}}},'HRS 登录问题');
 assert.equal(knowledge[0].source,'faq.md');
 assert.match(citationContext(knowledge),/不可信引用内容/);
 assert.equal(input.ai_search_options.retrieval.max_num_results,4);
});
test('slash commands never actually execute moderation; unknown command not intercepted',()=>{
 assert.deepEqual(parseCommand('/骰子'),{name:'骰子',args:''});
 assert.equal(commandResult('/踢出 @用户').handled,true);
 assert.match(commandResult('/踢出 @用户').text,/未对任何群成员执行操作/);
 assert.match(commandResult('/帮助').text,/上下文/);
 assert.equal(commandResult('/search hi').handled,false);
});
test('admin-only memory budget and public KB APIs reject unsigned clients',async()=>{
 const env={ADMIN_TOKEN:'long-test-token-not-private-000000000000',CONFIG_KV:{get:async k=>null,put:async()=>{}}};
 for(const path of ['/api/context','/api/knowledge']){
  const r=await worker.fetch(new Request('https://test.example'+path),env,{waitUntil(){}});
  assert.equal(r.status,401);
 }
 const r=await worker.fetch(new Request('https://test.example/api/context',{headers:{authorization:'Bearer '+env.ADMIN_TOKEN}}),env,{waitUntil(){}});
 assert.equal(r.status,200);
 const status=await r.json();assert.equal(status.modelCeiling,262144);assert.equal(status.actualStudioWindowVerified,false);
});
test('dashboard has memory / vector knowledge panels and executable script',async()=>{
 const r=await worker.fetch(new Request('https://test.example/'),{},{waitUntil(){}});
 const html=await r.text();
 for(const t of ['data-section="memory"','data-section="knowledge"','knowledgeFile','ctxWindow','公开客服资料'])assert.ok(html.includes(t),t);
 const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];assert.ok(script);
 const vm=await import('node:vm');assert.doesNotThrow(()=>new vm.Script(script));
});

test('Durable Object adapter routes only internal SQL to the scoped stub',async()=>{
 const {roomDatabase,QQMemoryRoom}=await import('../qq-memory-room.js');
 let last=null;
 const stub={fetch:async(url,options)=>{
   assert.equal(url,'https://room.internal/sql');
   last=JSON.parse(options.body);
   return new Response(JSON.stringify({results:[{seq:1,content:'safe'}]}),{status:200});
 }};
 const env={CHAT_ROOMS:{idFromName:name=>name,get:id=>stub}};
 const db=roomDatabase(env,'opaque-scope');
 const rows=await db.prepare('SELECT seq,content FROM qq_message_log WHERE scope=?').bind('opaque-scope').all();
 assert.equal(last.kind,'all');
 assert.equal(last.params[0],'opaque-scope');
 assert.equal(rows.results[0].content,'safe');
 let queries=[];
 const state={storage:{sql:{exec:(sql,...params)=>{queries.push(sql);return {toArray:()=>[{ok:1}],rowsWritten:1}}}}};
 const room=new QQMemoryRoom(state,{});
 const bad=await room.fetch(new Request('https://room.internal/sql',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({sql:'DROP TABLE qq_message_log',params:[],kind:'run'})}));
 assert.equal(bad.status,400);
 const ok=await room.fetch(new Request('https://room.internal/sql',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({sql:'SELECT seq FROM qq_message_log WHERE scope=?',params:['x'],kind:'all'})}));
 assert.equal(ok.status,200);
 assert.ok(queries.length>1);
});
