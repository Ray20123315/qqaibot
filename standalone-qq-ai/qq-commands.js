/** Deterministic, side-effect-free QQ slash commands. Group moderation is intentionally NOT executable here. */
const topics=['今天有什么想分享的小确幸？','如果能学会一项新技能，你会选什么？','你最近遇到过最有趣的科技产品是什么？','周末最喜欢怎么放松？'];
export function commandHelp(){return '# 客服与聊天指令\n\n1. /帮助 — 查看指令\n2. /骰子 — 掷六面骰子\n3. /抽签 甲 乙 丙 — 随机抽选\n4. /今日话题 — 获取聊天话题\n5. /上下文 — 查看本会话上下文概况\n6. /总结 — 查看现有对话摘要\n7. /搜索开 /搜索关 — 个人网络搜索开关\n8. /思考开 /思考关 — 个人思考开关（默认关闭）\n\n深度搜索暂未通过兼容性验证。群聊 HTML 附件暂不开放发送。\n\n群管理的禁言、踢人、审核需 QQ 官方权限，当前未开放执行。';}
export function parseCommand(message){
 const matched=/^\/([\u4e00-\u9fffA-Za-z]+)(?:\s+(.*))?$/.exec(String(message||'').trim());
 return matched?{name:matched[1],args:matched[2]||''}:null;
}
export function commandResult(message,{stats=null,summary=''}={}){
 const command=parseCommand(message);
 if(!command)return {handled:false};
 const key=command.name;
 if(key==='帮助'||key==='help')return {handled:true,text:commandHelp()};
 if(key==='骰子')return {handled:true,text:'🎲 结果：'+(crypto.getRandomValues(new Uint32Array(1))[0]%6+1)};
 if(key==='今日话题')return {handled:true,text:topics[crypto.getRandomValues(new Uint32Array(1))[0]%topics.length]};
 if(key==='抽签'){
  const options=command.args.split(/[\s,，、|]+/).map(s=>s.trim()).filter(Boolean).slice(0,30);
  return {handled:true,text:options.length<2?'用法：/抽签 选项A 选项B 选项C':'🎯 抽中：'+options[crypto.getRandomValues(new Uint32Array(1))[0]%options.length]};
 }
 if(key==='上下文')return {handled:true,text:stats?'# 会话记忆\n\n已保存 '+stats.storedMessages+' 条消息\n压缩版本 '+stats.revisions+' 次\n模型最大目标 '+stats.maxContextTokens+' Tokens\n当前默认工作预算 '+stats.defaultWorkingWindow+' Tokens\n历史原文完整保留。':'暂时无法读取记忆统计。'};
 if(key==='总结')return {handled:true,text:summary?'# 历史对话摘要\n\n'+summary.slice(0,1000):'目前还没有需要压缩的历史对话。'};
 if(['禁言','解禁','踢出','审核','群设置'].includes(key))return {handled:true,text:'该操作需要管理员身份和 QQ 官方开放权限。目前尚未启用，未对任何群成员执行操作。'};
 if(['清除记忆','删除记忆','工单','客服','回忆','记住'].includes(key))return {handled:true,text:'该指令尚在安全设计与权限校验阶段，目前没有执行任何数据变更。'};
 return {handled:false};
}
