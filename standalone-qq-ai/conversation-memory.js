/** Persistent QQ dialogue log: no raw-message deletion during summary compaction. */
export const CONTEXT_MAX=262144;
export const CONTEXT_DEFAULT=16384;
const clean=s=>String(s??'').replace(/\r\n?/g,'\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,' ').trim();
export function approxTokens(text){return Math.ceil([...String(text??'')].reduce((n,ch)=>n+(ch.charCodeAt(0)>255?1.3:0.34),0));}
export function contextBudget(physicalWindow=CONTEXT_DEFAULT){
 const w=Math.min(CONTEXT_MAX,Math.max(4096,Number(physicalWindow)||CONTEXT_DEFAULT));
 return {configured:w,usable:Math.floor(w*.72),reserved:Math.ceil(w*.28)};
}
async function hexDigest(v){const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)));return [...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');}
export async function scopeKey(env,evt){
 if(!evt||typeof evt.target!=='string'||!evt.target||!env.QQ_APP_SECRET||!env.QQ_APP_ID)throw Error('INVALID_MEMORY_SCOPE');
 return hexDigest('qqai-memory-v1|'+env.QQ_APP_ID+'|'+(evt.isGroup?'group':'direct')+'|'+evt.target+'|'+env.QQ_APP_SECRET);
}
const run=async(stmt,...params)=>stmt.bind(...params).run();
export async function ensureSchema(db){
 if(!db)throw Error('MEMORY_NOT_CONFIGURED');
 await db.exec("CREATE TABLE IF NOT EXISTS qq_message_log (seq INTEGER PRIMARY KEY AUTOINCREMENT,scope TEXT NOT NULL,event_id TEXT NOT NULL,author TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('user','assistant')),content TEXT NOT NULL,received_at TEXT NOT NULL DEFAULT (datetime('now')),UNIQUE(scope,event_id,role));CREATE INDEX IF NOT EXISTS qq_history_by_scope ON qq_message_log(scope,seq);CREATE TABLE IF NOT EXISTS qq_compaction (scope TEXT PRIMARY KEY,through_seq INTEGER NOT NULL DEFAULT 0,revision INTEGER NOT NULL DEFAULT 0,summary TEXT NOT NULL DEFAULT '',updated_at TEXT NOT NULL DEFAULT (datetime('now')));");
}
export async function appendMessage(db,scope,eventId,role,body,{author='qq'}={}){
 const content=clean(body).slice(0,1500);
 if(!db||!scope||!eventId||!content||!['user','assistant'].includes(role))throw Error('INVALID_MEMORY_MESSAGE');
 await run(db.prepare('INSERT OR IGNORE INTO qq_message_log(scope,event_id,author,role,content) VALUES(?,?,?,?,?)'),scope,String(eventId).slice(0,256),String(author).slice(0,40),role,content);
}
export async function loadContext(db,scope,{window=CONTEXT_DEFAULT,limit=160}={}){
 const config=contextBudget(window);
 const [summary,rows]=await Promise.all([
  db.prepare('SELECT through_seq,revision,summary FROM qq_compaction WHERE scope=?').bind(scope).first(),
  db.prepare('SELECT seq,role,content FROM qq_message_log WHERE scope=? ORDER BY seq DESC LIMIT ?').bind(scope,Math.min(200,Math.max(10,limit))).all()
 ]);
 const history=(rows.results||[]).reverse();
 const through=Number(summary?.through_seq||0);
 const uncompressed=history.filter(x=>x.seq>through);
 const summaryText=clean(summary?.summary||'').slice(0,12000);
 const available=config.usable-Math.min(approxTokens(summaryText),config.usable/3)-2500;
 const chosen=[];let consumed=0;
 for(let i=uncompressed.length-1;i>=0;i--){
   const row=uncompressed[i],estimated=approxTokens(row.content)+18;
   if(estimated>available-consumed)break;
   chosen.unshift({role:row.role,content:row.content,seq:row.seq});
   consumed+=estimated;
 }
 return {messages:chosen,summary:summaryText,through,revision:Number(summary?.revision||0),
   totalUncompressed:uncompressed.length,lastSeq:history.at(-1)?.seq||0,estimatedTokens:consumed+approxTokens(summaryText),
   budget:config,compactionRecommended:uncompressed.length>=36||consumed>config.usable*.65};
}
export async function compactOneBatch(db,scope,summarize,{batch=24,keepRecent=16}={}){
 if(typeof summarize!=='function')throw Error('INVALID_COMPACTOR');
 const state=await loadContext(db,scope,{window:CONTEXT_MAX,limit:200});
 if(state.totalUncompressed<keepRecent+batch)return {compacted:false,reason:'NOT_ENOUGH_HISTORY'};
 const old=await db.prepare('SELECT seq,role,content FROM qq_message_log WHERE scope=? AND seq>? ORDER BY seq ASC LIMIT ?')
   .bind(scope,state.through,batch).all();
 const rows=old.results||[];
 if(rows.length<batch)return {compacted:false,reason:'NOT_ENOUGH_HISTORY'};
 const nextThrough=rows.at(-1).seq;
 const summary=clean(await summarize(state.summary,rows.map(({role,content})=>({role,content})))).slice(0,12000);
 if(!summary)throw Error('COMPACTION_EMPTY_SUMMARY');
 await run(db.prepare('INSERT OR IGNORE INTO qq_compaction(scope,through_seq,revision,summary) VALUES(?,0,0,?)'),scope,'');
 const changed=await run(db.prepare("UPDATE qq_compaction SET summary=?, through_seq=?, revision=revision+1, updated_at=datetime('now') WHERE scope=? AND through_seq=?"),
   summary,nextThrough,scope,state.through);
 return {compacted:(changed.meta?.changes||0)===1,through:nextThrough,preservedRaw:true};
}
export async function getMemoryStats(db,scope){
 const [n,s]=await Promise.all([
  db.prepare('SELECT COUNT(*) count, MAX(seq) last_seq FROM qq_message_log WHERE scope=?').bind(scope).first(),
  db.prepare('SELECT through_seq,revision FROM qq_compaction WHERE scope=?').bind(scope).first()
 ]);
 return {storedMessages:Number(n?.count||0),lastSeq:Number(n?.last_seq||0),compressedThrough:Number(s?.through_seq||0),revisions:Number(s?.revision||0),maxContextTokens:CONTEXT_MAX,defaultWorkingWindow:CONTEXT_DEFAULT,rawMessagesKept:true};
}
export async function purgeConversation(db,scope){
 // No user-triggered /clear until verified identity and authority. Admin only.
 await run(db.prepare('DELETE FROM qq_compaction WHERE scope=?'),scope);
 const result=await run(db.prepare('DELETE FROM qq_message_log WHERE scope=?'),scope);
 return {deleted:result.meta?.changes||0};
}
