import test from 'node:test';
import assert from 'node:assert/strict';
import worker, {queryModel} from '../worker.js';
const base='https://test.example';
const env={QQ_APP_ID:'1234567890',QQ_APP_SECRET:'testtesttesttestsecret',UNSLOTH_MODEL:'local-model',UNSLOTH_API_KEY:'fake-model-key',ADMIN_TOKEN:'very-secret'};
const call=(path,init={},environment=env,ctx={waitUntil(){}})=>worker.fetch(new Request(base+path,init),environment,ctx);
test('status and HTML do not expose credentials',async()=>{
 const status=await(await call('/api/status')).json();
 assert.equal(status.command_execution,false);assert.equal(status.model_configured,true);
 const html=await(await call('/')).text();assert.doesNotMatch(html,/testtesttesttestsecret|fake-model-key|very-secret/);
});
test('QQ callback refuses unconfigured bot, wrong appid, unsigned event',async()=>{
 assert.equal((await call('/webhook',{method:'POST'},{})).status,503);
 assert.equal((await call('/webhook',{method:'POST',headers:{'X-Bot-Appid':'invalid'},body:'{}'})).status,403);
 const r=await call('/webhook',{method:'POST',headers:{'X-Bot-Appid':env.QQ_APP_ID},body:JSON.stringify({op:0,t:'GROUP_AT_MESSAGE_CREATE',d:{id:'id1',group_openid:'1234567890',content:'你好'}})});
 assert.equal(r.status,403);
});
test('challenge signed with Ed25519',async()=>{
 const r=await call('/webhook',{method:'POST',headers:{'X-Bot-Appid':env.QQ_APP_ID},body:JSON.stringify({op:13,d:{plain_token:'challenge',event_ts:'1725442341'}})});
 assert.equal(r.status,200);const data=await r.json();assert.equal(data.plain_token,'challenge');assert.match(data.signature,/^[0-9a-f]{128}$/);
});
test('admin bearer required, text command never executed',async()=>{
 const opts=(auth,message)=>({method:'POST',headers:{authorization:auth,'content-type':'application/json'},body:JSON.stringify({message})});
 assert.equal((await call('/api/chat',opts('Bearer wrong','你好'))).status,401);
 const r=await call('/api/chat',opts('Bearer very-secret','/rm -rf /'));
 assert.equal(r.status,200);assert.match((await r.json()).reply,/指令目前不可用/);
});
test('model request never provides tool permissions or dynamic target',async()=>{
 const original=globalThis.fetch;let called=false;
 globalThis.fetch=async(url,options)=>{called=true;assert.equal(url,'https://msiai.ray2025.com/v1/chat/completions');assert.equal(options.redirect,'manual');const payload=JSON.parse(options.body);assert.equal('tools' in payload,false);assert.equal('tool_choice' in payload,false);assert.equal(payload.model,'local-model');assert.equal(payload.max_tokens,1024);return new Response(JSON.stringify({choices:[{message:{content:'您好'}}]}),{status:200});};
 try{assert.equal(await queryModel(env,'你好'),'您好');assert.ok(called);}finally{globalThis.fetch=original;}
});

test('chat rejects upstream HTTP failures with safe diagnostics and no upstream body disclosure',async()=>{
 const original=globalThis.fetch;
 const errorMessage='private-upstream-token';
 globalThis.fetch=async()=>new Response(JSON.stringify({error:{message:errorMessage}}),{status:400});
 try {
  const response=await call('/api/chat',{method:'POST',headers:{authorization:'Bearer very-secret','content-type':'application/json'},body:JSON.stringify({message:'你好'})});
  assert.equal(response.status,502);
  const body=await response.json();assert.deepEqual(body,{error:'MODEL_HTTP_400'});
  assert.doesNotMatch(JSON.stringify(body),/private-upstream-token|fake-model-key/);
 }finally{globalThis.fetch=original;}
});
test('chat diagnoses connection error and timeout without leaking exception details',async()=>{
 const original=globalThis.fetch;
 try {
  globalThis.fetch=async()=>{throw new TypeError('internal sensitive network error')};
  const a=await call('/api/chat',{method:'POST',headers:{authorization:'Bearer very-secret','content-type':'application/json'},body:JSON.stringify({message:'hi'})});
  assert.equal((await a.json()).error,'MODEL_CONNECTION_FAILED');
  globalThis.fetch=async()=>{throw new DOMException('do not expose','TimeoutError')};
  const b=await call('/api/chat',{method:'POST',headers:{authorization:'Bearer very-secret','content-type':'application/json'},body:JSON.stringify({message:'hi'})});
  assert.equal((await b.json()).error,'MODEL_TIMEOUT');
 }finally{globalThis.fetch=original;}
});
test('chat handles text arrays and guards invalid or empty output',async()=>{
 const original=globalThis.fetch;
 try {
  globalThis.fetch=async()=>new Response(JSON.stringify({choices:[{message:{content:[{type:'text',text:'您好'},{type:'other',text:'should not show'}]}}]}),{status:200});
  assert.equal(await queryModel(env,'hello'),'您好');
  globalThis.fetch=async()=>new Response(JSON.stringify({choices:[{message:{content:''}}]}),{status:200});
  await assert.rejects(()=>queryModel(env,'hello'),/MODEL_EMPTY_RESPONSE/);
  globalThis.fetch=async()=>new Response('not-json',{status:200});
  await assert.rejects(()=>queryModel(env,'hello'),/MODEL_INVALID_RESPONSE/);
 }finally{globalThis.fetch=original;}
});
