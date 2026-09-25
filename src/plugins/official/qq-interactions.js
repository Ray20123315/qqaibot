import { definePlugin } from "../api.js";

const QQ_INTERACTIONS_PLUGIN_ID = "qqai.qq-interactions";

function bool(value, fallback = false) {
  if (typeof value === "boolean") return value;
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return fallback;
  if (["1","true","yes","on","enabled","開","开启","開啟"].includes(raw)) return true;
  if (["0","false","no","off","disabled","關","关闭","關閉"].includes(raw)) return false;
  return fallback;
}

function integer(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function normalizeSettings(input = {}, fallback = {}) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  return Object.freeze({
    pokeReplyEnabled: bool(source.pokeReplyEnabled ?? source.pokereplyenabled, fallback.pokeReplyEnabled ?? true),
    messageReactionEnabled: bool(source.messageReactionEnabled ?? source.messagereactionenabled, fallback.messageReactionEnabled ?? true),
    favoriteFaceEnabled: bool(source.favoriteFaceEnabled ?? source.favoritefaceenabled, fallback.favoriteFaceEnabled ?? true),
    mallFaceEnabled: bool(source.mallFaceEnabled ?? source.mallfaceenabled, fallback.mallFaceEnabled ?? true),
    voiceReplyBetaEnabled: bool(source.voiceReplyBetaEnabled ?? source.voicereplybetaenabled, fallback.voiceReplyBetaEnabled ?? false),
    favoriteFaceCount: integer(source.favoriteFaceCount ?? source.favoritefacecount, fallback.favoriteFaceCount ?? 24, 1, 48)
  });
}

function dataOf(result) {
  return result && typeof result === "object" && Object.prototype.hasOwnProperty.call(result, "data") ? result.data : result;
}

function messageText(message) {
  return String(message?.text || "").trim();
}

function firstMention(message) {
  return (message?.parts || []).find(part => part?.kind === "mention" && !part?.all && part?.userId)?.userId || "";
}

function firstReplyId(message) {
  return (message?.parts || []).find(part => part?.kind === "reply" && part?.messageId)?.messageId || "";
}

function firstMarketFace(message) {
  return (message?.parts || []).find(part => part?.kind === "mface" && part?.emojiId && part?.packageId) || null;
}

function targetFromText(message, text) {
  return firstMention(message) || String(text || "").match(/(?:^|\s)@?(\d{5,})(?:\s|$)/)?.[1] || "";
}

function favoriteList(result) {
  const data = dataOf(result);
  const rows = Array.isArray(data) ? data : Array.isArray(data?.faces) ? data.faces : [];
  return rows.map(item => typeof item === "string" ? item : String(item?.url || item?.file || item?.path || "")).filter(Boolean);
}

function sendableFavoriteRef(value) {
  const ref = String(value || "").trim();
  if (/^(?:https?:\/\/|base64:\/\/|file:\/\/)/i.test(ref)) return ref;
  if (ref && !/^(?:[a-zA-Z]:[\\/]|[\\/])/.test(ref)) return ref;
  return "";
}

function createQqInteractionsPlugin(options = {}) {
  const defaults = normalizeSettings(options);
  let settings = defaults;

  async function readSettings(ctx) {
    settings = normalizeSettings(await ctx.storage.get("settings", defaults), defaults);
    return settings;
  }

  async function writeSettings(ctx, input) {
    settings = normalizeSettings(input, settings || defaults);
    await ctx.storage.set("settings", settings);
    return settings;
  }

  async function handleTextCommand(ctx, message) {
    const text = messageText(message);
    if (!text || !/^[!！]/.test(text)) return null;

    let match = text.match(/^[!！](?:戳戳|戳一戳)(?:\s+([\s\S]+))?$/i);
    if (match) {
      const target = targetFromText(message, match[1] || "");
      if (!target) {
        await ctx.reply("請 @ 要戳的成員，或填 QQ 號。");
        return { consume: true, action: "poke_usage" };
      }
      const params = { user_id: target };
      if (ctx.groupId) params.group_id = ctx.groupId;
      await ctx.onebot.call("send_poke", params, 10000);
      return { consume: true, action: "poke", target };
    }

    match = text.match(/^[!！](?:回應表情|回应表情|表情回應|表情回应)\s+([^\s]+)(?:\s+(\d+))?$/i);
    if (match) {
      if (!settings.messageReactionEnabled) {
        await ctx.reply("訊息表情回應目前已關閉。");
        return { consume: true, action: "reaction_disabled" };
      }
      const emojiId = String(match[1] || "").trim();
      const messageId = String(match[2] || firstReplyId(message) || "").trim();
      if (!messageId) {
        await ctx.reply("請回覆要加表情的訊息，再使用「!回應表情 表情ID」。");
        return { consume: true, action: "reaction_usage" };
      }
      await ctx.onebot.call("set_msg_emoji_like", { message_id: messageId, emoji_id: emojiId }, 10000);
      return { consume: true, action: "reaction", messageId, emojiId };
    }

    match = text.match(/^[!！](?:收藏表情|我的收藏表情)(?:\s+(\d+))?$/i);
    if (match) {
      if (!settings.favoriteFaceEnabled) {
        await ctx.reply("收藏表情功能目前已關閉。");
        return { consume: true, action: "favorite_disabled" };
      }
      const count = integer(match[1], settings.favoriteFaceCount, 1, 48);
      const rows = favoriteList(await ctx.onebot.call("fetch_custom_face", { count }, 15000));
      if (!rows.length) {
        await ctx.reply("NapCat 沒有回傳可用的收藏表情。");
        return { consume: true, action: "favorite_empty" };
      }
      const ref = sendableFavoriteRef(rows[0]);
      if (!ref) {
        await ctx.reply(`已讀到 ${rows.length} 個收藏表情，但第一個是 NapCat 本機絕對路徑，遠端 Worker 不會要求 NapCat 任意讀取本機檔案。`);
        return { consume: true, action: "favorite_local_path", count: rows.length };
      }
      await ctx.reply([{ kind: "image", media: { file: ref, url: /^https?:\/\//i.test(ref) ? ref : "" } }]);
      return { consume: true, action: "favorite_face", count: rows.length };
    }

    match = text.match(/^[!！](?:商城表情|商城表情包)(?:\s+(\S+)\s+(\S+)(?:\s+(\S+))?)?$/i);
    if (match) {
      if (!settings.mallFaceEnabled) {
        await ctx.reply("商城表情功能目前已關閉。");
        return { consume: true, action: "mface_disabled" };
      }
      const quotedOrAttached = firstMarketFace(message);
      const emojiId = String(match[1] || quotedOrAttached?.emojiId || "").trim();
      const packageId = String(match[2] || quotedOrAttached?.packageId || "").trim();
      const key = String(match[3] || quotedOrAttached?.key || "").trim();
      const summary = String(quotedOrAttached?.summary || "").trim();
      if (!emojiId || !packageId) {
        await ctx.reply("請直接附上一個商城表情再使用「!商城表情」，或填「!商城表情 emoji_id package_id [key]」。");
        return { consume: true, action: "mface_usage" };
      }
      await ctx.reply([{ kind: "mface", emojiId, packageId, key, summary }]);
      return { consume: true, action: "mface", emojiId, packageId };
    }

    match = text.match(/^[!！](?:QQ語音角色|QQ语音角色)$/i);
    if (match) {
      if (!settings.voiceReplyBetaEnabled) {
        await ctx.reply("QQ 語音回覆 Beta 預設關閉；請先在插件設定中啟用。");
        return { consume: true, action: "voice_beta_disabled" };
      }
      if (!ctx.groupId) {
        await ctx.reply("NapCat AI 語音角色目前只在群聊可查詢。");
        return { consume: true, action: "voice_group_required" };
      }
      const result = dataOf(await ctx.onebot.call("get_ai_characters", { group_id: ctx.groupId, chat_type: 1 }, 15000));
      const categories = Array.isArray(result) ? result : [];
      const names = categories.flatMap(category => (category?.characters || []).slice(0, 8).map(item => `${item.character_name || "未命名"}(${item.character_id || "?"})`)).slice(0, 24);
      await ctx.reply(names.length ? `可用語音角色：${names.join("、")}` : "NapCat 沒有回傳可用語音角色。");
      return { consume: true, action: "voice_characters" };
    }

    match = text.match(/^[!！](?:QQ語音|QQ语音)\s+(\S+)\s+([\s\S]+)$/i);
    if (match) {
      if (!settings.voiceReplyBetaEnabled) {
        await ctx.reply("QQ 語音回覆 Beta 預設關閉；請先在插件設定中啟用。");
        return { consume: true, action: "voice_beta_disabled" };
      }
      if (!ctx.groupId) {
        await ctx.reply("NapCat AI 語音回覆目前只支援群聊。");
        return { consume: true, action: "voice_group_required" };
      }
      const character = String(match[1]).slice(0, 120);
      const speech = String(match[2]).trim().slice(0, 500);
      await ctx.onebot.call("send_group_ai_record", { group_id: ctx.groupId, character, text: speech }, 30000);
      return { consume: true, action: "voice", character };
    }

    return null;
  }

  return definePlugin({
    manifest: {
      id: QQ_INTERACTIONS_PLUGIN_ID,
      name: "QQAI Official QQ Interactions",
      version: "1.0.0",
      apiVersion: "1",
      description: "NapCat poke, message reactions, favorite faces, mall faces and opt-in QQ voice beta.",
      author: "QQAI",
      official: true,
      releaseChannel: "stable",
      capabilities: ["message.read", "message.send", "media.send", "onebot.call", "storage"],
      requiredCapabilities: ["message.read", "message.send", "onebot.call", "storage"],
      permissionDetails: {
        "message.read": { labelZh: "讀取互動指令", descriptionZh: "只解析戳戳、表情與語音互動指令。", accessTypes: ["read"] },
        "message.send": { labelZh: "回覆互動結果", descriptionZh: "回覆插件操作結果與商城表情。", accessTypes: ["action"] },
        "media.send": { labelZh: "傳送收藏／商城表情", descriptionZh: "傳送 NapCat 可識別的表情資源。", accessTypes: ["action"] },
        "onebot.call": { labelZh: "呼叫 NapCat 互動 API", descriptionZh: "使用戳一戳、表情回應、收藏表情與 Beta 語音 API。", accessTypes: ["action"] },
        storage: { labelZh: "保存插件設定", descriptionZh: "只保存此插件的開關與數量設定。", accessTypes: ["read","write"] }
      },
      settings: {
        pokereplyenabled: { type: "boolean", label: "被戳時回戳", description: "Bot 被戳時以 NapCat send_poke 回戳。" },
        messagereactionenabled: { type: "boolean", label: "訊息表情回應", description: "允許 set_msg_emoji_like。" },
        favoritefaceenabled: { type: "boolean", label: "收藏表情", description: "允許 fetch_custom_face。" },
        mallfaceenabled: { type: "boolean", label: "商城表情", description: "允許 mface 回覆。" },
        voicereplybetaenabled: { type: "boolean", label: "QQ 語音回覆 Beta", description: "預設關閉；使用 NapCat AI 語音 API。" },
        favoritefacecount: { type: "number", label: "收藏表情讀取數", min: 1, max: 48, step: 1 }
      }
    },
    surface: {
      async readSettings(ctx) { return readSettings(ctx); },
      async updateSettings(ctx, input) { return writeSettings(ctx, input); },
      async status() {
        return { ...settings, supportedActions: ["send_poke","set_msg_emoji_like","fetch_custom_face","get_ai_characters","send_group_ai_record","mface"] };
      }
    },
    async onLoad(ctx) { await readSettings(ctx); },
    async onGroupMessage(ctx, message) { return handleTextCommand(ctx, message); },
    async onPrivateMessage(ctx, message) { return handleTextCommand(ctx, message); },
    async onNotice(ctx, notice) {
      if (!settings.pokeReplyEnabled) return null;
      if (String(notice?.notice_type || "") !== "notify" || String(notice?.sub_type || "") !== "poke") return null;
      const selfId = String(notice?.self_id || "");
      const userId = String(notice?.user_id || "");
      const targetId = String(notice?.target_id || "");
      if (!selfId || targetId !== selfId || !userId || userId === selfId) return null;
      const params = { user_id: userId };
      if (notice?.group_id) params.group_id = String(notice.group_id);
      await ctx.onebot.call("send_poke", params, 10000);
      return { consume: false, action: "poke_back", target: userId };
    }
  });
}

const qqInteractionsPlugin = createQqInteractionsPlugin();

export {
  QQ_INTERACTIONS_PLUGIN_ID,
  createQqInteractionsPlugin,
  normalizeSettings,
  qqInteractionsPlugin
};
