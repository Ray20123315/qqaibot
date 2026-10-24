/** Cloudflare SQLite-backed Durable Object; each QQ scope maps to one object. */
const schema="CREATE TABLE IF NOT EXISTS qq_message_log (seq INTEGER PRIMARY KEY AUTOINCREMENT,scope TEXT NOT NULL,event_id TEXT NOT NULL,author TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('user','assistant')),content TEXT NOT NULL,received_at TEXT NOT NULL DEFAULT (datetime('now')),UNIQUE(scope,event_id,role));CREATE INDEX IF NOT EXISTS qq_history_by_scope ON qq_message_log(scope,seq);CREATE TABLE IF NOT EXISTS qq_compaction (scope TEXT PRIMARY KEY,through_seq INTEGER NOT NULL DEFAULT 0,revision INTEGER NOT NULL DEFAULT 0,summary TEXT NOT NULL DEFAULT '',updated_at TEXT NOT NULL DEFAULT (datetime('now')));";
/** Legacy Durable Object class shape, compatible with both module tests and Cloudflare stub.fetch. */
export class QQMemoryRoom {
 constructor(state,env){
   this.state=state;
   this.state.storage.sql.exec(schema);
 }
 async fetch(request){
   if(request.method!=='POST')return new Response('METHOD_NOT_ALLOWED',{status:405});
   if(Number(request.headers.get('content-length'))>25000)return new Response('TOO_LARGE',{status:413});
   const req=await request.json().catch(()=>null);
   if(!req||!['all','first','run'].includes(req.kind)||typeof req.sql!=='string'||req.sql.length>1200||
     !Array.isArray(req.params)||req.params.length>8)return new Response('INVALID_SQL_REQUEST',{status:400});
   const stmt=req.sql.trim();
   // Internal Worker-to-DO API only. Never expose this proxy as a public Worker route.
   if(!/^(?:SELECT|INSERT OR IGNORE INTO|UPDATE|DELETE FROM)\s/i.test(stmt)||
     !/\bqq_(?:message_log|compaction)\b/.test(stmt)||stmt.includes(';')||
     /(?:--|\/\*|\bDROP\b|\bALTER\b|\bPRAGMA\b)/i.test(stmt))return new Response('INVALID_SQL_REQUEST',{status:400});
   try{
     const cursor=this.state.storage.sql.exec(stmt,...req.params);
     const rows=cursor.toArray();
     return Response.json(req.kind==='run'?{meta:{changes:cursor.rowsWritten}}:
       req.kind==='first'?(rows[0]||null):{results:rows});
   }catch(err){return new Response('MEMORY_SQL_FAILED',{status:500});}
 }
}
/** Read-only SQL statement strings are hardcoded in conversation-memory.js. */
export function roomDatabase(env,scope){
 if(!env.CHAT_ROOMS||!scope)throw Error('MEMORY_NOT_CONFIGURED');
 const id=env.CHAT_ROOMS.idFromName(scope);
 const stub=env.CHAT_ROOMS.get(id);
 return {prepare(sql){return {bind(...params){
   const query=async(kind)=>{
     const response=await stub.fetch('https://room.internal/sql',{method:'POST',
       headers:{'content-type':'application/json'},body:JSON.stringify({kind,sql,params})});
     if(!response.ok)throw Error('MEMORY_STORAGE_FAILED');
     return response.json();
   };
   return {all:()=>query('all'),first:()=>query('first'),run:()=>query('run')};
 }}}};
}
