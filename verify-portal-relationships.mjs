import fs from 'node:fs';

function assert(condition, message) { if (!condition) throw new Error(message); }
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
assert(pkg.version === '2.7.8', 'Package version must be 2.5.2');
assert(pkg.scripts.check.includes('verify-portal-relationships.mjs'), 'Portal relationship verification must run permanently');
const bindings = fs.readFileSync('src/moderation/partner-bindings.js', 'utf8');
assert(bindings.includes('createDirectMasterBinding'), 'Storage must support direct master pairing');
assert(bindings.includes('replaceExisting'), 'Direct pairing must require explicit replacement for conflicts');
assert(bindings.includes('listGroupBindings'), 'Portal must be able to list group relationships');
assert(bindings.includes('const byUser = new Map()'), 'Relationship listing must validate pairs without per-member database round trips');
assert(bindings.includes('status = "superseded"'), 'Direct pairing must close pending requests for both participants');
const members = fs.readFileSync('src/portal/members.js', 'utf8');
assert(members.includes('/members/relationships/direct'), 'Portal must expose direct pairing endpoint');
assert(members.includes('/members/relationships/remove'), 'Portal must expose forced relationship removal');
assert(members.includes('coreDeveloperAllowed'), 'Direct pairing must be restricted to the core developer');
assert(members.includes('isDeveloperId(env, String(authed.qq))'), 'Core developer authorization must use canonical identity logic');
assert(members.includes('no_cache: true'), 'Direct pairing must live-verify group roles');
assert(members.includes('known?.isRobot || known?.is_robot'), 'Direct pairing must honor cached robot classification as a fallback');
assert(members.includes('所属成员必须是普通群成员'), 'Subordinate eligibility must reject elevated roles');
assert(members.includes('relationshipDirectPanel'), 'Portal must render the relationship console');
assert(members.includes('替换双方既有关系'), 'Portal must require an explicit replacement option');
assert(members.includes('普通管理层不能跳过双方同意'), 'Portal must explain the read-only consent boundary');
console.log('verify-portal-relationships: ok');
