import fs from 'node:fs';
import {
  applySocialOutputPolicy,
  buildSocialPromptBlock,
  oneBotEventHasMedia,
  oneBotEventIsBareMention,
  socialInputDelayMs,
  socialTypingDelayMs
} from './src/social/runtime.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const bareMention = {
  post_type: 'message',
  message_type: 'group',
  group_id: 123456,
  user_id: 10001,
  self_id: 20002,
  message_id: 30003,
  message: [{ type: 'at', data: { qq: '20002' } }]
};
assert(oneBotEventIsBareMention(bareMention), 'Bare @ mention must be recognized for follow-up aggregation');
assert(socialInputDelayMs([bareMention]) >= 3000, 'Bare mention must wait long enough for a following image or short message');
const nativeFace = { message_type: 'group', message: [{ type: 'face', data: { id: '178' } }] };
assert(oneBotEventHasMedia(nativeFace), 'Native QQ face events must count as follow-up payload');

const punctuation = applySocialOutputPolicy({
  text: '这是一个非常完整而且不自然的解释。',
  userText: '？？？',
  decision: { sceneType: 'punctuation', outputType: 'punctuation', action: 'reply', maxChars: 6 },
  profile: null,
  isGroup: true
});
assert(/^[?？]{1,6}$/.test(punctuation), 'Punctuation scene must remain a punctuation response');

const safeTease = applySocialOutputPolicy({
  text: '你妈才是废物😡😡',
  userText: '人工智障',
  decision: { sceneType: 'playful_tease', outputType: 'micro_chat', action: 'tease_back', maxChars: 24 },
  profile: null,
  isGroup: true
});
assert(!/(?:你妈|废物|😡)/.test(safeTease), 'Playful replies must not escalate into family attacks, severe insults or emoji spam');

const prompt = buildSocialPromptBlock({
  decision: { sceneType: 'action_play', outputType: 'action_text', action: 'reply', maxChars: 24, confidence: 0.9 },
  profile: { canon: {}, generatedCanon: {}, style: { samples: 100, averageChars: 9, emojiRate: 0, kaomojiRate: 0, repeatedQuestionRate: 0.2, ellipsisRate: 0.15, actionTextRate: 0.2 } },
  relationship: {},
  direct: true
});
assert(prompt.includes('脑与嘴分离'), 'Social prompt must explicitly separate scene decisions from wording');
assert(prompt.includes('允许只回'), 'Social prompt must allow punctuation and very short human-like forms');
assert(prompt.includes('人格连续性'), 'Social prompt must enforce persistent persona facts');

const delay = socialTypingDelayMs({ text: '这是一条稍微长一点的回复', decision: { outputType: 'normal_chat' }, isGroup: true, direct: true });
assert(delay >= 250 && delay <= 4600, 'Typing delay must remain natural but bounded');

const worker = fs.readFileSync('worker.js', 'utf8');
assert(worker.includes('from "./src/social/runtime.js"'), 'Worker must import the social runtime');
assert(worker.includes('oneBotEventIsBareMention(body)'), 'Bare mentions must enter the existing Durable Object input buffer');
assert(worker.includes('shouldSendSocialBufferNotice'), 'Multi-message waiting notices must be controlled and silent by default');
assert(worker.includes('buildSocialDecision(env'), 'Worker must run the social decision layer before public wording');
assert(worker.includes('applySocialOutputPolicy({'), 'Worker must enforce output shape after model generation');
assert(worker.includes('capturePersonaContinuity(env'), 'Generated persona facts must be persisted for continuity');
assert(worker.includes('const personaContinuity = await capturePersonaContinuity'), 'Persona facts must be locked before the reply is sent');
const socialSource = fs.readFileSync('src/social/runtime.js', 'utf8');
assert(socialSource.includes('social_persona:global'), 'Persona facts must be global across groups and private chat');
assert(socialSource.includes('INSERT OR IGNORE INTO kv_store'), 'First-generated persona facts must use an atomic claim');
const onebotSource = fs.readFileSync('src/onebot/messages.js', 'utf8');
assert(onebotSource.includes('[表情:'), 'Native QQ face IDs must survive text extraction');
assert(worker.includes('waitForSocialTyping({'), 'Group replies must use bounded natural typing delay');
assert(worker.includes('social_thinking_indicator_enabled'), 'Visible thinking indicators must be opt-in for group chat');

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
assert(pkg.version === '2.7.0', 'Package version must be 2.5.2');
assert(pkg.scripts.check.includes('verify-social-digital-twin.mjs'), 'Social regression test must run in the main check suite');

console.log('verify-social-digital-twin: ok');
