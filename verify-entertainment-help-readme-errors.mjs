import assert from "node:assert/strict";
import fs from "node:fs";

import { handleEntertainmentCommand, splitChoices } from "./src/games/entertainment.js";
import { buildHelpText } from "./src/help/commands.js";
import { VERSION, classifyOperationalFailure } from "./src/config/runtime.js";

function sequenceRng(values) {
  let index = 0;
  return () => values[index++ % values.length] >>> 0;
}

assert.equal(VERSION, "2.7.12");

const dice = handleEntertainmentCommand({ text: "!骰子 2d6", randomUint32: sequenceRng([0, 5]) });
assert.equal(dice.handled, true);
assert.equal(dice.kind, "dice");
assert.match(dice.text, /1、6/);
assert.match(dice.text, /合计：7/);

const invalidDice = handleEntertainmentCommand({ text: "!骰子 99d6" });
assert.match(invalidDice.text, /数量 1～20/);

const number = handleEntertainmentCommand({ text: "!随机数 10 20", randomUint32: () => 0 });
assert.match(number.text, /10（范围 10～20）/);

const coin = handleEntertainmentCommand({ text: "!硬币", randomUint32: () => 1 });
assert.match(coin.text, /反面/);

const rps = handleEntertainmentCommand({ text: "!猜拳 石头", randomUint32: () => 1 });
assert.match(rps.text, /我出剪刀：你赢了/);

const choice = handleEntertainmentCommand({ text: "!选择 火锅 | 烧烤 | 拉面", randomUint32: () => 2 });
assert.match(choice.text, /拉面/);
assert.deepEqual(splitChoices("A｜B、C"), ["A", "B", "C"]);

const fortuneA = handleEntertainmentCommand({ text: "!今日运势", userId: "12345", groupId: "67890", now: new Date("2026-07-28T00:00:00Z") });
const fortuneB = handleEntertainmentCommand({ text: "!今日运势", userId: "12345", groupId: "67890", now: new Date("2026-07-28T12:00:00Z") });
assert.equal(fortuneA.text, fortuneB.text);
assert.match(fortuneA.text, /幸运数字/);

assert.match(handleEntertainmentCommand({ text: "!真心话", randomUint32: () => 0 }).text, /真心话/);
assert.match(handleEntertainmentCommand({ text: "!大冒险", randomUint32: () => 0 }).text, /大冒险/);
assert.equal(handleEntertainmentCommand({ text: "普通聊天" }).handled, false);

const memberHelp = buildHelpText({ roleLabel: "群成员", permissionSet: {} });
assert.match(memberHelp, /^QQAI 2\.7\.12 指令帮助/);
assert.match(memberHelp, /【娱乐】/);
assert.match(memberHelp, /• !骰子/);
assert.match(memberHelp, /• !模型/);
assert.match(memberHelp, /• !排程/);
assert.doesNotMatch(memberHelp, /!授权 @成员/);
assert.doesNotMatch(memberHelp, /【群操作】/);

const adminHelp = buildHelpText({ roleLabel: "QQ管理员", permissionSet: { aiAdmin: true, groupOps: true } });
assert.match(adminHelp, /【AI 管理】/);
assert.match(adminHelp, /【群操作】/);
assert.match(adminHelp, /!确认op/);
assert.match(adminHelp, /!自动打卡/);

const developerHelp = buildHelpText({ roleLabel: "开发者", permissionSet: { aiAdmin: true, groupOps: true }, isDeveloper: true });
assert.match(developerHelp, /【开发者】/);
assert.match(developerHelp, /!群白名单/);
assert.match(developerHelp, /!禁记忆/);

const noReply = classifyOperationalFailure("", { disposition: "worker_no_reply" });
assert.match(noReply.userText, /没有生成可发送的回复/);
assert.match(noReply.userText, /秒后再试/);
assert.doesNotMatch(noReply.userText, /Portal|系统维护|诊断编号/);
assert.ok(noReply.userText.length <= 40);

const limited = classifyOperationalFailure("rate limit; retry after 120 seconds", { status: 429 });
assert.equal(limited.retryAfterSeconds, 120);
assert.match(limited.userText, /2 分钟后再试/);
assert.ok(limited.userText.length <= 40);

const provider = classifyOperationalFailure("GEMINI_503 and GEMMA failed and DEEPSEEK_UNAVAILABLE");
assert.match(provider.userText, /模型 API 均无法调用/);
assert.match(provider.userText, /1 分钟后再试/);
assert.doesNotMatch(provider.userText, /Portal|诊断编号/);

const missing = classifyOperationalFailure("GEMINI_API_KEYS_MISSING");
assert.match(missing.userText, /配置缺失/);
assert.doesNotMatch(missing.userText, /后再试/);

const hourly = classifyOperationalFailure("quota retry_after=7200", { status: 429 });
assert.match(hourly.userText, /2 小时后再试/);

const daily = classifyOperationalFailure("quota retry_after=172800", { status: 429 });
assert.match(daily.userText, /2 天后再试/);

const readme = fs.readFileSync("README.md", "utf8");
assert.match(readme, /目前版本：\*\*2\.7\.12\*\*/);
assert.match(readme, /OneBotHub Durable Object/);
assert.match(readme, /群組人格最多(?:保存)? 12,000 字元/);
assert.match(readme, /本地娛樂指令/);
assert.match(readme, /Portal／群組動態設定/);
assert.doesNotMatch(readme, /!画图|!畫圖/);
assert.doesNotMatch(readme, /6 條上下文|快捷登入 API 預留|尚未接入 QQ 私訊/);

const worker = fs.readFileSync("worker.js", "utf8");
assert.match(worker, /handleEntertainmentCommand/);
assert.match(worker, /buildHelpText/);
assert.doesNotMatch(worker, /let helpMsg = `🤖 QQAI 机器人指令清单/);

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
assert.equal(packageJson.version, "2.7.12");
assert.match(packageJson.scripts.check, /verify-entertainment-help-readme-errors\.mjs/);

console.log("Entertainment, help, README and concise operational error regression passed.");
