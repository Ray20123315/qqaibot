const DEFAULT_TTS_VOICE = "Kore";
const DEFAULT_TTS_MAX_TEXT_CHARS = 6000;
const DEFAULT_TTS_MAX_AUDIO_BYTES = 8 * 1024 * 1024;
const DEFAULT_TTS_TIMEOUT_MS = 30000;
const INTERACTIONS_API_REVISION = "2026-05-20";

class TtsError extends Error {
  constructor(code, stage, message = code, details = {}) {
    super(message);
    this.name = "TtsError";
    this.code = String(code || "TTS_ERROR");
    this.stage = String(stage || "unknown");
    this.details = Object.freeze({ ...details });
  }
}

function clampInteger(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function uniqueStrings(values = []) {
  return [...new Set((Array.isArray(values) ? values : [values]).map(value => String(value || "").trim()).filter(Boolean))];
}

function estimatedBase64Bytes(value) {
  const text = String(value || "").replace(/\s+/g, "");
  if (!text) return 0;
  const padding = text.endsWith("==") ? 2 : text.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor(text.length * 3 / 4) - padding);
}

function base64ToBytes(value) {
  const text = String(value || "").replace(/\s+/g, "");
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function bytesToBase64(bytes) {
  const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || 0);
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < input.length; index += chunk) {
    binary += String.fromCharCode(...input.subarray(index, Math.min(input.length, index + chunk)));
  }
  return btoa(binary);
}

function writeAscii(view, offset, text) {
  for (let index = 0; index < text.length; index += 1) view.setUint8(offset + index, text.charCodeAt(index) & 0xff);
}

function pcmL16ToWavBase64(base64, { sampleRate = 24000, channels = 1 } = {}) {
  const pcm = base64ToBytes(base64);
  const channelCount = clampInteger(channels, 1, 1, 2);
  const rate = clampInteger(sampleRate, 24000, 8000, 96000);
  const bitsPerSample = 16;
  const headerSize = 44;
  const output = new Uint8Array(headerSize + pcm.byteLength);
  const view = new DataView(output.buffer);
  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + pcm.byteLength, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * channelCount * bitsPerSample / 8, true);
  view.setUint16(32, channelCount * bitsPerSample / 8, true);
  view.setUint16(34, bitsPerSample, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, pcm.byteLength, true);
  output.set(pcm, headerSize);
  return bytesToBase64(output);
}

function normalizeMimeType(value) {
  return String(value || "").split(";", 1)[0].trim().toLowerCase();
}

function extractInteractionAudio(payload = {}) {
  const candidates = [];
  if (payload?.output_audio && typeof payload.output_audio === "object") candidates.push(payload.output_audio);
  for (const step of Array.isArray(payload?.steps) ? payload.steps : []) {
    if (String(step?.type || "") !== "model_output") continue;
    for (const content of Array.isArray(step?.content) ? step.content : []) {
      if (String(content?.type || "") === "audio") candidates.push(content);
    }
  }
  for (const output of Array.isArray(payload?.outputs) ? payload.outputs : []) {
    if (String(output?.type || "") === "audio") candidates.push(output);
  }
  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    const audio = candidates[index];
    const data = String(audio?.data || "").replace(/^base64:\/\//i, "").trim();
    if (!data) continue;
    return Object.freeze({
      base64: data,
      mimeType: normalizeMimeType(audio?.mime_type || audio?.mimeType || "audio/l16") || "audio/l16",
      sampleRate: clampInteger(audio?.sample_rate ?? audio?.sampleRate, 24000, 8000, 96000),
      channels: clampInteger(audio?.channels, 1, 1, 2)
    });
  }
  return null;
}

function normalizeTtsAudio(audio, { maxAudioBytes = DEFAULT_TTS_MAX_AUDIO_BYTES } = {}) {
  if (!audio?.base64) throw new TtsError("TTS_AUDIO_MISSING", "format");
  let base64 = String(audio.base64).replace(/^base64:\/\//i, "");
  let mimeType = normalizeMimeType(audio.mimeType) || "audio/l16";
  let converted = false;
  if (mimeType === "audio/l16" || mimeType === "audio/pcm" || mimeType === "audio/x-pcm") {
    base64 = pcmL16ToWavBase64(base64, { sampleRate: audio.sampleRate, channels: audio.channels });
    mimeType = "audio/wav";
    converted = true;
  }
  const size = estimatedBase64Bytes(base64);
  const limit = clampInteger(maxAudioBytes, DEFAULT_TTS_MAX_AUDIO_BYTES, 64 * 1024, 16 * 1024 * 1024);
  if (!size) throw new TtsError("TTS_AUDIO_EMPTY", "format");
  if (size > limit) throw new TtsError("TTS_AUDIO_TOO_LARGE", "size", "generated audio exceeds configured limit", { size, limit });
  if (!/^audio\//.test(mimeType)) throw new TtsError("TTS_AUDIO_MIME_INVALID", "format", `unexpected MIME ${mimeType}`);
  return Object.freeze({ base64, mimeType, size, sampleRate: audio.sampleRate || 24000, channels: audio.channels || 1, converted });
}

function buildTtsPrompt(text, style = "") {
  const cleanText = String(text || "").trim();
  const cleanStyle = String(style || "").trim();
  if (!cleanStyle) return cleanText;
  return `${cleanStyle}\n\n${cleanText}`;
}

async function synthesizeGeminiTts(input, dependencies = {}) {
  const source = typeof input === "string" ? { text: input } : (input && typeof input === "object" ? input : {});
  const textLimit = clampInteger(source.maxTextChars, DEFAULT_TTS_MAX_TEXT_CHARS, 1, 12000);
  const text = String(source.text || "").trim().slice(0, textLimit);
  if (!text) throw new TtsError("TTS_TEXT_REQUIRED", "config");
  const voice = String(source.voice || DEFAULT_TTS_VOICE).trim().slice(0, 80) || DEFAULT_TTS_VOICE;
  if (!/^[A-Za-z0-9._-]{2,80}$/.test(voice)) throw new TtsError("TTS_VOICE_INVALID", "config");
  const models = uniqueStrings(dependencies.models || source.models);
  const apiKeys = uniqueStrings(dependencies.apiKeys || source.apiKeys);
  if (!models.length) throw new TtsError("TTS_MODELS_MISSING", "config");
  if (!apiKeys.length) throw new TtsError("TTS_API_KEYS_MISSING", "config");
  const fetchImpl = dependencies.fetchImpl || fetch;
  if (typeof fetchImpl !== "function") throw new TtsError("TTS_FETCH_UNAVAILABLE", "config");
  const timeoutMs = clampInteger(source.timeoutMs, DEFAULT_TTS_TIMEOUT_MS, 3000, 45000);
  const maxAttempts = clampInteger(source.maxAttempts, Math.min(4, models.length * Math.min(apiKeys.length, 2)), 1, 8);
  const prompt = buildTtsPrompt(text, source.style);
  const pairs = [];
  for (let keyIndex = 0; keyIndex < Math.min(apiKeys.length, 2); keyIndex += 1) {
    for (const model of models) pairs.push({ model, key: apiKeys[keyIndex] });
  }
  let lastError = new TtsError("TTS_PROVIDER_FAILED", "provider");
  for (let index = 0; index < Math.min(maxAttempts, pairs.length); index += 1) {
    const { model, key } = pairs[index];
    try {
      const response = await fetchImpl("https://generativelanguage.googleapis.com/v1beta/interactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": key,
          "Api-Revision": INTERACTIONS_API_REVISION
        },
        body: JSON.stringify({
          model,
          input: prompt,
          response_format: { type: "audio", mime_type: "audio/wav", delivery: "inline" },
          generation_config: { speech_config: [{ voice }] }
        }),
        signal: AbortSignal.timeout(timeoutMs)
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        lastError = new TtsError("TTS_PROVIDER_HTTP", "provider", `HTTP_${response.status}`, { status: response.status, model, providerMessage: String(payload?.error?.message || "").slice(0, 240) });
        continue;
      }
      const extracted = extractInteractionAudio(payload);
      if (!extracted) {
        lastError = new TtsError("TTS_PROVIDER_NO_AUDIO", "provider", "provider returned no audio block", { model });
        continue;
      }
      const audio = normalizeTtsAudio(extracted, { maxAudioBytes: source.maxAudioBytes });
      return Object.freeze({
        model,
        voice,
        textLength: text.length,
        audio,
        part: Object.freeze({
          kind: "audio",
          media: Object.freeze({
            base64: audio.base64,
            mimeType: audio.mimeType,
            size: audio.size,
            name: "qqai-tts.wav"
          })
        })
      });
    } catch (error) {
      if (error instanceof TtsError) lastError = error;
      else lastError = new TtsError("TTS_PROVIDER_FAILED", "provider", String(error?.message || error).slice(0, 240), { model });
    }
  }
  throw lastError;
}

export {
  DEFAULT_TTS_MAX_AUDIO_BYTES,
  DEFAULT_TTS_MAX_TEXT_CHARS,
  DEFAULT_TTS_TIMEOUT_MS,
  DEFAULT_TTS_VOICE,
  INTERACTIONS_API_REVISION,
  TtsError,
  base64ToBytes,
  buildTtsPrompt,
  bytesToBase64,
  estimatedBase64Bytes,
  extractInteractionAudio,
  normalizeTtsAudio,
  pcmL16ToWavBase64,
  synthesizeGeminiTts,
  uniqueStrings
};
