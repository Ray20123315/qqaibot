import fs from "node:fs";

function read(path) { return fs.readFileSync(path, "utf8"); }
function write(path, value) { fs.writeFileSync(path, value); }
function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error("Missing patch anchor: " + label);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error("Ambiguous patch anchor: " + label);
  return source.slice(0, first) + after + source.slice(first + before.length);
}
function replaceRegexOnce(source, expression, replacement, label) {
  const matches = [...source.matchAll(new RegExp(expression.source, expression.flags.includes("g") ? expression.flags : expression.flags + "g"))];
  if (matches.length !== 1) throw new Error(label + " expected one match, found " + matches.length);
  return source.replace(expression, replacement);
}

const helperBlock = [
  "async function resolveHeadJoinFamily(env, groupId) {",
  "  const id = String(groupId || \"\").replace(/\\D/g, \"\");",
  "  if (!id) return null;",
  "  const family = await readJson(env, \"group_family:\" + id, null);",
  "  if (!family || String(family.headGroupId || \"\") !== id) return null;",
  "  const branches = (Array.isArray(family.branches) ? family.branches : []).map(item => ({",
  "    groupId: String(item?.groupId || \"\").replace(/\\D/g, \"\"),",
  "    alias: String(item?.alias || item?.groupId || \"分群\").trim().slice(0, 80)",
  "  })).filter(item => item.groupId && item.groupId !== id).slice(0, 50);",
  "  if (!branches.length) return null;",
  "  return { headGroupId: id, headAlias: String(family.headAlias || id), branches };",
  "}",
  "",
  "",
  "async function findApplicantBranchMembership(env, family, userId) {",
  "  const qq = String(userId || \"\").replace(/\\D/g, \"\");",
  "  if (!qq || !family) return null;",
  "  const branches = Array.isArray(family.branches) ? family.branches : [];",
  "  if (!branches.length) return null;",
  "  const checks = branches.map(async branch => {",
  "    const response = await callOneBotAction(env, {",
  "      action: \"get_group_member_info\",",
  "      params: { group_id: numericId(branch.groupId), user_id: numericId(qq), no_cache: true }",
  "    }, 8000);",
  "    const member = response?.data && typeof response.data === \"object\" ? response.data : response;",
  "    const memberId = String(member?.user_id || member?.qq || \"\").replace(/\\D/g, \"\");",
  "    if (memberId !== qq) throw new Error(\"Applicant is not a live member of this branch\");",
  "    return {",
  "      groupId: String(branch.groupId),",
  "      branchAlias: String(branch.alias || branch.groupId),",
  "      userId: qq,",
  "      memberName: String(member?.card || member?.nickname || member?.name || qq),",
  "      role: String(member?.role || \"member\"),",
  "      verifiedAt: Date.now(),",
  "      source: \"onebot_live_member_info\"",
  "    };",
  "  });",
  "  try {",
  "    return await Promise.any(checks);",
  "  } catch {",
  "    return null;",
  "  }",
  "}",
  "",
  "",
  ""
].join("\n");

{
  const path = "src/moderation/runtime.js";
  let source = read(path);
  source = replaceRegexOnce(
    source,
    /async function resolveSubgroupJoinFamily\(env, groupId\) \{[\s\S]*?\n\}\s*(?=async function createJoinRequestAssist)/,
    helperBlock,
    "replace reversed subgroup target policy"
  );
  source = replaceOnce(
    source,
    "  const groupId = String(body.group_id || \"\");\n  const comment = String(body.comment || \"\");\n  const subType = String(body.sub_type || \"add\");\n  const subgroupFamily = await resolveSubgroupJoinFamily(env, groupId);\n  const patternHash = await joinRequestPatternHash(comment, subType);",
    "  const groupId = String(body.group_id || \"\").replace(/\\D/g, \"\");\n  const userId = String(body.user_id || \"\").replace(/\\D/g, \"\");\n  const comment = String(body.comment || \"\");\n  const subType = String(body.sub_type || \"add\");\n  const headFamily = subType === \"add\" ? await resolveHeadJoinFamily(env, groupId) : null;\n  const branchMembership = headFamily && userId ? await findApplicantBranchMembership(env, headFamily, userId) : null;\n  const patternHash = await joinRequestPatternHash(comment, subType);",
    "join request family lookup"
  );
  const directBlock = [
    "",
    "  if (branchMembership) {",
    "    const id = `jr_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 6)}`;",
    "    const item = {",
    "      id,",
    "      groupId,",
    "      userId,",
    "      flag: String(body.flag || \"\"),",
    "      subType,",
    "      comment,",
    "      patternHash,",
    "      review: {",
    "        decision: \"direct_approve\",",
    "        riskLevel: \"not_applicable\",",
    "        confidence: 1,",
    "        reason: \"OneBot 已即时确认申请者为分群「\" + branchMembership.branchAlias + \"」成员，依群组政策直接同意，不经过 AI 审核\",",
    "        family: {",
    "          headGroupId: headFamily.headGroupId,",
    "          headAlias: headFamily.headAlias,",
    "          sourceGroupId: branchMembership.groupId,",
    "          sourceGroupAlias: branchMembership.branchAlias",
    "        },",
    "        membership: branchMembership",
    "      },",
    "      status: \"approved_subgroup_member_direct\",",
    "      createdAt: Date.now()",
    "    };",
    "    try {",
    "      await callOneBotAction(env, { action: \"set_group_add_request\", params: { flag: item.flag, sub_type: subType, approve: true, reason: \"\" } }, 15000);",
    "      await recordJoinPatternDecision(env, groupId, patternHash, comment, \"approved\");",
    "      await writeSystemAudit(env, {",
    "        type: \"join_request_subgroup_member_direct_approved\",",
    "        groupId,",
    "        actorId: \"system:subgroup_member_join_policy\",",
    "        targetId: item.userId,",
    "        action: \"approve\",",
    "        reason: item.review.reason,",
    "        headGroupId: headFamily.headGroupId,",
    "        sourceGroupId: branchMembership.groupId,",
    "        membershipSource: branchMembership.source",
    "      });",
    "    } catch (error) {",
    "      item.status = \"approve_failed\";",
    "      item.result = String(error?.message || error);",
    "      await writeSystemAudit(env, {",
    "        type: \"join_request_subgroup_member_direct_approve_failed\",",
    "        groupId,",
    "        actorId: \"system:subgroup_member_join_policy\",",
    "        targetId: item.userId,",
    "        action: \"approve_failed\",",
    "        error: item.result,",
    "        headGroupId: headFamily.headGroupId,",
    "        sourceGroupId: branchMembership.groupId",
    "      }).catch(() => {});",
    "    }",
    "    await dbPut(env, `joinrequest:${id}`, JSON.stringify(item));",
    "    await appendIndex(env, `joinrequest:index:${groupId}`, id, 1000);",
    "    return item;",
    "  }",
    "  const pattern ="
  ].join("\n");
  source = replaceRegexOnce(
    source,
    /\n  if \(subgroupFamily\) \{[\s\S]*?\n  \}\n  const pattern =/,
    directBlock,
    "replace unconditional subgroup direct approval"
  );
  source = replaceOnce(source, "resolveSubgroupJoinFamily, resolveRuleProgressiveStep", "findApplicantBranchMembership, resolveHeadJoinFamily, resolveRuleProgressiveStep", "moderation exports");
  if (source.includes("resolveSubgroupJoinFamily") || source.includes("subgroupFamily")) throw new Error("Legacy subgroup-target direct approval remains");
  write(path, source);
}

{
  const path = "verify-subgroup-join.mjs";
  write(path, `import fs from 'node:fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const source = fs.readFileSync('src/moderation/runtime.js', 'utf8');
const directAt = source.indexOf('status: "approved_subgroup_member_direct"');
const aiAt = source.indexOf('const review = await reviewJoinRequestAssist');
assert(directAt >= 0, 'Verified subgroup-member direct approval is missing');
assert(aiAt >= 0, 'Existing AI review fallback is missing');
assert(directAt < aiAt, 'Verified subgroup-member approval must run before AI review');
assert(source.includes('async function resolveHeadJoinFamily'), 'Head-group family resolver is missing');
assert(source.includes('String(family.headGroupId || "") !== id'), 'Direct approval must only target the configured head group');
assert(source.includes('async function findApplicantBranchMembership'), 'Applicant branch membership verifier is missing');
assert(source.includes('action: "get_group_member_info"'), 'Membership must be checked through OneBot');
assert(source.includes('no_cache: true'), 'Membership verification must bypass stale OneBot cache');
assert(source.includes('const headFamily = subType === "add"'), 'Only member join applications may use direct approval');
assert(source.includes('if (branchMembership) {'), 'Direct approval must require confirmed branch membership');
assert(source.includes('join_request_subgroup_member_direct_approved'), 'Direct approval audit record is missing');
assert(source.includes('sourceGroupId: branchMembership.groupId'), 'Audit must record the confirming branch group');
assert(!source.includes('status: "approved_subgroup_direct"'), 'Old target-is-subgroup auto-approval must be removed');
assert(!source.includes('if (subgroupFamily)'), 'Unverified subgroup target must not trigger direct approval');
console.log('verify-subgroup-join: ok');
`);
}

{
  const path = "src/config/runtime.js";
  write(path, replaceOnce(read(path), 'const VERSION = "2.0.4";', 'const VERSION = "2.0.5";', "runtime version"));
}

{
  const path = "package.json";
  const pkg = JSON.parse(read(path));
  pkg.version = "2.0.5";
  write(path, JSON.stringify(pkg, null, 2) + "\n");
}

{
  const path = "release-notes.json";
  const notes = JSON.parse(read(path));
  notes.version = "2.0.5";
  notes.added = ["总群入群申请在 OneBot 即时确认申请者属于绑定分群时直接同意"];
  notes.fixed = ["旧逻辑只判断申请目标是分群，可能将未验证的陌生申请者自动放行"];
  write(path, JSON.stringify(notes, null, 2) + "\n");
}

{
  const path = "verify-deployment-notifications.mjs";
  write(path, replaceOnce(read(path), 'assert.equal(fallbackStatus.status.releaseVersion, "2.0.4");', 'assert.equal(fallbackStatus.status.releaseVersion, "2.0.5");', "deployment version assertion"));
}

console.log("subgroup member instant-approval patch applied");
