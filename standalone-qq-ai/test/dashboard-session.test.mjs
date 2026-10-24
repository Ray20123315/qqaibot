import test from 'node:test';
import assert from 'node:assert/strict';
import worker, {queryModel} from '../worker.js';
const origin='https://qqbot-ai.ray2025.com';
function fixture(){
 const kv=new Map([['selected-model-v2','unsloth/Qwen3.5-9B-GGUF']]);
 return {
  ADMIN_TOKEN:'test-high-entropy-secret-key-xxxxxxxxxx',
  UNSLOTH_API_KEY:'test-unsloth-worker-secret',
  QQ_APP_ID:'test-qq-appid',
  QQ_APP_SECRET:'test-qq-appsecret',
  CONFIG_KV:{get:async k=>kv.get(k)||null,put:async(k,v)=>{kv.set(k,v);},delete:async k=>{kv.delete(k);}},
 };
}
const call=(env,path,opts={})=>worker.fetch(new Request(origin+path,opts),env,{waitUntil(){}});
async function session(env){
 const r=await call(env,'/api/session',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({admin_token:env.ADMIN_TOKEN})});
 assert.equal(r.status,200);
 assert.equal((await r.json()).authenticated,true);
 const setCookie=r.headers.get('set-cookie');
 assert.match(setCookie,/__Host-qqai_session=/);
 assert.match(setCookie,/HttpOnly/);assert.match(setCookie,/Secure/);assert.match(setCookie,/SameSite=Strict/);
 return setCookie.split(';')[0];
}
test('dashboard login page and model management panels are present',async()=>{
 const html=await(await call(fixture(),'/')).text();
 for(const expected of ['安全登入','模型管理','聊天測試','QQ 診斷','功能與進度','已有服務 · 接入待核對','圖片生成','管理員金鑰']){
   assert.ok(html.includes(expected),expected);
 }
 assert.doesNotMatch(html,/localStorage|sessionStorage|id="apiKey"/);
});
test('auth cookie permits model listing/settings without exposing API key',async()=>{
 const env=fixture();const cookie=await session(env);
 const original=globalThis.fetch;
 globalThis.fetch=async(url,opts)=>{
  assert.equal(url,'https://msiai.ray2025.com/v1/models');
  assert.equal(opts.headers.authorization,'Bearer test-unsloth-worker-secret');
  return new Response(JSON.stringify({data:[{id:'unsloth/Qwen3.5-9B-GGUF'}]}),{status:200});
 };
 try{
  const models=await call(env,'/api/models',{headers:{cookie}});
  assert.equal(models.status,200);
  assert.deepEqual((await models.json()).models,['unsloth/Qwen3.5-9B-GGUF']);
  const change=await call(env,'/api/settings',{method:'POST',headers:{cookie,origin,'content-type':'application/json'},body:JSON.stringify({model:'unsloth/Qwen3.5-9B-GGUF'})});
  assert.equal(change.status,200);
  assert.equal((await change.json()).saved,true);
 }finally{globalThis.fetch=original;}
});
test('unauthorized, invalid origin, changed secret and signout are safe',async()=>{
 const env=fixture();
 assert.equal((await call(env,'/api/models')).status,401);
 const wrong=await call(env,'/api/session',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({admin_token:'wrong'})});
 assert.equal(wrong.status,401);
 const cross=await call(env,'/api/session',{method:'POST',headers:{origin:'https://evil.example','content-type':'application/json'},body:JSON.stringify({admin_token:env.ADMIN_TOKEN})});
 assert.equal(cross.status,403);
 const cookie=await session(env);
 const status=await call(env,'/api/session',{headers:{cookie}});
 assert.equal((await status.json()).authenticated,true);
 const crossWrite=await call(env,'/api/settings',{method:'POST',headers:{cookie,origin:'https://evil.example','content-type':'application/json'},body:JSON.stringify({model:'test'})});
 assert.equal(crossWrite.status,401);
 const changed={...env,ADMIN_TOKEN:'changed-secret-revokes-previous-sessions'};
 assert.equal((await(await call(changed,'/api/session',{headers:{cookie}})).json()).authenticated,false);
 const logout=await call(env,'/api/session',{method:'DELETE',headers:{cookie,origin}});
 assert.equal(logout.status,200);
 assert.match(logout.headers.get('set-cookie'),/Max-Age=0/);
});
test('Qwen chat preserves paragraphs, list newlines and tabs',async()=>{
 const env=fixture(),original=globalThis.fetch;
 globalThis.fetch=async(url,opts)=>{
  assert.equal(url,'https://msiai.ray2025.com/v1/chat/completions');
  return new Response(JSON.stringify({choices:[{message:{content:'第一段\n\n- 要點一\n- 要點二\r\n結束\t！'}}]}),{status:200});
 };
 try {
  const answer=await queryModel(env,'你好');
  assert.equal(answer,'第一段\n\n- 要點一\n- 要點二\n結束\t！');
 }finally{globalThis.fetch=original;}
});

test('served dashboard JavaScript parses and login button actually submits a session',async()=>{
 const {Script,createContext}=await import('node:vm');
 const env=fixture();
 const response=await call(env,'/');
 assert.equal(response.status,200);
 const html=await response.text();
 const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
 assert.ok(script,'dashboard has executable inline JS');
 assert.doesNotThrow(()=>new Script(script,{filename:'dashboard-inline.js'}),'inline JS must parse for login handlers to exist');
 const elements=new Map();
 const listeners=new Map();
 function node(id){
   if(!elements.has(id)){
     const classes=new Set(id==='app'?['is-hidden']:[]);
     elements.set(id,{id,value:'',disabled:false,textContent:'',className:'',dataset:{},
       classList:{add:k=>classes.add(k),remove:k=>classes.delete(k),toggle:(k,on)=>{if(on)classes.add(k);else classes.delete(k);},contains:k=>classes.has(k)},
       addEventListener:(name,handler)=>listeners.set(id+':'+name,handler)});
   }
   return elements.get(id);
 }
 const calls=[];
 const fetchFake=async(path,opts={})=>{
   calls.push({path,method:opts.method||'GET',body:opts.body});
   let value={authenticated:false};
   if(path==='/api/session' && opts.method==='POST'){
     assert.equal(JSON.parse(opts.body).admin_token,env.ADMIN_TOKEN);
     value={authenticated:true};
   }else if(path==='/api/status'){
     value={status:'ok',qq_configured:true,model_configured:true,unsloth_key_configured:true};
   }else if(path==='/api/settings'){
     value={model:'unsloth/Qwen3.5-9B-GGUF'};
   }
   return {ok:true,status:200,json:async()=>value};
 };
 const globals={
   document:{getElementById:node,querySelectorAll:()=>[]},
   fetch:fetchFake,
   console:{error(){},log(){}},
 };
 new Script(script).runInContext(createContext(globals));
 await Promise.resolve(); await Promise.resolve();
 const onSubmit=listeners.get('loginForm:submit');
 assert.equal(typeof onSubmit,'function','submit handler bound to login form');
 node('adminKey').value=env.ADMIN_TOKEN;
 let prevented=false;
 await onSubmit({preventDefault(){prevented=true;}});
 assert.ok(prevented);
 assert.ok(calls.some(x=>x.path==='/api/session'&&x.method==='POST'));
 assert.equal(node('loginPage').classList.contains('is-hidden'),true,'login panel hidden after success');
 assert.equal(node('app').classList.contains('is-hidden'),false,'admin app visible after success');
 assert.equal(node('adminKey').value,'','admin key cleared immediately after login');
});
