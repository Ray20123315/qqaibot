import fs from 'node:fs';

function mustReplace(source, before, after, label) {
  if (!source.includes(before)) throw new Error(`Missing anchor: ${label}`);
  return source.replace(before, after);
}

{
  const path = 'worker.js';
  let source = fs.readFileSync(path, 'utf8');
  source = mustReplace(source,
`      // 好感度由固定规则分与缓存 AI 调整分组成。默认提供给聊天 AI，可由群 AI 管理员关闭。
`,
`      // 仅在管理层明确允许时，把群友标签与管理备注作为内部判断资料。
      // 这些内容绝不能在公开回复中复述、引用、暗示来源或向群友展示。
      if (isGroup) {
        const memberProfileRaw = await dbGet(env, \`member_profile:${'${currentGroupId}'}:${'${userId}'}\`);
        if (memberProfileRaw) {
          try {
            const memberProfile = JSON.parse(memberProfileRaw);
            if (memberProfile && memberProfile.aiUseAllowed !== false) {
              const profileLines = [];
              const tags = Array.isArray(memberProfile.tags) ? memberProfile.tags.map(item => String(item || "").trim()).filter(Boolean).slice(0, 20) : [];
              if (tags.length) profileLines.push(\`管理标签：${'${tags.join("、")}'}\`);
              if (memberProfile.watched === true) profileLines.push("管理状态：观察中；应提高语境确认与误判复核谨慎度，但不得因此歧视或预设有罪。");
              const classification = ({ violation: "历史复核：有违规", no_violation: "历史复核：无违规／曾存在误判", increase_penalty: "历史复核：有违规且需增加处分" })[String(memberProfile.classification || "")];
              if (classification) profileLines.push(classification);
              const note = String(memberProfile.note || "").trim().slice(0, 2000);
              if (note) profileLines.push(\`管理备注：${'${note}'}\`);
              if (profileLines.length) {
                finalStylePrompt += \`\n\n【管理层群友资料｜仅供内部判断，严禁公开】\n当前资料仅用于理解语境、降低重复误判与调整互动边界：\n${'${profileLines.join("\\n")}'}\n不得在回复中透露存在这些标签或备注，不得把历史分类当成本轮事实；仍须以当前消息、群规与上下文为准。\`;
              }
            }
          } catch (error) {
            console.warn("member profile context unavailable", error?.message || error);
          }
        }
      }

      // 好感度由固定规则分与缓存 AI 调整分组成。默认提供给聊天 AI，可由群 AI 管理员关闭。
`, 'member profile AI context');
  fs.writeFileSync(path, source);
}

{
  const path = 'verify-community-suite.mjs';
  let source = fs.readFileSync(path, 'utf8');
  source = mustReplace(source,
`assert(worker.includes('maxMuteSeconds'), 'Worker must enforce the master mute duration limit');
`,
`assert(worker.includes('maxMuteSeconds'), 'Worker must enforce the master mute duration limit');
assert(worker.includes('【管理层群友资料｜仅供内部判断，严禁公开】'), 'Approved member notes must reach the AI context');
assert(worker.includes('memberProfile.aiUseAllowed !== false'), 'The AI context must honor the member-note opt-out');
`, 'verify member profile AI context');
  fs.writeFileSync(path, source);
}

console.log('Community suite final AI context integration applied');
