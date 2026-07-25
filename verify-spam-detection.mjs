import assert from "node:assert/strict";
import fs from "node:fs";
import { detectRepeatedMessageBurst } from "./src/moderation/runtime.js";

const exactRows = [
  { messageId: "1", text: "我要告老师了" },
  { messageId: "2", text: "我要告老师了" },
  { messageId: "3", text: "我要告老师了" },
  { messageId: "4", text: "我要告老师了" }
];
const exact = detectRepeatedMessageBurst(exactRows, "我要告老师了", 4, 3);
assert.equal(exact.repeatedMessageBurst, true, "Four identical messages must be deterministic spam");
assert.equal(exact.exactSameCount, 4);
assert.deepEqual(exact.repeatedMessageIds, ["4"]);

const variantRows = [
  { messageId: "a", text: "我要告老师了" },
  { messageId: "b", text: "我要告老师吗" },
  { messageId: "c", text: "我要告老师了" },
  { messageId: "d", text: "我要告老师呢" },
  { messageId: "e", text: "我要告老师了" }
];
const variant = detectRepeatedMessageBurst(variantRows, "我要告老师了", 4, 3);
assert.equal(variant.repeatedMessageBurst, true, "Near-identical variants must not reset spam detection");
assert.equal(variant.exactSameCount, 3);
assert.equal(variant.similarMessageCount, 5);

const source = fs.readFileSync("src/moderation/runtime.js", "utf8");
assert(!source.includes('if (!rules) return { status: "no_rules" };'), "Spam detection must run without configured group rules");
const inspectStart = source.indexOf("async function inspectMessageAgainstGroupRules");
const inspectEnd = source.indexOf("async function createGroupWorkRequest", inspectStart);
const inspectSource = source.slice(inspectStart, inspectEnd);
assert(inspectSource.indexOf("const deterministicSpamReview") < inspectSource.indexOf("const result = await callGoogleDecision(env"), "Deterministic spam must be decided before AI review inside the rule inspector");
assert(source.includes("if (deterministicSpamReview)"), "Deterministic spam must bypass AI review");
console.log("spam detection checks passed");
