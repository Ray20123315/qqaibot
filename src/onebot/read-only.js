function oneBotReadOnlyMode(env = {}) {
  return ["1", "true", "yes", "on", "enabled"].includes(String(env?.ONEBOT_READ_ONLY ?? "").trim().toLowerCase());
}

function oneBotReadOnlyActionAllowed(action) {
  return /^get_[a-z0-9_]+$/i.test(String(action || "").trim());
}

function oneBotReadOnlyBlockedResponse(action = "") {
  return new Response(JSON.stringify({
    ok: false,
    error: "ONEBOT_READ_ONLY_ACTION_BLOCKED",
    action: String(action || "").slice(0, 80)
  }), {
    status: 403,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}

function requestPath(input) {
  try {
    return new URL(typeof input === "string" ? input : input?.url || String(input || "")).pathname;
  } catch {
    return "";
  }
}

async function requestAction(input, init) {
  if (typeof init?.body === "string") {
    try { return String(JSON.parse(init.body)?.action || ""); } catch { return ""; }
  }
  if (typeof Request !== "undefined" && input instanceof Request) {
    try { return String((await input.clone().json())?.action || ""); } catch { return ""; }
  }
  return "";
}

function wrapOneBotHubForReadOnly(env, stub) {
  if (!oneBotReadOnlyMode(env)) return stub;
  return Object.freeze({
    async fetch(input, init) {
      const path = requestPath(input);
      if (path === "/status") return stub.fetch(input, init);
      if (path === "/rpc") {
        const action = await requestAction(input, init);
        if (oneBotReadOnlyActionAllowed(action)) return stub.fetch(input, init);
        return oneBotReadOnlyBlockedResponse(action);
      }
      return oneBotReadOnlyBlockedResponse("");
    }
  });
}

export {
  oneBotReadOnlyActionAllowed,
  oneBotReadOnlyBlockedResponse,
  oneBotReadOnlyMode,
  requestAction,
  requestPath,
  wrapOneBotHubForReadOnly
};
