const PLUGIN_TRUST_STATUSES = Object.freeze(["official", "official_beta", "official_certified", "uncertified"]);
const PLUGIN_RELEASE_CHANNELS = Object.freeze(["stable", "preview"]);
const PLUGIN_PERMISSION_ACCESS_TYPES = Object.freeze(["read", "write", "action", "external"]);

const CAPABILITY_DISCLOSURES = Object.freeze({
  "message.read": Object.freeze({ labelZh: "讀取訊息", accessTypes: Object.freeze(["read"]), descriptionZh: "讀取傳給插件的標準化 QQ 訊息內容。" }),
  "message.send": Object.freeze({ labelZh: "發送訊息", accessTypes: Object.freeze(["action"]), descriptionZh: "代表你在允許的對話範圍內發送 QQ 訊息。" }),
  "media.read": Object.freeze({ labelZh: "讀取圖片／語音／影片／檔案", accessTypes: Object.freeze(["read"]), descriptionZh: "解析你交給插件的媒體內容；未授權時媒體識別資訊會被隱藏。" }),
  "media.send": Object.freeze({ labelZh: "發送媒體", accessTypes: Object.freeze(["action"]), descriptionZh: "發送圖片、語音、影片、檔案或 QQ 表情媒體。" }),
  "onebot.call": Object.freeze({ labelZh: "呼叫受限 OneBot 功能", accessTypes: Object.freeze(["action"]), descriptionZh: "只能呼叫 QQAI Host 明確允許的 OneBot 動作，不會取得 OneBot Token。" }),
  "ai.chat": Object.freeze({ labelZh: "使用文字 AI", accessTypes: Object.freeze(["external"]), descriptionZh: "將必要內容交由已設定的 AI Provider 處理；插件本身看不到 API Key。" }),
  "ai.vision": Object.freeze({ labelZh: "使用圖片 AI", accessTypes: Object.freeze(["read", "external"]), descriptionZh: "讀取授權圖片並交由已設定的 AI Provider 分析。" }),
  "ai.multimodal": Object.freeze({ labelZh: "使用多模態 AI", accessTypes: Object.freeze(["read", "external"]), descriptionZh: "將授權的訊息與媒體交由已設定的 AI Provider 分析。" }),
  "ai.tts": Object.freeze({ labelZh: "使用語音合成", accessTypes: Object.freeze(["external"]), descriptionZh: "將文字交由已設定的 TTS Provider 產生語音；不代表自動取得發送權限。" }),
  "storage": Object.freeze({ labelZh: "讀寫插件自己的資料", accessTypes: Object.freeze(["read", "write"]), descriptionZh: "只能存取此插件自己的 namespaced storage，不會取得原始 D1 binding。" }),
  "scheduler": Object.freeze({ labelZh: "建立與管理插件排程", accessTypes: Object.freeze(["action"]), descriptionZh: "只能建立、查看與取消此插件自己的排程。" }),
  "network": Object.freeze({ labelZh: "連線外部網站／API", accessTypes: Object.freeze(["external"]), descriptionZh: "透過 QQAI 安全網路層連線外部服務；外部傳輸目的地應由插件額外揭露。" }),
  "group.read": Object.freeze({ labelZh: "讀取群組資料", accessTypes: Object.freeze(["read"]), descriptionZh: "讀取已授權範圍內的群組基本資料。" }),
  "group.manage": Object.freeze({ labelZh: "管理群組", accessTypes: Object.freeze(["action"]), descriptionZh: "執行已授權且受 QQAI Host 限制的群組管理操作。" }),
  "member.read": Object.freeze({ labelZh: "讀取群成員資料", accessTypes: Object.freeze(["read"]), descriptionZh: "讀取已授權群組內的成員基本資料。" }),
  "member.manage": Object.freeze({ labelZh: "管理群成員", accessTypes: Object.freeze(["action"]), descriptionZh: "執行已授權且受 QQAI Host 限制的成員管理操作。" }),
  "portal.route": Object.freeze({ labelZh: "提供 Portal 功能", accessTypes: Object.freeze(["action"]), descriptionZh: "在 QQAI Portal 提供受控的插件管理介面或路由。" })
});

const NON_OVERRIDABLE_SECURITY_IMPACTS = Object.freeze(new Set([
  "owner",
  "other_users",
  "shared_resources",
  "core_secrets",
  "platform_integrity",
  "cross_plugin",
  "cross_tenant"
]));

function cleanText(value, max = 240) {
  return String(value ?? "").trim().slice(0, max);
}

function normalizePluginTrustStatus(source = {}) {
  const explicit = cleanText(source?.trustStatus || source?.trust_status, 40).toLowerCase();
  if (PLUGIN_TRUST_STATUSES.includes(explicit)) return explicit;
  if (source?.official === true) return source?.officialBeta === true || source?.beta === true ? "official_beta" : "official";
  if (source?.certified === true || source?.officialCertified === true) return "official_certified";
  return "uncertified";
}

function pluginTrustLabelZh(value) {
  const status = PLUGIN_TRUST_STATUSES.includes(String(value || "")) ? String(value) : "uncertified";
  return Object.freeze({
    official: "官方",
    official_beta: "官方 Beta",
    official_certified: "官方認證",
    uncertified: "尚未取得認證"
  })[status];
}

function normalizeReleaseChannel(value, version = "") {
  const explicit = cleanText(value, 40).toLowerCase();
  if (PLUGIN_RELEASE_CHANNELS.includes(explicit)) return explicit;
  return /-/.test(String(version || "")) ? "preview" : "stable";
}

function releaseChannelLabelZh(value) {
  return normalizeReleaseChannel(value) === "preview" ? "搶先體驗版" : "穩定版";
}

function normalizeRequiredCapabilities(capabilities = [], required = []) {
  const requested = new Set((Array.isArray(capabilities) ? capabilities : []).map(String));
  const result = [...new Set((Array.isArray(required) ? required : []).map(value => cleanText(value, 80)).filter(Boolean))];
  for (const capability of result) {
    if (!requested.has(capability)) throw new Error("PLUGIN_REQUIRED_CAPABILITY_NOT_REQUESTED:" + capability);
  }
  return Object.freeze(result.sort());
}

function normalizePermissionDetails(input = {}, capabilities = [], required = []) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const requiredSet = new Set(required || []);
  const result = {};
  for (const capability of capabilities || []) {
    const base = CAPABILITY_DISCLOSURES[capability] || { labelZh: capability, accessTypes: ["action"], descriptionZh: "" };
    const custom = source[capability] && typeof source[capability] === "object" ? source[capability] : {};
    const accessTypes = [...new Set((Array.isArray(custom.accessTypes) ? custom.accessTypes : base.accessTypes || [])
      .map(value => cleanText(value, 20).toLowerCase())
      .filter(value => PLUGIN_PERMISSION_ACCESS_TYPES.includes(value)))];
    const externalDestinations = [...new Set((Array.isArray(custom.externalDestinations) ? custom.externalDestinations : [])
      .map(value => cleanText(value, 160))
      .filter(Boolean))].slice(0, 16);
    result[capability] = Object.freeze({
      capability,
      labelZh: cleanText(custom.labelZh || custom.label || base.labelZh || capability, 120),
      descriptionZh: cleanText(custom.descriptionZh || custom.description || base.descriptionZh || "", 500),
      accessTypes: Object.freeze(accessTypes.length ? accessTypes : ["action"]),
      externalDestinations: Object.freeze(externalDestinations),
      required: requiredSet.has(capability)
    });
  }
  return Object.freeze(result);
}

function pluginPermissionDisclosures(manifest = {}) {
  const capabilities = Array.isArray(manifest.capabilities) ? manifest.capabilities : [];
  const required = Array.isArray(manifest.requiredCapabilities) ? manifest.requiredCapabilities : [];
  const details = manifest.permissionDetails && typeof manifest.permissionDetails === "object"
    ? manifest.permissionDetails
    : normalizePermissionDetails({}, capabilities, required);
  return Object.freeze(capabilities.map(capability => details[capability] || Object.freeze({
    capability,
    labelZh: capability,
    descriptionZh: "",
    accessTypes: Object.freeze(["action"]),
    externalDestinations: Object.freeze([]),
    required: required.includes(capability)
  })));
}

function findingOverrideAllowed(finding = {}) {
  const impacts = new Set((Array.isArray(finding.impacts) ? finding.impacts : []).map(value => cleanText(value, 60).toLowerCase()).filter(Boolean));
  for (const impact of impacts) if (NON_OVERRIDABLE_SECURITY_IMPACTS.has(impact)) return false;
  return true;
}

function compareReleaseVersion(a, b) {
  const parse = value => {
    const match = String(value || "").match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/);
    return match ? [Number(match[1]), Number(match[2]), Number(match[3]), String(match[4] || "")] : null;
  };
  const left = parse(a), right = parse(b);
  if (!left || !right) return String(a || "").localeCompare(String(b || ""));
  for (let i = 0; i < 3; i++) if (left[i] !== right[i]) return left[i] - right[i];
  if (left[3] === right[3]) return 0;
  if (!left[3]) return 1;
  if (!right[3]) return -1;
  return left[3].localeCompare(right[3]);
}

function selectPreferredPluginRelease(releases = [], preference = "stable") {
  const rows = (Array.isArray(releases) ? releases : []).filter(Boolean);
  if (!rows.length) return null;
  const pref = normalizeReleaseChannel(preference);
  const ranked = [...rows].sort((a, b) => compareReleaseVersion(String(b.version || ""), String(a.version || "")));
  if (pref === "preview") return ranked[0] || null;
  return ranked.find(row => normalizeReleaseChannel(row.releaseChannel, row.version) === "stable") || ranked[0] || null;
}

export {
  CAPABILITY_DISCLOSURES,
  NON_OVERRIDABLE_SECURITY_IMPACTS,
  PLUGIN_PERMISSION_ACCESS_TYPES,
  PLUGIN_RELEASE_CHANNELS,
  PLUGIN_TRUST_STATUSES,
  findingOverrideAllowed,
  normalizePermissionDetails,
  normalizePluginTrustStatus,
  normalizeReleaseChannel,
  normalizeRequiredCapabilities,
  pluginPermissionDisclosures,
  pluginTrustLabelZh,
  releaseChannelLabelZh,
  selectPreferredPluginRelease
};
