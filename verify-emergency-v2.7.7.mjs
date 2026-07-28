import fs from "node:fs";

const worker = fs.readFileSync("worker.js", "utf8");
const portal = fs.readFileSync("src/portal/runtime.js", "utf8");
const moderation = fs.readFileSync("src/moderation/runtime.js", "utf8");
const config = fs.readFileSync("src/config/runtime.js", "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

function check(condition, message) {
  if (!condition) throw new Error(message);
}

check(config.includes('const VERSION = "2.7.11";'), "runtime version must be 2.7.11");
check(pkg.version === "2.7.11", "package version must be 2.7.11");

// Robot-account manual input remains allowed while outbound echoes remain blocked.
check(worker.includes("const isSelfAccount = Boolean(userId && eventSelfId && userId === eventSelfId);"), "same-account identity detection missing");
check(worker.includes("cleanMessage.startsWith('//')") && worker.includes("explicitSelfCommand"), "same-account // and ! controls missing");
check(worker.includes("await isKnownOutboundMessage(env"), "same-account outbound echo guard missing");
check(worker.includes("if (!isSentEvent && !explicitSelfChat && !explicitSelfCommand) return new Response(null, { status: 204 });"), "same-account non-command safety gate missing");

// Political conversation is dropped before model intent classification and direct [SKIP] is silent.
const politicalIndex = worker.indexOf("political_topic_silent_drop");
const naturalIntentIndex = worker.indexOf("const naturalLanguageTrigger");
check(politicalIndex >= 0 && naturalIntentIndex >= 0 && politicalIndex < naturalIntentIndex, "political filter must run before natural-language model classification");
check(worker.includes("if (!isCommandMessage && isPoliticalTopicText(cleanMessage))"), "political command exemption or silent filter missing");
check(worker.includes('reason: isAutoInterject ? "model_declined_interjection" : "model_declined_response"'), "direct model [SKIP] must be silent");
check(!worker.includes("严厉警告机制"), "political topics must not produce warning replies");

// Non-whitelisted groups never receive failure notices.
check(worker.includes("failure_notice_suppressed_non_whitelist"), "non-whitelist failure suppression missing");
check(worker.includes("!(await isGroupWhitelisted(this.env, groupId))"), "failure notice whitelist gate missing");

// Repeated tiny replies such as ??? cannot spam the group.
check(worker.includes("shouldSuppressRepeatedShortReply"), "short reply repeat guard missing");
check(worker.includes("repeated_short_reply_guard"), "short reply suppression audit missing");
check(worker.includes("short_reply_guard:${String(groupId)}"), "short reply guard must be group scoped");

// Conversation API and UI use server-side pagination, default 20 and hard maximum 100.
check(portal.includes("const pageSize = Math.max(1, Math.min(100, requestedPageSize));"), "conversation API must cap pages at 100");
check(portal.includes('url.searchParams.get("pageSize")') && /pageSize:\s*String\(conversationPageSize\)/.test(portal), "conversation pageSize contract missing");
check(portal.includes("conversationPageSize=20") && portal.includes('<option value="100">100</option>'), "conversation pager defaults/options missing");
check(portal.includes("conversationRequestSerial") && portal.includes("serial!==conversationRequestSerial"), "stale conversation responses must not overwrite newer pages");
const loadStart = portal.indexOf("async function loadConversations(");
const loadEnd = portal.indexOf("function safeAttachmentUrl", loadStart);
const loadFunction = loadStart >= 0 ? portal.slice(loadStart, loadEnd > loadStart ? loadEnd : loadStart + 8000) : "";
check(loadFunction && !loadFunction.includes("limit:'500'"), "legacy 500-row conversation load still present in loadConversations");

// Adaptive violation strictness was already implemented and must remain active.
check(config.includes('ruleStrictness: "smart"'), "default rule strictness must be smart");
check(moderation.includes('"智慧": "smart"') && moderation.includes("resolveAdaptiveRuleStrictness"), "adaptive violation strictness missing");
check(moderation.includes("近期人工复核或撤销发现") && moderation.includes("暂时提高敏感度"), "adaptive violation feedback signals missing");

console.log("Emergency v2.7.11 regression checks passed.");
