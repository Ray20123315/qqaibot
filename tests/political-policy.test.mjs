import test from "node:test";
import assert from "node:assert/strict";
import {isPoliticalTopic,politicalSafeReply,POLITICAL_REFUSAL,POLITICAL_SYSTEM_RULE} from "../src/topic-policy.js";

test("identifies typical political subjects in Traditional/Simplified Chinese and English",()=>{
 for(const phrase of [
  "政 治", "國會選舉", "民進黨和國民黨", "立委罷免", "两岸关系", "政权更替",
  "習近平", "賴清德", "川普", "Donald Trump", "Who will win the election?",
  "Political party manifestos", "What does the prime minister say?"
 ])assert.equal(isPoliticalTopic(phrase),true,phrase);
});
test("ordinary study, food, sports and software discussions remain allowed",()=>{
 for(const phrase of [
  "你會寫 JavaScript 嗎？", "推薦午餐菜單", "這張圖片很漂亮",
  "What is the best laptop?", "今天幾點下課", "投票選哪種披薩口味"
 ])assert.equal(isPoliticalTopic(phrase),false,phrase);
});
test("political generated text is never directly shown; normal content remains unchanged",()=>{
 assert.equal(politicalSafeReply("這個政府的政策值得支持"),POLITICAL_REFUSAL);
 assert.equal(politicalSafeReply("The president should endorse this party"),POLITICAL_REFUSAL);
 assert.equal(politicalSafeReply("可以在 Python 中使用 dataclasses。"),"可以在 Python 中使用 dataclasses。");
 assert.match(POLITICAL_SYSTEM_RULE,/不要討論政治/);
});
