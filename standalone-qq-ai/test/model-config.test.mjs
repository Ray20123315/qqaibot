import test from "node:test";
import assert from "node:assert/strict";
import worker,{queryModel} from "../worker.js";
import {listUnslothModels,readModelConfig,saveModelConfig} from "../model-config.js";

function mkEnv(){
 const memory=new Map();
 return {ADMIN_TOKEN:"test-admin-strong-password-with-32-characters",CONFIG_KV:{
   get:async name=>memory.get(name)??null,put:async(name,value)=>{memory.set(name,value);}
 },_memory:memory,QQ_APP_ID:"1234567890",QQ_APP_SECRET:"anotherSecret"};
}
const endpoint="https://msiai.ray2025.com/v1/models";
const complete="https://msiai.ray2025.com/v1/chat/completions";
const respond=ids=>new Response(JSON.stringify({object:"list",data:ids.map(id=>({id,object:"model"}))}),{status:200});
function request(env,path,method,body,token=env.ADMIN_TOKEN){
 return worker.fetch(new Request("https://example.test"+path,{method,headers:{authorization:"Bearer "+token,"content-type":"application/json"},body:body===undefined?undefined:JSON.stringify(body)}),env,{waitUntil(){}});
}
test("model discovery lists only real API ids and never dynamic upstream",async()=>{
 let called=0;
 const ids=await listUnslothModels("sk-local-fake",async(url,opts)=>{
   called++;assert.equal(url,endpoint);assert.equal(opts.headers.authorization,"Bearer sk-local-fake");
   assert.equal(opts.redirect,"error");return respond(["model-z","model-a","model-z"]);
 });
 assert.equal(called,1);assert.deepEqual(ids,["model-z","model-a"]);
});
test("invalid and failed model lists are rejected",async()=>{
 await assert.rejects(()=>listUnslothModels("bad",async()=>respond(["anything"])),/API_KEY_REQUIRED/);
 await assert.rejects(()=>listUnslothModels("sk-local-abc",async()=>new Response("{}",{status:401})),/MODEL_LIST_HTTP_401/);
 await assert.rejects(()=>listUnslothModels("sk-local-abc",async()=>new Response(JSON.stringify({data:[]}),{status:200})),/NO_MODELS_AVAILABLE/);
});
test("encryption hides key; persisted model drives chat even with environment fallback",async()=>{
 const env=mkEnv();env.UNSLOTH_API_KEY="legacy-example-key";env.UNSLOTH_MODEL="legacy-model";
 const mock=async()=>respond(["fast-q4","slow-q8"]);
 await assert.rejects(()=>saveModelConfig(env,"sk-local-real-abcdef","unlisted",mock),/MODEL_NOT_IN_LIST/);
 assert.equal(env._memory.size,0);
 const saved=await saveModelConfig(env,"sk-local-real-abcdef","fast-q4",mock);
 assert.equal(saved.model,"fast-q4");
 const raw=[...env._memory.values()][0];assert.ok(raw);assert.doesNotMatch(raw,/sk-local-real-abcdef|fast-q4/);
 assert.deepEqual(await readModelConfig(env),{apiKey:"sk-local-real-abcdef",model:"fast-q4",saved:true});
 const prior=globalThis.fetch;
 globalThis.fetch=async(url,opts)=>{
   assert.equal(url,complete);
   const body=JSON.parse(opts.body);assert.equal(body.model,"fast-q4");
   assert.deepEqual(body.tools,[]);assert.equal(body.tool_choice,"none");
   assert.equal(opts.headers.authorization,"Bearer sk-local-real-abcdef");
   return new Response(JSON.stringify({choices:[{message:{content:"這是測試回覆"}}]}),{status:200});
 };
 try{assert.equal(await queryModel(env,"你好"),"這是測試回覆");}finally{globalThis.fetch=prior;}
});
test("ADMIN_TOKEN rotation makes ciphertext unusable, never falls back to old key",async()=>{
 const env=mkEnv();await saveModelConfig(env,"sk-local-persistent-key","model-X",async()=>respond(["model-X"]));
 env.ADMIN_TOKEN="a-completely-new-admin-token-xxxxxxxxxxx";
 await assert.rejects(()=>readModelConfig(env),/SAVED_CONFIG_UNAVAILABLE/);
});
test("admin APIs reject unauthenticated calls, list and save without echoing the key",async()=>{
 const env=mkEnv();const original=globalThis.fetch;
 globalThis.fetch=async(url,opts)=>{assert.equal(url,endpoint);assert.equal(opts.method,"GET");return respond(["model-A","model-B"]);};
 try {
   const forbidden=await request(env,"/api/models","POST",{api_key:"sk-local-valid-key"},"wrong");
   assert.equal(forbidden.status,401);
   const lists=await request(env,"/api/models","POST",{api_key:"sk-local-valid-key"});
   assert.equal(lists.status,200);const data=await lists.json();assert.deepEqual(data.models,["model-A","model-B"]);assert.equal(JSON.stringify(data).includes("sk-local-valid-key"),false);
   const applied=await request(env,"/api/settings","POST",{api_key:"sk-local-valid-key",model:"model-B"});
   assert.equal(applied.status,200);assert.deepEqual(await applied.json(),{model:"model-B",saved:true});
   const settings=await request(env,"/api/settings","GET");
   assert.equal(settings.status,200);assert.deepEqual(await settings.json(),{model:"model-B",saved:true,configured:true});
   const retried=await request(env,"/api/models","POST",{api_key:""});
   assert.equal(retried.status,200);assert.deepEqual((await retried.json()).models,["model-A","model-B"]);
 }finally{globalThis.fetch=original;}
});
test("HTML has model picker and never persists API keys in browser storage",async()=>{
 const env=mkEnv();
 const page=await worker.fetch(new Request("https://example.test/"),env);
 const html=await page.text();
 assert.match(html,/取得模型清單/);assert.match(html,/儲存並套用此模型/);
 assert.doesNotMatch(html,/localStorage\.setItem|sessionStorage\.setItem/);
});
