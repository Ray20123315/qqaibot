import { PLUGIN_CAPABILITIES, QQAI_PLUGIN_API_VERSION } from "./constants.js";
import { normalizePermissionDetails, normalizePluginTrustStatus, normalizeReleaseChannel, normalizeRequiredCapabilities } from "./governance.js";

const PLUGIN_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{1,79}$/;
const PLUGIN_VERSION_PATTERN = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
const PLUGIN_SETTING_KEY_PATTERN = /^[a-z][a-z0-9._-]{0,63}$/;
const PLUGIN_SETTING_TYPES = new Set(["string", "number", "boolean", "select", "json"]);

function cleanManifestText(value, maxLength = 160) {
  return String(value || "").trim().slice(0, maxLength);
}

function normalizePluginSettingDescriptor(key, input) {
  const name = cleanManifestText(key, 64).toLowerCase();
  if (!PLUGIN_SETTING_KEY_PATTERN.test(name)) throw new Error("PLUGIN_SETTING_INVALID_KEY:" + (name || "missing"));
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const type = cleanManifestText(source.type || "string", 20).toLowerCase();
  if (!PLUGIN_SETTING_TYPES.has(type)) throw new Error("PLUGIN_SETTING_INVALID_TYPE:" + name + ":" + (type || "missing"));
  const descriptor = {
    key: name,
    type,
    label: cleanManifestText(source.label || name, 120),
    description: cleanManifestText(source.description, 500),
    required: source.required === true,
    secret: source.secret === true,
    readOnly: source.readOnly === true
  };
  if (type === "number") {
    const min = Number(source.min);
    const max = Number(source.max);
    const step = Number(source.step);
    if (Number.isFinite(min)) descriptor.min = min;
    if (Number.isFinite(max)) descriptor.max = max;
    if (Number.isFinite(step) && step > 0) descriptor.step = step;
    if (descriptor.min !== undefined && descriptor.max !== undefined && descriptor.min > descriptor.max) {
      throw new Error("PLUGIN_SETTING_INVALID_RANGE:" + name);
    }
  }
  if (type === "select") {
    const options = (Array.isArray(source.options) ? source.options : []).slice(0, 100).map(option => {
      const item = option && typeof option === "object" ? option : { value: option, label: option };
      const value = cleanManifestText(item.value, 120);
      if (!value) throw new Error("PLUGIN_SETTING_INVALID_OPTION:" + name);
      return Object.freeze({ value, label: cleanManifestText(item.label || value, 120) });
    });
    if (!options.length) throw new Error("PLUGIN_SETTING_SELECT_OPTIONS_REQUIRED:" + name);
    descriptor.options = Object.freeze(options);
  }
  return Object.freeze(descriptor);
}

function normalizePluginSettings(input) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const entries = Object.entries(source);
  if (entries.length > 64) throw new Error("PLUGIN_SETTING_LIMIT_EXCEEDED");
  const result = {};
  for (const [key, value] of entries) {
    const descriptor = normalizePluginSettingDescriptor(key, value);
    result[descriptor.key] = descriptor;
  }
  return Object.freeze(result);
}

function normalizePluginManifest(input) {
  const source = input && typeof input === "object" ? input : {};
  const id = cleanManifestText(source.id, 80).toLowerCase();
  const name = cleanManifestText(source.name, 120);
  const version = cleanManifestText(source.version, 80);
  const apiVersion = cleanManifestText(source.apiVersion || source.api_version, 20);
  const description = cleanManifestText(source.description, 500);
  const author = cleanManifestText(source.author, 120);
  const minQQAI = cleanManifestText(source.minQQAI || source.min_qqai, 80);
  const maxQQAI = cleanManifestText(source.maxQQAI || source.max_qqai, 80);

  if (!PLUGIN_ID_PATTERN.test(id)) throw new Error("PLUGIN_MANIFEST_INVALID_ID");
  if (!name) throw new Error("PLUGIN_MANIFEST_MISSING_NAME");
  if (!PLUGIN_VERSION_PATTERN.test(version)) throw new Error("PLUGIN_MANIFEST_INVALID_VERSION");
  if (apiVersion !== QQAI_PLUGIN_API_VERSION) throw new Error(`PLUGIN_API_VERSION_UNSUPPORTED:${apiVersion || "missing"}`);

  const known = new Set(PLUGIN_CAPABILITIES);
  const capabilities = [...new Set((Array.isArray(source.capabilities) ? source.capabilities : [])
    .map(value => cleanManifestText(value, 80))
    .filter(Boolean))];
  for (const capability of capabilities) {
    if (!known.has(capability)) throw new Error(`PLUGIN_MANIFEST_UNKNOWN_CAPABILITY:${capability}`);
  }

  const requiredCapabilitiesDeclared = Object.prototype.hasOwnProperty.call(source, "requiredCapabilities")
    || Object.prototype.hasOwnProperty.call(source, "required_capabilities");
  const requiredCapabilities = normalizeRequiredCapabilities(
    capabilities,
    requiredCapabilitiesDeclared
      ? (source.requiredCapabilities ?? source.required_capabilities ?? [])
      : capabilities
  );
  const permissionDetails = normalizePermissionDetails(
    source.permissionDetails || source.permission_details || {},
    capabilities,
    requiredCapabilities
  );
  const trustStatus = normalizePluginTrustStatus(source);
  const releaseChannel = normalizeReleaseChannel(source.releaseChannel || source.release_channel, version);
  const settings = normalizePluginSettings(source.settings);

  return Object.freeze({
    id,
    name,
    version,
    apiVersion,
    description,
    author,
    minQQAI,
    maxQQAI,
    official: source.official === true,
    trustStatus,
    releaseChannel,
    publicStatus: source.publicStatus === true,
    capabilities: Object.freeze(capabilities),
    requiredCapabilities,
    permissionDetails,
    settings
  });
}

export { normalizePluginManifest, normalizePluginSettingDescriptor, normalizePluginSettings, PLUGIN_ID_PATTERN, PLUGIN_SETTING_KEY_PATTERN, PLUGIN_SETTING_TYPES, PLUGIN_VERSION_PATTERN };
