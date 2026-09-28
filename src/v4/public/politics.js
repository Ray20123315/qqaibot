const DIRECT_POLITICAL_PATTERN = /(?:政治|政黨|政党|選舉|选举|候選人|候选人|總統|总统|副總統|副总统|國會|国会|立法院|立法委員|立法委员|立委|議員|议员|首相|總理|总理|內閣|内阁|執政|执政|在野|政治人物|政治制度|外交政策|外交制裁|領土爭議|领土争议|兩岸|两岸|統一|统一|台獨|台独|罷免|罢免|公投|意識形態|意识形态|民進黨|民进党|國民黨|国民党|共產黨|共产党|民主黨|民主党|共和黨|共和党|\b(?:politics|political|election|candidate|president|vice president|prime minister|parliament|congress|political party|geopolitics)\b)/i;
const AMBIGUOUS_POLITICAL_PATTERN = /(?:政府|政策|官員|官员|領導人|领导人|國家領導|国家领导|投票|政權|政权|民主|威權|威权|制裁|主權|主权|國際關係|国际关系|行政院|國務院|国务院|白宮|白宫|克里姆林宮|克里姆林宫|\b(?:government|policy|minister|vote|sanction|sovereignty|white house|kremlin)\b)/i;
const COMPLIANCE_CONTEXT_PATTERN = /(?:隱私|隐私|個資|个资|個人信息|个人信息|資料保護|数据保护|服務條款|服务条款|法律聲明|法律声明|合規|合规|API|QQ\s*開放平台|QQ\s*开放平台|privacy|data protection|terms|compliance)/i;

function normalizePoliticalText(value) {
  return String(value || "").normalize("NFKC").replace(/\s+/g, " ").trim().slice(0, 20000);
}

function politicalTextPrefilter(value) {
  const text = normalizePoliticalText(value);
  if (!text) return Object.freeze({ decision: "pass", reason: "empty" });
  if (DIRECT_POLITICAL_PATTERN.test(text)) {
    return Object.freeze({ decision: "block", reason: "direct_political_text" });
  }
  if (AMBIGUOUS_POLITICAL_PATTERN.test(text)) {
    return Object.freeze({
      decision: "review",
      reason: COMPLIANCE_CONTEXT_PATTERN.test(text) ? "ambiguous_compliance_context" : "ambiguous_political_text"
    });
  }
  return Object.freeze({ decision: "pass", reason: "no_political_signal" });
}

function normalizeClassifierDecision(value) {
  const raw = typeof value === "object" && value !== null
    ? String(value.decision || value.label || value.result || "")
    : String(value || "");
  const normalized = raw.trim().toLowerCase().replace(/[\s_-]+/g, "");
  if (["political","politics","政治","block","blocked"].includes(normalized)) return "political";
  if (["nonpolitical","notpolitical","非政治","safe","pass"].includes(normalized)) return "non_political";
  return "uncertain";
}

async function politicalGuardDecision(value, { classify = null, stage = "input" } = {}) {
  const prefilter = politicalTextPrefilter(value);
  if (prefilter.decision === "block") return Object.freeze({ blocked: true, stage, source: "text_prefilter", reason: prefilter.reason });
  if (prefilter.decision === "pass") return Object.freeze({ blocked: false, stage, source: "text_prefilter", reason: prefilter.reason });
  if (typeof classify !== "function") return Object.freeze({ blocked: true, stage, source: "classifier_unavailable", reason: "uncertain_political_content" });
  let classification = "uncertain";
  try { classification = normalizeClassifierDecision(await classify(normalizePoliticalText(value))); }
  catch { classification = "uncertain"; }
  if (classification === "non_political") return Object.freeze({ blocked: false, stage, source: "classifier", reason: "classified_non_political" });
  return Object.freeze({ blocked: true, stage, source: "classifier", reason: classification === "political" ? "classified_political" : "uncertain_political_content" });
}

export {
  AMBIGUOUS_POLITICAL_PATTERN,
  COMPLIANCE_CONTEXT_PATTERN,
  DIRECT_POLITICAL_PATTERN,
  normalizeClassifierDecision,
  normalizePoliticalText,
  politicalGuardDecision,
  politicalTextPrefilter
};
