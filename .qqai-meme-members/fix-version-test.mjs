import fs from "node:fs";

const path = "verify-deployment-notifications.mjs";
let source = fs.readFileSync(path, "utf8");
const before = 'assert.equal(fallbackStatus.status.releaseVersion, "2.0.3");';
const after = 'assert.equal(fallbackStatus.status.releaseVersion, "2.0.4");';
if (!source.includes(before)) throw new Error("Deployment notification version assertion anchor not found");
source = source.replace(before, after);
fs.writeFileSync(path, source);
console.log("deployment notification version assertion updated");
