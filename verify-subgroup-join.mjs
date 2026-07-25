import fs from 'node:fs';

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
