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
 assert.equal(r.status,200);assert.match((await r.json()).reply,/無法執行指令/);
});
test('model request never provides tool permissions or dynamic target',async()=>{
 const original=globalThis.fetch;let called=false;
 globalThis.fetch=async(url,options)=>{called=true;assert.equal(url,'https://msiai.ray2025.com/v1/chat/completions');assert.equal(options.redirect,'error');const payload=JSON.parse(options.body);assert.deepEqual(payload.tools,[]);assert.equal(payload.tool_choice,'none');assert.equal(payload.model,'local-model');return new Response(JSON.stringify({choices:[{message:{content:'您好'}}]}),{status:200});};
 try{assert.equal(await queryModel(env,'你好'),'您好');assert.ok(called);}finally{globalThis.fetch=original;}
});
