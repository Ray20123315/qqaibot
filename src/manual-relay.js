/** Only the exact "/跨群 <文字>" command permits a manual cross-group broadcast. */
export function parseManualRelay(input){
 const match=String(input??"").match(/^\/跨群(?=$|\s)(?:\s+([\s\S]*))?$/u);
 if(!match)return null;
 const text=String(match[1]||"").trim();
 if(!text)return {matched:true,text:"",error:"missing_text"};
 if(text.length>1200)return {matched:true,text:"",error:"too_long"};
 return {matched:true,text,error:null};
}
