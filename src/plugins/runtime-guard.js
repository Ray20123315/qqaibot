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

export { enforcePluginRuntimeBoundary, runtimeSecurityFinding };
