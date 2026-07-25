import { injectPortalMembersClient } from './src/portal/members.js';

function assert(condition, message) { if (!condition) throw new Error(message); }
const html = injectPortalMembersClient('<!doctype html><html><head></head><body><nav><button data-view="logs">操作日志</button></nav><main><section id="v-logs"></section></main></body></html>');
const match = html.match(/<script id="qqai-member-console-client">([\s\S]*?)<\/script>/);
assert(match, 'Injected Portal member client script must exist');
new Function(match[1]);
assert(html.includes('memberRoleFilter'), 'Role filter must be present');
assert(html.includes('memberMuteFilter'), 'Mute filter must be present');
assert(html.includes('memberRelationshipFilter'), 'Relationship filter must be present');
assert(html.includes('memberExport'), 'CSV export must be present');
assert(match[1].includes('if(isMembersView())setTimeout(loadMembers,0);'), 'Member console must initialize when already active');
assert(!match[1].includes('syncNav()'), 'Injected member client must not hide navigation by guessing private session state');
assert(!match[1].includes("确定直接建立主人关系？\n主人："), 'Generated script must not contain a literal newline in a single-quoted confirmation string');
console.log('verify-portal-members-client: ok');
