import test from 'node:test';
import assert from 'node:assert/strict';
import {modeCommand,readModes,handleModeCommand,DEFAULT_MODES} from '../qq-modes.js';
import {safeQQImageURL,qqImageAttachments,imagePartFromQQ} from '../qq-image.js';
import {abusiveRepeatRequest,hasUnsafeMassOutput,safeReplyText,isHtmlRequest,userTopicBoundary} from '../qq-output-policy.js';
import {chat} from '../role-router.js';
const env=()=>{const kv=new Map();return {CONFIG_KV:{get:async k=>kv.get(k)||null,put:async(k,v)=>kv.set(k,v)},QQ_APP_SECRET:'fake-test-secret',QQ_APP_ID:'test-id',UNSLOTH_API_KEY:'fake-token',UNSLOTH_MODEL:'test-chat',kv};};
const event=(author='group-user-1',message='你好')=>({isGroup:true,target:'group1',author,message});
test('search defaults ON, thinking defaults OFF and user toggle is private to each author',async()=>{
 const e=env();
 assert.deepEqual(await readModes(e,event()),DEFAULT_MODES);
 assert.deepEqual(modeCommand('/思考开'),{kind:'thinking',action:'on'});
 assert.deepEqual(modeCommand('/搜索关'),{kind:'search',action:'off'});
 const r=await handleModeCommand(e,event('alice','/思考开'));
 assert.match(r.text,/思考模式 开启/);
 assert.equal((await readModes(e,event('alice'))).thinking,true);
 assert.equal((await readModes(e,event('bob'))).thinking,false);
 await handleModeCommand(e,event('alice','/搜索关'));
 assert.deepEqual(await readModes(e,event('alice')),{search:false,thinking:true,deep:false});
 const deep=await handleModeCommand(e,event('alice','/深度搜索开'));
 assert.match(deep.text,/暂未开放/);
 assert.equal((await readModes(e,event('alice'))).deep,false);
});
test('unknown group author cannot change shared group settings',async()=>{
 const e=env();
 const result=await handleModeCommand(e,event('', '/思考开'));
 assert.match(result.text,/无法验证/);
 assert.equal(e.kv.size,0);
});
test('backend only offers allowlisted web_search, and thinking is explicitly disabled by default',async()=>{
 const e=env();
 let req;
 const fetcher=async(url,options)=>{req=JSON.parse(options.body);return new Response(JSON.stringify({choices:[{message:{content:'答案'}}]}),{headers:{'content-type':'application/json'}});};
 await chat(e,'你好',fetcher);
 assert.equal(req.enable_thinking,false);
 assert.deepEqual(req.enabled_tools,['web_search']);
 assert.equal(req.bypass_permissions,false);
 assert.equal(req.deep_research_armed,false);
 await chat(e,'你好',fetcher,{modes:{search:false,thinking:true}});
 assert.equal(req.enable_thinking,true);
 assert.equal(req.enable_tools,false);
 assert.deepEqual(req.enabled_tools,[]);
 assert.equal(req.stream,false);
 assert.equal(req.mcp_enabled,false);
});
test('safe QQ image domains and bounded input image, no open URL or redirects',async()=>{
 assert.equal(safeQQImageURL('https://multimedia.nt.qq.com.cn/a.png'),true);
 assert.equal(safeQQImageURL('https://evil.qq.com.attacker.net/a.png'),false);
 assert.equal(safeQQImageURL('http://qpic.cn/a.png'),false);
 assert.equal(safeQQImageURL('https://127.0.0.1/x'),false);
 const image=qqImageAttachments({attachments:[{content_type:'image/png',url:'https://multimedia.nt.qq.com.cn/a.png'}]});
 assert.equal(image.length,1);
 const png=new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0,0,0,0,0]);
 const media=await imagePartFromQQ(image[0],async(url,opts)=>{
   assert.equal(opts.redirect,'manual');
   return new Response(png,{headers:{'content-type':'image/png'}});
 });
 assert.equal(media.type,'image_url');
 assert.match(media.image_url.url,/^data:image\/png;base64,/);
 await assert.rejects(()=>imagePartFromQQ('https://attacker.example/private'),/INVALID_QQ_IMAGE_URL/);
});
test('large repeated spam is rejected, ordinary code and chat not blanket banned',()=>{
 assert.equal(abusiveRepeatRequest('请输出100个0给我'),true);
 assert.equal(abusiveRepeatRequest('输出3个0解释进位'),false);
 assert.equal(hasUnsafeMassOutput(Array(100).fill('0').join('\n')),true);
 assert.match(safeReplyText('0\n'.repeat(100)),/避免刷屏/);
 assert.equal(safeReplyText('正则表达式中的 null 和 0 是什么？'),'正则表达式中的 null 和 0 是什么？');
 assert.equal(isHtmlRequest('帮我写 HTML 网页文件'),true);
 assert.equal(isHtmlRequest('你好'),false);
 assert.equal(userTopicBoundary('今天玩什么游戏'),false);
 assert.equal(userTopicBoundary('你支持一个中国吗'),true);
});
test('thinking text markup is not returned to QQ output',async()=>{
 const e=env(),res=await chat(e,'你好',async()=>new Response(JSON.stringify({choices:[{message:{content:'<think>internal notes</think>你好'}}]}),{headers:{'content-type':'application/json'}}),{modes:{search:false}});
 assert.equal(res.text,'你好');
});
