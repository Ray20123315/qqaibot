// Advisory model policy: do not silently truncate final answers.
export const PLAIN_REPLY_RULE="回覆 QQ 群訊息必須使用一般純文字，不要 Markdown、標題標記、粗體、列表符號、程式碼圍欄或表格。通常以 1–3 個短段落、約 120–350 個中文字完整回答。複雜問題可以稍長，但要先說結論、避免冗長；務必完整結束句子，絕不可把回答截在句子中間。";
export function toPlainText(value){
 let v=String(value??"").replace(/\r\n?/g,"\n").trim();
 v=v.replace(/^\s*\x60{3}[^\n]*\n?/gm,"").replace(/^\s*\x60{3}\s*$/gm,"");
 v=v.replace(/(^|\n)\s{0,3}#{1,6}\s+/g,"$1");
 v=v.replace(/!\[([^\]]*)\]\(([^)]+)\)/g,"$1");
 v=v.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,"$1：$2");
 v=v.replace(/\*\*([^*\n]+)\*\*/g,"$1").replace(/__([^_\n]+)__/g,"$1");
 v=v.replace(/(?<!\w)\*([^*\n]+)\*(?!\w)/g,"$1").replace(/(?<!\w)_([^_\n]+)_(?!\w)/g,"$1");
 v=v.replace(/\x60([^\x60\n]+)\x60/g,"$1");
 v=v.replace(/^\s*[-*+]\s+/gm,"• ").replace(/^\s*(\d+)\.\s+/gm,"$1、");
 v=v.replace(/^\s*>\s?/gm,"").replace(/^\s*\|[-:| ]+\|\s*$/gm,"");
 v=v.replace(/\n{3,}/g,"\n\n");
 return v.trim();
}
export function needsCondensing(text,limit=1350){return toPlainText(text).length>limit;}
export async function completeShortReply(text,{regenerate,limit=1350,hardLimit=1800}={}){
 let output=toPlainText(text);
 if(!output)return "目前無法產生回答，請稍後重試。";
 if(output.length<=limit)return output;
 if(typeof regenerate==="function"){
  const revised=toPlainText(await regenerate(output));
  if(revised&&revised.length<=hardLimit)return revised;
 }
 return "這個問題需要比較長的說明。請把問題拆成兩個部分，我會逐一完整回答。";
}
