import fs from 'node:fs';

function assert(condition, message) { if (!condition) throw new Error(message); }
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
assert(pkg.version === '2.7.12', 'Package version must be 2.5.2');
assert(pkg.scripts.check.includes('verify-portal-relationships.mjs'), 'Portal relationship verification must run permanently');
const bindings = fs.readFileSync('src/moderation/partner-bindings.js', 'utf8');
assert(bindings.includes('createDirectMasterBinding'), 'Storage must support direct master pairing');
assert(bindings.includes('replaceExisting'), 'Direct pairing must require explicit replacement for conflicts');
assert(bindings.includes('listGroupBindings'), 'Portal must be able to list group relationships');
assert(bindings.includes('const byUser = new Map()'), 'Relationship listing must validate pairs without per-member database round trips');
assert(bindings.includes('status = "superseded"'), 'Direct pairing must close pending requests for both participants');
const members = fs.readFileSync('src/portal/members.js', 'utf8');
assert(!members.includes('id="relationshipNav"'), 'Standalone relationship management navigation must be removed');
assert(!members.includes('id="v-relationships"'), 'Standalone relationship management page must be removed');
assert(!members.includes('/members/relationships/direct'), 'Portal direct-pairing endpoint must be removed');
assert(!members.includes('/members/relationships/remove'), 'Portal forced relationship-removal endpoint must be removed');
assert(members.includes('FEATURE_REMOVED'), 'Removed relationship mutation paths must fail closed');
assert(bindings.includes('createPartnerBindingRequest'), 'QQ consent-based relationship requests must remain available outside the removed Portal management surface');
assert(bindings.includes('decidePartnerBindingRequest'), 'Relationship consent decision flow must remain intact');
console.log('verify-portal-relationships: ok');
