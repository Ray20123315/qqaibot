import assert from "node:assert/strict";
import { createQqInteractionsPlugin, normalizeSettings } from "./src/plugins/official/qq-interactions.js";

const defaults = normalizeSettings();
assert.equal(defaults.pokeReplyEnabled, true);
assert.equal(defaults.messageReactionEnabled, true);
assert.equal(defaults.favoriteFaceEnabled, true);
assert.equal(defaults.mallFaceEnabled, true);
assert.equal(defaults.voiceReplyBetaEnabled, false, "voice beta must be opt-in");
assert.equal(normalizeSettings({ favoriteFaceCount: 99 }).favoriteFaceCount, 48);

const storage = new Map();
const calls = [];
const replies = [];
const ctx = {
  groupId: "10001",
  userId: "42",
  storage: {
    async get(key, fallback = null) { return storage.has(key) ? storage.get(key) : fallback; },
    async set(key, value) { storage.set(key, value); return value; }
  },
  onebot: {
    async call(action, params) {
      calls.push({ action, params });
      if (action === "fetch_custom_face") return { data: ["https://img.example/favorite.png"] };
      if (action === "get_ai_characters") return { data: [{ characters: [{ character_name: "A", character_id: "voice-a" }] }] };
      return { ok: true };
    }
  },
  async reply(message) { replies.push(message); return { ok: true }; }
};

const plugin = createQqInteractionsPlugin();
await plugin.onLoad(ctx);

let result = await plugin.onGroupMessage(ctx, { text: "!QQ語音 voice-a hello", parts: [] });
assert.equal(result.action, "voice_beta_disabled");
assert.equal(calls.some(call => call.action === "send_group_ai_record"), false);

result = await plugin.onGroupMessage(ctx, { text: "!戳戳", parts: [{ kind: "mention", userId: "123456" }] });
assert.equal(result.action, "poke");
assert(calls.some(call => call.action === "send_poke" && call.params.user_id === "123456"));

result = await plugin.onGroupMessage(ctx, { text: "!回應表情 66", parts: [{ kind: "reply", messageId: "777" }] });
assert.equal(result.action, "reaction");
assert(calls.some(call => call.action === "set_msg_emoji_like" && call.params.message_id === "777" && call.params.emoji_id === "66"));

result = await plugin.onGroupMessage(ctx, { text: "!收藏表情 1", parts: [] });
assert.equal(result.action, "favorite_face");
assert(calls.some(call => call.action === "fetch_custom_face"));
assert(Array.isArray(replies.at(-1)) && replies.at(-1)[0]?.kind === "image");

result = await plugin.onGroupMessage(ctx, { text: "!商城表情", parts: [{ kind: "mface", emojiId: "e1", packageId: "p1", key: "k", summary: "cat" }] });
assert.equal(result.action, "mface");
assert.equal(replies.at(-1)[0]?.kind, "mface");

await plugin.surface.updateSettings(ctx, { voiceReplyBetaEnabled: true });
result = await plugin.onGroupMessage(ctx, { text: "!QQ語音 voice-a hello", parts: [] });
assert.equal(result.action, "voice");
assert(calls.some(call => call.action === "send_group_ai_record" && call.params.character === "voice-a"));

const notice = await plugin.onNotice(ctx, { notice_type: "notify", sub_type: "poke", self_id: "999", user_id: "123456", target_id: "999", group_id: "10001" });
assert.equal(notice.action, "poke_back");

console.log("verify-v3-qq-interactions: ok");
