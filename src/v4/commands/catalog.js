import { createCommandRegistry } from "./registry.js";

const INITIAL_COMMANDS = Object.freeze([
  { id:"core.help", aliases:["!help","!帮助"], scopes:["c2c","group"], description:"查看可用指令", category:"core", menu:{enabled:true,name:"帮助"} },
  { id:"core.status", aliases:["!status","!配额"], scopes:["c2c","group"], description:"查看系统与额度状态", category:"core", menu:{enabled:true,name:"状态"} },
  { id:"ai.codex", aliases:["!codex"], scopes:["c2c","group"], description:"Codex 对话", category:"ai", menu:{enabled:true,name:"Codex"} },
  { id:"ai.codexchat", aliases:["!codexchat"], scopes:["c2c","group"], permission:"developer", description:"开发者 Codex 对话", category:"ai" },
  { id:"ai.codexwork", aliases:["!codexwork"], scopes:["c2c","group"], permission:"developer", description:"受限本机工作区", category:"ai" },
  { id:"ai.model", aliases:["!模型"], scopes:["c2c","group"], description:"切换个人模型", category:"ai" },
  { id:"group.status", aliases:["!群状态"], scopes:["group"], description:"查看群 AI 状态", category:"group", menu:{enabled:true,name:"群状态"} },
  { id:"group.rules", aliases:["!群规","!rules"], scopes:["group"], description:"查看群规", category:"group", menu:{enabled:true,name:"群规"} },
  { id:"member.speech", aliases:["!成员发言分析"], scopes:["group"], description:"分析成员近期发言", category:"member" },
  { id:"member.details", aliases:["!详细资料"], scopes:["group"], description:"查询成员资料", category:"member" },
  { id:"group.mute", aliases:["!禁言"], scopes:["group"], permission:"group_ops", description:"禁言指定成员", category:"moderation", panel:{onlyAdmin:true} },
  { id:"group.unmute", aliases:["!解禁"], scopes:["group"], permission:"group_ops", description:"解除成员禁言", category:"moderation", panel:{onlyAdmin:true} },
  { id:"group.recall", aliases:["!撤回"], scopes:["group"], permission:"group_ops", description:"撤回目标消息", category:"moderation", panel:{onlyAdmin:true} },
  { id:"group.kick", aliases:["!踢出"], scopes:["group"], permission:"group_ops", description:"移出指定成员", category:"moderation", panel:{onlyAdmin:true} },
  { id:"group.mute_all", aliases:["!全员禁言"], scopes:["group"], permission:"group_ops", description:"开启全员禁言", category:"moderation", panel:{onlyAdmin:true} },
  { id:"group.unmute_all", aliases:["!解除全员禁言"], scopes:["group"], permission:"group_ops", description:"解除全员禁言", category:"moderation", panel:{onlyAdmin:true} },
  { id:"memory.remember", aliases:["!记住"], scopes:["c2c","group"], description:"保存记忆", category:"memory" },
  { id:"memory.forget", aliases:["!忘记"], scopes:["c2c","group"], description:"删除指定记忆", category:"memory" },
  { id:"user.dnd", aliases:["!免打扰"], scopes:["c2c","group"], description:"开启免打扰", category:"user" },
  { id:"user.dnd_off", aliases:["!取消免打扰"], scopes:["c2c","group"], description:"关闭免打扰", category:"user" }
]);

function createInitialCommandRegistry() { return createCommandRegistry(INITIAL_COMMANDS); }
export { INITIAL_COMMANDS, createInitialCommandRegistry };
