import fs from "node:fs";
import assert from "node:assert/strict";
import { buildMeetingMinuteBatches, normalizeMeetingMinuteCount, splitOutboundText } from "./src/ai/conversation-quality.js";
import { DEFAULTS } from "./src/config/runtime.js";

assert.equal(normalizeMeetingMinuteCount("500"), 500);
assert.equal(normalizeMeetingMinuteCount("999"), 500);
assert.equal(normalizeMeetingMinuteCount("1"), 10);
assert.equal(normalizeMeetingMinuteCount(undefined), 50);

const logs = Array.from({ length: 500 }, (_, index) => `[群友${index % 12}(QQ:${10000 + index})]: 第 ${index + 1} 条记录`);
const batches = buildMeetingMinuteBatches(logs, { requested: 500, maxBatches: 3 });
assert.equal(batches.length, 3, "500 messages must use at most three bounded source batches");
assert.deepEqual(batches.flat(), logs, "batching must preserve all requested records in order");
assert.ok(batches.every(batch => batch.length <= 170));
assert.ok(DEFAULTS.groupContextMaximumMessages >= 500, "recent log retention must support a 500-message request");
assert.equal(DEFAULTS.meetingMinutesMaximumMessages, 500);

const worker = fs.readFileSync("worker.js", "utf8");
assert.match(worker, /normalizeMeetingMinuteCount\(meetingMatch\[1\]/);
assert.match(worker, /buildMeetingMinuteBatches\(targetLogs/);
assert.match(worker, /Promise\.all\(batches\.map/);
assert.match(worker, /reply_kind: "meeting_minutes"/);
assert.doesNotMatch(worker, /if \(count > 200\) count = 200/);
assert.match(worker, /type: "minutes"/);

const minuteText = "【覆盖范围】500 条。\n" + "【讨论推进】内容完整。\n".repeat(180);
const parts = splitOutboundText(minuteText, { maxChars: 500, maxParts: 10, hardTotalChars: 12000 });
assert.ok(parts.length > 1);
assert.equal(parts.join("").replace(/\s+/g, ""), minuteText.trim().replace(/\s+/g, ""));

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
assert.equal(pkg.version, "2.7.7");
assert.match(pkg.scripts.check, /verify-ai-context-output\.mjs/);
assert.match(pkg.scripts.check, /verify-meeting-minutes\.mjs/);
console.log("verify-meeting-minutes: ok");
