import fs from "node:fs";

const path = "verify-spam-detection.mjs";
let source = fs.readFileSync(path, "utf8");
const before = 'assert(source.indexOf("const deterministicSpamReview") < source.indexOf("callGoogleDecision(env"), "Deterministic spam must be decided before AI review");';
const after = [
  'const inspectStart = source.indexOf("async function inspectMessageAgainstGroupRules");',
  'const inspectEnd = source.indexOf("async function createGroupWorkRequest", inspectStart);',
  'const inspectSource = source.slice(inspectStart, inspectEnd);',
  'assert(inspectSource.indexOf("const deterministicSpamReview") < inspectSource.indexOf("const result = await callGoogleDecision(env"), "Deterministic spam must be decided before AI review inside the rule inspector");'
].join("\n");
if (!source.includes(before)) throw new Error("Spam test ordering anchor missing");
source = source.replace(before, after);
fs.writeFileSync(path, source);
