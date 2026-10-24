/** QQ Markdown presentation and controlled plaintext downgrade. */
const safeString=s=>String(s??'').replace(/\r\n?/g,'\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'').trim().replace(/^null(?=[\u3400-\u9fff])/i,'');
export function markdownForQQ(answer){
  let s=safeString(answer);
  if(!s)return '暫時無法產生回覆。';
  s=s.replace(/^#{4,6}\s+/gm,'### ');
  if(!/^#{1,3}\s/m.test(s)&&/^(?:\d{1,2}[.)、]|[-*]\s)\s*/m.test(s)){
    const head=s.split('\n').find(x=>x.trim()&&!/^\s*(?:\d+[.)、]|[-*])\s*/.test(x))||'回覆';
    if(head.length<54&&s.startsWith(head)&&!head.startsWith('\x60\x60\x60'))s='# '+head+'\n\n'+s.slice(head.length).trimStart();
  }
  return s.slice(0,1800);
}
export function markdownToPlainText(markdown){
  return safeString(markdown)
    .replace(/^\x60{3}[^\n]*\n?/gm,'')
    .replace(/^#{1,6}\s+(.+)$/gm,'【$1】')
    .replace(/\*\*(.+?)\*\*/g,'$1')
    .replace(/__(.+?)__/g,'$1')
    .replace(/(^|[^*])\*([^*\n]+)\*(?=[^*]|$)/g,'$1$2')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,'$1（$2）')
    .replace(/^\s*(\d{1,2})[.)]\s+/gm,'$1. ')
    .replace(/^\s*[-*]\s+/gm,'• ')
    .slice(0,1800);
}
export function markdownPayload(content,msgId,seq=1){
  return {msg_type:2,content:' ',markdown:{content:markdownForQQ(content)},msg_id:msgId,msg_seq:seq};
}
export function plainPayload(content,msgId,seq=1){
  return {msg_type:0,content:markdownToPlainText(content),msg_id:msgId,msg_seq:seq};
}
export function rejectedMarkdown(response,code){
  // No retries after transport failures because the send may have succeeded.
  return !!(response&&[400,403,415,422].includes(response.status))||
    !!(code&&/^[0-9]{1,8}$/.test(code));
}
