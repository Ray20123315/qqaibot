const QQAI_PLUGIN_API_VERSION = "1";

const PLUGIN_CAPABILITIES = Object.freeze([
  "message.read",
  "message.send",
  "media.read",
  "media.send",
  "onebot.call",
  "ai.chat",
  "ai.vision",
  "ai.multimodal",
  "ai.tts",
  "storage",
  "scheduler",
  "network",
  "group.read",
  "group.manage",
  "member.read",
  "member.manage",
  "portal.route"
]);

const PLUGIN_EVENT_HOOKS = Object.freeze({
  load: "onLoad",
  message: "onMessage",
  group_message: "onGroupMessage",
  private_message: "onPrivateMessage",
  notice: "onNotice",
  request: "onRequest",
  reaction: "onReaction",
  member_join: "onMemberJoin",
  member_leave: "onMemberLeave",
  cron: "onCron",
  unload: "onUnload"
});

export { PLUGIN_CAPABILITIES, PLUGIN_EVENT_HOOKS, QQAI_PLUGIN_API_VERSION };