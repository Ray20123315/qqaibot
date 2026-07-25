import fs from 'node:fs';
import { canUnlockMute } from './src/moderation/mute-locks.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const env = { DEVELOPER_ID: '3569028262' };
const partnerLock = {
  active: true,
  groupId: '10001',
  userId: '20002',
  source: 'partner',
  partnerId: '30003',
  createdBy: '30003',
  expiresAt: Date.now() + 60000
};
assert(canUnlockMute(env, partnerLock, { actorId: '30003', partnerCommand: true }).allowed, 'Bound partner must be able to release a partner-source mute');
assert(!canUnlockMute(env, partnerLock, { actorId: '40004', partnerCommand: true }).allowed, 'Unbound member must not release a partner-source mute');
assert(canUnlockMute(env, partnerLock, { actorId: '50005', actorRole: 'admin' }).allowed, 'Native management must retain ordinary moderation authority over partner-source mutes');
const manualLock = { ...partnerLock, source: 'manual', partnerId: '' };
assert(!canUnlockMute(env, manualLock, { actorId: '30003', partnerCommand: true }).allowed, 'Partner privilege must never release a manual protected mute');
const selfLock = { ...partnerLock, source: 'self', partnerId: '' };
assert(!canUnlockMute(env, selfLock, { actorId: '30003', partnerCommand: true }).allowed, 'Partner privilege must never release self mute');

const bindings = fs.readFileSync('src/moderation/partner-bindings.js', 'utf8');
assert(bindings.includes('partner_binding:'), 'Partner bindings must be persisted per group and user');
assert(bindings.includes('request.targetId'), 'Only the invited target may approve a binding');
assert(bindings.includes('你已经绑定了一个对象'), 'Each member must be limited to one partner');
assert(bindings.includes('对方已经绑定了对象'), 'Target partner uniqueness must be enforced');
assert(bindings.includes('PARTNER_REQUEST_TTL_MS'), 'Partner requests must expire');

const worker = fs.readFileSync('worker.js', 'utf8');
assert(worker.includes('createPartnerBindingRequest'), 'Worker must expose partner binding requests');
assert(worker.includes('群主与核心开发者不能建立对象绑定'), 'Owner and core developer accounts must be excluded from partner binding');
assert(worker.includes('decidePartnerBindingRequest'), 'Worker must require target consent');
assert(worker.includes('createPartnerMuteLock'), 'Partner mute must use a distinct lock source');
assert(worker.includes('partnerCommand: true'), 'Partner unmute must use the restricted partner permission path');
assert(worker.includes('只能解除由对象关系产生的禁言'), 'Partner unmute must reject other mute sources');

const portal = fs.readFileSync('src/portal/runtime.js', 'utf8');
assert(portal.includes("members:'群友列表'"), 'Portal title map must include the member list');
assert(portal.includes("'groups','moderation','members','ruleviolations'"), 'Portal management visibility must include the member list');
assert(portal.includes('data-open-view="members"'), 'Portal dashboard must expose a member-list shortcut when the navigation permission is available');
assert(portal.includes('id="opProtect"'), 'Pending moderation form must expose prevent-unmute');
assert(portal.includes('id="opOwnerUnlock"'), 'Pending moderation form must expose owner-can-unmute');
assert(portal.includes('id="opSkipConfirm"'), 'Pending moderation form must expose skip-confirmation');
assert(portal.includes('preventUnmute:$('), 'Pending moderation request must submit prevent-unmute');

const members = fs.readFileSync('src/portal/members.js', 'utf8');
assert(!members.includes('id="memberConsoleNav" class="hidden"'), 'Member list navigation must not be permanently hidden');
assert(!members.includes('setInterval(syncNav,3000)'), 'Injected member script must not hide navigation using an inaccessible session variable');

const deployment = fs.readFileSync('src/deployment/notifications.js', 'utf8');
const processBody = deployment.match(/async function processBuildEvent[\s\S]*?async function announceDeployedVersionFallback/)?.[0] || '';
assert(!processBody.includes('notifyGroups(env'), 'Deployment queue events must not send update summaries to groups');
const fallbackBody = deployment.match(/async function announceDeployedVersionFallback[\s\S]*?async function handleDeploymentBuildQueue/)?.[0] || '';
assert(!fallbackBody.includes('notifyGroups(env'), 'Runtime deployment fallback must not send update summaries to groups');
assert(deployment.includes('reason: "portal_only"'), 'Deployment status must explicitly record Portal-only notification policy');

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
assert(pkg.version === '2.3.1', 'Package version must be 2.3.1');
assert(pkg.scripts.check.includes('verify-partner-bindings.mjs'), 'Partner and Portal regressions must run in the permanent suite');

console.log('verify-partner-bindings: ok');
