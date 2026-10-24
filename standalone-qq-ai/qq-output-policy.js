/** QQ anti-flood and mode/privacy output protections (not a platform policy bypass). */
const countPattern=/(?:输出|輸出|打印|印出|生成|重复|重複|发|發)\s*(\d{2,6})\s*(?:个|個|次|遍|行)?\s*["“「']?([0-9a-zＡ-Ｚａ-ｚ])["”」']?/iu;
export function abusiveRepeatRequest(message){
 const s=String(message||'');
 const match=countPattern.exec(s);
 return !!(match&&Number(match[1])>=60)||/(?:刷屏|洗版|轰炸群|轟炸群)/.test(s);
}
export function hasUnsafeMassOutput(output){
 const value=String(output||'');
 const lines=value.split(/\r?\n/);
 const nonempty=lines.map(s=>s.trim()).filter(Boolean);
 if(nonempty.length>=36){
   const counts=new Map();
   for(const l of nonempty)counts.set(l,(counts.get(l)||0)+1);
   if(Math.max(...counts.values())>=Math.ceil(nonempty.length*.72))return true;
 }
 return /(.)\1{255,}/su.test(value);
}
export function safeReplyText(message){
 const s=String(message||'');
 if(hasUnsafeMassOutput(s))return '为避免刷屏，我不会一次发送大量重复内容。如果是测试，请缩小数量，或让我提供简短示例。';
 return s;
}
export function isHtmlRequest(s){return /(?:做|写|寫|生成|制作|製作|创建|建立|开发|開發).{0,40}(?:html|网页|網頁)|(?:html|网页|網頁).{0,40}(?:文件|檔案|代码|代碼)/i.test(String(s||''));}
export const HTML_GROUP_NOT_SUPPORTED='目前尚未确认 QQ 官方群聊支持发送 .html 附件，因此不会冒充文件已发送，也不会执行 HTML 或接触本机文件。此功能待平台支持验证后开放。';
export function userTopicBoundary(s){
 // Explicit topics only: never classify ordinary place names, identity or language as politics.
 return /(?:一個中國|一个中国|台独|臺獨|統一台灣|统一台湾|支持.{0,12}(?:政黨|政党|候選人|候选人)|投票支持.{0,10}(?:政黨|政党)|哪個政黨|哪个政党|政治立场|政治立場)/i.test(String(s||''));
}
export const politicalScopeReply='这个话题不在目前的服务范围内。我们可以轻松聊点别的，比如生活、游戏、科技或今天发生的趣事。';
