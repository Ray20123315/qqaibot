import assert from "node:assert/strict";
import fs from "node:fs";

const worker = fs.readFileSync("worker.js", "utf8");
const help = fs.readFileSync("src/help/commands.js", "utf8");
const readme = fs.readFileSync("README.md", "utf8");
const config = fs.readFileSync("src/config/runtime.js", "utf8");

assert.doesNotMatch(worker, /handleBilibiliWebhook|\/api\/integrations\/bilibili\/webhook\//);
assert.doesNotMatch(worker, /(?:会议纪要|會議紀要|吃瓜|好感度注入|好感度上下文|狼人杀|狼人殺)/);
assert.doesNotMatch(worker, /语音智能对答|語音智能對答/);
assert.match(worker, /qqai\.qq-interactions 插件；Beta 預設關閉/);
assert.match(worker, /Provider 帐号/);
assert.match(worker, /qqai\.auto-checkin 插件每日执行/);
assert.doesNotMatch(help, /!语音 问题|!語音 問題/);
assert.match(help, /语音回复 Beta：默认关闭/);
assert.doesNotMatch(readme, /AUTO_CHECKIN_CONCURRENCY|!群打卡|OneBot 與手動群打卡/);
assert.match(readme, /qqai\.auto-checkin/);
assert.match(config, /PLATFORM_FEATURE_COUNT = PLATFORM_FEATURES\.length/);
assert.doesNotMatch(config, /const PLATFORM_FEATURE_COUNT = 300/);

console.log("verify-v3-transition-cleanup: ok");
