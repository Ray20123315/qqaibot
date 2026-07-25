import fs from 'node:fs';

{
  const path = 'worker.js';
  let source = fs.readFileSync(path, 'utf8');
  const before = '当前群没有可用表情，管理员可在 Portal「群友列表 → 表情库」添加。';
  const after = '当前群没有可用表情，管理员可在 Portal「群友列表 → 表情库」添加。使用格式：!表情 分类。';
  if (!source.includes(before)) throw new Error('Missing generated sticker help anchor');
  source = source.replace(before, after);
  fs.writeFileSync(path, source);
}

{
  const path = 'verify-portal-members-client.mjs';
  let source = fs.readFileSync(path, 'utf8');
  const before = "assert(match[1].includes('syncNav();if(isMembersView())setTimeout(loadMembers,0);'), 'Member console must initialize when already active');";
  const after = "assert(match[1].includes('if(isMembersView())setTimeout(loadMembers,0);'), 'Member console must initialize when already active');\nassert(!match[1].includes('syncNav()'), 'Injected member client must not hide navigation by guessing private session state');";
  if (!source.includes(before)) throw new Error('Missing legacy member initialization assertion');
  source = source.replace(before, after);
  fs.writeFileSync(path, source);
}

console.log('Community suite compatibility fixes applied');
