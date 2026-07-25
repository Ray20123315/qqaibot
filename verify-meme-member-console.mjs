import assert from "node:assert/strict";
import fs from "node:fs";
import {
  injectPortalMembersClient,
  memberConsoleAllowed,
  normalizeMember,
  parseMuteSeconds
} from "./src/portal/members.js";

assert.equal(memberConsoleAllowed({ role: "admin", permissions: {} }), true, "QQ administrators must access the member console");
assert.equal(memberConsoleAllowed({ role: "member", permissions: { groupOps: true } }), true, "Delegated group operators must access the member console");
assert.equal(memberConsoleAllowed({ role: "member", permissions: {} }), false, "Ordinary members must not access the member console");

assert.equal(parseMuteSeconds(60), 60);
assert.equal(parseMuteSeconds("1"), 1, "Mute duration must support seconds directly");
assert.equal(parseMuteSeconds(31 * 24 * 3600), 30 * 24 * 3600, "Mute duration must clamp to the OneBot safety maximum");
assert.equal(parseMuteSeconds(0), 0);
assert.equal(parseMuteSeconds("bad"), 0);

const nowSeconds = Math.floor(Date.now() / 1000);
const member = normalizeMember({
  user_id: 123456,
  nickname: "测试成员",
  card: "群名片",
  role: "admin",
  shut_up_timestamp: nowSeconds + 120
});
assert.equal(member.qq, "123456");
assert.equal(member.name, "群名片");
assert.equal(member.role, "admin");
assert.equal(member.muted, true);
assert(member.muteRemainingSeconds >= 115 && member.muteRemainingSeconds <= 120);

const sampleHtml = '<!doctype html><html><head></head><body><nav><button data-view="logs">操作日志</button></nav><main><section id="v-logs" class="view"></section></main></body></html>';
const injected = injectPortalMembersClient(sampleHtml);
assert(injected.includes('id="memberConsoleNav"'), "Member navigation must be injected");
assert(injected.includes('id="v-members"'), "Member console page must be injected");
assert(injected.includes('id="qqai-member-console-client"'), "Member console client must be injected");
assert(injected.includes('禁言（秒）'), "Member console must expose second-based mute controls");
assert(injected.includes('member-unmute'), "Member console must expose unmute controls");
assert.equal(injectPortalMembersClient(injected), injected, "Portal injection must be idempotent");

const moderation = fs.readFileSync("src/moderation/runtime.js", "utf8");
assert(moderation.includes("async function verifyRuleMemeContext"), "Meme verification helper must exist");
assert(moderation.includes("useSearch: true"), "Meme verification must support current web search");
assert(moderation.includes("const spamEvidence = repeatedMessageBurst"), "Repeated messages must first become evidence, not an automatic final verdict");
assert(moderation.includes("const memeProtected = repeatedMessageBurst"), "Verified meme and chain context must be able to prevent a false spam penalty");
assert(moderation.includes("learnedMemeExamples"), "Manager-confirmed group memes must be reused in later decisions");
assert(moderation.includes("搜不到只能视为未知"), "A failed search must not be treated as proof that something is not a meme");
assert(!moderation.includes("const deterministicSpamReview = repeatedMessageBurst ? {"), "The old unconditional deterministic spam verdict must be removed");

const portal = fs.readFileSync("src/portal/runtime.js", "utf8");
assert(portal.includes('import { handlePortalMemberApi } from "./members.js";'), "Portal member API must be imported");
assert(portal.includes("const memberResponse = await handlePortalMemberApi"), "Portal member routes must be dispatched");

const memberModule = fs.readFileSync("src/portal/members.js", "utf8");
assert(memberModule.includes('path === "/members/history"'), "Member history route must exist");
assert(memberModule.includes('path === "/members/mute"'), "Member mute route must exist");
assert(memberModule.includes('path === "/members/unmute"'), "Member unmute route must exist");
assert(memberModule.includes("duration: 0"), "Unmute must use OneBot duration 0");
assert(memberModule.includes("portal_member_history_view"), "History access must be audited");
assert(memberModule.includes("portal_member_mute"), "Mute actions must be audited");
assert(memberModule.includes("portal_member_unmute"), "Unmute actions must be audited");

const worker = fs.readFileSync("worker.js", "utf8");
assert(worker.includes("injectPortalMembersClient"), "The single Worker entry must inject the member console");
assert(fs.readFileSync("wrangler.toml", "utf8").includes('main = "worker.js"'), "Deployment must remain one Cloudflare Worker");

console.log("meme-aware moderation and member console checks passed");
