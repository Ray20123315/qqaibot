import fs from 'node:fs';
import {
  FLIRT_MUTE_MAX_SECONDS,
  clampFlirtMuteSeconds,
  isFlirtRefusalSignal,
  isManagementRole,
  isManagerStopSignal,
  looksLikeFlirtCandidate,
  looksLikeRoughBanter,
  managerExchangeContext,
  normalizeFlirtAction
} from './src/moderation/social-boundaries.js';

function assert(condition, message) { if (!condition) throw new Error(message); }

assert(isManagementRole('admin') && isManagementRole('owner') && isManagementRole('developer'), 'Management roles must be recognized');
assert(!isManagementRole('member'), 'Ordinary members must not be treated as management');
assert(isManagerStopSignal('都别吵了，到此为止'), 'Explicit management intervention must be recognized');
assert(!isManagerStopSignal('好的'), 'Ordinary manager participation must not be mistaken for intervention');
assert(looksLikeRoughBanter('滚'), 'Rough banter candidates must be recognized');
assert(isFlirtRefusalSignal('别这样，我不接受'), 'Flirt refusal signals must be recognized');
assert(looksLikeFlirtCandidate('老婆贴贴'), 'Affectionate flirting must enter boundary review');
assert(clampFlirtMuteSeconds(9999) === FLIRT_MUTE_MAX_SECONDS, 'Flirt mutes must be capped at five minutes');
assert(normalizeFlirtAction('warn_recall_mute') === 'warn_recall_mute', 'Flirt action normalization must preserve supported actions');

const now = Date.now();
const managerContext = managerExchangeContext([
  { userId: '20001', senderRole: 'admin', text: '好的', mentions: [], createdAt: now - 1000 }
], { userId: '30001', senderRole: 'member', text: '滚', now });
assert(managerContext.managerParticipating === true, 'A manager immediately participating in the exchange must suppress conflict intervention');

const stopContext = managerExchangeContext([
  { userId: '20001', senderRole: 'admin', text: '停止争吵，到此为止', mentions: [], createdAt: now - 1000 }
], { userId: '30001', senderRole: 'member', text: '还骂', now });
assert(stopContext.managerStopActive === true, 'A recent management stop signal must activate post-intervention enforcement');

const scheduler = fs.readFileSync('src/scheduler/runtime.js', 'utf8');
assert(scheduler.includes('conflict_manager_intervention'), 'Conflict guard must audit management intervention');
assert(scheduler.includes('conflict_warning_after_manager_stop'), 'Conflict guard must warn only after management intervention is ignored');
assert(!scheduler.includes('群冲突升级'), 'Conflict guard must not notify or summon management after failed persuasion');
assert(!scheduler.includes('mentionIds: adminMentions'), 'Conflict guard must not mention all administrators');

const moderation = fs.readFileSync('src/moderation/runtime.js', 'utf8');
assert(moderation.includes('handleFlirtBoundary'), 'Moderation must include dedicated text-flirting boundaries');
assert(moderation.includes('FLIRT_MUTE_MAX_SECONDS'), 'Moderation must enforce the five-minute hard cap');
assert(moderation.includes('rule_banter_manager_participation_skip'), 'Manager-participated banter must be exempted from automatic rule action');
assert(moderation.includes('warn_recall_mute'), 'Flirt moderation must support warning, recall, and capped mute');
assert(moderation.includes('群聊文字调情可以'), 'Public warning text must state that proportionate flirting is allowed');

const worker = fs.readFileSync('worker.js', 'utf8');
assert(worker.includes('senderRole: isDeveloper ? "developer" : senderRole'), 'Worker must pass the live sender role to social boundary handlers');
assert(worker.includes('mentionedQqs'), 'Worker must pass mention context to social boundary handlers');
assert(worker.includes('quotedSenderId: String(quotedMessage?.senderId || "")'), 'Worker must pass quoted-sender context to social boundary handlers');

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
assert(pkg.version === '2.7.5', 'Package version must be 2.5.2');
assert(pkg.scripts.check.includes('verify-social-boundaries.mjs'), 'Social boundary verification must run permanently');
console.log('verify-social-boundaries: ok');
