import fs from 'node:fs';

const path = 'tools/apply-v231.mjs';
let source = fs.readFileSync(path, 'utf8');
const pattern = /            await callOneBotAction\(env, \{ action: 'send_group_msg', params: \{ group_id: numericId\(currentGroupId\), message: .*?, auto_escape: false \} \}, 12000\)\.catch\(\(\) => \{\}\);/;
if (!pattern.test(source)) throw new Error('Unable to locate nested notification template in v2.3.1 patcher');
source = source.replace(pattern, "            await callOneBotAction(env, { action: 'send_group_msg', params: { group_id: numericId(currentGroupId), message: '[CQ:at,qq=' + targetId + '] ' + hint + ' 已按剩余时间重新禁言；后续重复尝试不再发送提示。', auto_escape: false } }, 12000).catch(() => {});");
fs.writeFileSync(path, source);
console.log('v2.3.1 patcher quoting fixed');
