import fs from "node:fs";
const read = p => fs.readFileSync(p, "utf8");
const write = (p, s) => fs.writeFileSync(p, s);
function replaceOnce(source, search, replacement, label) {
  const next = source.replace(search, replacement);
  if (next === source) throw new Error(`replacement failed: ${label}`);
  return next;
}

let worker = read("worker.js");
worker = replaceOnce(
  worker,
  `const POLITICAL_TOPIC_PATTERN = /(?:政治|政党|政黨|选举|選舉|总统|總統|国会|國會|立法院|立法委员|立法委員|立委|议员|議員|首相|总理|總理|内阁|內閣|政权|政權|政治人物|政治制度|公共政策|民进党|民進黨|国民党|國民黨|共产党|共產黨|民主党|民主黨|共和党|共和黨|两岸政治|兩岸政治|罢免|罷免|公投|\\b(?:politics|political|election|parliament|congress)\\b)/i;`,
  `const POLITICAL_TOPIC_PATTERN = /(?:政治|政党|政黨|选举|選舉|总统|總統|主席|国会|國會|立法院|立法委员|立法委員|立委|议员|議員|首相|总理|總理|内阁|內閣|政府|政权|政權|执政|執政|在野|政治人物|政治制度|公共政策|外交|制裁|领土争议|領土爭議|两岸|兩岸|统一|統一|台独|台獨|罢免|罷免|公投|意识形态|意識形態|民进党|民進黨|国民党|國民黨|共产党|共產黨|民主党|民主黨|共和党|共和黨|\\b(?:politics|political|election|government|parliament|congress|president|prime minister)\\b)/i;`,
  "broaden worker political pattern"
);
worker = replaceOnce(
  worker,
  `        // 构建深层模仿 Prompt，并将其写入群组全域人格\n        const mimicPrompt = \`【最高指令：灵魂模仿】请仔细分析以下用户的历史发言。接下来，你需要完全舍弃原本的AI人格，彻底模仿这个人的口癖、语气、语言习惯和性格特征来回复群聊。绝不可暴露你是AI。模仿对象的历史语料如下：\\n\${logs.slice(-15).join('\\n')}\`;\n        \n        await dbPut(env, \`group_persona:\${currentGroupId}\`, mimicPrompt);\n        await dbPut(env, \`mimic_target:\${currentGroupId}\`, targetQq);`,
  `        // 模仿只保存覆盖层目标，不再覆盖管理员原本保存的群组人格。\n        await dbPut(env, \`mimic_target:\${currentGroupId}\`, targetQq);`,
  "preserve group persona when mimic enabled"
);
write("worker.js", worker);

let moderation = read("src/moderation/runtime.js");
moderation = replaceOnce(
  moderation,
  `  if (remaining > 0) return updateRuleViolationRecord(env, item, { actionTaken: "cooldown", actionResult: \`处置冷却剩余 \${remaining} 秒；本次仍已记录\`, strikeCounted: false });`,
  `  if (remaining > 0 && !warningOnlyRacial) return updateRuleViolationRecord(env, item, { actionTaken: "cooldown", actionResult: \`处置冷却剩余 \${remaining} 秒；本次仍已记录\`, strikeCounted: false });`,
  "racial warning bypasses punishment cooldown"
);
write("src/moderation/runtime.js", moderation);

let test = read("verify-politics-racism-persona.mjs");
test = replaceOnce(
  test,
  `assert.equal(isPoliticalModerationTopic("民进党和国民党正在讨论什么"), true);`,
  `assert.equal(isPoliticalModerationTopic("民进党和国民党正在讨论什么"), true);\nassert.equal(isPoliticalModerationTopic("政府外交制裁政策"), true);`,
  "political coverage test"
);
test = replaceOnce(
  test,
  "assert.match(worker, /political_topic_silence/);",
  "assert.match(worker, /political_topic_silence/);\nassert.match(worker, /政府\\|政权.*外交\\|制裁/);\nassert.doesNotMatch(worker, /dbPut\\(env, `group_persona:\\$\\{currentGroupId\\}`, mimicPrompt\\)/);",
  "worker followup invariants"
);
test = replaceOnce(
  test,
  `assert.match(moderation, /warningOnlyRacial/);`,
  `assert.match(moderation, /warningOnlyRacial/);\nassert.match(moderation, /remaining > 0 && !warningOnlyRacial/);`,
  "cooldown invariant"
);
write("verify-politics-racism-persona.mjs", test);
console.log("apply-v2.7.10-followup: complete");
