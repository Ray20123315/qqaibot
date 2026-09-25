import assert from "node:assert/strict";
import {
  buildImmediateConversationContext,
  closeIncompleteReply,
  finishReasonReachedLimit,
  mergeContinuationText,
  splitOutboundText
} from "./src/ai/conversation-quality.js";
import { applySocialOutputPolicy } from "./src/social/runtime.js";
import { sanitizeAiReply } from "./src/onebot/messages.js";

assert.equal(finishReasonReachedLimit("MAX_TOKENS"), true);
assert.equal(finishReasonReachedLimit("length"), true);
assert.equal(finishReasonReachedLimit("STOP"), false);
assert.equal(mergeContinuationText("第一段最后一句重复文字", "重复文字，然后完成。"), "第一段最后一句重复文字，然后完成。");
assert.equal(closeIncompleteReply("第一句完整。第二句因为"), "第一句完整。");

const longDirect = "这是一个必须保留完整性的直接回答".repeat(35) + "。";
const directResult = applySocialOutputPolicy({
  text: longDirect,
  userText: "请详细解释",
  decision: { action: "reply", outputType: "micro_chat", maxChars: 24, sceneType: "casual" },
  profile: { style: { samples: 0, averageChars: 14 } },
  isGroup: true,
  explicitLong: true,
  direct: true
});
assert.equal(directResult, longDirect, "direct replies must not be cut to the social micro-chat suggestion");

const interjection = applySocialOutputPolicy({
  text: "这一句没有标点而且会持续很长很长很长很长很长很长很长很长",
  userText: "",
  decision: { action: "reply", outputType: "micro_chat", maxChars: 18, sceneType: "casual" },
  profile: { style: { samples: 0, averageChars: 8 } },
  isGroup: true,
  direct: false
});
assert.match(interjection, /…$/u, "optional interjection compaction must visibly close with an ellipsis rather than a silent raw slice");

const context = buildImmediateConversationContext({
  logs: ["[甲(QQ:10001)]: 我们正在讨论海龟汤", "[乙(QQ:10002)]: 红萝卜是腿部肌肉", "[汐梦(QQ:10003)]: 这个结论为什么成立"],
  currentText: "这个结论为什么成立",
  relationContext: "当前消息回复乙的上一条发言"
});
assert.match(context, /海龟汤/);
assert.match(context, /红萝卜是腿部肌肉/);
assert.match(context, /回复乙/);
assert.equal((context.match(/这个结论为什么成立/g) || []).length, 0, "current trigger must not be duplicated into prior context");

const raw = Array.from({ length: 120 }, (_, index) => `第${index + 1}句包含完整资料。`).join("");
const chunks = splitOutboundText(raw, { maxChars: 220, maxParts: 20, hardTotalChars: 12000 });
assert.ok(chunks.length > 1);
assert.equal(chunks.join(""), raw, "ordered outbound chunks must preserve all expected content");
assert.ok(chunks.every(chunk => [...chunk].length <= 220));

const sanitized = sanitizeAiReply("甲".repeat(5000) + "。");
assert.ok([...sanitized].length > 4000, "sanitization must no longer silently slice at 4000 characters");

const aiSource = await import("node:fs").then(fs => fs.readFileSync("src/ai/runtime.js", "utf8"));
assert.match(aiSource, /finishReason/);
assert.match(aiSource, /continueIfLimited/);
assert.match(aiSource, /continuationUsed/);
const worker = await import("node:fs").then(fs => fs.readFileSync("worker.js", "utf8"));
assert.match(worker, /buildImmediateConversationContext/);
assert.match(worker, /direct: !isAutoInterject/);
assert.match(worker, /reply_chunks/);
console.log("verify-ai-context-output: ok");
