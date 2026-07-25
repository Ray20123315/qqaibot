import fs from "node:fs";

function read(path) { return fs.readFileSync(path, "utf8"); }
function write(path, value) { fs.writeFileSync(path, value); }
function replaceOnce(source, before, after, label) {
  const index = source.indexOf(before);
  if (index < 0) throw new Error(`Missing patch anchor: ${label}`);
  if (source.indexOf(before, index + before.length) >= 0) throw new Error(`Ambiguous patch anchor: ${label}`);
  return source.slice(0, index) + after + source.slice(index + before.length);
}

let config = read("src/config/runtime.js");
config = replaceOnce(config, 'const VERSION = "2.0.2";', 'const VERSION = "2.0.3";', "runtime version");
write("src/config/runtime.js", config);

const pkg = JSON.parse(read("package.json"));
pkg.version = "2.0.3";
if (!String(pkg.scripts.check).includes("verify-spam-detection.mjs")) pkg.scripts.check += " && node verify-spam-detection.mjs";
write("package.json", JSON.stringify(pkg, null, 2) + "\n");

const release = {
  version: "2.0.3",
  notificationPolicy: "latest-main-only-with-runtime-success-fallback",
  queueDelivery: "mark-processed-after-success",
  added: [
    "部署成功通知的运行时自检备援",
    "重复与高度相似消息的确定性刷屏检测"
  ],
  fixed: [
    "未配置 Cloudflare Build Event Queue 时完全没有成功通知",
    "群规为空时刷屏检测被提前跳过",
    "单条变体消息重置连续计数导致漏判刷屏",
    "确定性刷屏仍受 AI 置信度影响"
  ]
};
write("release-notes.json", JSON.stringify(release, null, 2) + "\n");

let wrangler = read("wrangler.toml");
wrangler = replaceOnce(
  wrangler,
  'DEPLOY_NOTIFY_START_COOLDOWN_SECONDS = "600"',
  'DEPLOY_NOTIFY_START_COOLDOWN_SECONDS = "600"\nDEPLOY_NOTIFY_SELF_GRACE_SECONDS = "90"',
  "deployment fallback grace variable"
);
write("wrangler.toml", wrangler);
