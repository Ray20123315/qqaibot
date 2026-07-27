import assert from "node:assert/strict";
import fs from "node:fs";
import { detectExplicitRacialDiscrimination, isPoliticalModerationTopic } from "./src/moderation/runtime.js";
import { buildSocialPromptBlock } from "./src/social/runtime.js";

assert.equal(isPoliticalModerationTopic("总统选举与公共政策应该怎么评价"), true);
assert.equal(isPoliticalModerationTopic("民进党和国民党正在讨论什么"), true);
assert.equal(isPoliticalModerationTopic("法国在哪里"), false);
assert.equal(Boolean(detectExplicitRacialDiscrimination("黑人是最低贱的")), true);
assert.equal(Boolean(detectExplicitRacialDiscrimination("不歧视就完蛋了", "上一句正在谈论黑人和白人")), true);
assert.equal(Boolean(detectExplicitRacialDiscrimination("棉花种植园", "刚才有人把黑人说成农具")), true);
assert.equal(Boolean(detectExplicitRacialDiscrimination("我最接受不了黑人印度人")), true);
assert.equal(detectExplicitRacialDiscrimination("反对种族歧视，别再说黑人低等"), null);

const worker = fs.readFileSync("worker.js", "utf8");
const moderation = fs.readFileSync("src/moderation/runtime.js", "utf8");
const auth = fs.readFileSync("src/portal/auth.js", "utf8");
const social = fs.readFileSync("src/social/runtime.js", "utf8");
assert.match(worker, /if \(isPoliticalTopicText\(conversationText\)\)/);
assert.match(worker, /political_topic_silence/);
assert.match(worker, /!isPoliticalTopicText\(cleanMessage\)/);
assert.match(moderation, /politicalTopicSkipped: true/);
assert.match(moderation, /warningOnlyRacial/);
assert.match(moderation, /additionalSpecs = warningOnlyRacial \? \[\]/);
assert.match(moderation, /forceWarning: true/);
assert.match(worker, /群组全局人格｜持续基底/);
assert.match(worker, /personaLayers\.push/);
assert.match(worker, /personaConfigured: hasConfiguredPersona/);
assert.match(auth, /group_persona[^\n]+maxLength: 12000/);
assert.match(auth, /group_persona:\$\{groupId\}[^\n]+slice\(0, 12000\)/);
assert.match(social, /社交统计不得覆盖人格/);
const prompt = buildSocialPromptBlock({
  decision: { sceneType: "casual", action: "reply", outputType: "normal_chat", maxChars: 80, confidence: 1 },
  profile: { style: { samples: 100, averageChars: 8, emojiRate: 1, kaomojiRate: 1 } },
  relationship: null,
  direct: true,
  personaConfigured: true
});
assert.match(prompt, /不能改变人格中的固定称呼、语气、动作描写、分段方式或禁用项/);
assert.match(prompt, /表情、颜文字、动作描写、称呼和段落结构必须服从已配置人格/);
console.log("verify-politics-racism-persona: ok");
