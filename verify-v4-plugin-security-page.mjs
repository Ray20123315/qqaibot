import assert from "node:assert/strict";
import { securityPage } from "./src/v3/public/plugin-security.js";

const html = securityPage({
  entries: [
    {
      pluginId: "demo.safe",
      version: "1.0.0",
      trustStatus: "uncertified",
      releaseChannel: "stable",
      status: "clear",
      riskLevel: "none",
      findings: [],
      hash: "SHOULD_NOT_RENDER",
      lastCheckedAt: Date.parse("2026-09-28T06:00:00Z")
    },
    {
      pluginId: "demo.blocked",
      version: "2.0.0",
      trustStatus: "uncertified",
      releaseChannel: "stable",
      status: "blocked",
      riskLevel: "critical",
      overrideAllowed: false,
      findings: [{
        code: "PLUGIN_CROSS_TENANT_WRITE",
        severity: "critical",
        summaryZh: "插件尝试跨账号读取资料。",
        impacts: ["cross_tenant", "other_users"],
        overrideAllowed: false
      }],
      hash: "SECRET_HASH_VALUE",
      lastCheckedAt: Date.parse("2026-09-28T06:00:00Z")
    }
  ]
});

assert.match(html, /插件安全检测中心/);
assert.match(html, /已阻止/);
assert.match(html, /检查正常/);
assert.match(html, /可能跨越其他账号或群组/);
assert.match(html, /可能影响其他使用者/);
assert.match(html, /不会在这个页面公开插件原始码/);
assert.doesNotMatch(html, /PLUGIN_CROSS_TENANT_WRITE/);
assert.doesNotMatch(html, /SECRET_HASH_VALUE|SHOULD_NOT_RENDER/);
assert.doesNotMatch(html, /SHA-256/);
assert.doesNotMatch(html, /api\/v3\/plugin-security/);
assert.doesNotMatch(html, /<pre|<code/i);
assert.match(html, /prefers-reduced-motion/);

console.log("verify-v4-plugin-security-page: ok");
