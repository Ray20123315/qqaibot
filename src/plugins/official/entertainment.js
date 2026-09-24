import { handleEntertainmentCommand } from "../../games/entertainment.js";
import { definePlugin } from "../api.js";

const entertainmentPlugin = definePlugin({
  manifest: {
    id: "official.entertainment",
    name: "QQAI 娛樂工具",
    version: "1.0.0",
    apiVersion: "1",
    description: "骰子、隨機數、硬幣、猜拳、選擇、今日運勢、真心話與大冒險。屬可停用的官方插件，不進入 QQAI Core。",
    author: "QQAI",
    official: true,
    capabilities: ["message.read", "message.send"],
    requiredCapabilities: ["message.read", "message.send"]
  },
  async onMessage(ctx, message) {
    const result = handleEntertainmentCommand({
      text: String(message?.text || ""),
      userId: String(message?.userId || ctx.userId || ""),
      groupId: String(message?.groupId || ctx.groupId || "private"),
      now: new Date()
    });
    if (!result?.handled) return null;
    await ctx.reply(result.text);
    return Object.freeze({ consume: true, kind: result.kind || "entertainment" });
  }
});

export { entertainmentPlugin };
