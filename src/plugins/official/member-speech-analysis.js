import { definePlugin } from "../api.js";

function targetUserId(message, text) {
  const selfId = String(message?.selfId || "");
  const mention = (Array.isArray(message?.parts) ? message.parts : []).find(part =>
    part?.kind === "mention" && !part?.all && String(part?.userId || "") && String(part?.userId || "") !== selfId
  );
  if (mention) return String(mention.userId);
  return String(text || "").match(/@?(\d{5,})/)?.[1] || String(message?.userId || "");
}

const memberSpeechAnalysisPlugin = definePlugin({
  manifest: {
    id: "official.member-speech-analysis",
    name: "QQAI 成員發言分析",
    version: "1.0.0",
    apiVersion: "1",
    description: "按需分析指定成員近期公開群聊發言；只輸出可由樣本支持的觀察，不把娛樂性推測寫入記憶。",
    author: "QQAI",
    official: true,
    capabilities: ["message.read", "message.send", "member.read", "ai.chat"],
    requiredCapabilities: ["message.read", "message.send", "member.read", "ai.chat"]
  },
  async onMessage(ctx, message) {
    if (message?.scope !== "group" || !message.groupId) return null;
    const text = String(message?.text || "").trim();
    const match = text.match(/^[!！](?:成員發言分析|成员发言分析|發言分析|发言分析)(?:\s+([\s\S]+))?$/i);
    if (!match) return null;

    const userId = targetUserId(message, match[1] || "");
    const rows = await ctx.member.recentMessages({ groupId: message.groupId, userId, limit: 30 });
    const usable = (Array.isArray(rows) ? rows : [])
      .map(row => String(row?.text || "").trim())
      .filter(row => row && !/^[!！]/.test(row))
      .slice(-30);
    if (usable.length < 5) {
      await ctx.reply("目前可用的公開群聊樣本太少，至少需要 5 則有效發言才能分析。");
      return { consume: true, action: "insufficient_samples", userId, samples: usable.length };
    }

    const result = await ctx.ai.chat({
      system: "你是群聊發言分析器。只分析提供的公開群聊樣本，不推測敏感屬性、現實身分、心理疾病、政治立場或私人資訊。不要評分人格好壞，也不要建立任何人物分數。用繁體中文，輸出：常聊主題、表達方式、互動特徵、可直接觀察到的習慣、樣本限制。每項都必須能由樣本文字支持。",
      text: `目標 QQ：${userId}\n樣本數：${usable.length}\n\n${usable.map((row, i) => `${i + 1}. ${row}`).join("\n")}`,
      maxOutputTokens: 900,
      temperature: 0.2
    });
    const answer = String(result?.text || "").trim();
    await ctx.reply(answer || "分析服務暫時沒有產生可用結果。");
    return { consume: true, action: "member_speech_analysis", userId, samples: usable.length, model: String(result?.model || "") };
  }
});

export { memberSpeechAnalysisPlugin };
