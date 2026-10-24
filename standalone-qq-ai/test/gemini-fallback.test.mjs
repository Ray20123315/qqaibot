import test from 'node:test';
import assert from 'node:assert/strict';
import {chat} from '../role-router.js';
import {geminiChat,retryableLocalError} from '../gemini-fallback.js';

const env={UNSLOTH_MODEL:'local-test',UNSLOTH_API_KEY:'local-test-token',
 GEMINI_API_KEY:'gemini-test-token',GEMINI_FALLBACK_MODEL:'gemini-fixture'};
const geminiResponse={candidates:[{content:{parts:[{text:'Gemini 备用回复'}]}}]};

test('local computer model success does not call Gemini',async()=>{
 let count=0;
 const response=await chat(env,'你好',async url=>{
  count++;assert.equal(url,'https://msiai.ray2025.com/v1/chat/completions');
  return new Response(JSON.stringify({choices:[{message:{content:'本地成功'}}]}));
 },{modes:{search:false}});
 assert.equal(response.text,'本地成功');assert.equal(count,1);
});
test('local network failure falls back, preserving conversation but no support RAG',async()=>{
 let count=0,geminiRequest;
 const response=await chat(env,'新问题',async(url,options)=>{
  count++;
  if(url==='https://msiai.ray2025.com/v1/chat/completions')throw Error('connection failed');
  assert.equal(url,'https://generativelanguage.googleapis.com/v1beta/models/gemini-fixture:generateContent');
  assert.equal(options.headers['x-goog-api-key'],env.GEMINI_API_KEY);
  geminiRequest=JSON.parse(options.body);
  return new Response(JSON.stringify(geminiResponse));
 },{modes:{search:false},history:[{role:'user',content:'之前的问题'}],knowledge:'客服机密不可进入聊天'});
 assert.equal(response.text,'Gemini 备用回复');assert.equal(response.usedFallback,true);assert.equal(count,2);
 assert.ok(geminiRequest.contents.some(row=>row.parts[0]?.text==='之前的问题'));
 assert.doesNotMatch(JSON.stringify(geminiRequest),/客服机密不可进入聊天|gemini-test-token/);
 assert.equal(geminiRequest.tools,undefined);
});
test('local 401/403 never trigger fallback; unconfigured Gemini never invoked',async()=>{
 for(const code of [401,403]){
  let count=0;
  await assert.rejects(()=>chat(env,'你好',async()=>{count++;return new Response('',{status:code});}),new RegExp('UPSTREAM_HTTP_'+code));
  assert.equal(count,1);
 }
 const noKey={...env,GEMINI_API_KEY:''};
 await assert.rejects(()=>chat(noKey,'你好',async()=>{throw Error('cannot connect');}),/UPSTREAM_CONNECTION_FAILED/);
 assert.equal(retryableLocalError(Error('UPSTREAM_HTTP_503')),true);
});
test('Gemini accepts data-URI image and rejects unsolicited URL images',async()=>{
 let captured;
 const messages=[{role:'system',content:'safe'},{role:'user',content:[{type:'text',text:'看这张图'},
  {type:'image_url',image_url:{url:'data:image/png;base64,aGVsbG8='}}]}];
 await geminiChat(env,messages,async(url,options)=>{
  captured=JSON.parse(options.body);
  return new Response(JSON.stringify(geminiResponse));
 });
 assert.equal(captured.contents[0].parts[1].inline_data.mime_type,'image/png');
 await assert.rejects(()=>geminiChat(env,[{role:'user',content:[{type:'image_url',image_url:{url:'https://bad.test/image.png'}}]}],
  async()=>{throw Error('should not fetch');}),/GEMINI_INVALID_IMAGE/);
});
