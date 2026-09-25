import { definePlugin } from "../api.js";

function roleCanManage(message, adminUserIds) {
  const role = String(message?.senderRole || "member");
  return role === "owner" || role === "admin" || adminUserIds.has(String(message?.userId || ""));
}
function indexKey(groupId) { return `group:${groupId}:index`; }
function pollKey(groupId, id) { return `group:${groupId}:poll:${id}`; }
async function readIndex(ctx, groupId) {
  const value = await ctx.storage.get(indexKey(groupId), []);
  return Array.isArray(value) ? value.map(String).slice(-50) : [];
}
async function readPoll(ctx, groupId, id) {
  const value = await ctx.storage.get(pollKey(groupId, id), null);
  return value && typeof value === "object" ? value : null;
}
async function savePoll(ctx, poll) {
  const ids = await readIndex(ctx, poll.groupId);
  if (!ids.includes(poll.id)) {
    ids.push(poll.id);
    if (ids.length > 50) ids.splice(0, ids.length - 50);
    await ctx.storage.set(indexKey(poll.groupId), ids);
  }
  await ctx.storage.set(pollKey(poll.groupId, poll.id), poll);
}
async function findPoll(ctx, groupId, query) {
  const needle = String(query || "").trim();
  const ids = await readIndex(ctx, groupId);
  for (const id of ids.slice().reverse()) {
    const item = await readPoll(ctx, groupId, id);
    if (!item) continue;
    if (item.id === needle || item.title === needle) return item;
  }
  return null;
}
function pollSummary(item) {
  const votes = item?.votes && typeof item.votes === "object" ? item.votes : {};
  const counts = Array.from({ length: item.options.length }, () => 0);
  for (const raw of Object.values(votes)) {
    const index = Number(raw);
    if (Number.isInteger(index) && index >= 0 && index < counts.length) counts[index] += 1;
  }
  return item.options.map((option, index) => `${index + 1}. ${option} — ${counts[index]} 票`).join("\n");
}
function splitCreate(value) {
  return String(value || "").split(/\s*(?:\||｜)\s*/).map(v => v.trim()).filter(Boolean);
}

function createPollPlugin(options = {}) {
  const adminUserIds = new Set((Array.isArray(options.adminUserIds) ? options.adminUserIds : []).map(String));
  return definePlugin({
    manifest: {
      id: "official.poll",
      name: "QQAI 群投票",
      version: "1.0.0",
      apiVersion: "1",
      description: "獨立投票插件；投票資料、投票權與活動報名完全分開。",
      author: "QQAI",
      official: true,
      capabilities: ["message.read", "message.send", "storage"],
      requiredCapabilities: ["message.read", "message.send", "storage"]
    },
    async onMessage(ctx, message) {
      if (message?.scope !== "group" || !message.groupId) return null;
      const text = String(message?.text || "").trim();
      if (!/^[!！]/.test(text)) return null;
      const groupId = String(message.groupId);
      const userId = String(message.userId || "");

      let match = text.match(/^[!！](?:投票)\s*(?:建立|创建|創建)\s+([\s\S]+)$/i);
      if (match) {
        if (!roleCanManage(message, adminUserIds)) {
          await ctx.reply("只有群主、管理員或插件管理者可以建立投票。");
          return { consume: true, action: "poll_create_denied" };
        }
        const parts = splitCreate(match[1]);
        if (parts.length < 3) {
          await ctx.reply("格式：!投票 建立 問題 | 選項一 | 選項二（最多 10 個選項）。");
          return { consume: true, action: "poll_create_invalid" };
        }
        const title = parts.shift().slice(0, 160);
        const optionsList = parts.slice(0, 10).map(v => v.slice(0, 100));
        const id = `poll_${Date.now().toString(36)}`;
        const poll = { id, groupId, title, options: optionsList, votes: {}, ownerId: userId, closed: false, createdAt: Date.now(), updatedAt: Date.now() };
        await savePoll(ctx, poll);
        await ctx.reply(`投票已建立：${title}\n編號：${id}\n${pollSummary(poll)}\n\n投票方式：!投票 ${id} 選項序號`);
        return { consume: true, action: "poll_created", id };
      }

      match = text.match(/^[!！](?:投票)\s+(poll_[a-z0-9]+|[^\s]+)\s+(\d{1,2})$/i);
      if (match) {
        const poll = await findPoll(ctx, groupId, match[1]);
        if (!poll || poll.closed) {
          await ctx.reply("找不到可投票的項目。");
          return { consume: true, action: "poll_vote_missing" };
        }
        const choice = Number(match[2]) - 1;
        if (!Number.isInteger(choice) || choice < 0 || choice >= poll.options.length) {
          await ctx.reply(`請輸入 1～${poll.options.length} 的選項序號。`);
          return { consume: true, action: "poll_vote_invalid" };
        }
        poll.votes = { ...(poll.votes || {}), [userId]: choice };
        poll.updatedAt = Date.now();
        await savePoll(ctx, poll);
        await ctx.reply(`已記錄你的投票：${poll.options[choice]}\n目前結果：\n${pollSummary(poll)}`);
        return { consume: true, action: "poll_voted", id: poll.id };
      }

      match = text.match(/^[!！](?:投票)\s*(?:結束|结束|關閉|关闭)\s+(.+)$/i);
      if (match) {
        const poll = await findPoll(ctx, groupId, match[1]);
        if (!poll) {
          await ctx.reply("找不到這個投票。");
          return { consume: true, action: "poll_close_missing" };
        }
        if (!roleCanManage(message, adminUserIds) && poll.ownerId !== userId) {
          await ctx.reply("只有建立者、群管理員或群主可以結束投票。");
          return { consume: true, action: "poll_close_denied" };
        }
        poll.closed = true;
        poll.updatedAt = Date.now();
        await savePoll(ctx, poll);
        await ctx.reply(`投票「${poll.title}」已結束。\n${pollSummary(poll)}`);
        return { consume: true, action: "poll_closed", id: poll.id };
      }

      if (/^[!！](?:投票)\s*$/i.test(text)) {
        const ids = await readIndex(ctx, groupId);
        const rows = [];
        for (const id of ids.slice(-20).reverse()) {
          const poll = await readPoll(ctx, groupId, id);
          if (poll) rows.push(`${poll.id}｜${poll.title}｜${poll.closed ? "已結束" : "投票中"}`);
        }
        await ctx.reply(rows.length ? `【群投票】\n${rows.join("\n")}\n\n建立：!投票 建立 問題 | 選項一 | 選項二` : "目前沒有投票。建立方式：!投票 建立 問題 | 選項一 | 選項二");
        return { consume: true, action: "poll_list" };
      }
      return null;
    }
  });
}

export { createPollPlugin };
