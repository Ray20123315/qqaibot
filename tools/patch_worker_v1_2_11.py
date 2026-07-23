from pathlib import Path
import re

path = Path("worker.js")
text = path.read_text(encoding="utf-8")

def replace_once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one match, got {count}")
    text = text.replace(old, new, 1)

def replace_in_range(start_marker: str, end_marker: str, old: str, new: str, label: str) -> None:
    global text
    start = text.index(start_marker)
    end = text.index(end_marker, start)
    block = text[start:end]
    count = block.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match in range, got {count}")
    block = block.replace(old, new, 1)
    text = text[:start] + block + text[end:]

def sub_once(pattern: str, repl: str, label: str, flags: int = 0) -> None:
    global text
    text2, count = re.subn(pattern, repl, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f"{label}: expected one regex match, got {count}")
    text = text2

# Version
replace_once('const VERSION = "1.2.10";', 'const VERSION = "1.2.11";', "version")

# Dedicated image-inspection key pool
replace_once(
    'let GEMINI_KEY_CURSOR = 0;\nlet GEMINI_SEARCH_KEY_CURSOR = 0;\nlet DEEPSEEK_KEY_CURSOR = 0;',
    'let GEMINI_KEY_CURSOR = 0;\nlet GEMINI_SEARCH_KEY_CURSOR = 0;\nlet GEMINI_VISION_KEY_CURSOR = 0;\nlet DEEPSEEK_KEY_CURSOR = 0;',
    "vision cursor"
)
replace_once(
'''  const cursor = provider === "deepseek"
    ? DEEPSEEK_KEY_CURSOR++
    : provider === "gemini_search"
      ? GEMINI_SEARCH_KEY_CURSOR++
      : GEMINI_KEY_CURSOR++;''',
'''  const cursor = provider === "deepseek"
    ? DEEPSEEK_KEY_CURSOR++
    : provider === "gemini_search"
      ? GEMINI_SEARCH_KEY_CURSOR++
      : provider === "gemini_vision"
        ? GEMINI_VISION_KEY_CURSOR++
        : GEMINI_KEY_CURSOR++;''',
    "round robin vision cursor"
)
replace_once(
'''function geminiSearchApiKeys(env) {
  // 搜索金钥必须独立配置，绝不挪用聊天／Vectorize 金钥。
  return [...new Set([...parseList(env.GEMINI_SEARCH_API_KEYS), ...parseList(env.GEMINI_SEARCH_API_KEY)])];
}

function deepSeekApiKeys(env) {''',
'''function geminiSearchApiKeys(env) {
  // 搜索金钥必须独立配置，绝不挪用聊天／Vectorize 金钥。
  return [...new Set([...parseList(env.GEMINI_SEARCH_API_KEYS), ...parseList(env.GEMINI_SEARCH_API_KEY)])];
}

function geminiVisionApiKeys(env) {
  // 图片检查使用独立金钥池；未配置时自动关闭，绝不挪用聊天、搜索或 Vectorize 金钥。
  return [...new Set([
    ...parseList(env.GEMINI_VISION_API_KEYS),
    ...parseList(env.GEMINI_VISION_API_KEY),
    ...parseList(env.IMAGE_CHECK_API_KEYS),
    ...parseList(env.IMAGE_CHECK_API_KEY)
  ])];
}

function imageInspectionEnabled(env) {
  const mode = String(env.IMAGE_INSPECTION_ENABLED ?? "auto").trim().toLowerCase();
  if (["0", "false", "off", "disabled", "关闭", "關閉"].includes(mode)) return false;
  return geminiVisionApiKeys(env).length > 0;
}

function deepSeekApiKeys(env) {''',
    "vision key helpers"
)

# Group /! opt-out and same-account // chat
replace_once(
'''      let userMessage = "";
      let imageUrl = null;''',
'''      let userMessage = "";
      let aiReplyOptOut = false;
      let imageUrl = null;''',
    "opt out variable"
)
replace_once(
'''      mentionedQqs = [...new Set(mentionedQqs.filter(Boolean).map(String))];
      userMessage = normalizeMultilingualCommand(userMessage);''',
'''      mentionedQqs = [...new Set(mentionedQqs.filter(Boolean).map(String))];
      if (isGroup && !isSelfAccount) {
        const optOut = stripGroupAiOptOutPrefix(userMessage);
        aiReplyOptOut = optOut.optedOut;
        userMessage = optOut.text;
      }
      userMessage = normalizeMultilingualCommand(userMessage);''',
    "parse opt out"
)
replace_once(
'''        if (cleanMessage.startsWith('//')) {
          cleanMessage = cleanMessage.slice(2).trim();
          sameQqHumanOnly = true;
        } else if (cleanMessage.startsWith('??')) {''',
'''        if (cleanMessage.startsWith('//')) {
          cleanMessage = cleanMessage.slice(2).trim();
          sameQqSelfAsk = true;
        } else if (cleanMessage.startsWith('??')) {''',
    "same account slash chat"
)
replace_once(
'      const isCommandMessage = /^[!！]/.test(cleanMessage);',
'      const isCommandMessage = !aiReplyOptOut && /^[!！]/.test(cleanMessage);',
    "optout command exclusion"
)
replace_once(
'      const explicitlyTriggered = botMentioned || repliedToBot || sameQqSelfAsk || isCommandMessage;',
'      const explicitlyTriggered = !aiReplyOptOut && (botMentioned || repliedToBot || sameQqSelfAsk || isCommandMessage);',
    "optout explicit trigger"
)
replace_once(
'''      let shouldReply = isAtMeOrAi || isPrivate;
      let isAutoInterject = false;
      let triggerType = botMentioned ? "mention" : repliedToBot ? "reply_to_ai" : sameQqSelfAsk ? "self_ask" : isPrivate ? "private" : "none";
      let noReplyReason = "not_triggered";''',
'''      let shouldReply = !aiReplyOptOut && (isAtMeOrAi || isPrivate);
      let isAutoInterject = false;
      let triggerType = aiReplyOptOut ? "user_opt_out" : botMentioned ? "mention" : repliedToBot ? "reply_to_ai" : sameQqSelfAsk ? "self_ask" : isPrivate ? "private" : "none";
      let noReplyReason = aiReplyOptOut ? "user_opt_out" : "not_triggered";''',
    "optout reply gate"
)
replace_once(
"      if (!shouldReply && isGroup && interjectChance > 0 && !msgLower.startsWith('!') && !msgLower.startsWith('！')) {",
"      if (!shouldReply && !aiReplyOptOut && isGroup && interjectChance > 0 && !msgLower.startsWith('!') && !msgLower.startsWith('！')) {",
    "optout interject gate"
)
replace_once(
'''function parseList(value, fallback = []) {''',
'''function stripGroupAiOptOutPrefix(value) {
  const source = String(value || "");
  const match = source.match(/^(\\s*(?:\\[CQ:(?:reply|at),[^\\]]+\\]\\s*)*)\\/!\\s*/i);
  if (!match) return { optedOut: false, text: source };
  return {
    optedOut: true,
    text: `${match[1] || ""}${source.slice(match[0].length)}`
  };
}

function neutralizeAiCommandPrefix(value) {
  const output = String(value || "").trim();
  if (!output) return output;
  return /^(?:\\/\\/|\\/!|[!！])/.test(output) ? `AI 回复：${output}` : output;
}

function parseList(value, fallback = []) {''',
    "prefix safety helpers"
)
replace_in_range(
    "function sanitizeAiReply(reply) {",
    "\nfunction removeTextMentionTokens",
    "  return text.trim();",
    "  return neutralizeAiCommandPrefix(text);",
    "sanitize command prefix"
)
replace_once(
'''      if (dynamicPersona !== "") {
        finalStylePrompt = dynamicPersona + "\\n\\n" + finalStylePrompt;
      }''',
'''      if (dynamicPersona !== "") {
        finalStylePrompt = dynamicPersona + "\\n\\n" + finalStylePrompt;
      }
      finalStylePrompt += `

【命令前缀安全规则】
你绝对不能以 //、/!、! 或！开头输出，也不能模仿用户输入这些控制前缀、声称已经执行机器人命令、诱导绕过权限，或用命令实施违法违规行为。需要说明命令时，只能把命令放在引号或代码样式的普通说明文字中。`;''',
    "prompt command prefix safety"
)
replace_once(
'    if (!mentioned || !text || /^[!！]/.test(text)) return false;',
'    if (!mentioned || !text || /^(?:[!！]|\\/!)/.test(text)) return false;',
    "queue optout"
)

# Image inspection routing and health
replace_once(
'''      // 用户问“看到图片了吗”但当前消息既未附图、也未回复图片时，不允许模型假装看见。
      const hasImageReference = Boolean(imageUrl || imageFile);''',
'''      // 图片检查使用独立多金钥池；未配置时自动关闭。
      const imageInspectionConfigured = imageInspectionEnabled(env);
      const hasImageReference = Boolean(imageUrl || imageFile);''',
    "image configured flag"
)
replace_once(
'''      if (explicitlyTriggered && /(?:看|讀|读|识别|識別|看到|看见|看見).{0,10}(?:图片|圖片|照片|图|圖)|(?:图片|圖片|照片|图|圖).{0,10}(?:看到|看见|看見|看得到|看得見)/i.test(cleanMessage) && !hasImageReference) {
        return jsonReply(`${atSender}我这则消息没有收到可读取的图片。请直接“回复那张图片”再 @我，或把图片和问题放在同一则消息发送。`);
      }''',
'''      if (explicitlyTriggered && /(?:看|讀|读|识别|識別|看到|看见|看見).{0,10}(?:图片|圖片|照片|图|圖)|(?:图片|圖片|照片|图|圖).{0,10}(?:看到|看见|看見|看得到|看得見)/i.test(cleanMessage) && !hasImageReference) {
        return jsonReply(`${atSender}我这则消息没有收到可读取的图片。请直接“回复那张图片”再 @我，或把图片和问题放在同一则消息发送。`);
      }
      if (explicitlyTriggered && hasImageReference && !imageInspectionConfigured) {
        return jsonReply(`${atSender}图片检查目前未启用。开发者配置 GEMINI_VISION_API_KEYS（可填写多个，以逗号分隔）后会自动启用；未配置时系统会自动保持关闭。`);
      }''',
    "image unconfigured reply"
)
replace_once(
'''      if (imageUrl || imageFile) {
        try {''',
'''      if ((imageUrl || imageFile) && imageInspectionConfigured) {
        try {''',
    "image load gate"
)
replace_once(
'''          hasMedia: Boolean(imageUrl || imageFile || voiceUrl || voiceFile || videoUrl || videoFile), userId, groupId: currentGroupId, isDeveloper''',
'''          hasMedia: Boolean(loadedImage || voiceUrl || voiceFile || videoUrl || videoFile),
          visionRequest: loadedImage,
          userId, groupId: currentGroupId, isDeveloper''',
    "hybrid vision args"
)
replace_once(
'''            models: args.visionRequest ? parseList(env.GEMINI_VISION_MODELS, args.chatModels) : args.chatModels,
            systemInstruction: finalStylePrompt,
            contents:''',
'''            models: args.visionRequest ? parseList(env.GEMINI_VISION_MODELS, args.chatModels) : args.chatModels,
            apiKeys: args.visionRequest ? geminiVisionApiKeys(env) : null,
            keyProvider: args.visionRequest ? "gemini_vision" : "gemini",
            systemInstruction: finalStylePrompt,
            contents:''',
    "hybrid dedicated vision keys"
)
replace_once(
'  checks.push(await runTimedHealthCheck("Gemma 4 26B", async () => {',
'''  const visionKeys = roundRobinKeys(geminiVisionApiKeys(env), "gemini_vision");
  checks.push(await runTimedHealthCheck("Gemini 图片检查", async () => {
    if (!visionKeys.length) return { configured: false, enabled: false, mode: "auto_off" };
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(visionKeys[0])}&pageSize=1`, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`GEMINI_VISION_${response.status}`);
    return {
      configured: true,
      enabled: true,
      keys: visionKeys.length,
      key: maskSecret(visionKeys[0]),
      models: parseList(env.GEMINI_VISION_MODELS, parseList(env.GEMINI_CHAT_MODELS))
    };
  }, { timeoutMs: 10000, optional: true }));

  checks.push(await runTimedHealthCheck("Gemma 4 26B", async () => {''',
    "vision health"
)
replace_once(
'''      gemini: Boolean(env.GEMINI_API_KEYS || env.VECTORIZE_GEMINI_KEYS),
      gemmaDecisionModels:''',
'''      gemini: Boolean(env.GEMINI_API_KEYS || env.VECTORIZE_GEMINI_KEYS),
      geminiVision: {
        enabled: imageInspectionEnabled(env),
        keys: geminiVisionApiKeys(env).length,
        models: parseList(env.GEMINI_VISION_MODELS, parseList(env.GEMINI_CHAT_MODELS))
      },
      gemmaDecisionModels:''',
    "health state vision"
)
replace_once(
'''    const health = await readJson(env, "health:last:quick", null);
    const lastByName = Object.fromEntries((health?.checks || []).map(item => [item.name, item]));
    const registry = [''',
'''    const health = await readJson(env, "health:last:quick", null);
    const lastByName = Object.fromEntries((health?.checks || []).map(item => [item.name, item]));
    const visionConfigured = imageInspectionEnabled(env);
    const registry = [''',
    "model vision flag"
)
replace_once(
'''      ...parseList(env.GEMINI_CHAT_MODELS).map((id, index) => ({ id, provider: "Google", family: "Gemini", billing: "未启用付费／免费层额度", capabilities: ["text", "chat", "vision"], priority: index + 1, status: lastByName["Gemini API"]?.status || "unknown" })),''',
'''      ...parseList(env.GEMINI_CHAT_MODELS).map((id, index) => ({ id, provider: "Google", family: "Gemini", billing: "未启用付费／免费层额度", capabilities: ["text", "chat", ...(visionConfigured ? ["vision"] : [])], priority: index + 1, status: lastByName["Gemini API"]?.status || "unknown" })),''',
    "model capabilities"
)
replace_once(
'''      routing: { decision: "gemma-4-26b-a4b-it（仅插话／规则分类）", simple: "Gemini 免费模型池", general: "Gemini 免费模型池", vision: "Gemini 免费模型池", freeFallback: "gemma-4-31b-it", paidEmergencyFallback: env.DEEPSEEK_FLASH_MODEL || DEFAULTS.deepseekFlashModel },''',
'''      routing: { decision: "gemma-4-26b-a4b-it（仅插话／规则分类）", simple: "Gemini 免费模型池", general: "Gemini 免费模型池", vision: visionConfigured ? `Gemini 独立图片金钥池（${geminiVisionApiKeys(env).length} 个）` : "未配置，自动关闭", freeFallback: "gemma-4-31b-it", paidEmergencyFallback: env.DEEPSEEK_FLASH_MODEL || DEFAULTS.deepseekFlashModel },''',
    "model routing vision"
)

# Settings center permissions
replace_once(
'''  if (request.method === "GET" && path === "/settings-center") {
    if (!portalIsDeveloper) return jsonResponse({ ok: false, message: "设置中心仅开发者可见。群管理员请使用“群组设置”“群规监控”“B站监控”等对应页面。" }, 403);
    const targetQq = String(url.searchParams.get("targetQq") || authed.qq).replace(/\\D/g, "");
    if (!targetQq) return jsonResponse({ ok: false, message: "请输入有效的目标 QQ。" }, 400);
    const targetRole = await resolvePortalRole(env, targetQq, groupId);
    const visibleRank = 3;
    const settings = [];
    for (const definition of PORTAL_SETTING_DEFINITIONS) {
      if (portalRoleRank(definition.minRole) > visibleRank) continue;
      settings.push({ ...definition, value: await readPortalSettingValue(env, definition, groupId, targetQq) });
    }
    return jsonResponse({ ok: true, targetQq, targetRole, viewerRole: portalIsDeveloper ? "developer" : role, settings, canDisableAuditLog: portalIsDeveloper });
  }
  if (request.method === "POST" && path === "/settings-center") {
    if (!portalIsDeveloper) return jsonResponse({ ok: false, message: "设置中心仅开发者可用。" }, 403);
    const targetQq = String(body.targetQq || authed.qq).replace(/\\D/g, "");
    if (!targetQq) return jsonResponse({ ok: false, message: "请输入有效的目标 QQ。" }, 400);
    const targetRole = await resolvePortalRole(env, targetQq, groupId);
    const actorRank = 3;''',
'''  if (request.method === "GET" && path === "/settings-center") {
    if (!groupId) return jsonResponse({ ok: false, message: "请先选择群组。" }, 400);
    const requestedTargetQq = String(url.searchParams.get("targetQq") || authed.qq).replace(/\\D/g, "");
    if (!requestedTargetQq) return jsonResponse({ ok: false, message: "请输入有效的目标 QQ。" }, 400);
    if (!portalIsDeveloper && requestedTargetQq !== String(authed.qq)) return jsonResponse({ ok: false, message: "非开发者只能修改自己的个人设置与当前权限允许的群设置。" }, 403);
    const targetQq = portalIsDeveloper ? requestedTargetQq : String(authed.qq);
    const targetRole = await resolvePortalRole(env, targetQq, groupId);
    const effectiveViewerRole = portalIsDeveloper
      ? "developer"
      : role === "owner"
        ? "owner"
        : (permissions.aiAdmin || permissions.groupOps || permissions.nativeAdmin || role === "admin")
          ? "admin"
          : "member";
    const visibleRank = portalRoleRank(effectiveViewerRole);
    const settings = [];
    for (const definition of PORTAL_SETTING_DEFINITIONS) {
      if (portalRoleRank(definition.minRole) > visibleRank) continue;
      settings.push({ ...definition, value: await readPortalSettingValue(env, definition, groupId, targetQq) });
    }
    return jsonResponse({ ok: true, targetQq, targetRole, viewerRole: effectiveViewerRole, settings, canEditTargetQq: portalIsDeveloper, canDisableAuditLog: portalIsDeveloper });
  }
  if (request.method === "POST" && path === "/settings-center") {
    if (!groupId) return jsonResponse({ ok: false, message: "请先选择群组。" }, 400);
    const requestedTargetQq = String(body.targetQq || authed.qq).replace(/\\D/g, "");
    if (!requestedTargetQq) return jsonResponse({ ok: false, message: "请输入有效的目标 QQ。" }, 400);
    if (!portalIsDeveloper && requestedTargetQq !== String(authed.qq)) return jsonResponse({ ok: false, message: "非开发者只能修改自己的个人设置与当前权限允许的群设置。" }, 403);
    const targetQq = portalIsDeveloper ? requestedTargetQq : String(authed.qq);
    const targetRole = await resolvePortalRole(env, targetQq, groupId);
    const effectiveActorRole = portalIsDeveloper
      ? "developer"
      : role === "owner"
        ? "owner"
        : (permissions.aiAdmin || permissions.groupOps || permissions.nativeAdmin || role === "admin")
          ? "admin"
          : "member";
    const actorRank = portalRoleRank(effectiveActorRole);''',
    "settings center permissions"
)
replace_once(
'''  { key: "moderation_cooldown_seconds", label: "同对象处置冷却秒数", command: "!设置处置冷却", minRole: "owner", scope: "group", type: "number", min: 0, defaultValue: 0 },
  { key: "active_speaking",''',
'''  { key: "moderation_cooldown_seconds", label: "同对象处置冷却秒数", command: "!设置处置冷却", minRole: "owner", scope: "group", type: "number", min: 0, defaultValue: 0 },
  { key: "interject_cooldown_seconds", label: "主动插话冷却秒数", command: "网页设置", minRole: "admin", scope: "group", type: "number", min: 0, defaultValue: 0 },
  { key: "newcomer_observation_days", label: "新人观察期（天）", command: "网页设置", minRole: "owner", scope: "group", type: "number", min: 0, max: 30, defaultValue: 0 },
  { key: "active_speaking",''',
    "settings definitions extras"
)
replace_once(
'''    case "moderation_cooldown_seconds": return parseUnlimitedNonNegativeInteger(await dbGet(env, `moderation_target_cooldown_seconds:${groupId}`), 0);
    case "active_speaking":''',
'''    case "moderation_cooldown_seconds": return parseUnlimitedNonNegativeInteger(await dbGet(env, `moderation_target_cooldown_seconds:${groupId}`), 0);
    case "interject_cooldown_seconds": return parseUnlimitedNonNegativeInteger(await dbGet(env, `interject_cooldown_seconds:${groupId}`), 0);
    case "newcomer_observation_days": return Math.max(0, Math.min(30, parseUnlimitedNonNegativeInteger(await dbGet(env, `newcomer_observation_days:${groupId}`), 0)));
    case "active_speaking":''',
    "settings read extras"
)
replace_once(
'''    case "moderation_cooldown_seconds": return dbPut(env, `moderation_target_cooldown_seconds:${groupId}`, String(parseUnlimitedNonNegativeInteger(value, 0)));
    case "active_speaking":''',
'''    case "moderation_cooldown_seconds": return dbPut(env, `moderation_target_cooldown_seconds:${groupId}`, String(parseUnlimitedNonNegativeInteger(value, 0)));
    case "interject_cooldown_seconds": return dbPut(env, `interject_cooldown_seconds:${groupId}`, String(parseUnlimitedNonNegativeInteger(value, 0)));
    case "newcomer_observation_days": return dbPut(env, `newcomer_observation_days:${groupId}`, String(Math.max(0, Math.min(30, parseUnlimitedNonNegativeInteger(value, 0)))));
    case "active_speaking":''',
    "settings write extras"
)

# Bilibili compliance-oriented mode
replace_once('const BILIBILI_POLL_MIN_SECONDS = 300;', 'const BILIBILI_POLL_MIN_SECONDS = 1800;', "bili min interval")
replace_once('const BILIBILI_BLOCK_BACKOFF_MAX_SECONDS = 24 * 60 * 60;', 'const BILIBILI_BLOCK_BACKOFF_MAX_SECONDS = 72 * 60 * 60;', "bili max backoff")
replace_once(
'function isBilibiliBlockedError(error) { return /HTTP\\s*412|错误\\s*-412|request was banned|请求被拦截|風控|风控/i.test(String(error?.message || error || "")); }',
'function isBilibiliBlockedError(error) { return /HTTP\\s*(?:412|429)|错误\\s*-412|request was banned|请求被拦截|風控|风控|rate.?limit/i.test(String(error?.message || error || "")); }',
    "bili blocked statuses"
)
replace_once(
'''        "Accept": "application/json, text/plain, */*",
        "User-Agent": `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36 QQAIbot/${VERSION}`,
        "Referer": "https://www.bilibili.com/"''',
'''        "Accept": "application/json",
        "User-Agent": `QQAIbot/${VERSION} (compatibility-public-polling; developer=${DEFAULT_DEVELOPER_ID})`''',
    "bili transparent user agent"
)
replace_once(
'      ? Math.min(BILIBILI_BLOCK_BACKOFF_MAX_SECONDS, 6 * 60 * 60 * (2 ** Math.min(2, connector.consecutiveFailures - 1)))',
'      ? Math.min(BILIBILI_BLOCK_BACKOFF_MAX_SECONDS, 12 * 60 * 60 * (2 ** Math.min(2, connector.consecutiveFailures - 1)))',
    "bili stronger backoff"
)
replace_once(
'''      ? `B站返回 412 风控，通常是 Cloudflare 出口 IP 被拦截。系统已暂停检查 ${Math.round(backoffSeconds / 3600)} 小时；调慢频率可降低触发概率，但不能保证 B站解除拦截。原始错误：${String(error?.message || error)}`.slice(0, 1200)''',
'''      ? `B站返回 412／429 风控或限流。兼容轮询已暂停 ${Math.round(backoffSeconds / 3600)} 小时；建议改用开放平台 Webhook 或合法授权的中继，不要提高抓取频率。原始错误：${String(error?.message || error)}`.slice(0, 1200)''',
    "bili blocked message"
)
replace_once(
'''      connectors: connectors.map(item => { const { webhookSecret, ...safe } = item; return { ...safe, mode: item.mode === "generic_webhook" ? "generic_webhook" : "automatic_polling" }; }),
      note: "填写 B站用户 UID 后，Worker 会按设定间隔自动检查开播状态与最新视频。首次检查只建立基准，不发送旧内容。"''',
'''      connectors: connectors.map(item => { const { webhookSecret, ...safe } = item; return { ...safe, mode: item.mode === "generic_webhook" ? "official_webhook" : "automatic_polling" }; }),
      note: "推荐使用哔哩哔哩开放平台 Webhook 或经过合法授权的中继。兼容轮询仅使用公开网页接口、最低 30 分钟一次，可能受 412／429 风控影响。"''',
    "bili GET modes"
)
replace_once(
'''    if (action === "check_now") {
      const item = await readJson(env, `bili:connector:${body.id}`, null);
      if (!item || item.groupId !== groupId) return jsonResponse({ ok: false, message: "找不到监控项目。" }, 404);
      const result = await pollOneAutomaticBilibiliConnector(env, item, Date.now(), { force: true });''',
'''    if (action === "check_now") {
      const item = await readJson(env, `bili:connector:${body.id}`, null);
      if (!item || item.groupId !== groupId) return jsonResponse({ ok: false, message: "找不到监控项目。" }, 404);
      if (item.mode === "generic_webhook") return jsonResponse({ ok: false, message: "Webhook 模式不执行主动抓取；请从开放平台或授权中继发送测试事件。" }, 400);
      const result = await pollOneAutomaticBilibiliConnector(env, item, Date.now(), { force: true });''',
    "bili webhook check guard"
)
replace_once(
'''    if (action === "update_interval") {
      const item = await readJson(env, `bili:connector:${body.id}`, null);
      if (!item || item.groupId !== groupId) return jsonResponse({ ok: false, message: "找不到监控项目。" }, 404);
      item.pollIntervalSeconds = bilibiliPollIntervalSeconds(body.pollIntervalSeconds || item.pollIntervalSeconds);''',
'''    if (action === "update_interval") {
      const item = await readJson(env, `bili:connector:${body.id}`, null);
      if (!item || item.groupId !== groupId) return jsonResponse({ ok: false, message: "找不到监控项目。" }, 404);
      if (item.mode === "generic_webhook") return jsonResponse({ ok: false, message: "Webhook 模式没有轮询频率。" }, 400);
      item.pollIntervalSeconds = bilibiliPollIntervalSeconds(body.pollIntervalSeconds || item.pollIntervalSeconds);''',
    "bili webhook interval guard"
)
replace_once(
'''    const id = String(body.id || `bili_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`);
    const existing = await readJson(env, `bili:connector:${id}`, null);
    const creatorId = normalizeBilibiliUid(body.creatorId || existing?.creatorId || "");
    if (!creatorId) return jsonResponse({ ok: false, message: "自动监控必须填写 B站用户的数字 UID。" }, 400);
    const item = {
      ...existing,
      id, groupId,
      creatorId,
      creatorName: String(body.creatorName || existing?.creatorName || "").trim().slice(0, 120),
      mode: "automatic_polling",
      enabled: body.enabled !== false,
      pollIntervalSeconds: bilibiliPollIntervalSeconds(body.pollIntervalSeconds || existing?.pollIntervalSeconds),
      liveNotify: Boolean(body.liveNotify), liveAtAll: Boolean(body.liveAtAll),
      videoNotify: Boolean(body.videoNotify), videoAtAll: Boolean(body.videoAtAll),
      createdBy: existing?.createdBy || authed.qq,
      createdAt: existing?.createdAt || Date.now(), updatedAt: Date.now(),
      nextPollAt: 0
    };
    if (existing?.webhookSecret) await dbDel(env, `bili:webhook_secret:${existing.webhookSecret}`);
    delete item.webhookSecret;
    await dbPut(env, `bili:connector:${id}`, JSON.stringify(item));
    await appendIndex(env, `bili:connector:index:${groupId}`, id, 500);
    await appendIndex(env, "bili:connector:index:all", id, 5000);
    await writeSystemAudit(env, { type: "bilibili_auto_monitor", groupId, actorId: authed.qq, action: existing ? "update" : "create", connectorId: id, creatorId, pollIntervalSeconds: item.pollIntervalSeconds });
    return jsonResponse({ ok: true, message: "B站自动监控已保存，将在下一次定时任务检查；也可以立即检查。", connector: item });''',
'''    const id = String(body.id || `bili_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`);
    const existing = await readJson(env, `bili:connector:${id}`, null);
    const requestedMode = body.mode === "official_webhook" ? "generic_webhook" : "automatic_polling";
    const creatorId = normalizeBilibiliUid(body.creatorId || existing?.creatorId || "");
    if (!creatorId) return jsonResponse({ ok: false, message: "请填写 B站用户的数字 UID，用于核对事件来源。" }, 400);
    const item = {
      ...existing,
      id, groupId,
      creatorId,
      creatorName: String(body.creatorName || existing?.creatorName || "").trim().slice(0, 120),
      mode: requestedMode,
      enabled: body.enabled !== false,
      pollIntervalSeconds: requestedMode === "automatic_polling" ? bilibiliPollIntervalSeconds(body.pollIntervalSeconds || existing?.pollIntervalSeconds) : 0,
      liveNotify: Boolean(body.liveNotify), liveAtAll: Boolean(body.liveAtAll),
      videoNotify: Boolean(body.videoNotify), videoAtAll: Boolean(body.videoAtAll),
      createdBy: existing?.createdBy || authed.qq,
      createdAt: existing?.createdAt || Date.now(), updatedAt: Date.now(),
      nextPollAt: 0
    };
    if (existing?.webhookSecret && requestedMode !== "generic_webhook") await dbDel(env, `bili:webhook_secret:${existing.webhookSecret}`);
    let webhookUrl = "";
    if (requestedMode === "generic_webhook") {
      item.webhookSecret = existing?.webhookSecret || crypto.randomUUID().replaceAll("-", "");
      await dbPut(env, `bili:webhook_secret:${item.webhookSecret}`, id);
      webhookUrl = `${url.origin}/api/integrations/bilibili/webhook/${item.webhookSecret}`;
    } else {
      delete item.webhookSecret;
    }
    await dbPut(env, `bili:connector:${id}`, JSON.stringify(item));
    await appendIndex(env, `bili:connector:index:${groupId}`, id, 500);
    await appendIndex(env, "bili:connector:index:all", id, 5000);
    await writeSystemAudit(env, { type: "bilibili_auto_monitor", groupId, actorId: authed.qq, action: existing ? "update" : "create", connectorId: id, creatorId, mode: requestedMode, pollIntervalSeconds: item.pollIntervalSeconds });
    const { webhookSecret, ...safeItem } = item;
    return jsonResponse({
      ok: true,
      message: requestedMode === "generic_webhook"
        ? "Webhook 监控已保存。请把回调地址配置到哔哩哔哩开放平台，或合法授权的事件中继。"
        : "兼容轮询已保存；首次检查只建立基准。建议优先改用 Webhook。",
      connector: safeItem,
      webhookUrl
    });''',
    "bili save modes"
)

# Verification and all portal pages
replace_once(
'''async function sendPortalVerificationMessage(env, qq, message) {
  const userId = numericId(qq);
  const errors = [];''',
'''async function sendPortalVerificationMessage(env, qq, message) {
  const userId = numericId(qq);
  message = toSimplifiedChinese(String(message || ""));
  const errors = [];''',
    "verification simplified"
)
for function_name, next_marker in [
    ("getLiveHtmlPage", "\nasync function handleAppealApi"),
    ("getAppealPage", "\nfunction getPortalHomePage"),
]:
    start = text.index(f"function {function_name}(")
    end = text.index(next_marker, start)
    block = text[start:end]
    if "return toSimplifiedChinese(" not in block:
        block = block.replace("  return `<!doctype html>", "  return toSimplifiedChinese(`<!doctype html>", 1)
        pos = block.rfind("`;")
        if pos < 0:
            raise RuntimeError(f"{function_name}: closing template not found")
        block = block[:pos] + "`);" + block[pos + 2:]
        block = block.replace('lang="zh-Hant"', 'lang="zh-Hans-CN"')
        text = text[:start] + block + text[end:]
start = text.index("function getPortalHomePage(")
end = text.index("\nexport class OneBotHub", start)
block = text[start:end]
block = block.replace("  return String.raw`<!doctype html>", "  return toSimplifiedChinese(String.raw`<!doctype html>", 1)
pos = block.rfind("`;")
if pos < 0:
    raise RuntimeError("portal closing template not found")
block = block[:pos] + "`);" + block[pos + 2:]
text = text[:start] + block + text[end:]

# Portal UI mobile layout
replace_once(
'*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text)}button,input,select,textarea{font:inherit}.hidden{display:none!important}.muted{color:var(--muted)}',
'*{box-sizing:border-box}html,body{max-width:100%;overflow-x:hidden}body{margin:0;min-width:0;min-height:100dvh;background:var(--bg);color:var(--text)}img,video,canvas,svg{max-width:100%}button,input,select,textarea{font:inherit;min-width:0}.hidden{display:none!important}.muted{color:var(--muted)}',
    "portal base mobile css"
)
replace_once(
'.nav{display:grid;gap:4px;overflow:auto}.nav button{border:0;background:transparent;color:#aeb7c9;padding:10px 12px;border-radius:10px;text-align:left;cursor:pointer;font-weight:650}.nav button:hover,.nav button.active{background:rgba(255,255,255,.1);color:#fff}.side-bottom{margin-top:auto;padding:12px 8px 2px;border-top:1px solid rgba(255,255,255,.1)}',
'.nav{display:grid;gap:12px;overflow:auto}.nav-group{display:grid;gap:4px}.nav-heading{padding:4px 12px;color:#77839a;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.nav button{border:0;background:transparent;color:#aeb7c9;padding:10px 12px;border-radius:10px;text-align:left;cursor:pointer;font-weight:650}.nav button:hover,.nav button.active{background:rgba(255,255,255,.1);color:#fff}.side-bottom{margin-top:auto;padding:12px 8px 2px;border-top:1px solid rgba(255,255,255,.1)}',
    "nav group css"
)
replace_once(
'.toast{position:fixed;right:22px;bottom:22px;max-width:420px;padding:12px 15px;border-radius:12px;background:#1c2233;color:#fff;box-shadow:var(--shadow);z-index:30}.mobile-menu{display:none}',
'.toast{position:fixed;right:22px;bottom:22px;max-width:420px;padding:12px 15px;border-radius:12px;background:#1c2233;color:#fff;box-shadow:var(--shadow);z-index:60}.mobile-menu{display:none}.sidebar-backdrop{display:none}',
    "backdrop base css"
)
replace_once(
'@media(max-width:760px){.app{display:block}.sidebar{position:fixed;left:0;top:0;width:270px;z-index:20;transform:translateX(-102%);transition:.2s}.sidebar.open{transform:none}.mobile-menu{display:inline-flex}.topbar{padding:0 14px}.topbar h2{font-size:17px}.top-actions select{max-width:145px}.content{padding:16px}.span-3,.span-4,.span-5,.span-6,.span-7,.span-8{grid-column:1/-1}.split{grid-template-columns:1fr}.section-head{display:block}.section-head .row{margin-top:12px}}',
'@media(max-width:760px){.app{display:block;min-height:100dvh}.sidebar{position:fixed;inset:0 auto 0 0;width:min(86vw,300px);height:100dvh;z-index:40;transform:translateX(-102%);transition:transform .2s ease;padding:calc(14px + env(safe-area-inset-top)) 12px calc(12px + env(safe-area-inset-bottom))}.sidebar.open{transform:none}.sidebar-backdrop{position:fixed;inset:0;z-index:35;background:rgba(3,6,12,.66);backdrop-filter:blur(2px)}.sidebar-backdrop.open{display:block}.mobile-menu{display:inline-flex}.topbar{height:auto;min-height:64px;flex-wrap:wrap;padding:calc(10px + env(safe-area-inset-top)) 12px 10px}.topbar h2{font-size:17px}.top-actions{width:100%;display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:8px}.top-actions select{width:100%;max-width:none}.content{width:100%;padding:14px 12px calc(22px + env(safe-area-inset-bottom))}.span-3,.span-4,.span-5,.span-6,.span-7,.span-8{grid-column:1/-1}.split{grid-template-columns:1fr}.section-head{display:block}.section-head .row,.section-head>.btn{margin-top:12px}.row>input,.row>select,.row>textarea{flex:1 1 150px;max-width:100%}.btn{min-height:44px}.card{padding:14px;border-radius:14px;overflow:hidden}.item-head,.log-card-head{flex-wrap:wrap}.grid{gap:12px}.code,.log-details pre{overflow:auto}}\n@media(max-width:480px){.top-actions{grid-template-columns:1fr 1fr}.top-actions select{grid-column:1/-1}.row>.btn{flex:1 1 auto}.login{padding:14px}.login-card{padding:20px;border-radius:18px}.toast{left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom));max-width:none}}',
    "mobile css"
)
replace_once(
'''  </aside>
  <main class="main">''',
'''  </aside>
  <div id="sidebarBackdrop" class="sidebar-backdrop"></div>
  <main class="main">''',
    "backdrop html"
)

# Portal role-aware visibility and sidebar grouping
replace_once(
"function applyRoleVisibility(){if(!session)return;var p=session.permissions||{},role=session.role||'member';document.querySelectorAll('#nav button').forEach(function(b){var v=b.dataset.view,show=true;if(role==='member'&&!['overview','models','memory','appeals','violationhistory'].includes(v))show=false;if(role==='admin'&&['quota','health'].includes(v))show=false;if(role==='owner'&&v==='quota')show=false;if(v==='quota'&&!p.developer)show=false;b.style.display=show?'':'none'})}",
"function applyRoleVisibility(){if(!session)return;var p=session.permissions||{},role=session.role||'member';document.querySelectorAll('#nav button').forEach(function(b){var v=b.dataset.view,show=true;if(role==='member'&&!['overview','models','memory','appeals','violationhistory','settingscenter','platform'].includes(v))show=false;if(role==='admin'&&['quota','health'].includes(v))show=false;if(role==='owner'&&v==='quota')show=false;if(v==='quota'&&!p.developer)show=false;b.style.display=show?'':'none'});refreshSidebarGroupVisibility()}",
    "member settings visibility"
)
replace_once(
'<div class="section-head"><div><h2>设置中心</h2><p>仅开发者可见，用于跨权限排查与集中维护。群管理员的日常设置请放在群组设置、群规监控、B站监控等对应页面。</p></div>',
'<div class="section-head"><div><h2>设置中心</h2><p>集中显示当前账号可修改的全部设置。普通成员、管理员、群主与开发者会看到不同项目；高风险设置仍需真实群主验证。</p></div>',
    "settings UI description"
)
replace_once(
'<div class="section-head"><div><h2>B站自动监控</h2><p>输入 B站用户 UID，Worker 会按你选择的频率检查。建议 30 分钟或更慢，过快容易触发 B站 412 风控。</p></div><button id="biliReload" class="btn">重新加载</button></div><div class="card"><div class="row"><input id="biliCreatorName" placeholder="创作者名称（选填）"><input id="biliCreatorId" inputmode="numeric" placeholder="B站用户 UID（必填）"><select id="biliPollInterval"><option value="300">每 5 分钟</option><option value="600">每 10 分钟</option><option value="900">每 15 分钟</option><option value="1800" selected>每 30 分钟（推荐）</option><option value="3600">每 1 小时</option><option value="7200">每 2 小时</option><option value="21600">每 6 小时</option></select></div>',
'<div class="section-head"><div><h2>B站监控</h2><p>推荐使用哔哩哔哩开放平台 Webhook；兼容轮询仅保留为低频备用，不保证长期可用。</p></div><button id="biliReload" class="btn">重新加载</button></div><div class="card"><div class="row"><input id="biliCreatorName" placeholder="创作者名称（选填）"><input id="biliCreatorId" inputmode="numeric" placeholder="B站用户 UID（必填）"><select id="biliMode"><option value="official_webhook" selected>开放平台 Webhook（推荐）</option><option value="automatic_polling">兼容轮询（公开网页接口）</option></select><select id="biliPollInterval"><option value="1800" selected>每 30 分钟</option><option value="3600">每 1 小时</option><option value="7200">每 2 小时</option><option value="21600">每 6 小时</option></select></div>',
    "bili UI form"
)
replace_once(
'<div class="notice">首次检查只记录当前状态，不会发送旧视频。若出现 HTTP 412，表示 B站拦截了当前 Cloudflare 出口 IP；系统会自动暂停 6～24 小时，避免持续请求加重风控。</div>',
'<div class="notice">Webhook 模式会产生带随机密钥的回调地址，请配置到哔哩哔哩开放平台或合法授权的事件中继。兼容轮询最低 30 分钟一次；出现 412／429 后会自动暂停 12～72 小时，避免持续请求。</div><div id="biliWebhookResult" class="notice hidden"></div>',
    "bili UI notice"
)
replace_once(
"function applyR3RoleVisibility(){ensureR3Views();applyRoleVisibility();",
'''function organizeSidebarNavigation(){var nav=$('nav');if(!nav||nav.dataset.grouped==='1')return;var groups=[['概览',['overview','health']],['AI 与模型',['tasks','models','aidecisions','memory']],['群组与安全',['groups','settingscenter','ruleviolations','moderation','violationhistory','appeals','appealreview','bilibili']],['系统与开发',['simulator','quota','platform','logs']]];groups.forEach(function(g){var wrap=document.createElement('div');wrap.className='nav-group';wrap.dataset.navGroup=g[0];var h=document.createElement('div');h.className='nav-heading';h.textContent=g[0];wrap.appendChild(h);g[1].forEach(function(v){var b=nav.querySelector('button[data-view="'+v+'"]');if(b)wrap.appendChild(b)});nav.appendChild(wrap)});Array.from(nav.children).forEach(function(x){if(x.tagName==='BUTTON'){var misc=nav.querySelector('.nav-group[data-nav-group="系统与开发"]');if(misc)misc.appendChild(x)}});nav.dataset.grouped='1';refreshSidebarGroupVisibility()}
function refreshSidebarGroupVisibility(){document.querySelectorAll('#nav .nav-group').forEach(function(g){var visible=Array.from(g.querySelectorAll('button')).some(function(b){return !b.hidden&&b.style.display!=='none'});g.style.display=visible?'':'none'})}
function closeMobileSidebar(){if($('sidebar'))$('sidebar').classList.remove('open');if($('sidebarBackdrop'))$('sidebarBackdrop').classList.remove('open')}
function toggleMobileSidebar(){var open=!$('sidebar').classList.contains('open');$('sidebar').classList.toggle('open',open);if($('sidebarBackdrop'))$('sidebarBackdrop').classList.toggle('open',open)}
function applyR3RoleVisibility(){ensureR3Views();organizeSidebarNavigation();applyRoleVisibility();''',
    "sidebar grouping helpers"
)
replace_once(
"function applyR3RoleVisibility(){ensureR3Views();organizeSidebarNavigation();applyRoleVisibility();var perms=(session&&session.permissions)||{};var role=(session&&session.role)||'member';var management=!!(perms.aiAdmin||perms.groupOps||perms.nativeAdmin||perms.developer||['admin','owner'].includes(role));var dev=!!perms.developer;document.querySelectorAll('#nav button').forEach(function(b){if(['ruleviolations','bilibili','aidecisions'].includes(b.dataset.view))b.hidden=!management;if(b.dataset.view==='appealreview')b.hidden=!(perms.appealReviewer||perms.nativeAdmin||perms.developer||['admin','owner'].includes(role));if(b.dataset.view==='settingscenter')b.hidden=!dev;if(b.dataset.view==='platform')b.hidden=role==='member'&&!dev});$('scDeveloper').classList.toggle('hidden',!dev);if($('pfAuditWrap'))$('pfAuditWrap').classList.toggle('hidden',!dev);if($('rvSave'))$('rvSave').disabled=!management}",
"function applyR3RoleVisibility(){ensureR3Views();organizeSidebarNavigation();applyRoleVisibility();var perms=(session&&session.permissions)||{};var role=(session&&session.role)||'member';var management=!!(perms.aiAdmin||perms.groupOps||perms.nativeAdmin||perms.developer||['admin','owner'].includes(role));var dev=!!perms.developer;document.querySelectorAll('#nav button').forEach(function(b){if(['ruleviolations','bilibili','aidecisions'].includes(b.dataset.view))b.hidden=!management;if(b.dataset.view==='appealreview')b.hidden=!(perms.appealReviewer||perms.nativeAdmin||perms.developer||['admin','owner'].includes(role));if(b.dataset.view==='settingscenter')b.hidden=false;if(b.dataset.view==='platform')b.hidden=false});if($('scDeveloper'))$('scDeveloper').classList.remove('hidden');if($('scTargetQq')){$('scTargetQq').disabled=!dev;if(!dev)$('scTargetQq').value=session.qq}if($('scAuditLog')){$('scAuditLog').disabled=!dev;var auditLabel=$('scAuditLog').closest('label');if(auditLabel)auditLabel.classList.toggle('hidden',!dev)}if($('pfAuditWrap'))$('pfAuditWrap').classList.toggle('hidden',!dev);if($('rvSave'))$('rvSave').disabled=!management;refreshSidebarGroupVisibility()}",
    "role-aware settings and platform"
)
replace_once(
"async function loadSettingsCenter(){var dev=session&&(session.permissions||{}).developer;if(!dev){$('scMessage').textContent='设置中心仅开发者可见。';$('scList').innerHTML='<div class=\"empty\">设置中心仅开发者可见。</div>';return}if(!currentGroup){",
"async function loadSettingsCenter(){var dev=session&&(session.permissions||{}).developer;if(!currentGroup){",
    "settings load nondev"
)
replace_once(
"var p=new URLSearchParams();p.set('targetQq',$('scTargetQq').value||session.qq);var r=await api('/settings-center?'+p.toString());",
"var p=new URLSearchParams();p.set('targetQq',dev?($('scTargetQq').value||session.qq):session.qq);var r=await api('/settings-center?'+p.toString());",
    "settings target nondev"
)
replace_once(
"async function saveAllSettings(){var dev=session&&(session.permissions||{}).developer;if(!dev){toast('设置中心仅开发者可用');return}var settings=",
"async function saveAllSettings(){var dev=session&&(session.permissions||{}).developer;var settings=",
    "settings save nondev"
)
replace_once(
"var payload={settings:settings,targetQq:$('scTargetQq').value,auditMode:$('scAuditLog').checked?'log':'silent'};",
"var payload={settings:settings,targetQq:dev?$('scTargetQq').value:session.qq,auditMode:dev&&$('scAuditLog').checked?'log':'silent'};",
    "settings save payload"
)

# Bilibili portal behavior
replace_once(
"var status=c.lastCheckStatus||'等待首次检查';var next=c.nextPollAt?new Date(Number(c.nextPollAt)).toLocaleString():'下一次定时任务';d.innerHTML='<div class=\"item-title\">'+esc(c.creatorName||('UID '+c.creatorId))+'</div><div class=\"item-meta\">模式：自动监控｜UID：'+esc(c.creatorId)+'｜间隔：'+esc(c.pollIntervalSeconds||1800)+' 秒｜直播：'",
"var status=c.lastCheckStatus||'等待首次事件';var webhook=c.mode==='official_webhook';var next=webhook?'由 Webhook 推送':(c.nextPollAt?new Date(Number(c.nextPollAt)).toLocaleString():'下一次定时任务');d.innerHTML='<div class=\"item-title\">'+esc(c.creatorName||('UID '+c.creatorId))+'</div><div class=\"item-meta\">模式：'+(webhook?'开放平台 Webhook':'兼容轮询')+'｜UID：'+esc(c.creatorId)+(webhook?'':'｜间隔：'+esc(c.pollIntervalSeconds||1800)+' 秒')+'｜直播：'",
    "bili render mode"
)
replace_once(
"var interval=document.createElement('select');[[300,'5 分钟'],[600,'10 分钟'],[900,'15 分钟'],[1800,'30 分钟'],[3600,'1 小时'],[7200,'2 小时'],[21600,'6 小时']].forEach(function(v){",
"var interval=document.createElement('select');[[1800,'30 分钟'],[3600,'1 小时'],[7200,'2 小时'],[21600,'6 小时']].forEach(function(v){",
    "bili render intervals"
)
replace_once(
"interval.value=String(c.pollIntervalSeconds||1800);var saveInterval=document.createElement('button');saveInterval.className='btn';saveInterval.textContent='保存检查频率';saveInterval.onclick=function(){updateBilibiliInterval(c.id,interval.value)};var check=document.createElement('button');check.className='btn primary';check.textContent='立即检查';check.onclick=function(){checkBilibiliNow(c.id)};",
"interval.value=String(c.pollIntervalSeconds||1800);interval.disabled=webhook;var saveInterval=document.createElement('button');saveInterval.className='btn';saveInterval.textContent='保存检查频率';saveInterval.disabled=webhook;saveInterval.onclick=function(){updateBilibiliInterval(c.id,interval.value)};var check=document.createElement('button');check.className='btn primary';check.textContent='立即检查';check.disabled=webhook;check.onclick=function(){checkBilibiliNow(c.id)};",
    "bili render controls"
)
replace_once(
"async function saveBilibiliConnector(){var uid=String($('biliCreatorId').value||'').replace(/\\D/g,'');if(!uid){toast('请输入 B站用户 UID');return}var r=await api('/integrations/bilibili','POST',{action:'save',creatorName:$('biliCreatorName').value,creatorId:uid,pollIntervalSeconds:Number($('biliPollInterval').value||1800),liveNotify:$('biliLiveNotify').checked,liveAtAll:$('biliLiveAtAll').checked,videoNotify:$('biliVideoNotify').checked,videoAtAll:$('biliVideoAtAll').checked});toast(r.message);if(r.ok){$('biliCreatorName').value='';$('biliCreatorId').value='';loadBilibili()}}",
"async function saveBilibiliConnector(){var uid=String($('biliCreatorId').value||'').replace(/\\D/g,'');if(!uid){toast('请输入 B站用户 UID');return}var r=await api('/integrations/bilibili','POST',{action:'save',mode:$('biliMode').value,creatorName:$('biliCreatorName').value,creatorId:uid,pollIntervalSeconds:Number($('biliPollInterval').value||1800),liveNotify:$('biliLiveNotify').checked,liveAtAll:$('biliLiveAtAll').checked,videoNotify:$('biliVideoNotify').checked,videoAtAll:$('biliVideoAtAll').checked});toast(r.message);if(r.ok){if(r.webhookUrl){$('biliWebhookResult').textContent='Webhook 回调地址（只在建立或更新时显示）：'+r.webhookUrl;$('biliWebhookResult').classList.remove('hidden')}else $('biliWebhookResult').classList.add('hidden');$('biliCreatorName').value='';$('biliCreatorId').value='';loadBilibili()}}",
    "bili save UI"
)
replace_once(
"$('biliReload').onclick=loadBilibili;$('biliAdd').onclick=saveBilibiliConnector}",
"$('biliReload').onclick=loadBilibili;$('biliAdd').onclick=saveBilibiliConnector;$('biliMode').onchange=function(){$('biliPollInterval').disabled=this.value==='official_webhook'};$('biliMode').onchange()}",
    "bili mode UI behavior"
)

# Mobile sidebar behavior
replace_once(
"function showView(name){document.querySelectorAll('.view').forEach(function(v){v.classList.remove('active')});document.querySelectorAll('#nav button').forEach(function(b){b.classList.toggle('active',b.dataset.view===name)});$('v-'+name).classList.add('active');$('pageTitle').textContent=titles[name]||name;$('sidebar').classList.remove('open');",
"function showView(name){document.querySelectorAll('.view').forEach(function(v){v.classList.remove('active')});document.querySelectorAll('#nav button').forEach(function(b){b.classList.toggle('active',b.dataset.view===name)});$('v-'+name).classList.add('active');$('pageTitle').textContent=titles[name]||name;closeMobileSidebar();",
    "close sidebar on view"
)
replace_once(
"async function boot(){ensureR3Views();var me=await api('/me');",
"async function boot(){ensureR3Views();organizeSidebarNavigation();var me=await api('/me');",
    "organize sidebar boot"
)
replace_once(
"$('logout').onclick=async function(){await raw('/api/auth/logout','POST',{});location.reload()};$('menu').onclick=function(){$('sidebar').classList.toggle('open')};$('refresh').onclick=function(){",
"$('logout').onclick=async function(){await raw('/api/auth/logout','POST',{});location.reload()};$('menu').onclick=toggleMobileSidebar;if($('sidebarBackdrop'))$('sidebarBackdrop').onclick=closeMobileSidebar;document.addEventListener('keydown',function(e){if(e.key==='Escape')closeMobileSidebar()});$('refresh').onclick=function(){",
    "mobile menu handlers"
)

# Final checks
required = [
    'const VERSION = "1.2.11";',
    'GEMINI_VISION_API_KEYS',
    'function imageInspectionEnabled',
    'function stripGroupAiOptOutPrefix',
    'sameQqSelfAsk = true;',
    'aiReplyOptOut ? "user_opt_out"',
    'function neutralizeAiCommandPrefix',
    '开放平台 Webhook（推荐）',
    'const BILIBILI_POLL_MIN_SECONDS = 1800;',
    'function organizeSidebarNavigation',
    'sidebar-backdrop',
    '100dvh',
    'return toSimplifiedChinese(String.raw`<!doctype html>',
    'canEditTargetQq: portalIsDeveloper'
]
for needle in required:
    if needle not in text:
        raise RuntimeError(f"missing required output: {needle}")

for forbidden in [
    '设置中心仅开发者可见。',
    '设置中心仅开发者可用。',
    'lang="zh-Hant"',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
]:
    if forbidden in text:
        raise RuntimeError(f"forbidden output still present: {forbidden}")

path.write_text(text, encoding="utf-8", newline="\n")
print(f"patched {path}: {len(text.splitlines())} lines")
