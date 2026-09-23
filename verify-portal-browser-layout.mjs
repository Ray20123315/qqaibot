import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { getPortalHomePage, getPortalLoginPage, getPortalRegisterPage, getPublicLandingPage } from "./src/portal/runtime.js";
import { injectPortalLayoutClient } from "./src/portal/layout.js";
import { injectPortalMembersClient } from "./src/portal/members.js";
import { injectDeploymentPortalClient } from "./src/deployment/notifications.js";

function findChrome() {
  const candidates = [
    process.env.CHROME_BIN,
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser"
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      if (path.isAbsolute(candidate) && fs.existsSync(candidate)) return candidate;
      const found = spawnSync("sh", ["-lc", "command -v " + JSON.stringify(candidate)], { encoding: "utf8" });
      if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
    } catch {}
  }
  throw new Error("Headless Chrome/Chromium is required for portal browser-layout regression");
}

const chrome = findChrome();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "qqai-layout-"));

const pages = {
  landing: {
    html: getPublicLandingPage(),
    selectors: [".shell", ".ray-landing", ".ray-landing-hero", ".ray-landing-copy", ".ray-hero-core", ".ray-feature-strip"]
  },
  login: {
    html: getPortalLoginPage(),
    selectors: [".shell", ".auth-wrap", ".auth-stage", ".auth-visual", ".auth-card"]
  },
  register: {
    html: getPortalRegisterPage(),
    selectors: [".shell", ".auth-wrap", ".auth-stage", ".auth-card", ".auth-visual"]
  },
  portal: {
    html: injectPortalLayoutClient(injectPortalMembersClient(injectDeploymentPortalClient(getPortalHomePage("aibot.ray2025.com")))),
    selectors: [".workspace-shell", ".workspace-main", ".workspace-content", ".workspace-hero", ".workspace-status-grid", ".ray-dashboard-grid"]
  }
};

function injectProbe(html, selectors) {
  const payload = JSON.stringify(selectors);
  const probe = `<script id="__browser_layout_probe">(function(){
    var selectors=${payload};
    function sample(){
      var vw=document.documentElement.clientWidth||window.innerWidth;
      var vh=document.documentElement.clientHeight||window.innerHeight;
      var out={vw:vw,vh:vh,docScrollWidth:document.documentElement.scrollWidth,bodyScrollWidth:document.body?document.body.scrollWidth:0,devicePixelRatio:window.devicePixelRatio||1,items:{}};
      selectors.forEach(function(sel){
        var el=document.querySelector(sel);
        if(!el){out.items[sel]={missing:true};return}
        var r=el.getBoundingClientRect(),cs=getComputedStyle(el);
        var visibleW=Math.max(0,Math.min(r.right,vw)-Math.max(r.left,0));
        var visibleH=Math.max(0,Math.min(r.bottom,vh)-Math.max(r.top,0));
        out.items[sel]={
          display:cs.display,position:cs.position,transform:cs.transform,
          left:Math.round(r.left*100)/100,right:Math.round(r.right*100)/100,
          top:Math.round(r.top*100)/100,bottom:Math.round(r.bottom*100)/100,
          width:Math.round(r.width*100)/100,height:Math.round(r.height*100)/100,
          visibleW:Math.round(visibleW*100)/100,visibleH:Math.round(visibleH*100)/100,
          marginLeft:cs.marginLeft,marginRight:cs.marginRight,
          overflowX:cs.overflowX,minWidth:cs.minWidth,maxWidth:cs.maxWidth
        };
      });
      document.title="QQAI_LAYOUT_PROBE:"+encodeURIComponent(JSON.stringify(out));
    }
    if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){requestAnimationFrame(function(){requestAnimationFrame(sample)})},{once:true});else requestAnimationFrame(function(){requestAnimationFrame(sample)});
  })();<\/script>`;
  return String(html).replace("</body>", probe + "</body>");
}

function runPage(name, config, width, height) {
  const file = path.join(tmp, name + "-" + width + ".html");
  fs.writeFileSync(file, injectProbe(config.html, config.selectors));
  const userDir = path.join(tmp, "chrome-" + name + "-" + width);
  fs.mkdirSync(userDir, { recursive: true });
  const result = spawnSync(chrome, [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--disable-background-networking",
    "--disable-default-apps",
    "--disable-extensions",
    "--disable-sync",
    "--no-first-run",
    "--hide-scrollbars",
    "--force-prefers-reduced-motion",
    "--allow-file-access-from-files",
    "--window-size=" + width + "," + height,
    "--virtual-time-budget=1500",
    "--user-data-dir=" + userDir,
    "--dump-dom",
    "file://" + file
  ], { encoding: "utf8", timeout: 30000, maxBuffer: 12 * 1024 * 1024 });
  assert.equal(result.status, 0, name + " Chrome failed: " + String(result.stderr || "").slice(-4000));
  const match = String(result.stdout || "").match(/<title>QQAI_LAYOUT_PROBE:([^<]+)<\/title>/i);
  assert.ok(match, name + " did not emit layout metrics. stderr=" + String(result.stderr || "").slice(-2500));
  const metrics = JSON.parse(decodeURIComponent(match[1].replaceAll("&amp;", "&")));
  console.log("layout", name, width, JSON.stringify(metrics));
  return metrics;
}

function assertLayout(name, width, metrics) {
  const tolerance = 3;
  assert.ok(metrics.vw > 0, name + " viewport must be measurable");
  for (const [selector, item] of Object.entries(metrics.items)) {
    assert.equal(item.missing, undefined, name + " missing primary selector " + selector);
    if (item.display === "none" || item.width === 0 || item.height === 0) continue;
    assert.ok(item.right > 0 && item.left < metrics.vw,
      name + " " + selector + " is wholly outside viewport @ " + width + ": " + JSON.stringify(item));
    assert.ok(item.visibleW >= Math.min(80, item.width * 0.25),
      name + " " + selector + " has almost no horizontal intersection @ " + width + ": " + JSON.stringify(item));
    assert.ok(item.left >= -tolerance,
      name + " " + selector + " starts left of viewport @ " + width + ": " + JSON.stringify(item));
    assert.ok(item.right <= metrics.vw + tolerance,
      name + " " + selector + " exceeds viewport right edge @ " + width + ": " + JSON.stringify(item));
  }
  assert.ok(metrics.docScrollWidth <= metrics.vw + tolerance,
    name + " document creates horizontal overflow @ " + width + ": " + JSON.stringify(metrics));
}

try {
  for (const [name, config] of Object.entries(pages)) {
    for (const [width, height] of [[390, 844], [1440, 900]]) {
      const metrics = runPage(name, config, width, height);
      assertLayout(name, width, metrics);
    }
  }
  console.log("verify-portal-browser-layout: ok");
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
