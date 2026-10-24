/** Stateless 8-hour dashboard sessions. ADMIN_TOKEN stays in Cloudflare Secret only. */
const encoder=new TextEncoder();
const COOKIE='__Host-qqai_session';
const TTL=8*60*60*1000;
const encode64=b=>btoa(String.fromCharCode(...b)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
async function hash(value){return new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value)));}
function equal(a,b){if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];return diff===0;}
async function adminMatch(candidate,env){
 if(!env.ADMIN_TOKEN||typeof candidate!=='string'||candidate.length>512)return false;
 return equal(await hash(candidate),await hash(env.ADMIN_TOKEN));
}
async function sessionKey(env){
 const seed=await crypto.subtle.digest('SHA-256',encoder.encode('qqai-dashboard-hmac-v1:'+env.ADMIN_TOKEN));
 return crypto.subtle.importKey('raw',seed,{name:'HMAC',hash:'SHA-256'},false,['sign']);
}
async function makeSig(payload,env){
 const sig=await crypto.subtle.sign('HMAC',await sessionKey(env),encoder.encode(payload));
 return encode64(new Uint8Array(sig));
}
function cookieValue(request){
 const raw=request.headers.get('cookie')||'';
 if(raw.length>4096)return '';
 const part=raw.split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='));
 return part?part.slice(COOKIE.length+1):'';
}
async function sessionValid(request,env){
 if(!env.ADMIN_TOKEN)return false;
 const token=cookieValue(request);
 const match=/^(\d{13})\.([0-9a-f]{32})\.([A-Za-z0-9_-]{43})$/.exec(token);
 if(!match)return false;
 const issued=Number(match[1]),now=Date.now();
 if(!Number.isSafeInteger(issued)||issued>now+60_000||now-issued>TTL)return false;
 const payload=match[1]+'.'+match[2];
 const correct=await makeSig(payload,env);
 return correct.length===match[3].length && equal(encoder.encode(correct),encoder.encode(match[3]));
}
function sameOrigin(request){
 const origin=request.headers.get('origin');
 return origin!==null&&origin===new URL(request.url).origin;
}
export async function adminAllowed(request,env){
 const bearer=request.headers.get('authorization')||'';
 if(bearer.startsWith('Bearer ')&&bearer.length<=1024)
   return adminMatch(bearer.slice(7),env);
 if(!['GET','HEAD'].includes(request.method)&&!sameOrigin(request))return false;
 return sessionValid(request,env);
}
export async function login(request,env){
 if(request.method!=='POST')return new Response(JSON.stringify({error:'METHOD_NOT_ALLOWED'}),{status:405,headers:{'content-type':'application/json'}});
 if(!sameOrigin(request))return new Response(JSON.stringify({error:'INVALID_ORIGIN'}),{status:403,headers:{'content-type':'application/json'}});
 if(Number(request.headers.get('content-length'))>2048)return new Response(JSON.stringify({error:'TOO_LARGE'}),{status:413,headers:{'content-type':'application/json'}});
 const data=await request.json().catch(()=>null);
 if(!await adminMatch(data?.admin_token,env))
   return new Response(JSON.stringify({error:'INVALID_CREDENTIALS'}),{status:401,headers:{'content-type':'application/json','cache-control':'no-store'}});
 const issued=String(Date.now());
 const nonce=Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
 const payload=issued+'.'+nonce;
 const signature=await makeSig(payload,env);
 const cookie=COOKIE+'='+payload+'.'+signature+'; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age='+Math.floor(TTL/1000);
 return new Response(JSON.stringify({authenticated:true}),{status:200,headers:{'content-type':'application/json','cache-control':'no-store','set-cookie':cookie}});
}
export async function sessionRoute(request,env){
 if(request.method==='POST')return login(request,env);
 if(request.method==='GET')return new Response(JSON.stringify({authenticated:await sessionValid(request,env)}),{headers:{'content-type':'application/json','cache-control':'no-store'}});
 if(request.method==='DELETE'){
  if(!sameOrigin(request))return new Response(JSON.stringify({error:'INVALID_ORIGIN'}),{status:403,headers:{'content-type':'application/json'}});
  return new Response(JSON.stringify({authenticated:false}),{headers:{'content-type':'application/json','cache-control':'no-store','set-cookie':COOKIE+'=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0'}});
 }
 return new Response(JSON.stringify({error:'METHOD_NOT_ALLOWED'}),{status:405,headers:{'content-type':'application/json'}});
}
