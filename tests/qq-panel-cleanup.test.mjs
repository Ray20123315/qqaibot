import test from "node:test";
import assert from "node:assert/strict";
import {cleanupRetiredQQCommands,isObsoleteQQCommand} from "../src/qq-panel-cleanup.js";

test("exact obsolete QQ command and description are detected, unrelated commands untouched",()=>{
 assert.equal(isObsoleteQQCommand({type:"command",name:"/!设置插话率",desc:"查看主动插话暂停状态"}),true);
 assert.equal(isObsoleteQQCommand({type:"command",name:"设置插话率"}),true);
 assert.equal(isObsoleteQQCommand({type:"command",name:"正常命令",desc:"查看主动插话暂停状态"}),false);
 assert.equal(isObsoleteQQCommand({type:"command",name:"帮助",desc:"使用说明"}),false);
 assert.equal(isObsoleteQQCommand({type:"link",name:"设置插话率"}),false);
});
test("only stale panel item is removed; neighboring commands and metadata survive",async()=>{
 let submitted;
 const fake=async(url,options={})=>{
  if(url.includes("getAppAccessToken"))return Response.json({access_token:"dummy",expires_in:3600});
  if(url.includes("/v2/panels?"))return Response.json({records:[{panel_id:"p_test_123",panel:{version:3,remark:"群聊",items:[
   {type:"command",name:"/!设置插话率",desc:"查看主动插话暂停状态"},
   {type:"command",name:"/help",desc:"指令說明",only_admin:false}
  ]}}],is_end:true});
  assert.equal(options.method,"PUT");
  assert.match(url,/\/v2\/panels\/p_test_123$/);
  submitted=JSON.parse(options.body);
  return Response.json({version:4});
 };
 const report=await cleanupRetiredQQCommands({QQ_OPEN_APP_ID:"app",QQ_OPEN_CLIENT_SECRET:"secret"},{
  fetchImpl:fake,scopes:["group"]
 });
 assert.deepEqual(report,{scopes:["group"],removed:1,updated:1,deleted:0,examined:1});
 assert.equal(submitted.panel.items.length,1);
 assert.equal(submitted.panel.items[0].name,"/help");
 assert.equal(submitted.panel.remark,"群聊");
});
test("an obsolete-only command panel is deleted, not replaced by fabricated commands",async()=>{
 let removed=false;
 const fake=async(url,options={})=>{
  if(url.includes("getAppAccessToken"))return Response.json({access_token:"dummy",expires_in:3600});
  if(url.includes("?scope="))return Response.json({records:[{panel_id:"only_stale",panel:{items:[{type:"command",name:"设置插话率"}]}}],is_end:true});
  removed=options.method==="DELETE";return new Response(null,{status:204});
 };
 const report=await cleanupRetiredQQCommands({QQ_OPEN_APP_ID:"app",QQ_OPEN_CLIENT_SECRET:"secret"},{fetchImpl:fake,scopes:["c2c"]});
 assert.equal(report.deleted,1);
 assert.equal(removed,true);
});
test("no match does not modify QQ command panels",async()=>{
 let wrote=false;
 const fake=async(url,options={})=>{
  if(url.includes("getAppAccessToken"))return Response.json({access_token:"dummy",expires_in:3600});
  if(options.method&&options.method!=="GET")wrote=true;
  return Response.json({records:[{panel_id:"a",panel:{items:[{type:"command",name:"/help"}]}}],is_end:true});
 };
 const report=await cleanupRetiredQQCommands({QQ_OPEN_APP_ID:"app",QQ_OPEN_CLIENT_SECRET:"secret"},{fetchImpl:fake,scopes:["group"]});
 assert.equal(report.removed,0);assert.equal(wrote,false);
});
