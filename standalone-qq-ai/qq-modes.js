/** Per-user QQ model modes. Only verified QQ event authors may change their own options. */
const KEY_PREFIX='qq-mode-v1:';
const truthy=new Set(['开','开启','on','enable','启用','打開','打开']);
const falsy=new Set(['关','关闭','off','disable','停用','關','關閉']);
const tidy=s=>String(s??'').trim().toLowerCase();
const enc=new TextEncoder();
async function hash(value){const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(value)));return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');}
export const DEFAULT_MODES=Object.freeze({search:true,thinking:false,deep:false});
export function modeCommand(text){
 const m=/^\/?(搜索|搜尋|搜寻|search|思考|thinking|深度搜索|深度搜尋|deepsearch)(?:\s*(开|开启|on|enable|启用|打開|打开|关|关闭|off|disable|停用|關|關閉|状态|狀態|status))?$/i.exec(String(text||'').trim());
 if(!m)return null;
 const part=m[1].toLowerCase();
 const kind=part.includes('深度')||part==='deepsearch'?'deep':part==='思考'||part==='thinking'?'thinking':'search';
 const op=tidy(m[2]||'status');
 return {kind,action:truthy.has(op)?'on':falsy.has(op)?'off':'status'};
}
async function userKey(env,event){
 const author=event?.isGroup?event.author:event?.author||event?.target;
 if(!author||typeof author!=='string'||author.length>256||!event?.target||!env.QQ_APP_SECRET||!env.QQ_APP_ID)return null;
 return KEY_PREFIX+await hash([env.QQ_APP_ID,event.isGroup?'group':'c2c',event.target,author,env.QQ_APP_SECRET].join('|'));
}
export async function readModes(env,event){
 const key=await userKey(env,event);
 if(!key||!env.CONFIG_KV)return {...DEFAULT_MODES};
 const raw=await env.CONFIG_KV.get(key).catch(()=>null);
 if(!raw)return {...DEFAULT_MODES};
 let json;try{json=JSON.parse(raw);}catch{return {...DEFAULT_MODES};}
 return {search:json?.search!==false,thinking:json?.thinking===true,deep:false};
}
export async function handleModeCommand(env,event){
 const cmd=modeCommand(event?.message);
 if(!cmd)return null;
 if(cmd.kind==='deep')return {handled:true,text:'深度搜索正在进行兼容性与安全验证，目前暂未开放。普通搜索和思考模式可以分别开启或关闭。'};
 const key=await userKey(env,event);
 if(!key||!env.CONFIG_KV)return {handled:true,text:'暂时无法验证你的 QQ 用户身份，未修改个人设置。'};
 let config=await readModes(env,event);
 if(cmd.action!=='status'){
   config={...config,[cmd.kind]:cmd.action==='on',deep:false};
   await env.CONFIG_KV.put(key,JSON.stringify(config),{expirationTtl:30*86400});
 }
 return {handled:true,modes:config,text:'你的对话设置：网络搜索 '+(config.search?'开启':'关闭')+'；思考模式 '+(config.thinking?'开启':'关闭')+'。深度搜索暂不可用。\n可输入 /搜索开、/搜索关、/思考开、/思考关。'};
}
export const modeGuide='普通聊天默认搜索开启、思考关闭；可用 /搜索开 /搜索关 /思考开 /思考关 自行切换。深度搜索未通过测试前不会启用。';
