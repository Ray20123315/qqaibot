// Local entertainment commands. These commands never call Gemini, Gemma or DeepSeek.

const TRUTH_PROMPTS = Object.freeze([
  "最近一次让你笑到停不下来的事情是什么？",
  "你最想立刻学会哪项技能？",
  "你做过最幼稚但不后悔的事情是什么？",
  "如果可以重来一天，你会选择哪一天？",
  "你最容易因为什么事情心软？",
  "你手机里最舍不得删除的东西是什么？",
  "你最近最想完成的一件事是什么？",
  "你最不能接受朋友做什么？",
  "你有没有一个一直没说出口的感谢？",
  "你认为自己最明显的优点是什么？",
  "你最近一次说谎是为了什么？",
  "如果明天放假，你第一件事会做什么？",
  "你最想和群里哪种性格的人做朋友？",
  "你曾经误会别人最深的一次是什么？",
  "你最想改掉自己的哪个小习惯？",
  "哪一句话曾经真正安慰到你？"
]);

const DARE_PROMPTS = Object.freeze([
  "用一句话夸一下上一位发言的人。",
  "接下来三分钟只能用疑问句聊天。",
  "发一句你最近最常说的口头禅。",
  "用十个字以内形容今天的心情。",
  "给自己取一个临时群昵称，并解释原因。",
  "分享一首最近循环播放的歌。",
  "用三个词形容你理想中的周末。",
  "发一句完全不带标点的绕口令。",
  "模仿天气预报播报你现在的状态。",
  "用一句广告词推销你手边最近的物品。",
  "讲一个不涉及隐私的冷笑话。",
  "用反派语气说一句‘我要去睡觉了’。",
  "把下一句话写成古风台词。",
  "说出今天值得感谢的一件小事。",
  "用五个字以内给本群写一句评价。",
  "选择一个群友，并认真夸她／他一个优点。"
]);

const FORTUNE_LEVELS = Object.freeze([
  { min: 90, label: "大吉", advice: "适合推进拖了很久的事情，先做最重要的一步。" },
  { min: 75, label: "吉", advice: "状态不错，主动一点通常会有好结果。" },
  { min: 60, label: "小吉", advice: "稳稳完成手边任务，别同时开太多新坑。" },
  { min: 40, label: "平", advice: "保持节奏，不必因为小波动改变原计划。" },
  { min: 20, label: "小心", advice: "重要决定多确认一次，避免冲动回复或消费。" },
  { min: 0, label: "休整", advice: "今天更适合整理与休息，把精力留给真正重要的事。" }
]);

const FORTUNE_COLORS = Object.freeze(["蓝色", "绿色", "银色", "紫色", "橙色", "白色", "黑色", "金色", "青色", "红色"]);

function secureRandomUint32() {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return values[0] >>> 0;
}

function normalizeRandomUint(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.trunc(number) >>> 0;
}

function randomIntInclusive(min, max, randomUint32 = secureRandomUint32) {
  const lower = Math.ceil(Number(min));
  const upper = Math.floor(Number(max));
  if (!Number.isSafeInteger(lower) || !Number.isSafeInteger(upper) || upper < lower) throw new Error("invalid_random_range");
  const span = upper - lower + 1;
  if (span <= 0 || span > 0x100000000) throw new Error("random_range_too_large");
  const limit = Math.floor(0x100000000 / span) * span;
  let value = 0;
  do value = normalizeRandomUint(randomUint32()); while (value >= limit);
  return lower + (value % span);
}

function pickRandom(list, randomUint32) {
  return list[randomIntInclusive(0, list.length - 1, randomUint32)];
}

function stableHash(value) {
  let hash = 2166136261;
  for (const char of String(value || "")) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function taipeiDateKey(now = new Date()) {
  const date = now instanceof Date ? now : new Date(now);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(item => [item.type, item.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function normalizeGesture(value) {
  const source = String(value || "").normalize("NFKC").toLowerCase().replace(/\s+/g, "");
  if (["石头", "石頭", "rock", "拳头", "拳頭"].includes(source)) return "石头";
  if (["剪刀", "scissors", "scissor"].includes(source)) return "剪刀";
  if (["布", "paper"].includes(source)) return "布";
  return "";
}

function splitChoices(value) {
  const source = String(value || "").trim();
  let parts = source.split(/\s*(?:\||｜|、|；|;)\s*/).map(item => item.trim()).filter(Boolean);
  if (parts.length < 2) parts = source.split(/\s*[,，]\s*/).map(item => item.trim()).filter(Boolean);
  return [...new Set(parts)].slice(0, 20);
}

function diceHelp() {
  return "格式：!骰子、!骰子 20、!骰子 2d6。数量 1～20，面数 2～10000。";
}

function entertainmentHelpText() {
  return [
    "【娱乐指令】",
    "• !骰子 [面数／NdM]：掷骰子，例如 !骰子 2d6",
    "• !随机数 [最小] [最大]：默认 1～100",
    "• !硬币：抛一次硬币",
    "• !猜拳 石头／剪刀／布",
    "• !选择 选项A | 选项B | 选项C",
    "• !今日运势：同一人每天结果固定",
    "• !真心话：随机题目",
    "• !大冒险：随机安全任务"
  ].join("\n");
}

function handleEntertainmentCommand({ text, userId = "", groupId = "", now = new Date(), randomUint32 = secureRandomUint32 } = {}) {
  const source = String(text || "").trim();
  if (!/^[!！]/.test(source)) return { handled: false };
  const body = source.replace(/^[!！]+/, "").trim();

  if (/^(?:娱乐|娛樂|娱乐帮助|娛樂幫助|fun)$/i.test(body)) {
    return { handled: true, kind: "help", text: entertainmentHelpText() };
  }

  const diceMatch = body.match(/^(?:骰子|掷骰|擲骰|dice)(?:\s+(.+))?$/i);
  if (diceMatch) {
    const raw = String(diceMatch[1] || "1d6").trim().toLowerCase();
    let count = 1;
    let sides = 6;
    const notation = raw.match(/^(\d{1,2})?\s*d\s*(\d{1,5})$/i);
    if (notation) {
      count = Number(notation[1] || 1);
      sides = Number(notation[2]);
    } else if (/^\d{1,5}$/.test(raw)) {
      sides = Number(raw);
    } else {
      return { handled: true, kind: "dice", text: diceHelp() };
    }
    if (count < 1 || count > 20 || sides < 2 || sides > 10000) {
      return { handled: true, kind: "dice", text: diceHelp() };
    }
    const rolls = Array.from({ length: count }, () => randomIntInclusive(1, sides, randomUint32));
    const total = rolls.reduce((sum, value) => sum + value, 0);
    const suffix = count > 1 ? `\n合计：${total}` : "";
    return { handled: true, kind: "dice", text: `🎲 ${count}d${sides}：${rolls.join("、")}${suffix}` };
  }

  const randomMatch = body.match(/^(?:随机数|隨機數|random|rand)(?:\s+(-?\d+))?(?:\s+(-?\d+))?$/i);
  if (randomMatch) {
    let min = randomMatch[1] === undefined ? 1 : Number(randomMatch[1]);
    let max = randomMatch[2] === undefined ? (randomMatch[1] === undefined ? 100 : Number(randomMatch[1])) : Number(randomMatch[2]);
    if (randomMatch[2] === undefined && randomMatch[1] !== undefined) min = 1;
    if (![min, max].every(Number.isSafeInteger) || min < -1000000000 || max > 1000000000 || max < min || max - min > 1000000000) {
      return { handled: true, kind: "random_number", text: "格式：!随机数 1 100。范围需由小到大，跨度最多十亿。" };
    }
    return { handled: true, kind: "random_number", text: `🎯 随机结果：${randomIntInclusive(min, max, randomUint32)}（范围 ${min}～${max}）` };
  }

  if (/^(?:硬币|硬幣|抛硬币|拋硬幣|coin)$/i.test(body)) {
    return { handled: true, kind: "coin", text: `🪙 结果：${randomIntInclusive(0, 1, randomUint32) === 0 ? "正面" : "反面"}` };
  }

  const rpsMatch = body.match(/^(?:猜拳|石头剪刀布|石頭剪刀布|rps)(?:\s+(.+))?$/i);
  if (rpsMatch) {
    const userChoice = normalizeGesture(rpsMatch[1]);
    if (!userChoice) return { handled: true, kind: "rps", text: "格式：!猜拳 石头／剪刀／布。" };
    const botChoice = pickRandom(["石头", "剪刀", "布"], randomUint32);
    const result = userChoice === botChoice
      ? "平局"
      : (userChoice === "石头" && botChoice === "剪刀") || (userChoice === "剪刀" && botChoice === "布") || (userChoice === "布" && botChoice === "石头")
        ? "你赢了"
        : "我赢了";
    return { handled: true, kind: "rps", text: `✊ 你出${userChoice}，我出${botChoice}：${result}。` };
  }

  const choiceMatch = body.match(/^(?:选择|選擇|帮我选|幫我選|抽签|抽籤|choice)\s+([\s\S]+)$/i);
  if (choiceMatch) {
    const choices = splitChoices(choiceMatch[1]);
    if (choices.length < 2) return { handled: true, kind: "choice", text: "格式：!选择 火锅 | 烧烤 | 拉面。请至少提供两个选项。" };
    if (choices.some(item => item.length > 60)) return { handled: true, kind: "choice", text: "每个选项最多 60 个字符，请缩短后再试。" };
    return { handled: true, kind: "choice", text: `🎯 我选：${pickRandom(choices, randomUint32)}` };
  }

  if (/^(?:今日运势|今日運勢|运势|運勢|fortune)$/i.test(body)) {
    const seed = stableHash(`${taipeiDateKey(now)}:${String(groupId || "private")}:${String(userId || "anonymous")}`);
    const score = (seed % 100) + 1;
    const level = FORTUNE_LEVELS.find(item => score >= item.min) || FORTUNE_LEVELS[FORTUNE_LEVELS.length - 1];
    const luckyNumber = ((seed >>> 8) % 9) + 1;
    const color = FORTUNE_COLORS[(seed >>> 16) % FORTUNE_COLORS.length];
    return {
      handled: true,
      kind: "fortune",
      text: `🔮 今日运势：${level.label}（${score}/100）\n幸运数字：${luckyNumber}｜幸运色：${color}\n建议：${level.advice}`
    };
  }

  if (/^(?:真心话|真心話|truth)$/i.test(body)) {
    return { handled: true, kind: "truth", text: `💬 真心话：${pickRandom(TRUTH_PROMPTS, randomUint32)}` };
  }

  if (/^(?:大冒险|大冒險|dare)$/i.test(body)) {
    return { handled: true, kind: "dare", text: `🎭 大冒险：${pickRandom(DARE_PROMPTS, randomUint32)}` };
  }

  return { handled: false };
}

export {
  DARE_PROMPTS,
  TRUTH_PROMPTS,
  entertainmentHelpText,
  handleEntertainmentCommand,
  randomIntInclusive,
  splitChoices,
  stableHash,
  taipeiDateKey
};
