import test from "node:test";
import assert from "node:assert/strict";
import {answer} from "../src/bridge.js";
import {BRIDGE_ECHO_MARKER} from "../src/core.js";
test("invalid passive reply msg_id 40034024 retries once without msg_id",async()=>{
 const calls=[];
 const send=async(env,group,text,id)=>{
  calls.push({group,text,id});
  if(calls.length===1)throw Object.assign(new Error("请求参数msg_id无效或越权"),{code:40034024,status:400});
  return {id:"sent"};
 };
 const result=await answer({},"group_openid","代碼：123","bad_msg_id",send);
 assert.equal(result,true);
 assert.equal(calls.length,2);
 assert.equal(calls[0].id,"bad_msg_id");
 assert.equal(calls[1].id,undefined);
 assert.equal(calls[0].text,calls[1].text);
 assert.ok(calls[0].text.endsWith(BRIDGE_ECHO_MARKER));
});
test("normal passive reply should send only once",async()=>{
 let count=0;
 const result=await answer({},"g","hello","good_msg_id",async()=>{count++;});
 assert.equal(result,true);assert.equal(count,1);
});
test("network or server failure is ambiguous and must not trigger an extra send",async()=>{
 let count=0;
 const result=await answer({},"g","hello","msg_id",async()=>{
  count++;throw Object.assign(new Error("gateway timeout"),{status:503});
 });
 assert.equal(result,false);assert.equal(count,1);
});
test("proactive fallback denied => fail once, not retry indefinitely",async()=>{
 let count=0;
 const result=await answer({},"g","hello","bad_msg_id",async()=>{
  count++;
  if(count===1)throw Object.assign(new Error("invalid id"),{code:40034024,status:400});
  throw Object.assign(new Error("proactive denied"),{code:22009,status:403});
 });
 assert.equal(result,false);assert.equal(count,2);
});
