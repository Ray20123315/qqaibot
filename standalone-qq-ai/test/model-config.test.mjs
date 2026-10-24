import test from "node:test";
import assert from "node:assert/strict";
import worker, {queryModel} from "../worker.js";
import {listUnslothModels, readModelConfig, saveModelConfig} from "../model-config.js";
const upstream="https://msiai.ray2025.com/v1/models";
const chatUrl="https://msiai.ray2025.com/v1/chat/completions";
const modelResponse=ids=>new Response(JSON.stringify({object:"list",data:ids.map(id=>({id,object:"model"}))}),{status:200});
function envSetup(){
  const store=new Map();
  const config={ADMIN_TOKEN:"test-admin-secret-32characters-valid",UNSLOTH_API_KEY:"sk-secret-only-mock-123",
    QQ_APP_ID:"1112223334",QQ_APP_SECRET:"secretforqqbot",
    CONFIG_KV:{get:async k=>store.has(k)?store.get(k):null,put:async(k,v)=>{store.set(k,v);},delete:async k=>{store.delete(k);}},
    _store:store};
  return config;
}
const req=(env,path,method="GET",body,token=env.ADMIN_TOKEN)=>worker.fetch(new Request("https://unit.test"+path,
  {method,headers:{authorization:"Bearer "+token,"content-type":"application/json"},body:body===undefined?undefined:JSON.stringify(body)}),env,{waitUntil(){}});
test("model discovery reads ONLY Worker Secret and respects fixed URL",async()=>{
 const env=envSetup();
 const data=await listUnslothModels(env,async(url,init)=>{
   assert.equal(url,upstream);assert.equal(init.headers.authorization,"Bearer sk-secret-only-mock-123");
   assert.equal(init.redirect,"manual");
   return modelResponse(["model-a","model-b","model-a"]);
 });
 assert.deepEqual(data,["model-a","model-b"]);
});
test("missing secret, HTTP status, redirect, timeout and network error have safe errors",async()=>{
 const env=envSetup();delete env.UNSLOTH_API_KEY;
 await assert.rejects(()=>listUnslothModels(env,async()=>modelResponse(["x"])),/UNSLOTH_SECRET_NOT_CONFIGURED/);
 env.UNSLOTH_API_KEY="sk-secret-only-mock-123";
 await assert.rejects(()=>listUnslothModels(env,async()=>new Response("",{status:401})),/MODEL_LIST_HTTP_401/);
 await assert.rejects(()=>listUnslothModels(env,async()=>new Response("",{status:302,headers:{location:"https://example.com/signin"}})),/MODEL_LIST_REDIRECT_302/);
 await assert.rejects(()=>listUnslothModels(env,async()=>{throw new DOMException("private","TimeoutError");}),/MODEL_LIST_TIMEOUT/);
 await assert.rejects(()=>listUnslothModels(env,async()=>{throw Error("private");}),e=>e.message==="MODEL_LIST_CONNECTION_FAILED");
});
test("KV saves model only and removes legacy key, API key stays a Secret",async()=>{
 const env=envSetup();env.UNSLOTH_MODEL="fallback";
 env._store.set("model-configuration-v1","old encrypted data");
 await assert.rejects(()=>saveModelConfig(env,"unlisted",async()=>modelResponse(["model-a"])),/MODEL_NOT_IN_LIST/);
 assert.equal(env._store.size,1);
 const v=await saveModelConfig(env,"model-a",async()=>modelResponse(["model-a"]));
 assert.deepEqual(v,{model:"model-a",saved:true});
 assert.deepEqual([...env._store.entries()],[["selected-model-v2","model-a"]]);
 assert.deepEqual(await readModelConfig(env),{apiKey:"sk-secret-only-mock-123",model:"model-a",saved:true});
 env.ADMIN_TOKEN="rotated-admin-key";
 assert.equal((await readModelConfig(env)).model,"model-a");
});
test("selected model drives chat with tool calls forbidden and Secret used",async()=>{
 const env=envSetup();env._store.set("selected-model-v2","model-choice");
 const previous=globalThis.fetch;
 globalThis.fetch=async(url,opts)=>{
   assert.equal(url,chatUrl);assert.equal(opts.headers.authorization,"Bearer sk-secret-only-mock-123");
   const d=JSON.parse(opts.body);assert.equal(d.model,"model-choice");
   assert.deepEqual(d.tools,[]);assert.equal(d.tool_choice,"none");
   return new Response(JSON.stringify({choices:[{message:{content:"收到"}}]}),{status:200});
 };
 try {assert.equal(await queryModel(env,"你好"),"收到");}finally{globalThis.fetch=previous;}
});
test("admin-only model APIs forbid browser-submitted API keys",async()=>{
 const env=envSetup();const original=globalThis.fetch;
 globalThis.fetch=async(url,opts)=>{assert.equal(url,upstream);assert.equal(opts.headers.authorization,"Bearer sk-secret-only-mock-123");return modelResponse(["model-a","model-b"]);};
 try{
   const denied=await req(env,"/api/models","GET",undefined,"incorrect");assert.equal(denied.status,401);
   const loaded=await req(env,"/api/models");assert.equal(loaded.status,200);assert.deepEqual((await loaded.json()).models,["model-a","model-b"]);
   const reject=await req(env,"/api/settings","POST",{api_key:"sk-overwrite-attempt",model:"model-a"});
   assert.equal(reject.status,400);
   const applied=await req(env,"/api/settings","POST",{model:"model-b"});assert.equal(applied.status,200);
   assert.equal((await applied.json()).model,"model-b");
   const settings=await req(env,"/api/settings");const payload=await settings.json();assert.deepEqual(payload,{model:"model-b",saved:true,configured:true});
   assert.equal(JSON.stringify(payload).includes("sk-secret-only-mock-123"),false);
 }finally{globalThis.fetch=original;}
});
test("web admin has no Unsloth API Key form and secret status has no value",async()=>{
 const env=envSetup();
 const page=await worker.fetch(new Request("https://unit.test/"),env);
 const html=await page.text();
 assert.doesNotMatch(html,/id=["']apiKey["']|localStorage\.setItem|sessionStorage\.setItem/);
 assert.match(html,/UNSLOTH_API_KEY Secret/);
 const resp=await worker.fetch(new Request("https://unit.test/api/status"),env);
 const data=await resp.json();
 assert.equal(data.unsloth_key_configured,true);
 assert.equal(JSON.stringify(data).includes("sk-secret-only-mock-123"),false);
});
