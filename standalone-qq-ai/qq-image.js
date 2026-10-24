/** QQ native image attachments -> bounded, safe image content parts (NO image generation). */
const QQ_DOMAINS=['qq.com','qq.com.cn','qpic.cn','gtimg.cn'];
export function safeQQImageURL(value){
 try{
   const u=new URL(value);
   if(u.protocol!=='https:'||u.port&&u.port!=='443'||u.username||u.password||u.hash)return false;
   const h=u.hostname.toLowerCase();
   return QQ_DOMAINS.some(root=>h===root||h.endsWith('.'+root));
 }catch{return false;}
}
export function qqImageAttachments(d){
 if(!d||!Array.isArray(d.attachments))return [];
 return d.attachments.filter(x=>x&&typeof x.url==='string'&&(
   /^image\//i.test(String(x.content_type||x.contentType||''))||/image/i.test(String(x.type||''))||
   /^image\//i.test(String(x.media_type||'')))
 ).filter(x=>safeQQImageURL(x.url)).slice(0,1).map(x=>x.url);
}
export async function imagePartFromQQ(url,fetcher=fetch){
 if(!safeQQImageURL(url))throw Error('INVALID_QQ_IMAGE_URL');
 let res;
 try{res=await fetcher(url,{method:'GET',redirect:'manual',signal:AbortSignal.timeout(7000),headers:{accept:'image/png,image/jpeg,image/webp'}});}
 catch{throw Error('QQ_IMAGE_FETCH_FAILED');}
 if(!res.ok||res.status>=300&&res.status<400)throw Error('QQ_IMAGE_FETCH_FAILED');
 const type=(res.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
 if(!['image/png','image/jpeg','image/webp'].includes(type))throw Error('QQ_IMAGE_UNSUPPORTED');
 if(Number(res.headers.get('content-length'))>2*1024*1024)throw Error('QQ_IMAGE_TOO_LARGE');
 const bytes=new Uint8Array(await res.arrayBuffer());
 if(bytes.length<16||bytes.length>2*1024*1024)throw Error('QQ_IMAGE_TOO_LARGE');
 const magic=type==='image/png'?bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71:
   type==='image/jpeg'?bytes[0]===255&&bytes[1]===216:bytes[0]===82&&bytes[1]===73&&bytes[2]===70&&bytes[3]===70;
 if(!magic)throw Error('QQ_IMAGE_UNSUPPORTED');
 let binary='';
 for(let n=0;n<bytes.length;n+=8192)binary+=String.fromCharCode(...bytes.subarray(n,n+8192));
 return {type:'image_url',image_url:{url:'data:'+type+';base64,'+btoa(binary)}};
}
