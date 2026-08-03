// Permission-aware command catalog for `!help`.

import { VERSION } from "../config/runtime.js";

const COMMON_SECTIONS = Object.freeze([
  {
    title: "基础与多模态",
    items: [
      "!help／!帮助：查看当前权限可用的指令",
      "!status／!配额：查看模型、AI、记忆与调用状态",
      "!模型 自动／Gemma 26B／Gemma 31B／Gemini：切换个人模型偏好",
      "!live：取得实时语音网页",
      "!语音 问题：生成语音回答",
      "!读网页 URL：抓取公开网页并摘要",
      "!翻译 语言 内容：翻译文字",
      "图片理解：图片与问题同一则发送，或回复图片后 @机器人",
      "/!普通内容：群友明确跳过所有 AI；机器人同号人工发送时为聊天别名"
    ]
  },
  {
    title: "娱乐",
    items: [
      "!娱乐：查看娱乐指令",
      "!骰子 [面数／NdM]：例如 !骰子 2d6",
      "!随机数 [最小] [最大]：默认 1～100",
      "!硬币：抛硬币",
      "!猜拳 石头／剪刀／布",
      "!选择 A | B | C：随机选择",
      "!今日运势：同一人每日固定",
      "!真心话／!大冒险：随机安全题目"
    ]
  },
  {
    title: "群聊整理与分析",
    items: [
      "!会议纪要 [10～500]：整理重点、分歧与待办",
      "!总结 [5～100]／!吃瓜：轻松总结群聊",
      "!查成分 [@成员]：娱乐性质的近期发言分析",
      "!详细资料 [@成员]：本人查自己；查询他人受权限限制",
      "!群状态：查看 AI、记忆、插话率与群人格"
    ]
  },
  {
    title: "记忆、人格与个人设置",
    items: [
      "!群规／!rules：查看群规",
      "!记住 内容／!忘记 内容／!你记住了什么",
      "!set人格 风格／!del人格",
      "!免打扰／!取消免打扰",
      "!好感度 [@成员]",
      "!协助撤回：回复自己的消息后使用"
    ]
  },
  {
    title: "活动、投票与排程",
    items: [
      "!活动：建立或查看活动；建立流程需要确认",
      "!报名 活动名／!取消报名 活动名／!活动名单 活动名",
      "!活动通知 活动名",
      "!投票：查看帮助；支持建立、选择与结束",
      "!排程 时间 内容：支持绝对时间、每天与其他重复规则",
      "!排程 列表／!排程 取消 编号",
      "!自动打卡／!打卡时间：查看自动群打卡状态与执行窗口",
      "私聊 !申诉 群号 类型 详细内容"
    ]
  },
  {
    title: "群规协作",
    items: [
      "!检查 具体原因：回复目标消息或 @目标进行人工补检",
      "!无违规 @成员 说明：管理员撤销最近一笔误判",
      "政治内容由聊天与群规系统静默略过",
      "明确种族歧视固定公开警告，不自动禁言、撤回或踢出"
    ]
  }
]);

const AI_ADMIN_SECTION = Object.freeze({
  title: "AI 管理",
  items: [
    "!关闭ai／!开启ai",
    "!记忆开／!记忆关",
    "!拉黑 @成员／!洗白 @成员",
    "!set群规 内容",
    "!群规监控 开／关／状态",
    "!AI群规代理 记录／警告／禁言／完全代理／状态",
    "!群规严格度 智慧／宽松／低／中／高／严格／状态",
    "!违规禁言保护 开／关／状态",
    "!切换人格 风格／!恢复人格",
    "!设置插话率 0～100",
    "!好感度注入 开／关／状态",
    "!自动欢迎 开／关／!欢迎词 内容",
    "!入群辅助 开／关／状态",
    "!指令开／!指令关",
    "!清空群上下文"
  ]
});

const GROUP_OPS_SECTION = Object.freeze({
  title: "群操作",
  items: [
    "!禁言 @成员 时长／!解禁 @成员",
    "!撤回：管理员回复目标消息",
    "!踢出 @成员",
    "!全员禁言／!解除全员禁言",
    "!改群名 新名称／!改名片 @成员 新名片",
    "自然语言群管只建立提案，不会直接执行",
    "!确认op／!取消op：确认或取消最新提案",
    "也可使用完整操作编号确认或取消"
  ]
});

const OWNER_SECTION = Object.freeze({
  title: "群主／开发者设置",
  items: [
    "!授权AI踢出／!撤回AI踢出授权",
    "!授权AI拒绝入群／!撤回AI拒绝入群授权",
    "!设置处置冷却 秒数",
    "!设置新人观察期 天数",
    "!取消使用：结束全群模仿覆盖"
  ]
});

const DEVELOPER_SECTION = Object.freeze({
  title: "开发者",
  items: [
    "!群白名单 群号／!删群白名单 群号",
    "!授权 @成员 权限类型／!撤销授权 @成员 权限类型",
    "!禁记忆 @成员／!解禁记忆 @成员",
    "私聊 !群打卡 [群号／全部]：立即执行群签到",
    "!重置／!clear",
    "!自我调整／!自我修正",
    "Root 与 Portal 可管理模型、通知、权限、资料与系统维护"
  ]
});

function renderSection(section) {
  return [`【${section.title}】`, ...section.items.map(item => `• ${item}`)].join("\n");
}

function buildHelpText({
  roleLabel = "群成员",
  permissionSet = {},
  isDeveloper = false,
  isOwner = false,
  portalUrl = "",
  liveUrl = ""
} = {}) {
  const sections = [...COMMON_SECTIONS];
  if (permissionSet.aiAdmin) sections.push(AI_ADMIN_SECTION);
  if (permissionSet.groupOps) sections.push(GROUP_OPS_SECTION);
  if (isOwner || isDeveloper) sections.push(OWNER_SECTION);
  if (isDeveloper) sections.push(DEVELOPER_SECTION);

  const publicLinks = [
    portalUrl ? `• Portal：${portalUrl}` : "",
    liveUrl ? `• Live：${liveUrl}` : ""
  ].filter(Boolean);

  return [
    `QQAI ${VERSION} 指令帮助`,
    `当前权限：${roleLabel}`,
    ...publicLinks,
    "• 指令同时接受半角 ! 与全角 ！",
    "• 高风险群操作必须二次确认",
    "",
    ...sections.flatMap((section, index) => [renderSection(section), ...(index < sections.length - 1 ? [""] : [])])
  ].join("\n").trim();
}

export {
  AI_ADMIN_SECTION,
  COMMON_SECTIONS,
  DEVELOPER_SECTION,
  GROUP_OPS_SECTION,
  OWNER_SECTION,
  buildHelpText,
  renderSection
};
