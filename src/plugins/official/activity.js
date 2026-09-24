import { definePlugin } from "../api.js";

function roleCanManage(message, adminUserIds) {
  const role = String(message?.senderRole || "member");
  return role === "owner" || role === "admin" || adminUserIds.has(String(message?.userId || ""));
}

function cleanTitle(value) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 120);
}

function indexKey(groupId) { return `group:${groupId}:index`; }
function activityKey(groupId, id) { return `group:${groupId}:activity:${id}`; }

async function readIndex(ctx, groupId) {
  const value = await ctx.storage.get(indexKey(groupId), []);
  return Array.isArray(value) ? value.map(String).slice(-50) : [];
}

async function readActivity(ctx, groupId, id) {
  const value = await ctx.storage.get(activityKey(groupId, id), null);
  return value && typeof value === "object" ? value : null;
}

async function saveActivity(ctx, record) {
  const ids = await readIndex(ctx, record.groupId);
  if (!ids.includes(record.id)) {
    ids.push(record.id);
    if (ids.length > 50) ids.splice(0, ids.length - 50);
    await ctx.storage.set(indexKey(record.groupId), ids);
  }
  await ctx.storage.set(activityKey(record.groupId, record.id), record);
}

async function findActivity(ctx, groupId, query) {
  const needle = String(query || "").trim();
  const ids = await readIndex(ctx, groupId);
  for (const id of ids.slice().reverse()) {
    const item = await readActivity(ctx, groupId, id);
    if (!item) continue;
    if (item.id === needle || item.title === needle) return item;
  }
  return null;
}

function activityLine(item) {
  const count = Array.isArray(item.members) ? item.members.length : 0;
  return `${item.id}｜${item.title}｜${item.closed ? "已結束" : "報名中"}｜${count} 人`;
}

function createActivityPlugin(options = {}) {
  const adminUserIds = new Set((Array.isArray(options.adminUserIds) ? options.adminUserIds : []).map(String));
  return definePlugin({
    manifest: {
      id: "official.activity",
      name: "QQAI 群活動",
      version: "1.0.0",
      apiVersion: "1",
      description: "活動建立、報名、取消報名與名單；和投票使用完全分離的資料與流程。",
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

      let match = text.match(/^[!！](?:活動|活动)\s*(?:建立|创建|創建)\s+([\s\S]+)$/i);
      if (match) {
        if (!roleCanManage(message, adminUserIds)) {
          await ctx.reply("只有群主、管理員或插件管理者可以建立活動。");
          return { consume: true, action: "activity_create_denied" };
        }
        const title = cleanTitle(match[1]);
        if (!title) {
          await ctx.reply("請提供活動名稱。");
          return { consume: true, action: "activity_create_invalid" };
        }
        const id = `act_${Date.now().toString(36)}`;
        const record = { id, groupId, title, ownerId: userId, members: [], closed: false, createdAt: Date.now(), updatedAt: Date.now() };
        await saveActivity(ctx, record);
        await ctx.reply(`活動已建立：${title}\n編號：${id}\n使用「!報名 ${id}」加入。`);
        return { consume: true, action: "activity_created", id };
      }

      match = text.match(/^[!！](?:報名|报名)\s+(.+)$/i);
      if (match) {
        const item = await findActivity(ctx, groupId, match[1]);
        if (!item || item.closed) {
          await ctx.reply("找不到可報名的活動。");
          return { consume: true, action: "activity_join_missing" };
        }
        const members = Array.isArray(item.members) ? item.members.map(String) : [];
        if (!members.includes(userId)) members.push(userId);
        item.members = members.slice(0, 5000);
        item.updatedAt = Date.now();
        await saveActivity(ctx, item);
        await ctx.reply(`已報名「${item.title}」。目前共 ${item.members.length} 人。`);
        return { consume: true, action: "activity_joined", id: item.id };
      }

      match = text.match(/^[!！](?:取消報名|取消报名)\s+(.+)$/i);
      if (match) {
        const item = await findActivity(ctx, groupId, match[1]);
        if (!item) {
          await ctx.reply("找不到這個活動。");
          return { consume: true, action: "activity_leave_missing" };
        }
        item.members = (Array.isArray(item.members) ? item.members : []).map(String).filter(id => id !== userId);
        item.updatedAt = Date.now();
        await saveActivity(ctx, item);
        await ctx.reply(`已取消「${item.title}」的報名。`);
        return { consume: true, action: "activity_left", id: item.id };
      }

      match = text.match(/^[!！](?:活動名單|活动名单)\s+(.+)$/i);
      if (match) {
        const item = await findActivity(ctx, groupId, match[1]);
        if (!item) {
          await ctx.reply("找不到這個活動。");
          return { consume: true, action: "activity_roster_missing" };
        }
        const members = Array.isArray(item.members) ? item.members : [];
        await ctx.reply(`【${item.title}】報名名單（${members.length}）\n${members.length ? members.map((id, i) => `${i + 1}. QQ ${id}`).join("\n") : "目前沒有人報名。"}`);
        return { consume: true, action: "activity_roster", id: item.id };
      }

      if (/^[!！](?:活動|活动)\s*$/i.test(text)) {
        const ids = await readIndex(ctx, groupId);
        const rows = [];
        for (const id of ids.slice(-20).reverse()) {
          const item = await readActivity(ctx, groupId, id);
          if (item) rows.push(activityLine(item));
        }
        await ctx.reply(rows.length ? `【群活動】\n${rows.join("\n")}\n\n建立：!活動 建立 活動名稱` : "目前沒有活動。建立方式：!活動 建立 活動名稱");
        return { consume: true, action: "activity_list" };
      }
      return null;
    }
  });
}

export { createActivityPlugin };
