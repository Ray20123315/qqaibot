import fs from "node:fs";

const path = ".qqai-meme-members/patch.mjs";
let source = fs.readFileSync(path, "utf8");
const beforeStart = '      system: `你是 QQ 群聊流行梗与接龙语境核查器。';
const afterStart = '      system: \\`你是 QQ 群聊流行梗与接龙语境核查器。';
const beforeEnd = '4. 当前流行趋势优先使用搜索结果；不要编造梗名称或来源。`,';
const afterEnd = '4. 当前流行趋势优先使用搜索结果；不要编造梗名称或来源。\\`,';
if (!source.includes(beforeStart) || !source.includes(beforeEnd)) throw new Error("Nested meme prompt template anchors not found");
source = source.replace(beforeStart, afterStart).replace(beforeEnd, afterEnd);
fs.writeFileSync(path, source);
console.log("nested meme prompt template repaired");
