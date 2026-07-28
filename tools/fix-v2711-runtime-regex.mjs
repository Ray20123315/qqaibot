import fs from "node:fs";

const file = "src/config/runtime.js";
let source = fs.readFileSync(file, "utf8");
const replacements = [
  [
    '/retry[_ -]?afters*[:=]?s*(d+(?:.d+)?)s*(seconds?|secs?|s)?/i,',
    '/retry[_ -]?after\\s*[:=]?\\s*(\\d+(?:\\.\\d+)?)\\s*(seconds?|secs?|s)?/i,'
  ],
  [
    '/(?:请|請)?s*(d+(?:.d+)?)s*(秒|分钟|分鐘|分|小时|小時|时|時|天)后(?:再试|重试|重試)/i,',
    '/(?:请|請)?\\s*(\\d+(?:\\.\\d+)?)\\s*(秒|分钟|分鐘|分|小时|小時|时|時|天)后(?:再试|重试|重試)/i,'
  ],
  [
    '/(?:retry|重试|重試)[^d]{0,16}(d+(?:.d+)?)s*(秒|分钟|分鐘|分|小时|小時|时|時|天)/i',
    '/(?:retry|重试|重試)[^\\d]{0,16}(\\d+(?:\\.\\d+)?)\\s*(秒|分钟|分鐘|分|小时|小時|时|時|天)/i'
  ]
];
let changed = 0;
for (const [before, after] of replacements) {
  if (source.includes(before)) {
    source = source.replace(before, after);
    changed += 1;
  }
}
if (changed !== replacements.length) throw new Error(`expected ${replacements.length} broken regexes, fixed ${changed}`);
fs.writeFileSync(file, source, "utf8");
console.log("fixed generated runtime retry regexes");
