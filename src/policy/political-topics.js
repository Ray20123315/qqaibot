const POLITICAL_PATTERNS = Object.freeze([
  { category: "explicit_politics", pattern: /(?:政治(?:话题|話題|问题|問題|立场|立場|观点|觀點|制度|讨论|討論)?|建政|涉政|意识形态|意識形態|地缘政治|地緣政治|时政|時政)/i },
  { category: "election_party", pattern: /(?:选举|選舉|大选|大選|公投|政党|政黨|执政党|執政黨|在野党|在野黨|反对党|反對黨|竞选|競選|候选人|候選人|投票给|投票給)/i },
  { category: "government_office", pattern: /(?:总统|總統|国家主席|國家主席|总理|總理|首相|国家领导人|國家領導人|政府(?:政策|施政|改组|改組)?|国会|國會|议会|議會|立法院|国务院|國務院|外交部|国防部|國防部)/i },
  { category: "ideology", pattern: /(?:民主主义|民主主義|共产主义|共產主義|社会主义|社會主義|资本主义|資本主義|自由主义|自由主義|民族主义|民族主義|左派|右派|极左|極左|极右|極右|独裁|獨裁|威权|威權)/i },
  { category: "sovereignty_conflict", pattern: /(?:主权|主權|领土争议|領土爭議|台独|台獨|港独|港獨|藏独|藏獨|疆独|疆獨|两岸|兩岸|统一台湾|統一台灣|台湾独立|台灣獨立|南海争端|南海爭端)/i },
  { category: "sensitive_history", pattern: /(?:六四|天安门事件|天安門事件|文化大革命|文革|大跃进|大躍進|反右运动|反右運動)/i },
  { category: "public_policy", pattern: /(?:公共政策|政府法案|政治改革|宪政|憲政|外交政策|经济制裁|經濟制裁|国际制裁|國際制裁|政治新闻|政治新聞|政治人物|政治事件)/i }
]);

const FICTIONAL_CONTEXT_RE = /(?:游戏|遊戲|小说|小說|动漫|動漫|动画|動畫|漫画|漫畫|电影|電影|电视剧|電視劇|影集|角色|剧情|劇情|世界观|世界觀|设定|設定|虚构|虛構|架空|桌游|桌遊|剧本杀|劇本殺|狼人杀|狼人殺)/i;
function normalizePoliticalTopicText(value) {
  return String(value || "")
    .replace(/\[CQ:[^\]]+\]/gi, " ")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4000);
}

function classifyPoliticalTopic(value) {
  const text = normalizePoliticalTopicText(value);
  if (!text) return { blocked: false, category: "", matches: [], reason: "empty" };
  const matches = POLITICAL_PATTERNS.filter(item => item.pattern.test(text));
  if (!matches.length) return { blocked: false, category: "", matches: [], reason: "no_political_signal" };
  const categories = [...new Set(matches.map(item => item.category))];
  const fictionalOnly = FICTIONAL_CONTEXT_RE.test(text)
    && categories.every(category => category === "government_office" || category === "ideology");
  if (fictionalOnly) return { blocked: false, category: "fictional_context", matches: categories, reason: "fictional_or_game_context" };
  return {
    blocked: true,
    category: categories[0],
    matches: categories.slice(0, 6),
    reason: "deterministic_political_topic_filter"
  };
}

export { POLITICAL_PATTERNS, classifyPoliticalTopic, normalizePoliticalTopicText };
