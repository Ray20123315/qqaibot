import fs from "node:fs";

const file = "tools/apply-v2.7.11.mjs";
const source = fs.readFileSync(file, "utf8");
const start = source.indexOf("const failureBlock = `");
const end = source.indexOf("\n`;", start);
if (start < 0 || end < 0) throw new Error("failureBlock not found");
const block = source.slice(start, end);
const fixed = block.replace(/(?<!\\)\\([sd.])/g, "\\\\$1");
if (fixed === block) throw new Error("no regex escapes repaired");
fs.writeFileSync(file, source.slice(0, start) + fixed + source.slice(end), "utf8");
console.log("fixed v2.7.11 patcher regex escapes");
