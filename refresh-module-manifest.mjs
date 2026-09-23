import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const files = ["worker.js"];
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (entry.isFile() && entry.name.endsWith(".js")) files.push(file);
  }
}
walk("src");

const hash = createHash("sha256");
for (const file of [...files].sort()) {
  hash.update(file.replaceAll(path.sep, "/"));
  hash.update("\0");
  hash.update(fs.readFileSync(file));
  hash.update("\0");
}

const manifestPath = "src/module-manifest.json";
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
manifest.generatedAt = new Date().toISOString();
manifest.sourceSha256 = hash.digest("hex");
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Updated ${manifestPath} for ${files.length} JavaScript files.`);
