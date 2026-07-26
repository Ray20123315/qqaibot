import fs from 'node:fs';

function replaceOnce(path, search, replacement, label) {
  const source = fs.readFileSync(path, 'utf8');
  const first = source.indexOf(search);
  if (first < 0) throw new Error(`Missing ${label} in ${path}`);
  if (source.indexOf(search, first + search.length) >= 0) throw new Error(`Ambiguous ${label} in ${path}`);
  fs.writeFileSync(path, source.slice(0, first) + replacement + source.slice(first + search.length));
}

replaceOnce(
  'src/portal/member-cleanup.js',
  'import { dbGet, dbPut } from "../data/store.js";',
  'import { dbDel, dbGet, dbPut } from "../data/store.js";',
  'D1 deletion import'
);

replaceOnce(
  'src/portal/member-cleanup.js',
  '  const policy = await readPolicy(env, groupId);\n  const profiles = typeof helpers?.listMemberProfileSummaries === "function" ? await helpers.listMemberProfileSummaries(env, groupId) : {};\n  const relationships = typeof helpers?.listGroupBindings === "function" ? await helpers.listGroupBindings(env, groupId) : [];\n  const related = relationshipUsers(relationships);',
  '  await dbDel(env, `${PREVIEW_PREFIX}${token}`);\n  const policy = await readPolicy(env, groupId);\n  const [profiles, relationships, liveHonors] = await Promise.all([\n    typeof helpers?.listMemberProfileSummaries === "function" ? helpers.listMemberProfileSummaries(env, groupId) : {},\n    typeof helpers?.listGroupBindings === "function" ? helpers.listGroupBindings(env, groupId) : [],\n    fetchHonors(env, groupId)\n  ]);\n  const related = relationshipUsers(relationships);',
  'single-use preview and live protection context'
);

replaceOnce(
  'src/portal/member-cleanup.js',
  '      const context = { profile: profiles?.[userId] || null, honors: member.honors || [], hasRelationship: related.has(userId), isDeveloper: isDeveloperId(env, userId) };',
  '      const context = { profile: profiles?.[userId] || null, honors: liveHonors.get(userId) || [], hasRelationship: related.has(userId), isDeveloper: isDeveloperId(env, userId) };',
  'live honor revalidation'
);

replaceOnce(
  'verify-member-cleanup.mjs',
  "assert(cleanupModule.includes('get_group_member_info') && cleanupModule.includes('no_cache: true'), 'Execution must revalidate live QQ member roles without cache before removal');",
  "assert(cleanupModule.includes('get_group_member_info') && cleanupModule.includes('no_cache: true'), 'Execution must revalidate live QQ member roles without cache before removal');\nassert(cleanupModule.includes('await dbDel(env, `${PREVIEW_PREFIX}${token}`)'), 'Cleanup preview tokens must be consumed before execution to prevent replay');\nassert(cleanupModule.includes('liveHonors.get(userId)'), 'Execution must refresh group honors before the final cleanup decision');",
  'final cleanup safety assertions'
);

console.log('finalize-member-cleanup-v2.7.0: ok');
