import fs from "node:fs";

for (const path of [
  ".qqai-fix-deploy-spam/patch-deploy.mjs",
  ".qqai-fix-deploy-spam/patch-spam.mjs"
]) {
  let source = fs.readFileSync(path, "utf8");
  const before = "return source.slice(0, index) + insertion + marker + source.slice(index);";
  const after = "return source.slice(0, index) + insertion + source.slice(index);";
  if (!source.includes(before)) throw new Error(`Insertion helper anchor missing in ${path}`);
  source = source.replace(before, after);
  fs.writeFileSync(path, source);
}
