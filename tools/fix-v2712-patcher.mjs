import fs from "node:fs";

const path = "tools/apply-v2.7.12.mjs";
let source = fs.readFileSync(path, "utf8");
const marker = 'if (worker.includes("3569028262") || worker.includes("env.DEVELOPER_ID")) {';
if (!source.includes(marker)) throw new Error("v2.7.12 patcher guard marker not found");
const addition = `worker = worker.replace(
  'if (userId === String(env.DEVELOPER_ID || "") || String(requester?.role || "") === "owner")',
  'if (isDeveloperId(env, userId) || String(requester?.role || "") === "owner")'
);
worker = worker.replace(
  'if (targetId === userId || targetId === botId || targetId === String(env.DEVELOPER_ID || ""))',
  'if (targetId === userId || targetId === botId || isDeveloperId(env, targetId))'
);
`;
source = source.replace(marker, addition + marker);

const oldFixtureLine = '  if (source.includes("2.7.11")) write(path, source.replaceAll("2.7.11", "2.7.12"));';
const newFixtureLine = '  if (source.includes("2.7.11") || source.includes("2\\\\.7\\\\.11")) write(path, source.replaceAll("2.7.11", "2.7.12").replaceAll("2\\\\.7\\\\.11", "2\\\\.7\\\\.12"));';
if (!source.includes(oldFixtureLine)) throw new Error("version fixture replacement line not found");
source = source.replace(oldFixtureLine, newFixtureLine);

fs.writeFileSync(path, source, "utf8");
console.log("patched remaining multi-developer checks and escaped version fixtures");
