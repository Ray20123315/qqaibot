import test from 'node:test';
import assert from 'node:assert/strict';
import worker,{queryModel} from '../worker.js';
import {getConfig,setConfig,wantsWebSearch,chat,speech,transcribe} from '../role-router.js';
const base='https://qqbot-ai.ray2025.com';
function fixture(){
  const store=new Map([['selected-model-v2','unsloth/Qwen3.5-9B-GGUF']]);
  const env={ADMIN_TOKEN:'test-admin-secret-at-least-32-characters',UNSLOTH_API_KEY:'test-only-key-in-Worker-Secret',
    CONFIG_KV:{get:async k=>store.get(k)??null,put:async(k,v)=>{store.set(k,v);}},store};
  return env;
}
const roles={chat:'unsloth/Qwen3.5-9B-GGUF',asr:'Qwen/Qwen3-ASR-0.6B',tts:'Qwen/Qwen3-TTS-0.6B',webSearch:true};
const json=x=>new Response(JSON.stringify(x),{status:200,headers:{'content-type':'application/json'}});
const request=(env,path,method='GET',body)=>worker.fetch(new Request(base+path,
  {method,headers:{authorization:'Bearer '+env.ADMIN_TOKEN,'content-type':'application/json'},
  body:body===undefined?undefined:JSON.stringify(body)}),env,{waitUntil(){}});
test('legacy chat remains selected; optional ASR/TTS roles default off, search on',async()=>{
 const e=fixture();
 assert.deepEqual(await getConfig(e),{chat:roles.chat,asr:null,tts:null,webSearch:true,saved:false});
});
test('role settings keep IDs only and disallow URLs, scripts and image roles',async()=>{
 const e=fixture();
 await assert.rejects(()=>setConfig(e,{...roles,tts:'https://bad.example'}),/INVALID_ROLE_CONFIG/);
 await assert.rejects(()=>setConfig(e,{...roles,image:'Qwen-Image'}),/INVALID_ROLE_CONFIG/);
 await setConfig(e,roles);
 assert.deepEqual(await getConfig(e),{...roles,saved:true});
 assert.doesNotMatch(JSON.stringify([...e.store]),/test-only-key-in-Worker-Secret/);
});
test('all chat requests only web_search and never invokes other local tools',async()=>{
 const e=fixture();await setConfig(e,roles);
 let normal;
 const a=await chat(e,'你好',async(url,options)=>{normal=JSON.parse(options.body);assert.equal(url,'https://msiai.ray2025.com/v1/chat/completions');return json({choices:[{message:{content:'第一行\n第二行'}}]});});
 assert.equal(a.text,'第一行\n第二行');
 assert.equal(normal.enable_tools,true);assert.deepEqual(normal.enabled_tools,['web_search']);assert.equal(normal.mcp_enabled,false);assert.equal(normal.stream,true);
 let searchReq;
 const sse='data: {"choices":[{"delta":{"content":"找到 "}}]}\n\ndata: {"choices":[{"delta":{"content":"來源"}}]}\n\ndata: [DONE]\n\n';
 const b=await chat(e,'請幫我查最新消息',async(url,options)=>{searchReq=JSON.parse(options.body);return new Response(sse,{headers:{'content-type':'text/event-stream'}});});
 assert.equal(b.text,'找到 來源');assert.equal(b.searched,false);assert.equal(b.searchRequested,true);assert.deepEqual(searchReq.enabled_tools,['web_search']);
 assert.equal(searchReq.enable_tools,true);assert.equal(searchReq.mcp_enabled,false);
 assert.equal(wantsWebSearch('/search 資安新聞'),true);
 assert.equal(wantsWebSearch('你好'),false);
});
test('ASR/TTS use only preconfigured role IDs and fixed Unsloth URLs',async()=>{
 const e=fixture();await setConfig(e,roles);
 const audio=await speech(e,'你好',async(url,options)=>{
  assert.equal(url,'https://msiai.ray2025.com/v1/audio/speech');
  assert.equal(JSON.parse(options.body).model,roles.tts);
  return new Response(new Uint8Array([82,73,70,70]),{headers:{'content-type':'audio/wav'}});
 });
 assert.equal(audio.headers.get('content-type'),'audio/wav');
 const blob=new Blob([new Uint8Array([82,73,70,70])],{type:'audio/wav'});
 const transcript=await transcribe(e,blob,async(url,options)=>{
  assert.equal(url,'https://msiai.ray2025.com/v1/audio/transcriptions');
  assert.equal(options.body.get('model'),roles.asr);
  return json({text:'辨識內容'});
 });
 assert.deepEqual(transcript,{text:'辨識內容'});
});
test('optional roles reject use until configured',async()=>{
 const e=fixture();
 await assert.rejects(()=>speech(e,'你好'),/TTS_NOT_CONFIGURED/);
 await assert.rejects(()=>transcribe(e,new Blob(['a'],{type:'audio/wav'})),/ASR_NOT_CONFIGURED/);
});
test('admin API is authenticated, cannot enable image routing, and does not expose secret',async()=>{
 const e=fixture();
 const denied=await worker.fetch(new Request(base+'/api/model-roles'),e,{waitUntil(){}});
 assert.equal(denied.status,401);
 const invalid=await request(e,'/api/model-roles','POST',{...roles,images:'Qwen-Image'});
 assert.equal(invalid.status,400);
 const r=await request(e,'/api/model-roles','POST',roles);assert.equal(r.status,200);
 const view=await request(e,'/api/model-roles');const data=await view.json();
 assert.deepEqual(data,{...roles,saved:true});
 assert.doesNotMatch(JSON.stringify(data),/test-only-key-in-Worker-Secret/);
 assert.equal((await request(e,'/v1/images/generations')).status,404);
});
test('web console has three model roles plus a search switch',async()=>{
 const e=fixture();const r=await worker.fetch(new Request(base+'/'),e,{waitUntil(){}});
 const html=await r.text();
 for(const term of ['多模型路由','roleChat','roleAsr','roleTts','roleSearch','圖片相關模型本次不接入'])assert.ok(html.includes(term),term);
});
