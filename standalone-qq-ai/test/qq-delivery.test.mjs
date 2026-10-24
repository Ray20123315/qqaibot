import test from 'node:test';
import assert from 'node:assert/strict';
import {createPrivateKey,sign} from 'node:crypto';
import worker from '../worker.js';

const base='https://qq-test.example';
const secret='test-QQ-AppSecret-for-local-tests';
const prefix=Buffer.from('302e020100300506032b657004220420','hex');
const encoded=Buffer.from(secret);
const seed=Buffer.alloc(32);
for(let i=0;i<seed.length;i++)seed[i]=encoded[i%encoded.length];
const privateKey=createPrivateKey({key:Buffer.concat([prefix,seed]),format:'der',type:'pkcs8'});
function qqRequest(payload,appId='1234567890'){
 const body=JSON.stringify(payload);
 const timestamp=String(Math.floor(Date.now()/1000));
 const signature=sign(null,Buffer.from(timestamp+body),privateKey).toString('hex');
 return new Request(base+'/webhook',{method:'POST',headers:{
   'X-Bot-Appid':appId,
   'X-Signature-Ed25519':signature,
   'X-Signature-Timestamp':timestamp,
   'content-type':'application/json'
 },body});
}
function harness(){
 const records=new Map();
 const jobs=[];
 const env={QQ_APP_ID:'1234567890',QQ_APP_SECRET:secret,ADMIN_TOKEN:'strong-test-admin-key',UNSLOTH_API_KEY:'test-fake-key',
   CONFIG_KV:{
     get:async k=>records.get(k)||null,
     put:async(k,v,options)=>{if(k.startsWith('qqdiag-v1:'))assert.equal(options?.expirationTtl,86400);records.set(k,v);}
   }};
 records.set('selected-model-v2','sample-model');
 const ctx={waitUntil:p=>jobs.push(Promise.resolve(p))};
 return {env,records,jobs,ctx,async finish(){await Promise.all(jobs);}};
}
const diagnostics=async(env)=>worker.fetch(new Request(base+'/api/qq/diagnostics',{headers:{authorization:'Bearer '+env.ADMIN_TOKEN}}),env,{waitUntil(){}});
test('Webhook rejects unsigned event and records safe reason; diagnostics require bearer token',async()=>{
 const h=harness();
 const bad=await worker.fetch(new Request(base+'/webhook',{method:'POST',headers:{'X-Bot-Appid':h.env.QQ_APP_ID},body:JSON.stringify({op:0,t:'C2C_MESSAGE_CREATE'})}),h.env,h.ctx);
 assert.equal(bad.status,403);await h.finish();
 const unauthorized=await worker.fetch(new Request(base+'/api/qq/diagnostics'),h.env,{waitUntil(){}});
 assert.equal(unauthorized.status,401);
 const result=await(await diagnostics(h.env)).json();
 assert.equal(result.qq_configured,true);
 assert.ok(result.events.some(x=>x.stage==='callback_rejected'&&x.code==='INVALID_SIGNATURE'));
 assert.doesNotMatch(JSON.stringify(result),/test-QQ-AppSecret|test-fake-key|user_openid|content:/);
});
test('Signed QQ group event with opaque OpenID is processed and model errors get a visible fallback reply',async()=>{
 const h=harness();const previous=globalThis.fetch;let outbound;
 globalThis.fetch=async(url,opts)=>{
   if(url==='https://msiai.ray2025.com/v1/chat/completions')
     return new Response('{"error":{"message":"No model loaded"}}',{status:400});
   if(url==='https://api.bot.qq.com/app/getAppAccessToken')
     return new Response(JSON.stringify({access_token:'fake-access-token',expires_in:7200}),{status:200});
   if(String(url).startsWith('https://api.bot.qq.com/v2/groups/')){
     outbound={url,authorization:opts.headers.authorization,body:JSON.parse(opts.body)};
     return new Response('{"id":"sent-message"}',{status:200});
   }
   throw Error('unexpected fetch URL');
 };
 try{
   const reply=await worker.fetch(qqRequest({op:0,t:'GROUP_AT_MESSAGE_CREATE',d:{id:'test-message-1',group_openid:'a+b/c=d',content:'<@1234567890> 你好'}}),h.env,h.ctx);
   assert.equal(reply.status,200);assert.deepEqual(await reply.json(),{op:12});
   await h.finish();
   assert.ok(outbound);
   assert.ok(outbound.url.endsWith('/a%2Bb%2Fc%3Dd/messages'));
   assert.equal(outbound.authorization,'QQBot fake-access-token');
   assert.equal(outbound.body.msg_id,'test-message-1');
   assert.equal(outbound.body.msg_type,2);assert.match(outbound.body.markdown.content,/MODEL_HTTP_400/);
   const diag=(await(await diagnostics(h.env)).json()).events;
   assert.ok(diag.some(x=>x.stage==='event_received'&&x.code==='GROUP_AT'));
   assert.ok(diag.some(x=>x.stage==='model_failed'&&x.code==='MODEL_HTTP_400'));
   assert.ok(diag.some(x=>x.stage==='reply_sent'&&x.code==='OK'));
 }finally{globalThis.fetch=previous;}
});
test('Signed QQ C2C event records outbound QQ HTTP failure without storing message text or OpenID',async()=>{
 const h=harness();const previous=globalThis.fetch;
 globalThis.fetch=async(url,opts)=>{
   if(url==='https://api.bot.qq.com/app/getAppAccessToken')
     return new Response(JSON.stringify({access_token:'fake-access-token',expires_in:7200}),{status:200});
   if(String(url).includes('/v2/users/'))
     return new Response('{"message":"sensitive provider error"}',{status:403});
   throw Error('unexpected HTTP request');
 };
 try{
   const req=qqRequest({op:0,t:'C2C_MESSAGE_CREATE',d:{id:'test-message-2',author:{user_openid:'private+open/id'},content:'/help'}});
   const response=await worker.fetch(req,h.env,h.ctx);
   assert.equal(response.status,200);await h.finish();
   const d=(await(await diagnostics(h.env)).json()).events;
   assert.ok(d.some(x=>x.stage==='event_received'&&x.code==='C2C'));
   assert.ok(d.some(x=>x.stage==='send_failed'&&x.code==='QQ_SEND_HTTP_403'));
   assert.doesNotMatch(JSON.stringify(d),/private\+open|sensitive provider error|\/help/);
 }finally{globalThis.fetch=previous;}
});
test('QQ callback op=13 responds with Ed25519 verification signature and records challenge stage',async()=>{
 const h=harness();
 const r=await worker.fetch(new Request(base+'/webhook',{method:'POST',headers:{'X-Bot-Appid':h.env.QQ_APP_ID,'content-type':'application/json'},body:JSON.stringify({op:13,d:{plain_token:'validation_token',event_ts:String(Math.floor(Date.now()/1000))}})}),h.env,h.ctx);
 assert.equal(r.status,200);
 const d=await r.json();assert.equal(d.plain_token,'validation_token');assert.match(d.signature,/^[a-f0-9]{128}$/);
 await h.finish();assert.ok((await(await diagnostics(h.env)).json()).events.some(x=>x.stage==='callback_verify'));
});

test('QQ auth fetch rejection records QQ_AUTH_FETCH_FAILED instead of UNKNOWN',async()=>{
 const {processEvent}=await import('../worker.js?qq-auth-fetch-case');
 const h=harness();const original=globalThis.fetch;
 globalThis.fetch=async()=>{throw new TypeError('private failure: token never log');};
 try{
   await assert.rejects(()=>processEvent(h.env,{message:'/help',isGroup:true,target:'opaqueGroup',id:'fresh-001'}),/QQ_AUTH_FETCH_FAILED/);
   const diag=(await(await diagnostics(h.env)).json()).events;
   assert.ok(diag.some(x=>x.stage==='send_failed'&&x.code==='QQ_AUTH_FETCH_FAILED'));
   assert.doesNotMatch(JSON.stringify(diag),/private failure|token never log|test-fake-key/);
 }finally{globalThis.fetch=original;}
});
test('QQ send fetch rejection after valid token is distinguished from auth failure',async()=>{
 const {processEvent}=await import('../worker.js?qq-send-fetch-case');
 const h=harness();const original=globalThis.fetch;
 globalThis.fetch=async(url)=>{
   if(String(url).includes('/app/getAppAccessToken'))
     return new Response(JSON.stringify({access_token:'fake-token',expires_in:7200}),{status:200});
   if(String(url).includes('/v2/groups/'))
     throw new TypeError('private network error must not be exposed');
   throw Error('unexpected fetch');
 };
 try{
   await assert.rejects(()=>processEvent(h.env,{message:'/help',isGroup:true,target:'opaqueGroup',id:'fresh-002'}),/QQ_SEND_FETCH_FAILED/);
   const diag=(await(await diagnostics(h.env)).json()).events;
   assert.ok(diag.some(x=>x.stage==='send_failed'&&x.code==='QQ_SEND_FETCH_FAILED'));
 }finally{globalThis.fetch=original;}
});
test('QQ token and send API business failure codes are safe bounded numeric values',async()=>{
 const orig=globalThis.fetch;
 const {processEvent:authProcess}=await import('../worker.js?qq-auth-biz-code');
 const h=harness();
 globalThis.fetch=async()=>new Response(JSON.stringify({code:100016,message:'contains secret'}),{status:200});
 try {
   await assert.rejects(()=>authProcess(h.env,{message:'/help',isGroup:true,target:'opaqueGroup',id:'fresh-003'}),/QQ_AUTH_CODE_100016/);
   assert.ok((await(await diagnostics(h.env)).json()).events.some(x=>x.code==='QQ_AUTH_CODE_100016'));
 }finally{globalThis.fetch=orig;}
 const {processEvent:sendProcess}=await import('../worker.js?qq-send-biz-code');
 const b=harness();
 globalThis.fetch=async(url)=>{
   if(String(url).includes('/app/getAppAccessToken'))
     return new Response(JSON.stringify({access_token:'fake-token',expires_in:7200}),{status:200});
   return new Response(JSON.stringify({err_code:304023,message:'untrusted provider text'}),{status:200});
 };
 try{
   await assert.rejects(()=>sendProcess(b.env,{message:'/help',isGroup:true,target:'opaqueGroup',id:'fresh-004'}),/QQ_SEND_CODE_304023/);
   const diag=(await(await diagnostics(b.env)).json()).events;
   assert.ok(diag.some(x=>x.code==='QQ_SEND_CODE_304023'));
   assert.doesNotMatch(JSON.stringify(diag),/untrusted provider text/);
 }finally{globalThis.fetch=orig;}
});
test('QQ auth and send timeout are distinguished safely',async()=>{
 const h=harness();const original=globalThis.fetch;
 const {processEvent:authProcess}=await import('../worker.js?qq-auth-timeout');
 globalThis.fetch=async()=>{throw new DOMException('sensitive','TimeoutError');};
 try{await assert.rejects(()=>authProcess(h.env,{message:'/help',isGroup:true,target:'opaqueGroup',id:'fresh-005'}),/QQ_AUTH_TIMEOUT/);}finally{globalThis.fetch=original;}
 const b=harness();const {processEvent:sendProcess}=await import('../worker.js?qq-send-timeout');
 globalThis.fetch=async(url)=>{
   if(String(url).includes('/app/getAppAccessToken'))return new Response(JSON.stringify({access_token:'fake-token',expires_in:7200}),{status:200});
   throw new DOMException('private info','TimeoutError');
 };
 try{
   await assert.rejects(()=>sendProcess(b.env,{message:'/help',isGroup:true,target:'opaqueGroup',id:'fresh-006'}),/QQ_SEND_TIMEOUT/);
 }finally{globalThis.fetch=original;}
});
