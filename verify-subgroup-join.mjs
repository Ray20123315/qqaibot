import fs from 'node:fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const source = fs.readFileSync('src/moderation/runtime.js', 'utf8');
const directAt = source.indexOf('status: "approved_subgroup_direct"');
const aiAt = source.indexOf('const review = await reviewJoinRequestAssist');
assert(directAt >= 0, 'Subgroup direct-approval branch is missing');
assert(aiAt >= 0, 'Existing AI review fallback is missing');
assert(directAt < aiAt, 'Subgroup direct approval must run before AI review');
assert(source.includes('headGroupId === id) return null'), 'Head group must not use subgroup direct approval');
assert(source.includes('join_request_subgroup_direct_approved'), 'Subgroup approval audit record is missing');
assert(source.includes('return item;\n  }\n  const pattern = await readJoinPattern'), 'Subgroup path must return before normal review');
console.log('verify-subgroup-join: ok');
