import { PLUGIN_CAPABILITIES, QQAI_PLUGIN_API_VERSION } from "./constants.js";

const PLUGIN_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{1,79}$/;
const PLUGIN_VERSION_PATTERN = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;

function cleanManifestText(value, maxLength = 160) {
  return String(value || "").trim().slice(0, maxLength);
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

  const settings = source.settings && typeof source.settings === "object" && !Array.isArray(source.settings)
    ? source.settings
    : {};

  return Object.freeze({
    id,
    name,
    version,
    apiVersion,
    description,
    author,
    minQQAI,
    official: source.official === true,
    capabilities: Object.freeze(capabilities),
    settings: Object.freeze({ ...settings })
  });
}

export { normalizePluginManifest, PLUGIN_ID_PATTERN, PLUGIN_VERSION_PATTERN };
