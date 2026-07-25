import fs from 'node:fs';

function replaceOnce(path, search, replacement) {
  const source = fs.readFileSync(path, 'utf8');
  if (!source.includes(search)) throw new Error(`Missing review anchor in ${path}`);
  fs.writeFileSync(path, source.replace(search, replacement));
}

replaceOnce('worker.js',
  '        const masterId = takeMemberCommand ? userId : targetId;\n        const memberId = takeMemberCommand ? targetId : userId;\n        if (memberId === relationshipDeveloperId || memberId === String(botId || "")) return jsonReply(`${atSender}核心开发者与机器人不能成为所属成员。`);',
  '        const masterId = takeMemberCommand ? userId : targetId;\n        const memberId = takeMemberCommand ? targetId : userId;\n        if (masterId === String(botId || "") || memberId === String(botId || "")) return jsonReply(`${atSender}机器人不能成为主人关系的任何一方。`);\n        if (memberId === relationshipDeveloperId) return jsonReply(`${atSender}核心开发者不能成为所属成员，但可以成为主人。`);');
replaceOnce('verify-master-bindings.mjs',
  "assert(worker.includes('所属成员必须是当前普通群成员'), 'Subordinate eligibility must exclude management and system accounts');",
  "assert(worker.includes('所属成员必须是当前普通群成员'), 'Subordinate eligibility must exclude management and system accounts');\nassert(worker.includes('masterId === String(botId || \"\")'), 'The bot account must be rejected before a master relationship request is created');");
console.log('v2.4.0 review hardening applied');
