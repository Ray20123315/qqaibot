import test from "node:test";
import assert from "node:assert/strict";
import {generateWithCodexPreference} from "../src/codex-bridge.js";

const messages=[{role:"user",content:"你好"}];
test("an online local Codex Bridge never overrides default Gemini",async()=>{
 const original=globalThis.fetch;
 let codexCalls=0,geminiCalls=0;
 try{
  globalThis.fetch=async(url)=>{
   assert.match(String(url),/generativelanguage\.googleapis\.com/);
   geminiCalls++;
   return new Response(JSON.stringify({candidates:[{content:{parts:[{text:"Gemini 答覆"}]}}]}),{status:200});
  };
  const env={GEMINI_API_KEYS:"test-key",ONEBOT_HUB:{
   idFromName:()=>("hub"),get:()=>({fetch:async()=>{codexCalls++;return new Response(JSON.stringify({connected:true}),{status:200});}})
  }};
  const result=await generateWithCodexPreference(env,{provider:"gemini",messages});
  assert.equal(result.text,"Gemini 答覆");
  assert.equal(result.provider,"gemini");
  assert.equal(geminiCalls,1);
  assert.equal(codexCalls,0);
 }finally{globalThis.fetch=original;}
});

test("Gemini service failure never automatically spends Luna resources without guarded fallback",async()=>{
 const original=globalThis.fetch;let codexCalls=0;
 try{
  globalThis.fetch=async()=>new Response("server busy",{status:503});
  const env={GEMINI_API_KEYS:"test-key",CODEX_LUNA_FALLBACK_ENABLED:"true",ONEBOT_HUB:{
   idFromName:()=>("hub"),get:()=>({fetch:async()=>{codexCalls++;throw Error("bridge must not be contacted");}})
  }};
  await assert.rejects(generateWithCodexPreference(env,{provider:"gemini",messages}),/MODEL_/);
  assert.equal(codexCalls,0);
 }finally{globalThis.fetch=original;}
});
