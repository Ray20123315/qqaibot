import fs from 'node:fs';

function replaceOnce(text, oldValue, newValue, label) {
  const count = text.split(oldValue).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one match, found ${count}`);
  return text.replace(oldValue, newValue);
}

const moderationPath = 'src/moderation/runtime.js';
let moderation = fs.readFileSync(moderationPath, 'utf8');

const anchor = `async function createJoinRequestAssist(env, body) {\n  const groupId = String(body.group_id || "");\n  const comment = String(body.comment || "");\n  const subType = String(body.sub_type || "add");\n  const patternHash = await joinRequestPatternHash(comment, subType);`;

const replacement = `async function resolveSubgroupJoinFamily(env, groupId) {\n  const id = String(groupId || "").replace(/\\D/g, "");\n  if (!id) return null;\n  const headGroupId = String(await dbGet(env, \`group_family:member:\${id}\`) || "").replace(/\\D/g, "");\n  if (!headGroupId || headGroupId === id) return null;\n  const family = await readJson(env, \`group_family:\${headGroupId}\`, null);\n  if (!family || String(family.headGroupId || "") !== headGroupId) return null;\n  const branch = (Array.isArray(family.branches) ? family.branches : []).find(item => String(item?.groupId || "") === id);\n  if (!branch) return null;\n  return {\n    headGroupId,\n    headAlias: String(family.headAlias || headGroupId),\n    branchAlias: String(branch.alias || id)\n  };\n}\n\n\n\nasync function createJoinRequestAssist(env, body) {\n  const groupId = String(body.group_id || "");\n  const comment = String(body.comment || "");\n  const subType = String(body.sub_type || "add");\n  const subgroupFamily = await resolveSubgroupJoinFamily(env, groupId);\n  const patternHash = await joinRequestPatternHash(comment, subType);\n\n  if (subgroupFamily) {\n    const id = \`jr_\${Date.now().toString(36)}_\${crypto.randomUUID().slice(0, 6)}\`;\n    const item = {\n      id,\n      groupId,\n      userId: String(body.user_id || ""),\n      flag: String(body.flag || ""),\n      subType,\n      comment,\n      patternHash,\n      review: {\n        decision: "direct_approve",\n        riskLevel: "not_applicable",\n        confidence: 1,\n        reason: "分群申请依群组政策直接同意，不经过 AI 审核",\n        family: subgroupFamily\n      },\n      status: "approved_subgroup_direct",\n      createdAt: Date.now()\n    };\n    try {\n      await callOneBotAction(env, { action: "set_group_add_request", params: { flag: item.flag, sub_type: subType, approve: true, reason: "" } }, 15000);\n      await recordJoinPatternDecision(env, groupId, patternHash, comment, "approved");\n      await writeSystemAudit(env, {\n        type: "join_request_subgroup_direct_approved",\n        groupId,\n        actorId: "system:subgroup_join_policy",\n        targetId: item.userId,\n        action: "approve",\n        reason: item.review.reason,\n        headGroupId: subgroupFamily.headGroupId\n      });\n    } catch (error) {\n      item.status = "approve_failed";\n      item.result = String(error?.message || error);\n      await writeSystemAudit(env, {\n        type: "join_request_subgroup_direct_approve_failed",\n        groupId,\n        actorId: "system:subgroup_join_policy",\n        targetId: item.userId,\n        action: "approve_failed",\n        error: item.result,\n        headGroupId: subgroupFamily.headGroupId\n      }).catch(() => {});\n    }\n    await dbPut(env, \`joinrequest:\${id}\`, JSON.stringify(item));\n    await appendIndex(env, \`joinrequest:index:\${groupId}\`, id, 1000);\n    return item;\n  }`;

moderation = replaceOnce(moderation, anchor, replacement, 'insert subgroup direct approval');

const exportAnchor = 'resolveModerationTarget, resolveRuleProgressiveStep,';
moderation = replaceOnce(moderation, exportAnchor, 'resolveModerationTarget, resolveSubgroupJoinFamily, resolveRuleProgressiveStep,', 'export subgroup resolver');
fs.writeFileSync(moderationPath, moderation);

const packagePath = 'package.json';
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
pkg.version = '2.0.2';
pkg.scripts.check = `${pkg.scripts.check} && node verify-subgroup-join.mjs`;
fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);

const configPath = 'src/config/runtime.js';
let config = fs.readFileSync(configPath, 'utf8');
config = replaceOnce(config, 'const VERSION = "2.0.1";', 'const VERSION = "2.0.2";', 'update runtime version');
fs.writeFileSync(configPath, config);

const notes = {
  version: '2.0.2',
  notificationPolicy: 'latest-main-only',
  queueDelivery: 'mark-processed-after-success',
  added: [],
  fixed: [
    '分群申请不再经过 AI 审核，符合分群绑定的申请直接同意'
  ]
};
fs.writeFileSync('release-notes.json', `${JSON.stringify(notes, null, 2)}\n`);

const verify = `import fs from 'node:fs';\n\nfunction assert(condition, message) {\n  if (!condition) throw new Error(message);\n}\n\nconst source = fs.readFileSync('src/moderation/runtime.js', 'utf8');\nconst directAt = source.indexOf('status: "approved_subgroup_direct"');\nconst aiAt = source.indexOf('const review = await reviewJoinRequestAssist');\nassert(directAt >= 0, 'Subgroup direct-approval branch is missing');\nassert(aiAt >= 0, 'Existing AI review fallback is missing');\nassert(directAt < aiAt, 'Subgroup direct approval must run before AI review');\nassert(source.includes('headGroupId === id) return null'), 'Head group must not use subgroup direct approval');\nassert(source.includes('join_request_subgroup_direct_approved'), 'Subgroup approval audit record is missing');\nassert(source.includes('return item;\\n  }\\n  const pattern = await readJoinPattern'), 'Subgroup path must return before normal review');\nconsole.log('verify-subgroup-join: ok');\n`;
fs.writeFileSync('verify-subgroup-join.mjs', verify);

console.log('Direct subgroup join approval patch applied.');
