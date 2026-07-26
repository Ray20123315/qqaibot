import fs from 'node:fs';
import {
  oneBotBotMentionCount,
  oneBotEventIsBareMention,
  oneBotEventIsPunctuationOnly,
  socialInputDelayMs
} from './src/social/runtime.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const singleBareMention = {
  post_type: 'message', message_type: 'group', self_id: '20002', user_id: '10001',
  message: [{ type: 'at', data: { qq: '20002' } }]
};
const duplicateBareMention = {
  post_type: 'message', message_type: 'group', self_id: '20002', user_id: '10001',
  message: [
    { type: 'at', data: { qq: '20002' } },
    { type: 'at', data: { qq: '20002' } }
  ]
};
const semanticQuestion = {
  post_type: 'message', message_type: 'group', self_id: '20002', user_id: '10001',
  message: [
    { type: 'at', data: { qq: '20002' } },
    { type: 'text', data: { text: ' 这个功能为什么没有回复？' } }
  ]
};
const punctuationQuestion = {
  post_type: 'message', message_type: 'group', self_id: '20002', user_id: '10001',
  message: [
    { type: 'at', data: { qq: '20002' } },
    { type: 'text', data: { text: '？？？' } }
  ]
};

assert(oneBotBotMentionCount(singleBareMention) === 1, 'Single bot mention must count as one');
assert(oneBotBotMentionCount(duplicateBareMention) === 2, 'Duplicate bot mentions must remain distinguishable');
assert(oneBotEventIsBareMention(singleBareMention), 'A single bare mention must keep follow-up aggregation');
assert(!oneBotEventIsBareMention(duplicateBareMention), 'Duplicate mentions must not open a bare-mention continuation buffer');
assert(oneBotEventIsPunctuationOnly(punctuationQuestion), 'Punctuation-only direct messages must be recognized as low-value interactions');
assert(!oneBotEventIsPunctuationOnly(semanticQuestion), 'Semantic text questions must not be classified as punctuation-only');
assert(socialInputDelayMs([semanticQuestion]) < socialInputDelayMs([punctuationQuestion]), 'Semantic direct questions must flush before punctuation-only interactions');
assert(socialInputDelayMs([semanticQuestion]) <= 600, 'Semantic direct questions must not wait through the old full debounce window');

const worker = fs.readFileSync('worker.js', 'utf8');
assert(worker.includes('__qqai_explicit_question: true'), 'Durable Object must mark validated explicit questions');
assert(worker.includes('__qqai_force_explicit_reply: true'), 'Explicit 204 responses must trigger a forced retry');
assert(worker.includes('explicitQuestion && semanticQuestion && safeRetry'), 'Forced 204 retry must be limited to side-effect-free chat');
assert(worker.includes('worker_no_reply'), 'A second explicit 204 must produce a visible failure path');
assert(worker.includes('duplicate_mention_noise'), 'Duplicate mention noise must be rejected before model processing');
assert(worker.includes('setTimeout(resolve, 1800)'), 'Slow semantic questions must receive delayed visible progress');
assert(worker.includes('processingFinished = true'), 'Delayed indicators must be cancelled or retracted when processing finishes');
assert(worker.includes('oneBotEventHasMedia(body));'), 'Worker content validation must recognize native face/media payloads');

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
assert(pkg.version === '2.7.1', 'Package version must be 2.5.2');
assert(pkg.scripts.check.includes('verify-explicit-question-priority.mjs'), 'Priority regression test must run in the permanent suite');

console.log('verify-explicit-question-priority: ok');
