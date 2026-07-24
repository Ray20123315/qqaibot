import cryptoModule from 'node:crypto';
if (!globalThis.crypto) globalThis.crypto = cryptoModule.webcrypto;
const m = await import('file:///tmp/worker-v1.5.2-ci.mjs');
const assert = (value, message) => { if (!value) throw new Error(message); };

const pools = m.partitionGoogleApiKeys({ GEMINI_API_KEYS: 'k1,k2,k3' });
assert(JSON.stringify(pools.gemmaDecision) === '["k1","k2"]', 'Gemma decision pool');
assert(JSON.stringify(pools.gemmaChat) === '["k3"]', 'Gemma chat pool');
assert(JSON.stringify(pools.geminiDecision) === '["k1"]', 'Gemini decision pool');
assert(JSON.stringify(pools.geminiChat) === '["k2","k3"]', 'Gemini chat pool');
assert(m.modelHealthStatusLabel('ok') === '正常', 'health label');
assert(m.modelHealthStatusLabel('unknown') === '尚未检查', 'unknown health label');
assert(m.modelCapabilityLabel('context_summary') === '上下文整理', 'capability label');

class Statement {
  constructor(db, sql) { this.db = db; this.sql = sql; this.args = []; }
  bind(...args) { this.args = args; return this; }
  async first() {
    const key = String(this.args[0] ?? '');
    if (/SELECT\s+value/i.test(this.sql)) return this.db.map.has(key) ? { value: this.db.map.get(key) } : null;
    return null;
  }
  async run() {
    const key = String(this.args[0] ?? '');
    if (/INSERT/i.test(this.sql)) this.db.map.set(key, String(this.args[1] ?? ''));
    if (/DELETE/i.test(this.sql)) this.db.map.delete(key);
    return { success: true };
  }
  async all() { return { results: [] }; }
}
class D1 { constructor() { this.map = new Map(); } prepare(sql) { return new Statement(this, sql); } }
const makeHub = sent => ({
  idFromName: value => value,
  get: () => ({
    fetch: async (_url, init) => {
      const body = JSON.parse(init.body || '{}');
      if (body.action === 'get_group_member_info') return new Response(JSON.stringify({ ok: false, error: 'probe failed' }), { status: 500, headers: { 'content-type': 'application/json' } });
      if (body.action === 'get_group_list') return new Response(JSON.stringify({ ok: true, data: [] }), { headers: { 'content-type': 'application/json' } });
      if (body.action === 'send_group_msg') {
        sent.push(body.params || {});
        return new Response(JSON.stringify({ ok: true, data: { message_id: 123 } }), { headers: { 'content-type': 'application/json' } });
      }
      return new Response(JSON.stringify({ ok: true, data: {} }), { headers: { 'content-type': 'application/json' } });
    }
  })
});

{
  const db = new D1(); const sent = [];
  db.map.set('onebot:self_identity', JSON.stringify({ userId: '999999', nickname: 'bot', at: Date.now() }));
  const env = { DB: db, ONEBOT_HUB: makeHub(sent), DEVELOPER_QQ: '3569028262' };
  const role = await m.getBotGroupRole(env, '808882936');
  assert(role.exists === false, 'membership probe should be unconfirmed');
  const activity = { id: 'a1', title: '测试活动', groupId: '808882936', groupIds: ['808882936'], description: '', startAt: 0, signupDeadline: 0, capacity: 0, waitlistEnabled: true };
  const result = await m.opsAnnounceActivity(env, activity, { actorId: '3569028262', mode: 'none' });
  assert(result.ok === true && sent.length === 1, 'activity notification actual send');
  const healed = JSON.parse(db.map.get('onebot:self_group_role:808882936'));
  assert(healed.exists === true && healed.verifiedBy === 'send_group_msg', 'activity group cache healing');
}

{
  const db = new D1(); const sent = []; const now = Date.now(); const token = 'tok'; const groupId = '808882936';
  db.map.set(`portal_session:${token}`, JSON.stringify({ qq: '3569028262', groupId, group: '测试群', role: 'developer', permissions: { developer: true, aiAdmin: true, groupOps: true, nativeAdmin: true }, persistent: true, createdAt: now, lastActivityAt: now, expiresAt: now + 86400000, absoluteExpiresAt: now + 86400000 * 30, idleTtlMs: 86400000, absoluteTtlMs: 86400000 * 30, authenticatedAt: now, authMethod: 'qq_code' }));
  db.map.set(`feature:active_speaking:${groupId}`, 'true');
  db.map.set('active_speaking:groups', JSON.stringify([groupId]));
  db.map.set(`group_whitelist:${groupId}`, 'true');
  db.map.set('onebot:self_identity', JSON.stringify({ userId: '999999', nickname: 'bot', at: now }));
  db.map.set(`onebot:self_group_role:${groupId}`, JSON.stringify({ exists: true, role: 'member', verifiedBy: 'cache', checkedAt: now }));
  const env = { DB: db, ONEBOT_HUB: makeHub(sent), DEVELOPER_QQ: '3569028262', DEVELOPER_ID: '3569028262' };
  const call = async (path, method = 'GET', body = null) => {
    const headers = { cookie: `qqai_session=${token}` };
    if (body) headers['content-type'] = 'application/json';
    const request = new Request(`https://x/api/portal${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const response = await m.handlePortalApi(request, env, new URL(request.url));
    return [response, await response.json().catch(() => ({}))];
  };
  let response, json;
  [response, json] = await call('/ops/settings', 'POST', { maintenanceMode: true, emergencyLock: false });
  assert(response.status === 200 && json.ok, 'maintenance save response');
  assert(JSON.parse(db.map.get(`ops:settings:${groupId}`)).maintenanceMode === true, 'maintenance persisted');

  [response, json] = await call('/admin/active-speaking-test', 'POST', {});
  assert(response.status === 200 && json.ok && sent.length === 1, 'active-speaking test route');
  assert(JSON.parse(db.map.get(`active_speaking:state:${groupId}`)).ok === true, 'active-speaking state');

  const connector = { id: 'b1', groupId, mode: 'generic_webhook', webhookSecret: 'sec1', creatorId: '473204883', creatorName: '阿叶睡不醒QAQ', videoNotify: true, videoAtAll: false, liveNotify: true, liveAtAll: false };
  db.map.set('bili:connector:b1', JSON.stringify(connector)); db.map.set('bili:webhook_secret:sec1', 'b1');
  [response, json] = await call('/integrations/bilibili', 'POST', { action: 'webhook_self_test', id: 'b1' });
  assert(response.status === 200 && json.ok && sent.length === 2, 'Bilibili webhook self-test');
  assert(JSON.parse(db.map.get('bili:connector:b1')).lastWebhookTestOk === true, 'Bilibili test state');

  db.map.set('schedule:s1', JSON.stringify({ id: 's1', creatorId: '3569028262', groupId, status: 'completed', enabled: false, content: 'done' }));
  db.map.set('schedule:index', JSON.stringify(['s1']));
  [response, json] = await call('/schedules/delete', 'POST', { id: 's1' });
  assert(response.status === 200 && json.ok && !db.map.has('schedule:s1'), 'completed schedule permanent delete');
  assert(!JSON.parse(db.map.get('schedule:index')).includes('s1'), 'schedule index cleanup');

  db.map.set('schedule:s2', JSON.stringify({ id: 's2', creatorId: '12345', groupId, status: 'active', enabled: true, nextRunAt: now + 60000, content: 'x' }));
  db.map.set('schedule:index', JSON.stringify(['s2']));
  [response, json] = await call('/root/schedule-action', 'POST', { id: 's2', action: 'reject' });
  assert(response.status === 200 && json.ok, 'developer schedule action');
  assert(JSON.parse(db.map.get('schedule:s2')).status === 'rejected', 'developer schedule status');
}

{
  const db = new D1(); const sent = []; const now = Date.now(); const id = 'once1'; const groupId = '808882936';
  db.map.set('schedule:index', JSON.stringify([id]));
  db.map.set(`schedule:${id}`, JSON.stringify({ id, type: 'once', status: 'active', enabled: true, nextRunAt: now - 1000, groupId, creatorId: '3569028262', content: '到点测试', mentionIds: [] }));
  db.map.set(`group_whitelist:${groupId}`, 'true');
  await m.processDueSchedules({ DB: db, ONEBOT_HUB: makeHub(sent), DEVELOPER_QQ: '3569028262' }, now);
  const item = JSON.parse(db.map.get(`schedule:${id}`));
  assert(sent.length === 1, 'one-time schedule sent');
  assert(item.status === 'completed' && item.enabled === false && item.nextRunAt === null, 'one-time schedule retained');
  assert(JSON.parse(db.map.get('schedule:index')).includes(id), 'one-time schedule remains indexed');
}

{
  const db = new D1(); db.map.set('group_rules:1', '禁止辱骂');
  const result = await m.opsRuleSandbox({ DB: db }, { groupId: '1', text: '测试' });
  assert(!/callGemmaText is not defined/i.test(String(result.message || '')), 'rule sandbox undefined function regression');
}

console.log('worker v1.5.2 runtime PASS');
