/** Unsloth authentication is a Cloudflare Worker Secret, never KV or browser input. */
const MODEL_KEY = "selected-model-v2";
const LEGACY_KEY = "model-configuration-v1";
const MODELS_URL = "https://msiai.ray2025.com/v1/models";
const isModel = value => typeof value === "string" && value.length > 0 &&
  value.length <= 256 && !/[\u0000-\u001f\u007f]/.test(value);

export async function readModelConfig(env) {
  let model = isModel(env.UNSLOTH_MODEL) ? env.UNSLOTH_MODEL : "";
  let saved = false;
  if (env.CONFIG_KV) {
    const selected = await env.CONFIG_KV.get(MODEL_KEY);
    if (selected !== null) {
      if (!isModel(selected)) throw Error("INVALID_SAVED_MODEL");
      model = selected;
      saved = true;
    }
  }
  // The API key only comes from a Worker Secret. Old KV credentials are ignored.
  return {apiKey: env.UNSLOTH_API_KEY || "", model, saved};
}

export async function listUnslothModels(env, fetcher = fetch) {
  const key = env.UNSLOTH_API_KEY;
  if (typeof key !== "string" || !key.trim() || /[\r\n]/.test(key))
    throw Error("UNSLOTH_SECRET_NOT_CONFIGURED");
  let response;
  try {
    response = await fetcher(MODELS_URL, {
      method: "GET",
      headers: {"authorization": "Bearer " + key, "accept": "application/json"},
      redirect: "manual",
      signal: AbortSignal.timeout(12000)
    });
  } catch(err) {
    if (err?.name === "TimeoutError" || err?.name === "AbortError")
      throw Error("MODEL_LIST_TIMEOUT");
    throw Error("MODEL_LIST_CONNECTION_FAILED");
  }
  if(response.status >= 300 && response.status < 400)
    throw Error("MODEL_LIST_REDIRECT_" + response.status);
  if(!response.ok) throw Error("MODEL_LIST_HTTP_" + response.status);
  let payload;
  try { payload = await response.json(); }
  catch { throw Error("INVALID_MODEL_LIST"); }
  if(!Array.isArray(payload?.data)) throw Error("INVALID_MODEL_LIST");
  const models = [...new Set(payload.data.map(item=>item?.id).filter(isModel))];
  if(!models.length) throw Error("NO_MODELS_AVAILABLE");
  return models.slice(0,200);
}

export async function saveModelConfig(env, model, fetcher = fetch) {
  if(!env.CONFIG_KV) throw Error("MODEL_STORAGE_UNAVAILABLE");
  if(!isModel(model)) throw Error("INVALID_MODEL_SELECTION");
  const available = await listUnslothModels(env, fetcher);
  if(!available.includes(model)) throw Error("MODEL_NOT_IN_LIST");
  // Store only the model id. Never persist any version of the API key in KV.
  await env.CONFIG_KV.put(MODEL_KEY, model);
  // Erase an older encrypted KV copy of API credentials if one exists.
  if(typeof env.CONFIG_KV.delete === "function")
    await env.CONFIG_KV.delete(LEGACY_KEY);
  return {model, saved: true};
}
