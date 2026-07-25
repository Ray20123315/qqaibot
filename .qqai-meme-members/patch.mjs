import fs from "node:fs";

function read(path) { return fs.readFileSync(path, "utf8"); }
function write(path, value) { fs.writeFileSync(path, value); }
function replaceOnce(source, before, after, label) {
  const index = source.indexOf(before);
  if (index < 0) throw new Error(`Missing patch anchor: ${label}`);
  if (source.indexOf(before, index + before.length) >= 0) throw new Error(`Ambiguous patch anchor: ${label}`);
  return source.slice(0, index) + after + source.slice(index + before.length);
}
function insertBeforeOnce(source, marker, insertion, label) {
  const index = source.indexOf(marker);
  if (index < 0) throw new Error(`Missing insertion anchor: ${label}`);
  if (source.indexOf(marker, index + marker.length) >= 0) throw new Error(`Ambiguous insertion anchor: ${label}`);
  return source.slice(0, index) + insertion + source.slice(index);
}

// Portal API integration.
{
  const path = "src/portal/runtime.js";
  let source = read(path);
  source = replaceOnce(
    source,
    'import { cancelSchedule,',
    'import { handlePortalMemberApi } from "./members.js";\nimport { cancelSchedule,',
    "Portal member API import"
  );
  source = replaceOnce(
    source,
    '  const operationsResponse = await handleOpsPortalApi(request, env, url, path, body, authed);\n  if (operationsResponse) return operationsResponse;\n\n  if (request.method === "GET" && path === "/me") {',
    '  const operationsResponse = await handleOpsPortalApi(request, env, url, path, body, authed);\n  if (operationsResponse) return operationsResponse;\n\n  const memberResponse = await handlePortalMemberApi(request, env, url, path, body, authed);\n  if (memberResponse) return memberResponse;\n\n  if (request.method === "GET" && path === "/me") {',
    "Portal member API dispatch"
  );
  write(path, source);
}

// Portal UI injection at the single Worker entry point.
{
  const path = "worker.js";
  let source = read(path);
  source = replaceOnce(
    source,
    'import { getLiveHtmlPage, getPortalHomePage, handleGeminiLiveUpgrade, handlePortalApi } from "./src/portal/runtime.js";',
    'import { getLiveHtmlPage, getPortalHomePage, handleGeminiLiveUpgrade, handlePortalApi } from "./src/portal/runtime.js";\nimport { injectPortalMembersClient } from "./src/portal/members.js";',
    "Portal member client import"
  );
  source = replaceOnce(
    source,
    '      const portalHtml = injectDeploymentPortalClient(toSimplifiedChinese(getPortalHomePage(url.host)));',
    '      const portalHtml = injectPortalMembersClient(injectDeploymentPortalClient(toSimplifiedChinese(getPortalHomePage(url.host))));',
    "Portal member client injection"
  );
  write(path, source);
}

// Meme-aware moderation changes.
{
  const path = "src/moderation/runtime.js";
  let source = read(path);
  const memeHelpers = `
function ruleContentMayBeMeme(text) {
  const source = String(text || "").trim();
  if (source.length < 2 || source.length > 160) return false;
  return /(?:梗|接龙|接龍|复读|復讀|玩梗|热梗|熱梗|流行语|流行語|名场面|名場面|口号|口號)/i.test(source)
    || /^[\\p{L}\\p{N}，。！？!?、~～ ]{2,80}$/u.test(source);
}

async function readRuleMemeExamples(env, groupId, limit = 60) {
  const rows = await readJson(env, \`rule_meme_examples:\${groupId}\`, []);
  return (Array.isArray(rows) ? rows : []).slice(-Math.max(1, Math.min(200, Number(limit || 60))));
}

async function rememberRuleMemeExample(env, item, actorId, note) {
  const explanation = String(note || "").trim().slice(0, 1000);
  if (!/(?:梗|接龙|接龍|复读|復讀|玩笑|群友都在玩|流行|好玩|名场面|名場面)/i.test(explanation)) return null;
  const normalized = normalizeSpamBurstText(item?.content || "");
  if (!normalized) return null;
  const key = \`rule_meme_examples:\${item.groupId}\`;
  const current = await readJson(env, key, []);
  const next = (Array.isArray(current) ? current : []).filter(row => row?.normalized !== normalized);
  const saved = {
    normalized,
    text: String(item?.content || "").slice(0, 500),
    note: explanation,
    actorId: String(actorId || ""),
    at: Date.now()
  };
  next.push(saved);
  await dbPut(env, key, JSON.stringify(next.slice(-200)));
  await writeSystemAudit(env, { type: "rule_meme_example_learned", groupId: item.groupId, actorId: String(actorId || ""), targetId: item.id, action: "remember", reason: explanation }).catch(() => {});
  return saved;
}

function localMemeContextSignals(recentContext) {
  const source = String(recentContext || "");
  const support = (source.match(/(?:这是|這是|属于|屬於|近期|最近|当前|當前).{0,12}(?:梗|接龙|接龍|流行)|玩梗|群梗|挺好玩|录取了|錄取了|接上了|接上啦/gi) || []).length;
  const cooperative = (source.match(/(?:哈哈|笑死|草|确实|確實|有意思|挺好玩|好玩|接龙|接龍)/gi) || []).length;
  const objections = (source.match(/(?:别刷|別刷|停止刷|不要刷|影响聊天|影響聊天|太吵|很烦|很煩|煞风景|煞風景|已经刷屏|已經刷屏)/gi) || []).length;
  return {
    support,
    cooperative,
    objections,
    likelyGroupMeme: support >= 1 && support + cooperative > objections,
    disruptive: objections >= 1 && objections > support + Math.floor(cooperative / 2)
  };
}

async function verifyRuleMemeContext(env, { groupId, text, repeatedMessageBurst = false, recentContext = "", targetRecentMessages = [], humanFeedbackExamples = [], learnedExamples = [] }) {
  if (!repeatedMessageBurst && !ruleContentMayBeMeme(text)) return null;
  const normalized = normalizeSpamBurstText(text);
  if (!normalized) return null;
  const localSignals = localMemeContextSignals(recentContext);
  const learned = (Array.isArray(learnedExamples) ? learnedExamples : []).find(example => spamTextSimilarity(example?.normalized || example?.text || "", normalized) >= 0.82);
  const corrected = (Array.isArray(humanFeedbackExamples) ? humanFeedbackExamples : []).find(example => example?.verdict === "not_violation" && /(?:梗|接龙|接龍|流行|玩笑|好玩)/i.test(String(example?.note || "")) && spamTextSimilarity(example?.content || "", normalized) >= 0.82);
  const learnedMatch = learned || corrected;
  if (learnedMatch && !localSignals.disruptive) {
    return {
      ok: true,
      likelyMeme: true,
      currentTrend: false,
      groupLocal: true,
      disruptive: false,
      confidence: 0.97,
      name: "管理员已确认的群内梗",
      reason: String(learnedMatch.note || "相似表达曾由管理复核为群内梗或正常玩笑").slice(0, 500),
      sources: [],
      source: "learned_group_example"
    };
  }
  const cacheKey = \`rule_meme_context:\${groupId}:\${(await sha256Hex(normalized)).slice(0, 32)}\`;
  const cached = await readJson(env, cacheKey, null);
  if (cached && Date.now() - Number(cached.cachedAt || 0) < 6 * 60 * 60 * 1000) {
    return { ...cached, cached: true, localSignals };
  }
  try {
    const result = await callGeminiGenerate(env, {
      models: parseList(env.GEMINI_SEARCH_MODELS, ["gemini-3.5-flash", "gemini-3.1-flash-lite"]),
      apiKeys: geminiSearchApiKeys(env),
      keyProvider: "gemini_search",
      system: `你是 QQ 群聊流行梗与接龙语境核查器。你必须结合联网搜索结果和提供的群内上下文判断一句话是否属于当前流行梗、网络接龙、复读梗、群内既有梗或普通重复消息。只输出 JSON：{"likelyMeme":true|false|null,"currentTrend":true|false,"groupLocal":true|false,"disruptive":true|false,"confidence":0到1,"name":"梗名称或空","reason":"简短证据"}。
规则：
1. 搜不到不能直接证明不是梗；群内多人自然接龙、管理员历史纠错和群内明确说明可以证明 groupLocal=true。
2. 即使是梗，若有人明确要求停止、已经明显妨碍正常聊天或群规明确禁止复读，disruptive=true。
3. 单纯重复次数多不是“不是梗”的证据；也不能因为发送者声称是梗就直接相信。
4. 当前流行趋势优先使用搜索结果；不要编造梗名称或来源。`,
      contents: [{ role: "user", parts: [{ text: JSON.stringify({
        phrase: String(text || "").slice(0, 500),
        repeatedMessageBurst,
        recentContext: String(recentContext || "").slice(0, 6000),
        targetRecentMessages: (Array.isArray(targetRecentMessages) ? targetRecentMessages : []).slice(-12),
        localSignals,
        learnedExamples: (Array.isArray(learnedExamples) ? learnedExamples : []).slice(-12),
        humanFeedbackExamples: (Array.isArray(humanFeedbackExamples) ? humanFeedbackExamples : []).slice(0, 20)
      }).slice(0, 16000) }] }],
      maxOutputTokens: 260,
      temperature: 0,
      useSearch: true,
      requireSearch: false,
      deadlineAt: Date.now() + 12000,
      maxAttempts: 2
    });
    const parsed = JSON.parse(String(result.text || "").match(/\\{[\\s\\S]*\\}/)?.[0] || "{}");
    const likelyMeme = parsed.likelyMeme === true ? true : parsed.likelyMeme === false ? false : null;
    const record = {
      ok: true,
      likelyMeme,
      currentTrend: parsed.currentTrend === true,
      groupLocal: parsed.groupLocal === true || localSignals.likelyGroupMeme,
      disruptive: parsed.disruptive === true || localSignals.disruptive,
      confidence: Math.max(0, Math.min(1, Number(parsed.confidence || 0))),
      name: String(parsed.name || "").slice(0, 160),
      reason: String(parsed.reason || "联网与群内语境核查完成").slice(0, 600),
      sources: Array.isArray(result.sources) ? result.sources.slice(0, 6) : [],
      model: String(result.model || ""),
      cachedAt: Date.now(),
      source: "search_and_context"
    };
    await dbPut(env, cacheKey, JSON.stringify(record));
    return record;
  } catch (error) {
    if (localSignals.likelyGroupMeme || localSignals.disruptive) {
      return {
        ok: true,
        likelyMeme: localSignals.likelyGroupMeme ? true : null,
        currentTrend: false,
        groupLocal: localSignals.likelyGroupMeme,
        disruptive: localSignals.disruptive,
        confidence: localSignals.likelyGroupMeme || localSignals.disruptive ? 0.72 : 0,
        name: localSignals.likelyGroupMeme ? "群内接龙或群梗" : "",
        reason: localSignals.likelyGroupMeme ? "群内上下文显示多人把该表达当作接龙或玩梗" : "群内已有明确制止或干扰信号",
        sources: [],
        source: "local_context_fallback",
        searchError: String(error?.message || error).slice(0, 400)
      };
    }
    return { ok: false, likelyMeme: null, currentTrend: false, groupLocal: false, disruptive: false, confidence: 0, reason: "梗核查暂时不可用", sources: [], error: String(error?.message || error).slice(0, 500) };
  }
}

`;
  source = insertBeforeOnce(source, "async function requestRuleManagerClarification", memeHelpers, "meme verification helpers");

  source = replaceOnce(
    source,
    `  const deterministicSpamCount = Math.max(exactSameCount, similarMessageCount);
  const deterministicSpamReview = repeatedMessageBurst ? {
    violation: true, confidence: 1, violationType: "公共秩序",
    rule: rules ? "本群刷屏规则" : "系统默认反刷屏规则",
    reason: \`\${spamWindowSeconds} 秒内同一成员发送相同或高度相似内容 \${deterministicSpamCount} 次，达到刷屏门槛 \${spamThreshold} 次。\`,
    severity: deterministicSpamCount >= spamThreshold + 3 ? "severe" : "moderate",
    intentional: true, action: "recall", muteSeconds: 0, testContext: false, linkAssessment: "无链接", deterministic: true
  } : null;
  if (!rules && !deterministicSpamReview) return { status: "no_rules" };`,
    `  const deterministicSpamCount = Math.max(exactSameCount, similarMessageCount);
  const spamEvidence = repeatedMessageBurst ? {
    deterministic: true,
    count: deterministicSpamCount,
    exactSameCount,
    similarMessageCount,
    threshold: spamThreshold,
    windowSeconds: spamWindowSeconds,
    relatedMessageIds: repeatedMessageIds
  } : null;
  if (!rules && !spamEvidence) return { status: "no_rules" };`,
    "replace direct deterministic spam verdict with evidence"
  );

  source = replaceOnce(
    source,
    "  const humanFeedbackExamples = await readRecentRuleFeedbackExamples(env, groupId, 30);\n  const strictness = await resolveAdaptiveRuleStrictness(env, groupId, recentContext, humanFeedbackExamples);",
    "  const humanFeedbackExamples = await readRecentRuleFeedbackExamples(env, groupId, 30);\n  const learnedMemeExamples = await readRuleMemeExamples(env, groupId, 60);\n  const strictness = await resolveAdaptiveRuleStrictness(env, groupId, recentContext, humanFeedbackExamples);",
    "read learned meme examples"
  );

  source = replaceOnce(
    source,
    "  const newsVerification = await verifyRuleNewsContext(env, content);\n  const imageDecisionParts = [];",
    `  const newsVerification = await verifyRuleNewsContext(env, content);
  const memeVerification = await verifyRuleMemeContext(env, {
    groupId,
    text: content,
    repeatedMessageBurst,
    recentContext,
    targetRecentMessages,
    humanFeedbackExamples,
    learnedExamples: learnedMemeExamples
  });
  const explicitMemeSpamRule = Boolean(rules && /(?:禁止|严禁|嚴禁|不得).{0,12}(?:刷屏|复读|復讀|接龙|接龍|玩梗)|(?:刷屏|复读|復讀|接龙|接龍|玩梗).{0,12}(?:禁止|严禁|嚴禁|不得)/i.test(rules));
  const memeProtected = repeatedMessageBurst
    && memeVerification?.likelyMeme === true
    && Number(memeVerification.confidence || 0) >= 0.7
    && !memeVerification.disruptive
    && !explicitMemeSpamRule;
  const confirmedDisruptiveSpam = repeatedMessageBurst
    && memeVerification
    && Number(memeVerification.confidence || 0) >= 0.72
    && (memeVerification.disruptive === true || memeVerification.likelyMeme === false);
  const deterministicSpamReview = memeProtected ? {
    violation: false,
    confidence: Math.max(0.88, Number(memeVerification.confidence || 0)),
    violationType: "公共秩序",
    rule: "流行梗／群内接龙语境",
    reason: \`检测到相同或相似内容 \${deterministicSpamCount} 次，但联网或群内语境表明这是\${memeVerification.name || "流行梗、接龙或群内玩梗"}，且没有明确制止或干扰证据；本次不按刷屏处罚。\`,
    severity: "minor",
    intentional: false,
    action: "record",
    muteSeconds: 0,
    testContext: true,
    linkAssessment: "无链接",
    deterministic: true,
    memeProtected: true
  } : confirmedDisruptiveSpam ? {
    violation: true,
    confidence: Math.max(0.86, Number(memeVerification.confidence || 0)),
    violationType: "公共秩序",
    rule: rules ? "本群刷屏规则" : "系统默认反刷屏规则",
    reason: \`\${spamWindowSeconds} 秒内同一成员发送相同或高度相似内容 \${deterministicSpamCount} 次；梗核查未发现可免责语境，或群内已有明确制止／干扰证据。\`,
    severity: deterministicSpamCount >= spamThreshold + 3 ? "severe" : "moderate",
    intentional: true,
    action: "recall",
    muteSeconds: 0,
    testContext: false,
    linkAssessment: "无链接",
    deterministic: true
  } : null;
  const imageDecisionParts = [];`,
    "meme-aware spam resolution"
  );

  source = replaceOnce(
    source,
    "16. 不确定必须输出 violation=false，并在 reason 明确写“需要管理确认”。action 只是建议，系统会按授权范围决定是否执行。`,",
    "16. 不确定必须输出 violation=false，并在 reason 明确写“需要管理确认”。action 只是建议，系统会按授权范围决定是否执行。\n17. 流行梗、多人自愿接龙、复读梗、双方都在参与的玩笑或群内既有梗不等于恶意刷屏；除非明确群规禁止，或有人明确制止、正常聊天已被持续打断，才可按公共秩序处理。\n18. memeVerification 是联网搜索、群内上下文和管理员历史纠错的综合核查。likelyMeme=true 且 disruptive=false 时优先不处罚；搜不到只能视为未知，不能直接判定“不是梗”。`,",
    "meme-aware classifier rules"
  );

  source = replaceOnce(
    source,
    "        repeatedMessageBurst,\n        trailingSameCount,",
    "        repeatedMessageBurst,\n        spamEvidence,\n        trailingSameCount,",
    "spam evidence prompt"
  );
  source = replaceOnce(
    source,
    "        humanFeedbackExamples,\n        rules: rules.slice(0, 7000),",
    "        humanFeedbackExamples,\n        learnedMemeExamples,\n        memeVerification,\n        rules: rules.slice(0, 7000),",
    "meme evidence prompt"
  );

  source = source.replaceAll("imageInspection, newsVerification }", "imageInspection, newsVerification, memeVerification }");

  source = replaceOnce(
    source,
    "    urlInspections: Array.isArray(data.urlInspections) ? data.urlInspections.slice(0, 3) : [],\n    testContext: Boolean(data.testContext),",
    "    urlInspections: Array.isArray(data.urlInspections) ? data.urlInspections.slice(0, 3) : [],\n    newsVerification: data.newsVerification || null,\n    memeVerification: data.memeVerification || null,\n    testContext: Boolean(data.testContext),",
    "persist meme verification"
  );

  source = replaceOnce(
    source,
    "    newsVerification,\n    imageInspection,",
    "    newsVerification,\n    memeVerification,\n    imageInspection,",
    "save meme verification on violation"
  );

  source = replaceOnce(
    source,
    "  await dbPut(env, `rulefeedback:${feedbackId}`, JSON.stringify(feedback));\n  await appendIndex(env, `rulefeedback:index:${item.groupId}`, feedbackId, 2000);",
    "  await dbPut(env, `rulefeedback:${feedbackId}`, JSON.stringify(feedback));\n  await appendIndex(env, `rulefeedback:index:${item.groupId}`, feedbackId, 2000);\n  if (normalizedVerdict === \"not_violation\") await rememberRuleMemeExample(env, item, actorId, note).catch(() => null);",
    "learn meme from human correction"
  );

  source = replaceOnce(
    source,
    "export { addRuleStrike, detectRepeatedMessageBurst,",
    "export { addRuleStrike, detectRepeatedMessageBurst,",
    "moderation export anchor"
  );
  source = replaceOnce(
    source,
    "readRecentRuleFeedbackExamples, readResponseTextPrefix,",
    "readRecentRuleFeedbackExamples, readResponseTextPrefix, readRuleMemeExamples, rememberRuleMemeExample,",
    "meme storage exports"
  );
  source = replaceOnce(
    source,
    "validateModerationProposalTarget, verifyRuleNewsContext };",
    "validateModerationProposalTarget, verifyRuleMemeContext, verifyRuleNewsContext };",
    "meme verification export"
  );
  write(path, source);
}

// Version, release notes, and regression entry.
{
  const configPath = "src/config/runtime.js";
  let config = read(configPath);
  config = replaceOnce(config, 'const VERSION = "2.0.3";', 'const VERSION = "2.0.4";', "runtime version");
  write(configPath, config);

  const packagePath = "package.json";
  let pkg = read(packagePath);
  pkg = replaceOnce(pkg, '"version": "2.0.3"', '"version": "2.0.4"', "package version");
  pkg = replaceOnce(pkg, 'node verify-spam-detection.mjs"', 'node verify-spam-detection.mjs && node verify-meme-member-console.mjs"', "check script");
  write(packagePath, pkg);

  write("release-notes.json", JSON.stringify({
    version: "2.0.4",
    notificationPolicy: "latest-main-only-with-runtime-success-fallback",
    queueDelivery: "mark-processed-after-success",
    added: [
      "群规判断的联网流行梗、接龙与群内梗核查",
      "管理员人工纠错后的群内梗学习记录",
      "Portal 群友列表、历史消息、按秒禁言与管理解禁"
    ],
    fixed: [
      "达到重复门槛后直接处罚，导致流行梗和多人接龙被当作刷屏",
      "管理员无法从 Portal 快速查看成员历史消息并直接解禁"
    ]
  }, null, 2) + "\n");
}

console.log("meme-aware moderation and member console patch applied");
