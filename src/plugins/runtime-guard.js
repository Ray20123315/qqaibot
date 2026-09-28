import { NON_OVERRIDABLE_SECURITY_IMPACTS } from "./governance.js";
import { normalizeFinding } from "./security-center.js";

function clean(value, max = 180) {
  return String(value ?? "").trim().slice(0, max);
}

function runtimeSecurityFinding(input = {}) {
  const impacts = [...new Set((Array.isArray(input.impacts) ? input.impacts : [])
    .map(value => clean(value, 60).toLowerCase())
    .filter(Boolean))];
  return normalizeFinding({
    code: clean(input.code || "PLUGIN_RUNTIME_BOUNDARY_VIOLATION", 100),
    severity: input.severity || "critical",
    summaryZh: clean(input.summaryZh || input.summary || "插件在執行期間觸發平台安全邊界，已停止執行。", 500),
    impacts,
    source: "runtime"
  });
}

async function enforcePluginRuntimeBoundary({
  pluginId,
  version = "",
  hash = "",
  violation = {},
  terminate = null,
  securityCenter = null,
  actorId = "runtime"
} = {}) {
  const finding = runtimeSecurityFinding(violation);
  const mustStop = finding.overrideAllowed !== true || finding.impacts.some(impact => NON_OVERRIDABLE_SECURITY_IMPACTS.has(impact));
  if (!mustStop) return Object.freeze({ blocked: false, finding, securityRecord: null });

  if (typeof terminate === "function") {
    await terminate({ pluginId: clean(pluginId, 80), version: clean(version, 80), finding });
  }
  let securityRecord = null;
  if (securityCenter && typeof securityCenter.report === "function") {
    securityRecord = await securityCenter.report({
      pluginId: clean(pluginId, 80),
      version: clean(version, 80),
      hash: clean(hash, 80),
      trustStatus: "uncertified",
      releaseChannel: "stable",
      findings: [finding],
      actorId: clean(actorId, 80)
    });
  }
  return Object.freeze({ blocked: true, finding, securityRecord });
}

function pluginRuntimeViolationFromError(error) {
  const explicit = error?.pluginSecurityViolation;
  if (explicit && typeof explicit === "object" && !Array.isArray(explicit)) {
    return Object.freeze({
      code: clean(explicit.code || error?.code || error?.message || "PLUGIN_RUNTIME_BOUNDARY_VIOLATION", 100),
      severity: explicit.severity || "critical",
      summaryZh: clean(explicit.summaryZh || explicit.summary || "插件執行時觸發平台安全邊界。", 500),
      impacts: Array.isArray(explicit.impacts) ? explicit.impacts : []
    });
  }
  const code = clean(error?.code || error?.message || "", 180).toUpperCase();
  const rules = [
    [/PLUGIN_(?:CROSS[_-]?TENANT|OTHER[_-]?USER)/, ["cross_tenant", "other_users"], "插件嘗試跨使用者或跨租戶存取資料。"],
    [/PLUGIN_(?:CORE[_-]?SECRET|SECRET[_-]?ACCESS)/, ["core_secrets", "owner", "platform_integrity"], "插件嘗試存取平台核心 Secret 或擁有者憑證。"],
    [/PLUGIN_(?:SHARED[_-]?RESOURCE|GLOBAL[_-]?RESOURCE)/, ["shared_resources", "owner"], "插件嘗試未授權使用共享或全域資源。"],
    [/PLUGIN_(?:PLATFORM[_-]?INTEGRITY|SANDBOX[_-]?ESCAPE)/, ["platform_integrity"], "插件行為可能破壞執行環境或平台完整性。"],
    [/PLUGIN_(?:CROSS[_-]?PLUGIN)/, ["cross_plugin"], "插件嘗試跨越其他插件的隔離邊界。"]
  ];
  for (const [pattern, impacts, summaryZh] of rules) {
    if (!pattern.test(code)) continue;
    return Object.freeze({ code: code.slice(0, 100), severity: "critical", summaryZh, impacts });
  }
  return null;
}

export { enforcePluginRuntimeBoundary, pluginRuntimeViolationFromError, runtimeSecurityFinding };
