import fs from "node:fs";

function replaceOnce(source, before, after, label) {
  const index = source.indexOf(before);
  if (index < 0) throw new Error(`Missing patch anchor: ${label}`);
  if (source.indexOf(before, index + before.length) >= 0) throw new Error(`Ambiguous patch anchor: ${label}`);
  return source.slice(0, index) + after + source.slice(index + before.length);
}

{
  const path = "src/moderation/runtime.js";
  let source = fs.readFileSync(path, "utf8");
  const before = '  const explicitMemeSpamRule = Boolean(rules && /(?:禁止|严禁|嚴禁|不得).{0,12}(?:刷屏|复读|復讀|接龙|接龍|玩梗)|(?:刷屏|复读|復讀|接龙|接龍|玩梗).{0,12}(?:禁止|严禁|嚴禁|不得)/i.test(rules));';
  const after = '  const explicitMemeSpamRule = Boolean(rules && /(?:禁止|严禁|嚴禁|不得|违规|違規|处罚|處罰|警告|撤回|禁言|踢出).{0,20}(?:刷屏|复读|復讀|接龙|接龍|玩梗)|(?:刷屏|复读|復讀|接龙|接龍|玩梗).{0,20}(?:禁止|严禁|嚴禁|不得|违规|違規|处罚|處罰|警告|撤回|禁言|踢出)/i.test(rules));';
  source = replaceOnce(source, before, after, "explicit group-rule priority for meme spam");
  fs.writeFileSync(path, source);
}

{
  const path = "src/portal/members.js";
  let source = fs.readFileSync(path, "utf8");
  source = replaceOnce(
    source,
    'function normalizeMember(raw) {\n  const nowSeconds = Math.floor(Date.now() / 1000);\n  const muteUntilSeconds = Math.max(0, Number(raw?.shut_up_timestamp || raw?.muteUntil || raw?.mute_until || 0));',
    'function normalizeEpochMs(primarySeconds, fallbackValue = 0) {\n  const primary = Number(primarySeconds || 0);\n  if (primary > 0) return primary > 100000000000 ? primary : primary * 1000;\n  const fallback = Number(fallbackValue || 0);\n  if (fallback <= 0) return 0;\n  return fallback > 100000000000 ? fallback : fallback * 1000;\n}\n\nfunction normalizeMember(raw) {\n  const now = Date.now();\n  const muteUntil = normalizeEpochMs(raw?.shut_up_timestamp ?? raw?.mute_until, raw?.muteUntil);',
    "idempotent epoch normalization"
  );
  source = replaceOnce(
    source,
    '    muted: muteUntilSeconds > nowSeconds,\n    muteUntil: muteUntilSeconds > 0 ? muteUntilSeconds * 1000 : 0,\n    muteRemainingSeconds: muteUntilSeconds > nowSeconds ? muteUntilSeconds - nowSeconds : 0,\n    joinTime: Number(raw?.join_time || raw?.joinTime || 0) * (Number(raw?.join_time || 0) > 100000000000 ? 1 : 1000),\n    lastSentTime: Number(raw?.last_sent_time || raw?.lastSentTime || 0) * (Number(raw?.last_sent_time || 0) > 100000000000 ? 1 : 1000),',
    '    muted: muteUntil > now,\n    muteUntil,\n    muteRemainingSeconds: muteUntil > now ? Math.ceil((muteUntil - now) / 1000) : 0,\n    joinTime: normalizeEpochMs(raw?.join_time, raw?.joinTime),\n    lastSentTime: normalizeEpochMs(raw?.last_sent_time, raw?.lastSentTime),',
    "member timestamp fields"
  );
  source = replaceOnce(
    source,
    'export { handlePortalMemberApi, injectPortalMembersClient, listPortalMembers, memberConsoleAllowed, normalizeMember, parseMuteSeconds };',
    'export { handlePortalMemberApi, injectPortalMembersClient, listPortalMembers, memberConsoleAllowed, normalizeEpochMs, normalizeMember, parseMuteSeconds };',
    "member timestamp export"
  );
  fs.writeFileSync(path, source);
}

{
  const path = "verify-meme-member-console.mjs";
  let source = fs.readFileSync(path, "utf8");
  source = replaceOnce(
    source,
    '  memberConsoleAllowed,\n  normalizeMember,',
    '  memberConsoleAllowed,\n  normalizeEpochMs,\n  normalizeMember,',
    "timestamp helper test import"
  );
  source = replaceOnce(
    source,
    'assert.equal(parseMuteSeconds("bad"), 0);',
    'assert.equal(parseMuteSeconds("bad"), 0);\nassert.equal(normalizeEpochMs(1700000000, 0), 1700000000000);\nassert.equal(normalizeEpochMs(0, 1700000000000), 1700000000000);',
    "epoch helper assertions"
  );
  source = replaceOnce(
    source,
    'assert(member.muteRemainingSeconds >= 115 && member.muteRemainingSeconds <= 120);',
    'assert(member.muteRemainingSeconds >= 115 && member.muteRemainingSeconds <= 120);\nconst cachedMember = normalizeMember(member);\nassert.equal(cachedMember.muteUntil, member.muteUntil, "Cached normalized member timestamps must not be multiplied again");\nassert(cachedMember.muteRemainingSeconds >= 115 && cachedMember.muteRemainingSeconds <= 120);',
    "cached member assertion"
  );
  source = replaceOnce(
    source,
    'assert(moderation.includes("搜不到只能视为未知"), "A failed search must not be treated as proof that something is not a meme");',
    'assert(moderation.includes("搜不到只能视为未知"), "A failed search must not be treated as proof that something is not a meme");\nassert(moderation.includes("警告|撤回|禁言|踢出"), "Explicit group-rule punishments must override meme exemptions");',
    "group-rule priority assertion"
  );
  fs.writeFileSync(path, source);
}

console.log("final review fixes applied");
