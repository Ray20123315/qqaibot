import fs from 'node:fs';

const path = 'tools/apply-v231.mjs';
let source = fs.readFileSync(path, 'utf8');
const pattern = /            await callOneBotAction\(env, \{ action: 'send_group_msg', params: \{ group_id: numericId\(currentGroupId\), message: .*?, auto_escape: false \} \}, 12000\)\.catch\(\(\) => \{\}\);/;
if (!pattern.test(source)) throw new Error('Unable to locate nested notification template in v2.3.1 patcher');
source = source.replace(pattern, "            await callOneBotAction(env, { action: 'send_group_msg', params: { group_id: numericId(currentGroupId), message: '[CQ:at,qq=' + targetId + '] ' + hint + ' 已按剩余时间重新禁言；后续重复尝试不再发送提示。', auto_escape: false } }, 12000).catch(() => {});");

if (!source.includes('const selfMuteBlockStart = workerBeforeMove.indexOf')) {
  const anchor = "\nwrite('verify-self-mute-reapply.mjs'";
  if (!source.includes(anchor)) throw new Error('Unable to locate verification writer in v2.3.1 patcher');
  const moveCode = `
const workerBeforeMove = read('worker.js');
const selfMuteBlockStart = workerBeforeMove.indexOf('      // 群友可直接禁言自己；');
const selfMuteBlockEnd = workerBeforeMove.indexOf('      // 高影响群操作统一', selfMuteBlockStart);
if (selfMuteBlockStart < 0 || selfMuteBlockEnd <= selfMuteBlockStart) throw new Error('Unable to locate self-mute command block');
const selfMuteBlock = workerBeforeMove.slice(selfMuteBlockStart, selfMuteBlockEnd);
const workerWithoutSelfMute = workerBeforeMove.slice(0, selfMuteBlockStart) + workerBeforeMove.slice(selfMuteBlockEnd);
const rateLimitAnchor = '      // ⏳ Cloudflare 原生速率限制器';
const rateLimitIndex = workerWithoutSelfMute.indexOf(rateLimitAnchor);
if (rateLimitIndex < 0) throw new Error('Unable to locate runtime rate-limit anchor');
write('worker.js', workerWithoutSelfMute.slice(0, rateLimitIndex) + selfMuteBlock + workerWithoutSelfMute.slice(rateLimitIndex));
`;
  source = source.replace(anchor, moveCode + anchor);
}

fs.writeFileSync(path, source);
console.log('v2.3.1 patcher quoting and command order fixed');
