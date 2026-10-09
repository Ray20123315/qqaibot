
import { clean, qq } from "./core.js";
const schema=[
  `CREATE TABLE IF NOT EXISTS bridge_rooms (id TEXT PRIMARY KEY, code_hash TEXT UNIQUE NOT NULL, creator_qq TEXT, active INTEGER NOT NULL DEFAULT 0, revoked INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS bridge_groups (group_openid TEXT PRIMARY KEY, room_id TEXT NOT NULL, qq_group_id TEXT UNIQUE, alias TEXT NOT NULL DEFAULT '', display_name TEXT NOT NULL DEFAULT '', verified INTEGER NOT NULL DEFAULT 0, stopped INTEGER NOT NULL DEFAULT 0, pairing_hash TEXT, pairing_expires INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS bridge_group_room_idx ON bridge_groups(room_id, verified, stopped)`,
  `CREATE TABLE IF NOT EXISTS bridge_acl (qq_group_id TEXT NOT NULL, qq_id TEXT NOT NULL, scope TEXT NOT NULL, PRIMARY KEY(qq_group_id,qq_id,scope))`,
  `CREATE TABLE IF NOT EXISTS bridge_members (qq_group_id TEXT NOT NULL, qq_id TEXT NOT NULL, role TEXT NOT NULL, nickname TEXT NOT NULL DEFAULT '', last_seen INTEGER NOT NULL, PRIMARY KEY(qq_group_id,qq_id))`,
  `CREATE TABLE IF NOT EXISTS bridge_rosters (qq_group_id TEXT PRIMARY KEY, fetched_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS bridge_identities (group_openid TEXT NOT NULL, qq_id TEXT NOT NULL, member_openid TEXT NOT NULL, bound_at INTEGER NOT NULL, PRIMARY KEY(group_openid, qq_id), UNIQUE(group_openid,member_openid))`,
  `CREATE TABLE IF NOT EXISTS bridge_pending_ids (token_hash TEXT PRIMARY KEY, group_openid TEXT NOT NULL, member_openid TEXT NOT NULL, expires_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS bridge_seen (event_key TEXT PRIMARY KEY, created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS bridge_deliveries (id TEXT PRIMARY KEY, target_group TEXT NOT NULL, status TEXT NOT NULL, error TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL)`
];
let initialized=false;
export async function init(db) {
  if (!db) throw new Error("D1_DB_REQUIRED");
  if (initialized) return;
  for (const sql of schema) await db.prepare(sql).run();
  initialized=true;
}
export async function get(db,sql,...bind) { return db.prepare(sql).bind(...bind).first(); }
export async function all(db,sql,...bind) { return (await db.prepare(sql).bind(...bind).all()).results||[]; }
export async function run(db,sql,...bind) { return db.prepare(sql).bind(...bind).run(); }
export async function digest(value) {
  const bytes = new TextEncoder().encode(String(value));
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes))).map(v=>v.toString(16).padStart(2,"0")).join("");
}
export function makeCode(size=12) {
  const alphabet="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";const bytes=new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return Array.from(bytes,b=>alphabet[b%alphabet.length]).join("");
}
export async function groupByQq(db,id) {return get(db,"SELECT * FROM bridge_groups WHERE qq_group_id=?",qq(id));}
export async function groupByOpen(db,id) {return get(db,"SELECT * FROM bridge_groups WHERE group_openid=?",clean(id,256));}
export async function roster(db,groupId,now=Date.now()) {
  const record=await get(db,"SELECT fetched_at FROM bridge_rosters WHERE qq_group_id=?",groupId);
  const fresh=!!record && now-record.fetched_at<120000 && now>=record.fetched_at;
  const protectedCount=await get(db,"SELECT COUNT(1) AS count FROM bridge_members WHERE qq_group_id=? AND qq_id IN (?,?)",groupId,"3569028262","2681167798");
  return {fresh,protectedPresent:Number(protectedCount?.count||0)>0};
}
export async function recordRoster(db,groupId,members,now=Date.now()) {
  if (!Array.isArray(members) || !members.length || members.length>20000) throw new Error("ROSTER_INVALID");
  const parsed=members.map(m=>({id:qq(m.user_id),role:["owner","admin"].includes(m.role)?m.role:"member",name:clean(m.card||m.nickname,60)}));
  if (parsed.some(m=>!m.id)) throw new Error("ROSTER_INVALID_IDS");
  // A failed replacement never marks an incomplete roster as fresh.
  const stmts=[db.prepare("DELETE FROM bridge_members WHERE qq_group_id=?").bind(groupId),
    ...parsed.map(m=>db.prepare("INSERT INTO bridge_members (qq_group_id,qq_id,role,nickname,last_seen) VALUES (?,?,?,?,?)").bind(groupId,m.id,m.role,m.name,now)),
    db.prepare("INSERT INTO bridge_rosters (qq_group_id,fetched_at) VALUES(?,?) ON CONFLICT(qq_group_id) DO UPDATE SET fetched_at=excluded.fetched_at").bind(groupId,now)];
  await db.batch(stmts);
}
export async function once(db,key,now=Date.now()) {
  const result=await run(db,"INSERT OR IGNORE INTO bridge_seen(event_key,created_at) VALUES(?,?)",key,now);
  return Number(result.meta?.changes||0)>0;
}
