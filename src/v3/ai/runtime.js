import { callGeminiGenerate, effectiveRuntimeModels, geminiVisionApiKeys, parseList } from "../../ai/runtime.js";
import { compileCanonicalMessageToGemini } from "./multimodal.js";

class MultimodalAiError extends Error {
  constructor(code, stage, message = code, details = {}) {
    super(message);
    this.name = "MultimodalAiError";
    this.code = String(code || "MULTIMODAL_AI_ERROR");
    this.stage = String(stage || "unknown");
    this.details = Object.freeze({ ...details });
  }
}

function clampNumber(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function normalizeAiResult(result, compiled) {
  return Object.freeze({
    text: String(result?.text || ""),
    model: String(result?.model || ""),
    finishReason: String(result?.finishReason || result?.finish_reason || ""),
    usage: result?.usage || result?.usageMetadata || null,
    compile: Object.freeze({ stats: compiled.stats, issues: compiled.issues })
  });
}

async function runV3MultimodalAi(env, message, input = {}, dependencies = {}) {
  if (!env || typeof env !== "object") throw new MultimodalAiError("MULTIMODAL_ENV_REQUIRED", "config");
  if (!message || typeof message !== "object" || !Array.isArray(message.parts)) throw new MultimodalAiError("MULTIMODAL_MESSAGE_REQUIRED", "compile");
  const source = input && typeof input === "object" ? input : { prompt: String(input || "") };
  let compiled;
  try {
    compiled = await compileCanonicalMessageToGemini(message, {
      onebotCall: dependencies.onebotCall,
      safeFetch: dependencies.safeFetch
    }, {
      prompt: String(source.prompt || "").slice(0, 12000),
      strictMedia: source.strictMedia === true,
      maxInlineBytes: source.maxInlineBytes,
      maxMediaParts: source.maxMediaParts,
      maxTextChars: source.maxTextChars,
      maxForwardNodes: source.maxForwardNodes,
      maxForwardDepth: source.maxForwardDepth
    });
  } catch (error) {
    throw new MultimodalAiError("MULTIMODAL_COMPILE_FAILED", "compile", String(error?.message || error).slice(0, 240), {
      causeCode: String(error?.code || ""),
      causeStage: String(error?.stage || "")
    });
  }

  const hasInlineMedia = compiled.parts.some(part => Boolean(part?.inlineData?.data));
  const getApiKeys = dependencies.getApiKeys || (targetEnv => geminiVisionApiKeys(targetEnv));
  const getModels = dependencies.getModels || ((targetEnv, fallbackModels) => parseList(targetEnv.GEMINI_VISION_MODELS, fallbackModels));
  const modelCall = dependencies.modelCall || callGeminiGenerate;
  let apiKeys = null;
  let keyProvider = "gemini";
  let models;
  try {
    const fallbackModels = dependencies.fallbackModels || await effectiveRuntimeModels(env, "chat");
    if (hasInlineMedia) {
      apiKeys = getApiKeys(env);
      if (!Array.isArray(apiKeys) || !apiKeys.length) throw new MultimodalAiError("MULTIMODAL_API_KEYS_MISSING", "config", "multimodal API key pool is unavailable");
      keyProvider = "gemini_vision";
      models = getModels(env, fallbackModels);
    } else {
      models = fallbackModels;
    }
  } catch (error) {
    if (error instanceof MultimodalAiError) throw error;
    throw new MultimodalAiError("MULTIMODAL_CONFIG_FAILED", "config", String(error?.message || error).slice(0, 240));
  }

  try {
    const result = await modelCall(env, {
      models,
      apiKeys,
      keyProvider,
      system: String(source.system || "You are QQAI v3. Understand all supplied QQ text, images, audio, expressions, files, and forwarded context before answering the user task.").slice(0, 12000),
      contents: compiled.contents,
      maxOutputTokens: clampNumber(source.maxOutputTokens, 1200, 1, 4096),
      temperature: clampNumber(source.temperature, 0.35, 0, 2),
      useSearch: false,
      requireSearch: false,
      timeoutMs: clampNumber(source.timeoutMs, 20000, 1000, 30000),
      maxAttempts: clampNumber(source.maxAttempts, 2, 1, 4)
    });
    return normalizeAiResult(result, compiled);
  } catch (error) {
    if (error instanceof MultimodalAiError) throw error;
    throw new MultimodalAiError("MULTIMODAL_MODEL_FAILED", "model", String(error?.message || error).slice(0, 240), {
      mediaParts: compiled.stats.mediaParts,
      totalInlineBytes: compiled.stats.totalInlineBytes
    });
  }
}

export { MultimodalAiError, normalizeAiResult, runV3MultimodalAi };