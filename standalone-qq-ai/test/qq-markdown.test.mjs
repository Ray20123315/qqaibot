import test from 'node:test';
import assert from 'node:assert/strict';
import {markdownForQQ,markdownToPlainText,markdownPayload,plainPayload,rejectedMarkdown} from '../qq-format.js';
import {getConfig,chat,CUSTOMER_SERVICE_PROMPT} from '../role-router.js';
test('QQ Markdown delivers actual first/second-level headings and ordered list',()=>{
 const raw='功能介紹\n\n1. 聊天\n2. 上網\n3. 語音';
 const md=markdownPayload(raw,'incoming-msg');
 assert.equal(md.msg_type,2);
 assert.equal(md.content,' ');
 assert.match(md.markdown.content,/^# 功能介紹/m);
 assert.match(md.markdown.content,/^1\. 聊天/m);
 assert.equal(md.msg_id,'incoming-msg');
});
test('QQ plain fallback removes raw Markdown markers and preserves paragraphs/lists',()=>{
 const rich='# 功能\n\n## 第二層\n\n1. **搜尋**\n2. **聊天**\n\n參考 [官方](https://example.com)';
 const plain=plainPayload(rich,'in-1',2);
 assert.equal(plain.msg_type,0);assert.equal(plain.msg_seq,2);
 assert.match(plain.content,/【功能】/);
 assert.match(plain.content,/【第二層】/);
 assert.match(plain.content,/1\. 搜尋/);
 assert.doesNotMatch(plain.content,/^#|[*]{2}|## /m);
 assert.match(plain.content,/參考 官方/);
});
test('QQ retry only after definite markdown 4xx or provider business rejection',()=>{
 assert.equal(rejectedMarkdown({status:400},''),true);
 assert.equal(rejectedMarkdown({status:403},''),true);
 assert.equal(rejectedMarkdown({status:500},''),false);
 assert.equal(rejectedMarkdown(null,''),false);
 assert.equal(rejectedMarkdown({status:200},'304000'),true);
});
test('even previous persisted false webSearch settings are upgraded to always-on',async()=>{
 const stored=new Map([['selected-model-v2','chat-model'],['model-roles-v3',JSON.stringify({chat:'chat-model',asr:null,tts:null,webSearch:false})]]);
 const env={UNSLOTH_API_KEY:'fake-test-key',CONFIG_KV:{get:async k=>stored.get(k)||null}};
 const settings=await getConfig(env);
 assert.equal(settings.webSearch,true);
 const value=await chat(env,'你好',async(url,opts)=>{
  assert.equal(url,'https://msiai.ray2025.com/v1/chat/completions');
  const request=JSON.parse(opts.body);
  assert.equal(request.enable_tools,true);
  assert.deepEqual(request.enabled_tools,['web_search']);
  assert.equal(request.mcp_enabled,false);
  assert.ok(!('tools' in request));
  assert.equal(request.stream,true);
  assert.match(request.messages[0].content,/每次回答都先尝试使用 web_search/);
  assert.match(request.messages[0].content,/所有面向用户的回复必须使用简体中文/);
  assert.match(request.messages[0].content,/自动客服与日常聊天助手/);
  return new Response(JSON.stringify({choices:[{message:{content:'你好'}}]}),{headers:{'content-type':'application/json'}});
 });
 assert.equal(value.text,'你好');
 assert.equal(value.searched,false);
});

test('customer service persona allows friendly chat but does not proactively disclose the model',()=>{
 assert.match(CUSTOMER_SERVICE_PROMPT,/客服与日常聊天助手/);
 assert.match(CUSTOMER_SERVICE_PROMPT,/自然交流、闲聊/);
 assert.match(CUSTOMER_SERVICE_PROMPT,/简体中文/);
 assert.match(CUSTOMER_SERVICE_PROMPT,/不得主动提及或宣传底层 AI 模型/);
 assert.match(CUSTOMER_SERVICE_PROMPT,/如果用户直接询问，诚实回答/);
 assert.match(CUSTOMER_SERVICE_PROMPT,/不得编造订单状态/);
 assert.doesNotMatch(CUSTOMER_SERVICE_PROMPT,/Qwen3\.5-9B|Flint|Qwen3-TTS/);
});
