const VERSION = "1.2.2";
const QQAI_V1_COMPLETE_MARKER = "QQAI_V1_COMPLETE_MARKER";
const QQAI_V1_R3_MARKER = "QQAI_V1_R3_MARKER";
const BUILD_DATE = "2026-07-23";
const DEFAULT_DEVELOPER_ID = "3569028262";
const DEFAULTS = Object.freeze({
  deepseekFlashModel: "deepseek-v4-flash",
  interjectRate: 25,
  contextSummaryThreshold: 20,
  groupContextExactMessages: 60,
  groupContextMaximumMessages: 240,
  conversationHistoryItems: 32,
  aiDecisionLogLimit: 2000,
  thinkingDelayMs: 1200,
  scheduleMinIntervalMinutes: 1,
  scheduleMaxActivePerUser: 0,
  scheduleMaxPerGroupHour: 0,
  appealEnabled: true,
  userQueueMax: 5,
  userQueueTtlMs: 10 * 60 * 1000,
  moderationProposalTtlMs: 2 * 60 * 1000,
  modelCostPolicy: "free_first",
  deepseekEmergencyFallback: false,
  paidContextSummary: false,
  portalSessionTtlMs: 30 * 60 * 1000,
  moderationTargetCooldownSeconds: 0,
  newcomerObservationDays: 0,
  autoCheckinTime: "00:00",
  welcomeText: "歡迎 {at} 加入本群 🎉 請先閱讀群規，有問題可以詢問管理員。",
  ruleMonitorEnabled: true,
  ruleProxyMode: "record",
  ruleProxyMuteSeconds: 600,
  runtimeRateLimitSeconds: 0,
  joinPatternAutoApproveThreshold: 2,
});

let GEMINI_KEY_CURSOR = 0;
let GEMINI_SEARCH_KEY_CURSOR = 0;
let DEEPSEEK_KEY_CURSOR = 0;

const PLATFORM_FEATURE_COUNT = 300;
const PLATFORM_FEATURE_NAMES = Object.freeze([
  "群規持續監控",
  "違規紀錄獨立頁面",
  "依群員搜尋違規",
  "依訊息內容搜尋違規",
  "依 AI 違規分類搜尋",
  "AI 代理僅記錄",
  "AI 代理警告",
  "AI 代理禁言",
  "AI 踢出群主授權",
  "AI 踢出授權撤回",
  "處置冷卻不限上限",
  "開發者全域速率限制",
  "開發者群組速率限制",
  "設定型指令開關",
  "關閉指令後僅網頁可改",
  "角色分層設定中心",
  "開發者代改成員設定",
  "開發者代改管理員設定",
  "開發者代改群主設定",
  "設定修改稽核模式",
  "設定修改靜默模式",
  "入群輔助關閉零 AI",
  "重複入群申請模式快取",
  "AI 自動同意入群",
  "AI 拒絕入群群主授權",
  "AI 拒絕入群授權撤回",
  "B站創作者自訂串接",
  "B站開播通知",
  "B站新影片通知",
  "B站開播 @全體",
  "B站新影片 @全體",
  "B站只記錄不通知",
  "Bot 群身分即時驗證",
  "自然語言禁言提案",
  "自然語言解除禁言",
  "踢人提案",
  "批量踢人提案",
  "全員禁言提案",
  "設定管理員提案",
  "修改群名提案",
  "修改群名片提案",
  "移出精華消息",
  "設為精華消息",
  "查看禁言列表",
  "管理操作原因必填",
  "管理動作預覽",
  "雙人批准",
  "延遲執行",
  "管理撤銷",
  "管理黑名單保護",
  "危險語義區分",
  "加群申請摘要",
  "Gemma 判斷申請內容",
  "管理員 Portal 審核",
  "同意／拒絕二次確認",
  "黑名單比對",
  "重複申請冷卻",
  "自動歡迎訊息",
  "新人群規確認",
  "新人答題驗證",
  "AI 草擬公告",
  "公告發布前預覽",
  "公告版本歷史",
  "定時公告",
  "公告閱讀提醒",
  "群公告摘要",
  "公告內容翻譯",
  "群文件搜尋",
  "列出指定資料夾內容",
  "取得群文件下載 URL",
  "檔案自動分類",
  "檔案重複偵測",
  "群文件索引進知識庫",
  "檔案上傳通知",
  "檔案過期提醒",
  "長回答自動合併轉發",
  "長回答分頁",
  "引用原問題回答",
  "回覆撤回失敗補救",
  "訊息發送狀態追蹤",
  "重複訊息去重",
  "圖片＋文字保持原順序",
  "戳一戳互動",
  "AI 群語音",
  "一人同時一題",
  "第二題起排隊",
  "最多等待題數可設定",
  "過期自動丟棄",
  "插隊只限管理員",
  "可取消自己的等待題",
  "可替換尚未開始的最後一題",
  "合併短時間連續訊息",
  "顯示目前順位",
  "顯示預估等待時間",
  "不讓單一群占滿所有 AI",
  "各群輪流取一題",
  "明確 @ 高於隨機插話",
  "管理確認高於普通聊天",
  "短確認語使用快速通道",
  "圖片理解使用獨立併發槽",
  "搜尋任務使用獨立併發槽",
  "DeepSeek Pro 有較低全站併發",
  "取消",
  "暫停",
  "重試",
  "改用其他模型重試",
  "查看原始錯誤",
  "查看目前處理階段",
  "查看工具呼叫",
  "查看 Token",
  "查看搜尋來源",
  "查看記憶命中",
  "超時自動清除正在思考",
  "Worker 重啟後恢復等待任務",
  "踢人／禁言二次確認",
  "入群審核",
  "群白名單申請",
  "定時活動流程",
  "每週報告",
  "模型健康巡檢",
  "API Key 輪換檢查",
  "大型文件索引",
  "記憶重建",
  "提示詞發布審核",
  "設定變更批准",
  "管理員角色申請",
  "資料刪除請求",
  "批次群通知",
  "錯誤自動修復流程",
  "使用者偏好",
  "使用者明確事實",
  "群組共同規則",
  "管理員手動記憶",
  "臨時上下文",
  "AI 推測",
  "文件知識",
  "搜尋知識快取",
  "事件記憶",
  "禁止保存的敏感內容",
  "記憶衝突偵測",
  "新資訊覆蓋舊資訊前確認",
  "記憶自動過期",
  "長期未使用記憶降權",
  "使用者查看自己的記憶",
  "使用者刪除自己的記憶",
  "群主查看群記憶",
  "每群 namespace 隔離",
  "不允許跨群洩漏",
  "指令及系統提示永不進記憶",
  "AI 推測記憶低可信度",
  "明確陳述高可信度",
  "時間敏感事實自動過期",
  "搜尋結果不直接當永久事實",
  "記憶使用原因顯示在 Trace",
  "記憶命中數量限制",
  "相似重複記憶合併",
  "記憶摘要壓縮",
  "記憶版本歷史",
  "一鍵重建 Vectorize 索引",
  "24 小時成功率",
  "平均延遲",
  "P50／P95／P99 延遲",
  "每模型成功率",
  "每模型限流率",
  "每模型超時率",
  "每群請求數",
  "每人請求數",
  "等待列平均長度",
  "等待時間分布",
  "OneBot 發送成功率",
  "NapCat 心跳中斷次數",
  "搜尋使用率",
  "搜尋平均來源數",
  "圖片取得失敗率",
  "快取命中率",
  "DeepSeek Prompt cache 命中率",
  "記憶命中率",
  "回答重試率",
  "使用者好評率",
  "插話被回覆率",
  "插話被忽略率",
  "管理提案確認率",
  "管理提案取消率",
  "各類錯誤排行",
  "成本走勢",
  "額度耗盡預測",
  "最繁忙時段",
  "最慢模型",
  "最常降級的模型",
  "Prompt Injection 偵測",
  "要求顯示系統提示的紀錄",
  "要求洩漏 API Key 的阻擋",
  "網頁內容中的惡意提示隔離",
  "圖片 OCR 中的惡意提示隔離",
  "搜尋結果只能作為資料，不能變更系統規則",
  "QQ 號遮罩",
  "電話、身分證、銀行資料遮罩",
  "AI 回覆密鑰格式掃描",
  "私人訊息禁止進公開群記憶",
  "管理 API CSRF 防護",
  "Portal 工作階段管理",
  "強制登出其他裝置",
  "登入異常通知",
  "危險操作二次驗證",
  "管理操作完整稽核",
  "API Key 只顯示尾碼",
  "Secrets 不回傳前端",
  "群管理權限即時重新確認",
  "AI 不得自行提升權限",
  "可選簡體／繁體",
  "可選回答長度",
  "可選語氣",
  "可選是否附來源",
  "可選是否顯示使用模型",
  "可選是否顯示搜尋狀態",
  "長回答合併轉發",
  "超長回答產生文字檔",
  "「繼續」接續未完成答案",
  "「簡短點」重新濃縮",
  "「詳細點」重新展開",
  "「用白話說」重新改寫",
  "「給例子」追加範例",
  "「引用來源」只顯示來源",
  "「重新回答」換模型重試",
  "查看自己的排隊順位",
  "取消自己的題目",
  "更新等待中的題目",
  "合併 5 秒內連續訊息",
  "同一題重複 @ 自動去重",
  "問題太模糊時只問一個澄清問題",
  "偵測使用者已自行解決，取消等待題",
  "第二題回答時保留前一題上下文",
  "排隊過久通知",
  "AI 忙碌時顯示預估等待時間",
  "每日群聊摘要",
  "未讀重點摘要",
  "本週熱門話題",
  "新人快速了解群聊",
  "活動提醒",
  "投票建立",
  "投票摘要",
  "群成員生日提醒",
  "事件倒數",
  "群內 FAQ",
  "群規問答",
  "群檔案導航",
  "Minecraft 伺服器狀態",
  "遊戲版本查詢",
  "模組相容性查詢",
  "總覽",
  "群組中心",
  "使用者中心",
  "模型中心",
  "動態路由編輯器",
  "Prompt 管理",
  "搜尋中心",
  "文件知識庫",
  "圖片理解",
  "記憶中心",
  "記憶衝突",
  "任務中心",
  "等待列",
  "Workflow",
  "管理提案",
  "加群申請",
  "健康檢查",
  "Trace",
  "日誌",
  "成本與額度",
  "Analytics",
  "SLA",
  "評測資料集",
  "安全中心",
  "通知中心",
  "Feature Flags",
  "設定版本",
  "備份還原",
  "管理員權限",
  "開發者工具",
  "全域搜尋",
  "深色模式",
  "手機響應式",
  "未保存變更提示",
  "操作快捷鍵",
  "即時狀態刷新",
  "可摺疊側邊欄",
  "可拖曳模型順序",
  "狀態顏色＋文字雙重標示",
  "不顯示原始超長 JSON",
  "錯誤直接連至 Trace",
  "每張健康卡可單獨重測",
  "一鍵複製去敏診斷報告",
  "危險操作輸入確認文字",
  "設定差異視圖",
  "一鍵回滾",
  "通知已讀／未讀",
  "表格欄位自訂",
  "CSV 匯出",
  "圖表時間範圍切換",
  "DeepSeek V4 遷移"
]);
const PLATFORM_FEATURES = Object.freeze(PLATFORM_FEATURE_NAMES.map((name,index)=>{
  const dangerous=/(?:踢|禁言|拒絕|拒绝|管理員|管理员|黑名單|黑名单|API Key|密鑰|密钥|權限|权限)/i.test(name);
  const ownerOnly=/(?:群主授權|群主授权|群規持續監控)/i.test(name);
  const developerOnly=/(?:開發者|开发者|全域|全局|成本|額度|额度|Trace|健康檢查|健康检查|備份|备份|模型路由)/i.test(name);
  const emulated=/(?:Queue|Queues|Workflow|Analytics Engine|R2|AI Worker 分離|AI Worker 分离|Dead Letter)/i.test(name);
  return Object.freeze({id:`F${String(index+1).padStart(3,'0')}`,name,category:index<60?'group_ops':index<120?'ai_tools':index<180?'knowledge_memory':index<240?'security_portal':'automation_integrations',minRole:ownerOnly?'owner':developerOnly?'developer':dangerous?'admin':'member',scope:developerOnly?'global':'group',mode:emulated?'single_worker_emulation':dangerous?'guarded':'native',defaultEnabled:true});
}));

// ==========================================
// 🗄️ D1 資料庫操作小幫手 (模擬 KV 行為)
// ==========================================
async function dbGet(env, key) {
  if (!env || !env.DB) return null; // 防呆安全鎖
  try {
    const stmt = env.DB.prepare("SELECT value FROM kv_store WHERE key = ?").bind(key);
    const result = await stmt.first();
    return result ? result.value : null;
  } catch (e) {
    console.error(`讀取 DB 失敗 [${key}]:`, e);
    return null;
  }
}

async function dbPut(env, key, value) {
  if (!env || !env.DB) return; // 防呆安全鎖
  try {
    const stmt = env.DB.prepare("INSERT INTO kv_store (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(key, value);
    await stmt.run();
  } catch (e) {
    console.error(`寫入 DB 失敗 [${key}]:`, e);
  }
}

async function dbDel(env, key) {
  if (!env || !env.DB) return; // 防呆安全鎖
  try {
    const stmt = env.DB.prepare("DELETE FROM kv_store WHERE key = ?").bind(key);
    await stmt.run();
  } catch (e) {
    console.error(`删除 DB 失敗 [${key}]:`, e);
  }
}


function remainingTimeout(deadlineAt, capMs, floorMs = 800) {
  const remaining = Math.max(0, Number(deadlineAt || 0) - Date.now());
  return Math.max(floorMs, Math.min(Number(capMs || remaining || floorMs), remaining || floorMs));
}

function isDeadlineExceeded(deadlineAt, reserveMs = 0) {
  return Date.now() + Math.max(0, reserveMs) >= Number(deadlineAt || 0);
}

function withTimeout(promise, timeoutMs, label = "TASK_TIMEOUT") {
  const ms = Math.max(500, Number(timeoutMs || 0));
  let timer;
  return Promise.race([
    Promise.resolve(promise),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(label)), ms);
    })
  ]).finally(() => clearTimeout(timer));
}


export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url); // 👈 保留此行，避免後續代碼崩潰！

    // ==========================================
    // 🔌 NapCat / OneBot WebSocket Client 主動回覆入口
    // ==========================================
    const upgradeHeader = request.headers.get("Upgrade");
    if (upgradeHeader && upgradeHeader.toLowerCase() === "websocket" && ["/onebot", "/ws", "/ws/onebot"].includes(url.pathname)) {
      if (!verifyOneBotAccess(request, env)) return new Response("Unauthorized", { status: 401 });
      return getOneBotHub(env).fetch(request);
    }

    // ==========================================
    // 🎙️ Gemini Live：網頁與 WebSocket
    // ==========================================
    if (url.pathname === "/live") {
      if (!upgradeHeader || upgradeHeader.toLowerCase() !== "websocket") {
        return new Response(getLiveHtmlPage(url.host), {
          headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }
        });
      }
      return handleGeminiLiveUpgrade(request, env);
    }

    // ==========================================
    // 🌌 公共首頁與記憶矩陣中心
    // ==========================================
    if (request.method === 'GET' && ['/', '/portal', '/matrix'].includes(url.pathname)) {
      return new Response(getPortalHomePage(url.host), {
        headers: { "Content-Type": "text/html; charset=utf-8" }
      });
    }

    if (request.method === 'GET' && url.pathname === '/appeal') {
      return new Response(getAppealPage(url.host), {
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }
      });
    }

    if (request.method === 'GET' && ['/health', '/healthz'].includes(url.pathname)) {
      return jsonResponse(await buildHealthState(env));
    }

    if (request.method === 'GET' && url.pathname === '/api/public/nebula') {
      return jsonResponse(getPublicNebulaSeed());
    }

    if (url.pathname.startsWith('/api/appeal/')) {
      return handleAppealApi(request, env, url);
    }

    if (request.method === 'POST' && url.pathname.startsWith('/api/integrations/bilibili/webhook/')) {
      return handleBilibiliWebhook(request, env, url);
    }

    if (url.pathname.startsWith('/api/portal/')) {
      return handlePortalApi(request, env, url);
    }

    if (request.method === 'POST' && url.pathname === '/api/auth/request-code') {
      let payload = {};
      try { payload = await request.json(); } catch (e) {}
      const qq = String(payload.qq || "").replace(/\D/g, "");
      const group = "";
      if (!qq) {
        return jsonResponse({ ok: false, message: "请先输入 QQ 号。" }, 400);
      }

      const code = generateSixDigitCode();
      const authKey = `portal_auth_code:${qq}`;
      await dbPut(env, authKey, JSON.stringify({
        code,
        group,
        qq,
        expiresAt: Date.now() + 5 * 60 * 1000,
        attempts: 0
      }));

      const verificationMessage = `【QQAIbot Portal 登入驗證碼】\n驗證碼：${code}\n有效期：5 分鐘。\n若非本人操作，請忽略。`;
      const delivery = await sendPortalVerificationMessage(env, qq, verificationMessage);

      await writeSystemAudit(env, {
        type: "portal_auth_code_delivery",
        actorId: qq,
        action: delivery.ok ? "sent" : "failed",
        transport: delivery.transport,
        errors: delivery.ok ? [] : delivery.errors?.slice(-4) || []
      }).catch(() => {});

      if (!delivery.ok) {
        await dbDel(env, authKey);
        const httpConfigured = Boolean(String(env.ONEBOT_HTTP_ACTION_URL || env.ONEBOT_HTTP_URL || env.NAPCAT_HTTP_URL || "").trim());
        return jsonResponse({
          ok: false,
          code: "VERIFICATION_DELIVERY_FAILED",
          message: httpConfigured
            ? "驗證碼傳送失敗。NapCat WebSocket 與 HTTP 備援皆無法送出，請檢查 NapCat 連線、Access Token 與私訊權限。"
            : "驗證碼傳送失敗。請確認 NapCat WebSocket Client 已連線到 wss://qqai.ray2025.com/onebot；也可設定 ONEBOT_HTTP_URL 作為 HTTP 備援。"
        }, 503);
      }

      return jsonResponse({
        ok: true,
        message: "驗證碼已傳送至該 QQ 私訊，請在 5 分鐘內輸入。",
        transport: delivery.transport,
        ttl_seconds: 300
      });
    }

    if (request.method === 'POST' && url.pathname === '/api/auth/verify-code') {
      let payload = {};
      try { payload = await request.json(); } catch (e) {}
      const qq = String(payload.qq || "").replace(/\D/g, "");
      const code = String(payload.code || "").replace(/\D/g, "");
      const raw = await dbGet(env, `portal_auth_code:${qq}`);
      if (!raw) return jsonResponse({ ok: false, message: "验证码不存在或已过期，请重新发送。" }, 400);

      let record;
      try { record = JSON.parse(raw); } catch (e) { record = null; }
      if (!record || Date.now() > record.expiresAt) {
        await dbDel(env, `portal_auth_code:${qq}`);
        return jsonResponse({ ok: false, message: "验证码已过期，请重新发送。" }, 400);
      }

      if (record.code !== code) {
        record.attempts = (record.attempts || 0) + 1;
        if (record.attempts >= 5) await dbDel(env, `portal_auth_code:${qq}`);
        else await dbPut(env, `portal_auth_code:${qq}`, JSON.stringify(record));
        return jsonResponse({ ok: false, message: "验证码错误。" }, 400);
      }

      await dbDel(env, `portal_auth_code:${qq}`);
      const session = await createPortalSession(env, { qq, group: "", groupId: "" });
      return jsonResponse({
        ok: true,
        message: "登录成功，请从下拉选单选择可用群组。",
        qq,
        group: "",
        groupId: "",
        role: session.role,
        permissions: session.permissions || {}
      }, 200, { "Set-Cookie": portalSessionCookie(session.token, 1800) });
    }

    if (request.method === 'POST' && url.pathname === '/api/auth/logout') {
      const token = readCookie(request, "qqai_session");
      if (token) await dbDel(env, `portal_session:${token}`);
      return jsonResponse({ ok: true, message: "已退出登录。" }, 200, { "Set-Cookie": portalSessionCookie("", 0) });
    }

    // ==========================================
    // 🤖 OneBot 事件入口：預設只接受 Durable Object 內部轉送
    // ==========================================
    if (request.method !== 'POST') return new Response(`🤖 QQAI Worker ${VERSION} 运行正常`, { status: 200 });
    const internalTransport = url.pathname === "/__onebot_event" && request.headers.get("X-QQAI-Transport") === "websocket-do" && verifyOneBotAccess(request, env);
    const httpTransport = ["/onebot/event", "/event"].includes(url.pathname) && env.ENABLE_ONEBOT_HTTP_EVENTS === "true" && verifyOneBotAccess(request, env);
    if (!internalTransport && !httpTransport) return new Response("Not Found", { status: 404 });

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response("Invalid JSON", { status: 400 });
    }

    const rawMessage = String(body.raw_message || (typeof body.message === 'string' ? body.message : ""));
    const eventSelfId = body.self_id ? body.self_id.toString() : "";
    // 使用 OneBot 事件实际 self_id 判断 @；随机插话仍由插话率独立决定。
    const botId = eventSelfId;
    const rawUserId = body.user_id ? body.user_id.toString() : "";
    const isSentEvent = body.post_type === "message_sent";
    // message_sent 的 user_id 在不同 OneBot 实现中可能代表收件人；发送者固定视为事件 self_id。
    const userId = isSentEvent && eventSelfId ? eventSelfId : rawUserId;
    const isSelfAccount = Boolean(userId && eventSelfId && userId === eventSelfId);
    let sameQqSelfAsk = false;
    let sameQqHumanOnly = false;

    // Webhook 被动回复工具。长任务会在正式回复前撤回「正在思考...」。
    let activeThinkingMessageId = null;
    const clearThinkingIndicator = async () => {
      if (!activeThinkingMessageId) return;
      const id = activeThinkingMessageId; activeThinkingMessageId = null;
      try { await callOneBotAction(env, { action: 'delete_msg', params: { message_id: numericId(id) } }, 8000); } catch {}
    };
    const jsonReply = (text, meta = {}) => {
      const thinkingMessageId = activeThinkingMessageId;
      activeThinkingMessageId = null;
      return new Response(JSON.stringify({ reply: text, auto_escape: false, thinking_message_id: thinkingMessageId || null, record_reply: false, reply_kind: "command_or_system", ...meta }), {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      });
    };

    // 【專用小助手】呼叫 Gemini API (用於獨立工具指令)
    const callGeminiDirectly = async (prompt) => {
      const apiKeys = roundRobinKeys([...new Set([...parseList(env.GEMINI_API_KEYS), ...parseList(env.VECTORIZE_GEMINI_KEYS)])], "gemini");
      const fallbackModels = ['gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-3-flash-preview', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'];
      if(apiKeys.length === 0) return null;
      for (const apiKey of apiKeys) {
        for (const model of fallbackModels) {
          try {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] }),
              signal: AbortSignal.timeout(15000)
            });
            if (res.ok) {
              const data = await res.json();
              if (data.candidates?.[0]) return data.candidates[0].content.parts[0].text.replace(/[\*#\-\`~>_]/g, '').trim();
            }
          } catch(e) {}
        }
      }
      return null;
    };

    // 【長期記憶專用】改用 Cloudflare 官方原生免 Key 嵌入模型 (維度 1024)
    const getVector = async (text) => {
      if (!env.AI) return "error_no_cf_ai_binding";
      try {
        const response = await env.AI.run('@cf/baai/bge-m3', {
          text: [text]
        });
        return response.data[0] || null;
      } catch (e) {
        return `error_cf_ai_${e.message}`;
      }
    };

    // 【多模态附件】限制大小、类型与私有地址，避免耗尽 Worker 资源。
    const fetchImageAsBase64 = async (descriptor) => {
      const item = await resolveOneBotMediaAsBase64(env, descriptor, "image", 8 * 1024 * 1024, ["image/"]);
      return item ? { base64: item.base64, mimeType: item.mimeType } : null;
    };
    const fetchAudioAsBase64 = async (descriptor) => resolveOneBotMediaAsBase64(env, descriptor, "record", 12 * 1024 * 1024, ["audio/", "application/octet-stream"]);
    const fetchVideoAsBase64 = async (descriptor) => resolveOneBotMediaAsBase64(env, descriptor, "video", 25 * 1024 * 1024, ["video/", "application/octet-stream"]);

    // ==========================================
    // 🚀 主邏輯業務區
    // ==========================================
    try {
      const currentGroupId = body.group_id ? body.group_id.toString() : "";
      if (body.post_type === 'notice' && body.notice_type === 'group_increase' && currentGroupId) {
        if (!(await isGroupWhitelisted(env, currentGroupId))) return new Response(null, { status: 204 });
        const joiningUserId = String(body.user_id || "");
        if (joiningUserId) {
          const cached = await readJson(env, `group_members:${currentGroupId}`, []);
          const existing = cached.find(x => String(x.qq) === joiningUserId);
          await upsertGroupMember(env, currentGroupId, {
            qq: joiningUserId,
            name: existing?.name || joiningUserId,
            role: existing?.role || "member",
            groupName: String(body.group_name || currentGroupId),
            firstSeenAt: existing?.firstSeenAt || new Date().toISOString()
          });
        }
        if (await dbGet(env, `welcome_enabled:${currentGroupId}`) === "true") {
          const template = String(await dbGet(env, `welcome_text:${currentGroupId}`) || DEFAULTS.welcomeText);
          const atCode = `[CQ:at,qq=${joiningUserId}]`;
          let rendered = template.replaceAll('{qq}', joiningUserId).replaceAll('{at}', atCode).trim();
          if (!rendered.includes(atCode)) rendered = `${atCode} ${rendered}`;
          await sendOneBotAction(env, {
            action: "send_group_msg",
            params: { group_id: numericId(currentGroupId), message: rendered, auto_escape: false }
          });
        }
        return new Response(null, { status: 204 });
      }
      if (body.post_type === "request" && body.request_type === "group" && currentGroupId) {
        if (!(await isGroupWhitelisted(env, currentGroupId))) return new Response(null, { status: 204 });
        if (await dbGet(env, `join_assist_enabled:${currentGroupId}`) !== "true") return new Response(null, { status: 204 });
        await createJoinRequestAssist(env, body);
        return new Response(null, { status: 204 });
      }
      if (!['message', 'message_sent'].includes(body.post_type)) return new Response(null, { status: 204 });

      // 🕒 獲取當前伺服器的真實時間（台北時間）
      const currentTime = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Taipei' });
      const isGroup = body.message_type === 'group';
      const isPrivate = body.message_type === 'private';
      
      // 🎯 【就在這裡補上這行宣告！】
      const sessionKey = isGroup ? `chat:group:${currentGroupId}` : `chat:private:${userId}`;

      // ==========================================
      // 💬 D1 歷史紀錄讀取 (維持上下文記憶)
      // ==========================================
      let history = [];
      try {
        // 這裡因為上面已經定義了 sessionKey，所以絕對不會再報 defined 錯誤！
        const historyData = await dbGet(env, sessionKey);
        if (historyData) {
          history = JSON.parse(historyData);
          console.log(`🧠 成功加载歷史記憶，當前記憶條數: ${history.length}`);
        }
      } catch (historyError) {
        console.error("讀取 D1 歷史紀錄失敗:", historyError);
        history = []; 
      }
      
      // 精準提取群組身分
      const senderCard = body.sender?.card || body.sender?.nickname || userId;
      const senderRole = body.sender?.role || "member"; 
      const isDeveloper = (env.DEVELOPER_ID ? userId === env.DEVELOPER_ID.toString() : false) || userId === "3569028262";
      const roleName = senderRole === "owner" ? "群主" : (senderRole === "admin" ? "管理员" : "群友");
      if (isGroup && userId) {
        ctx.waitUntil(upsertGroupMember(env, currentGroupId, {
          qq: userId,
          name: senderCard,
          role: isDeveloper ? "developer" : senderRole,
          groupName: String(body.group_name || currentGroupId)
        }));
      }

      // ========================================================
      // 📦 【智慧型訊息結構解析器】完美兼容還原 AT 節點、圖片、語音、影片
      // ========================================================
      let userMessage = "";
      let imageUrl = null;
      let imageFile = null;
      let voiceUrl = null;
      let voiceFile = null;
      let videoUrl = null;
      let videoFile = null;
      let mentionedQqs = [];
      let replyMessageId = body.message_id ? body.message_id.toString() : "";
      let quotedMessageId = "";
      let quotedMessageText = "";

      if (typeof body.message === "string") {
        userMessage = body.raw_message || body.message || "";
        mentionedQqs = [...userMessage.matchAll(/\[CQ:at,qq=(\d+|all)\]/g)].map(m => m[1]);
        const replyMatch = userMessage.match(/\[CQ:reply,[^\]]*id=([^,\]]+)/);
        quotedMessageId = replyMatch ? replyMatch[1] : "";
        const imageMedia = extractMediaDescriptor(userMessage, "image");
        imageUrl = imageMedia.url;
        imageFile = imageMedia.file;
        const voiceMedia = extractMediaDescriptor(userMessage, "record");
        voiceUrl = voiceMedia.url;
        voiceFile = voiceMedia.file;
        const videoMedia = extractMediaDescriptor(userMessage, "video");
        videoUrl = videoMedia.url;
        videoFile = videoMedia.file;
      } else if (Array.isArray(body.message)) {
        for (const part of body.message) {
          if (part.type === "text") {
            userMessage += part.data.text;
          } else if (part.type === "at") {
            userMessage += `[CQ:at,qq=${part.data.qq}]`;
            mentionedQqs.push(String(part.data.qq));
          } else if (part.type === "reply") {
            quotedMessageId = String(part.data.id || part.data.message_id || "");
            userMessage += quotedMessageId ? `[CQ:reply,id=${quotedMessageId}]` : "";
            quotedMessageText = part.data.text || part.data.message || "";
          } else if (part.type === "image") {
            imageUrl = part.data?.url || null;
            imageFile = part.data?.file || null;
          } else if (part.type === "video") {
            videoUrl = part.data?.url || null;
            videoFile = part.data?.file || null;
          } else if (part.type === "record") {
            voiceUrl = part.data?.url || null;
            voiceFile = part.data?.file || null;
          }
        }
      }
      mentionedQqs = [...new Set(mentionedQqs.filter(Boolean).map(String))];

      // 清洗 CQ 標籤，保留媒體存在的語意提示。
      let cleanMessage = userMessage
        .replace(/\[CQ:reply,[^\]]+\]/g, '')
        .replace(/\[CQ:at,qq=(\d+)\]/g, '@$1 ')
        .replace(/\[CQ:at,qq=all\]/g, '@全体成员 ')
        .replace(/\[CQ:image,[^\]]+\]/g, '【系统：此位置有一张真实图片附件】')
        .replace(/\[CQ:record,[^\]]+\]/g, '【系统：此位置有一条真实语音附件】')
        .replace(/\[CQ:video,[^\]]+\]/g, '【系统：此位置有一段真实视频附件】')
        .trim();

      // 同 QQ 模式：以 Message ID 與傳送前指紋判斷 API 發言，人工指令仍可使用。
      if (isSelfAccount) {
        if (!isSentEvent) return new Response(null, { status: 204 });
        const apiMessage = await isKnownOutboundMessage(env, {
          messageId: replyMessageId,
          isGroup,
          groupId: currentGroupId,
          peerId: String(body.target_id || body.peer_id || rawUserId || userId),
          text: cleanMessage,
          mediaTypes: [(imageUrl || imageFile) ? 'image' : '', (voiceUrl || voiceFile) ? 'record' : '', (videoUrl || videoFile) ? 'video' : ''].filter(Boolean)
        });
        if (apiMessage) return new Response(null, { status: 204 });

        if (cleanMessage.startsWith('//')) {
          cleanMessage = cleanMessage.slice(2).trim();
          sameQqHumanOnly = true;
        } else if (cleanMessage.startsWith('??')) {
          cleanMessage = cleanMessage.slice(2).trim();
          sameQqSelfAsk = true;
        } else if (!/^[!！]/.test(cleanMessage)) {
          sameQqHumanOnly = true;
        }
      }

      let msgLower = cleanMessage.trim().toLowerCase();
      let atSender = isGroup ? `[CQ:at,qq=${userId}] ` : "";
      const isCommandMessage = /^[!！]/.test(cleanMessage);
      const commandBody = cleanMessage.replace(/^[!！]+/, '').trim();
      const isAppealCommand = /^(申诉|申訴|appeal)(?:\s|$)/i.test(commandBody);
      const isScheduleCommand = /^(排程|定时|定時|schedule)(?:\s|$)/i.test(commandBody);

      // 先解析明确触发关系。非白名单群的普通聊天必须完全静默，不能见人就提示。
      let quotedMessage = null;
      if (quotedMessageId) {
        quotedMessage = await getQuotedMessage(env, currentGroupId, quotedMessageId, botId);
        quotedMessageText = quotedMessage?.text || quotedMessageText || "";
        // 允许“回复图片并 @机器人”读图；只从被引用消息取媒体，不猜测上一条群消息。
        if (!imageUrl && !imageFile && quotedMessage?.message) {
          const quotedImage = extractMediaDescriptor(quotedMessage.message, "image");
          imageUrl = quotedImage.url;
          imageFile = quotedImage.file;
        }
        if (!voiceUrl && !voiceFile && quotedMessage?.message) {
          const quotedVoice = extractMediaDescriptor(quotedMessage.message, "record");
          voiceUrl = quotedVoice.url;
          voiceFile = quotedVoice.file;
        }
      }
      const botMentioned = Boolean(botId && mentionedQqs.includes(botId));
      const repliedToBot = Boolean(quotedMessage && quotedMessage.source === 'ai');
      const repliedToOwnerHuman = Boolean(quotedMessage && quotedMessage.source === 'owner-human');
      const explicitlyTriggered = botMentioned || repliedToBot || sameQqSelfAsk || isCommandMessage;

      // 只有真实文字或媒体才算有效提问；单独 @、空白、换行、全角空格与零宽字符全部静默丢弃。
      const hasAnyMediaAttachment = Boolean(imageUrl || imageFile || voiceUrl || voiceFile || videoUrl || videoFile);
      const meaningfulText = String(userMessage || "")
        .replace(/\[CQ:(?:at|reply),[^\]]+\]/gi, "")
        .replace(/\[CQ:[^\]]+\]/g, "")
        .replace(/[\s\u00A0\u200B-\u200D\u2060\u3000\uFEFF]+/g, "");
      if (isGroup && botMentioned && !meaningfulText && !hasAnyMediaAttachment) {
        ctx.waitUntil(writeAiDecisionLog(env, {
          groupId: currentGroupId, userId, senderName: senderCard, sourceMessageId: replyMessageId,
          input: cleanMessage, mentionedQqs, botMentioned: true, isGroup: true,
          decision: "skipped", reason: "mention_without_content", triggerType: "mention"
        }));
        return new Response(null, { status: 204 });
      }

      // 白名單是群 AI 的硬入口；非白名單群即使 @ 机器人也完全静默，不呼叫模型、不排队、不写入记忆。
      if (isGroup && !(await isGroupWhitelisted(env, currentGroupId))) {
        const whitelistAdminCommand = isDeveloper && /^(群白名单|群白名單|删群白名单|刪群白名單|allowgroup|removegroup)(?:\s|$)/i.test(commandBody);
        const applicationCommand = /^(申请白名单|申請白名單)(?:\s|$)/i.test(commandBody);
        const helpCommand = /^(help|帮助|幫助)$/.test(commandBody.toLowerCase());
        const allowedEntryCommand = whitelistAdminCommand || applicationCommand || helpCommand;
        if (!allowedEntryCommand) return new Response(null, { status: 204 });
      }

      // v0.2.6 以前無法區分聊天回覆與系統回覆；一次性移除舊 recent_logs 中全部機器人條目，
      // 避免歷史白名單提示、權限提示或指令結果繼續污染摘要、模仿與判斷語料。
      if (isGroup && botId) await purgeLegacyBotRepliesFromRecentLogs(env, currentGroupId, botId);

      // 用户问“看到图片了吗”但当前消息既未附图、也未回复图片时，不允许模型假装看见。
      const hasImageReference = Boolean(imageUrl || imageFile);
      if (explicitlyTriggered && /(?:看|讀|读|识别|識別|看到|看见|看見).{0,10}(?:图片|圖片|照片|图|圖)|(?:图片|圖片|照片|图|圖).{0,10}(?:看到|看见|看見|看得到|看得見)/i.test(cleanMessage) && !hasImageReference) {
        return jsonReply(`${atSender}我这则消息没有收到可读取的图片。请直接“回复那张图片”再 @我，或把图片和问题放在同一则消息发送。`);
      }

      // 私聊聊天、私聊排程、匿名申訴各自使用獨立開關。
      if (isPrivate && !isDeveloper) {
        const privateMode = await getPrivateAccessMode(env, userId);
        const privateChatEnabled = await getFeatureFlag(env, 'private_chat_enabled', false);
        const privateScheduleEnabled = await getFeatureFlag(env, 'private_schedule_enabled', false);
        const appealEnabled = await getFeatureFlag(env, 'private_appeal_enabled', DEFAULTS.appealEnabled);
        if (isAppealCommand && appealEnabled) {
          // 放行匿名申訴。
        } else if (isScheduleCommand && privateScheduleEnabled && privateMode !== 'none') {
          // 私聊排程與聊天開關分離。
        } else if (!privateChatEnabled || privateMode === 'none') {
          return new Response(null, { status: 204 });
        } else if (privateMode === 'commands' && !isCommandMessage) {
          return new Response(null, { status: 204 });
        }
      } else if (!isGroup && !isPrivate) {
        return new Response(null, { status: 204 });
      }

      // 引用訊息已在白名单入口前解析，确保普通群消息不会误触发提示。
      const targetMentionQqs = mentionedQqs.filter(q => q !== botId && q !== 'all');
      const mentionContext = mentionedQqs.length > 0
        ? `当前消息明确提及：${mentionedQqs.map(q => q === botId ? `机器人账号 QQ:${q}` : q === 'all' ? '全体成员' : `成员 QQ:${q}`).join('、')}`
        : "";
      const quoteContext = quotedMessageId
        ? `当前消息引用了 ${quotedMessage?.senderName || '未知成员'}（QQ:${quotedMessage?.senderId || '未知'}，来源:${quotedMessage?.source || 'unknown'}）的消息：${quotedMessageText ? `「${quotedMessageText}」` : '未能取得正文'}。用户当前正文与引用内容必须分开理解。${repliedToOwnerHuman ? '这是同 QQ 模式下的人工消息，不是机器人回答。' : ''}`
        : "";
      const relationContext = [quoteContext, mentionContext].filter(Boolean).join("\n");
      const aiDecisionBase = {
        groupId: currentGroupId,
        userId,
        senderName: senderCard,
        sourceMessageId: replyMessageId,
        input: cleanMessage,
        quotedMessageId,
        quotedSenderId: String(quotedMessage?.senderId || ""),
        quotedSource: String(quotedMessage?.source || ""),
        botMentioned,
        repliedToBot,
        mentionedQqs,
        targetMentionQqs,
        isPrivate,
        isGroup
      };

      // 權限拆分：AI 管理與真正群操作互不混用。
      const permissionSet = await getEffectivePermissions(env, currentGroupId, userId, senderRole, isDeveloper);
      const hasAdminAuth = permissionSet.aiAdmin;
      const hasGroupOpsAuth = permissionSet.groupOps;
      const isOnlyMe = isDeveloper;

      // 同號人工普通發言只納入上下文，不觸發 AI；人工命令與 ?? 提問可繼續。
      if (sameQqHumanOnly) {
        await recordStructuredMessage(env, {
          groupId: currentGroupId, userId, senderName: senderCard, messageId: replyMessageId,
          text: cleanMessage, mentions: mentionedQqs, replyId: quotedMessageId, source: 'owner-human'
        });
        return new Response(null, { status: 204 });
      }

      // 敏感詞過濾：內建底線 + 群務面板設定。
      const groupKeywords = await readJson(env, `keyword_filter:${currentGroupId}`, []);
      const sensitiveWords = [...groupKeywords];
      const matchedSensitiveWord = sensitiveWords.find(word => cleanMessage.includes(word));
      if (matchedSensitiveWord) {
        ctx.waitUntil(writeAiDecisionLog(env, { ...aiDecisionBase, decision: "blocked", reason: "keyword_filter", triggerType: botMentioned ? "mention" : repliedToBot ? "reply_to_ai" : isPrivate ? "private" : "none", matchedKeyword: matchedSensitiveWord }));
        return new Response(null, { status: 204 });
      }

      if (isGroup && !isCommandMessage && !isSelfAccount && cleanMessage.length > 1 && await dbGet(env, `rule_monitor_enabled:${currentGroupId}`) !== "false") {
        ctx.waitUntil(inspectMessageAgainstGroupRules(env, { groupId: currentGroupId, userId, senderName: senderCard, text: cleanMessage, messageId: replyMessageId }));
      }

      // 🎲 插話每日上限不設限，只保留概率、冷卻與免打擾；插話率本身就是開關，0% 代表關閉。
      const interjectChance = Math.max(0, Math.min(100, Number(await dbGet(env, `interject_rate:${currentGroupId}`) || String(DEFAULTS.interjectRate)))) / 100;
      const requiresAiJudgment = true;
      const isImitationGlobal = true;

      // 🛠️ 萬用指令參數解析器：優先使用非機器人的 @，亦支援直接 QQ 號。
      const parseArgs = (rawMessage, prefix) => {
        const lowerRaw = String(rawMessage || '').toLowerCase();
        const index = lowerRaw.indexOf(String(prefix || '').toLowerCase());
        const rawArgs = (index >= 0 ? rawMessage.slice(index + prefix.length) : rawMessage).trim();
        const directNumber = rawArgs.replace(/\[CQ:[^\]]+\]/g, '').trim().match(/^(\d{5,})\b/);
        const targetQq = targetMentionQqs[0] || directNumber?.[1] || null;
        let restText = rawArgs
          .replace(/\[CQ:at,qq=(\d+|all)\]/g, '')
          .replace(/^\d{5,}\b/, '')
          .replace(/\[CQ:[^\]]+\]/g, '')
          .trim();
        return { targetQq, targetQqs: targetMentionQqs.slice(), restText };
      };

      const webSettingCommandsDisabledEarly = await dbGet(env, `web_command_off:${currentGroupId}`) === "true";
      if (webSettingCommandsDisabledEarly && commandChangesWebSettings(userMessage)) {
        return jsonReply(`${atSender}本群已關閉設定型 ! 指令。關閉後只能從 Portal 網頁重新開啟或修改設定。`);
      }

      const ruleMonitorSetting = cleanMessage.match(/^[!！](?:群规监控|群規監控|规则监控|規則監控)\s*(开|開|关|關|状态|狀態)$/i);
      if (ruleMonitorSetting) {
        const mode = ruleMonitorSetting[1];
        const current = await dbGet(env, `rule_monitor_enabled:${currentGroupId}`) !== "false";
        if (/状态|狀態/.test(mode)) return jsonReply(`${atSender}群规持续监控当前为：${current ? "开启" : "关闭"}。默认开启；监控本身只记录到独立网页。`);
        if (!(await isVerifiedGroupOwner(env, currentGroupId, userId))) return jsonReply(`${atSender}只有 NapCat 即時確認的目前群主可以改變群規持續監控。`);
        const enabled = /开|開/.test(mode);
        await dbPut(env, `rule_monitor_enabled:${currentGroupId}`, enabled ? "true" : "false");
        await writeSystemAudit(env, { type: "rule_monitor_setting", groupId: currentGroupId, actorId: userId, action: enabled ? "enabled" : "disabled" });
        return jsonReply(`${atSender}群规持续监控已${enabled ? "开启" : "关闭"}。开启后默认只记录到网页，不会自动处罚。`);
      }

      const proxySetting = cleanMessage.match(/^[!！](?:AI群规代理|AI群規代理|群规代理|群規代理)\s*(关闭|關閉|记录|記錄|警告|禁言|自动|自動|状态|狀態)$/i);
      if (proxySetting) {
        if (!(await isVerifiedGroupOwner(env, currentGroupId, userId))) return jsonReply(`${atSender}只有 NapCat 即時確認的目前群主可以設定 AI 群規代理。`);
        const rawMode = proxySetting[1];
        if (/状态|狀態/.test(rawMode)) {
          const currentMode = normalizeRuleProxyMode(await dbGet(env, `rule_proxy_mode:${currentGroupId}`) || DEFAULTS.ruleProxyMode);
          const kick = await dbGet(env, `rule_proxy_kick_authorized:${currentGroupId}`) === "true";
          return jsonReply(`${atSender}AI 群规代理模式：${currentMode}；AI 踢出授权：${kick ? "已授权" : "未授权"}。`);
        }
        const nextMode = /关闭|關閉|记录|記錄/.test(rawMode) ? "record" : /警告/.test(rawMode) ? "warn" : /禁言/.test(rawMode) ? "mute" : "auto";
        await dbPut(env, `rule_proxy_mode:${currentGroupId}`, nextMode);
        await writeSystemAudit(env, { type: "rule_proxy_setting", groupId: currentGroupId, actorId: userId, action: nextMode });
        return jsonReply(`${atSender}AI 群规代理已设为 ${nextMode}。record 只记录；warn 警告；mute 禁言；auto 依 AI 分类在授权范围内处理。`);
      }

      if (/^[!！](?:授权AI踢出|授權AI踢出)$/i.test(cleanMessage)) {
        if (!(await isVerifiedGroupOwner(env, currentGroupId, userId))) return jsonReply(`${atSender}只有 NapCat 即時確認的目前群主可以授權 AI 踢出。`);
        await dbPut(env, `rule_proxy_kick_authorized:${currentGroupId}`, "true");
        await writeSystemAudit(env, { type: "rule_proxy_kick_auth", groupId: currentGroupId, actorId: userId, action: "authorized" });
        return jsonReply(`${atSender}已完成一次性 AI 踢出授权。授权会持续生效，直到发送「!撤回AI踢出授权」。`);
      }
      if (/^[!！](?:撤回AI踢出授权|撤回AI踢出授權)$/i.test(cleanMessage)) {
        if (!(await isVerifiedGroupOwner(env, currentGroupId, userId))) return jsonReply(`${atSender}只有 NapCat 即時確認的目前群主可以撤回 AI 踢出授權。`);
        await dbDel(env, `rule_proxy_kick_authorized:${currentGroupId}`);
        await writeSystemAudit(env, { type: "rule_proxy_kick_auth", groupId: currentGroupId, actorId: userId, action: "revoked" });
        return jsonReply(`${atSender}已撤回 AI 踢出授权；AI 代理只会记录、警告或禁言。`);
      }

      const joinAssistSetting = cleanMessage.match(/^[!！](?:入群辅助|入群輔助)\s*(开|開|关|關)$/i);
      if (joinAssistSetting) {
        if (!hasAdminAuth) return jsonReply(`${atSender}只有 QQ 管理员、群主、开发者或获授 AI 管理权限者可以开启或关闭入群辅助。`);
        const enabled = /开|開/.test(joinAssistSetting[1]);
        await dbPut(env, `join_assist_enabled:${currentGroupId}`, enabled ? "true" : "false");
        return jsonReply(`${atSender}入群辅助已${enabled ? "开启" : "关闭"}。AI 只会建议同意或请管理核对，绝不会自动拒绝。`);
      }
      const joinDecision = cleanMessage.match(/^[!！]?(确认入群|确认入群|忽略入群)\s+(jr_[a-z0-9_-]+)$/i);
      if (joinDecision) {
        const result = await decideJoinRequestAssist(env, { groupId: currentGroupId, actorId: userId, id: joinDecision[2], decision: /忽略/.test(joinDecision[1]) ? "ignore" : "approve" });
        return jsonReply(`${atSender}${result.message}`);
      }

      const runtimeRateLimitCommand = cleanMessage.match(/^[!！](?:设置速率限制|設定速率限制)\s+(\d+)$/i);
      if (runtimeRateLimitCommand) {
        if (!isDeveloper) return jsonReply(`${atSender}只有开发者可以设置速率限制。`);
        const seconds = parseUnlimitedNonNegativeInteger(runtimeRateLimitCommand[1], DEFAULTS.runtimeRateLimitSeconds);
        await dbPut(env, `runtime_rate_limit_seconds:group:${currentGroupId}`, String(seconds));
        await writeSystemAudit(env, { type: "rate_limit_setting", groupId: currentGroupId, actorId: userId, action: `group:${seconds}` });
        return jsonReply(`${atSender}本群调用速率限制已设为 ${seconds} 秒；0 代表关闭。`);
      }
      const globalRateLimitCommand = cleanMessage.match(/^[!！](?:设置全局速率限制|設定全域速率限制)\s+(\d+)$/i);
      if (globalRateLimitCommand) {
        if (!isDeveloper) return jsonReply(`${atSender}只有开发者可以设置全局速率限制。`);
        const seconds = parseUnlimitedNonNegativeInteger(globalRateLimitCommand[1], DEFAULTS.runtimeRateLimitSeconds);
        await dbPut(env, "runtime_rate_limit_seconds:global", String(seconds));
        await writeSystemAudit(env, { type: "rate_limit_setting", groupId: currentGroupId, actorId: userId, action: `global:${seconds}` });
        return jsonReply(`${atSender}全局调用速率限制已设为 ${seconds} 秒；群组单独值优先，0 代表关闭。`);
      }

      if (/^[!！](?:授权AI拒绝入群|授權AI拒絕入群)$/i.test(cleanMessage)) {
        if (!(await isVerifiedGroupOwner(env, currentGroupId, userId))) return jsonReply(`${atSender}只有 NapCat 即時確認的目前群主可以授權 AI 拒絕入群申請。`);
        await dbPut(env, `join_reject_authorized:${currentGroupId}`, "true");
        await writeSystemAudit(env, { type: "join_reject_auth", groupId: currentGroupId, actorId: userId, action: "authorized" });
        return jsonReply(`${atSender}已授权 AI 在高置信度明显违规时拒绝入群申请。可用「!撤回AI拒绝入群」撤回。`);
      }
      if (/^[!！](?:撤回AI拒绝入群|撤回AI拒絕入群)$/i.test(cleanMessage)) {
        if (!(await isVerifiedGroupOwner(env, currentGroupId, userId))) return jsonReply(`${atSender}只有 NapCat 即時確認的目前群主可以撤回 AI 拒絕入群授權。`);
        await dbDel(env, `join_reject_authorized:${currentGroupId}`);
        await writeSystemAudit(env, { type: "join_reject_auth", groupId: currentGroupId, actorId: userId, action: "revoked" });
        return jsonReply(`${atSender}已撤回 AI 拒绝入群授权。入群辅助只会同意、建议或交给管理核对。`);
      }

      const groupWorkCreate = cleanMessage.match(/^[!！](群公告|群待办|群待辦|群文件)\s+([\s\S]+)$/i);
      if (groupWorkCreate) {
        if (!isGroup || !(isDeveloper || ["owner", "admin"].includes(senderRole))) return jsonReply(`${atSender}只有本群 QQ 管理员、群主或开发者可以发起群务确认。`);
        const label = groupWorkCreate[1];
        const raw = groupWorkCreate[2].trim();
        const type = label === "群公告" ? "notice" : /待办|待辦/.test(label) ? "todo" : "file";
        let content = raw, file = "", fileName = "";
        if (type === "file") {
          const parts = raw.split(/\s+/); file = parts.shift() || ""; fileName = parts.join(" ") || file.split(/[\/\\]/).pop() || "QQAI上传文件"; content = fileName;
        }
        const item = await createGroupWorkRequest(env, { groupId: currentGroupId, creatorId: userId, creatorName: senderCard, type, content, file, fileName, sourceMessageId: replyMessageId });
        return jsonReply(`${atSender}已建立群务待确认操作\n编号：${item.id}\n类型：${label}\nAI 辅助意见：${item.review.decision === "suggest_approve" ? "建议同意" : "请群主核对"}（${item.review.reason}）\n具有群操作权限者发送「确认群务 ${item.id}」后才会执行；AI 不会自动拒绝，开发者也不能代替群主。`);
      }
      const groupWorkDecision = cleanMessage.match(/^[!！]?(确认群务|确认群務|取消群务|取消群務)\s+(gw_[a-z0-9_-]+)$/i);
      if (groupWorkDecision) {
        const result = await handleGroupWorkDecision(env, { groupId: currentGroupId, actorId: userId, id: groupWorkDecision[2], decision: /取消/.test(groupWorkDecision[1]) ? "cancel" : "confirm" });
        return jsonReply(`${atSender}${result.message}`);
      }

      // v1.0.0：关键开关在任何模型、限流或 AI 休眠判断之前处理，避免“关闭 AI”看起来像当机。
      const ownerOrDeveloperSetting = senderRole === "owner" || isDeveloper;
      if (/^[!！](?:关闭ai|關閉ai|ai关|ai關)$/i.test(cleanMessage)) {
        if (!hasAdminAuth) return jsonReply(`${atSender}只有群主、QQ 管理员或开发者可以关闭 AI。`);
        await dbPut(env, `ai_off:${currentGroupId}`, "true");
        await writeSystemAudit(env, { type: "ai_settings", groupId: currentGroupId, actorId: userId, action: "ai_off" });
        return jsonReply(`${atSender}已关闭本群 AI。此通知由系统直接发送；管理命令、状态查询与重新开启指令仍可使用。`);
      }
      if (/^[!！](?:开启ai|開啟ai|ai开|ai開)$/i.test(cleanMessage)) {
        if (!hasAdminAuth) return jsonReply(`${atSender}只有群主、QQ 管理员或开发者可以开启 AI。`);
        await dbDel(env, `ai_off:${currentGroupId}`);
        await writeSystemAudit(env, { type: "ai_settings", groupId: currentGroupId, actorId: userId, action: "ai_on" });
        return jsonReply(`${atSender}已开启本群 AI。此通知由系统直接发送。`);
      }
      if (/^[!！](?:群打卡|群签到|群簽到)$/i.test(cleanMessage)) {
        if (!ownerOrDeveloperSetting) return jsonReply(`${atSender}只有群主或开发者可以手动触发群打卡。`);
        const checkin = await performGroupCheckin(env, currentGroupId, userId);
        return jsonReply(`${atSender}${checkin.ok ? "群打卡完成。" : "群打卡失败：" + checkin.error}`);
      }
      let settingMatch = cleanMessage.match(/^[!！](?:自动打卡|自動打卡)(?:\s*(?:开|開|关|關))?$/i);
      if (settingMatch) {
        return jsonReply(`${atSender}自动 QQ 群打卡固定在台北时间 00:00:00 执行，不受 AI 开关或 AI 白名单影响，无法关闭或改时。`);
      }
      settingMatch = cleanMessage.match(/^[!！](?:打卡时间|打卡時間)(?:\s+[^\s]+)?$/i);
      if (settingMatch) {
        return jsonReply(`${atSender}自动 QQ 群打卡固定时间为台北时间 00:00:00。`);
      }
      settingMatch = cleanMessage.match(/^[!！](?:自动欢迎|自動歡迎)\s*(开|開|关|關)$/i);
      if (settingMatch) {
        if (!ownerOrDeveloperSetting) return jsonReply(`${atSender}只有群主或开发者可以设置自动欢迎。`);
        const enabled = /开|開/.test(settingMatch[1]);
        await dbPut(env, `welcome_enabled:${currentGroupId}`, enabled ? "true" : "false");
        return jsonReply(`${atSender}自动欢迎已${enabled ? "开启" : "关闭"}。欢迎词支持 Unicode 表情符号，也支持 OneBot CQ 表情。`);
      }
      settingMatch = cleanMessage.match(/^[!！](?:欢迎词|歡迎詞)\s+([\s\S]+)$/i);
      if (settingMatch) {
        if (!ownerOrDeveloperSetting) return jsonReply(`${atSender}只有群主或开发者可以设置欢迎词。`);
        await dbPut(env, `welcome_text:${currentGroupId}`, settingMatch[1].trim().slice(0, 500));
        return jsonReply(`${atSender}欢迎词已保存；可使用 {at} 与 {qq} 占位符。`);
      }
      settingMatch = cleanMessage.match(/^[!！](?:设置处置冷却|設定處置冷卻)\s+(\d+)$/i);
      if (settingMatch) {
        if (!ownerOrDeveloperSetting) return jsonReply(`${atSender}只有群主或开发者可以设置处置冷却。`);
        const seconds = parseUnlimitedNonNegativeInteger(settingMatch[1], 0);
        await dbPut(env, `moderation_target_cooldown_seconds:${currentGroupId}`, String(seconds));
        return jsonReply(`${atSender}同一对象处置冷却已设为 ${seconds} 秒；0 代表关闭。`);
      }
      settingMatch = cleanMessage.match(/^[!！](?:设置新人观察期|設定新人觀察期)\s+(\d+)$/i);
      if (settingMatch) {
        if (!ownerOrDeveloperSetting) return jsonReply(`${atSender}只有群主或开发者可以设置新人观察期。`);
        const days = Math.max(0, Math.min(30, Number(settingMatch[1])));
        await dbPut(env, `newcomer_observation_days:${currentGroupId}`, String(days));
        return jsonReply(`${atSender}新人观察期已设为 ${days} 天。它只作为 AI 风险提示，不会自动处罚新人；0 代表关闭。`);
      }

      // v0.5.0：管理层自然语言只建立待确认操作，必须二次确认才执行。
      const moderationConfirmation = isGroup ? parseModerationConfirmation(cleanMessage) : null;
      if (moderationConfirmation) {
        if (!hasGroupOpsAuth) {
          return jsonReply(`${atSender}你没有确认群管理操作的权限。`);
        }
        const result = await handleModerationConfirmation(env, {
          groupId: currentGroupId,
          actorId: userId,
          actorRole: senderRole,
          isDeveloper,
          confirmation: moderationConfirmation,
          hasGroupOpsPermission: hasGroupOpsAuth
        });
        return jsonReply(`${atSender}${result.message}`);
      }

      if (isGroup && !isCommandMessage && (isDeveloper || ["owner", "admin"].includes(senderRole))) {
        const proposalResult = await detectNaturalModerationProposal(env, {
          groupId: currentGroupId,
          actorId: userId,
          actorName: senderCard,
          actorRole: senderRole,
          isDeveloper,
          text: cleanMessage,
          targetMentionQqs,
          botId,
          messageId: replyMessageId
        });
        if (proposalResult?.handled) return jsonReply(`${atSender}${proposalResult.message}`, proposalResult.proposal ? { moderation_proposal_id: proposalResult.proposal.id } : {});
      }

      const webSettingCommandsDisabled = await dbGet(env, `web_command_off:${currentGroupId}`) === "true";
      if (webSettingCommandsDisabled && commandChangesWebSettings(userMessage)) {
        return jsonReply(`${atSender}本群已关闭设置型 ! 指令。关闭后只能从 Portal 网页重新开启或修改设置。`);
      }
      if (/^[!！]指令(开|開|关|關)\b/.test(msgLower)) {
        if (!hasAdminAuth) return jsonReply(`${atSender}只有群主、QQ 管理员或开发者可以切换设置型指令。`);
        const enable = /^[!！]指令(开|開)\b/.test(msgLower);
        if (enable) {
          await dbDel(env, `web_command_off:${currentGroupId}`);
          return jsonReply(`${atSender}设置型 ! 指令已开启。`);
        }
        await dbPut(env, `web_command_off:${currentGroupId}`, "true");
        return jsonReply(`${atSender}设置型 ! 指令已关闭。之后只能从 Portal 网页重新开启或修改设置。`);
      }

      // ==========================================
      // 🛑 防禦陣線
      // ==========================================
      if (!meaningfulText && !hasAnyMediaAttachment) {
        console.log(`⚠️ 偵測到群友 ${userId} 未輸入有效內容，自動快速攔截。`);
        return new Response(null, { status: 204 });
      }

      // ⏳ Cloudflare 原生速率限制器 (10秒冷卻鎖) - 開發者、群主、管理員豁免
      const isBypassCooldown = isDeveloper || senderRole === 'owner' || senderRole === 'admin' || body.__qqai_queued === true;
      if (!isBypassCooldown) {
        const rate = await checkRuntimeRateLimit(env, { groupId: currentGroupId, userId, isPrivate });
        if (!rate.allowed) {
          ctx.waitUntil(writeAiDecisionLog(env, { ...aiDecisionBase, decision: "blocked", reason: "rate_limited", triggerType: botMentioned ? "mention" : repliedToBot ? "reply_to_ai" : isPrivate ? "private" : "none", remainingSeconds: rate.remaining }));
          return jsonReply(`${atSender}请求过于频繁，请等待约 ${rate.remaining} 秒后再试。此提示不会调用任何 AI 模型。`);
        }
      }

      // ==========================================
      // 🤖 依據 AI Studio 權限清單與最新模型庫對齊
      // ==========================================
      const chatModels = await effectiveRuntimeModels(env, "chat");
      const ttsModels = await effectiveRuntimeModels(env, "tts");
      const modelList = chatModels;


      // 第一段到此完美結束，準備進入第二段的基礎系統指令與生圖路由控制模組...

      // 图片理解保留；图片生成指令已在 v0.5.0 移除。

      // 💖 【高情商情緒微調器】(取代卑微順從，提供情緒價值安慰)
      // ==========================================
      const botAtTag = `[CQ:at,qq=${botId}]`;
      const isAtMeOrAi = botMentioned || sameQqSelfAsk || repliedToBot;
      // 模型不需要看到自己的 QQ @ 文字；短确认词走低延迟快速通道。
      const conversationText = stripBotMentionFromConversation(cleanMessage, botId) || cleanMessage;
      const isFastAcknowledgement = isAtMeOrAi && isLightweightAcknowledgement(conversationText);
      
      // 私聊必定是對機器人說，群聊則看是否有提及
      if (isAtMeOrAi || isPrivate) {
        const sadWords = ['难过', '烦死了', '不开心', '想哭', '抑郁', '痛苦', '累了', '心累', '成绩差', '考砸'];
        const argueWords = ['我才不是', '才没有', '你乱讲', '不懂我', '闭嘴', '别吵'];
        
        if (sadWords.some(w => msgLower.includes(w))) {
          // 寫入溫柔安撫備忘錄 (短效 BUFF，下次聊天即刻生效)
          await dbPut(env, `emotion_buff:${currentGroupId}:${userId}`, "【情绪警告】该用户目前心情非常低落/难过。你接下来的回复必须化身温柔的大哥哥/大姐姐，展现极高的同理心，温柔地安慰他/她，提供满满的情绪价值，绝对不要开玩笑或讽刺。");
        } else if (argueWords.some(w => msgLower.includes(w))) {
          // 寫入自我修復/退讓備忘錄 (高情商化解反駁)
          await dbPut(env, `emotion_buff:${currentGroupId}:${userId}`, "【自我修正备忘】该用户对刚才的话题产生了抗拒或反驳。请展现高情商，温柔地顺着台阶下，安抚对方的情绪，表达你完全理解并支持他/她的真实想法，绝对不要争辩对错。");
        }
      }

      // ==========================================
      // 🔑 權限管理與開發者動態調整指令
      // ==========================================
      // !自我调整 / !self-adjust
      if (['!自我调整', '!自我調整', '!self-adjust', '！自我调整', '！自我調整'].includes(msgLower)) {
        if (!isOnlyMe) return jsonReply(`${atSender}❌ 严重越权：只有最高核心开发者本人拥有此微调特权。`);
        await dbPut(env, `sys_mode:${currentGroupId}`, "adjust");
        return jsonReply(`${atSender}⚙️ 开发者身份确认。成功开启自我调整模式，系统进入动态参数微调状态。`);
      }

      // !自我修正 / !self-correct
      if (['!自我修正', '!自我修正', '!self-correct', '！自我修正', '！自我修正'].includes(msgLower)) {
        if (!isOnlyMe) return jsonReply(`${atSender}❌ 严重越权：只有最高核心开发者本人拥有此指令修正特权。`);
        await dbPut(env, `sys_mode:${currentGroupId}`, "normal");
        return jsonReply(`${atSender}⚙️ 开发者身份确认。成功执行核心自我修正，运行配置已初始化回归正常环境。`);
      }

      // 舊指令相容：!给权限 / !删权限 僅由開發者使用，預設對應 AI 管理權。
      if (['!给权限', '!給權限', '!grant', '！给权限', '！給權限'].some(p => msgLower.startsWith(p))) {
        if (!isDeveloper) return jsonReply(`${atSender}只有开发者可以授予权限。`);
        const prefix = ['!给权限', '!給權限', '!grant', '！给权限', '！給權限'].find(p => msgLower.startsWith(p));
        const { targetQq } = parseArgs(userMessage, prefix);
        if (!targetQq) return jsonReply(`${atSender}格式：!给权限 @成员`);
        await setExplicitPermission(env, currentGroupId, targetQq, 'ai_admin', true);
        return jsonReply(`${atSender}已授予 QQ:${targetQq} AI 管理权限。`);
      }

      if (['!删权限', '!刪權限', '!revoke', '！删权限', '！刪權限'].some(p => msgLower.startsWith(p))) {
        if (!isDeveloper) return jsonReply(`${atSender}只有开发者可以撤销权限。`);
        const prefix = ['!删权限', '!刪權限', '!revoke', '！删权限', '！刪權限'].find(p => msgLower.startsWith(p));
        const { targetQq } = parseArgs(userMessage, prefix);
        if (!targetQq) return jsonReply(`${atSender}格式：!删权限 @成员`);
        await setExplicitPermission(env, currentGroupId, targetQq, 'ai_admin', false);
        return jsonReply(`${atSender}已撤销 QQ:${targetQq} AI 管理权限。`);
      }

      // !禁记忆 / !解禁记忆
      if (['!禁记忆', '!禁記憶', '!banmemory', '！禁记忆', '！禁記憶'].some(p => msgLower.startsWith(p))) {
        if (!isOnlyMe) return jsonReply(`${atSender}❌ 只有最高开发者可以冻结网页端记忆编辑权。`);
        const prefix = ['!禁记忆', '!禁記憶', '!banmemory', '！禁记忆', '！禁記憶'].find(p => msgLower.startsWith(p));
        const { targetQq } = parseArgs(userMessage, prefix);
        if (!targetQq) return jsonReply(`${atSender}🤷 请指定要冻结的 QQ，例如: !禁记忆 @某人`);
        await dbPut(env, `memory_banned:${targetQq}`, "true");
        await writeMemoryAudit(env, { groupId: currentGroupId, userId, action: "冻结记忆编辑权", before: targetQq, after: "memory_banned=true" });
        return jsonReply(`${atSender}🧊 已冻结 QQ:${targetQq} 的记忆编辑权限。`);
      }

      if (['!解禁记忆', '!解禁記憶', '!unbanmemory', '！解禁记忆', '！解禁記憶'].some(p => msgLower.startsWith(p))) {
        if (!isOnlyMe) return jsonReply(`${atSender}❌ 只有最高开发者可以恢复网页端记忆编辑权。`);
        const prefix = ['!解禁记忆', '!解禁記憶', '!unbanmemory', '！解禁记忆', '！解禁記憶'].find(p => msgLower.startsWith(p));
        const { targetQq } = parseArgs(userMessage, prefix);
        if (!targetQq) return jsonReply(`${atSender}🤷 请指定要解冻的 QQ，例如: !解禁记忆 @某人`);
        await dbDel(env, `memory_banned:${targetQq}`);
        await writeMemoryAudit(env, { groupId: currentGroupId, userId, action: "恢复记忆编辑权", before: targetQq, after: "memory_banned=false" });
        return jsonReply(`${atSender}✅ 已恢复 QQ:${targetQq} 的记忆编辑权限。`);
      }

      // ==========================================
      // 🧩 v0.2 權限、模型、排程、申訴與群操作
      // ==========================================

      if (/^[!！](?:申请白名单|申請白名單)(?:\s|$)/.test(cleanMessage)) {
        if (!isGroup) return jsonReply('该命令只能在群聊中使用。');
        const id = crypto.randomUUID();
        const item = { id, groupId: currentGroupId, applicantId: userId, applicantName: senderCard, at: new Date().toISOString(), status: 'pending' };
        await dbPut(env, `whitelist_request:${id}`, JSON.stringify(item));
        await appendIndex(env, 'whitelist_request:index', id, 500);
        await notifyDeveloper(env, `【群白名单申请】\n编号：${id}\n群号：${currentGroupId}\n申请人：${senderCard}（${userId}）`);
        return jsonReply(`${atSender}白名单申请已提交，编号：${id}`);
      }

      if (/^[!！](?:授权|授權|permission)\b/i.test(cleanMessage)) {
        if (!isDeveloper) return jsonReply(`${atSender}只有开发者可以授予额外权限。`);
        const prefix = cleanMessage.match(/^[!！](?:授权|授權|permission)/i)?.[0] || '!授权';
        const { targetQq, restText } = parseArgs(userMessage, prefix);
        const permission = normalizePermissionName(restText);
        if (!targetQq || !permission) return jsonReply(`${atSender}格式：!授权 @成员 AI管理／群操作／排程审核／申诉审核／私聊完整／私聊指令`);
        await setExplicitPermission(env, currentGroupId, targetQq, permission, true);
        return jsonReply(`${atSender}已授予 QQ:${targetQq}「${permissionLabel(permission)}」权限。`);
      }

      if (/^[!！](?:撤销授权|撤銷授權|取消授权|取消授權|revokepermission)\b/i.test(cleanMessage)) {
        if (!isDeveloper) return jsonReply(`${atSender}只有开发者可以撤销额外权限。`);
        const prefix = cleanMessage.match(/^[!！](?:撤销授权|撤銷授權|取消授权|取消授權|revokepermission)/i)?.[0] || '!撤销授权';
        const { targetQq, restText } = parseArgs(userMessage, prefix);
        const permission = normalizePermissionName(restText);
        if (!targetQq || !permission) return jsonReply(`${atSender}格式：!撤销授权 @成员 AI管理／群操作／排程审核／申诉审核／私聊完整／私聊指令`);
        await setExplicitPermission(env, currentGroupId, targetQq, permission, false);
        return jsonReply(`${atSender}已撤销 QQ:${targetQq}「${permissionLabel(permission)}」权限。`);
      }

      if (/^[!！](?:模型|model)(?:\s|$)/i.test(cleanMessage)) {
        const raw = cleanMessage.replace(/^[!！](?:模型|model)/i, '').trim();
        if (!raw) {
          const pref = await dbGet(env, `model_pref:${currentGroupId || 'private'}:${userId}`) || 'auto';
          return jsonReply(`${atSender}当前模型偏好：${modelPreferenceLabel(pref)}\n可选：自动、Gemini、DeepSeek、DeepSeek High、DeepSeek Max`);
        }
        const pref = normalizeModelPreference(raw);
        if (!pref) return jsonReply(`${atSender}可选：!模型 自动／Gemini／DeepSeek／DeepSeek High／DeepSeek Max`);
        await dbPut(env, `model_pref:${currentGroupId || 'private'}:${userId}`, pref);
        return jsonReply(`${atSender}模型偏好已保存：${modelPreferenceLabel(pref)}`);
      }

      if (/^[!！](?:申诉|申訴|appeal)(?:\s|$)/i.test(cleanMessage)) {
        if (!isPrivate) return jsonReply(`${atSender}为保护匿名，请私聊发送申诉。`);
        const appealText = cleanMessage.replace(/^[!！](?:申诉|申訴|appeal)/i, '').trim();
        if (!appealText) return jsonReply('格式：!申诉 群号 类型 详细内容');
        const created = await createAppealFromText(env, userId, appealText);
        if (!created.ok) return jsonReply(created.message);
        await notifyDeveloper(env, `【匿名申诉待处理】\n案件编号：${created.appeal.id}\n群号：${created.appeal.groupId}\n类型：${created.appeal.type}\n请到 Portal Root 指定审核人。`);
        return jsonReply(`匿名申诉已提交。案件编号：${created.appeal.id}\n除开发者外，审核者不会看到你的 QQ。`);
      }

      if (/^[!！](?:申诉状态|申訴狀態|appealstatus)(?:\s|$)/i.test(cleanMessage)) {
        const id = cleanMessage.replace(/^[!！](?:申诉状态|申訴狀態|appealstatus)/i, '').trim();
        const appeal = id ? await readJson(env, `appeal:${id}`, null) : null;
        if (!appeal || appeal.applicantId !== userId) return jsonReply('找不到属于你的申诉案件。');
        return jsonReply(`案件 ${id}\n状态：${appeal.status}\n处理结果：${appeal.result || '尚未处理'}`);
      }

      if (/^[!！](?:排程|定时|定時|schedule)(?:\s|$)/i.test(cleanMessage)) {
        const scheduleText = cleanMessage.replace(/^[!！](?:排程|定时|定時|schedule)/i, '').trim();
        if (/^(列表|清单|清單|list)$/i.test(scheduleText)) {
          const list = await listUserSchedules(env, userId, currentGroupId);
          return jsonReply(`${atSender}${list.length ? list.map(formatScheduleLine).join('\n') : '目前没有排程。'}`);
        }
        const cancelMatch = scheduleText.match(/^(?:取消|删除|删除|cancel)\s+([\w-]+)/i);
        if (cancelMatch) {
          const result = await cancelSchedule(env, cancelMatch[1], userId, isDeveloper || hasAdminAuth);
          return jsonReply(`${atSender}${result.message}`);
        }
        const scheduleGroupId = isGroup ? currentGroupId : (await dbGet(env, `private_default_group:${userId}`) || '');
        if (!scheduleGroupId) return jsonReply('请先在 Portal 选择默认群组，或在群聊中建立排程。');
        if (!(await isGroupWhitelisted(env, scheduleGroupId))) return jsonReply('目标群不在 AI 白名单中。');
        const parsedSchedule = parseScheduleRequest(scheduleText, Date.now());
        if (!parsedSchedule.ok) return jsonReply(parsedSchedule.message);
        const activeCount = await countActiveSchedulesForUser(env, userId);
        if (!isDeveloper && DEFAULTS.scheduleMaxActivePerUser > 0 && activeCount >= DEFAULTS.scheduleMaxActivePerUser) return jsonReply(`有效排程数量已达上限。`);
        activeThinkingMessageId = await sendThinkingIndicator(env, { isGroup, groupId: currentGroupId, userId, text: '正在审查排程...' }).catch(() => null);
        const review = await reviewScheduleWithGemma(env, JSON.stringify(parsedSchedule));
        if (review.decision === 'reject') return jsonReply(`排程已拒绝：${review.reason || '内容疑似违规或滥用。'}`);
        const managementAction = parseManagementScheduleAction(parsedSchedule.content);
        const mayDirectManage = permissionSet.groupOps;
        const status = managementAction && !mayDirectManage ? 'pending_owner' : review.decision === 'uncertain' ? 'pending_owner' : 'active';
        const record = await createScheduleRecord(env, {
          groupId: scheduleGroupId, creatorId: userId, creatorName: senderCard,
          source: isPrivate ? 'private' : 'group', status, review,
          managementAction, ...parsedSchedule
        });
        if (status === 'pending_owner') {
          await notifyDeveloper(env, `【排程待审核】\n编号：${record.id}\n群号：${record.groupId}\n申请人：${record.creatorName}（${record.creatorId}）\n内容：${record.content}\n请在 Root 面板自行审核或指定审核人。`);
          return jsonReply(`${atSender}排程已提交审核，编号：${record.id}`);
        }
        return jsonReply(`${atSender}排程已建立：${formatScheduleLine(record)}`);
      }

      // 高影响群操作统一建立待确认提案；任何模型或指令都不能直接踢人／禁言。
      if (/^[!！](?:禁言|mute)(?:\s|$)/i.test(cleanMessage)) {
        if (!hasGroupOpsAuth) return jsonReply(`${atSender}你没有群操作权限。`);
        const prefix = cleanMessage.match(/^[!！](?:禁言|mute)/i)?.[0] || '!禁言';
        const { targetQq, restText } = parseArgs(userMessage, prefix);
        if (!targetQq) return jsonReply(`${atSender}格式：!禁言 @成员 10分`);
        const duration = Math.max(60, parseDurationSeconds(restText || '10分'));
        const member = await getGroupMemberSafe(env, currentGroupId, targetQq);
        const proposal = await createModerationProposal(env, { groupId: currentGroupId, actorId: userId, actorName: senderCard, actorRole: isDeveloper ? 'developer' : senderRole, action: 'mute', targetId: targetQq, targetName: member?.card || member?.nickname || targetQq, targetRole: member?.role || 'member', durationSeconds: duration, sourceText: cleanMessage, classifierReason: '明确禁言指令', messageId: replyMessageId });
        return jsonReply(`${atSender}${formatModerationProposal(proposal)}`, { moderation_proposal_id: proposal.id });
      }

      if (/^[!！](?:解禁|unmute)(?:\s|$)/i.test(cleanMessage)) {
        if (!hasGroupOpsAuth) return jsonReply(`${atSender}你没有群操作权限。`);
        const prefix = cleanMessage.match(/^[!！](?:解禁|unmute)/i)?.[0] || '!解禁';
        const { targetQq } = parseArgs(userMessage, prefix);
        if (!targetQq) return jsonReply(`${atSender}格式：!解禁 @成员`);
        const member = await getGroupMemberSafe(env, currentGroupId, targetQq);
        const proposal = await createModerationProposal(env, { groupId: currentGroupId, actorId: userId, actorName: senderCard, actorRole: isDeveloper ? 'developer' : senderRole, action: 'unmute', targetId: targetQq, targetName: member?.card || member?.nickname || targetQq, targetRole: member?.role || 'member', sourceText: cleanMessage, classifierReason: '明确解禁指令', messageId: replyMessageId });
        return jsonReply(`${atSender}${formatModerationProposal(proposal)}`, { moderation_proposal_id: proposal.id });
      }

      if (/^[!！](?:踢出|踢人|kick)(?:\s|$)/i.test(cleanMessage)) {
        if (!hasGroupOpsAuth) return jsonReply(`${atSender}你没有群操作权限。`);
        const prefix = cleanMessage.match(/^[!！](?:踢出|踢人|kick)/i)?.[0] || '!踢出';
        const { targetQq } = parseArgs(userMessage, prefix);
        if (!targetQq) return jsonReply(`${atSender}格式：!踢出 @成员`);
        const member = await getGroupMemberSafe(env, currentGroupId, targetQq);
        const proposal = await createModerationProposal(env, { groupId: currentGroupId, actorId: userId, actorName: senderCard, actorRole: isDeveloper ? 'developer' : senderRole, action: 'kick', targetId: targetQq, targetName: member?.card || member?.nickname || targetQq, targetRole: member?.role || 'member', sourceText: cleanMessage, classifierReason: '明确踢出指令', messageId: replyMessageId });
        return jsonReply(`${atSender}${formatModerationProposal(proposal)}`, { moderation_proposal_id: proposal.id });
      }

      if (/^[!！](?:撤回|recall)$/i.test(cleanMessage)) {
        if (!hasGroupOpsAuth) return jsonReply(`${atSender}你没有群操作权限。`);
        if (!quotedMessageId) return jsonReply(`${atSender}请先回复需要撤回的消息，再发送 !撤回`);
        const result = await runOneBotGroupOperation(env, 'delete_msg', { message_id: numericId(quotedMessageId) }, { actorId: userId, groupId: currentGroupId, targetId: quotedMessageId, action: '撤回' });
        return jsonReply(`${atSender}${result.ok ? '已尝试撤回该消息。' : `操作失败：${result.error}`}`);
      }

      if (/^[!！](?:全员禁言|全員禁言)$/i.test(cleanMessage)) {
        if (!hasGroupOpsAuth) return jsonReply(`${atSender}你没有群操作权限。`);
        const proposal = await createModerationProposal(env, { groupId: currentGroupId, actorId: userId, actorName: senderCard, actorRole: isDeveloper ? 'developer' : senderRole, action: 'whole_mute', sourceText: cleanMessage, classifierReason: '明确全员禁言指令', messageId: replyMessageId });
        return jsonReply(`${atSender}${formatModerationProposal(proposal)}`, { moderation_proposal_id: proposal.id });
      }

      if (/^[!！](?:解除全员禁言|解除全員禁言)$/i.test(cleanMessage)) {
        if (!hasGroupOpsAuth) return jsonReply(`${atSender}你没有群操作权限。`);
        const proposal = await createModerationProposal(env, { groupId: currentGroupId, actorId: userId, actorName: senderCard, actorRole: isDeveloper ? 'developer' : senderRole, action: 'whole_unmute', sourceText: cleanMessage, classifierReason: '明确解除全员禁言指令', messageId: replyMessageId });
        return jsonReply(`${atSender}${formatModerationProposal(proposal)}`, { moderation_proposal_id: proposal.id });
      }

      if (/^[!！](?:改群名|设置群名|設定群名)\s+/i.test(cleanMessage)) {
        if (!hasGroupOpsAuth) return jsonReply(`${atSender}你没有群操作权限。`);
        const name = cleanMessage.replace(/^[!！](?:改群名|设置群名|設定群名)\s+/i, '').trim().slice(0, 60);
        const result = await runOneBotGroupOperation(env, 'set_group_name', { group_id: numericId(currentGroupId), group_name: name }, { actorId: userId, groupId: currentGroupId, action: '改群名' });
        return jsonReply(`${atSender}${result.ok ? `群名称已修改为：${name}` : `操作失败：${result.error}`}`);
      }

      if (/^[!！](?:改名片|设置名片|設定名片)(?:\s|$)/i.test(cleanMessage)) {
        if (!hasGroupOpsAuth) return jsonReply(`${atSender}你没有群操作权限。`);
        const prefix = cleanMessage.match(/^[!！](?:改名片|设置名片|設定名片)/i)?.[0] || '!改名片';
        const { targetQq, restText } = parseArgs(userMessage, prefix);
        if (!targetQq || !restText) return jsonReply(`${atSender}格式：!改名片 @成员 新名片`);
        const result = await runOneBotGroupOperation(env, 'set_group_card', { group_id: numericId(currentGroupId), user_id: numericId(targetQq), card: restText.slice(0, 60) }, { actorId: userId, groupId: currentGroupId, targetId: targetQq, action: '改名片' });
        return jsonReply(`${atSender}${result.ok ? `已修改 QQ:${targetQq} 的群名片。` : `操作失败：${result.error}`}`);
      }

      if (/^[!！]live$/i.test(cleanMessage)) {
        return jsonReply(`${atSender}🎙️ 即时语音通话：https://qqai.ray2025.com/live`);
      }

      if (/^[!！](?:群状态|群狀態|groupstatus)$/i.test(cleanMessage)) {
        const aiOn = await dbGet(env, `ai_off:${currentGroupId}`) !== 'true';
        const memoryOn = await dbGet(env, `memo:${currentGroupId}`) !== 'false';
        const persona = await dbGet(env, `group_persona:${currentGroupId}`) || '默认';
        const rate = Number(await dbGet(env, `interject_rate:${currentGroupId}`) || DEFAULTS.interjectRate);
        return jsonReply(`${atSender}【群状态】\nAI：${aiOn ? '开启' : '关闭'}\n长期记忆：${memoryOn ? '开启' : '关闭'}\n插话率：${rate}%（每日上限无限）\n群人格：${persona}`);
      }

      if (/^[!！](?:设置插话率|設定插話率|設置插話率)\s+\d+/i.test(cleanMessage)) {
        if (!hasAdminAuth) return jsonReply(`${atSender}你没有 AI 管理权限。`);
        const rate = Math.max(0, Math.min(100, Number(cleanMessage.match(/\d+/)?.[0] || 0)));
        await dbPut(env, `interject_rate:${currentGroupId}`, String(rate));
        await writeSystemAudit(env, { type: 'ai_settings', groupId: currentGroupId, actorId: userId, action: `interject_rate:${rate}` });
        return jsonReply(`${atSender}插话率已设为 ${rate}%，每日插话上限无限。`);
      }

      if (/^[!！](?:清空群上下文|清除群上下文)$/i.test(cleanMessage)) {
        if (!hasAdminAuth) return jsonReply(`${atSender}你没有 AI 管理权限。`);
        await dbDel(env, `chat:group:${currentGroupId}`);
        await dbDel(env, `context_summary:chat:group:${currentGroupId}`);
        await writeSystemAudit(env, { type: 'context', groupId: currentGroupId, actorId: userId, action: 'clear_group_context' });
        return jsonReply(`${atSender}已清空本群短期上下文与 DeepSeek 摘要；Vectorize 历史向量保留。`);
      }

      // ==========================================
      // 📜 基础系统帮助与状态模组 (权限阶梯动态版)
      // ==========================================
      if (['!help', '!帮助', '!幫助', '！help', '！帮助', '！幫助'].includes(msgLower)) {
        const isSuperAuth = senderRole === 'owner' || isDeveloper;
        let roleTxt = isOnlyMe ? '【👑 最高主宰: 开发者】' :
                      senderRole === 'owner' ? '【💠 最高权限: 群主】' :
                      senderRole === 'admin' ? '【🛡️ QQ管理员】' :
                      permissionSet.groupOps && permissionSet.aiAdmin ? '【🛡️ AI管理＋群操作】' :
                      permissionSet.groupOps ? '【🛡️ 群操作权限】' :
                      permissionSet.aiAdmin ? '【🧠 AI管理权限】' : '【👤 群成员】';

        let helpMsg = `🤖 QQAI 机器人指令清单 ${roleTxt}\n` +
                      `🌐 门户首页：https://qqai.ray2025.com/\n` +
                      `🎙️ Live：https://qqai.ray2025.com/live\n` +
                      `📝 匿名申诉：https://qqai.ray2025.com/appeal\n\n` +
                      `🔹 [日常与多模态]\n` +
                      `!live (取得即时语音网页)\n` +
                      `!status / !配额 (系统状态)\n` +
                      `!模型 [自动/Gemma 26B/Gemma 31B/Gemini/DeepSeek/DeepSeek High/DeepSeek Max]\n` +
                      `!语音 [问题] (语音回覆)\n` +
                      `!读网页 [网址] (提取精华摘要)\n` +
                      `!翻译 [语言] [内容]\n` +
                      `图片理解：把图片和问题放在同一则消息，或回复图片后 @我\n\n` +
                      `🔹 [娱乐与分析]\n` +
                      `!会议纪要 [数字] (提取重点结论)\n` +
                      `!总结 [数字] (八卦轻松吃瓜)\n` +
                      `!查成分 [@成员] (AI属性分析)\n` +
                      `!模仿 [@成员] (全群灵魂窃取)\n\n` +
                      `🔹 [专属记忆与个人设置]\n` +
                      `!群规 / !rules\n` +
                      `!免打扰 / !取消免打扰\n` +
                      `!记住 [@成员] <内容> / !忘记 [@成员] <内容>\n` +
                      `!你记住了什么 [@成员]\n` +
                      `!set人格 [风格] / !del人格\n\n` +
                      `🔹 [排程]\n` +
                      `!排程 2026-07-22 18:00 内容\n` +
                      `!排程 每天 18:00 内容\n` +
                      `!排程 列表 / !排程 取消 编号\n` +
                      `私聊申诉：!申诉 群号 类型 详细内容\n`;

        if (permissionSet.aiAdmin) {
          helpMsg += `\n🧠 [AI 管理区]\n` +
                     `!关闭ai / !开启ai\n` +
                     `!记忆开 / !记忆关\n` +
                     `!拉黑 [@成员] / !洗白 [@成员]\n` +
                     `!set群规 [内容]\n` +
                     `!切换人格 [风格] / !恢复人格\n` +
                     `!设置插话率 0-100\n` +
                     `!清空群上下文\n`;
        }

        if (permissionSet.groupOps) {
          helpMsg += `\n🛡️ [群操作管理区]\n` +
                     `!禁言 [@成员] [时长] / !解禁 [@成员]\n` +
                     `!撤回 (回复目标消息)\n` +
                     `!踢出 [@成员]\n` +
                     `!全员禁言 / !解除全员禁言\n` +
                     `自然语言也可发起确认操作，例如「把 @某人 杀了」\n` +
                     `以上高风险操作只建立待确认操作；确认 <操作编号> 后才执行\n` +
                     `取消 <操作编号> 可撤销提案\n` +
                     `!改群名 [新名称]\n` +
                     `!改名片 [@成员] [新名片]\n`;
        }

        if (isSuperAuth || isOnlyMe) {
          helpMsg += `\n💠 [群主/开发者 核心设定区]\n` +
                     `!群白名单 [群号] / !删群白名单 [群号]\n` +
                     `!取消使用 (删除全局性格或模仿)\n`;
        }

        if (isOnlyMe) {
          helpMsg += `\n👑 [最高主宰 专属上帝指令]\n` +
                     `!授权 [@成员] [权限类型]\n` +
                     `!撤销授权 [@成员] [权限类型]\n` +
                     `!禁记忆 [@成员] / !解禁记忆 [@成员]\n` +
                     `!自我调整 / !自我修正\n` +
                     `!重置 或 !clear\n` +
                     `(额度只能由开发者在 Root 后台设置)\n`;
        }
        return jsonReply(`${atSender}${helpMsg.trim()}`);
      }

      if (['!status', '!配额', '!配額', '！status', '！配额', '！配額'].includes(msgLower)) {
        const totalCalls = await dbGet(env, "STAT_TOTAL_CALLS") || "0";
        const lastModel = await dbGet(env, "STAT_LAST_MODEL") || "无记录";
        const currentMemSwitch = await dbGet(env, `memo:${currentGroupId}`) !== "false" ? "🟢 开启" : "🔴 关闭";
        const currentAiSwitch = await dbGet(env, `ai_off:${currentGroupId}`) !== "true" ? "🟢 开启" : "🔴 关闭";
        const totalKeys = [...(env.GEMINI_API_KEYS || "").split(',').filter(k => k.trim() !== ""), ...(env.VECTORIZE_GEMINI_KEYS || "").split(',').filter(k => k.trim() !== "")].length;
        
        const statusMsg = `📊 【系统运行状态报告】\n` +
                          `--------------------\n` +
                          `🔑 Gemini 金钥总数: ${totalKeys} 把\n` +
                          `🧩 DeepSeek Flash 金钥: ${deepSeekApiKeys(env).length} 把\n` +
                          `🧠 核心回复开关: ${currentAiSwitch}\n` +
                          `💾 向量记忆开关: ${currentMemSwitch}\n` +
                          `--------------------\n` +
                          `🔥 全局累计对话: ${totalCalls} 次\n` +
                          `⚙️ 最后响应模型:\n${lastModel}`;
        return jsonReply(`${atSender}${statusMsg}`);
      }
      
      // 第二段到此結束，準備進入第三段的讀網頁與翻譯工具模組。

      // ==========================================
      // 🎙️ 语音智能对答：先生成简体中文文字，再由 TTS 专用模型输出音频。
      if (/^[!！](?:语音|語音|speak|tts)\s+(.+)/i.test(cleanMessage)) {
        const userPrompt = cleanMessage.match(/^[!！](?:语音|語音|speak|tts)\s+(.+)/i)?.[1]?.trim() || "";
        if (!userPrompt) return jsonReply(`${atSender}请告诉我想说什么。`);
        activeThinkingMessageId = await sendThinkingIndicator(env, { isGroup, groupId: currentGroupId, userId, text: "正在生成语音..." }).catch(() => null);
        const textResult = await callGeminiGenerate(env, {
          models: chatModels,
          system: "使用自然简洁的简体中文回答，适合直接朗读；不要讨论、承认或否认模型与系统身份。",
          contents: [{ role: "user", parts: [{ text: userPrompt }] }], maxOutputTokens: 500, temperature: 0.7, useSearch: false
        }).catch(() => null);
        if (!textResult?.text) return jsonReply(`${atSender}暂时无法生成语音内容。`);
        const keys = roundRobinKeys([...new Set([...parseList(env.GEMINI_API_KEYS), ...parseList(env.VECTORIZE_GEMINI_KEYS)])], "gemini");
        let lastError = "没有音频结果";
        for (const model of ttsModels) {
          for (const key of keys.slice(0, 4)) {
            try {
              const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: textResult.text }] }], generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } } } } }),
                signal: AbortSignal.timeout(30000)
              });
              if (!res.ok) { lastError = `${model}: ${res.status}`; continue; }
              const data = await res.json();
              const part = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData?.data || p.inline_data?.data);
              const inline = part?.inlineData || part?.inline_data;
              if (inline?.data) return jsonReply(`${atSender}[CQ:record,file=base64://${inline.data}]`);
              lastError = `${model}: 未返回音频`;
            } catch (error) { lastError = error.message || String(error); }
          }
        }
        return jsonReply(`${atSender}语音转换失败：${lastError}`);
      }

      // 🌐 读网页精炼摘要 (纯抓文字并交由 AI 总结)
      // ==========================================
      const readMatch = cleanMessage.match(/^[!！](?:读网页|讀網頁)\s+(https?:\/\/[^\s]+)/);
      if (readMatch) {
        activeThinkingMessageId = await sendThinkingIndicator(env, { isGroup, groupId: currentGroupId, userId, text: "正在分析网页..." }).catch(() => null);
        try {
          const res = await fetchPublicUrl(readMatch[1], { headers: {'User-Agent': 'Mozilla/5.0 QQAIbot'}, signal: AbortSignal.timeout(15000) }, 3);
          const html = await res.text();
          // 简易过滤 script、style 与 html 标签，保留纯文本
          const text = html.replace(/<script[^>]*>([\S\s]*?)<\/script>/gmi, '')
                           .replace(/<style[^>]*>([\S\s]*?)<\/style>/gmi, '')
                           .replace(/<\/?[^>]+(>|$)/g, " ")
                           .replace(/\s+/g, ' ')
                           .substring(0, 15000); // 截取前 15000 字防止溢出
          
          const aiSummary = await callGeminiDirectly(`请帮我快速总结以下网页内容的核心重点，字数控制在200-300字以内，语言要生动精炼，直接输出结果，绝对不要用Markdown格式：\n\n${text}`);
          
          if (aiSummary) return jsonReply(`${atSender}📄 【网页提炼总结】：\n${aiSummary}`);
          return jsonReply(`${atSender}❌ 网页分析失败，AI 可能卡住了。`);
        } catch (e) { 
          return jsonReply(`${atSender}❌ 无法读取该网页内容，可能被对方服务器拦截或访问超时了！`); 
        }
      }

      // ==========================================
      // 🔠 专业翻译官 (信达雅翻译 + 例句补充)
      // ==========================================
      const translateMatch = cleanMessage.match(/^[!！](?:翻译|翻譯)\s+([^\s]+)\s+(.*)$/s);
      if (translateMatch) {
        activeThinkingMessageId = await sendThinkingIndicator(env, { isGroup, groupId: currentGroupId, userId, text: "正在翻译..." }).catch(() => null);
        const targetLang = translateMatch[1];
        const sourceText = translateMatch[2];
        
        const aiTranslation = await callGeminiDirectly(`你现在是一位精通${targetLang}的资深翻译官。请将以下内容翻译成${targetLang}，要求信达雅。并在翻译结果下方补充1~2句与此相关的日常或商务应用例句。严禁使用Markdown格式。需要翻译的内容：\n${sourceText}`);
        
        if (aiTranslation) return jsonReply(`${atSender}🔠 【${targetLang} 翻译结果】：\n${aiTranslation}`);
        return jsonReply(`${atSender}❌ 翻译失败，AI 查字典查晕了。`);
      }


      // 第三段到此完美結束，準備進入第四段的會議紀要、吃瓜總結與查成分模組...

      // ==========================================
      // 📋 群组精华分析：会议纪要 (提取重点结论)
      // ==========================================
      const meetingMatch = msgLower.match(/^[!！](?:会议纪要|會議紀要)\s*(\d+)?/);
      if (meetingMatch) {
        activeThinkingMessageId = await sendThinkingIndicator(env, { isGroup, groupId: currentGroupId, userId, text: "正在整理会议纪要..." }).catch(() => null);
        let count = meetingMatch[1] ? parseInt(meetingMatch[1]) : 50;
        if (count > 200) count = 200; 
        if (count < 10) count = 10;
        
        // 從 D1 獲取近期滾動日誌 (後續段落會自動將大家聊天的日誌寫入 recent_logs)
        const storedLogs = await dbGet(env, `recent_logs:${currentGroupId}`);
        let logs = storedLogs ? JSON.parse(storedLogs) : [];
        
        if (logs.length < 5) return jsonReply(`${atSender}📝 刚刚群里都没人说话，没什么好纪录的。`);
        const targetLogs = logs.slice(-count);
        
        const summary = await callGeminiDirectly(`请将以下群聊记录整理成一份「会议精华纪要」。\n要求包含：1. 讨论的核心主题 2. 达成的共识或主要观点 3. 待办事项或结论。请用专业精炼的语言整理，直接输出重点，严禁使用Markdown格式：\n\n` + targetLogs.join('\n'));
        
        if (summary) return jsonReply(`${atSender}📋 【最近 ${targetLogs.length} 条群聊精华纪要】：\n${summary}`);
        return jsonReply(`${atSender}❌ 纪要生成失败，AI 脑容量不足。`);
      }

      // ==========================================
      // 🍉 群组轻松吃瓜：聊天总结 (八卦语气)
      // ==========================================
      const melonMatch = msgLower.match(/^[!！](?:吃瓜|总结|總結)\s*(\d+)?/);
      if (melonMatch && !meetingMatch) {
        activeThinkingMessageId = await sendThinkingIndicator(env, { isGroup, groupId: currentGroupId, userId, text: "正在整理群聊..." }).catch(() => null);
        let count = melonMatch[1] ? parseInt(melonMatch[1]) : 60;
        if (count > 100) count = 100; 
        if (count < 5) count = 5;
        
        const storedLogs = await dbGet(env, `recent_logs:${currentGroupId}`);
        let logs = storedLogs ? JSON.parse(storedLogs) : [];
        
        if (logs.length < 5) return jsonReply(`${atSender}🍵 刚刚群里都没什么人说话，没有瓜可以吃呀~`);
        const targetLogs = logs.slice(-count);
        
        const promptText = `请看以下最近群里的聊天记录。请用八卦、轻松的语气，帮我简单总结大家刚刚在聊些什么（重点抓取有趣的内容，字数控制在500字以内，绝对不准用markdown格式）：\n\n` + targetLogs.join('\n');
        const summary = await callGeminiDirectly(promptText);
        
        if (summary) return jsonReply(`${atSender}🍉 【最近 ${targetLogs.length} 条吃瓜总结】：\n${summary}`);
        return jsonReply(`${atSender}❌ 总结失败，AI 偷懒了。`);
      }

      // ==========================================
      // 🔍 查成分分析 (结合向量数据库与 AI 生成)
      // ==========================================
      if (['!查成分', '!查成份', '!stats', '！查成分', '！查成份', '！stats'].some(p => msgLower.startsWith(p))) {
        activeThinkingMessageId = await sendThinkingIndicator(env, { isGroup, groupId: currentGroupId, userId, text: '正在分析...' }).catch(() => null);
        const prefix = ['!查成分', '!查成份', '!stats', '！查成分', '！查成份', '！stats'].find(p => msgLower.startsWith(p));
        const { targetQq } = parseArgs(userMessage, prefix);
        // 若未指定目標，則查詢發送者本人的成分
        let targetUserId = targetQq || userId; 
        
        if (!env.VECTORIZE) return jsonReply(`${atSender}⚠️ 向量数据库未绑定，无法进行深度成分分析。`);
        
        try {
          // 提取查詢特徵向量，尋找與性格、習慣高度相關的發言
          const queryVec = await getVector("经常聊什么 兴趣爱好 性格 习惯 说话方式");
          if (!queryVec || typeof queryVec === 'string') return jsonReply(`${atSender}❌ 提取特征向量失败。`);
          
          // 在向量庫中檢索該群組且該作者的歷史發言
          const matches = await env.VECTORIZE.query(queryVec, { topK: 30, returnMetadata: "all" });
          const validMatches = matches?.matches?.filter(m => String(m.metadata?.groupId || m.metadata?.group || m.metadata?.group_id || '') === currentGroupId && String(m.metadata?.userId || m.metadata?.author || m.metadata?.qq || '') === targetUserId);
          
          if (!validMatches || validMatches.length < 3) {
            return jsonReply(`${atSender}🔍 数据库中关于 QQ:${targetUserId} 的发言记录太少，无法进行精准分析。多聊聊天吧！`);
          }
          
          // 擷取最多 20 條特徵發言餵給 Gemini 進行心理測寫
          const logText = validMatches.slice(0, 20).map(m => m.metadata?.text || "").join("\n");
          const summary = await callGeminiDirectly(`你是一个非常有趣的心理与行为分析师。请根据以下这位群友的历史发言记录，帮他生成一份幽默的「成分分析报告」。\n要求包含：1. 他的主要性格特点（如傲娇、乐子人、话痨、技术宅等） 2. 最常关心或讨论的话题 3. 给出一个好玩的饼状图比例（如 50% 吐槽担当、30% 潜水员...）。直接输出精炼的分析结果，字数300字以内，绝对禁止使用Markdown格式：\n\n聊天记录：\n${logText}`);
          
          if (summary) return jsonReply(`${atSender}📊 【QQ:${targetUserId} 的成分分析报告】：\n${summary}`);
          return jsonReply(`${atSender}❌ 分析失败，AI 分析师罢工了。`);
        } catch (err) { 
          return jsonReply(`${atSender}❌ 分析过程出现错误：${err.message}`); 
        }
      }

      // 第四段到此完美結束，準備進入第五段的專屬记忆管理與人設切換模組...

      // ==========================================
      // 🧠 专属记忆管理 (D1 数据库重构版)
      // ==========================================
      // !记住：普通成员只能修改自己；AI 管理员可用 @ 指定成员。
      if (['!记住', '!記住', '!remember', '！记住', '！記住', '！remember'].some(p => msgLower.startsWith(p))) {
        const prefix = ['!记住', '!記住', '!remember', '！记住', '！記住', '！remember'].find(p => msgLower.startsWith(p));
        const { targetQq, restText } = parseArgs(userMessage, prefix);
        const memoryOwner = targetQq || userId;
        const targetMem = targetQq ? restText : cleanMessage.slice(prefix.length).replace(/\[CQ:[^\]]+\]/g, '').trim();
        if (!targetMem) return jsonReply(`${atSender}请输入要记住的内容。`);
        if (memoryOwner !== userId && !hasAdminAuth) return jsonReply(`${atSender}你只能修改自己的私人记忆。`);
        if (await isMemoryBanned(env, memoryOwner)) return jsonReply(`${atSender}【操作失败：该账号的记忆编辑权限已被冻结】`);
        const kvKey = `user_memo:${currentGroupId}:${memoryOwner}`;
        const memos = normalizeMemoryItems(await readJson(env, kvKey, []), memoryOwner);
        if (!hasAdminAuth && memos.length >= 100) return jsonReply(`${atSender}专属记忆已达 100 条上限，请先删除部分内容。`);
        let item = { id: crypto.randomUUID(), text: targetMem, scope: 'private', owner: memoryOwner, subjectQq: memoryOwner, creator: userId, at: new Date().toISOString() };
        item = await upsertMemoryVector(env, item, currentGroupId).catch(error => { console.warn("指令记忆向量写入失败", error); return item; });
        memos.push(item);
        await dbPut(env, kvKey, JSON.stringify(memos));
        await writeMemoryAudit(env, { groupId: currentGroupId, userId, action: `新增记忆:${memoryOwner}`, before: null, after: targetMem });
        return jsonReply(`${atSender}已记住${memoryOwner === userId ? '' : `关于 QQ:${memoryOwner} 的内容`}：${targetMem}`);
      }

      // !忘记：只删除 D1 手动记忆，不删除 Vectorize 历史向量。
      if (['!忘记', '!忘記', '!forget', '！忘记', '！忘記', '！forget'].some(p => msgLower.startsWith(p))) {
        const prefix = ['!忘记', '!忘記', '!forget', '！忘记', '！忘記', '！forget'].find(p => msgLower.startsWith(p));
        const { targetQq, restText } = parseArgs(userMessage, prefix);
        const memoryOwner = targetQq || userId;
        const query = targetQq ? restText : cleanMessage.slice(prefix.length).replace(/\[CQ:[^\]]+\]/g, '').trim();
        if (!query) return jsonReply(`${atSender}格式：!忘记 [@成员] 关键词`);
        if (memoryOwner !== userId && !hasAdminAuth) return jsonReply(`${atSender}你只能删除自己的私人记忆。`);
        if (await isMemoryBanned(env, memoryOwner)) return jsonReply(`${atSender}【操作失败：该账号的记忆编辑权限已被冻结】`);
        const kvKey = `user_memo:${currentGroupId}:${memoryOwner}`;
        const memos = normalizeMemoryItems(await readJson(env, kvKey, []), memoryOwner);
        const removed = memos.filter(m => m.text.includes(query));
        const next = memos.filter(m => !m.text.includes(query));
        if (!removed.length) return jsonReply(`${atSender}没找到包含「${query}」的记忆。`);
        if (next.length) await dbPut(env, kvKey, JSON.stringify(next)); else await dbDel(env, kvKey);
        for (const item of removed) await deleteMemoryVector(env, item).catch(error => console.warn("指令记忆向量删除失败", error));
        await writeMemoryAudit(env, { groupId: currentGroupId, userId, action: `删除记忆与向量:${memoryOwner}`, before: removed.map(x => x.text).join(' | '), after: null });
        return jsonReply(`${atSender}已删除 ${removed.length} 条长期记忆，并同步删除对应 Vectorize 向量。`);
      }

      // !你记住了什么：支持 @，但查看他人私人记忆需要 AI 管理权。
      if (/^[!！]你(?:记住|記住)了(?:什么|什麼)(?:\s|$)/.test(cleanMessage)) {
        const memoryOwner = targetMentionQqs[0] || userId;
        if (memoryOwner !== userId && !hasAdminAuth) return jsonReply(`${atSender}你没有查看他人私人记忆的权限。`);
        const memos = normalizeMemoryItems(await readJson(env, `user_memo:${currentGroupId}:${memoryOwner}`, []), memoryOwner);
        if (!memos.length) return jsonReply(`${atSender}目前没有${memoryOwner === userId ? '你的' : ` QQ:${memoryOwner} 的`}专属记忆。`);
        return jsonReply(`${atSender}【${memoryOwner === userId ? '你的' : `QQ:${memoryOwner}`}专属记忆】\n` + memos.slice(-30).map((m, i) => `${i + 1}. ${m.text}`).join('\n'));
      }

      if (['!群规', '!群規', '!rules', '！群规', '！群規'].includes(msgLower)) {
        const rules = await dbGet(env, `group_rules:${currentGroupId}`);
        if (!rules) return jsonReply(`${atSender}📌 本群尚未设置群规。管理员可使用 !set群规 [内容] 设置。`);
        return jsonReply(`${atSender}📌 【本群群规】\n${rules}`);
      }

      if (['!set群规', '!set群規', '!setrules', '！set群规', '！set群規'].some(p => msgLower.startsWith(p))) {
        if (!hasAdminAuth) return jsonReply(`${atSender}⚠️ 权限不足。仅限管理员、群主或开发者设置群规。`);
        const prefix = ['!set群规', '!set群規', '!setrules', '！set群规', '！set群規'].find(p => msgLower.startsWith(p));
        const rules = cleanMessage.slice(prefix.length).trim();
        if (!rules) return jsonReply(`${atSender}⚠️ 群规内容不能为空。格式：!set群规 禁止刷屏，友善交流`);
        await dbPut(env, `group_rules:${currentGroupId}`, rules);
        return jsonReply(`${atSender}✅ 本群群规已更新。`);
      }

      // ==========================================
      // 🎭 全局与个人专属人格控制模组
      // ==========================================
      // !切换人格 (全局)
      if (['!切换人格', '!切換人格', '!setgrouppersona', '！切换人格', '！切換人格'].some(p => msgLower.startsWith(p))) {
        if (!hasAdminAuth) return jsonReply(`${atSender}⚠️ 权限不足。仅限管理员、群主或开发者操作全局人格。`);
        const prefix = ['!切换人格', '!切換人格', '!setgrouppersona', '！切换人格', '！切換人格'].find(p => msgLower.startsWith(p));
        const content = cleanMessage.slice(prefix.length).trim();
        if (!content) return jsonReply(`${atSender}⚠️ 风格内容不能为空哦！格式：!切换人格 暴躁老哥`);

        await dbPut(env, `group_persona:${currentGroupId}`, content);
        return jsonReply(`${atSender}✨ 群组全局人格已切换为：【${content}】！现在起，所有人都会受到我的这个性格影响。`);
      }

      // !恢复人格 (全局)
      if (['!恢复人格', '!恢復人格', '!delgrouppersona', '！恢复人格', '！恢復人格'].some(p => msgLower.startsWith(p))) {
        if (!hasAdminAuth) return jsonReply(`${atSender}⚠️ 权限不足。`);
        await dbDel(env, `group_persona:${currentGroupId}`);
        await dbDel(env, `mimic_target:${currentGroupId}`);
        return jsonReply(`${atSender}已清除本群全局人格与模仿状态。`);
      }

      if (['!取消使用', '!cancelimitate', '！取消使用'].some(p => msgLower === p)) {
        if (!hasAdminAuth) return jsonReply(`${atSender}⚠️ 权限不足。仅限管理员、群主或开发者解除全群模仿状态。`);
        await dbDel(env, `group_persona:${currentGroupId}`);
        await dbDel(env, `mimic:${currentGroupId}`);
        await dbDel(env, `mimic_target:${currentGroupId}`);
        return jsonReply(`${atSender}♻️ 已解除全群模仿状态。`);
      }

      // !set人格 [@成员/QQ号] [风格]
      if (['!set人格', '!set風格', '!setpersonality', '！set人格', '！set風格'].some(p => msgLower.startsWith(p))) {
        const prefix = ['!set人格', '!set風格', '!setpersonality', '！set人格', '！set風格'].find(p => msgLower.startsWith(p));
        const { targetQq, restText } = parseArgs(userMessage, prefix);
        const targetUserId = targetQq || userId;
        const isSettingOthers = targetUserId !== userId;

        if (isSettingOthers && !hasAdminAuth) return jsonReply(`${atSender}⚠️ 权限不足。您无法帮他人设置专属人格。`);
        if (!restText) return jsonReply(`${atSender}⚠️ 风格内容不能为空哦！格式：!set人格 [@成员] 傲娇妹妹`);

        // 🔒 【最高核心锁】绝对防御：禁止任何人更改开发者的个人设定
        if (targetUserId === "3569028262" || (env.DEVELOPER_ID && targetUserId === env.DEVELOPER_ID.toString())) {
           if (!isOnlyMe) return jsonReply(`${atSender}❌ 安全警告：拒绝访问！您无权修改最高核心开发者的专属个人设定！`);
        }

        await dbPut(env, `custom_style:${currentGroupId}:${targetUserId}`, restText);
        if (isSettingOthers) {
          return jsonReply(`${atSender}✨ 已成功为 QQ:${targetUserId} 设定专属外挂人格！`);
        }
        return jsonReply(`${atSender}✨ 专属人格定制成功！以后我单独回你时会切换成这种风格。`);
      }

      // !del人格 [@成员/QQ号]
      if (['!del人格', '!del風格', '!clear人格', '！del人格', '！del風格'].some(p => msgLower.startsWith(p))) {
        const prefix = ['!del人格', '!del風格', '!clear人格', '！del人格', '！del風格'].find(p => msgLower.startsWith(p));
        const { targetQq } = parseArgs(userMessage, prefix);
        const targetUserId = targetQq || userId;
        const isSettingOthers = targetUserId !== userId;

        if (isSettingOthers && !hasAdminAuth) return jsonReply(`${atSender}⚠️ 权限不足。您无法帮他人清除人格。`);

        // 🔒 【最高核心锁】绝对防御：禁止任何人删除开发者的个人设定
        if (targetUserId === "3569028262" || (env.DEVELOPER_ID && targetUserId === env.DEVELOPER_ID.toString())) {
           if (!isOnlyMe) return jsonReply(`${atSender}❌ 安全警告：拒绝访问！您无权删除最高核心开发者的专属个人设定！`);
        }

        await dbDel(env, `custom_style:${currentGroupId}:${targetUserId}`);
        return jsonReply(`${atSender}🗑️ 已清除 QQ:${targetUserId} 的专属外挂人格。`);
      }

      // ==========================================
      // 🔇 智能免打扰模式
      // ==========================================
      if (['!免打扰', '!免打擾', '!noat', '！免打扰', '！免打擾'].some(p => msgLower.startsWith(p))) {
        const prefix = ['!免打扰', '!免打擾', '!noat', '！免打扰', '！免打擾'].find(p => msgLower.startsWith(p));
        const { targetQq } = parseArgs(userMessage, prefix);
        const targetUserId = targetQq || userId;
        const isSettingOthers = targetUserId !== userId;

        if (isSettingOthers && !hasAdminAuth) return jsonReply(`${atSender}⚠️ 权限不足。您无法帮他人开启免打扰。`);

        // 🔒 【最高核心锁】保护开发者
        if (targetUserId === "3569028262" || (env.DEVELOPER_ID && targetUserId === env.DEVELOPER_ID.toString())) {
           if (!isOnlyMe) return jsonReply(`${atSender}❌ 安全警告：您无权修改核心开发者的免打扰状态！`);
        }

        await dbPut(env, `dnd:${currentGroupId}:${targetUserId}`, "true");
        return jsonReply(`${atSender}🤫 已为 QQ:${targetUserId} 开启免打扰，我回复时将不再 @ 提醒。`);
      }

      if (['!取消免打扰', '!取消免打擾', '!cancelnoat', '！取消免打扰', '！取消免打擾'].some(p => msgLower.startsWith(p))) {
        const prefix = ['!取消免打扰', '!取消免打擾', '!cancelnoat', '！取消免打扰', '！取消免打擾'].find(p => msgLower.startsWith(p));
        const { targetQq } = parseArgs(userMessage, prefix);
        const targetUserId = targetQq || userId;
        const isSettingOthers = targetUserId !== userId;

        if (isSettingOthers && !hasAdminAuth) return jsonReply(`${atSender}⚠️ 权限不足。您无法帮他人取消免打扰。`);

        // 🔒 【最高核心锁】保护开发者
        if (targetUserId === "3569028262" || (env.DEVELOPER_ID && targetUserId === env.DEVELOPER_ID.toString())) {
           if (!isOnlyMe) return jsonReply(`${atSender}❌ 安全警告：您无权修改核心开发者的免打扰状态！`);
        }

        await dbDel(env, `dnd:${currentGroupId}:${targetUserId}`);
        return jsonReply(`${atSender}🔔 已为 QQ:${targetUserId} 取消免打扰，欢迎回来！`);
      }

      // 第五段到此完美結束，準備進入第六段的全局開關、黑白名單防禦與模仿竊取模組...

      // ==========================================
      // ⚙️ 全局 AI 开关控制 (群管专属)
      // ==========================================
      if (['!关闭ai', '!關閉ai', '!turnoff', '！关闭ai', '！關閉ai'].some(p => msgLower === p)) {
        if (!hasAdminAuth) return jsonReply(`${atSender}⚠️ 权限不足。仅限管理员、群主或开发者操作。`);
        
        await dbPut(env, `ai_off:${currentGroupId}`, "true");
        return jsonReply(`${atSender}💤 AI 助手已在此群进入休眠模式。如需唤醒，请使用 !开启AI 指令。`);
      }

      if (['!开启ai', '!開啟ai', '!turnon', '！开启ai', '！開啟ai'].some(p => msgLower === p)) {
        if (!hasAdminAuth) return jsonReply(`${atSender}⚠️ 权限不足。仅限管理员、群主或开发者操作。`);
        
        await dbDel(env, `ai_off:${currentGroupId}`);
        return jsonReply(`${atSender}✨ AI 助手已重新唤醒！很高兴继续为大家服务。`);
      }

      if (['!ai关', '!ai關', '！ai关', '！ai關'].some(p => msgLower === p)) {
        if (!hasAdminAuth) return jsonReply(`${atSender}⚠️ 权限不足。仅限管理员、群主或开发者操作。`);
        await dbPut(env, `ai_off:${currentGroupId}`, "true");
        return jsonReply(`${atSender}💤 AI 助手已在此群进入休眠模式。`);
      }

      if (['!ai开', '!ai開', '！ai开', '！ai開'].some(p => msgLower === p)) {
        if (!hasAdminAuth) return jsonReply(`${atSender}⚠️ 权限不足。仅限管理员、群主或开发者操作。`);
        await dbDel(env, `ai_off:${currentGroupId}`);
        return jsonReply(`${atSender}✨ AI 助手已重新唤醒。`);
      }

      if (['!记忆开', '!記憶開', '!memoryon', '！记忆开', '！記憶開'].some(p => msgLower === p)) {
        if (!hasAdminAuth) return jsonReply(`${atSender}⚠️ 权限不足。仅限管理员、群主或开发者操作。`);
        await dbPut(env, `memo:${currentGroupId}`, "true");
        return jsonReply(`${atSender}🧠 本群 Vectorize 自动记忆已开启。`);
      }

      if (['!记忆关', '!記憶關', '!memoryoff', '！记忆关', '！記憶關'].some(p => msgLower === p)) {
        if (!hasAdminAuth) return jsonReply(`${atSender}⚠️ 权限不足。仅限管理员、群主或开发者操作。`);
        await dbPut(env, `memo:${currentGroupId}`, "false");
        return jsonReply(`${atSender}🧠 本群 Vectorize 自动记忆已关闭。`);
      }

      if (['!群白名单', '!群白名單', '!allowgroup', '！群白名单', '！群白名單'].some(p => msgLower.startsWith(p))) {
        if (!isDeveloper) return jsonReply(`${atSender}只有开发者可以操作群白名单。`);
        const prefix = ['!群白名单', '!群白名單', '!allowgroup', '！群白名单', '！群白名單'].find(p => msgLower.startsWith(p));
        const groupToAllow = cleanMessage.slice(prefix.length).trim() || currentGroupId;
        if (!groupToAllow) return jsonReply(`${atSender}⚠️ 请提供群号，例如: !群白名单 123456`);
        await dbPut(env, `group_whitelist:${groupToAllow}`, "true");
        await appendIndex(env, 'group_whitelist:index', groupToAllow, 2000);
        return jsonReply(`${atSender}✅ 已将群 ${groupToAllow} 加入白名单。`);
      }

      if (['!删群白名单', '!刪群白名單', '!removegroup', '！删群白名单', '！刪群白名單'].some(p => msgLower.startsWith(p))) {
        if (!isDeveloper) return jsonReply(`${atSender}只有开发者可以操作群白名单。`);
        const prefix = ['!删群白名单', '!刪群白名單', '!removegroup', '！删群白名单', '！刪群白名單'].find(p => msgLower.startsWith(p));
        const groupToRemove = cleanMessage.slice(prefix.length).trim() || currentGroupId;
        if (!groupToRemove) return jsonReply(`${atSender}⚠️ 请提供群号，例如: !删群白名单 123456`);
        await dbDel(env, `group_whitelist:${groupToRemove}`);
        await removeFromIndex(env, 'group_whitelist:index', groupToRemove);
        return jsonReply(`${atSender}🗑️ 已将群 ${groupToRemove} 移出白名单。`);
      }

      if (['!clear', '!重置', '！clear', '！重置'].some(p => msgLower === p)) {
        if (!hasAdminAuth) return jsonReply(`${atSender}⚠️ 权限不足。仅限管理员、群主或开发者操作。`);
        await dbDel(env, sessionKey);
        await dbDel(env, `mimic:${currentGroupId}`);
        await dbDel(env, `mimic_target:${currentGroupId}`);
        return jsonReply(`${atSender}♻️ 已清空当前会话上下文与模仿状态。`);
      }

      // ==========================================
      // 🚫 黑白名单防御机制 (全域封锁)
      // ==========================================
      if (['!拉黑', '!block', '！拉黑'].some(p => msgLower.startsWith(p))) {
        const prefix = ['!拉黑', '!block', '！拉黑'].find(p => msgLower.startsWith(p));
        const { targetQq } = parseArgs(userMessage, prefix);
        
        if (!hasAdminAuth) return jsonReply(`${atSender}⚠️ 权限不足。仅限管理层操作。`);
        if (!targetQq) return jsonReply(`${atSender}⚠️ 请指定要拉黑的 QQ 号或直接 @ 对方。`);
        
        // 🔒 【最高核心锁】绝对防御：禁止任何人拉黑核心开发者
        if (targetQq === "3569028262" || (env.DEVELOPER_ID && targetQq === env.DEVELOPER_ID.toString())) {
           return jsonReply(`${atSender}❌ 致命警告：系统拒绝访问！您无权将最高核心开发者列入黑名单！`);
        }

        await dbPut(env, `blacklist:${currentGroupId}:${targetQq}`, "true");
        return jsonReply(`${atSender}⛔ 制裁生效：已将 QQ:${targetQq} 打入冷宫，禁止其触发任何 AI 回覆与功能。`);
      }

      if (['!洗白', '!unblock', '！洗白'].some(p => msgLower.startsWith(p))) {
        const prefix = ['!洗白', '!unblock', '！洗白'].find(p => msgLower.startsWith(p));
        const { targetQq } = parseArgs(userMessage, prefix);
        
        if (!hasAdminAuth) return jsonReply(`${atSender}⚠️ 权限不足。`);
        if (!targetQq) return jsonReply(`${atSender}⚠️ 请指定要解除封锁的 QQ 号。`);
        
        await dbDel(env, `blacklist:${currentGroupId}:${targetQq}`);
        return jsonReply(`${atSender}✅ 赦免成功：已将 QQ:${targetQq} 移出黑名单。`);
      }

      // ==========================================
      // 🎭 灵魂窃取 (动态全域模仿模块)
      // ==========================================
      if (['!模仿', '!imitate', '！模仿'].some(p => msgLower.startsWith(p))) {
        // 🛡️ 权限检查：只有管理员、群主或核心开发者可用
        // 注意：这里的 \`reqData.sender.role\` 请根据你实际接收 QQ 讯息的 JSON 变数名称做微调
        // 如果你的大变数叫 payload 或 body，请换成对应的名字 (例如 payload.sender.role)
        const role = body.sender?.role || 'member'; 
        const isAdminOrOwner = permissionSet.aiAdmin;
        
        if (!isAdminOrOwner) {
            return jsonReply(`${atSender}⛔ 权限不足！「灵魂窃取」属于禁忌魔法，仅限管理员或群主使用。`);
        }

        const prefix = ['!模仿', '!imitate', '！模仿'].find(p => msgLower.startsWith(p));
        const { targetQq } = parseArgs(userMessage, prefix);
        
        if (!targetQq) return jsonReply(`${atSender}⚠️ 请 @ 你想让我模仿的人，或者输入他的 QQ 号。`);

        // 🔒 保护开发者灵魂不被随意窃取
        if (targetQq === "3569028262" || (env.DEVELOPER_ID && targetQq === env.DEVELOPER_ID.toString())) {
            if (!isOnlyMe) return jsonReply(`${atSender}❌ 警告：核心开发者的灵魂过于强大，精神防护网已拦截本次窃取尝试！`);
        }

        // ==========================================
        // 🔮 升級：利用向量空間 (getVector) 提取目標用戶與當前話題最相關的靈魂碎片
        // ==========================================
        let logs = [];
        try {
            // 1. 調用 getVector 函數，將當前的 userMessage 轉成高維度向量
            const userVector = await getVector(userMessage);

            if (userVector && Array.isArray(userVector)) {
                // 2. 拿著向量去你的 Cloudflare Vectorize 資料庫查詢
                // 🎯 這裡使用 filter 鐵律過濾：只准抓這個目標 QQ 號說過的話！
                const vectorMatches = await env.VECTORIZE.query(userVector, {
                    topK: 12,                    // 撈出最相關的 12 條語風範本
                    filter: { qq: targetQq.toString() }, // 確保與寫入時的字串型態一致
                    returnValues: true
                });

                if (vectorMatches && vectorMatches.matches) {
                    // 3. 將當初存入的帶有 [暱稱(QQ:xxx)]: 內容的 text 完整提取出來
                    logs = vectorMatches.matches.map(match => match.metadata?.text).filter(Boolean);
                }
            }
        } catch (vectorError) {
            console.error("🚨 向量空間抽樣失敗，啟動 D1 滾屏日誌降級備援:", vectorError);
        }

        // 🛡️ 備援降級防線：
        // 因為新功能剛上線時向量庫是空的，萬一向量空間找不到資料（logs 長度低於 3 條），
        // 會自動退回原本的 D1 滾屏日誌過濾，確保機器人絕對不會死機或回話失敗！
        if (logs.length < 3) {
            console.log("⚠️ 向量空間碎片不足，啟動 D1 滾屏日誌備援撈取...");
            const storedLogs = await dbGet(env, `recent_logs:${currentGroupId}`);
            if (storedLogs) {
                try {
                    const parsed = JSON.parse(storedLogs);
                    logs = parsed.filter(l => l.includes(`QQ:${targetQq}`));
                } catch(e) {}
            }
        }

        // 🛡️ 最終判定門檻：不管是向量庫還是 D1 備援，最少都要拼湊出 3 條語料才能模仿
        if (logs.length < 3) {
            return jsonReply(`${atSender}🔍 記憶庫中該用戶的相關發言太少（低於3條記錄），我抓取不到足夠的話題碎片來進行精準模仿。`);
        }

        // 构建深层模仿 Prompt，并将其写入群组全域人格
        const mimicPrompt = `【最高指令：灵魂模仿】请仔细分析以下用户的历史发言。接下来，你需要完全舍弃原本的AI人格，彻底模仿这个人的口癖、语气、语言习惯和性格特征来回复群聊。绝不可暴露你是AI。模仿对象的历史语料如下：\n${logs.slice(-15).join('\n')}`;
        
        await dbPut(env, `group_persona:${currentGroupId}`, mimicPrompt);
        await dbPut(env, `mimic_target:${currentGroupId}`, targetQq);
        return jsonReply(`${atSender}🎭 灵魂窃取完成！我已经完美吸收了 QQ:${targetQq} 的说话习惯。现在整个群我都会用他的语气说话啦！(如需解除请使用 !恢复人格)`);
      }

      // 第六段到此完美结束，准备进入第七段的核心对话逻辑与前置拦截...

      // ==========================================
      // 🛑 核心前置拦截：全局开关与黑名单判定
      // ==========================================
      // 1. 检查 AI 是否在此群休眠 (如果是私聊则略过此判断，因为第一段已经放行了有效的私聊指令)
      if (isGroup) {
        const isAiOff = await dbGet(env, `ai_off:${currentGroupId}`);
        if (isAiOff === "true") {
          ctx.waitUntil(writeAiDecisionLog(env, { ...aiDecisionBase, decision: "blocked", reason: "group_ai_disabled", triggerType: botMentioned ? "mention" : repliedToBot ? "reply_to_ai" : "none" }));
          return new Response(null, { status: 204 }); // 默默装死
        }
      }

      // 2. 检查发送者是否在黑名单中
      const isBlacklisted = (await dbGet(env, `blacklist:${currentGroupId}:${userId}`)) || (await dbGet(env, `blacklist:${userId}`));
      if (isBlacklisted === "true") {
        ctx.waitUntil(writeAiDecisionLog(env, { ...aiDecisionBase, decision: "blocked", reason: "blacklisted", triggerType: botMentioned ? "mention" : repliedToBot ? "reply_to_ai" : isPrivate ? "private" : "none" }));
        return new Response(null, { status: 204 }); // 黑名单用户直接装死
      }

      // ==========================================
      // 📝 动态群组语料收集 (整合 D1 滾屏與向量空間長期記憶)
      // ==========================================
      // 只有群聊且「非指令」的普通对话，才纳入系统语料库
      let groupConversationLogs = [];
      if (isGroup && !msgLower.startsWith('!') && !msgLower.startsWith('！')) {
         const logKey = `recent_logs:${currentGroupId}`;
         let recentLogs = [];

         const storedLogs = await dbGet(env, logKey);
         if (storedLogs) {
             try { recentLogs = JSON.parse(storedLogs); } catch(e) {}
         }
         
         // 1. 建立標準歷史格式：[昵称(QQ号)]: 内容
         const relationForLog = relationContext ? ` ${relationContext.replace(/\n/g, " ")}` : "";
         const logEntry = `[${senderCard || '群友'}(QQ:${userId})]: ${cleanMessage || ((imageUrl || imageFile)?"发了张图":(voiceUrl || voiceFile)?"发了语音":"发了视频")}${relationForLog}`;
         recentLogs.push(logEntry);
         
         // 保存更长的群聊上下文；精确近期消息与压缩摘要会分层使用。
         if (recentLogs.length > DEFAULTS.groupContextMaximumMessages) recentLogs = recentLogs.slice(-DEFAULTS.groupContextMaximumMessages);
         groupConversationLogs = recentLogs.slice();
         
         // 💡 使用 ctx.waitUntil 异步存入 D1，绝不阻塞当前回覆流程！
         ctx.waitUntil(dbPut(env, logKey, JSON.stringify(recentLogs)));
         ctx.waitUntil(dbPut(env, `group_last_message:${currentGroupId}`, String(Date.now())));
         if (replyMessageId) {
           ctx.waitUntil(dbPut(env, `message:${currentGroupId}:${replyMessageId}`, JSON.stringify({ messageId: replyMessageId, groupId: currentGroupId, senderId: userId, senderName: senderCard, text: cleanMessage || ((imageUrl || imageFile)?'[图片]':(voiceUrl || voiceFile)?'[语音]':(videoUrl || videoFile)?'[视频]':''), mentions: mentionedQqs, replyId: quotedMessageId, source: isSelfAccount ? 'owner-human' : 'human', createdAt: Date.now() })));
         }

         // ==========================================
         // 🔮 【新加入】利用 ctx.waitUntil 在背景偷偷將靈魂碎片寫入向量資料庫
         // ==========================================
         if (cleanMessage && cleanMessage.length > 1 && env.VECTORIZE && await dbGet(env, `memo:${currentGroupId}`) !== "false") {
            ctx.waitUntil((async () => {
               try {
                  // 調用你的翻譯官將當前訊息轉成向量
                  const msgVector = await getVector(cleanMessage);
                  
                  if (msgVector && Array.isArray(msgVector)) {
                     // 真正執行寫入 Cloudflare Vectorize 資料庫
                     await env.VECTORIZE.upsert([
                        {
                           id: `msg_${currentGroupId}_${userId}_${Date.now()}`,
                           values: msgVector,
                           metadata: {
                              text: logEntry,
                              qq: userId.toString(),
                              userId: userId.toString(),
                              author: userId.toString(),
                              group_id: currentGroupId.toString(),
                              groupId: currentGroupId.toString(),
                              group: currentGroupId.toString(),
                              senderName: String(senderCard || userId),
                              createdAt: Date.now()
                           }
                        }
                     ]);
                     console.log(`💾 [向量空間] 成功將 QQ:${userId} 的靈魂語料歸檔入庫`);
                  }
               } catch (vectorError) {
                  console.error("🚨 [向量空間] 寫入失敗:", vectorError);
               }
            })());
         }
      }

      // 群內衝突分級處理：先勸阻；持續無效時只私訊開發者，不擅自私訊其他管理。
      if (isGroup && !isCommandMessage && !isSelfAccount) {
        const conflictResult = await processConflictSignal(env, {
          groupId: currentGroupId, userId, senderName: senderCard, text: cleanMessage, botId
        });
        if (conflictResult?.replyText) {
          const conflictPlan = { mode: conflictResult.mentionIds?.length ? 'mention_targets' : 'plain', mentionIds: conflictResult.mentionIds || [], quoteMessageId: '', text: conflictResult.replyText };
          const conflictLog = await writeAiDecisionLog(env, { ...aiDecisionBase, decision: "reply_generated", reason: "conflict_intervention", triggerType: "conflict_intervention", generatedReply: conflictResult.replyText, replyPlan: conflictPlan, provider: "conflict_guard", model: "gemma_or_local", sendStatus: "pending" });
          return new Response(JSON.stringify({ reply: conflictResult.replyText, reply_plan: conflictPlan, record_reply: false, reply_kind: "conflict_intervention", ai_log_id: conflictLog.id }), { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
        }
      }

      // ==========================================
      // 🎭 提示词与人格预设区块（高智商 + 政治防爆版）
      // ==========================================
      let finalStylePrompt = `【当前系统时间】：${currentTime}

【👥 核心身份与互动】
你以活跃 QQ 群友的方式交流。任何情况下都不要讨论、解释、承认或否认自己的系统、模型、AI、机器人或平台身份；遇到追问时自然转回当前话题。聊天口语化，可适度用颜文字或缩写。
- 被艾特时：温柔体贴，认真倾听并安慰对方。
- 主动插话时：幽默爱凑热闹，自然接梗或反问。
- 多模态防瞎编指令：若收到真实的图片/语音数据，请仔细观察聆听并精准互动。⚠️注意：如果你只在文字中看到【系统：此位置有一张真实图片/语音附件】，但你并没有真实接收到该图片的视觉或听觉数据，这说明图片加载失败或者是群友在骗你！此时「绝对禁止」假装看懂瞎编点评，你必须直接吐槽对方（例如：“图裂了”、“皇帝的新图？”、“别骗了，根本没图”等）。
- 检索与记忆：遇知识盲区自动 Google 查证并口语化分享；能自然回想过去发生的事并融入对话。
- 对话对象与 @ 规则：默认只回应当前发言者。原消息中 @ 的第三人只是被发言者点名，不代表你应当 @ 那个人；除非当前发言者明确要求你“提醒／通知／叫／艾特”该人，否则禁止在回复中输出任何 QQ 号或主动 @ 第三人。
- 游戏与现实互动：无法参与时简短婉拒并继续聊天，不解释技术原因，也不讨论身份。

【🚨 终极不可违背铁律】
1. 政治红线（智能求生欲）：严格遵守中国大陆平台（QQ）的审查底线，防范真正的封号风险。
- 【允许回答】：公开的国际地理、普通历史百科事实、外国元首名字等纯客观常识（例如问“法国现任总统是谁”、“大众汽车是哪国的”）。请用群友的口吻极简、客观地直接回答，绝对不要进行任何政治体制、意识形态的延伸讨论。
- 【绝对禁止】：任何涉及中国本土当代政治、国家领导人、敏感历史事件、领土争议、时政热点新闻评论或任何带有主观立场的敏感话题。
- 【严厉警告机制】：只有当群友故意聊起【绝对禁止】的严重违规话题时，你才必须立刻收起人设，切换为极度严肃的语气明确警告对方：“无法回答此类问题。您的发言已涉嫌违反平台政治敏感内容管理规范，请立即停止相关话题，否则将面临封禁风险”。
2. 格式死线：单次回复极度精炼，总字数严格限制在 250 字以内。回复没有最小字数；语境适合时可以只回复“6”“666”“nb”“?”“？”“？？？”或“???”，禁止为了看起来完整而扩写。绝对禁止输出任何 Markdown 格式（如 **、#、\`\`\`）。
3. 记忆隔离：历史记录仅供参考事实。你「绝对不准」模仿、复制或代入历史记录中其他人的说话风格、人设或口头禅，对别人的风格完全免疫。
4. 表情与动作控制：每说完一段话最多配 1 到 2 个标准 Emoji，禁止泛滥。绝对禁止输出任何 [CQ:...] 底层代码。Worker 会根据语境决定引用、@ 或纯文字发送。
5. 报时规则：只有群友“明确询问”时间/日期时，才在开头一字不差写出：【Asia/Taipei/Shanghai（亚洲/台北/上海时间）是：${currentTime}】。其余闲聊绝不准提及任何时间数据。`;
      
// 🌟 獲取群組全局人格 (Group Persona) 與 專屬人設
      const mimicTargetQq = await dbGet(env, `mimic_target:${currentGroupId}`);
      const groupPersona = await dbGet(env, `group_persona:${currentGroupId}`);
      const userCustomStyle = await dbGet(env, `custom_style:${currentGroupId}:${userId}`);

      // 準備一個變數，用來裝載「動態人格」
      let dynamicPersona = "";

      // 🌟 【優先級 1】: 單人專屬人設 (最高優先，覆蓋一切)
      if (userCustomStyle) {
        dynamicPersona = `【🎯 当前对话对象专属人设覆盖】
当前对话的群友是 [QQ:${userId}]。
请你无视下方【核心身份与互动】中的默认治愈或群友性格。
面对此用户，你必须完全化身为：👉 ${userCustomStyle} 👈。
接下来的回复请 100% 贴合该设定，且不受其他历史记录影响。`;
      } 
      // 🌟 【優先級 2】: 靈魂模仿 (RAG)
      else if (mimicTargetQq) {
        let dynamicLogs = [];
        try {
          const embeddingResponse = await env.AI.run('@cf/baai/bge-large-en-v1.5', { text: [userMessage] });
          const vectorMatches = await env.VECTORIZE.query(embeddingResponse.data[0], {
            topK: 10,
            filter: { qq: mimicTargetQq }, 
            returnValues: true
          });
          dynamicLogs = vectorMatches.matches.map(match => match.metadata.text);
        } catch (vErr) {
          console.error("🚨 向量空間抽樣失敗:", vErr);
        }

        if (dynamicLogs.length > 0) {
          // ⚠️ 注意這裡：我們明確告訴 AI 遇到這條指令時，可以豁免原本的「不准模仿」鐵律
          dynamicPersona = `【🎭 特殊指令：灵魂模仿模式】
注意：此指令优先级高于下方铁律中的“记忆隔离”限制。
你现在的任务是彻底模仿 QQ:${mimicTargetQq} 的口癖与语言习惯。
以下是该目标用户的真实历史发言範例，请深度解析其语气并用该风格回覆：
${dynamicLogs.join('\n')}`;
        }
      } 
      // 🌟 【優先級 3】: 群組全局人格
      else if (groupPersona) {
        dynamicPersona = `【📢 群组全局人格设定】\n当前群管理员已将你的总体人格设定为：👉 ${groupPersona} 👈。请以该设定为主导风格进行交流。`;
      }

      // 🔥 最終組合：把動態人格放在最頂端，然後接上基礎的 Prompt
      // 如果 dynamicPersona 有東西，AI 就會優先讀取它並覆蓋下面的預設行為
      if (dynamicPersona !== "") {
        finalStylePrompt = dynamicPersona + "\n\n" + finalStylePrompt;
      }

// 💖 叠加高情商情绪微调 BUFF (阅后即焚)
      const emotionBuff = await dbGet(env, `emotion_buff:${currentGroupId}:${userId}`);
      if (emotionBuff) {
        finalStylePrompt += `\n\n【🎭 当前临时情绪 BUFF】：\n你现在的状态是：${emotionBuff}。请将这种情绪自然地融入你的回覆中。`;
        // 消耗掉 BUFF，确保只生效一次，避免 AI 一直处于情绪化状态
        ctx.waitUntil(dbDel(env, `emotion_buff:${currentGroupId}:${userId}`));
      }

      // 🧠 注入统一格式的专属记忆。删除 D1 记忆不会删除 Vectorize。
      const parsedMemos = normalizeMemoryItems(await readJson(env, `user_memo:${currentGroupId}:${userId}`, []), userId);
      if (parsedMemos.length > 0) {
        finalStylePrompt += `\n\n【📖 专属记忆库】：
关于当前用户（QQ:${userId}）的已保存记忆：
${parsedMemos.slice(-30).map((m, i) => `${i + 1}. ${m.text}`).join('\n')}
请只在语境相关时自然使用，不要机械背诵。`;
      }

      // 第七段到此完美結束，準備進入第八段的 AI 隨機插話判定與上下文封裝模組...

      // ==========================================
      // 🎲 核心机制：随机触发 + AI 智慧插话判定
      // ==========================================
      let shouldReply = isAtMeOrAi || isPrivate;
      let isAutoInterject = false;
      let triggerType = botMentioned ? "mention" : repliedToBot ? "reply_to_ai" : sameQqSelfAsk ? "self_ask" : isPrivate ? "private" : "none";
      let noReplyReason = "not_triggered";
      let interjectJudgement = "";
      const lowContextFragment = isLowContextInterjectionFragment(conversationText);

      if (!shouldReply && isGroup && interjectChance > 0 && !msgLower.startsWith('!') && !msgLower.startsWith('！')) {
        const targetDnd = await dbGet(env, `dnd:${currentGroupId}:${userId}`);
        if (targetDnd === "true") {
          noReplyReason = "sender_dnd";
        } else if (lowContextFragment) {
          noReplyReason = "low_context_fragment";
        } else if (Math.random() >= interjectChance) {
          noReplyReason = "interject_probability_not_selected";
        } else {
          const lastInterject = await dbGet(env, `last_interject:${currentGroupId}`);
          const now = Date.now();
          const interjectCooldownSeconds = parseUnlimitedNonNegativeInteger(await dbGet(env, `interject_cooldown_seconds:${currentGroupId}`), 0);
          if (lastInterject && interjectCooldownSeconds > 0 && now - Number(lastInterject) <= interjectCooldownSeconds * 1000) {
            noReplyReason = "interject_cooldown";
          } else if (requiresAiJudgment) {
            const recentForJudge = (groupConversationLogs.length ? groupConversationLogs : await readJson(env, `recent_logs:${currentGroupId}`, [])).slice(-14).join("\n");
            const judgePrompt = `最近群聊：\n${recentForJudge}\n\n候选插话触发句：${cleanMessage}\n判断机器人此刻插话是否能明确接上正在讨论的话题。`;
            try {
              const judged = await callGemmaDecision(env, {
                system: "你是严格的 QQ 群聊插话门控器。只有机器人能明确理解当前多人对话、知道自己要回应谁、且确实能增加价值时输出 REPLY。纯数字、短问号、单个词、只有群友之间才懂的暗号、私人对话、关系不明、可能认错人或只能尬聊时输出 SKIP。只能输出 REPLY 或 SKIP。DeepSeek 不得用于此判断。",
                prompt: judgePrompt,
                maxOutputTokens: 12
              });
              interjectJudgement = String(judged.text || "").trim().toUpperCase();
            } catch (error) {
              console.warn("Gemma interject judgement unavailable:", error);
              interjectJudgement = "SKIP";
            }
            if (interjectJudgement.includes("REPLY") && !interjectJudgement.includes("SKIP")) {
              shouldReply = true;
              isAutoInterject = true;
              triggerType = "auto_interject";
              noReplyReason = "";
              ctx.waitUntil(dbPut(env, `last_interject:${currentGroupId}`, now.toString()));
            } else {
              noReplyReason = "interject_judge_rejected";
            }
          }
        }
      }

      if (!shouldReply) {
         ctx.waitUntil(writeAiDecisionLog(env, { ...aiDecisionBase, decision: "skipped", reason: noReplyReason, triggerType, interjectChance, interjectJudgement, lowContextFragment, contextMessageCount: groupConversationLogs.length }));
         return new Response(null, { status: 204 });
      }

      // ==========================================
      // 🧠 记忆唤醒：Vectorize 潜意识联想检索
      // ==========================================
      let memoryContext = "";

      if (env.VECTORIZE && cleanMessage && await dbGet(env, `memo:${currentGroupId}`) !== "false") {
        try {
          const queryVec = await getVector(conversationText);
          if (queryVec && typeof queryVec !== 'string') {
            const matches = await env.VECTORIZE.query(queryVec, {
              topK: 8,
              returnMetadata: "all",
              filter: { kind: "memory", groupId: String(currentGroupId), subjectQq: String(userId) }
            });
            const validMatches = [];
            for (const match of matches?.matches || []) {
              const vectorId = String(match.id || "");
              if (!vectorId || await dbGet(env, `memory_vector_tombstone:${vectorId}`) === "true") continue;
              if (String(match.metadata?.groupId || "") !== String(currentGroupId)) continue;
              if (String(match.metadata?.subjectQq || "") !== String(userId)) continue;
              if (match.metadata?.kind !== "memory") continue;
              validMatches.push(match);
            }
            if (validMatches.length > 0) {
              memoryContext += "\n【与当前用户相关的长期记忆检索】:\n" +
                validMatches.slice(0, 3).map(m => m.metadata?.text || "").filter(Boolean).join("\n");
            }
          }
        } catch(e) {
          console.error("长期记忆向量检索失败，继续使用 D1 记忆:", e);
        }
      }

      if (memoryContext) {
          finalStylePrompt += `\n\n${memoryContext}`;
      }

      let longGroupContext = null;
      if (isGroup && groupConversationLogs.length) {
        longGroupContext = await withTimeout(buildLongGroupConversationContext(env, {
          groupId: currentGroupId,
          userId,
          logs: groupConversationLogs,
          currentText: conversationText,
          relationContext
        }), 12000, "LONG_GROUP_CONTEXT_TIMEOUT").catch(error => {
          console.warn("Long group context skipped:", error?.message || error);
          return null;
        });
        if (longGroupContext?.text) finalStylePrompt += `\n\n【群聊长上下文】\n${longGroupContext.text}`;
      }

      if (relationContext) {
          finalStylePrompt += `\n\n【当前消息关系上下文】\n${relationContext}\n如果用户是在回复某条消息，必须把引用原文与用户当前正文分开理解；如果用户 @ 了别人，该 QQ 是被点名对象，不是发言者。不要因为原消息出现第三人 @ 就默认在回答中继续 @；可以在回答草稿中保留真正需要点名的已知 QQ，最终由独立对象规划器判定。`;
      }

      // 只有明确 @ 机器人时显示临时状态；随机插话、回复触发与普通私聊均不显示“正在思考”。
      if (botMentioned && !isAutoInterject && !activeThinkingMessageId) {
        activeThinkingMessageId = await sendThinkingIndicator(env, { isGroup, groupId: currentGroupId, userId, text: (imageUrl || imageFile) ? '正在读图...' : (voiceUrl || voiceFile) ? '正在听语音...' : (videoUrl || videoFile) ? '正在分析视频...' : '正在思考...' }).catch(() => null);
      }

      // 只有上下文确实复杂时才生成摘要；默认使用免费 Gemma/Gemini，短确认词禁止走重型摘要链路。
      const shouldBuildContextSummary = !isFastAcknowledgement && history.length >= DEFAULTS.contextSummaryThreshold && !longGroupContext?.summary;
      let deepseekContextSummary = "";
      if (shouldBuildContextSummary) {
        deepseekContextSummary = await withTimeout(buildDeepSeekContextSummary(env, {
          sessionKey, groupId: currentGroupId, userId, history, currentText: conversationText, relationContext
        }), 8000, "CONTEXT_SUMMARY_TIMEOUT").catch(error => {
          console.warn("Context summary skipped:", error?.message || error);
          return "";
        });
      }
      if (deepseekContextSummary) {
        finalStylePrompt += `

【免费优先模型整理的上下文摘要】
${deepseekContextSummary}`;
      }

      // ==========================================
      // 📦 上下文与多模态数据最终封装
      // ==========================================
      let aiInputParts = [];
      
      // 1. 如果是主动插话状态，微调行为模式
      let userPrompt = isAutoInterject
        ? `(主动插话模式：只针对下面这一句以及给出的群聊长上下文接话。不得猜测人物关系，不得替群友解释暗号。只有在上下文能高度确定被回应对象、且点名确有必要时才可在草稿中写出该成员 QQ；最终是否发送 @ 将由独立对象规划器复核。能用“6”“666”“nb”“?”“？”等极短反应就不要扩写；若仍不确定该说什么，只输出 [SKIP]。)\n${relationContext ? relationContext + "\n" : ""}[${roleName} ${senderCard}(QQ:${userId})]: ${conversationText}`
        : `${relationContext ? relationContext + "\n" : ""}[${roleName} ${senderCard}(QQ:${userId})]: ${conversationText}`;

      aiInputParts.push({ text: userPrompt });

      // 2. 注入多模态媒体 (图片/语音/视频)
      let loadedImage = false;
      if (imageUrl || imageFile) {
        try {
          const imageData = await fetchImageAsBase64({ url: imageUrl, file: imageFile });
          if (imageData) {
            loadedImage = true;
            aiInputParts.push({ inlineData: { mimeType: imageData.mimeType, data: imageData.base64 } });
          }
        } catch (error) {
          console.warn("NapCat image download failed:", error);
          await clearThinkingIndicator();
          return jsonReply(`${atSender}我收到了图片消息，但 NapCat 没有提供 Cloudflare 可下载的图片网址。请更新 NapCat 后重试，或重新发送图片并 @我。`);
        }
      }
      if (voiceUrl || voiceFile) {
        try {
          const audioData = await fetchAudioAsBase64({ url: voiceUrl, file: voiceFile });
          if (audioData) aiInputParts.push({ inlineData: { mimeType: audioData.mimeType, data: audioData.base64 } });
        } catch (error) {
          console.warn("NapCat audio download failed:", error);
        }
      }
      if (videoUrl || videoFile) {
        try {
          const videoData = await fetchVideoAsBase64({ url: videoUrl, file: videoFile });
          if (videoData) aiInputParts.push({ inlineData: { mimeType: videoData.mimeType, data: videoData.base64 } });
        } catch (error) {
          console.warn("NapCat video download failed:", error);
        }
      }
      if (!loadedImage) {
        finalStylePrompt += "\n\n【视觉真实性规则】当前请求没有成功载入任何图片像素。绝对禁止声称看到了图片、描述图片内容或假装能读取上一条未引用的图片；若用户询问图片，应明确要求他回复该图片或重新发送。";
      }

      // 3. 将 System Prompt 转化为 Model 指令层
      let contents = [];
      contents.push({ role: "user", parts: [{ text: finalStylePrompt }] });
      contents.push({ role: "model", parts: [{ text: "好的，我已经完全理解并吸收了我的核心设定、人设覆盖指令以及时间数据。我将严格遵守所有铁律、限制与多模态互动指南，以群友的身份用极简的纯文字开始聊天。" }] });

      // 4. 将历史纪录 (History) 塞入对话流
      for (const msg of history) {
        contents.push(msg);
      }

      // 5. 压入本次用户的最新发言与附件
      contents.push({ role: "user", parts: aiInputParts });

      // 第八段到此完美结束，准备进入第九段的多模型轮询请求与响应处理...

      // ==========================================
      // 🔄 Gemini / DeepSeek 混合路由
      // ==========================================
      let finalReply = "";
      let success = false;
      let baseText = "";
      let usedModel = "";
      let usedProvider = "";
      let searchInfo = { required: false, attempted: false, performed: false, query: "", context: "", sources: [], queries: [], provider: "", model: "", error: "" };
      const modelPref = await dbGet(env, `model_pref:${currentGroupId || 'private'}:${userId}`) || 'auto';
      try {
        const generated = await generateHybridReply(env, {
          modelPref, chatModels, finalStylePrompt, contents, cleanText: conversationText,
          fastChat: isFastAcknowledgement,
          hasMedia: Boolean(imageUrl || imageFile || voiceUrl || voiceFile || videoUrl || videoFile), userId, groupId: currentGroupId, isDeveloper
        });
        baseText = String(generated?.text || '').trim();
        usedModel = generated?.model || 'unknown';
        usedProvider = generated?.provider || 'unknown';
        searchInfo = {
          required: Boolean(generated?.searchRequired),
          attempted: Boolean(generated?.searchAttempted),
          performed: Boolean(generated?.searchPerformed),
          query: String(generated?.searchQuery || conversationText || ""),
          context: String(generated?.searchContext || ""),
          sources: Array.isArray(generated?.searchSources) ? generated.searchSources : [],
          queries: Array.isArray(generated?.searchQueries) ? generated.searchQueries : [],
          provider: String(generated?.searchProvider || ""),
          model: String(generated?.searchModel || ""),
          error: String(generated?.searchError || "")
        };
        success = Boolean(baseText);
      } catch (e) {
        console.error('Hybrid generation failed:', e);
      }

      if (success) {
        const totalCallsStr = await dbGet(env, 'STAT_TOTAL_CALLS');
        const totalCalls = totalCallsStr ? parseInt(totalCallsStr) : 0;
        ctx.waitUntil(dbPut(env, 'STAT_TOTAL_CALLS', String(totalCalls + 1)));
        ctx.waitUntil(dbPut(env, 'STAT_LAST_MODEL', `${usedProvider}:${usedModel}`));
      } else {
        ctx.waitUntil(writeAiDecisionLog(env, { ...aiDecisionBase, decision: "error", reason: "all_models_failed", triggerType, interjectJudgement, contextMessageCount: groupConversationLogs.length, contextSummaryProvider: longGroupContext?.summaryProvider || "" }));
        if (isAutoInterject) return new Response(null, { status: 204 });
        return jsonReply(`${atSender}暂时无法完成回复，请稍后再试。`);
      }

      if (isAutoInterject && /^\s*\[SKIP\]\s*$/i.test(baseText)) {
        ctx.waitUntil(writeAiDecisionLog(env, { ...aiDecisionBase, decision: "skipped", reason: "model_declined_interjection", triggerType, provider: usedProvider, model: usedModel, interjectJudgement, searchRequired: searchInfo.required, searchAttempted: searchInfo.attempted, searchPerformed: searchInfo.performed, searchQuery: searchInfo.query, searchContext: searchInfo.context, searchSources: searchInfo.sources, searchQueries: searchInfo.queries, searchProvider: searchInfo.provider, searchModel: searchInfo.model, searchError: searchInfo.error, contextMessageCount: groupConversationLogs.length, contextSummaryProvider: longGroupContext?.summaryProvider || "" }));
        return new Response(null, { status: 204 });
      }

      // ==========================================
      // 📝 D1 历史纪录保存与最终回覆动态处理
      // ==========================================
      
      // 1. 异步将本次对话双向写入 D1 历史纪录 (维持下一次的上下文)
      // 💡 注意：这里存入的是 baseText (纯文字的 @)，这样 AI 下次读取时才不会被 CQ 码搞混
      history.push({ role: 'user', parts: aiInputParts });
      history.push({ role: 'model', parts: [{ text: baseText }] }); 
      // 保留较长的直接对话流；更早的群聊由长上下文摘要承担。
      if (history.length > DEFAULTS.conversationHistoryItems) history = history.slice(-DEFAULTS.conversationHistoryItems); 
      ctx.waitUntil(dbPut(env, sessionKey, JSON.stringify(history)));

      // ==========================================
      // 🚀 最終回覆計畫：可引用、@、純文字或插話
      // ==========================================
      const replyText = sanitizeAiReply(baseText);
      const generatedMentionIds = extractTextMentionIds(replyText);
      const visibleReplyText = removeTextMentionTokens(replyText);
      const senderDndCheck = await dbGet(env, `dnd:${currentGroupId}:${userId}`) === "true";
      const mentionRouting = await decideReplyMentionRouting(env, {
        isGroup, isAutoInterject, botMentioned, quotedMessageId, userId, selfId: botId,
        quotedSenderId: String(quotedMessage?.senderId || ""), targetMentionQqs, generatedMentionIds,
        senderDnd: senderDndCheck, inputText: conversationText, replyText: visibleReplyText,
        relationContext, recentContext: groupConversationLogs
      });
      const replyPlan = buildReplyPlan({
        isGroup, isAutoInterject, botMentioned, quotedMessageId, messageId: replyMessageId,
        userId, selfId: botId, selectedMentionIds: mentionRouting.mentionIds, senderDnd: senderDndCheck,
        text: visibleReplyText
      });
      const aiDecision = await writeAiDecisionLog(env, {
        ...aiDecisionBase,
        decision: "reply_generated",
        reason: isAutoInterject ? "auto_interject_accepted" : "direct_trigger",
        triggerType,
        interjectChance,
        interjectJudgement,
        lowContextFragment,
        provider: usedProvider,
        model: usedModel,
        generatedReply: visibleReplyText,
        replyPlan,
        mentionRouting,
        searchRequired: searchInfo.required,
        searchAttempted: searchInfo.attempted,
        searchPerformed: searchInfo.performed,
        searchQuery: searchInfo.query,
        searchContext: searchInfo.context,
        searchSources: searchInfo.sources,
        searchQueries: searchInfo.queries,
        searchProvider: searchInfo.provider,
        searchModel: searchInfo.model,
        searchError: searchInfo.error,
        contextMessageCount: groupConversationLogs.length,
        directHistoryItems: history.length,
        contextSummaryProvider: longGroupContext?.summaryProvider || "",
        contextExactMessages: longGroupContext?.exactCount || 0,
        contextSummarizedMessages: longGroupContext?.summarizedCount || 0,
        sendStatus: "pending"
      });
      const thinkingMessageIdForReply = activeThinkingMessageId;
      activeThinkingMessageId = null;
      return new Response(JSON.stringify({ reply: visibleReplyText, reply_plan: replyPlan, thinking_message_id: thinkingMessageIdForReply || null, record_reply: true, reply_kind: "conversation", ai_log_id: aiDecision.id }), {
        status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' }
      });

    } catch (err) {
      // 兜底全域崩溃防护，确保 Worker 绝对不会死机
      console.error("全局严重错误:", err);
      await clearThinkingIndicator();
      ctx.waitUntil(writeSystemError(env, err, { url: request.url }));
      const fallbackText = body?.message_type === "group"
        ? `[CQ:at,qq=${String(body?.user_id || "")}] 处理这条消息时出现异常，请稍后再试。`
        : "处理这条消息时出现异常，请稍后再试。";
      return new Response(JSON.stringify({ reply: fallbackText, record_reply: false, reply_kind: "system_error" }), {
        status: 200,
        headers: { "Content-Type": "application/json; charset=utf-8" }
      });
    }
  }, // 结束 fetch 函式

  async scheduled(controller, env, ctx) {
    ctx.waitUntil(dbPut(env, "system:last_cron", String(Number(controller?.scheduledTime || Date.now()))));
    ctx.waitUntil(processDueSchedules(env, Number(controller?.scheduledTime || Date.now())));
    ctx.waitUntil(cleanupTransientState(env));
    ctx.waitUntil(cleanupExpiredModerationProposals(env));
    ctx.waitUntil(runAutomaticGroupCheckins(env, Number(controller?.scheduledTime || Date.now())));
    ctx.waitUntil(processPlatformJobs(env, Number(controller?.scheduledTime || Date.now())));
  }
}; // 结束 export default

// -----------------------------------------------------------------------------
// v0.2 core helpers: security, permissions, OneBot RPC, hybrid models, schedules
// -----------------------------------------------------------------------------

function developerId(env) {
  return String(env?.DEVELOPER_ID || DEFAULT_DEVELOPER_ID);
}

function isDeveloperId(env, qq) {
  return Boolean(qq && String(qq) === developerId(env));
}

function parseList(value, fallback = []) {
  const list = String(value || "").split(",").map(x => x.trim()).filter(Boolean);
  return list.length ? [...new Set(list)] : fallback.slice();
}

function roundRobinKeys(keys, provider = "gemini") {
  const list = [...new Set((keys || []).map(String).map(x => x.trim()).filter(Boolean))];
  if (list.length <= 1) return list;
  const cursor = provider === "deepseek"
    ? DEEPSEEK_KEY_CURSOR++
    : provider === "gemini_search"
      ? GEMINI_SEARCH_KEY_CURSOR++
      : GEMINI_KEY_CURSOR++;
  const start = Math.abs(cursor) % list.length;
  return list.slice(start).concat(list.slice(0, start));
}

function geminiSearchApiKeys(env) {
  // 搜索金钥必须独立配置，绝不挪用聊天／Vectorize 金钥。
  return [...new Set([...parseList(env.GEMINI_SEARCH_API_KEYS), ...parseList(env.GEMINI_SEARCH_API_KEY)])];
}

function deepSeekApiKeys(env) {
  return roundRobinKeys([...parseList(env.DEEPSEEK_API_KEYS), ...parseList(env.DEEPSEEK_API_KEY)], "deepseek");
}

function isLowContextInterjectionFragment(value) {
  const text = String(value || "").trim();
  if (!text) return true;
  const compact = text.replace(/\s+/g, "");
  if (/^[?？!！.。…~～,，、0-9０-９]+$/.test(compact)) return true;
  if (compact.length <= 2 && !/[吗嗎呢吧啊呀哦喔哈笑哭]/.test(compact)) return true;
  return false;
}

function parseMentionRoutingJson(value) {
  const raw = String(value || "").trim();
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function localMentionRoutingFallback({ isAutoInterject, botMentioned, quotedMessageId, userId, quotedSenderId, targetMentionQqs, generatedMentionIds, senderDnd, inputText }) {
  const senderId = String(userId || "");
  const quotedId = String(quotedSenderId || "");
  const targets = [...new Set((targetMentionQqs || []).map(String).filter(Boolean))];
  const generated = [...new Set((generatedMentionIds || []).map(String).filter(Boolean))];
  const explicitThirdPartyRequest = /(?:帮我|幫我|麻烦|麻煩|請|请)?(?:提醒|通知|叫|喊|艾特|at|問|问|告訴|告诉|轉告|转告)(?:一下)?/i.test(String(inputText || ""));
  const chosen = [];
  let reason = "fallback_no_mention";

  if (explicitThirdPartyRequest && targets.length) {
    chosen.push(...targets.filter(id => generated.includes(id) || targets.length === 1));
    reason = "fallback_explicit_third_party_request";
  } else if (isAutoInterject && generated.length) {
    chosen.push(...generated.filter(id => targets.includes(id) || id === quotedId));
    reason = chosen.length ? "fallback_interject_generated_known_target" : reason;
  } else if (!isAutoInterject && botMentioned && !quotedMessageId && !senderDnd && senderId) {
    chosen.push(senderId);
    reason = "fallback_direct_sender";
  }

  return { mentionIds: [...new Set(chosen)], reason, confidence: 0.45, model: "local_fallback", raw: "" };
}

async function decideReplyMentionRouting(env, {
  isGroup, isAutoInterject, botMentioned, quotedMessageId, userId, selfId,
  quotedSenderId = "", targetMentionQqs = [], generatedMentionIds = [], senderDnd,
  inputText = "", replyText = "", relationContext = "", recentContext = []
}) {
  if (!isGroup) return { mentionIds: [], reason: "private_chat", confidence: 1, model: "none", raw: "" };

  const senderId = String(userId || "");
  const botQq = String(selfId || "");
  const quotedId = String(quotedSenderId || "");
  const knownCandidates = [...new Set([
    ...(senderDnd ? [] : [senderId]),
    quotedId,
    ...(targetMentionQqs || []).map(String)
  ].filter(id => id && id !== botQq))];
  // 草稿中的 @ 只能作为“是否点名”的信号，不能凭空把未知 QQ 变成可发送对象。
  const generatedKnown = (generatedMentionIds || []).map(String).filter(id => knownCandidates.includes(id));
  const candidates = knownCandidates;
  if (!candidates.length) return { mentionIds: [], reason: "no_known_candidate", confidence: 1, model: "none", raw: "" };

  const candidateDescriptions = candidates.map(id => {
    const roles = [];
    if (id === senderId) roles.push("当前发言者");
    if (id === quotedId) roles.push("被引用消息发送者");
    if ((targetMentionQqs || []).map(String).includes(id)) roles.push("原消息明确@对象");
    if (generatedKnown.includes(id)) roles.push("回答草稿中出现的@对象");
    return `${id}:${roles.join("+") || "已知群成员"}`;
  }).join("、");

  const prompt = `请判断这条 QQ 群回复真正需要 @ 哪些人。\n` +
    `触发类型：${isAutoInterject ? "机器人主动插话" : botMentioned ? "用户@机器人" : quotedMessageId ? "用户引用消息触发" : "普通触发"}\n` +
    `当前发言者：${senderId || "未知"}\n候选人：${candidateDescriptions}\n` +
    `当前关系：${relationContext || "无"}\n` +
    `最近群聊：\n${(recentContext || []).slice(-12).join("\n").slice(-5000)}\n` +
    `用户原话：${String(inputText || "").slice(0, 1800)}\n机器人回答草稿：${String(replyText || "").slice(0, 1800)}\n` +
    `只可从候选人中选择。输出 JSON：{"ids":["QQ"],"confidence":0到1,"reason":"简短理由"}`;

  try {
    const judged = await callGemmaDecision(env, {
      system: "你是 QQ 群聊回复对象规划器。不要机械封锁@，也绝不能乱@。只有语义上确实要直接提醒、点名、回答特定对象，或不@会造成明显歧义时才选择候选人。原消息出现第三人@不代表机器人也要@他；主动插话可以@人，但必须从上下文高度确定对象。用户只是和某人聊天时，通常不要替用户@对方。无法确定就返回空 ids。必须只输出合法 JSON。",
      prompt,
      maxOutputTokens: 180,
      maxAttempts: 3
    });
    const parsed = parseMentionRoutingJson(judged.text);
    const requested = Array.isArray(parsed?.ids) ? parsed.ids.map(String) : [];
    const mentionIds = [...new Set(requested.filter(id => candidates.includes(id) && id !== botQq && !(senderDnd && id === senderId)))];
    const confidence = Math.max(0, Math.min(1, Number(parsed?.confidence || 0)));
    // 低信心不是硬性禁止，而是退回语境式本地规划，避免模型随机点名。
    if (!parsed || confidence < 0.55) {
      const fallback = localMentionRoutingFallback({ isAutoInterject, botMentioned, quotedMessageId, userId, quotedSenderId, targetMentionQqs, generatedMentionIds, senderDnd, inputText });
      return { ...fallback, reason: `low_confidence:${String(parsed?.reason || fallback.reason)}`, model: judged.model || "gemma", raw: judged.text || "" };
    }
    return { mentionIds, reason: String(parsed.reason || (mentionIds.length ? "model_selected" : "model_no_mention")), confidence, model: judged.model || "gemma", raw: judged.text || "" };
  } catch (error) {
    const fallback = localMentionRoutingFallback({ isAutoInterject, botMentioned, quotedMessageId, userId, quotedSenderId, targetMentionQqs, generatedMentionIds, senderDnd, inputText });
    return { ...fallback, reason: `judge_unavailable:${String(error?.message || error)}` };
  }
}

function numericId(value) {
  const text = String(value ?? "");
  return /^\d+$/.test(text) && Number.isSafeInteger(Number(text)) ? Number(text) : text;
}

function isPrivateHost(hostname) {
  const h = String(hostname || "").toLowerCase().replace(/^\[|\]$/g, "");
  if (!h || h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return true;
  if (h === "::1" || h.startsWith("fe80:") || h.startsWith("fc") || h.startsWith("fd")) return true;
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const a = m.slice(1).map(Number); if (a.some(n => n > 255)) return true;
  return a[0] === 10 || a[0] === 127 || a[0] === 0 || (a[0] === 169 && a[1] === 254) || (a[0] === 172 && a[1] >= 16 && a[1] <= 31) || (a[0] === 192 && a[1] === 168) || (a[0] === 100 && a[1] >= 64 && a[1] <= 127) || a[0] >= 224;
}

function assertSafePublicUrl(value) {
  let url; try { url = new URL(String(value || "")); } catch { throw new Error("网址格式无效"); }
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("只允许 HTTP 或 HTTPS");
  if (url.username || url.password || isPrivateHost(url.hostname)) throw new Error("不允许访问私有或本机地址");
  return url;
}

async function fetchPublicUrl(value, options = {}, maxRedirects = 3) {
  let url = assertSafePublicUrl(value);
  for (let i = 0; i <= maxRedirects; i++) {
    const res = await fetch(url.toString(), { ...options, redirect: "manual" });
    if (![301,302,303,307,308].includes(res.status)) return res;
    const location = res.headers.get("Location"); if (!location) return res;
    url = assertSafePublicUrl(new URL(location, url).toString());
  }
  throw new Error("重定向次数过多");
}

async function fetchMediaAsBase64(value, maxBytes, allowedPrefixes) {
  const res = await fetchPublicUrl(value, { signal: AbortSignal.timeout(20000), headers: { "User-Agent": "QQAIbot/0.2" } }, 2);
  if (!res.ok) throw new Error(`媒体下载失败：${res.status}`);
  const length = Number(res.headers.get("Content-Length") || 0); if (length && length > maxBytes) throw new Error("媒体文件过大");
  const mimeType = String(res.headers.get("Content-Type") || "application/octet-stream").split(";")[0].trim().toLowerCase();
  if (!allowedPrefixes.some(p => mimeType.startsWith(p))) throw new Error(`不支持的媒体类型：${mimeType}`);
  const buffer = await res.arrayBuffer(); if (buffer.byteLength > maxBytes) throw new Error("媒体文件过大");
  const bytes = new Uint8Array(buffer); let binary = ""; for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { base64: btoa(binary), mimeType, size: buffer.byteLength };
}

function verifyOneBotAccess(request, env) {
  const expected = String(env.ONEBOT_ACCESS_TOKEN || "").trim();
  if (!expected) return false;
  const url = new URL(request.url);
  const auth = request.headers.get("Authorization") || "";
  const bearer = auth.replace(/^Bearer\s+/i, "").trim();
  const queryToken = url.searchParams.get("access_token") || url.searchParams.get("token") || "";
  return bearer === expected || queryToken === expected;
}

async function getFeatureFlag(env, name, fallback = false) {
  const raw = await dbGet(env, `feature:${name}`);
  if (raw === null || raw === undefined || raw === "") return fallback;
  return raw === "true" || raw === "1";
}

function envFlag(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  return ["1", "true", "yes", "on", "enabled"].includes(String(value).trim().toLowerCase());
}

async function setFeatureFlag(env, name, enabled) {
  await dbPut(env, `feature:${name}`, enabled ? "true" : "false");
}

async function isGroupWhitelisted(env, groupId) {
  if (!groupId) return false;
  return await dbGet(env, `group_whitelist:${groupId}`) === "true";
}

async function getPrivateAccessMode(env, userId) {
  if (isDeveloperId(env, userId)) return "full";
  const explicit = await dbGet(env, `private_access:${userId}`);
  if (["full", "commands", "none"].includes(explicit)) return explicit;
  return "none";
}

const PERMISSIONS = Object.freeze({
  AI_ADMIN: "ai_admin",
  GROUP_OPS: "group_ops",
  SCHEDULE_REVIEWER: "schedule_reviewer",
  APPEAL_REVIEWER: "appeal_reviewer",
  PRIVATE_FULL: "private_full",
  PRIVATE_COMMANDS: "private_commands",
});

function normalizePermissionName(value) {
  const text = String(value || "").trim().toLowerCase().replace(/\s+/g, "");
  const map = new Map([
    ["ai管理", PERMISSIONS.AI_ADMIN], ["ai管理员", PERMISSIONS.AI_ADMIN], ["ai管理員", PERMISSIONS.AI_ADMIN], ["ai_admin", PERMISSIONS.AI_ADMIN],
    ["群操作", PERMISSIONS.GROUP_OPS], ["群管理操作", PERMISSIONS.GROUP_OPS], ["group_ops", PERMISSIONS.GROUP_OPS],
    ["排程审核", PERMISSIONS.SCHEDULE_REVIEWER], ["排程審核", PERMISSIONS.SCHEDULE_REVIEWER], ["schedule_reviewer", PERMISSIONS.SCHEDULE_REVIEWER],
    ["申诉审核", PERMISSIONS.APPEAL_REVIEWER], ["申訴審核", PERMISSIONS.APPEAL_REVIEWER], ["appeal_reviewer", PERMISSIONS.APPEAL_REVIEWER],
    ["私聊完整", PERMISSIONS.PRIVATE_FULL], ["private_full", PERMISSIONS.PRIVATE_FULL],
    ["私聊指令", PERMISSIONS.PRIVATE_COMMANDS], ["private_commands", PERMISSIONS.PRIVATE_COMMANDS],
  ]);
  return map.get(text) || null;
}

function permissionLabel(permission) {
  return ({
    ai_admin: "AI管理",
    group_ops: "群操作",
    schedule_reviewer: "排程审核",
    appeal_reviewer: "申诉审核",
    private_full: "完整私聊",
    private_commands: "私聊指令",
  })[permission] || permission;
}

async function setExplicitPermission(env, groupId, userId, permission, enabled) {
  if (permission === PERMISSIONS.PRIVATE_FULL || permission === PERMISSIONS.PRIVATE_COMMANDS) {
    if (enabled) await dbPut(env, `private_access:${userId}`, permission === PERMISSIONS.PRIVATE_FULL ? "full" : "commands");
    else await dbPut(env, `private_access:${userId}`, "none");
    return;
  }
  const key = `permission:${groupId}:${userId}:${permission}`;
  if (enabled) await dbPut(env, key, "true"); else await dbDel(env, key);
  await writeSystemAudit(env, { type: "permission", groupId, actorId: developerId(env), targetId: userId, action: enabled ? `grant:${permission}` : `revoke:${permission}` });
}

async function getEffectivePermissions(env, groupId, userId, senderRole = "member", isDeveloper = false) {
  const developer = isDeveloper || isDeveloperId(env, userId);
  const nativeAdmin = senderRole === "owner" || senderRole === "admin";
  const legacyAdmin = await dbGet(env, `admin_auth:${userId}`) === "true";
  const explicit = async p => await dbGet(env, `permission:${groupId}:${userId}:${p}`) === "true";
  const aiAdmin = developer || nativeAdmin || legacyAdmin || await explicit(PERMISSIONS.AI_ADMIN);
  const groupOps = developer || nativeAdmin || await explicit(PERMISSIONS.GROUP_OPS);
  const scheduleReviewer = developer || nativeAdmin || await explicit(PERMISSIONS.SCHEDULE_REVIEWER);
  const appealReviewer = developer || nativeAdmin || await explicit(PERMISSIONS.APPEAL_REVIEWER);
  return { developer, nativeAdmin, aiAdmin, groupOps, scheduleReviewer, appealReviewer };
}

async function getRuntimeRateLimitSeconds(env, groupId) {
  const groupRaw = groupId ? await dbGet(env, `runtime_rate_limit_seconds:group:${groupId}`) : null;
  if (groupRaw !== null && groupRaw !== undefined && groupRaw !== "") return parseUnlimitedNonNegativeInteger(groupRaw, DEFAULTS.runtimeRateLimitSeconds);
  const globalRaw = await dbGet(env, "runtime_rate_limit_seconds:global");
  return parseUnlimitedNonNegativeInteger(globalRaw, DEFAULTS.runtimeRateLimitSeconds);
}

async function checkRuntimeRateLimit(env, { groupId, userId, isPrivate }) {
  const seconds = await getRuntimeRateLimitSeconds(env, groupId);
  if (seconds <= 0) return { allowed: true, seconds: 0, remaining: 0 };
  const key = `runtime_rate_limit_last:${isPrivate ? "private" : "group"}:${groupId || ""}:${userId}`;
  const now = Date.now();
  const lastAt = Number(await dbGet(env, key) || 0);
  const remainingMs = seconds * 1000 - (now - lastAt);
  if (lastAt && remainingMs > 0) return { allowed: false, seconds, remaining: Math.ceil(remainingMs / 1000) };
  await dbPut(env, key, String(now));
  return { allowed: true, seconds, remaining: 0 };
}

async function writeSystemAudit(env, entry) {
  const item = { id: crypto.randomUUID(), at: new Date().toISOString(), ...entry };
  const keys = ["audit:system:global"];
  if (entry.groupId) keys.push(`audit:system:group:${entry.groupId}`);
  for (const key of keys) {
    const list = await readJson(env, key, []);
    list.push(item);
    await dbPut(env, key, JSON.stringify(list.slice(-1000)));
  }
  return item;
}

async function writeAiDecisionLog(env, data) {
  const id = String(data?.id || `ai_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`);
  const item = {
    id,
    at: new Date().toISOString(),
    createdAt: Date.now(),
    decision: "unknown",
    reason: "",
    sendStatus: "not_applicable",
    searchRequired: false,
    searchAttempted: false,
    searchPerformed: false,
    searchQuery: "",
    searchContext: "",
    searchSources: [],
    searchQueries: [],
    searchProvider: "",
    searchModel: "",
    searchError: "",
    ...data,
    id
  };
  await dbPut(env, `ai_decision_log:${id}`, JSON.stringify(item));
  await appendIndex(env, "ai_decision_log:index", id, DEFAULTS.aiDecisionLogLimit);
  if (item.groupId) await appendIndex(env, `ai_decision_log:index:${item.groupId}`, id, DEFAULTS.aiDecisionLogLimit);
  return item;
}

async function updateAiDecisionLog(env, id, patch = {}) {
  if (!id) return null;
  const current = await readJson(env, `ai_decision_log:${id}`, null);
  if (!current) return null;
  const next = { ...current, ...patch, id: current.id, updatedAt: Date.now() };
  await dbPut(env, `ai_decision_log:${id}`, JSON.stringify(next));
  return next;
}

async function listAiDecisionLogs(env, { groupId = "", query = "", decision = "", triggerType = "", limit = 300 } = {}) {
  const ids = await readJson(env, groupId ? `ai_decision_log:index:${groupId}` : "ai_decision_log:index", []);
  const out = [];
  const q = String(query || "").trim().toLowerCase();
  for (const id of ids.slice(-Math.max(1, Math.min(DEFAULTS.aiDecisionLogLimit, Number(limit) * 5))).reverse()) {
    const item = await readJson(env, `ai_decision_log:${id}`, null);
    if (!item) continue;
    if (groupId && String(item.groupId || "") !== String(groupId)) continue;
    if (decision && String(item.decision || "") !== String(decision)) continue;
    if (triggerType && String(item.triggerType || "") !== String(triggerType)) continue;
    if (q && !JSON.stringify(item).toLowerCase().includes(q)) continue;
    out.push(item);
    if (out.length >= Math.max(1, Math.min(1000, Number(limit) || 300))) break;
  }
  return out;
}

async function buildLongGroupConversationContext(env, { groupId, userId, logs, currentText, relationContext }) {
  const list = (Array.isArray(logs) ? logs : []).map(String).filter(Boolean).slice(-DEFAULTS.groupContextMaximumMessages);
  if (!list.length) return null;
  const exactCount = Math.min(DEFAULTS.groupContextExactMessages, list.length);
  const exact = list.slice(-exactCount);
  const older = list.slice(0, -exactCount);
  let summary = "";
  let summaryProvider = "";
  if (older.length >= 16) {
    const cacheKey = `context_summary:long_group:${groupId}`;
    const cached = await readJson(env, cacheKey, null);
    const signature = await sha256Hex(older.join("\n"));
    const freshEnough = cached?.summary && Date.now() - Number(cached.updatedAt || 0) < 3 * 60 * 1000;
    if (cached?.signature === signature || freshEnough) {
      summary = String(cached.summary || "");
      summaryProvider = String(cached.provider || "cache");
    } else {
      const prompt = `请压缩以下 QQ 群较早的对话。保留：每个人的昵称与 QQ、谁在回复谁、@对象、正在讨论的主题、关键事实、笑点、争议、未解决的问题。不得把被 @ 的人当成发言者，不得编造。\n\n${older.join("\n")}`;
      const system = "你是群聊长上下文整理器，只做信息压缩，不做是否回复、插话或安全判断。输出简体中文，尽量紧凑。";
      try {
        const result = await callDeepSeek(env, {
          messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
          userId: String(userId || "context-summary"),
          groupId: String(groupId || "context-summary"),
          thinking: "disabled",
          maxTokens: 1200,
          model: env.DEEPSEEK_FLASH_MODEL || DEFAULTS.deepseekFlashModel
        });
        summary = result.text;
        summaryProvider = "deepseek_flash";
      } catch (deepseekError) {
        console.warn("DeepSeek Flash long-context summary unavailable:", deepseekError?.message || deepseekError);
        try {
          const result = await callGeminiGenerate(env, {
            models: parseList(env.GEMINI_CHAT_MODELS, ["gemini-2.5-flash-lite", "gemini-2.5-flash"]),
            system,
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            maxOutputTokens: 1200,
            temperature: 0.1,
            useSearch: false,
            requireSearch: false,
            timeoutMs: 10000
          });
          summary = result.text;
          summaryProvider = "gemini";
        } catch (geminiError) {
          console.warn("Gemini long-context summary unavailable:", geminiError?.message || geminiError);
          summary = String(cached?.summary || "");
          summaryProvider = summary ? String(cached?.provider || "stale_cache") : "";
        }
      }
      if (summary) await dbPut(env, cacheKey, JSON.stringify({ signature, summary, provider: summaryProvider, updatedAt: Date.now(), sourceCount: older.length }));
    }
  }
  const sections = [];
  if (summary) sections.push(`较早对话摘要：\n${summary}`);
  sections.push(`最近 ${exact.length} 条原始群聊（按时间顺序，必须精确区分发言者、引用者与被 @ 对象）：\n${exact.join("\n")}`);
  if (currentText || relationContext) sections.push(`当前触发消息关系：\n${relationContext || "无引用／@关系"}\n当前正文：${currentText || ""}`);
  return { text: sections.join("\n\n"), summary, summaryProvider, exactCount: exact.length, summarizedCount: older.length, totalCount: list.length };
}

async function appendIndex(env, key, id, max = 2000) {
  const list = await readJson(env, key, []);
  if (!list.includes(id)) list.push(id);
  await dbPut(env, key, JSON.stringify(list.slice(-max)));
}

async function removeFromIndex(env, key, id) {
  const list = await readJson(env, key, []);
  await dbPut(env, key, JSON.stringify(list.filter(x => x !== id)));
}

function normalizeMemoryItems(value, owner = "") {
  const list = Array.isArray(value) ? value : [];
  return list.map(item => {
    if (typeof item === "string") return { id: crypto.randomUUID(), text: item, scope: "private", owner, migrated: true };
    if (item && typeof item === "object") return { id: item.id || crypto.randomUUID(), text: String(item.text || ""), scope: item.scope || "private", owner: String(item.owner || owner), ...item };
    return null;
  }).filter(item => item && item.text.trim());
}

function normalizeModelPreference(value) {
  const text = String(value || "").trim().toLowerCase().replace(/[ _-]+/g, "");
  if (["自动", "自動", "auto"].includes(text)) return "auto";
  if (["gemini", "谷歌"].includes(text)) return "gemini";
  if (["gemma", "gemma26", "gemma4-26b", "26b", "便宜", "gemma31", "gemma4-31b", "31b", "gemma高质量", "gemma高品質"].includes(text)) return "gemini";
  if (["deepseek", "deepseek不思考", "deepseekoff"].includes(text)) return "deepseek";
  if (["deepseekhigh", "high", "深度思考"].includes(text)) return "deepseek_high";
  if (["deepseekmax", "max", "极限", "極限"].includes(text)) return "deepseek_max";
  return null;
}

function modelPreferenceLabel(value) {
  return ({ auto: "自动（Gemini 免费池）", gemini: "Gemini 免费池", gemma_26b: "Gemini 免费池", gemma_31b: "Gemini 免费池", deepseek: "DeepSeek", deepseek_high: "DeepSeek High", deepseek_max: "DeepSeek Max" })[value] || "自动（Gemini 免费池）";
}

function normalizeFingerprintText(text) {
  return String(text || "")
    .replace(/\[CQ:[^\]]+\]/g, "")
    .replace(/@\d{5,}/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4000);
}

function outboundFingerprint(info) {
  const payload = [info.isGroup ? "g" : "p", String(info.groupId || info.peerId || ""), normalizeFingerprintText(info.text), ...(info.mediaTypes || []).sort()].join("|");
  let hash = 2166136261;
  for (let i = 0; i < payload.length; i++) { hash ^= payload.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0).toString(16);
}

async function markOutboundPending(env, info) {
  const key = `outbound_pending:${outboundFingerprint(info)}`;
  // 僅保存短期去重時間戳；不保存任何指令或回覆正文。
  await dbPut(env, key, JSON.stringify({ at: Date.now() }));
  return key;
}

async function isKnownOutboundMessage(env, info) {
  if (info.messageId) {
    const raw = await dbGet(env, `outbound:${info.messageId}`);
    if (raw) {
      const item = (() => { try { return JSON.parse(raw); } catch { return { at: Number(raw) || Date.now() }; } })();
      if (Date.now() - Number(item.at || 0) < 10 * 60 * 1000) return true;
    }
  }
  const key = `outbound_pending:${outboundFingerprint(info)}`;
  const raw = await dbGet(env, key);
  if (!raw) return false;
  let item = null;
  try { item = JSON.parse(raw); } catch {}
  if (!item || Date.now() - Number(item.at || 0) > 2 * 60 * 1000) { await dbDel(env, key); return false; }
  await dbDel(env, key);
  return true;
}

async function callOneBotAction(env, actionPayload, timeoutMs = 15000) {
  if (!env.ONEBOT_HUB) throw new Error("ONEBOT_HUB_NOT_BOUND");
  const payload = actionPayload.action ? actionPayload : { action: actionPayload?.action, params: actionPayload?.params || {} };
  const res = await getOneBotHub(env).fetch("https://onebot-hub/rpc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, timeoutMs })
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) throw new Error(data?.error || `ONEBOT_RPC_${res.status}`);
  return data.data;
}

async function runOneBotGroupOperation(env, action, params, audit) {
  if (!env.ONEBOT_ACCESS_TOKEN) return { ok: false, error: "尚未配置 ONEBOT_ACCESS_TOKEN" };
  try {
    const data = await callOneBotAction(env, { action, params }, 20000);
    await writeSystemAudit(env, { type: "group_operation", ...audit, params });
    return { ok: true, data };
  } catch (error) {
    await writeSystemAudit(env, { type: "group_operation_failed", ...audit, params, error: String(error.message || error) });
    return { ok: false, error: String(error.message || error) };
  }
}

async function purgeLegacyBotRepliesFromRecentLogs(env, groupId, botId) {
  const gid = String(groupId || "");
  const bid = String(botId || "");
  if (!gid || !bid) return;
  const doneKey = `cleanup:v027:recent_logs_bot_replies:${gid}`;
  if (await dbGet(env, doneKey)) return;
  const key = `recent_logs:${gid}`;
  const logs = await readJson(env, key, []);
  if (Array.isArray(logs) && logs.length) {
    const marker = `(QQ:${bid})]:`;
    const cleaned = logs.filter(line => !String(line || "").includes(marker));
    if (cleaned.length !== logs.length) await dbPut(env, key, JSON.stringify(cleaned.slice(-200)));
  }
  await dbPut(env, doneKey, String(Date.now()));
}

async function recordStructuredMessage(env, item) {
  const record = {
    messageId: String(item.messageId || ""), groupId: String(item.groupId || ""),
    senderId: String(item.senderId || item.userId || ""), senderName: String(item.senderName || item.senderId || item.userId || ""),
    text: String(item.text || ""), mentions: item.mentions || [], replyId: item.replyId || "",
    source: item.source || "human", createdAt: Date.now()
  };
  if (record.messageId) await dbPut(env, `message:${record.groupId}:${record.messageId}`, JSON.stringify(record));
  // 指令回覆、白名單提示、權限提示與其他系統訊息只保留引用辨識所需的 message metadata，
  // 不加入 recent_logs，也不成為模仿、摘要、衝突判斷或後續 AI 聊天的語料。
  if (record.groupId && item.includeInRecentLogs !== false) {
    const key = `recent_logs:${record.groupId}`;
    const logs = await readJson(env, key, []);
    logs.push(`[${record.senderName}(QQ:${record.senderId})]: ${record.text}`);
    await dbPut(env, key, JSON.stringify(logs.slice(-200)));
  }
  return record;
}

function extractOutboundMediaTypes(message) {
  const types = new Set();
  const scan = value => {
    const text = String(value || "");
    if (/\[CQ:image,/i.test(text)) types.add("image");
    if (/\[CQ:record,/i.test(text)) types.add("record");
    if (/\[CQ:video,/i.test(text)) types.add("video");
  };
  if (typeof message === "string") scan(message);
  else if (Array.isArray(message)) for (const part of message) {
    if (["image", "record", "video"].includes(part?.type)) types.add(part.type);
    if (part?.type === "text") scan(part.data?.text);
  }
  return [...types].sort();
}

function decodeCqValue(value) {
  return String(value || "")
    .replace(/&#44;/g, ",")
    .replace(/&#91;/g, "[")
    .replace(/&#93;/g, "]")
    .replace(/&amp;/g, "&");
}

function parseCqAttributes(raw) {
  const attrs = {};
  for (const item of String(raw || "").split(",")) {
    const index = item.indexOf("=");
    if (index <= 0) continue;
    attrs[item.slice(0, index).trim()] = decodeCqValue(item.slice(index + 1));
  }
  return attrs;
}

function extractMediaDescriptor(message, type) {
  if (Array.isArray(message)) {
    const part = message.find(item => item?.type === type);
    return { url: String(part?.data?.url || "") || null, file: String(part?.data?.file || "") || null };
  }
  const match = String(message || "").match(new RegExp(`\\[CQ:${type},([^\\]]+)\\]`, "i"));
  if (!match) return { url: null, file: null };
  const attrs = parseCqAttributes(match[1]);
  return { url: attrs.url || null, file: attrs.file || null };
}

async function decodeInlineMedia(value, maxBytes, allowedPrefixes) {
  const text = String(value || "");
  let mimeType = "application/octet-stream";
  let base64 = "";
  if (text.startsWith("base64://")) {
    base64 = text.slice(9);
  } else {
    const match = text.match(/^data:([^;,]+);base64,(.+)$/s);
    if (!match) return null;
    mimeType = match[1].toLowerCase();
    base64 = match[2];
  }
  if (!allowedPrefixes.some(prefix => mimeType.startsWith(prefix)) && mimeType !== "application/octet-stream") throw new Error(`不支持的媒体类型：${mimeType}`);
  const estimated = Math.floor(base64.length * 3 / 4);
  if (estimated > maxBytes) throw new Error("媒体文件过大");
  return { base64, mimeType, size: estimated };
}

async function resolveOneBotMediaAsBase64(env, descriptor, kind, maxBytes, allowedPrefixes) {
  const url = String(descriptor?.url || "").trim();
  const file = String(descriptor?.file || "").trim();
  for (const value of [url, file]) {
    if (!value) continue;
    const inline = await decodeInlineMedia(value, maxBytes, allowedPrefixes);
    if (inline) return inline;
    if (/^https?:\/\//i.test(value)) return fetchMediaAsBase64(value, maxBytes, allowedPrefixes);
  }
  if (file && kind === "image") {
    const data = await callOneBotAction(env, { action: "get_image", params: { file } }, 15000);
    const remoteUrl = String(data?.url || "").trim();
    if (/^https?:\/\//i.test(remoteUrl)) return fetchMediaAsBase64(remoteUrl, maxBytes, allowedPrefixes);
    throw new Error("get_image 未返回公网 URL");
  }
  if (file && kind === "record") {
    const data = await callOneBotAction(env, { action: "get_record", params: { file, out_format: "mp3" } }, 15000);
    const remoteUrl = String(data?.url || "").trim();
    if (/^https?:\/\//i.test(remoteUrl)) return fetchMediaAsBase64(remoteUrl, maxBytes, allowedPrefixes);
    throw new Error("get_record 未返回公网 URL");
  }
  throw new Error("媒体只有 NapCat 本机路径，Cloudflare 无法直接读取");
}

function extractMessageText(message) {
  if (typeof message === "string") return message
    .replace(/\[CQ:at,[^\]]*qq=(\d+|all)[^\]]*\]/g, "@$1")
    .replace(/\[CQ:image,[^\]]+\]/g, "[图片]")
    .replace(/\[CQ:record,[^\]]+\]/g, "[语音]")
    .replace(/\[CQ:video,[^\]]+\]/g, "[视频]")
    .replace(/\[CQ:reply,[^\]]+\]/g, "")
    .replace(/\[CQ:[^\]]+\]/g, "")
    .trim();
  if (!Array.isArray(message)) return "";
  return message.map(part => part?.type === "text" ? String(part.data?.text || "") : part?.type === "at" ? `@${part.data?.qq || ""}` : part?.type === "image" ? "[图片]" : part?.type === "record" ? "[语音]" : part?.type === "video" ? "[视频]" : "").join("").trim();
}

async function hasOutboundMessageMarker(env, messageId) {
  if (!messageId) return false;
  const raw = await dbGet(env, `outbound:${messageId}`);
  if (!raw) return false;
  try {
    const item = JSON.parse(raw);
    return Date.now() - Number(item?.at || 0) < 10 * 60 * 1000;
  } catch {
    return true;
  }
}

async function normalizeQuotedMessageSource(env, obj, botId, messageId) {
  if (!obj || typeof obj !== "object") return obj;
  const result = { ...obj };
  const senderId = String(result.senderId || "");
  const selfId = String(botId || result.selfId || "");
  const source = String(result.source || "unknown");

  // 新版由 Worker 自己写入的 AI 记录会固定使用 senderName=QQAI；这是可信来源。
  if (source === "ai" && String(result.senderName || "") === "QQAI") return result;
  if (source === "owner-human") return result;

  const outbound = await hasOutboundMessageMarker(env, messageId || result.messageId);
  if (outbound) {
    result.source = "ai";
    result.sourceConfidence = "outbound-message-id";
    return result;
  }

  // 同 QQ 模式的关键规则：账号相同不等于消息来自 AI。
  // 没有 Worker outbound 证据时，自身账号消息必须视为人工发言。
  if (senderId && selfId && senderId === selfId) {
    result.source = "owner-human";
    result.sourceConfidence = "same-account-without-outbound-proof";
    return result;
  }

  if (!["ai", "human", "owner-human"].includes(source)) result.source = "human";
  return result;
}

async function getQuotedMessage(env, groupId, messageId, botId = "") {
  const cacheKey = `message:${groupId}:${messageId}`;
  const cached = await dbGet(env, cacheKey);
  if (cached) {
    try {
      const obj = JSON.parse(cached);
      if (obj && typeof obj === "object") {
        const normalized = await normalizeQuotedMessageSource(env, obj, botId, messageId);
        if (JSON.stringify(normalized) !== JSON.stringify(obj)) await dbPut(env, cacheKey, JSON.stringify(normalized));
        return normalized;
      }
    } catch {
      return { messageId, groupId, senderId: "", senderName: "", text: cached, source: "unknown" };
    }
  }
  try {
    const data = await callOneBotAction(env, { action: "get_msg", params: { message_id: numericId(messageId) } }, 12000);
    const senderId = String(data?.sender?.user_id || data?.user_id || "");
    const selfId = String(botId || data?.self_id || "");
    const outbound = await hasOutboundMessageMarker(env, messageId);
    let source = "human";
    let sourceConfidence = "external-sender";
    if (data?.source === "ai" || outbound) {
      source = "ai";
      sourceConfidence = data?.source === "ai" ? "onebot-source" : "outbound-message-id";
    } else if (senderId && selfId && senderId === selfId) {
      source = "owner-human";
      sourceConfidence = "same-account-without-outbound-proof";
    }
    const obj = {
      messageId: String(messageId), groupId: String(groupId || data?.group_id || ""), senderId,
      senderName: String(data?.sender?.card || data?.sender?.nickname || senderId),
      text: extractMessageText(data?.message || data?.raw_message || ""),
      message: data?.message || null,
      source,
      sourceConfidence,
      selfId,
      createdAt: Number(data?.time || 0) * 1000 || Date.now()
    };
    await dbPut(env, `message:${obj.groupId}:${messageId}`, JSON.stringify(obj));
    return obj;
  } catch (error) {
    return null;
  }
}

function parseDurationSeconds(text) {
  const input = String(text || "").trim();
  const m = input.match(/(\d+(?:\.\d+)?)\s*(分钟|分鐘|分|小时|小時|时|時|天)?/);
  const value = Math.max(1, Number(m?.[1] || 10));
  const unit = m?.[2] || "分";
  const seconds = unit === "天" ? value * 86400 : /小时|小時|时|時/.test(unit) ? value * 3600 : value * 60;
  return Math.round(Math.min(seconds, 30 * 86400));
}

function formatDuration(seconds) {
  if (seconds % 86400 === 0) return `${seconds / 86400}天`;
  if (seconds % 3600 === 0) return `${seconds / 3600}小时`;
  return `${Math.round(seconds / 60)}分钟`;
}

function sanitizeAiReply(text) {
  return String(text || "")
    .replace(/\[CQ:[^\]]+\]/g, "")
    .replace(/\*\*/g, "")
    .replace(/^#+\s*/gm, "")
    .trim()
    .slice(0, 4000);
}

function extractTextMentionIds(text) {
  return [...new Set([...String(text || "").matchAll(/@(\d{5,})/g)].map(m => m[1]))];
}

function removeTextMentionTokens(text) {
  return String(text || "").replace(/@\d{5,}\s*/g, "").replace(/\s{2,}/g, " ").trim();
}

function buildReplyPlan({ isGroup, isAutoInterject, botMentioned, quotedMessageId, messageId, userId, selfId, selectedMentionIds = [], senderDnd, text }) {
  if (!isGroup) return { mode: "plain", text, mentionIds: [], replyId: "" };
  const mentionIds = [...new Set((selectedMentionIds || []).map(String))]
    .filter(id => id && id !== String(selfId || "") && !(senderDnd && id === String(userId || "")));
  let replyId = "";
  let mode = mentionIds.length ? "mention_targets" : "plain";

  if (!isAutoInterject && (quotedMessageId || botMentioned)) {
    // 回覆目前觸發訊息本身，語意上即是回覆目前發言者；是否額外 @ 由智能規劃器決定。
    replyId = String(messageId || "");
    mode = mentionIds.length ? "reply_targets" : "reply_only";
  }
  return { mode, text, mentionIds, replyId, quoteMessageId: replyId };
}

async function sendThinkingIndicator(env, { isGroup, groupId, userId, text }) {
  const action = isGroup ? "send_group_msg" : "send_private_msg";
  const params = isGroup
    ? { group_id: numericId(groupId), message: [{ type: "text", data: { text: String(text || "正在思考...") } }], auto_escape: false }
    : { user_id: numericId(userId), message: String(text || "正在思考..."), auto_escape: false };
  const data = await callOneBotAction(env, { action, params }, 12000);
  return String(data?.message_id || data?.messageId || data || "");
}

function flattenGeminiContents(contents) {
  const result = [];
  for (const item of contents || []) {
    const role = item.role === "model" ? "assistant" : "user";
    const text = (item.parts || []).map(p => p.text || (p.inlineData ? `[${p.inlineData.mimeType || "媒体"}]` : "")).filter(Boolean).join("\n");
    if (text) result.push({ role, content: text });
  }
  return result;
}

function taipeiDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

async function getQuotaNumber(env, key, fallback = Infinity) {
  const raw = await dbGet(env, key);
  if (raw === null || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function estimateTokenCount(text) {
  return Math.max(1, Math.ceil(String(text || "").length / 3));
}

function deepSeekCostCny(model, usage = {}) {
  const pro = String(model).includes("pro");
  const hitPrice = pro ? 0.025 : 0.02;
  const missPrice = pro ? 3 : 1;
  const outPrice = pro ? 6 : 2;
  const hit = Number(usage.prompt_cache_hit_tokens || 0);
  const miss = Number(usage.prompt_cache_miss_tokens || Math.max(0, Number(usage.prompt_tokens || 0) - hit));
  const output = Number(usage.completion_tokens || 0);
  return hit / 1e6 * hitPrice + miss / 1e6 * missPrice + output / 1e6 * outPrice;
}

async function checkDeepSeekBudget(env, { userId, groupId, estimatedCny }) {
  const day = taipeiDateKey();
  const globalSpent = Number(await dbGet(env, `usage:deepseek:global:${day}`) || 0);
  const groupSpent = Number(await dbGet(env, `usage:deepseek:group:${day}:${groupId}`) || 0);
  const userSpent = Number(await dbGet(env, `usage:deepseek:user:${day}:${userId}`) || 0);
  const globalLimit = await getQuotaNumber(env, "quota:deepseek:global_daily_cny", Number(env.DEEPSEEK_DAILY_BUDGET_CNY || Infinity));
  const groupLimit = await getQuotaNumber(env, `quota:deepseek:group:${groupId}`, Infinity);
  const userLimit = await getQuotaNumber(env, `quota:deepseek:user:${userId}`, Infinity);
  return {
    ok: globalSpent + estimatedCny <= globalLimit && groupSpent + estimatedCny <= groupLimit && userSpent + estimatedCny <= userLimit,
    day, globalSpent, groupSpent, userSpent, globalLimit, groupLimit, userLimit
  };
}

async function recordDeepSeekUsage(env, { userId, groupId, model, usage }) {
  const day = taipeiDateKey();
  const cost = deepSeekCostCny(model, usage);
  for (const key of [`usage:deepseek:global:${day}`, `usage:deepseek:group:${day}:${groupId}`, `usage:deepseek:user:${day}:${userId}`]) {
    const current = Number(await dbGet(env, key) || 0);
    await dbPut(env, key, String(current + cost));
  }
  await appendIndex(env, "usage:deepseek:log:index", `${Date.now()}:${crypto.randomUUID()}`, 2000);
  return cost;
}

async function callDeepSeek(env, { messages, userId, groupId, thinking = "disabled", effort = "high", maxTokens = 1200, model }) {
  const keys = deepSeekApiKeys(env);
  if (!keys.length) throw new Error("DEEPSEEK_API_KEYS_MISSING");
  const selectedModel = model || env.DEEPSEEK_FLASH_MODEL || DEFAULTS.deepseekFlashModel;
  const promptText = messages.map(m => `${m.role}:${m.content}`).join("\n");
  const estimatedTokens = estimateTokenCount(promptText) + maxTokens;
  const estimatedCny = estimatedTokens / 1e6 * 2;
  const budget = await checkDeepSeekBudget(env, { userId, groupId, estimatedCny });
  if (!budget.ok) throw new Error("DEEPSEEK_BUDGET_EXCEEDED");
  const payload = { model: selectedModel, messages, stream: false, max_tokens: maxTokens, thinking: { type: "disabled" } };
  let lastError = "DEEPSEEK_FAILED";
  for (const key of keys) {
    try {
      const response = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30000)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        lastError = `DEEPSEEK_${response.status}:${data?.error?.message || "UNKNOWN"}`;
        continue;
      }
      const text = String(data?.choices?.[0]?.message?.content || "").trim();
      if (!text) { lastError = "DEEPSEEK_EMPTY"; continue; }
      await recordDeepSeekUsage(env, { userId, groupId, model: selectedModel, usage: data.usage || {} });
      return { text, model: selectedModel, usage: data.usage || {} };
    } catch (error) {
      lastError = String(error?.message || error);
    }
  }
  throw new Error(lastError);
}

function immutableRuntimeModelDefaults(env, kind) {
  if (kind === "chat") return parseList(env.GEMINI_CHAT_MODELS, ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-3-flash-preview", "gemini-2.5-flash", "gemini-2.5-flash-lite"]);
  if (kind === "decision") return parseList(env.GEMMA_DECISION_MODELS, ["gemma-4-26b-a4b-it"]);
  if (kind === "last_resort") return parseList(env.GEMMA_LAST_RESORT_MODELS || env.GEMMA_CHAT_MODELS, ["gemma-4-31b-it"]);
  if (kind === "tts") return parseList(env.GEMINI_TTS_MODELS, ["gemini-3.1-flash-tts-preview", "gemini-2.5-flash-preview-tts"]);
  return [];
}

function normalizeRuntimeModelKind(value) {
  const kind = String(value || "").trim().toLowerCase();
  return ["chat", "decision", "last_resort", "tts"].includes(kind) ? kind : "chat";
}

function validRuntimeModelId(value) {
  return /^[a-zA-Z0-9._:/-]{2,180}$/.test(String(value || "").trim());
}

async function readCustomRuntimeModels(env, kind) {
  const normalized = normalizeRuntimeModelKind(kind);
  const list = await readJson(env, `runtime_model_registry:${normalized}`, []);
  return (Array.isArray(list) ? list : [])
    .filter(item => item && validRuntimeModelId(item.id))
    .map((item, index) => ({ id: String(item.id), enabled: item.enabled !== false, order: Number.isFinite(Number(item.order)) ? Number(item.order) : index, createdAt: item.createdAt || null, updatedAt: item.updatedAt || null }))
    .sort((a, b) => a.order - b.order);
}

async function writeCustomRuntimeModels(env, kind, items) {
  const normalized = normalizeRuntimeModelKind(kind);
  const clean = (items || []).filter(item => validRuntimeModelId(item.id)).map((item, index) => ({ ...item, id: String(item.id), enabled: item.enabled !== false, order: index }));
  await dbPut(env, `runtime_model_registry:${normalized}`, JSON.stringify(clean));
  return clean;
}

async function effectiveRuntimeModels(env, kind) {
  const custom = (await readCustomRuntimeModels(env, kind)).filter(item => item.enabled).map(item => item.id);
  const immutable = immutableRuntimeModelDefaults(env, kind);
  return [...new Set([...custom, ...immutable])];
}

async function runtimeModelRegistryState(env) {
  const categories = {};
  for (const kind of ["chat", "decision", "last_resort", "tts"]) {
    categories[kind] = {
      custom: await readCustomRuntimeModels(env, kind),
      immutable: immutableRuntimeModelDefaults(env, kind).map((id, order) => ({ id, order, locked: true, enabled: true })),
      effective: await effectiveRuntimeModels(env, kind)
    };
  }
  return categories;
}

async function callGemmaDecision(env, { system, prompt, maxOutputTokens = 64, deadlineAt = Date.now() + 12000, maxAttempts = 4 }) {
  const keys = roundRobinKeys([...new Set([...parseList(env.GEMINI_API_KEYS), ...parseList(env.VECTORIZE_GEMINI_KEYS)])], "gemini");
  if (!keys.length) throw new Error("GEMMA_API_KEYS_MISSING");
  const models = await effectiveRuntimeModels(env, "decision");
  let lastError = "GEMMA_DECISION_FAILED";
  let attempts = 0;
  for (const model of models) {
    for (const key of keys) {
      if (attempts >= Math.max(1, maxAttempts) || isDeadlineExceeded(deadlineAt, 800)) throw new Error(lastError);
      attempts += 1;
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: String(prompt || "") }] }],
            systemInstruction: { parts: [{ text: String(system || "只输出分类结果。") }] },
            generationConfig: {
              maxOutputTokens,
              temperature: 0,
              thinkingConfig: { thinkingLevel: "minimal" }
            }
          }),
          signal: AbortSignal.timeout(remainingTimeout(deadlineAt, 7000))
        });
        const data = await response.json().catch(() => ({}));
        if (response.ok) {
          const parts = data.candidates?.[0]?.content?.parts || [];
          const text = parts.filter(part => !part.thought).map(part => part.text || "").join("").trim();
          if (text) return { text, model, usage: data.usageMetadata || {} };
        }
        lastError = `GEMMA_${response.status}:${data?.error?.message || "UNKNOWN"}`;
      } catch (error) {
        lastError = String(error?.message || error);
      }
    }
  }
  throw new Error(lastError);
}

async function callGemmaChat(env, { model, system, contents, maxOutputTokens = 1000, temperature = 0.72, timeoutMs = 30000 }) {
  const keys = roundRobinKeys([...new Set([...parseList(env.GEMINI_API_KEYS), ...parseList(env.VECTORIZE_GEMINI_KEYS)])], "gemini");
  if (!keys.length) throw new Error("GEMMA_API_KEYS_MISSING");
  const configured = await effectiveRuntimeModels(env, "last_resort");
  const preferred = model === "gemma_31b" ? "gemma-4-31b-it" : "gemma-4-26b-a4b-it";
  const models = [preferred, ...configured.filter(x => x !== preferred)];
  let lastError = "GEMMA_CHAT_FAILED";
  for (const selectedModel of models) {
    for (const key of keys) {
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${encodeURIComponent(key)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: (contents || []).map(item => ({
              role: item.role === "model" ? "model" : "user",
              parts: (item.parts || []).filter(part => part.text).map(part => ({ text: String(part.text || "") }))
            })).filter(item => item.parts.length),
            systemInstruction: { parts: [{ text: String(system || "") }] },
            generationConfig: {
              maxOutputTokens,
              temperature,
              thinkingConfig: { thinkingLevel: selectedModel.includes("31b") ? "high" : "minimal" }
            }
          }),
          signal: AbortSignal.timeout(Math.max(5000, Math.min(30000, Number(timeoutMs || 30000))))
        });
        const data = await response.json().catch(() => ({}));
        if (response.ok) {
          const text = (data.candidates?.[0]?.content?.parts || []).filter(part => !part.thought).map(part => part.text || "").join("").trim();
          if (text) return { text, model: selectedModel, usage: data.usageMetadata || {} };
        }
        lastError = `GEMMA_CHAT_${response.status}:${data?.error?.message || "UNKNOWN"}`;
      } catch (error) {
        lastError = String(error?.message || error);
      }
    }
  }
  throw new Error(lastError);
}

function extractGeminiGrounding(data) {
  const candidate = data?.candidates?.[0] || {};
  const metadata = candidate.groundingMetadata || {};
  const sources = [];
  const seen = new Set();
  for (const chunk of metadata.groundingChunks || []) {
    const web = chunk?.web || chunk?.retrievedContext || {};
    const uri = String(web.uri || "").trim();
    const title = String(web.title || uri || "网页来源").trim();
    if (!uri || seen.has(uri)) continue;
    seen.add(uri);
    sources.push({ title: title.slice(0, 120), uri });
    if (sources.length >= 5) break;
  }
  return {
    grounded: Boolean(sources.length || (metadata.webSearchQueries || []).length),
    sources,
    searchQueries: (metadata.webSearchQueries || []).map(String).filter(Boolean).slice(0, 8)
  };
}

function appendSearchSources(text, sources) {
  const base = String(text || "").trim();
  const list = Array.isArray(sources) ? sources.filter(item => item?.uri) : [];
  if (!base || !list.length) return base;
  const sourceLines = list.slice(0, 5).map((item, index) => `${index + 1}. ${item.title || "资料来源"}\n${item.uri}`);
  return `${base}\n\n资料来源：\n${sourceLines.join("\n")}`;
}

function stripBotMentionFromConversation(text, botId) {
  const id = String(botId || "").trim();
  if (!id) return String(text || "").trim();
  return String(text || "").split(`@${id}`).join(" ").replace(/\s+/g, " ").trim();
}

function isLightweightAcknowledgement(text) {
  const normalized = String(text || "")
    .replace(/[~～!！?？…。，,.、\s]/g, "")
    .trim();
  if (!normalized || normalized.length > 10) return false;
  return /^(?:嗯+|恩+|哦+|噢+|喔+|好+|好的|好吧|行+|可以|知道了|了解|明白了|收到|原来如此|原來如此|哈哈+|嘿嘿+|谢谢|謝謝|谢了|謝了|感谢|感謝|没事|沒事|没问题|沒問題)$/.test(normalized);
}

function searchRequirement(text) {
  const source = String(text || "");
  const explicit = /(?:帮我|幫我)?(?:上网|上網|联网|聯網|搜索|搜尋|查一下|查找|搜一下)|(?:请|請)?(?:查证|查證|验证|驗證)/i.test(source);
  const fresh = /今天|今日|現在|现在|目前|最新|剛剛|刚刚|本週|本周|新聞|新闻|價格|价格|現價|现价|版本|更新|上市|下架|限額|限额|匯率|汇率|天氣|天气|比分|賽程|赛程|政策|法律|規則|规则/i.test(source);
  return { needed: explicit || fresh, explicit };
}

async function callGeminiGenerate(env, { models, system, contents, maxOutputTokens = 1000, temperature = 0.7, useSearch = true, requireSearch = false, timeoutMs = 30000, apiKeys = null, keyProvider = "gemini" }) {
  const keys = apiKeys
    ? roundRobinKeys(apiKeys, keyProvider)
    : roundRobinKeys([...new Set([...parseList(env.GEMINI_API_KEYS), ...parseList(env.VECTORIZE_GEMINI_KEYS)])], "gemini");
  if (!keys.length) throw new Error(keyProvider === "gemini_search" ? "GEMINI_SEARCH_API_KEYS_MISSING" : "GEMINI_API_KEYS_MISSING");
  let lastError = "GEMINI_FAILED";
  for (const model of models) {
    for (const key of keys) {
      const body = {
        contents,
        systemInstruction: { parts: [{ text: system }] },
        generationConfig: { maxOutputTokens, temperature }
      };
      if (useSearch || requireSearch) body.tools = [{ googleSearch: {} }];
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(Math.max(5000, Math.min(30000, Number(timeoutMs || 30000))))
          });
          const data = await response.json().catch(() => ({}));
          if (response.ok) {
            const text = (data.candidates?.[0]?.content?.parts || []).filter(part => !part.thought).map(p => p.text || "").join("").trim();
            const grounding = extractGeminiGrounding(data);
            if (requireSearch && !grounding.grounded) {
              lastError = "GEMINI_SEARCH_NOT_GROUNDED";
              break;
            }
            if (text) return { text, model, usage: data.usageMetadata || {}, ...grounding };
          }
          lastError = `GEMINI_${response.status}:${data?.error?.message || "UNKNOWN"}`;
          // 自动搜索可以在模型不兼容时降级；强制搜索绝不能悄悄改成离线回答。
          if (response.status === 400 && body.tools && !requireSearch) { delete body.tools; continue; }
          break;
        } catch (error) { lastError = String(error?.message || error); break; }
      }
    }
  }
  throw new Error(lastError);
}

async function buildSharedSearchContext(env, { query, models }) {
  const requirement = searchRequirement(query);
  const base = {
    required: requirement.needed,
    explicit: requirement.explicit,
    attempted: false,
    performed: false,
    query: String(query || ""),
    context: "",
    sources: [],
    searchQueries: [],
    provider: "gemini_google_search",
    model: "",
    error: ""
  };
  if (!requirement.needed) return base;
  const searchKeys = geminiSearchApiKeys(env);
  if (!searchKeys.length) return { ...base, error: "GEMINI_SEARCH_API_KEYS_MISSING" };
  try {
    const result = await callGeminiGenerate(env, {
      models,
      system: "你是联网检索器。必须使用 Google Search 查证用户问题，输出可供另一个模型引用的简体中文事实摘要。区分事实、日期与不确定性，不要编造来源。",
      contents: [{ role: "user", parts: [{ text: String(query || "").slice(0, 4000) }] }],
      maxOutputTokens: 700,
      temperature: 0.2,
      useSearch: true,
      requireSearch: true,
      apiKeys: searchKeys,
      keyProvider: "gemini_search"
    });
    return {
      ...base,
      attempted: true,
      performed: Boolean(result.grounded || result.sources?.length || result.searchQueries?.length),
      context: result.text || "",
      sources: result.sources || [],
      searchQueries: result.searchQueries || [],
      model: result.model || ""
    };
  } catch (error) {
    return { ...base, attempted: true, error: String(error?.message || error) };
  }
}

async function routeProviderWithGemma(env, text) {
  const source = String(text || "");
  try {
    const result = await callGemmaDecision(env, {
      system: "你是费用与能力路由分类器。只能输出 GEMINI 或 DEEPSEEK_HIGH。普通聊天、写作、摘要、搜索、多模态与一般代码全部输出 GEMINI；只有用户明确指定 DeepSeek，或任务明显是超大型跨文件工程、严格证明、复杂多阶段推理时输出 DEEPSEEK_HIGH。Gemma 不负责最终聊天回答。",
      prompt: source.slice(0, 3000),
      maxOutputTokens: 16
    });
    return result.text.toUpperCase().includes("DEEPSEEK") ? "deepseek_high" : "gemini";
  } catch (error) {
    console.warn("Gemma provider routing unavailable, using local rules:", error);
    return /明确使用DeepSeek|明確使用DeepSeek|指定DeepSeek|deepseek|大型跨文件|大型跨檔案|严格证明|嚴格證明|多阶段推理|多階段推理/i.test(source) ? "deepseek_high" : "gemini";
  }
}

async function generateHybridReply(env, args) {
  let pref = args.modelPref || "auto";
  if (args.hasMedia) pref = "gemini";
  if (["gemma_26b", "gemma_31b"].includes(pref)) pref = "gemini";
  if (pref === "auto") pref = "gemini";
  const deepseekEnabled = await getFeatureFlag(env, "deepseek_enabled", true);
  const costPolicy = String(env.MODEL_COST_POLICY || DEFAULTS.modelCostPolicy).trim().toLowerCase();
  const allowPaidEmergencyFallback = envFlag(env.DEEPSEEK_EMERGENCY_FALLBACK, true);
  const searchState = searchRequirement(args.cleanText);
  let sharedSearchPromise = null;
  const getSharedSearch = async () => {
    if (args.hasMedia) return { required: false, explicit: false, attempted: false, performed: false, query: args.cleanText, context: "", sources: [], searchQueries: [], provider: "", model: "", error: "media_request" };
    if (!sharedSearchPromise) sharedSearchPromise = buildSharedSearchContext(env, { query: args.cleanText, models: args.chatModels });
    return sharedSearchPromise;
  };
  const mergeSearchPrompt = (prompt, search) => {
    if (search?.context) return `${prompt}\n\n【独立联网搜索结果】\n${search.context}\n\n回答时只能将以上检索结果当作实时事实依据；无法由资料支持的部分必须说明不确定。`;
    if (search?.required) return `${prompt}\n\n【联网搜索状态】本题需要实时资料，但独立搜索服务未取得可用结果（${search.error || "未返回可靠来源"}）。不得假装已经联网；涉及实时事实时要明确说明无法查证。`;
    return prompt;
  };
  const finish = (provider, result, search) => ({
    provider,
    ...result,
    text: appendSearchSources(result.text, search?.sources?.length ? search.sources : result.sources || []),
    searchRequired: Boolean(search?.required || searchState.needed),
    searchAttempted: Boolean(search?.attempted),
    searchPerformed: Boolean(search?.performed),
    searchQuery: String(search?.query || args.cleanText || ""),
    searchContext: String(search?.context || ""),
    searchSources: search?.sources || [],
    searchQueries: search?.searchQueries || [],
    searchProvider: String(search?.provider || ""),
    searchModel: String(search?.model || ""),
    searchError: String(search?.error || ""),
    grounded: Boolean(search?.performed)
  });

  const tryGemma = async modelPref => {
    if (args.hasMedia) throw new Error("GEMMA_NO_MEDIA");
    const search = await getSharedSearch();
    const result = await callGemmaChat(env, {
      model: modelPref,
      system: mergeSearchPrompt(args.finalStylePrompt, search),
      contents: args.contents,
      maxOutputTokens: args.fastChat ? 160 : 1000,
      temperature: args.fastChat ? 0.9 : 0.82,
      timeoutMs: args.fastChat ? 12000 : 30000
    });
    return finish("gemma", result, search);
  };
  const tryGemini = async () => {
    const search = await getSharedSearch();
    const result = await callGeminiGenerate(env, {
      models: args.chatModels,
      system: mergeSearchPrompt(args.finalStylePrompt, search),
      contents: args.contents,
      maxOutputTokens: args.fastChat ? 180 : 1000,
      temperature: args.fastChat ? 0.9 : 0.82,
      // 搜索只允许独立搜索金钥执行；聊天金钥不挂 Google Search tool。
      useSearch: false,
      requireSearch: false,
      timeoutMs: args.fastChat ? 12000 : 30000
    });
    return finish("gemini", result, search);
  };
  const tryDeepSeek = async () => {
    if (!deepseekEnabled || !deepSeekApiKeys(env).length || args.hasMedia) throw new Error("DEEPSEEK_UNAVAILABLE");
    const search = await getSharedSearch();
    const messages = [{ role: "system", content: mergeSearchPrompt(args.finalStylePrompt, search) }, ...flattenGeminiContents(args.contents).slice(-32)];
    const result = await callDeepSeek(env, { messages, userId: args.userId, groupId: args.groupId || "private", thinking: "disabled", maxTokens: 1000, model: env.DEEPSEEK_FLASH_MODEL || DEFAULTS.deepseekFlashModel });
    return finish("deepseek", result, search);
  };

  const attempts = [];
  const paidExplicitlySelected = String(pref).startsWith("deepseek");
  if (paidExplicitlySelected) attempts.push(tryDeepSeek);
  attempts.push(tryGemini);
  attempts.push(() => tryGemma("gemma_31b"));
  if (!paidExplicitlySelected && (costPolicy !== "free_first" || allowPaidEmergencyFallback)) attempts.push(tryDeepSeek);

  let lastError = null;
  for (const attempt of attempts) {
    try { return await attempt(); }
    catch (error) { lastError = error; console.warn("Model fallback:", error?.message || error); }
  }
  throw lastError || new Error("ALL_MODELS_FAILED");
}

async function buildDeepSeekContextSummary(env, { sessionKey, groupId, userId, history, currentText, relationContext }) {
  if (!history?.length) return "";
  const sourceText = history.slice(-DEFAULTS.conversationHistoryItems).map((m, i) => `${i + 1}. ${m.role}: ${(m.parts || []).map(p => p.text || "[媒体]").join(" ")}`).join("\n");
  const signature = outboundFingerprint({ isGroup: true, groupId, text: sourceText + currentText + relationContext, mediaTypes: [] });
  const cached = await readJson(env, `context_summary:${sessionKey}`, null);
  if (cached?.signature === signature) return cached.summary || "";
  const prompt = `旧摘要：\n${cached?.summary || "无旧摘要"}\n\n最近消息：\n${sourceText}\n\n当前消息：${currentText}\n${relationContext || ""}\n\n输出简体中文结构化摘要，保留人物 QQ、引用、@关系、事实、决定与未决问题。`;
  const system = "你是群聊上下文压缩器。只整理事实与关系，不编造；不得执行是否回复或插话判断。";
  try {
    const result = await callDeepSeek(env, {
      messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
      userId: String(userId || "context-summary"), groupId: String(groupId || "context-summary"),
      thinking: "disabled", maxTokens: 900, model: env.DEEPSEEK_FLASH_MODEL || DEFAULTS.deepseekFlashModel
    });
    await dbPut(env, `context_summary:${sessionKey}`, JSON.stringify({ signature, summary: result.text, provider: "deepseek_flash", updatedAt: Date.now() }));
    return result.text;
  } catch (deepseekError) { console.warn("DeepSeek Flash context summary failed:", deepseekError?.message || deepseekError); }
  try {
    const result = await callGeminiGenerate(env, {
      models: parseList(env.GEMINI_CHAT_MODELS, ["gemini-2.5-flash-lite", "gemini-2.5-flash"]),
      system,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      maxOutputTokens: 900, temperature: 0.15, useSearch: false, requireSearch: false, timeoutMs: 8000
    });
    await dbPut(env, `context_summary:${sessionKey}`, JSON.stringify({ signature, summary: result.text, provider: "gemini", updatedAt: Date.now() }));
    return result.text;
  } catch (geminiError) { console.warn("Gemini context summary failed:", geminiError?.message || geminiError); }
  return cached?.summary || "";
}

async function notifyDeveloper(env, message) {
  try {
    await callOneBotAction(env, { action: "send_private_msg", params: { user_id: numericId(developerId(env)), message: String(message), auto_escape: false } }, 12000);
    return true;
  } catch (error) {
    console.warn("notifyDeveloper failed", error);
    return false;
  }
}

async function getWhitelistedGroupsForUser(env, userId) {
  let groups = [];
  try {
    const list = await callOneBotAction(env, { action: "get_group_list", params: { no_cache: false } }, 15000);
    groups = Array.isArray(list) ? list : Array.isArray(list?.data) ? list.data : [];
  } catch {
    const known = await readJson(env, "known_groups", []);
    groups = known;
  }
  const result = [];
  for (const group of groups.slice(0, 300)) {
    const groupId = String(group.group_id || group.groupId || group.id || "");
    if (!groupId || !(await isGroupWhitelisted(env, groupId))) continue;
    let member = null;
    try {
      member = await callOneBotAction(env, { action: "get_group_member_info", params: { group_id: numericId(groupId), user_id: numericId(userId), no_cache: false } }, 8000);
    } catch {
      member = (await readJson(env, `group_members:${groupId}`, [])).find(x => String(x.qq) === String(userId));
    }
    if (!member) continue;
    result.push({ groupId, groupName: String(group.group_name || group.groupName || groupId), role: String(member.role || "member"), card: String(member.card || member.nickname || userId) });
  }
  return result;
}

async function filterAuthorizedReviewers(env, groupId, reviewerIds, kind) {
  const valid = [], invalid = [];
  for (const reviewerId of [...new Set((reviewerIds || []).map(String).filter(Boolean))]) {
    const role = await resolvePortalRole(env, reviewerId, groupId);
    const perms = await getEffectivePermissions(env, groupId, reviewerId, role, isDeveloperId(env, reviewerId));
    const allowed = kind === "schedule" ? (perms.scheduleReviewer || perms.groupOps || perms.nativeAdmin || perms.developer) : (perms.appealReviewer || perms.nativeAdmin || perms.developer);
    (allowed ? valid : invalid).push(reviewerId);
  }
  return { valid, invalid };
}

async function getBotIdentity(env) {
  const cached = await readJson(env, "onebot:self_identity", null);
  if (cached?.userId && Date.now() - Number(cached.at || 0) < 5 * 60 * 1000) return cached;
  try {
    const data = await callOneBotAction(env, { action: "get_login_info", params: {} }, 10000);
    const identity = { userId: String(data?.user_id || data?.userId || ""), nickname: String(data?.nickname || ""), at: Date.now() };
    if (identity.userId) await dbPut(env, "onebot:self_identity", JSON.stringify(identity));
    return identity;
  } catch {
    return cached || { userId: "", nickname: "", at: 0 };
  }
}

async function getBotGroupRole(env, groupId) {
  const cacheKey = `onebot:self_group_role:${groupId}`;
  const cached = await readJson(env, cacheKey, null);
  if (cached?.role && Date.now() - Number(cached.at || 0) < 60 * 1000) return cached;
  const self = await getBotIdentity(env);
  if (!self.userId) return cached || { userId: "", role: "unknown", at: 0 };
  try {
    const member = await callOneBotAction(env, { action: "get_group_member_info", params: { group_id: numericId(groupId), user_id: numericId(self.userId), no_cache: true } }, 10000);
    const state = { userId: self.userId, role: String(member?.role || "member"), at: Date.now() };
    await dbPut(env, cacheKey, JSON.stringify(state));
    return state;
  } catch {
    return cached || { userId: self.userId, role: "unknown", at: 0 };
  }
}

async function isBotVerifiedGroupOwner(env, groupId) {
  return (await getBotGroupRole(env, groupId)).role === "owner";
}

async function canUseBotGroupOperations(env, groupId, userId) {
  const role = await resolvePortalRole(env, String(userId), String(groupId));
  const permissions = await getEffectivePermissions(env, String(groupId), String(userId), role, isDeveloperId(env, userId));
  return Boolean(permissions.groupOps || permissions.nativeAdmin || permissions.developer);
}

async function getGroupOwnerId(env, groupId) {
  try {
    const members = await callOneBotAction(env, { action: "get_group_member_list", params: { group_id: numericId(groupId), no_cache: false } }, 12000);
    const owner = (Array.isArray(members) ? members : []).find(m => m.role === "owner");
    return owner ? String(owner.user_id || owner.qq || "") : "";
  } catch {
    const members = await readJson(env, `group_members:${groupId}`, []);
    return String(members.find(m => m.role === "owner")?.qq || "");
  }
}

async function isVerifiedGroupOwner(env, groupId, userId) {
  const wanted = String(userId || "");
  if (!groupId || !wanted) return false;
  const ownerId = await getGroupOwnerId(env, groupId);
  if (ownerId) return String(ownerId) === wanted;
  const member = await getGroupMemberSafe(env, groupId, wanted);
  return String(member?.role || "") === "owner";
}

async function verifyGroupMembership(env, groupId, userId) {
  if (!(await isGroupWhitelisted(env, groupId))) return false;
  try {
    const member = await callOneBotAction(env, { action: "get_group_member_info", params: { group_id: numericId(groupId), user_id: numericId(userId), no_cache: false } }, 10000);
    return Boolean(member && (member.user_id || member.qq || member.nickname));
  } catch {
    const members = await readJson(env, `group_members:${groupId}`, []);
    return members.some(x => String(x.qq) === String(userId));
  }
}

function parseScheduleRequest(text, now = Date.now()) {
  const raw = String(text || "").trim();
  let m = raw.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}:\d{2})\s+([\s\S]+)$/);
  if (m) {
    const at = parseTaipeiDateTime(`${m[1]} ${m[2]}`);
    if (!at || at <= now) return { ok: false, message: "单次排程时间必须晚于现在。" };
    return { ok: true, type: "once", nextRunAt: at, content: m[3].trim(), timezone: "Asia/Taipei" };
  }
  m = raw.match(/^每天\s+(\d{1,2}:\d{2})\s+([\s\S]+)$/);
  if (m) return { ok: true, type: "daily", timeOfDay: m[1], nextRunAt: nextTaipeiTime(m[1], now), content: m[2].trim(), timezone: "Asia/Taipei" };
  m = raw.match(/^每周([一二三四五六日天])\s+(\d{1,2}:\d{2})\s+([\s\S]+)$/);
  if (m) return { ok: true, type: "weekly", weekday: "一二三四五六日".indexOf(m[1]) + 1 || 7, timeOfDay: m[2], nextRunAt: nextTaipeiWeekday(m[1], m[2], now), content: m[3].trim(), timezone: "Asia/Taipei" };
  m = raw.match(/^每月(\d{1,2})日\s+(\d{1,2}:\d{2})\s+([\s\S]+)$/);
  if (m) return { ok: true, type: "monthly", dayOfMonth: Math.min(28, Math.max(1, Number(m[1]))), timeOfDay: m[2], nextRunAt: nextTaipeiMonthly(Number(m[1]), m[2], now), content: m[3].trim(), timezone: "Asia/Taipei" };
  m = raw.match(/^每隔\s*(\d+)\s*(分钟|分鐘|分|小时|小時|时|時|天)\s+([\s\S]+)$/);
  if (m) {
    const seconds = parseDurationSeconds(`${m[1]}${m[2]}`);
    if (seconds < DEFAULTS.scheduleMinIntervalMinutes * 60) return { ok: false, message: `重复排程最短间隔为 ${DEFAULTS.scheduleMinIntervalMinutes} 分钟。` };
    return { ok: true, type: "interval", intervalMs: seconds * 1000, nextRunAt: now + seconds * 1000, content: m[3].trim(), timezone: "Asia/Taipei" };
  }
  return { ok: false, message: "格式示例：!排程 2026-07-22 18:00 内容；!排程 每天 18:00 内容；!排程 每周一 18:00 内容；!排程 每隔 2小时 内容" };
}

function parseTaipeiDateTime(value) {
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]) - 8, Number(m[5]));
}

function taipeiParts(ms = Date.now()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, weekday: "short" }).formatToParts(new Date(ms));
  return Object.fromEntries(parts.map(p => [p.type, p.value]));
}

function nextTaipeiTime(time, now = Date.now()) {
  const p = taipeiParts(now); const [h, min] = time.split(":").map(Number);
  let target = parseTaipeiDateTime(`${p.year}-${p.month}-${p.day} ${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`);
  if (target <= now) target += 86400000;
  return target;
}

function nextTaipeiWeekday(char, time, now = Date.now()) {
  const targetDay = ({ 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 7, 天: 7 })[char] || 1;
  const weekdayMap = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  const p = taipeiParts(now); const current = weekdayMap[p.weekday] || 1;
  let days = (targetDay - current + 7) % 7;
  let target = nextTaipeiTime(time, now + days * 86400000 - (days ? 1 : 0));
  if (days && target < now + days * 86400000 - 3600000) target += 86400000;
  return target;
}

function nextTaipeiMonthly(day, time, now = Date.now()) {
  const p = taipeiParts(now); const [h, min] = time.split(":").map(Number); const safeDay = Math.min(28, Math.max(1, day));
  let y = Number(p.year), mo = Number(p.month);
  let target = parseTaipeiDateTime(`${y}-${String(mo).padStart(2, "0")}-${String(safeDay).padStart(2, "0")} ${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`);
  if (target <= now) { mo++; if (mo > 12) { mo = 1; y++; } target = parseTaipeiDateTime(`${y}-${String(mo).padStart(2, "0")}-${String(safeDay).padStart(2, "0")} ${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`); }
  return target;
}

async function reviewScheduleWithGemma(env, content) {
  try {
    const result = await callGemmaDecision(env, {
      system: "你是排程安全审查器。判断是否明显违法、骚扰、洗版、冒充、泄露隐私、恶意群管理或其他滥用。只输出JSON：{\"decision\":\"allow|uncertain|reject\",\"reason\":\"简短原因\"}。不确定就uncertain。",
      prompt: String(content).slice(0, 4000),
      maxOutputTokens: 120
    });
    const json = JSON.parse(result.text.match(/\{[\s\S]*\}/)?.[0] || "{}");
    return ["allow", "uncertain", "reject"].includes(json.decision) ? json : { decision: "uncertain", reason: "无法稳定判断" };
  } catch (error) {
    console.warn("Gemma schedule review unavailable:", error);
    return { decision: "uncertain", reason: "审查服务暂时不可用" };
  }
}

function parseManagementScheduleAction(content) {
  const text = String(content || "").trim();
  const m = text.match(/^[!！](禁言|解禁|踢出|撤回|全员禁言|全員禁言|解除全员禁言|解除全員禁言|改群名|改名片|关闭ai|關閉ai|开启ai|開啟ai|记忆开|記憶開|记忆关|記憶關)(?:\s|$)/i);
  return m ? { command: m[1], raw: text } : null;
}

async function createScheduleRecord(env, data) {
  const id = `sch_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`;
  const record = { id, enabled: true, createdAt: new Date().toISOString(), lastRunAt: null, lastResult: null, failureCount: 0, reviewerIds: [], votes: {}, approvalRule: "single", ...data };
  await dbPut(env, `schedule:${id}`, JSON.stringify(record));
  await appendIndex(env, "schedule:index", id, 5000);
  return record;
}

async function listUserSchedules(env, userId, groupId = "") {
  const ids = await readJson(env, "schedule:index", []); const result = [];
  for (const id of ids.slice(-1000)) {
    const item = await readJson(env, `schedule:${id}`, null);
    if (item && item.creatorId === userId && (!groupId || item.groupId === groupId) && !["deleted"].includes(item.status)) result.push(item);
  }
  return result.sort((a, b) => Number(a.nextRunAt || Infinity) - Number(b.nextRunAt || Infinity));
}

async function countActiveSchedulesForUser(env, userId) {
  const list = await listUserSchedules(env, userId);
  return list.filter(x => x.enabled && ["active", "pending_owner", "pending_review"].includes(x.status)).length;
}

function formatScheduleLine(item) {
  const time = item.nextRunAt ? new Date(item.nextRunAt).toLocaleString("zh-CN", { timeZone: "Asia/Taipei" }) : "无下次时间";
  return `${item.id}｜${item.status}｜${time}｜${String(item.content || "").slice(0, 60)}`;
}

async function cancelSchedule(env, id, actorId, canManage = false) {
  const item = await readJson(env, `schedule:${id}`, null);
  if (!item) return { ok: false, message: "找不到该排程。" };
  if (item.creatorId !== actorId && !canManage) return { ok: false, message: "你没有取消该排程的权限。" };
  item.enabled = false; item.status = "cancelled"; item.cancelledAt = new Date().toISOString(); item.cancelledBy = actorId;
  await dbPut(env, `schedule:${id}`, JSON.stringify(item));
  return { ok: true, message: `排程 ${id} 已取消。` };
}

function scheduleApprovalReached(record) {
  const reviewers = record.reviewerIds || [];
  const approvals = reviewers.filter(id => record.votes?.[id] === "approve").length;
  const rejects = reviewers.filter(id => record.votes?.[id] === "reject").length;
  if (rejects > 0 && record.approvalRule === "all") return { done: true, approved: false };
  if (record.approvalRule === "all") return { done: approvals === reviewers.length && reviewers.length > 0, approved: approvals === reviewers.length && reviewers.length > 0 };
  if (record.approvalRule === "majority") return { done: approvals > reviewers.length / 2 || rejects >= Math.ceil(reviewers.length / 2), approved: approvals > reviewers.length / 2 };
  return { done: approvals >= 1 || rejects >= 1, approved: approvals >= 1 };
}

async function voteSchedule(env, id, reviewerId, vote) {
  const item = await readJson(env, `schedule:${id}`, null);
  if (!item || !(item.reviewerIds || []).includes(reviewerId)) return { ok: false, message: "没有该审核任务。" };
  item.votes ||= {}; item.votes[reviewerId] = vote;
  const state = scheduleApprovalReached(item);
  if (state.done) { item.status = state.approved ? "active" : "rejected"; item.enabled = Boolean(state.approved); item.reviewedAt = new Date().toISOString(); }
  await dbPut(env, `schedule:${id}`, JSON.stringify(item));
  return { ok: true, item };
}

async function executeManagementSchedule(env, record) {
  const raw = record.managementAction?.raw || "";
  const target = raw.match(/@(\d{5,})|\b(\d{5,})\b/)?.slice(1).find(Boolean);
  if (/^[!！]禁言/.test(raw) && target) return runOneBotGroupOperation(env, "set_group_ban", { group_id: numericId(record.groupId), user_id: numericId(target), duration: parseDurationSeconds(raw) }, { actorId: record.creatorId, groupId: record.groupId, targetId: target, action: "排程禁言" });
  if (/^[!！]解禁/.test(raw) && target) return runOneBotGroupOperation(env, "set_group_ban", { group_id: numericId(record.groupId), user_id: numericId(target), duration: 0 }, { actorId: record.creatorId, groupId: record.groupId, targetId: target, action: "排程解禁" });
  if (/^[!！]踢出/.test(raw) && target) return runOneBotGroupOperation(env, "set_group_kick", { group_id: numericId(record.groupId), user_id: numericId(target), reject_add_request: false }, { actorId: record.creatorId, groupId: record.groupId, targetId: target, action: "排程踢出" });
  if (/^[!！]全[员員]禁言/.test(raw)) return runOneBotGroupOperation(env, "set_group_whole_ban", { group_id: numericId(record.groupId), enable: true }, { actorId: record.creatorId, groupId: record.groupId, action: "排程全员禁言" });
  if (/^[!！]解除全[员員]禁言/.test(raw)) return runOneBotGroupOperation(env, "set_group_whole_ban", { group_id: numericId(record.groupId), enable: false }, { actorId: record.creatorId, groupId: record.groupId, action: "排程解除全员禁言" });
  if (/^[!！]撤回/.test(raw) && target) return runOneBotGroupOperation(env, "delete_msg", { message_id: numericId(target) }, { actorId: record.creatorId, groupId: record.groupId, targetId: target, action: "排程撤回" });
  if (/^[!！]改群名/.test(raw)) { const value = raw.replace(/^[!！]改群名\s*/, "").trim(); if (!value) return { ok: false, error: "缺少新群名" }; return runOneBotGroupOperation(env, "set_group_name", { group_id: numericId(record.groupId), group_name: value.slice(0, 60) }, { actorId: record.creatorId, groupId: record.groupId, action: "排程改群名" }); }
  if (/^[!！]改名片/.test(raw) && target) { const value = raw.replace(/^[!！]改名片\s*/, "").replace(new RegExp(`@?${target}`), "").trim(); if (!value) return { ok: false, error: "缺少新名片" }; return runOneBotGroupOperation(env, "set_group_card", { group_id: numericId(record.groupId), user_id: numericId(target), card: value.slice(0, 60) }, { actorId: record.creatorId, groupId: record.groupId, targetId: target, action: "排程改名片" }); }
  if (/^[!！](关闭|關閉)ai/i.test(raw)) { await dbPut(env, `ai_off:${record.groupId}`, "true"); return { ok: true }; }
  if (/^[!！](开启|開啟)ai/i.test(raw)) { await dbDel(env, `ai_off:${record.groupId}`); return { ok: true }; }
  if (/^[!！](记忆开|記憶開)/.test(raw)) { await dbDel(env, `memo:${record.groupId}`); return { ok: true }; }
  if (/^[!！](记忆关|記憶關)/.test(raw)) { await dbPut(env, `memo:${record.groupId}`, "false"); return { ok: true }; }
  return { ok: false, error: "不支持的管理排程动作" };
}

function computeNextScheduleRun(record, after = Date.now()) {
  if (record.type === "once") return null;
  if (record.type === "interval") return after + Number(record.intervalMs || 3600000);
  if (record.type === "daily") return nextTaipeiTime(record.timeOfDay, after + 60000);
  if (record.type === "weekly") return nextTaipeiWeekday("一二三四五六日"[Number(record.weekday || 1) - 1], record.timeOfDay, after + 60000);
  if (record.type === "monthly") return nextTaipeiMonthly(record.dayOfMonth, record.timeOfDay, after + 60000);
  return null;
}

async function processDueSchedules(env, now = Date.now()) {
  const ids = await readJson(env, "schedule:index", []);
  for (const id of ids.slice(-5000)) {
    const item = await readJson(env, `schedule:${id}`, null);
    if (!item || !item.enabled || item.status !== "active" || Number(item.nextRunAt || Infinity) > now) continue;
    if (!(await isGroupWhitelisted(env, item.groupId))) { item.status = "paused"; item.lastResult = "群不在白名单"; await dbPut(env, `schedule:${id}`, JSON.stringify(item)); continue; }
    try {
      let result;
      if (item.managementAction) result = await executeManagementSchedule(env, item);
      else {
        let message = String(item.content || "");
        if (/^(AI生成|AI生成：|AI:)/i.test(message)) {
          const prompt = message.replace(/^(AI生成|AI生成：|AI:)/i, "").trim();
          const generated = await callGeminiGenerate(env, { models: parseList(env.GEMINI_CHAT_MODELS, ["gemini-3.5-flash", "gemini-3.1-flash-lite"]), system: "生成适合QQ群发送的简体中文内容，不讨论模型身份。", contents: [{ role: "user", parts: [{ text: prompt }] }], maxOutputTokens: 500, temperature: 0.8, useSearch: false });
          message = generated.text;
        }
        await callOneBotAction(env, { action: "send_group_msg", params: { group_id: numericId(item.groupId), message, auto_escape: false } }, 15000);
        result = { ok: true };
      }
      if (!result?.ok) throw new Error(result?.error || "执行失败");
      item.lastRunAt = new Date(now).toISOString(); item.lastResult = "success"; item.failureCount = 0;
      const next = computeNextScheduleRun(item, now);
      if (next) item.nextRunAt = next; else { item.enabled = false; item.status = "completed"; item.nextRunAt = null; }
    } catch (error) {
      item.failureCount = Number(item.failureCount || 0) + 1; item.lastResult = String(error.message || error);
      if (item.failureCount >= 3) { item.status = "paused"; item.enabled = false; await notifyDeveloper(env, `【排程已暂停】\n编号：${id}\n原因：${item.lastResult}`); }
      else item.nextRunAt = now + 5 * 60 * 1000;
    }
    await dbPut(env, `schedule:${id}`, JSON.stringify(item));
  }
  await processActiveSpeaking(env, now);
}

async function processActiveSpeaking(env, now = Date.now()) {
  const groups = await readJson(env, "active_speaking:groups", []);
  for (const groupId of groups) {
    if (!(await getFeatureFlag(env, `active_speaking:${groupId}`, false)) || !(await isGroupWhitelisted(env, groupId))) continue;
    const config = await readJson(env, `active_speaking:config:${groupId}`, { quietMinutes: 60, startHour: 9, endHour: 23, maxDaily: 3 });
    const p = taipeiParts(now); const hour = Number(p.hour); if (hour < config.startHour || hour >= config.endHour) continue;
    const lastMessage = Number(await dbGet(env, `group_last_message:${groupId}`) || 0); if (now - lastMessage < config.quietMinutes * 60000) continue;
    const dayKey = taipeiDateKey(new Date(now)); const countKey = `active_speaking:count:${groupId}:${dayKey}`; const count = Number(await dbGet(env, countKey) || 0); if (count >= config.maxDaily) continue;
    const lastSpeak = Number(await dbGet(env, `active_speaking:last:${groupId}`) || 0); if (now - lastSpeak < config.quietMinutes * 60000) continue;
    try {
      const result = await callGeminiGenerate(env, { models: parseList(env.GEMINI_CHAT_MODELS, ["gemini-3.1-flash-lite", "gemini-3.5-flash"]), system: "生成一句自然的QQ群开场话题，简体中文，不提AI身份，不引用私人记忆，不@任何人。", contents: [{ role: "user", parts: [{ text: "群里有一段时间没人说话，请自然开启一个轻松话题。" }] }], maxOutputTokens: 120, temperature: 0.9, useSearch: false });
      await callOneBotAction(env, { action: "send_group_msg", params: { group_id: numericId(groupId), message: result.text, auto_escape: false } }, 12000);
      await dbPut(env, countKey, String(count + 1)); await dbPut(env, `active_speaking:last:${groupId}`, String(now));
    } catch {}
  }
}

async function performGroupCheckin(env, groupId, actorId = "system") {
  const params = { group_id: numericId(groupId) };
  let lastError = "未知错误";
  for (const action of ["set_group_sign", "send_group_sign"]) {
    try {
      await callOneBotAction(env, { action, params }, 12000);
      await writeSystemAudit(env, { type: "group_checkin", groupId: String(groupId), actorId: String(actorId), action });
      return { ok: true, action };
    } catch (error) { lastError = String(error?.message || error); }
  }
  return { ok: false, error: lastError };
}

async function runAutomaticGroupCheckins(env, now = Date.now()) {
  const parts = taipeiParts(now);
  const currentTime = `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}:${String(parts.second).padStart(2, "0")}`;
  if (!currentTime.startsWith("00:00:")) return;
  const dayKey = `${parts.year}-${parts.month}-${parts.day}`;
  let groups = [];
  try {
    const data = await callOneBotAction(env, { action: "get_group_list", params: { no_cache: true } }, 20000);
    groups = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
  } catch (error) {
    console.warn("00:00 自动群打卡无法取得群列表", error);
    return;
  }
  for (const group of groups.slice(0, 500)) {
    const groupId = String(group?.group_id || group?.groupId || group?.id || "").replace(/\D/g, "");
    if (!groupId) continue;
    const onceKey = `auto_checkin_done:${groupId}:${dayKey}`;
    if (await dbGet(env, onceKey)) continue;
    const result = await performGroupCheckin(env, groupId, "system:midnight_checkin");
    await dbPut(env, onceKey, JSON.stringify({ scheduledAt: now, executedAt: Date.now(), ok: result.ok, result }));
  }
}

async function cleanupExpiredModerationProposals(env, now = Date.now()) {
  if (!env.DB) return;
  try {
    const rows = await env.DB.prepare("SELECT key, value FROM kv_store WHERE key LIKE 'moderation:proposal:op_%'").all();
    for (const row of rows.results || []) {
      let proposal = null;
      try { proposal = JSON.parse(row.value); } catch {}
      if (!proposal || proposal.status !== "pending" || now <= Number(proposal.expiresAt || 0)) continue;
      proposal.status = "expired";
      proposal.expiredAt = now;
      await retractModerationProposalMessage(env, proposal, "expired");
      await dbPut(env, row.key, JSON.stringify(proposal));
    }
  } catch (error) {
    console.warn("moderation expiry cleanup failed", error);
  }
}

async function cleanupTransientState(env) {
  if (!env.DB) return;
  try {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const rows = await env.DB.prepare("SELECT key, value FROM kv_store WHERE key LIKE 'outbound_pending:%' OR key LIKE 'outbound:%' OR key LIKE 'notice:not_whitelisted:%'").all();
    for (const row of rows.results || []) {
      let at = Number(row.value || 0); try { at = Number(JSON.parse(row.value)?.at || at); } catch {}
      if (at && at < cutoff) await dbDel(env, row.key);
    }
  } catch (error) { console.warn("cleanup failed", error); }
}

async function createAppealFromText(env, applicantId, text) {
  const groupId = String(text.match(/\b(\d{5,})\b/)?.[1] || await dbGet(env, `private_default_group:${applicantId}`) || "");
  if (!groupId) return { ok: false, message: "请提供群号，例如：!申诉 808882936 禁言 详细内容" };
  if (!(await isGroupWhitelisted(env, groupId))) return { ok: false, message: "该群不属于可使用 AI 的白名单群。" };
  if (!(await verifyGroupMembership(env, groupId, applicantId))) return { ok: false, message: "无法确认你是该白名单群的成员。" };
  const rest = text.replace(groupId, "").trim(); const type = rest.split(/\s+/)[0] || "其他"; const content = rest.slice(type.length).trim();
  if (!content) return { ok: false, message: "请填写完整申诉内容。" };
  const id = `app_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`;
  const appeal = { id, anonymousLabel: `匿名申诉-${id.slice(-6)}`, applicantId: String(applicantId), groupId, type, content, status: "pending_owner", createdAt: new Date().toISOString(), reviewerIds: [], votes: {}, approvalRule: "single", result: "", againstAdmin: /管理|群主|开发者|開發者/i.test(type + content), recommendedReviewerRole: /管理|群主|开发者|開發者/i.test(type + content) ? "owner" : "developer_choice" };
  await dbPut(env, `appeal:${id}`, JSON.stringify(appeal)); await appendIndex(env, "appeal:index", id, 5000);
  return { ok: true, appeal };
}

function sanitizeAppealForReviewer(appeal, viewerIsDeveloper = false) {
  const copy = { ...appeal };
  if (!viewerIsDeveloper) delete copy.applicantId;
  return copy;
}

function appealApprovalReached(record) {
  const reviewers = record.reviewerIds || []; const approvals = reviewers.filter(id => record.votes?.[id] === "approve").length; const rejects = reviewers.filter(id => record.votes?.[id] === "reject").length;
  if (record.approvalRule === "all") return { done: approvals === reviewers.length || rejects > 0, approved: approvals === reviewers.length && reviewers.length > 0 };
  if (record.approvalRule === "majority") return { done: approvals > reviewers.length / 2 || rejects >= Math.ceil(reviewers.length / 2), approved: approvals > reviewers.length / 2 };
  return { done: approvals >= 1 || rejects >= 1, approved: approvals >= 1 };
}

async function voteAppeal(env, id, reviewerId, vote, note = "") {
  const item = await readJson(env, `appeal:${id}`, null);
  if (!item || !(item.reviewerIds || []).includes(reviewerId)) return { ok: false, message: "没有该审核案件。" };
  item.votes ||= {}; item.voteNotes ||= {}; item.votes[reviewerId] = vote; item.voteNotes[reviewerId] = note;
  const state = appealApprovalReached(item); if (state.done) { item.status = state.approved ? "approved" : "rejected"; item.result = note || (state.approved ? "申诉通过" : "申诉驳回"); item.reviewedAt = new Date().toISOString(); }
  await dbPut(env, `appeal:${id}`, JSON.stringify(item));
  return { ok: true, item };
}

async function processConflictSignal(env, { groupId, userId, senderName, text, botId }) {
  const rough = /滚|闭嘴|垃圾|废物|智障|傻逼|妈的|操你|去死|有病|恶心|人身攻击|吵架/i.test(text);
  const state = await readJson(env, `conflict:${groupId}`, { stage: 0, updatedAt: 0, participants: [] });
  if (!rough && Date.now() - Number(state.updatedAt || 0) > 10 * 60 * 1000) return null;
  let conflict = rough;
  try {
    const logs = (await readJson(env, `recent_logs:${groupId}`, [])).slice(-12).join("\n");
    const result = await callGemmaDecision(env, {
      system: "判断QQ群最近对话是否正在发生真实持续争吵或人身攻击。只输出JSON：{\"conflict\":true/false,\"severity\":0-3}。玩笑互呛应为false。",
      prompt: logs,
      maxOutputTokens: 80
    });
    const obj = JSON.parse(result.text.match(/\{[\s\S]*\}/)?.[0] || "{}"); conflict = Boolean(obj.conflict);
  } catch {}
  if (!conflict) { if (state.stage) await dbDel(env, `conflict:${groupId}`); return null; }
  state.stage = Math.min(3, Number(state.stage || 0) + 1); state.updatedAt = Date.now(); state.participants = [...new Set([...(state.participants || []), userId])];
  await dbPut(env, `conflict:${groupId}`, JSON.stringify(state));
  if (state.stage === 1) return { replyText: "先停一下，语气已经有点冲了。把事情说清楚就好，别继续针对人。" };
  if (state.stage === 2) return { replyText: "已经提醒过一次了，请停止人身攻击和持续争吵。继续下去会通知管理处理。" };
  let adminMentions = [];
  try {
    const members = await callOneBotAction(env, { action: "get_group_member_list", params: { group_id: numericId(groupId), no_cache: false } }, 12000);
    adminMentions = (Array.isArray(members) ? members : []).filter(m => ["owner", "admin"].includes(m.role)).map(m => String(m.user_id)).filter(id => id && id !== botId);
  } catch {}
  await notifyDeveloper(env, `【群冲突升级】\n群号：${groupId}\n参与QQ：${state.participants.join('、')}\n已进行两次劝阻，请决定是否交给其他管理。`);
  return { replyText: "群内冲突持续，已经两次劝阻无效，请人工处理。", mentionIds: adminMentions };
}


function moderationActionLabel(action) {
  return ({
    kick: "踢出群聊",
    mute: "禁言",
    unmute: "解除禁言",
    whole_mute: "开启全员禁言",
    whole_unmute: "解除全员禁言",
    set_admin: "设为管理员",
    unset_admin: "取消管理员"
  })[action] || action;
}

function moderationActionNeedsTarget(action) {
  return ["kick", "mute", "unmute", "set_admin", "unset_admin"].includes(action);
}

function parseModerationConfirmation(text) {
  const value = String(text || "").trim();
  // 为避免普通聊天中的“确认／取消”误触发，必须带 op；“确认op”代表本群最近一笔待处理提案。
  const confirm = value.match(/^[!！]?(?:确认|确认|同意执行|同意執行|执行|執行)\s*(op(?:_[a-z0-9_-]+)?)$/i);
  if (confirm) return { type: "confirm", id: /^op$/i.test(confirm[1]) ? "" : confirm[1], alias: /^op$/i.test(confirm[1]) ? "latest" : "explicit" };
  const cancel = value.match(/^[!！]?(?:取消操作|取消执行|取消執行|取消)\s*(op(?:_[a-z0-9_-]+)?)$/i);
  if (cancel) return { type: "cancel", id: /^op$/i.test(cancel[1]) ? "" : cancel[1], alias: /^op$/i.test(cancel[1]) ? "latest" : "explicit" };
  return null;
}

function localModerationIntent(text) {
  const value = String(text || "").trim();
  const direct = value.match(/(?:QQ[:： ]*)?(\d{5,})/i)?.[1] || "";
  const hasMention = /@\d{5,}/.test(value);
  const imperativePrefix = /^(?:把|將|将|給我|给我|幫我|帮我|請|请|麻煩|麻烦|立刻|立即|馬上|马上|讓|让|快點|快点)/.test(value);
  const directActionStart = /^(?:踢出?|移出|请出|請出|杀了|殺了|斩了|斬了|清出去|禁言|闭麦|閉麥|解除禁言|解禁|全员禁言|全員禁言|解除全员禁言|解除全員禁言|设为管理员|設為管理員|取消管理员|取消管理員)/.test(value);
  const discussionOnly = /(?:吗|嗎|么|麼|是不是|是否|为什么|為什麼|怎么|怎麼|有人被|剛才|刚才|已經|已经|聽說|听说).{0,10}(?:踢|禁言|管理员|管理員)/.test(value) || /(?:踢|禁言|管理员|管理員).{0,8}(?:吗|嗎|么|麼|？|\?)/.test(value);
  const hasCommandShape = imperativePrefix || directActionStart || hasMention || Boolean(direct);
  if (!hasCommandShape || (discussionOnly && !imperativePrefix && !directActionStart)) return { action: "none", confidence: 0 };
  let action = "none";
  if (/(?:解除|取消).{0,5}(?:全员|全員)禁言/.test(value)) action = "whole_unmute";
  else if (/(?:开启|開啟|全员|全員).{0,5}禁言/.test(value) && !/@\d+/.test(value)) action = "whole_mute";
  else if (/(?:解除|取消|解开|解開|解禁).{0,6}(?:禁言|闭麦|閉麥)?/.test(value)) action = "unmute";
  else if (/(?:设|設|升|加).{0,8}(?:管理员|管理員)/.test(value)) action = "set_admin";
  else if (/(?:取消|撤销|撤銷|下掉).{0,8}(?:管理员|管理員)/.test(value)) action = "unset_admin";
  else if (/(?:踢|移出|请出|請出|杀了|殺了|斩了|斬了|清出去)/.test(value)) action = "kick";
  else if (/(?:禁言|闭麦|閉麥|关小黑屋|關小黑屋)/.test(value)) action = "mute";
  if (action === "none") return { action: "none", confidence: 0 };
  let durationSeconds = 0;
  const durationText = value.match(/(\d+(?:\.\d+)?\s*(?:秒|分(?:钟|鐘)?|小时|小時|天))/)?.[1] || "";
  if (durationText) durationSeconds = parseDurationSeconds(durationText);
  return { action, targetQq: direct, targetName: "", durationSeconds, confidence: 0.62, reason: "本地保守规则识别" };
}

async function classifyNaturalModerationIntent(env, text) {
  const source = String(text || "").trim();
  if (!/(?:踢|移出|请出|請出|杀了|殺了|斩了|斬了|禁言|闭麦|閉麥|全员禁言|全員禁言|管理员|管理員)/i.test(source)) {
    return { action: "none", confidence: 0 };
  }
  try {
    const result = await callGemmaDecision(env, {
      system: `你是QQ群管理意图解析器。只有当发言明显是在要求机器人执行群管理操作时才识别；闲聊、比喻、引用、讨论某人被踢或玩笑不得识别。只输出JSON，不要Markdown：{"action":"none|kick|mute|unmute|whole_mute|whole_unmute|set_admin|unset_admin","targetQq":"数字或空","targetName":"昵称或空","durationSeconds":数字,"confidence":0到1,"reason":"简短原因"}。中文“杀了/斩了/清出去”在明确命令语境中表示kick。禁言未给时长默认600秒。`,
      prompt: source.slice(0, 1200),
      maxOutputTokens: 180,
      deadlineAt: Date.now() + 9000,
      maxAttempts: 2
    });
    const obj = JSON.parse(result.text.match(/\{[\s\S]*\}/)?.[0] || "{}");
    const allowed = ["none", "kick", "mute", "unmute", "whole_mute", "whole_unmute", "set_admin", "unset_admin"];
    if (!allowed.includes(obj.action)) return localModerationIntent(source);
    return {
      action: obj.action,
      targetQq: String(obj.targetQq || "").replace(/\D/g, ""),
      targetName: String(obj.targetName || "").trim(),
      durationSeconds: Number(obj.durationSeconds || 0),
      confidence: Number(obj.confidence || 0),
      reason: String(obj.reason || "Gemma 识别")
    };
  } catch (error) {
    console.warn("moderation classifier fallback:", error?.message || error);
    return localModerationIntent(source);
  }
}

async function getGroupMemberSafe(env, groupId, userId) {
  if (!groupId || !userId) return null;
  try {
    return await callOneBotAction(env, {
      action: "get_group_member_info",
      params: { group_id: numericId(groupId), user_id: numericId(userId), no_cache: false }
    }, 10000);
  } catch {
    const cached = await readJson(env, `group_members:${groupId}`, []);
    const item = cached.find(m => String(m.qq || m.user_id) === String(userId));
    return item ? { user_id: numericId(userId), nickname: item.name || "", card: item.name || "", role: item.role || "member" } : null;
  }
}

async function resolveModerationTarget(env, { groupId, targetMentionQqs = [], intent, botId }) {
  let targetQq = String(intent?.targetQq || targetMentionQqs[0] || "").replace(/\D/g, "");
  if (targetQq && targetQq !== String(botId || "")) {
    const member = await getGroupMemberSafe(env, groupId, targetQq);
    return { ok: true, targetQq, member, targetName: member?.card || member?.nickname || targetQq };
  }
  const targetName = String(intent?.targetName || "").trim().replace(/^[@＠]/, "");
  if (!targetName) return { ok: false, reason: "missing", matches: [] };
  let members = [];
  try {
    const data = await callOneBotAction(env, { action: "get_group_member_list", params: { group_id: numericId(groupId), no_cache: false } }, 12000);
    members = Array.isArray(data) ? data : [];
  } catch {
    members = await readJson(env, `group_members:${groupId}`, []);
  }
  const norm = value => String(value || "").trim().toLowerCase();
  const wanted = norm(targetName);
  const exact = members.filter(m => [m.card, m.nickname, m.name].some(v => norm(v) === wanted));
  const partial = exact.length ? exact : members.filter(m => [m.card, m.nickname, m.name].some(v => norm(v).includes(wanted) || wanted.includes(norm(v))));
  const matches = partial.filter(m => String(m.user_id || m.qq || "") !== String(botId || "")).slice(0, 8);
  if (matches.length !== 1) return { ok: false, reason: matches.length ? "ambiguous" : "not_found", matches };
  const member = matches[0];
  targetQq = String(member.user_id || member.qq || "");
  return { ok: true, targetQq, member, targetName: member.card || member.nickname || member.name || targetName };
}

async function reviewGroupWorkWithGemma(env, type, content) {
  try {
    const result = await callGemmaDecision(env, {
      system: "你是群务辅助审查器。你只能输出 JSON：{\"decision\":\"suggest_approve|owner_review\",\"reason\":\"简短原因\"}。可以建议同意，但绝不能代替群主拒绝，也绝不能执行。遇到不确定、隐私、文件风险或可能骚扰时输出 owner_review。",
      prompt: JSON.stringify({ type, content: String(content || "").slice(0, 3000) }),
      maxOutputTokens: 100
    });
    const parsed = JSON.parse(result.text.match(/\{[\s\S]*\}/)?.[0] || "{}");
    return { decision: parsed.decision === "suggest_approve" ? "suggest_approve" : "owner_review", reason: String(parsed.reason || "请群主核对") };
  } catch (error) {
    return { decision: "owner_review", reason: "AI 辅助审查暂时不可用，请群主人工核对" };
  }
}

async function joinRequestPatternHash(comment, subType = "add") {
  const normalized = `${String(subType || "add").toLowerCase()}|${String(comment || "").toLowerCase().replace(/\s+/g, " ").trim()}`;
  const bytes = new TextEncoder().encode(normalized);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

async function readJoinPattern(env, groupId, hash) {
  return readJson(env, `joinpattern:${groupId}:${hash}`, { hash, approvedCount: 0, rejectedCount: 0 });
}

async function recordJoinPatternDecision(env, groupId, hash, comment, decision) {
  const item = await readJoinPattern(env, groupId, hash);
  item.comment = String(comment || "").slice(0, 1000);
  item[decision === "approved" ? "approvedCount" : "rejectedCount"] = Number(item[decision === "approved" ? "approvedCount" : "rejectedCount"] || 0) + 1;
  item.lastDecision = decision;
  item.updatedAt = Date.now();
  await dbPut(env, `joinpattern:${groupId}:${hash}`, JSON.stringify(item));
  return item;
}

async function reviewJoinRequestAssist(env, requestInfo) {
  try {
    const result = await callGemmaDecision(env, {
      system: `你是入群申請輔助審查器。只能輸出 JSON：{"decision":"suggest_approve|suggest_reject|owner_review","confidence":0到1,"reason":"原因"}。只有明顯滿足群規時建議同意；只有明顯廣告、詐騙、惡意騷擾或明確違反入群要求時建議拒絕；不確定必須 owner_review。`,
      prompt: JSON.stringify(requestInfo).slice(0, 4000),
      maxOutputTokens: 140
    });
    const parsed = JSON.parse(result.text.match(/\{[\s\S]*\}/)?.[0] || "{}");
    const decision = ["suggest_approve", "suggest_reject"].includes(parsed.decision) ? parsed.decision : "owner_review";
    return { decision, confidence: Math.max(0, Math.min(1, Number(parsed.confidence || 0))), reason: String(parsed.reason || "请管理核对") };
  } catch {
    return { decision: "owner_review", confidence: 0, reason: "AI 辅助审查暂时不可用" };
  }
}

async function createJoinRequestAssist(env, body) {
  const groupId = String(body.group_id || "");
  const comment = String(body.comment || "");
  const subType = String(body.sub_type || "add");
  const patternHash = await joinRequestPatternHash(comment, subType);
  const pattern = await readJoinPattern(env, groupId, patternHash);
  const threshold = Math.max(1, parseUnlimitedNonNegativeInteger(await dbGet(env, `join_pattern_auto_approve_threshold:${groupId}`), DEFAULTS.joinPatternAutoApproveThreshold));

  if (Number(pattern.approvedCount || 0) >= threshold && Number(pattern.rejectedCount || 0) === 0) {
    try {
      await callOneBotAction(env, { action: "set_group_add_request", params: { flag: String(body.flag || ""), sub_type: subType, approve: true, reason: "" } }, 15000);
      const id = `jr_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 6)}`;
      const item = { id, groupId, userId: String(body.user_id || ""), flag: String(body.flag || ""), subType, comment, patternHash, review: { decision: "cached_approve", reason: `相同申请方式已获准 ${pattern.approvedCount} 次` }, status: "approved_cached", createdAt: Date.now() };
      await dbPut(env, `joinrequest:${id}`, JSON.stringify(item));
      await appendIndex(env, `joinrequest:index:${groupId}`, id, 1000);
      await recordJoinPatternDecision(env, groupId, patternHash, comment, "approved");
      return item;
    } catch (error) { console.warn("cached join approval failed", error); }
  }

  const review = await reviewJoinRequestAssist(env, { groupId, userId: String(body.user_id || ""), comment, subType });
  const rejectAuthorized = await dbGet(env, `join_reject_authorized:${groupId}`) === "true";
  if (review.decision === "suggest_reject" && rejectAuthorized && review.confidence >= 0.92) {
    const id = `jr_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 6)}`;
    const item = { id, groupId, userId: String(body.user_id || ""), flag: String(body.flag || ""), subType, comment, patternHash, review, status: "rejected_ai", createdAt: Date.now() };
    try {
      await callOneBotAction(env, { action: "set_group_add_request", params: { flag: item.flag, sub_type: subType, approve: false, reason: String(review.reason || "不符合入群要求").slice(0, 120) } }, 15000);
      await recordJoinPatternDecision(env, groupId, patternHash, comment, "rejected");
    } catch (error) { item.status = "reject_failed"; item.result = String(error?.message || error); }
    await dbPut(env, `joinrequest:${id}`, JSON.stringify(item));
    await appendIndex(env, `joinrequest:index:${groupId}`, id, 1000);
    return item;
  }

  const id = `jr_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 6)}`;
  const item = { id, groupId, userId: String(body.user_id || ""), flag: String(body.flag || ""), subType, comment, patternHash, review, status: "pending_management", createdAt: Date.now() };
  await dbPut(env, `joinrequest:${id}`, JSON.stringify(item));
  await appendIndex(env, `joinrequest:index:${groupId}`, id, 1000);
  try {
    const members = await callOneBotAction(env, { action: "get_group_member_list", params: { group_id: numericId(groupId), no_cache: false } }, 15000);
    const list = Array.isArray(members) ? members : members?.data || [];
    for (const manager of list.filter(member => ["owner", "admin"].includes(member.role)).slice(0, 10)) {
      await callOneBotAction(env, { action: "send_private_msg", params: { user_id: numericId(manager.user_id), message: `【入群申请辅助】\n编号：${id}\n群号：${groupId}\n申请人：${item.userId}\n附言：${item.comment || "无"}\nAI 意见：${review.decision === "suggest_approve" ? "建议同意" : review.decision === "suggest_reject" ? "建议人工核对拒绝" : "请人工核对"}（${review.reason}）\n同意：确认入群 ${id}\n忽略：忽略入群 ${id}`, auto_escape: false } }, 12000);
    }
  } catch (error) { console.warn("notify management for join request failed", error); }
  return item;
}

async function decideJoinRequestAssist(env, { groupId, actorId, id, decision }) {
  const item = await readJson(env, `joinrequest:${id}`, null);
  if (!item || String(item.groupId) !== String(groupId)) return { ok: false, message: "找不到该入群申请。" };
  const actorRole = await resolvePortalRole(env, String(actorId), String(groupId));
  const actorPermissions = await getEffectivePermissions(env, String(groupId), String(actorId), actorRole, isDeveloperId(env, actorId));
  if (!(actorPermissions.aiAdmin || actorPermissions.groupOps || actorPermissions.nativeAdmin || actorPermissions.developer)) return { ok: false, message: "缺少管理权限，无法处理入群申请。" };
  if (decision === "ignore") {
    item.status = "ignored"; item.decidedAt = Date.now(); item.decidedBy = String(actorId);
    await dbPut(env, `joinrequest:${id}`, JSON.stringify(item));
    return { ok: true, message: "已忽略该申请；没有发送拒绝操作。" };
  }
  try {
    await callOneBotAction(env, { action: "set_group_add_request", params: { flag: item.flag, sub_type: item.subType || "add", approve: true, reason: "" } }, 15000);
    item.status = "approved"; item.decidedAt = Date.now(); item.decidedBy = String(actorId);
    await dbPut(env, `joinrequest:${id}`, JSON.stringify(item));
    if (item.patternHash) await recordJoinPatternDecision(env, groupId, item.patternHash, item.comment, "approved");
    return { ok: true, message: "已由管理确认同意入群申请；相同申请方式已计入缓存。" };
  } catch (error) {
    item.status = "failed"; item.result = String(error?.message || error); await dbPut(env, `joinrequest:${id}`, JSON.stringify(item));
    return { ok: false, message: `同意申请失败：${item.result}` };
  }
}

function normalizeRuleProxyMode(value) {
  const mode = String(value || "").trim().toLowerCase();
  return ["record", "warn", "mute", "auto"].includes(mode) ? mode : "record";
}

function parseUnlimitedNonNegativeInteger(value, fallback = 0) {
  const text = String(value ?? "").trim();
  if (!text) return Math.max(0, Math.trunc(Number(fallback) || 0));
  const number = Number(text);
  if (!Number.isFinite(number) || number < 0) return Math.max(0, Math.trunc(Number(fallback) || 0));
  return Math.min(Number.MAX_SAFE_INTEGER, Math.trunc(number));
}

async function appendRuleViolationRecord(env, data) {
  const id = `rv_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`;
  const item = {
    id,
    groupId: String(data.groupId || ""),
    userId: String(data.userId || ""),
    senderName: String(data.senderName || data.userId || ""),
    content: String(data.content || "").slice(0, 4000),
    violationType: String(data.violationType || "其他").slice(0, 120),
    rule: String(data.rule || "").slice(0, 500),
    reason: String(data.reason || "").slice(0, 1000),
    confidence: Math.max(0, Math.min(1, Number(data.confidence || 0))),
    recommendedAction: String(data.recommendedAction || "record"),
    actionTaken: String(data.actionTaken || "none"),
    actionResult: String(data.actionResult || ""),
    messageId: String(data.messageId || ""),
    createdAt: Date.now()
  };
  await dbPut(env, `ruleviolation:${id}`, JSON.stringify(item));
  await appendIndex(env, `ruleviolation:index:${item.groupId}`, id, 10000);
  return item;
}

async function updateRuleViolationRecord(env, item, patch) {
  const next = { ...item, ...patch, updatedAt: Date.now() };
  await dbPut(env, `ruleviolation:${item.id}`, JSON.stringify(next));
  return next;
}

async function ruleProxyCooldownRemaining(env, groupId, userId) {
  const seconds = parseUnlimitedNonNegativeInteger(await dbGet(env, `moderation_target_cooldown_seconds:${groupId}`), DEFAULTS.moderationTargetCooldownSeconds);
  if (seconds <= 0) return 0;
  const key = `rule_proxy_last_action:${groupId}:${userId}`;
  const lastAt = Number(await dbGet(env, key) || 0);
  const remaining = seconds * 1000 - (Date.now() - lastAt);
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
}

async function performRuleProxyAction(env, item, review) {
  const mode = normalizeRuleProxyMode(await dbGet(env, `rule_proxy_mode:${item.groupId}`) || DEFAULTS.ruleProxyMode);
  if (mode === "record") return updateRuleViolationRecord(env, item, { actionTaken: "record_only", actionResult: "仅记录，未启用 AI 代理" });

  const remaining = await ruleProxyCooldownRemaining(env, item.groupId, item.userId);
  if (remaining > 0) return updateRuleViolationRecord(env, item, { actionTaken: "cooldown", actionResult: `处置冷却剩余 ${remaining} 秒；本次仍已记录` });

  let action = mode === "warn" ? "warn" : mode === "mute" ? "mute" : String(review.action || "warn").toLowerCase();
  if (!["warn", "mute", "kick"].includes(action)) action = "warn";
  const kickAuthorized = await dbGet(env, `rule_proxy_kick_authorized:${item.groupId}`) === "true";
  if (action === "kick" && !kickAuthorized) action = "mute";

  const botRole = (await getBotGroupRole(env, item.groupId)).role;
  const botCanModerate = botRole === "owner" || botRole === "admin";
  if ((action === "mute" || action === "kick") && !botCanModerate) action = "warn";

  let result = { ok: false, message: "未执行" };
  try {
    if (action === "warn") {
      await callOneBotAction(env, {
        action: "send_group_msg",
        params: {
          group_id: numericId(item.groupId),
          message: `[CQ:at,qq=${item.userId}] 群规警告：你的消息可能违反「${item.violationType}」。原因：${item.reason || item.rule || "请遵守群规"}`,
          auto_escape: false
        }
      }, 15000);
      result = { ok: true, message: "已发送警告" };
    } else if (action === "mute") {
      const configured = parseUnlimitedNonNegativeInteger(await dbGet(env, `rule_proxy_mute_seconds:${item.groupId}`), DEFAULTS.ruleProxyMuteSeconds);
      const suggested = parseUnlimitedNonNegativeInteger(review.muteSeconds, configured);
      const duration = Math.max(60, Math.min(30 * 24 * 3600, suggested || configured || 600));
      await callOneBotAction(env, { action: "set_group_ban", params: { group_id: numericId(item.groupId), user_id: numericId(item.userId), duration } }, 15000);
      result = { ok: true, message: `已禁言 ${duration} 秒` };
    } else if (action === "kick") {
      await callOneBotAction(env, { action: "set_group_kick", params: { group_id: numericId(item.groupId), user_id: numericId(item.userId), reject_add_request: false } }, 15000);
      result = { ok: true, message: "已踢出群聊" };
    }
  } catch (error) {
    result = { ok: false, message: String(error?.message || error) };
  }

  if (result.ok) await dbPut(env, `rule_proxy_last_action:${item.groupId}:${item.userId}`, String(Date.now()));
  await writeSystemAudit(env, { type: "rule_proxy_action", groupId: item.groupId, actorId: "system:rule_proxy", targetId: item.userId, action, result: result.message, violationId: item.id });
  return updateRuleViolationRecord(env, item, { actionTaken: action, actionResult: result.message, actionOk: result.ok });
}

async function inspectMessageAgainstGroupRules(env, { groupId, userId, senderName, text, messageId }) {
  // 缺省即开启；只有显式写入 false 才关闭。
  if (await dbGet(env, `rule_monitor_enabled:${groupId}`) === "false") return;
  const rules = String(await dbGet(env, `group_rules:${groupId}`) || "").trim();
  const content = String(text || "").trim();
  if (!rules || !content || content.length < 2) return;

  let review;
  try {
    const result = await callGemmaDecision(env, {
      system: `你是群規合規分類器。只能輸出 JSON：{"violation":true|false,"confidence":0到1,"violationType":"違規項目分類","rule":"涉及群規","reason":"簡短原因","action":"record|warn|mute|kick","muteSeconds":整數}。只有明顯違反提供的群規時才判 true；不確定必須 false。action 只是建議，系統會按授權範圍決定是否執行。`,
      prompt: JSON.stringify({ rules, message: content, userId, senderName }).slice(0, 6000),
      maxOutputTokens: 220
    });
    review = JSON.parse(result.text.match(/\{[\s\S]*\}/)?.[0] || "{}");
  } catch (error) {
    console.warn("群规监控判定失败", error);
    return;
  }
  if (review?.violation !== true || Number(review.confidence || 0) < 0.72) return;

  const item = await appendRuleViolationRecord(env, {
    groupId, userId, senderName, content,
    violationType: review.violationType || review.rule || "其他",
    rule: review.rule || "",
    reason: review.reason || "",
    confidence: review.confidence,
    recommendedAction: review.action || "record",
    messageId
  });
  await performRuleProxyAction(env, item, review);
}

async function createGroupWorkRequest(env, data) {
  const id = `gw_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 6)}`;
  const review = await reviewGroupWorkWithGemma(env, data.type, data.content || data.file || "");
  const item = {
    id, status: "pending_owner", groupId: String(data.groupId), creatorId: String(data.creatorId),
    creatorName: String(data.creatorName || data.creatorId), type: String(data.type), content: String(data.content || "").slice(0, 5000),
    file: String(data.file || "").slice(0, 2000), fileName: String(data.fileName || "").slice(0, 255), sourceMessageId: String(data.sourceMessageId || ""),
    review, createdAt: Date.now(), expiresAt: Date.now() + 24 * 60 * 60 * 1000
  };
  await dbPut(env, `groupwork:${id}`, JSON.stringify(item));
  await appendIndex(env, `groupwork:index:${item.groupId}`, id, 500);
  await writeSystemAudit(env, { type: "groupwork_requested", groupId: item.groupId, actorId: item.creatorId, action: item.type, requestId: id });
  return item;
}

async function executeGroupWorkRequest(env, item, ownerId) {
  if (!(await canUseBotGroupOperations(env, item.groupId, ownerId))) return { ok: false, message: "缺少群操作权限，无法执行群公告、群待办或群文件操作。" };
  try {
    if (item.type === "notice") {
      await callOneBotAction(env, { action: "_send_group_notice", params: { group_id: numericId(item.groupId), content: item.content } }, 15000);
      return { ok: true, message: "群公告已由群主授权发布。" };
    }
    if (item.type === "todo") {
      const sent = await callOneBotAction(env, { action: "send_group_msg", params: { group_id: numericId(item.groupId), message: item.content, auto_escape: false } }, 15000);
      const messageId = sent?.message_id ?? sent?.messageId ?? sent?.data?.message_id ?? sent?.data?.messageId;
      if (!messageId) throw new Error("发送待办内容后未取得 message_id");
      await callOneBotAction(env, { action: "set_group_todo", params: { group_id: numericId(item.groupId), message_id: String(messageId) } }, 15000);
      return { ok: true, message: "群待办已由群主授权建立。" };
    }
    if (item.type === "file") {
      if (!item.file) return { ok: false, message: "群文件缺少可上传的 URL 或 NapCat 可访问路径。" };
      await callOneBotAction(env, { action: "upload_group_file", params: { group_id: numericId(item.groupId), file: item.file, name: item.fileName || "QQAI上传文件", folder_id: "/" } }, 60000);
      return { ok: true, message: "群文件已由群主授权上传。" };
    }
    return { ok: false, message: "未知群务类型。" };
  } catch (error) {
    return { ok: false, message: `群务执行失败：${error?.message || error}` };
  }
}

async function handleGroupWorkDecision(env, { groupId, actorId, id, decision }) {
  const item = await readJson(env, `groupwork:${id}`, null);
  if (!item || String(item.groupId) !== String(groupId)) return { ok: false, message: "找不到该群务确认单。" };
  if (item.status !== "pending_owner") return { ok: false, message: `该群务当前状态为 ${item.status}。` };
  if (!(await canUseBotGroupOperations(env, groupId, actorId))) return { ok: false, message: "只有 QQ 管理员、群主、开发者或获授群操作权限者可以处理该群务确认单。" };
  if (decision === "cancel") {
    item.status = "cancelled"; item.decidedAt = Date.now(); item.decidedBy = String(actorId);
    await dbPut(env, `groupwork:${id}`, JSON.stringify(item));
    return { ok: true, message: `群务 ${id} 已取消，未执行。` };
  }
  const result = await executeGroupWorkRequest(env, item, actorId);
  item.status = result.ok ? "executed" : "failed"; item.decidedAt = Date.now(); item.decidedBy = String(actorId); item.result = result.message;
  await dbPut(env, `groupwork:${id}`, JSON.stringify(item));
  await writeSystemAudit(env, { type: "groupwork_decided", groupId, actorId, action: item.type, requestId: id, result: result.ok ? "executed" : "failed" });
  return result;
}

async function createModerationProposal(env, data) {
  const now = Date.now();
  const cooldownSeconds = Math.max(0, Number(await dbGet(env, `moderation_target_cooldown_seconds:${data.groupId}`) || DEFAULTS.moderationTargetCooldownSeconds));
  const cooldownKey = data.targetId ? `moderation:target_cooldown:${data.groupId}:${data.action}:${data.targetId}` : "";
  if (cooldownKey && cooldownSeconds > 0) {
    const lastAt = Number(await dbGet(env, cooldownKey) || 0);
    if (lastAt && now - lastAt < cooldownSeconds * 1000) {
      throw new Error(`同一对象处置仍在冷却中，请在 ${Math.ceil((cooldownSeconds * 1000 - (now - lastAt)) / 1000)} 秒后重试。`);
    }
    await dbPut(env, cooldownKey, String(now));
  }
  const id = `op_${now.toString(36)}_${crypto.randomUUID().slice(0, 6)}`;
  const proposal = {
    id,
    status: "pending",
    createdAt: now,
    expiresAt: now + DEFAULTS.moderationProposalTtlMs,
    groupId: String(data.groupId || ""),
    actorId: String(data.actorId || ""),
    actorName: String(data.actorName || data.actorId || ""),
    actorRole: String(data.actorRole || "member"),
    action: data.action,
    targetId: String(data.targetId || ""),
    targetName: String(data.targetName || data.targetId || ""),
    targetRole: String(data.targetRole || "member"),
    durationSeconds: Number(data.durationSeconds || 0),
    rejectAddRequest: Boolean(data.rejectAddRequest),
    sourceText: String(data.sourceText || "").slice(0, 1000),
    classifierReason: String(data.classifierReason || ""),
    messageId: String(data.messageId || "")
  };
  await dbPut(env, `moderation:proposal:${id}`, JSON.stringify(proposal));
  await dbPut(env, `moderation:last:${proposal.groupId}:${proposal.actorId}`, id);
  await dbPut(env, `moderation:last:${proposal.groupId}`, id);
  await appendIndex(env, `moderation:proposal:index:${proposal.groupId}`, id, 500);
  await writeSystemAudit(env, { type: "moderation_proposed", groupId: proposal.groupId, actorId: proposal.actorId, targetId: proposal.targetId, action: proposal.action, proposalId: id });
  return proposal;
}

function formatModerationProposal(proposal) {
  const targetLine = moderationActionNeedsTarget(proposal.action)
    ? `\n目标：${proposal.targetName || proposal.targetId}（QQ:${proposal.targetId}）`
    : "";
  const durationLine = proposal.action === "mute" ? `\n时长：${formatDuration(proposal.durationSeconds || 600)}` : "";
  return `⚠️ 已建立待确认操作\n编号：${proposal.id}\n动作：${moderationActionLabel(proposal.action)}${targetLine}${durationLine}\n识别原因：${proposal.classifierReason || "管理指令"}\n请在 2 分钟内发送「确认 ${proposal.id}」执行，或发送「取消 ${proposal.id}」。未确认不会执行任何群操作。`;
}

async function validateModerationProposalTarget(env, proposal, confirmerRole, confirmerId) {
  if (!moderationActionNeedsTarget(proposal.action)) return { ok: true };
  const developerId = String(env.DEVELOPER_ID || DEFAULT_DEVELOPER_ID);
  if (!proposal.targetId) return { ok: false, message: "操作缺少明确目标。" };
  if (proposal.targetId === String(confirmerId)) return { ok: false, message: "不能对自己执行该操作。" };
  if (proposal.targetId === developerId) return { ok: false, message: "不能对核心开发者执行该操作。" };
  const target = await getGroupMemberSafe(env, proposal.groupId, proposal.targetId);
  const targetRole = target?.role || proposal.targetRole || "member";
  if (targetRole === "owner") return { ok: false, message: "不能对群主执行该操作。" };
  if (targetRole === "admin" && !["owner", "developer"].includes(confirmerRole)) return { ok: false, message: "管理员不能对其他管理员执行该操作，必须由群主确认。" };
  if (["set_admin", "unset_admin"].includes(proposal.action) && !(await isBotVerifiedGroupOwner(env, proposal.groupId))) {
    return { ok: false, message: "机器人账号当前不是本群群主，无法新增或撤除真正 QQ 管理员。" };
  }
  return { ok: true, target };
}

async function executeModerationProposal(env, proposal, confirmer) {
  const validation = await validateModerationProposalTarget(env, proposal, confirmer.role, confirmer.id);
  if (!validation.ok) return { ok: false, message: validation.message };
  const group_id = numericId(proposal.groupId);
  const user_id = numericId(proposal.targetId);
  let action = "";
  let params = {};
  if (proposal.action === "kick") { action = "set_group_kick"; params = { group_id, user_id, reject_add_request: Boolean(proposal.rejectAddRequest) }; }
  else if (proposal.action === "mute") { action = "set_group_ban"; params = { group_id, user_id, duration: Math.max(60, Math.min(30 * 24 * 3600, Number(proposal.durationSeconds || 600))) }; }
  else if (proposal.action === "unmute") { action = "set_group_ban"; params = { group_id, user_id, duration: 0 }; }
  else if (proposal.action === "whole_mute") { action = "set_group_whole_ban"; params = { group_id, enable: true }; }
  else if (proposal.action === "whole_unmute") { action = "set_group_whole_ban"; params = { group_id, enable: false }; }
  else if (proposal.action === "set_admin") { action = "set_group_admin"; params = { group_id, user_id, enable: true }; }
  else if (proposal.action === "unset_admin") { action = "set_group_admin"; params = { group_id, user_id, enable: false }; }
  else return { ok: false, message: "未知群操作。" };
  const result = await runOneBotGroupOperation(env, action, params, {
    actorId: confirmer.id,
    groupId: proposal.groupId,
    targetId: proposal.targetId,
    action: moderationActionLabel(proposal.action),
    proposalId: proposal.id
  });
  return result.ok ? { ok: true, message: `已执行：${moderationActionLabel(proposal.action)}。` } : { ok: false, message: `操作失败：${result.error}` };
}

async function findLatestPendingModerationProposalId(env, groupId) {
  const pointer = String(await dbGet(env, `moderation:last:${groupId}`) || "");
  if (pointer) {
    const proposal = await readJson(env, `moderation:proposal:${pointer}`, null);
    if (proposal?.status === "pending" && Number(proposal.expiresAt || 0) >= Date.now()) return pointer;
  }
  const ids = await readJson(env, `moderation:proposal:index:${groupId}`, []);
  for (const id of ids.slice().reverse()) {
    const proposal = await readJson(env, `moderation:proposal:${id}`, null);
    if (proposal?.status === "pending" && Number(proposal.expiresAt || 0) >= Date.now()) return String(id);
  }
  return "";
}

async function retractModerationProposalMessage(env, proposal, reason = "resolved") {
  if (!proposal?.notificationMessageId || proposal.notificationRetractedAt) return { ok: true, skipped: true };
  try {
    await callOneBotAction(env, { action: "delete_msg", params: { message_id: numericId(proposal.notificationMessageId) } }, 10000);
    proposal.notificationRetractedAt = Date.now();
    proposal.notificationRetractReason = reason;
    proposal.notificationRetractStatus = "success";
    return { ok: true };
  } catch (error) {
    proposal.notificationRetractStatus = "failed";
    proposal.notificationRetractError = String(error?.message || error);
    return { ok: false, error: proposal.notificationRetractError };
  }
}

async function attachModerationProposalMessage(env, proposalId, messageId, groupId) {
  if (!proposalId || !messageId) return;
  const proposal = await readJson(env, `moderation:proposal:${proposalId}`, null);
  if (!proposal || (groupId && String(proposal.groupId) !== String(groupId))) return;
  proposal.notificationMessageId = String(messageId);
  proposal.notificationSentAt = Date.now();
  if (proposal.status !== "pending" || Date.now() > Number(proposal.expiresAt || 0)) {
    if (proposal.status === "pending") proposal.status = "expired";
    await retractModerationProposalMessage(env, proposal, proposal.status || "expired");
  }
  await dbPut(env, `moderation:proposal:${proposal.id}`, JSON.stringify(proposal));
  if (proposal.status === "pending" && Number(proposal.expiresAt || 0) > Date.now()) {
    try {
      await getOneBotHub(env).fetch("https://onebot-hub/moderation/expiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalId: proposal.id, expiresAt: proposal.expiresAt })
      });
    } catch (error) {
      console.warn("schedule moderation expiry alarm failed", error);
    }
  }
}

async function handleModerationConfirmation(env, { groupId, actorId, actorRole, isDeveloper, hasGroupOpsPermission = false, confirmation }) {
  let id = String(confirmation.id || "").trim();
  if (!id) id = await findLatestPendingModerationProposalId(env, groupId);
  if (!id) return { handled: true, ok: false, message: "本群目前没有可处理的待确认操作。" };
  const proposal = await readJson(env, `moderation:proposal:${id}`, null);
  if (!proposal || String(proposal.groupId) !== String(groupId)) return { handled: true, ok: false, message: "找不到该待确认操作。" };
  if (proposal.status !== "pending") return { handled: true, ok: false, message: `该操作当前状态为 ${proposal.status}，不能重复处理。` };
  if (Date.now() > Number(proposal.expiresAt || 0)) {
    proposal.status = "expired";
    proposal.expiredAt = Date.now();
    await retractModerationProposalMessage(env, proposal, "expired");
    await dbPut(env, `moderation:proposal:${id}`, JSON.stringify(proposal));
    return { handled: true, ok: false, message: "该操作已超过 2 分钟确认期限，未执行；原提案提示已撤回。" };
  }
  const adminRoleChange = ["set_admin", "unset_admin"].includes(proposal.action);
  const botIsOwner = adminRoleChange ? await isBotVerifiedGroupOwner(env, groupId) : false;
  const nativeManagerOrAbove = isDeveloper || actorRole === "owner" || actorRole === "admin";
  const grantedGroupOps = Boolean(hasGroupOpsPermission);
  const canConfirm = adminRoleChange
    ? (botIsOwner && (nativeManagerOrAbove || grantedGroupOps))
    : (nativeManagerOrAbove || grantedGroupOps);
  if (!canConfirm) {
    return { handled: true, ok: false, message: adminRoleChange
      ? "只有机器人账号本身是本群群主时，才可新增或撤除真正 QQ 管理员。"
      : "只有 QQ 管理员、群主或开发者可以处理该提案。" };
  }
  if (confirmation.type === "cancel") {
    proposal.status = "cancelled";
    proposal.cancelledAt = Date.now();
    proposal.cancelledBy = String(actorId);
    await retractModerationProposalMessage(env, proposal, "cancelled");
    await dbPut(env, `moderation:proposal:${id}`, JSON.stringify(proposal));
    await writeSystemAudit(env, { type: "moderation_cancelled", groupId, actorId, proposalId: id });
    return { handled: true, ok: true, message: `已取消操作 ${id}，未执行任何群管理动作；原提案提示已撤回。` };
  }
  const result = await executeModerationProposal(env, proposal, { id: String(actorId), role: isDeveloper ? "developer" : actorRole });
  proposal.status = result.ok ? "executed" : "failed";
  proposal.executedAt = Date.now();
  proposal.executedBy = String(actorId);
  proposal.result = result.message;
  await dbPut(env, `moderation:proposal:${id}`, JSON.stringify(proposal));
  return { handled: true, ok: result.ok, message: `${result.message}\n操作编号：${id}` };
}

async function detectNaturalModerationProposal(env, { groupId, actorId, actorName, actorRole, isDeveloper, text, targetMentionQqs, botId, messageId }) {
  if (!groupId || !(isDeveloper || ["owner", "admin"].includes(actorRole))) return null;
  const intent = await classifyNaturalModerationIntent(env, text);
  if (!intent || intent.action === "none" || Number(intent.confidence || 0) < 0.55) return null;
  if (["set_admin", "unset_admin"].includes(intent.action) && !(await isBotVerifiedGroupOwner(env, groupId))) {
    return { handled: true, message: "机器人账号当前不是本群群主，因此不会显示或建立真正 QQ 管理员任免操作。" };
  }
  let target = { ok: true, targetQq: "", targetName: "", member: null };
  if (moderationActionNeedsTarget(intent.action)) {
    target = await resolveModerationTarget(env, { groupId, targetMentionQqs, intent, botId });
    if (!target.ok) {
      if (target.reason === "ambiguous") {
        const choices = target.matches.map(m => `${m.card || m.nickname || m.name || "成员"}(QQ:${m.user_id || m.qq})`).join("、");
        return { handled: true, message: `目标昵称不唯一：${choices}。请直接 @ 要操作的成员后再说一次。` };
      }
      return { handled: true, message: "我识别到群管理意图，但无法确定目标。请直接 @ 对方后再说一次；未执行任何操作。" };
    }
  }
  const proposal = await createModerationProposal(env, {
    groupId,
    actorId,
    actorName,
    actorRole: isDeveloper ? "developer" : actorRole,
    action: intent.action,
    targetId: target.targetQq,
    targetName: target.targetName,
    targetRole: target.member?.role || "member",
    durationSeconds: intent.action === "mute" ? Math.max(60, Number(intent.durationSeconds || 600)) : 0,
    sourceText: text,
    classifierReason: intent.reason || "AI 识别管理意图",
    messageId
  });
  return { handled: true, proposal, message: formatModerationProposal(proposal) };
}

async function listModerationProposals(env, groupId, { limit = 100 } = {}) {
  const ids = await readJson(env, `moderation:proposal:index:${groupId}`, []);
  const items = [];
  for (const id of ids.slice(-Math.max(1, Math.min(500, Number(limit || 100)))).reverse()) {
    const proposal = await readJson(env, `moderation:proposal:${id}`, null);
    if (proposal) items.push(proposal);
  }
  return items;
}

function maskSecret(value) {
  const text = String(value || "");
  if (!text) return "未设置";
  if (text.length <= 8) return `${text.slice(0, 2)}••••`;
  return `${text.slice(0, 4)}••••••${text.slice(-3)}`;
}

async function runTimedHealthCheck(name, fn, options = {}) {
  const startedAt = Date.now();
  try {
    const detail = await withTimeout(Promise.resolve().then(fn), Number(options.timeoutMs || 12000), `HEALTH_${name}_TIMEOUT`);
    return { name, status: "ok", latencyMs: Date.now() - startedAt, detail: detail ?? null, checkedAt: new Date().toISOString() };
  } catch (error) {
    return { name, status: options.optional ? "warning" : "error", latencyMs: Date.now() - startedAt, error: String(error?.message || error), checkedAt: new Date().toISOString() };
  }
}

async function runHealthChecks(env, { mode = "quick" } = {}) {
  const checks = [];
  checks.push(await runTimedHealthCheck("D1 Database", async () => {
    if (!env.DB) throw new Error("DB_NOT_BOUND");
    if (mode === "full") {
      const key = `health:test:${crypto.randomUUID()}`;
      await dbPut(env, key, "ok");
      const value = await dbGet(env, key);
      await dbDel(env, key);
      if (value !== "ok") throw new Error("D1_WRITE_READ_MISMATCH");
      return "读写删除正常";
    }
    const row = await env.DB.prepare("SELECT 1 AS ok").first();
    if (!row?.ok) throw new Error("D1_QUERY_FAILED");
    return "查询正常";
  }, { timeoutMs: 10000 }));

  checks.push(await runTimedHealthCheck("Durable Object / NapCat", async () => {
    if (!env.ONEBOT_HUB) throw new Error("ONEBOT_HUB_NOT_BOUND");
    const state = await (await getOneBotHub(env).fetch("https://onebot-hub/status")).json();
    if (!state.connected) throw new Error("NAPCAT_NOT_CONNECTED");
    return { connected: true, sockets: state.sockets, pendingRpc: state.pendingRpc, inFlightQuestions: state.inFlightQuestions, queuedQuestions: state.queuedQuestions, lastHeartbeatAt: state.lastHeartbeatAt };
  }, { timeoutMs: 10000 }));

  const keys = roundRobinKeys([...new Set([...parseList(env.GEMINI_API_KEYS), ...parseList(env.VECTORIZE_GEMINI_KEYS)])], "gemini");
  checks.push(await runTimedHealthCheck("Gemini API", async () => {
    if (!keys.length) throw new Error("GEMINI_API_KEY_MISSING");
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(keys[0])}&pageSize=1`, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`GEMINI_${response.status}`);
    return { key: maskSecret(keys[0]), reachable: true };
  }, { timeoutMs: 10000 }));

  checks.push(await runTimedHealthCheck("Gemma 4 26B", async () => {
    if (mode !== "full") return { configured: parseList(env.GEMMA_CHAT_MODELS, ["gemma-4-26b-a4b-it", "gemma-4-31b-it"]).includes("gemma-4-26b-a4b-it") };
    if (!keys.length) throw new Error("GEMMA_API_KEY_MISSING");
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemma-4-26b-a4b-it:generateContent?key=${encodeURIComponent(keys[0])}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: "只输出 OK" }] }], generationConfig: { maxOutputTokens: 8, temperature: 0, thinkingConfig: { thinkingLevel: "minimal" } } }),
      signal: AbortSignal.timeout(9000)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`GEMMA26_${response.status}:${data?.error?.message || "UNKNOWN"}`);
    return { model: "gemma-4-26b-a4b-it", reachable: true };
  }, { timeoutMs: 11000 }));

  checks.push(await runTimedHealthCheck("Gemma 4 31B", async () => {
    if (mode !== "full") return { configured: parseList(env.GEMMA_CHAT_MODELS, ["gemma-4-26b-a4b-it", "gemma-4-31b-it"]).includes("gemma-4-31b-it") };
    if (!keys.length) throw new Error("GEMMA_API_KEY_MISSING");
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemma-4-31b-it:generateContent?key=${encodeURIComponent(keys[0])}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: "只输出 OK" }] }], generationConfig: { maxOutputTokens: 8, temperature: 0, thinkingConfig: { thinkingLevel: "minimal" } } }),
      signal: AbortSignal.timeout(9000)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`GEMMA31_${response.status}:${data?.error?.message || "UNKNOWN"}`);
    return { model: "gemma-4-31b-it", reachable: true };
  }, { timeoutMs: 11000 }));

  checks.push(await runTimedHealthCheck("DeepSeek API", async () => {
    const deepseekKeys = deepSeekApiKeys(env);
    if (!deepseekKeys.length) return { configured: false };
    if (mode !== "full") return { configured: true, keys: deepseekKeys.length, key: maskSecret(deepseekKeys[0]) };
    const response = await fetch("https://api.deepseek.com/models", { headers: { Authorization: `Bearer ${deepseekKeys[0]}` }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`DEEPSEEK_${response.status}`);
    return { configured: true, reachable: true };
  }, { timeoutMs: 10000, optional: true }));

  checks.push(await runTimedHealthCheck("Workers AI", async () => {
    if (!env.AI) throw new Error("AI_NOT_BOUND");
    if (mode !== "full") return "binding present";
    const result = await env.AI.run("@cf/baai/bge-m3", { text: ["health check"] });
    if (!Array.isArray(result?.data?.[0])) throw new Error("WORKERS_AI_EMBEDDING_FAILED");
    return { dimensions: result.data[0].length };
  }, { timeoutMs: 15000 }));

  checks.push(await runTimedHealthCheck("Vectorize", async () => {
    if (!env.VECTORIZE) throw new Error("VECTORIZE_NOT_BOUND");
    if (mode !== "full") return "binding present";
    if (!env.AI) throw new Error("AI_REQUIRED_FOR_VECTOR_TEST");
    const result = await env.AI.run("@cf/baai/bge-m3", { text: ["vector health"] });
    const vector = result?.data?.[0];
    if (!Array.isArray(vector)) throw new Error("VECTOR_EMBEDDING_FAILED");
    const query = await env.VECTORIZE.query(vector, { topK: 1, returnMetadata: "all" });
    return { matches: query?.matches?.length || 0 };
  }, { timeoutMs: 18000 }));

  const lastCron = await dbGet(env, "system:last_cron");
  checks.push({ name: "Cron Scheduler", status: lastCron && Date.now() - Number(lastCron) < 5 * 60 * 1000 ? "ok" : "warning", latencyMs: 0, detail: { lastRunAt: lastCron ? new Date(Number(lastCron)).toISOString() : null }, checkedAt: new Date().toISOString() });
  checks.push({ name: "D1 Runtime Rate Limit", status: env.DB ? "ok" : "warning", latencyMs: 0, detail: env.DB ? "D1 dynamic rate limit enabled" : "D1 not bound", checkedAt: new Date().toISOString() });

  const summary = {
    ok: !checks.some(item => item.status === "error"),
    mode,
    version: VERSION,
    buildDate: BUILD_DATE,
    checkedAt: new Date().toISOString(),
    counts: {
      ok: checks.filter(item => item.status === "ok").length,
      warning: checks.filter(item => item.status === "warning").length,
      error: checks.filter(item => item.status === "error").length
    },
    checks
  };
  await dbPut(env, `health:last:${mode}`, JSON.stringify(summary));
  return summary;
}

async function buildHealthState(env) {
  const health = await runHealthChecks(env, { mode: "quick" });
  let onebot = null;
  try { onebot = await (await getOneBotHub(env).fetch("https://onebot-hub/status")).json(); } catch {}
  return {
    ...health,
    at: new Date().toISOString(),
    bindings: { db: Boolean(env.DB), vectorize: Boolean(env.VECTORIZE), ai: Boolean(env.AI), onebotHub: Boolean(env.ONEBOT_HUB) },
    providers: {
      gemini: Boolean(env.GEMINI_API_KEYS || env.VECTORIZE_GEMINI_KEYS),
      gemmaDecisionModels: parseList(env.GEMMA_DECISION_MODELS, ["gemma-4-26b-a4b-it", "gemma-4-31b-it"]),
      gemmaChatModels: parseList(env.GEMMA_CHAT_MODELS, ["gemma-4-26b-a4b-it", "gemma-4-31b-it"]),
      deepseek: deepSeekApiKeys(env).length > 0,
      liveModel: env.GEMINI_LIVE_MODEL || "gemini-3.1-flash-live-preview"
    },
    onebot,
    privateChat: await getFeatureFlag(env, "private_chat_enabled", false),
    privateSchedule: await getFeatureFlag(env, "private_schedule_enabled", false),
    privateAppeal: await getFeatureFlag(env, "private_appeal_enabled", true)
  };
}



function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extraHeaders
    }
  });
}

function readCookie(request, name) {
  const raw = String(request.headers.get("Cookie") || "");
  for (const part of raw.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return "";
}

function portalSessionCookie(token, maxAgeSeconds = 1800) {
  return `qqai_session=${encodeURIComponent(token || "")}; Path=/; Max-Age=${Math.max(0, maxAgeSeconds)}; HttpOnly; Secure; SameSite=Lax`;
}

function generateSixDigitCode() {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return String(bytes[0] % 1000000).padStart(6, "0");
}

function getOneBotHub(env) {
  if (!env.ONEBOT_HUB) throw new Error("Missing Durable Object binding: ONEBOT_HUB");
  return env.ONEBOT_HUB.get(env.ONEBOT_HUB.idFromName("default"));
}

async function sendOneBotAction(env, actionPayload) {
  try {
    await callOneBotAction(env, actionPayload, 15000);
    return true;
  } catch (error) {
    console.warn("sendOneBotAction failed:", error);
    return false;
  }
}

function oneBotHttpActionUrl(env, action) {
  const raw = String(env.ONEBOT_HTTP_ACTION_URL || env.ONEBOT_HTTP_URL || env.NAPCAT_HTTP_URL || "").trim();
  if (!raw) return null;
  let url;
  try { url = new URL(raw); } catch { return null; }
  if (/\/(?:send_private_msg|send_msg)$/.test(url.pathname)) {
    url.pathname = url.pathname.replace(/\/(?:send_private_msg|send_msg)$/, "/" + action);
  } else {
    url.pathname = url.pathname.replace(/\/+$/, "") + "/" + action;
  }
  return url;
}

async function sendOneBotHttpAction(env, action, params, timeoutMs = 12000) {
  const url = oneBotHttpActionUrl(env, action);
  if (!url) throw new Error("NAPCAT_HTTP_NOT_CONFIGURED");
  const token = String(env.ONEBOT_ACCESS_TOKEN || env.NAPCAT_ACCESS_TOKEN || "").trim();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("NAPCAT_HTTP_TIMEOUT"), Math.max(1000, timeoutMs));
  try {
    const headers = { "Content-Type": "application/json" };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
      headers["X-Access-Token"] = token;
    }
    const response = await fetch(url.toString(), {
      method: "POST",
      headers,
      body: JSON.stringify(params || {}),
      signal: controller.signal
    });
    const data = await response.json().catch(() => null);
    const ok = response.ok && (data?.status === "ok" || Number(data?.retcode ?? 0) === 0);
    if (!ok) throw new Error(data?.message || data?.wording || `NAPCAT_HTTP_${response.status}`);
    return data?.data ?? data;
  } finally {
    clearTimeout(timer);
  }
}

async function sendPortalVerificationMessage(env, qq, message) {
  const userId = numericId(qq);
  const errors = [];
  const attempts = [
    { transport: "websocket:send_private_msg", payload: { action: "send_private_msg", params: { user_id: userId, message, auto_escape: false } } },
    { transport: "websocket:send_msg", payload: { action: "send_msg", params: { message_type: "private", user_id: userId, message, auto_escape: false } } }
  ];
  for (const attempt of attempts) {
    try {
      await callOneBotAction(env, attempt.payload, 12000);
      return { ok: true, transport: attempt.transport };
    } catch (error) {
      errors.push(`${attempt.transport}:${String(error?.message || error)}`);
    }
  }
  for (const action of ["send_private_msg", "send_msg"]) {
    try {
      const params = action === "send_msg"
        ? { message_type: "private", user_id: userId, message, auto_escape: false }
        : { user_id: userId, message, auto_escape: false };
      await sendOneBotHttpAction(env, action, params, 12000);
      return { ok: true, transport: `http:${action}` };
    } catch (error) {
      errors.push(`http:${action}:${String(error?.message || error)}`);
    }
  }
  return { ok: false, transport: "none", errors };
}



function extractGroupId(groupText) {
  const match = String(groupText || "").match(/\d{5,}/);
  return match ? match[0] : String(groupText || "default").trim();
}

async function readJson(env, key, fallback) {
  const raw = await dbGet(env, key);
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch (e) { return fallback; }
}

async function createPortalSession(env, data) {
  const token = crypto.randomUUID() + crypto.randomUUID();
  const qq = String(data.qq || "");
  const groupId = String(data.groupId || "");
  const role = groupId ? await resolvePortalRole(env, qq, groupId) : (isDeveloperId(env, qq) ? "developer" : "member");
  const permissions = groupId ? await getEffectivePermissions(env, groupId, qq, role, role === "developer") : {
    developer: isDeveloperId(env, qq), nativeAdmin: false, aiAdmin: isDeveloperId(env, qq), groupOps: isDeveloperId(env, qq), scheduleReviewer: isDeveloperId(env, qq), appealReviewer: isDeveloperId(env, qq)
  };
  const session = { qq, group: data.group || "", groupId, token, role, permissions, expiresAt: Date.now() + DEFAULTS.portalSessionTtlMs };
  await dbPut(env, `portal_session:${token}`, JSON.stringify(session));
  return session;
}



async function getPortalSession(env, token) {
  if (!token) return null;
  const raw = await dbGet(env, `portal_session:${token}`);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw);
    if (Date.now() > session.expiresAt) {
      await dbDel(env, `portal_session:${token}`);
      return null;
    }
    session.expiresAt = Date.now() + DEFAULTS.portalSessionTtlMs;
    await dbPut(env, `portal_session:${token}`, JSON.stringify(session));
    return session;
  } catch (e) {
    return null;
  }
}

async function resolvePortalRole(env, qq, groupId) {
  if (isDeveloperId(env, qq)) return "developer";
  if (!groupId) return "member";
  try {
    const member = await callOneBotAction(env, { action: "get_group_member_info", params: { group_id: numericId(groupId), user_id: numericId(qq), no_cache: false } }, 8000);
    if (member?.role === "owner") return "owner";
    if (member?.role === "admin") return "admin";
  } catch {}
  const members = await readJson(env, `group_members:${groupId}`, []);
  const member = members.find(m => String(m.qq) === String(qq));
  if (member?.role === "owner") return "owner";
  if (member?.role === "admin") return "admin";
  return "member";
}



function hasAdminRole(role) {
  return ["developer", "owner", "admin"].includes(role);
}

async function upsertGroupMember(env, groupId, member) {
  const key = `group_members:${groupId}`;
  const list = await readJson(env, key, []);
  const idx = list.findIndex(x => String(x.qq) === String(member.qq));
  const next = { ...member, firstSeenAt: member.firstSeenAt || (idx >= 0 ? list[idx].firstSeenAt : new Date().toISOString()), lastSeenAt: new Date().toISOString() };
  if (idx >= 0) list[idx] = { ...list[idx], ...next };
  else list.push(next);
  if (list.length > 1000) list.splice(0, list.length - 1000);
  await dbPut(env, key, JSON.stringify(list));
  const known = await readJson(env, "known_groups", []);
  const groupIdx = known.findIndex(x => String(x.group_id || x.groupId || x.id || x) === String(groupId));
  const groupRecord = { group_id: String(groupId), group_name: String(member.groupName || groupId), lastSeenAt: new Date().toISOString() };
  if (groupIdx >= 0) known[groupIdx] = { ...(typeof known[groupIdx] === "object" ? known[groupIdx] : {}), ...groupRecord };
  else known.push(groupRecord);
  if (known.length > 1000) known.splice(0, known.length - 1000);
  await dbPut(env, "known_groups", JSON.stringify(known));
}

function getPublicNebulaSeed() {
  return {
    mode: "anonymous_public_mix",
    text_visible: false,
    clusters: ["humor", "knowledge", "daily", "events", "members"],
    particles: 1600
  };
}

async function isMemoryBanned(env, userId) {
  return await dbGet(env, `memory_banned:${userId}`) === "true";
}

async function getUserQuota(env, groupId, userId) {
  const explicit = await dbGet(env, `quota:deepseek:user:${userId}`);
  if (explicit !== null && explicit !== undefined && explicit !== "") return `${explicit} CNY/日`;
  return await dbGet(env, `quota:${groupId}:${userId}`) || "无限";
}

function commandChangesWebSettings(message) {
  const text = String(message || "").trim().toLowerCase();
  if (!/^[!！]/.test(text)) return false;
  if (/^[!！]指令(开|開|关|關)\b/.test(text)) return true;
  return [
    // AI 開關屬於緊急管理指令；即使 Portal 已關閉設定型 ! 指令，仍必須可用。
    "记忆开", "記憶開", "记忆关", "記憶關",
    "切换人格", "切換人格", "恢复人格", "恢復人格", "取消使用",
    "set群规", "set群規", "群规设置", "群規設定",
    "拉黑", "洗白",
    "免打扰", "免打擾", "取消免打扰", "取消免打擾",
    "set人格", "del人格",
    "记住", "記住", "忘记", "忘記",
    "禁记忆", "禁記憶", "解禁记忆", "解禁記憶",
    "banmemory", "unbanmemory",
    "群规监控", "群規監控", "ai群规代理", "ai群規代理",
    "授权ai踢出", "授權ai踢出", "撤回ai踢出授权", "撤回ai踢出授權",
    "入群辅助", "入群輔助", "授权ai拒绝入群", "授權ai拒絕入群",
    "撤回ai拒绝入群", "撤回ai拒絕入群", "设置处置冷却", "設定處置冷卻",
    "设置速率限制", "設定速率限制", "设置全局速率限制", "設定全域速率限制",
    "自动欢迎", "自動歡迎", "欢迎词", "歡迎詞"
  ].some(cmd => text.startsWith("!" + cmd) || text.startsWith("！" + cmd));
}

async function writeMemoryAudit(env, entry) {
  const auditEntry = {
    id: crypto.randomUUID(),
    groupId: entry.groupId || "",
    userId: entry.userId || "",
    action: entry.action,
    before: entry.before,
    after: entry.after,
    at: new Date().toISOString()
  };
  const globalKey = "audit:memory:global";
  const groupKey = `audit:memory:group:${auditEntry.groupId || "private"}`;
  for (const key of [globalKey, groupKey]) {
    let logs = [];
    const raw = await dbGet(env, key);
    if (raw) {
      try { logs = JSON.parse(raw); } catch (e) { logs = []; }
    }
    logs.push(auditEntry);
    if (logs.length > 500) logs = logs.slice(-500);
    await dbPut(env, key, JSON.stringify(logs));
  }
}

async function writeSystemError(env, err, context = {}) {
  const logs = await readJson(env, "system_error_logs", []);
  logs.push({
    at: new Date().toISOString(),
    message: err?.message || String(err),
    stack: err?.stack || "",
    context
  });
  if (logs.length > 200) logs.splice(0, logs.length - 200);
  await dbPut(env, "system_error_logs", JSON.stringify(logs));
}

function buildGroupReplyMessage(eventBody, replyText) {
  const message = [];
  if (eventBody.message_id !== undefined && eventBody.message_id !== null) {
    message.push({ type: "reply", data: { id: String(eventBody.message_id) } });
  }
  if (eventBody.user_id !== undefined && eventBody.user_id !== null) {
    message.push({ type: "at", data: { qq: String(eventBody.user_id) } });
    message.push({ type: "text", data: { text: " " } });
  }
  message.push({ type: "text", data: { text: String(replyText).replace(new RegExp(`^\\[CQ:at,qq=${eventBody.user_id}\\]\\s*`), "") } });
  return message;
}

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(String(value || ""));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, "0")).join("");
}

async function migratePortalMemories(env, key, rawList, ownerFallback) {
  const input = Array.isArray(rawList) ? rawList : [];
  const normalized = [];
  let changed = false;
  for (let i = 0; i < input.length; i++) {
    const raw = input[i];
    const item = typeof raw === "string"
      ? { text: raw, scope: "private", owner: ownerFallback, migrated: true }
      : raw && typeof raw === "object" ? { ...raw, text: String(raw.text || ""), owner: String(raw.owner || ownerFallback), scope: raw.scope || "private" } : null;
    if (!item || !item.text.trim()) { changed = true; continue; }
    if (!item.id) {
      item.id = `mem_legacy_${(await sha256Hex(`${key}|${i}|${item.text}`)).slice(0, 24)}`;
      changed = true;
    }
    normalized.push(item);
  }
  if (changed) await dbPut(env, key, JSON.stringify(normalized));
  return normalized;
}

async function upsertMemoryVector(env, item, groupId) {
  if (!env.VECTORIZE || !env.AI || !item?.text) return item;
  const values = await env.AI.run("@cf/baai/bge-m3", { text: [String(item.text)] });
  const vector = values?.data?.[0];
  if (!Array.isArray(vector)) return item;
  const vectorId = String(item.vectorId || `memory_${item.id}`);
  await env.VECTORIZE.upsert([{ id: vectorId, values: vector, metadata: {
    kind: "memory", groupId: String(groupId), subjectQq: String(item.subjectQq || item.owner || ""),
    owner: String(item.owner || ""), scope: String(item.scope || "private"), text: String(item.text), memoryId: String(item.id), updatedAt: Date.now()
  }}]);
  await dbDel(env, `memory_vector_tombstone:${vectorId}`);
  item.vectorId = vectorId;
  return item;
}

async function deleteMemoryVector(env, item) {
  const vectorId = String(item?.vectorId || (item?.id ? `memory_${item.id}` : ""));
  if (!vectorId) return false;
  await dbPut(env, `memory_vector_tombstone:${vectorId}`, "true");
  if (env.VECTORIZE?.deleteByIds) {
    try { await env.VECTORIZE.deleteByIds([vectorId]); return true; } catch (error) { console.warn("Vectorize memory delete failed", error); }
  }
  return false;
}

async function searchPortalVectors(env, { groupId, userId, permissions, query, limit = 20 }) {
  if (!env.VECTORIZE || !env.AI || !query) return [];
  const embedded = await env.AI.run("@cf/baai/bge-m3", { text: [String(query)] });
  const vector = embedded?.data?.[0];
  if (!Array.isArray(vector)) return [];
  const result = await env.VECTORIZE.query(vector, { topK: Math.max(1, Math.min(50, limit)), returnMetadata: "all", filter: { kind: "chat_log", groupId: String(groupId) } });
  return (result?.matches || []).filter(match => {
    const meta = match.metadata || {};
    if (meta.kind !== "chat_log" || String(meta.groupId || meta.group_id || "") !== String(groupId)) return false;
    if (permissions?.nativeAdmin || permissions?.aiAdmin || permissions?.developer) return true;
    return String(meta.qq || meta.userId || meta.author || "") === String(userId);
  }).map(match => ({ id: match.id, score: match.score, text: match.metadata?.text || "", qq: match.metadata?.qq || "", createdAt: match.metadata?.createdAt || null }));
}

const PORTAL_SETTING_DEFINITIONS = Object.freeze([
  { key: "dnd", label: "免打扰", command: "!免打扰 / !取消免打扰", minRole: "member", scope: "user", type: "boolean", defaultValue: false },
  { key: "custom_style", label: "个人回复风格", command: "!set人格 / !del人格", minRole: "member", scope: "user", type: "text", defaultValue: "" },
  { key: "model_preference", label: "模型偏好", command: "!模型", minRole: "member", scope: "user", type: "select", options: ["auto", "gemini", "deepseek", "deepseek_high", "deepseek_max"], defaultValue: "auto" },
  { key: "ai_on", label: "启用群 AI", command: "!开启ai / !关闭ai", minRole: "admin", scope: "group", type: "boolean", defaultValue: true },
  { key: "memory_on", label: "启用长期记忆", command: "!记忆开 / !记忆关", minRole: "admin", scope: "group", type: "boolean", defaultValue: true },
  { key: "commands_enabled", label: "启用设置型 ! 指令", command: "!指令开 / !指令关", minRole: "admin", scope: "group", type: "boolean", defaultValue: true },
  { key: "interject_rate", label: "随机插话率", command: "!设置插话率", minRole: "admin", scope: "group", type: "number", min: 0, max: 100, defaultValue: 25 },
  { key: "join_assist_enabled", label: "入群申请辅助", command: "!入群辅助 开/关", minRole: "admin", scope: "group", type: "boolean", defaultValue: false },
  { key: "join_pattern_threshold", label: "重复申请方式自动同意门槛", command: "网页设置", minRole: "admin", scope: "group", type: "number", min: 1, defaultValue: 2 },
  { key: "group_persona", label: "群组人格", command: "!切换人格 / !恢复人格", minRole: "admin", scope: "group", type: "textarea", defaultValue: "" },
  { key: "keyword_filter", label: "群组关键字过滤", command: "网页设置", minRole: "admin", scope: "group", type: "textarea", defaultValue: "" },
  { key: "group_rules", label: "群规", command: "!set群规", minRole: "admin", scope: "group", type: "textarea", defaultValue: "" },
  { key: "welcome_enabled", label: "自动欢迎", command: "!自动欢迎 开/关", minRole: "owner", scope: "group", type: "boolean", defaultValue: false },
  { key: "welcome_text", label: "欢迎词", command: "!欢迎词", minRole: "owner", scope: "group", type: "textarea", defaultValue: DEFAULTS.welcomeText },
  { key: "rule_monitor_enabled", label: "群规持续监控", command: "!群规监控", minRole: "owner", scope: "group", type: "boolean", defaultValue: true },
  { key: "rule_proxy_mode", label: "AI 群规代理模式", command: "!AI群规代理", minRole: "owner", scope: "group", type: "select", options: ["record", "warn", "mute", "auto"], defaultValue: "record" },
  { key: "rule_proxy_mute_seconds", label: "AI 代理禁言秒数", command: "网页 / AI代理设置", minRole: "owner", scope: "group", type: "number", min: 0, defaultValue: 600 },
  { key: "rule_proxy_kick_authorized", label: "AI 踢出授权", command: "!授权AI踢出 / !撤回AI踢出授权", minRole: "owner", scope: "group", type: "boolean", defaultValue: false },
  { key: "join_reject_authorized", label: "AI 拒绝入群授权", command: "!授权AI拒绝入群 / !撤回AI拒绝入群", minRole: "owner", scope: "group", type: "boolean", defaultValue: false },
  { key: "moderation_cooldown_seconds", label: "同对象处置冷却秒数", command: "!设置处置冷却", minRole: "owner", scope: "group", type: "number", min: 0, defaultValue: 0 },
  { key: "active_speaking", label: "主动发话", command: "开发者后台", minRole: "developer", scope: "group", type: "boolean", defaultValue: false },
  { key: "rate_limit_seconds", label: "群调用速率限制秒数", command: "!设置速率限制", minRole: "developer", scope: "group", type: "number", min: 0, defaultValue: 10 }
]);

function portalRoleRank(role) {
  return ({ member: 0, admin: 1, owner: 2, developer: 3 })[String(role || "member")] ?? 0;
}

async function readPortalSettingValue(env, definition, groupId, targetQq) {
  const qq = String(targetQq || "");
  switch (definition.key) {
    case "dnd": return await dbGet(env, `dnd:${groupId}:${qq}`) === "true";
    case "custom_style": return await dbGet(env, `custom_style:${groupId}:${qq}`) || "";
    case "model_preference": return await dbGet(env, `model_pref:${groupId}:${qq}`) || "auto";
    case "ai_on": return await dbGet(env, `ai_off:${groupId}`) !== "true";
    case "memory_on": return await dbGet(env, `memo:${groupId}`) !== "false";
    case "commands_enabled": return await dbGet(env, `web_command_off:${groupId}`) !== "true";
    case "interject_rate": return Number(await dbGet(env, `interject_rate:${groupId}`) || DEFAULTS.interjectRate);
    case "join_assist_enabled": return await dbGet(env, `join_assist_enabled:${groupId}`) === "true";
    case "join_pattern_threshold": return Math.max(1, parseUnlimitedNonNegativeInteger(await dbGet(env, `join_pattern_auto_approve_threshold:${groupId}`), DEFAULTS.joinPatternAutoApproveThreshold));
    case "group_persona": return await dbGet(env, `group_persona:${groupId}`) || "";
    case "keyword_filter": return (await readJson(env, `keyword_filter:${groupId}`, [])).join("\n");
    case "group_rules": return await dbGet(env, `group_rules:${groupId}`) || "";
    case "welcome_enabled": return await dbGet(env, `welcome_enabled:${groupId}`) === "true";
    case "welcome_text": return await dbGet(env, `welcome_text:${groupId}`) || DEFAULTS.welcomeText;
    case "rule_monitor_enabled": return await dbGet(env, `rule_monitor_enabled:${groupId}`) !== "false";
    case "rule_proxy_mode": return normalizeRuleProxyMode(await dbGet(env, `rule_proxy_mode:${groupId}`) || DEFAULTS.ruleProxyMode);
    case "rule_proxy_mute_seconds": return parseUnlimitedNonNegativeInteger(await dbGet(env, `rule_proxy_mute_seconds:${groupId}`), DEFAULTS.ruleProxyMuteSeconds);
    case "rule_proxy_kick_authorized": return await dbGet(env, `rule_proxy_kick_authorized:${groupId}`) === "true";
    case "join_reject_authorized": return await dbGet(env, `join_reject_authorized:${groupId}`) === "true";
    case "moderation_cooldown_seconds": return parseUnlimitedNonNegativeInteger(await dbGet(env, `moderation_target_cooldown_seconds:${groupId}`), 0);
    case "active_speaking": return await getFeatureFlag(env, `active_speaking:${groupId}`, false);
    case "rate_limit_seconds": return await getRuntimeRateLimitSeconds(env, groupId);
    default: return definition.defaultValue;
  }
}

async function writePortalSettingValue(env, definition, groupId, targetQq, value) {
  const qq = String(targetQq || "");
  switch (definition.key) {
    case "dnd": return value ? dbPut(env, `dnd:${groupId}:${qq}`, "true") : dbDel(env, `dnd:${groupId}:${qq}`);
    case "custom_style": return dbPut(env, `custom_style:${groupId}:${qq}`, String(value || "").slice(0, 1000));
    case "model_preference": { const pref = normalizeModelPreference(value) || "auto"; return dbPut(env, `model_pref:${groupId}:${qq}`, pref); }
    case "ai_on": return value ? dbDel(env, `ai_off:${groupId}`) : dbPut(env, `ai_off:${groupId}`, "true");
    case "memory_on": return dbPut(env, `memo:${groupId}`, value ? "true" : "false");
    case "commands_enabled": return value ? dbDel(env, `web_command_off:${groupId}`) : dbPut(env, `web_command_off:${groupId}`, "true");
    case "interject_rate": return dbPut(env, `interject_rate:${groupId}`, String(Math.max(0, Math.min(100, Number(value || 0)))));
    case "join_assist_enabled": return dbPut(env, `join_assist_enabled:${groupId}`, value ? "true" : "false");
    case "join_pattern_threshold": return dbPut(env, `join_pattern_auto_approve_threshold:${groupId}`, String(Math.max(1, parseUnlimitedNonNegativeInteger(value, DEFAULTS.joinPatternAutoApproveThreshold))));
    case "group_persona": return dbPut(env, `group_persona:${groupId}`, String(value || "").slice(0, 4000));
    case "keyword_filter": return dbPut(env, `keyword_filter:${groupId}`, JSON.stringify(String(value || "").split(/\n|,/).map(item => item.trim()).filter(Boolean).slice(0, 500)));
    case "group_rules": return dbPut(env, `group_rules:${groupId}`, String(value || "").slice(0, 10000));
    case "welcome_enabled": return dbPut(env, `welcome_enabled:${groupId}`, value ? "true" : "false");
    case "welcome_text": return dbPut(env, `welcome_text:${groupId}`, String(value || DEFAULTS.welcomeText).slice(0, 1000));
    case "rule_monitor_enabled": return dbPut(env, `rule_monitor_enabled:${groupId}`, value ? "true" : "false");
    case "rule_proxy_mode": return dbPut(env, `rule_proxy_mode:${groupId}`, normalizeRuleProxyMode(value));
    case "rule_proxy_mute_seconds": return dbPut(env, `rule_proxy_mute_seconds:${groupId}`, String(parseUnlimitedNonNegativeInteger(value, DEFAULTS.ruleProxyMuteSeconds)));
    case "rule_proxy_kick_authorized": return value ? dbPut(env, `rule_proxy_kick_authorized:${groupId}`, "true") : dbDel(env, `rule_proxy_kick_authorized:${groupId}`);
    case "join_reject_authorized": return value ? dbPut(env, `join_reject_authorized:${groupId}`, "true") : dbDel(env, `join_reject_authorized:${groupId}`);
    case "moderation_cooldown_seconds": return dbPut(env, `moderation_target_cooldown_seconds:${groupId}`, String(parseUnlimitedNonNegativeInteger(value, 0)));
    case "active_speaking": return setFeatureFlag(env, `active_speaking:${groupId}`, Boolean(value));
    case "rate_limit_seconds": return dbPut(env, `runtime_rate_limit_seconds:group:${groupId}`, String(parseUnlimitedNonNegativeInteger(value, DEFAULTS.runtimeRateLimitSeconds)));
  }
}

function normalizeBilibiliEvent(payload) {
  const data = payload?.data || payload?.event_data || payload?.body || payload || {};
  const rawType = String(payload?.event_type || payload?.event || payload?.cmd || payload?.type || data?.event_type || data?.type || "").toLowerCase();
  let type = "unknown";
  if (/live.*start|start.*live|live_open_platform_live_start|开播|開播/.test(rawType)) type = "live_start";
  else if (/video.*publish|archive.*publish|稿件.*发布|投稿|new_video/.test(rawType)) type = "video_publish";
  const creatorId = String(data?.open_id || data?.uid || data?.mid || data?.creator_id || payload?.open_id || payload?.uid || "");
  const creatorName = String(data?.uname || data?.name || data?.creator_name || payload?.creator_name || "");
  const title = String(data?.title || data?.room_title || data?.archive_title || payload?.title || "");
  const roomId = String(data?.room_id || data?.roomid || payload?.room_id || "");
  const bvid = String(data?.bvid || data?.bv_id || payload?.bvid || "");
  const url = String(data?.url || data?.link || payload?.url || (type === "live_start" && roomId ? `https://live.bilibili.com/${roomId}` : type === "video_publish" && bvid ? `https://www.bilibili.com/video/${bvid}` : ""));
  const eventId = String(payload?.event_id || payload?.id || data?.event_id || `${type}:${creatorId}:${roomId || bvid}:${title}`);
  return { type, creatorId, creatorName, title, roomId, bvid, url, eventId, rawType };
}

async function sendBilibiliConnectorNotification(env, connector, event) {
  const notify = event.type === "live_start" ? connector.liveNotify : event.type === "video_publish" ? connector.videoNotify : false;
  const atAllRequested = event.type === "live_start" ? connector.liveAtAll : event.type === "video_publish" ? connector.videoAtAll : false;
  const log = { at: Date.now(), connectorId: connector.id, groupId: connector.groupId, event };
  if (!notify) {
    log.status = "record_only";
    await dbPut(env, `bili:event:${connector.id}:${event.eventId}`, JSON.stringify(log));
    return { ok: true, sent: false };
  }
  const botRole = (await getBotGroupRole(env, connector.groupId)).role;
  const canAtAll = botRole === "owner" || botRole === "admin";
  const prefix = atAllRequested && canAtAll ? "[CQ:at,qq=all] " : "";
  const label = event.type === "live_start" ? "开播通知" : "新视频通知";
  const creator = event.creatorName || connector.creatorName || event.creatorId || connector.creatorId || "B站创作者";
  const message = `${prefix}【${label}】${creator}\n${event.title || (event.type === "live_start" ? "直播已开始" : "已上传新视频")}${event.url ? "\n" + event.url : ""}`;
  try {
    await callOneBotAction(env, { action: "send_group_msg", params: { group_id: numericId(connector.groupId), message, auto_escape: false } }, 15000);
    log.status = "sent";
    log.atAllRequested = atAllRequested;
    log.atAllSent = atAllRequested && canAtAll;
    await dbPut(env, `bili:event:${connector.id}:${event.eventId}`, JSON.stringify(log));
    return { ok: true, sent: true };
  } catch (error) {
    log.status = "failed"; log.error = String(error?.message || error);
    await dbPut(env, `bili:event:${connector.id}:${event.eventId}`, JSON.stringify(log));
    return { ok: false, error: log.error };
  }
}

async function handleBilibiliWebhook(request, env, url) {
  const secret = url.pathname.split("/").pop() || "";
  const connectorId = await dbGet(env, `bili:webhook_secret:${secret}`);
  if (!connectorId) return jsonResponse({ ok: false, message: "未知串接密钥。" }, 404);
  const connector = await readJson(env, `bili:connector:${connectorId}`, null);
  if (!connector || connector.enabled === false) return jsonResponse({ ok: false, message: "串接已停用。" }, 403);
  const payload = await request.json().catch(() => ({}));
  if (payload?.challenge) return jsonResponse({ challenge: payload.challenge });
  const event = normalizeBilibiliEvent(payload);
  if (event.type === "unknown") return jsonResponse({ ok: true, ignored: true, message: "未识别事件类型。" });
  if (connector.creatorId && event.creatorId && String(connector.creatorId) !== String(event.creatorId)) return jsonResponse({ ok: true, ignored: true, message: "创作者不匹配。" });
  const dedupKey = `bili:dedup:${connector.id}:${event.eventId}`;
  if (await dbGet(env, dedupKey)) return jsonResponse({ ok: true, duplicate: true });
  await dbPut(env, dedupKey, String(Date.now()));
  const result = await sendBilibiliConnectorNotification(env, connector, event);
  connector.lastEventAt = Date.now(); connector.lastEvent = event;
  await dbPut(env, `bili:connector:${connector.id}`, JSON.stringify(connector));
  return jsonResponse({ ok: result.ok, event, ...result }, result.ok ? 200 : 502);
}

async function listBilibiliConnectors(env, groupId) {
  const ids = await readJson(env, `bili:connector:index:${groupId}`, []);
  const result = [];
  for (const id of ids) { const item = await readJson(env, `bili:connector:${id}`, null); if (item) result.push(item); }
  return result;
}


function platformRoleRank(role){return({member:0,admin:1,owner:2,developer:3})[String(role||'member')]??0}
function platformFeatureById(id){return PLATFORM_FEATURES.find(x=>x.id===String(id||'').toUpperCase())||null}
function platformFeatureKey(feature,groupId){return feature.scope==='global'?`platform:feature:${feature.id}:global`:`platform:feature:${feature.id}:group:${String(groupId||'')}`}
async function platformFeatureEnabled(env,feature,groupId){const v=await dbGet(env,platformFeatureKey(feature,groupId));return v==null?feature.defaultEnabled:v==='true'}
async function listPlatformFeatures(env,{groupId='',role='member',query='',includeHidden=false}={}){const q=String(query||'').trim().toLowerCase(),rank=platformRoleRank(role),rows=[];for(const f of PLATFORM_FEATURES){if(!includeHidden&&platformRoleRank(f.minRole)>rank)continue;if(q&&!`${f.id} ${f.name} ${f.category} ${f.mode}`.toLowerCase().includes(q))continue;rows.push({...f,enabled:await platformFeatureEnabled(env,f,groupId)})}return rows}
async function setPlatformFeature(env,{feature,groupId,enabled,actorId,actorRole,auditMode='log'}){if(!feature)return{ok:false,message:'找不到功能。'};if(platformRoleRank(actorRole)<platformRoleRank(feature.minRole))return{ok:false,message:'你的角色無權修改此功能。'};if(feature.scope==='group'&&!groupId)return{ok:false,message:'請先選擇群組。'};await dbPut(env,platformFeatureKey(feature,groupId),enabled?'true':'false');if(auditMode!=='silent')await writeSystemAudit(env,{type:'platform_feature',groupId,actorId,action:feature.id,featureName:feature.name,enabled:Boolean(enabled)});return{ok:true,message:`${feature.id} ${feature.name} 已${enabled?'開啟':'關閉'}。`}}
async function appendPlatformTrace(env,data){const id=`tr_${Date.now().toString(36)}_${crypto.randomUUID().slice(0,8)}`,item={id,at:Date.now(),...data};await dbPut(env,`platform:trace:${id}`,JSON.stringify(item));await appendIndex(env,'platform:trace:index',id,5000);if(item.groupId)await appendIndex(env,`platform:trace:index:${item.groupId}`,id,2000);return item}
async function listPlatformTraces(env,{groupId='',query='',limit=200}={}){const ids=await readJson(env,groupId?`platform:trace:index:${groupId}`:'platform:trace:index',[]),q=String(query||'').toLowerCase(),rows=[];for(const id of ids.slice(-Math.max(1,Math.min(1000,Number(limit||200)))).reverse()){const x=await readJson(env,`platform:trace:${id}`,null);if(x&&(!q||JSON.stringify(x).toLowerCase().includes(q)))rows.push(x)}return rows}
async function enqueuePlatformJob(env,data){const id=`job_${Date.now().toString(36)}_${crypto.randomUUID().slice(0,8)}`,job={id,status:'queued',attempts:0,maxAttempts:Math.max(1,Math.min(10,Number(data.maxAttempts||3))),createdAt:Date.now(),nextRunAt:Number(data.nextRunAt||Date.now()),...data};await dbPut(env,`platform:job:${id}`,JSON.stringify(job));await appendIndex(env,'platform:job:index',id,5000);return job}
async function listPlatformJobs(env,{groupId='',status='',limit=200}={}){const ids=await readJson(env,'platform:job:index',[]),rows=[];for(const id of ids.slice(-Math.max(1,Math.min(1000,Number(limit||200)))).reverse()){const x=await readJson(env,`platform:job:${id}`,null);if(!x)continue;if(groupId&&String(x.groupId||'')!==String(groupId))continue;if(status&&x.status!==status)continue;rows.push(x)}return rows}
async function processPlatformJobs(env,now=Date.now()){const jobs=await listPlatformJobs(env,{status:'queued',limit:100});for(const job of jobs.reverse()){if(Number(job.nextRunAt||0)>now)continue;job.status='running';job.attempts=Number(job.attempts||0)+1;try{if(job.type==='notification'&&job.groupId&&job.message)await callOneBotAction(env,{action:'send_group_msg',params:{group_id:numericId(job.groupId),message:String(job.message),auto_escape:false}},15000);else await writeSystemAudit(env,{type:'platform_job',groupId:String(job.groupId||''),actorId:String(job.actorId||'system'),action:String(job.action||job.id)});job.status='completed';job.completedAt=Date.now()}catch(e){job.error=String(e?.message||e);if(job.attempts<job.maxAttempts){job.status='queued';job.nextRunAt=Date.now()+Math.min(3600000,2**job.attempts*30000)}else{job.status='dead_letter';await appendIndex(env,'platform:dead_letter:index',job.id,2000)}}await dbPut(env,`platform:job:${job.id}`,JSON.stringify(job))}}

async function handlePortalApi(request, env, url) {
  const body = request.method === "GET" ? {} : await request.json().catch(() => ({}));
  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") || readCookie(request, "qqai_session") || body.token || url.searchParams.get("token") || "";
  let session = await getPortalSession(env, token);
  if (!session) return jsonResponse({ ok: false, message: "未登录或登录已过期。" }, 401);
  const path = url.pathname.replace("/api/portal", "");

  if (request.method === "GET" && path === "/groups") {
    const groups = await getWhitelistedGroupsForUser(env, session.qq);
    return jsonResponse({ ok: true, groups, selectedGroupId: session.groupId || "" });
  }

  if (request.method === "POST" && path === "/select-group") {
    const groupId = String(body.groupId || "").replace(/\D/g, "");
    if (!groupId || !(await isGroupWhitelisted(env, groupId))) return jsonResponse({ ok: false, message: "该群不在 AI 白名单。" }, 403);
    if (!(await verifyGroupMembership(env, groupId, session.qq))) return jsonResponse({ ok: false, message: "无法确认你是该群成员。" }, 403);
    const groups = await getWhitelistedGroupsForUser(env, session.qq);
    const selected = groups.find(g => g.groupId === groupId);
    const role = await resolvePortalRole(env, session.qq, groupId);
    const permissions = await getEffectivePermissions(env, groupId, session.qq, role, role === "developer");
    session = { ...session, groupId, group: selected?.groupName || groupId, role, permissions, expiresAt: Date.now() + DEFAULTS.portalSessionTtlMs };
    await dbPut(env, `portal_session:${token}`, JSON.stringify(session));
    await dbPut(env, `private_default_group:${session.qq}`, groupId);
    return jsonResponse({ ok: true, message: "群组已切换。", session });
  }

  const groupId = String(session.groupId || "");
  const role = groupId ? await resolvePortalRole(env, session.qq, groupId) : (isDeveloperId(env, session.qq) ? "developer" : "member");
  const permissions = groupId ? await getEffectivePermissions(env, groupId, session.qq, role, role === "developer") : session.permissions || {};
  const authed = { ...session, groupId, role, permissions };

  if (request.method === "GET" && path === "/me") {
    return jsonResponse({
      ok: true,
      session: authed,
      quota: groupId ? await getUserQuota(env, groupId, authed.qq) : "未选择群组",
      modelPreference: groupId ? (await dbGet(env, `model_pref:${groupId}:${authed.qq}`) || "auto") : "auto",
      privateAccess: await getPrivateAccessMode(env, authed.qq),
      flags: {
        privateChat: await getFeatureFlag(env, "private_chat_enabled", false),
        privateSchedule: await getFeatureFlag(env, "private_schedule_enabled", false),
        privateAppeal: await getFeatureFlag(env, "private_appeal_enabled", true)
      }
    });
  }


  if (request.method === "GET" && path === "/capabilities") {
    const botState = groupId ? await getBotGroupRole(env, groupId) : { role: "unknown" };
    const botRole = String(botState?.role || "unknown");
    return jsonResponse({
      ok: true,
      bot_role: botRole,
      bot_is_owner: botRole === "owner",
      can_native_admin_change: botRole === "owner",
      viewer_can_group_ops: Boolean(permissions.groupOps || permissions.nativeAdmin || permissions.developer),
      viewer_can_change_rule_monitor: role === "owner",
      viewer_can_view_owner_controls: Boolean(role === "owner" || permissions.developer)
    });
  }

  const portalIsDeveloper = permissions.developer || isDeveloperId(env, authed.qq);


  if(request.method==='GET'&&path==='/platform/features'){
    const features=await listPlatformFeatures(env,{groupId,role:portalIsDeveloper?'developer':role,query:url.searchParams.get('q')||'',includeHidden:portalIsDeveloper});
    return jsonResponse({ok:true,total:PLATFORM_FEATURE_COUNT,visible:features.length,features,deploymentMode:'single_worker',paidCloudflareServices:false});
  }
  if(request.method==='POST'&&path==='/platform/features'){
    const feature=platformFeatureById(body.id);if(!feature)return jsonResponse({ok:false,message:'找不到功能 ID。'},404);
    if(/(?:群規持續監控|AI 踢出群主授權|AI 拒絕入群群主授權)/.test(feature.name)&&!(await isVerifiedGroupOwner(env,groupId,authed.qq)))return jsonResponse({ok:false,message:'這項高風險設定只能由 NapCat 即時確認的真實群主修改。'},403);
    const result=await setPlatformFeature(env,{feature,groupId,enabled:Boolean(body.enabled),actorId:authed.qq,actorRole:portalIsDeveloper?'developer':role,auditMode:portalIsDeveloper&&body.auditMode==='silent'?'silent':'log'});return jsonResponse(result,result.ok?200:403);
  }
  if(request.method==='GET'&&path==='/platform/traces'){
    if(!(permissions.aiAdmin||permissions.groupOps||permissions.nativeAdmin||portalIsDeveloper))return jsonResponse({ok:false,message:'缺少 Trace 查看權限。'},403);
    return jsonResponse({ok:true,traces:await listPlatformTraces(env,{groupId:portalIsDeveloper&&url.searchParams.get('all')==='1'?'':groupId,query:url.searchParams.get('q')||'',limit:Number(url.searchParams.get('limit')||200)})});
  }
  if(request.method==='GET'&&path==='/platform/jobs'){
    if(!(permissions.groupOps||permissions.nativeAdmin||portalIsDeveloper))return jsonResponse({ok:false,message:'缺少任務中心權限。'},403);
    return jsonResponse({ok:true,jobs:await listPlatformJobs(env,{groupId:portalIsDeveloper&&url.searchParams.get('all')==='1'?'':groupId,status:url.searchParams.get('status')||'',limit:Number(url.searchParams.get('limit')||200)})});
  }
  if(request.method==='POST'&&path==='/platform/jobs'){
    if(!(permissions.groupOps||permissions.nativeAdmin||portalIsDeveloper))return jsonResponse({ok:false,message:'缺少建立任務權限。'},403);
    const job=await enqueuePlatformJob(env,{type:String(body.type||'audit'),groupId,actorId:authed.qq,message:String(body.message||'').slice(0,4000),action:String(body.action||'manual'),nextRunAt:Number(body.nextRunAt||Date.now()),maxAttempts:Number(body.maxAttempts||3)});await appendPlatformTrace(env,{type:'job_created',groupId,actorId:authed.qq,jobId:job.id});return jsonResponse({ok:true,message:'任務已加入 D1 任務列。',job});
  }

  if (request.method === "GET" && path === "/settings-center") {
    const targetQq = portalIsDeveloper ? String(url.searchParams.get("targetQq") || authed.qq).replace(/\D/g, "") : authed.qq;
    const targetRoleRequested = String(url.searchParams.get("targetRole") || "");
    const targetRole = portalIsDeveloper && ["member", "admin", "owner", "developer"].includes(targetRoleRequested) ? targetRoleRequested : await resolvePortalRole(env, targetQq, groupId);
    const visibleRank = portalIsDeveloper ? 3 : portalRoleRank(role);
    const settings = [];
    for (const definition of PORTAL_SETTING_DEFINITIONS) {
      if (portalRoleRank(definition.minRole) > visibleRank) continue;
      settings.push({ ...definition, value: await readPortalSettingValue(env, definition, groupId, targetQq) });
    }
    return jsonResponse({ ok: true, targetQq, targetRole, viewerRole: portalIsDeveloper ? "developer" : role, settings, developerAuditModes: portalIsDeveloper ? ["log", "silent"] : ["log"] });
  }
  if (request.method === "POST" && path === "/settings-center") {
    const definition = PORTAL_SETTING_DEFINITIONS.find(item => item.key === String(body.key || ""));
    if (!definition) return jsonResponse({ ok: false, message: "未知设置项目。" }, 400);
    const targetQq = portalIsDeveloper ? String(body.targetQq || authed.qq).replace(/\D/g, "") : authed.qq;
    const targetRole = portalIsDeveloper && ["member", "admin", "owner", "developer"].includes(String(body.targetRole || "")) ? String(body.targetRole) : await resolvePortalRole(env, targetQq, groupId);
    const actorRank = portalIsDeveloper ? 3 : portalRoleRank(role);
    if (portalRoleRank(definition.minRole) > actorRank) return jsonResponse({ ok: false, message: "你的角色无权修改该设置。" }, 403);
    if (!portalIsDeveloper && definition.scope === "user" && targetQq !== authed.qq) return jsonResponse({ ok: false, message: "只能修改自己的个人设置。" }, 403);
    if (["rule_monitor_enabled","rule_proxy_mode","rule_proxy_mute_seconds","rule_proxy_kick_authorized","join_reject_authorized"].includes(definition.key) && !(await isVerifiedGroupOwner(env, groupId, authed.qq))) return jsonResponse({ ok: false, message: "此高風險群級設定只能由 NapCat 即時確認的目前群主修改。" }, 403);
    await writePortalSettingValue(env, definition, groupId, targetQq, body.value);
    const auditMode = portalIsDeveloper && body.auditMode === "silent" ? "silent" : "log";
    if (auditMode === "log") await writeSystemAudit(env, { type: "settings_center", groupId, actorId: authed.qq, targetId: targetQq, targetRole, action: definition.key, value: body.value });
    return jsonResponse({ ok: true, message: auditMode === "silent" ? "设置已保存（不记录操作日志）。" : "设置已保存并记录操作日志。" });
  }

  if (request.method === "GET" && path === "/integrations/bilibili") {
    if (!(permissions.aiAdmin || permissions.groupOps || permissions.nativeAdmin || portalIsDeveloper)) return jsonResponse({ ok: false, message: "缺少串接管理权限。" }, 403);
    const connectors = await listBilibiliConnectors(env, groupId);
    return jsonResponse({ ok: true, connectors: connectors.map(item => ({ ...item, webhookUrl: `https://${url.host}/api/integrations/bilibili/webhook/${item.webhookSecret}` })), note: "不固定任何创作者。请填写实际要串接的创作者，并让其授权你的 Bilibili 开放平台应用，或由你信任的事件桥接器向专属 Webhook 发送事件。" });
  }
  if (request.method === "POST" && path === "/integrations/bilibili") {
    if (!(permissions.aiAdmin || permissions.groupOps || permissions.nativeAdmin || portalIsDeveloper)) return jsonResponse({ ok: false, message: "缺少串接管理权限。" }, 403);
    const action = String(body.action || "save");
    if (action === "delete") {
      const item = await readJson(env, `bili:connector:${body.id}`, null);
      if (!item || item.groupId !== groupId) return jsonResponse({ ok: false, message: "找不到串接。" }, 404);
      await dbDel(env, `bili:webhook_secret:${item.webhookSecret}`);
      await dbDel(env, `bili:connector:${item.id}`);
      const ids = await readJson(env, `bili:connector:index:${groupId}`, []);
      await dbPut(env, `bili:connector:index:${groupId}`, JSON.stringify(ids.filter(id => id !== item.id)));
      return jsonResponse({ ok: true, message: "B站串接已删除。" });
    }
    if (action === "test") {
      const item = await readJson(env, `bili:connector:${body.id}`, null);
      if (!item || item.groupId !== groupId) return jsonResponse({ ok: false, message: "找不到串接。" }, 404);
      const eventType = body.eventType === "video_publish" ? "video_publish" : "live_start";
      const result = await sendBilibiliConnectorNotification(env, item, { type: eventType, creatorId: item.creatorId, creatorName: item.creatorName, title: eventType === "live_start" ? "测试直播通知" : "测试新视频通知", url: "https://www.bilibili.com/", eventId: `test:${Date.now()}` });
      return jsonResponse({ ok: result.ok, message: result.ok ? "测试事件已处理。" : result.error }, result.ok ? 200 : 502);
    }
    const id = String(body.id || `bili_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`);
    const existing = await readJson(env, `bili:connector:${id}`, null);
    const webhookSecret = existing?.webhookSecret || crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
    const item = {
      id, groupId, webhookSecret,
      creatorId: String(body.creatorId || existing?.creatorId || "").trim(),
      creatorName: String(body.creatorName || existing?.creatorName || "").trim().slice(0, 120),
      mode: ["official_webhook", "generic_webhook"].includes(body.mode) ? body.mode : "official_webhook",
      enabled: body.enabled !== false,
      liveNotify: Boolean(body.liveNotify), liveAtAll: Boolean(body.liveAtAll),
      videoNotify: Boolean(body.videoNotify), videoAtAll: Boolean(body.videoAtAll),
      createdBy: existing?.createdBy || authed.qq, createdAt: existing?.createdAt || Date.now(), updatedAt: Date.now()
    };
    if (!item.creatorId && !item.creatorName) return jsonResponse({ ok: false, message: "请填写创作者名称或开放平台创作者 ID。" }, 400);
    await dbPut(env, `bili:connector:${id}`, JSON.stringify(item));
    await dbPut(env, `bili:webhook_secret:${webhookSecret}`, id);
    await appendIndex(env, `bili:connector:index:${groupId}`, id, 500);
    await writeSystemAudit(env, { type: "bilibili_connector", groupId, actorId: authed.qq, action: existing ? "update" : "create", connectorId: id });
    return jsonResponse({ ok: true, message: "B站串接已保存。", connector: { ...item, webhookUrl: `https://${url.host}/api/integrations/bilibili/webhook/${webhookSecret}` } });
  }

  if (request.method === "GET" && path === "/health") {
    const mode = url.searchParams.get("mode") === "full" ? "full" : "quick";
    if (mode === "full" && !portalIsDeveloper) return jsonResponse({ ok: false, message: "完整健康检查仅开发者可执行，因为会发送最小模型请求。" }, 403);
    return jsonResponse(await runHealthChecks(env, { mode }));
  }

  if (request.method === "GET" && path === "/models") {
    const health = await readJson(env, "health:last:quick", null);
    const lastByName = Object.fromEntries((health?.checks || []).map(item => [item.name, item]));
    const registry = [
      ...parseList(env.GEMMA_CHAT_MODELS, ["gemma-4-26b-a4b-it", "gemma-4-31b-it"]).map((id, index) => ({ id, provider: "Google", family: "Gemma", billing: "Gemini 免费层额度", capabilities: ["text", "chat", "routing"], priority: index + 1, status: lastByName[id.includes("31b") ? "Gemma 4 31B" : "Gemma 4 26B"]?.status || "unknown" })),
      ...parseList(env.GEMINI_CHAT_MODELS).map((id, index) => ({ id, provider: "Google", family: "Gemini", billing: "未启用付费／免费层额度", capabilities: ["text", "chat", "vision"], priority: index + 1, status: lastByName["Gemini API"]?.status || "unknown" })),
      ...[env.DEEPSEEK_FLASH_MODEL || DEFAULTS.deepseekFlashModel].filter(Boolean).map((id, index) => ({ id, provider: "DeepSeek", family: "DeepSeek Flash", billing: "付费余额／受每日预算限制", capabilities: ["text", "chat", "context_summary", "code"], priority: index + 1, status: lastByName["DeepSeek API"]?.status || (deepSeekApiKeys(env).length ? "unknown" : "unconfigured") }))
    ];
    const deepseekDailyBudgetCny = await getQuotaNumber(env, "quota:deepseek:global_daily_cny", Number(env.DEEPSEEK_DAILY_BUDGET_CNY || 0.35));
    return jsonResponse({
      ok: true,
      models: registry,
      routing: { decision: "gemma-4-26b-a4b-it（仅插话／规则分类）", simple: "Gemini 免费模型池", general: "Gemini 免费模型池", vision: "Gemini 免费模型池", freeFallback: "gemma-4-31b-it", paidEmergencyFallback: env.DEEPSEEK_FLASH_MODEL || DEFAULTS.deepseekFlashModel },
      costPolicy: { mode: String(env.MODEL_COST_POLICY || DEFAULTS.modelCostPolicy), geminiBilling: "free_tier", deepseekBilling: "paid_limited", deepseekDailyBudgetCny, emergencyFallback: envFlag(env.DEEPSEEK_EMERGENCY_FALLBACK, DEFAULTS.deepseekEmergencyFallback), paidContextSummary: envFlag(env.ALLOW_PAID_CONTEXT_SUMMARY, DEFAULTS.paidContextSummary) }
    });
  }

  if (request.method === "GET" && path === "/tasks") {
    if (!portalIsDeveloper && !groupId) return jsonResponse({ ok: false, message: "请先选择群组。" }, 400);
    const status = await (await getOneBotHub(env).fetch("https://onebot-hub/status")).json().catch(() => ({}));
    const queues = Array.isArray(status.queues) ? status.queues : [];
    const visible = portalIsDeveloper ? queues : queues.filter(item => String(item.groupId || "") === String(groupId));
    return jsonResponse({ ok: true, inFlightQuestions: visible.filter(item => item.startedAt).length, queuedQuestions: visible.reduce((sum, item) => sum + (item.queued?.length || 0), 0), queues: visible });
  }

  if (request.method === "POST" && path === "/tasks/cancel") {
    if (!(permissions.groupOps || permissions.aiAdmin || portalIsDeveloper)) return jsonResponse({ ok: false, message: "缺少任务管理权限。" }, 403);
    const targetGroup = String(body.groupId || groupId || "").replace(/\D/g, "");
    const targetUser = String(body.userId || "").replace(/\D/g, "");
    if (!portalIsDeveloper && targetGroup !== groupId) return jsonResponse({ ok: false, message: "只能管理当前群的任务。" }, 403);
    const response = await getOneBotHub(env).fetch("https://onebot-hub/queue/cancel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ groupId: targetGroup, userId: targetUser, messageId: String(body.messageId || "") }) });
    return jsonResponse(await response.json().catch(() => ({ ok: false, message: "任务取消失败。" })), response.status);
  }

  if (request.method === "POST" && path === "/tasks/clear") {
    if (!(permissions.groupOps || portalIsDeveloper)) return jsonResponse({ ok: false, message: "缺少清空等待列权限。" }, 403);
    const targetGroup = String(body.groupId || groupId || "").replace(/\D/g, "");
    if (!portalIsDeveloper && targetGroup !== groupId) return jsonResponse({ ok: false, message: "只能清空当前群等待列。" }, 403);
    const response = await getOneBotHub(env).fetch("https://onebot-hub/queue/clear", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ groupId: targetGroup }) });
    return jsonResponse(await response.json().catch(() => ({ ok: false, message: "等待列清空失败。" })), response.status);
  }

  if (request.method === "POST" && path === "/simulator") {
    const text = String(body.text || "").trim();
    const requestedSenderRole = String(body.senderRole || body.role || body.sender_role || "member");
    const senderRole = ["owner", "admin", "member"].includes(requestedSenderRole) ? requestedSenderRole : "member";
    const mentionsBot = Boolean(body.mentionsBot);
    const hasImage = Boolean(body.hasImage);
    const currentlyBusy = Boolean(body.currentlyBusy);
    const isCommand = /^[!！]/.test(text);
    const localManagement = ["owner", "admin"].includes(senderRole) ? localModerationIntent(text) : { action: "none", confidence: 0 };
    const managementCandidate = localManagement.action !== "none" && !isCommand;
    const explicitQuestion = mentionsBot && Boolean(text || hasImage) && !isCommand && !managementCandidate;
    const interjectRate = groupId ? Math.max(0, Math.min(100, Number(await dbGet(env, `interject_rate:${groupId}`) || DEFAULTS.interjectRate))) : DEFAULTS.interjectRate;
    let final = "静默";
    if (isCommand) final = "执行指令；指令回复不写入聊天记忆";
    else if (managementCandidate) final = `建立「${moderationActionLabel(localManagement.action)}」提案，等待二次确认；不直接执行`;
    else if (explicitQuestion && currentlyBusy) final = "加入该群友的个人等待列";
    else if (explicitQuestion) final = "立即进入 AI 回答流程";
    else if (interjectRate > 0) final = "可进入随机插话候选；仍需 Gemma 判断与概率检查";
    return jsonResponse({ ok: true, parsed: { text, senderRole, mentionsBot, hasImage, isCommand, managementCandidate, managementAction: localManagement.action, explicitQuestion, currentlyBusy, interjectRate }, decisions: { queue: explicitQuestion && currentlyBusy, thinking: explicitQuestion && !currentlyBusy, recordReply: explicitQuestion && !isCommand, commandOrSystemRecordedAsChat: false, final }, steps: ["解析 OneBot 事件", `发送者角色：${senderRole}`, mentionsBot ? "检测到 @机器人" : "未检测到 @机器人", managementCandidate ? `检测到待确认操作：${moderationActionLabel(localManagement.action)}` : "未检测到明确待确认操作", final] });
  }

  if (!groupId && !path.startsWith("/root/")) return jsonResponse({ ok: false, message: "请先选择群组。" }, 400);
  if (groupId && !(await isGroupWhitelisted(env, groupId))) return jsonResponse({ ok: false, message: "该群已不在白名单。" }, 403);


  if (request.method === "GET" && path === "/group-work") {
    if (!(permissions.groupOps || permissions.aiAdmin || portalIsDeveloper)) return jsonResponse({ ok: false, message: "缺少群务查看权限。" }, 403);
    const ids = await readJson(env, `groupwork:index:${groupId}`, []); const items = [];
    for (const id of ids.slice(-200).reverse()) { const item = await readJson(env, `groupwork:${id}`, null); if (item) items.push(item); }
    return jsonResponse({ ok: true, items });
  }
  if (request.method === "POST" && path === "/group-work/decision") {
    const result = await handleGroupWorkDecision(env, { groupId, actorId: authed.qq, id: String(body.id || ""), decision: body.decision === "cancel" ? "cancel" : "confirm" });
    return jsonResponse(result, result.ok ? 200 : 403);
  }

  if (request.method === "GET" && path === "/rule-violations") {
    if (!(permissions.aiAdmin || permissions.groupOps || permissions.nativeAdmin || portalIsDeveloper)) return jsonResponse({ ok: false, message: "缺少群规记录查看权限。" }, 403);
    const ids = await readJson(env, `ruleviolation:index:${groupId}`, []);
    const member = String(url.searchParams.get("member") || "").trim().toLowerCase();
    const content = String(url.searchParams.get("content") || "").trim().toLowerCase();
    const type = String(url.searchParams.get("type") || "").trim().toLowerCase();
    const items = [];
    for (const id of ids.slice(-5000).reverse()) {
      const item = await readJson(env, `ruleviolation:${id}`, null);
      if (!item) continue;
      const memberText = `${item.senderName || ""} ${item.userId || ""}`.toLowerCase();
      if (member && !memberText.includes(member)) continue;
      if (content && !String(item.content || "").toLowerCase().includes(content)) continue;
      if (type && !String(item.violationType || item.rule || "").toLowerCase().includes(type)) continue;
      items.push(item);
      if (items.length >= Math.max(1, Math.min(1000, Number(url.searchParams.get("limit") || 300)))) break;
    }
    return jsonResponse({ ok: true, items, settings: {
      monitorEnabled: await dbGet(env, `rule_monitor_enabled:${groupId}`) !== "false",
      proxyMode: normalizeRuleProxyMode(await dbGet(env, `rule_proxy_mode:${groupId}`) || DEFAULTS.ruleProxyMode),
      muteSeconds: parseUnlimitedNonNegativeInteger(await dbGet(env, `rule_proxy_mute_seconds:${groupId}`), DEFAULTS.ruleProxyMuteSeconds),
      kickAuthorized: await dbGet(env, `rule_proxy_kick_authorized:${groupId}`) === "true"
    } });
  }
  if (request.method === "POST" && path === "/rule-violations/settings") {
    if (!(await isVerifiedGroupOwner(env, groupId, authed.qq))) return jsonResponse({ ok: false, message: "只有 NapCat 即時確認的目前群主可以修改群規監控與 AI 代理設定。" }, 403);
    if (Object.prototype.hasOwnProperty.call(body, "monitorEnabled")) await dbPut(env, `rule_monitor_enabled:${groupId}`, body.monitorEnabled ? "true" : "false");
    if (Object.prototype.hasOwnProperty.call(body, "proxyMode")) await dbPut(env, `rule_proxy_mode:${groupId}`, normalizeRuleProxyMode(body.proxyMode));
    if (Object.prototype.hasOwnProperty.call(body, "muteSeconds")) await dbPut(env, `rule_proxy_mute_seconds:${groupId}`, String(parseUnlimitedNonNegativeInteger(body.muteSeconds, DEFAULTS.ruleProxyMuteSeconds)));
    if (Object.prototype.hasOwnProperty.call(body, "kickAuthorized")) body.kickAuthorized ? await dbPut(env, `rule_proxy_kick_authorized:${groupId}`, "true") : await dbDel(env, `rule_proxy_kick_authorized:${groupId}`);
    await writeSystemAudit(env, { type: "rule_proxy_portal_settings", groupId, actorId: authed.qq, action: "update" });
    return jsonResponse({ ok: true, message: "群规监控与 AI 代理设置已保存。" });
  }

  if (request.method === "GET" && path === "/moderation/proposals") {
    if (!(permissions.groupOps || permissions.aiAdmin || portalIsDeveloper)) return jsonResponse({ ok: false, message: "缺少群待确认操作查看权限。" }, 403);
    const items = await listModerationProposals(env, groupId, { limit: Number(url.searchParams.get("limit") || 100) });
    return jsonResponse({ ok: true, proposals: items });
  }

  if (request.method === "POST" && path === "/moderation/confirm") {
    if (!(permissions.groupOps || portalIsDeveloper)) return jsonResponse({ ok: false, message: "缺少确认群管理操作的权限。" }, 403);
    const result = await handleModerationConfirmation(env, { groupId, actorId: authed.qq, actorRole: role, isDeveloper: portalIsDeveloper, hasGroupOpsPermission: permissions.groupOps, confirmation: { type: "confirm", id: String(body.id || "") } });
    return jsonResponse({ ok: result.ok !== false, ...result }, result.ok === false ? 400 : 200);
  }

  if (request.method === "POST" && path === "/moderation/cancel") {
    if (!(permissions.groupOps || portalIsDeveloper)) return jsonResponse({ ok: false, message: "缺少取消群管理操作的权限。" }, 403);
    const result = await handleModerationConfirmation(env, { groupId, actorId: authed.qq, actorRole: role, isDeveloper: portalIsDeveloper, hasGroupOpsPermission: permissions.groupOps, confirmation: { type: "cancel", id: String(body.id || "") } });
    return jsonResponse({ ok: result.ok !== false, ...result }, result.ok === false ? 400 : 200);
  }

  if (request.method === "GET" && path === "/memories") {
    const privateKey = `user_memo:${groupId}:${authed.qq}`;
    const publicKey = `group_public_memos:${groupId}`;
    const privateMemos = await migratePortalMemories(env, privateKey, await readJson(env, privateKey, []), authed.qq);
    const publicMemos = await migratePortalMemories(env, publicKey, await readJson(env, publicKey, []), "group");
    return jsonResponse({ ok: true, private: privateMemos, public: publicMemos, memory_banned: await isMemoryBanned(env, authed.qq) });
  }

  if (["POST", "PUT", "DELETE"].includes(request.method) && path === "/memories") {
    if (await isMemoryBanned(env, authed.qq)) return jsonResponse({ ok: false, message: "你的记忆编辑权限已被冻结。" }, 403);
    const scope = body.scope === "public" ? "public" : "private";
    const key = scope === "public" ? `group_public_memos:${groupId}` : `user_memo:${groupId}:${authed.qq}`;
    const list = await migratePortalMemories(env, key, await readJson(env, key, []), scope === "public" ? "group" : authed.qq);
    if (request.method === "POST") {
      const text = String(body.text || "").trim();
      if (!text) return jsonResponse({ ok: false, message: "记忆内容不能为空。" }, 400);
      let item = { id: crypto.randomUUID(), text, scope, owner: authed.qq, subjectQq: String(body.subjectQq || authed.qq), at: new Date().toISOString() };
      item = await upsertMemoryVector(env, item, groupId).catch(error => { console.warn(error); return item; });
      list.push(item); await dbPut(env, key, JSON.stringify(list));
      await writeMemoryAudit(env, { groupId, userId: authed.qq, action: "网页新增记忆", before: null, after: JSON.stringify(item) });
      return jsonResponse({ ok: true, item });
    }
    const id = String(body.id || "");
    if (!id) return jsonResponse({ ok: false, message: "无效记忆不会显示操作按钮，请刷新页面。" }, 400);
    const idx = list.findIndex(x => String(x.id) === id);
    if (idx < 0) return jsonResponse({ ok: false, message: "该记忆已删除或已被更新，请刷新列表。" }, 404);
    const canEdit = scope === "private" || list[idx].owner === authed.qq || permissions.aiAdmin || permissions.developer;
    if (!canEdit) return jsonResponse({ ok: false, message: "权限不足。" }, 403);
    if (request.method === "PUT") {
      const text = String(body.text || "").trim(); if (!text) return jsonResponse({ ok: false, message: "记忆内容不能为空。" }, 400);
      const before = JSON.stringify(list[idx]);
      list[idx] = { ...list[idx], text, updatedAt: new Date().toISOString() };
      list[idx] = await upsertMemoryVector(env, list[idx], groupId).catch(error => { console.warn(error); return list[idx]; });
      await dbPut(env, key, JSON.stringify(list));
      await writeMemoryAudit(env, { groupId, userId: authed.qq, action: "网页修改记忆", before, after: JSON.stringify(list[idx]) });
      return jsonResponse({ ok: true, item: list[idx] });
    }
    const removed = list.splice(idx, 1)[0];
    const vectorizeDeleted = await deleteMemoryVector(env, removed);
    await dbPut(env, key, JSON.stringify(list));
    await writeMemoryAudit(env, { groupId, userId: authed.qq, action: "网页删除记忆与向量", before: JSON.stringify(removed), after: null });
    return jsonResponse({ ok: true, message: "记忆已删除。", vectorizeDeleted });
  }

  if (request.method === "GET" && path === "/vector-search") {
    const query = String(url.searchParams.get("q") || "").trim();
    if (!query) return jsonResponse({ ok: true, results: [] });
    try {
      const results = await searchPortalVectors(env, { groupId, userId: authed.qq, permissions, query, limit: Number(url.searchParams.get("limit") || 20) });
      return jsonResponse({ ok: true, query, results });
    } catch (error) {
      return jsonResponse({ ok: false, message: `向量搜索失败：${error?.message || error}` }, 502);
    }
  }

  if (request.method === "GET" && path === "/settings") {
    return jsonResponse({
      ok: true,
      dnd: await dbGet(env, `dnd:${groupId}:${authed.qq}`) === "true",
      style: await dbGet(env, `custom_style:${groupId}:${authed.qq}`) || "",
      modelPreference: await dbGet(env, `model_pref:${groupId}:${authed.qq}`) || "auto",
      quota: await getUserQuota(env, groupId, authed.qq)
    });
  }

  if (request.method === "POST" && path === "/settings") {
    if (typeof body.dnd === "boolean") body.dnd ? await dbPut(env, `dnd:${groupId}:${authed.qq}`, "true") : await dbDel(env, `dnd:${groupId}:${authed.qq}`);
    if (Object.prototype.hasOwnProperty.call(body, "style")) await dbPut(env, `custom_style:${groupId}:${authed.qq}`, String(body.style || ""));
    if (Object.prototype.hasOwnProperty.call(body, "modelPreference")) {
      const pref = normalizeModelPreference(body.modelPreference); if (!pref) return jsonResponse({ ok: false, message: "未知模型偏好。" }, 400);
      await dbPut(env, `model_pref:${groupId}:${authed.qq}`, pref);
    }
    return jsonResponse({ ok: true, message: "个人设置已保存。" });
  }

  if (request.method === "GET" && path === "/schedules") {
    return jsonResponse({ ok: true, schedules: await listUserSchedules(env, authed.qq, groupId) });
  }
  if (request.method === "POST" && path === "/schedules") {
    const parsed = parseScheduleRequest(String(body.schedule || ""));
    if (!parsed.ok) return jsonResponse(parsed, 400);
    if (DEFAULTS.scheduleMaxActivePerUser > 0 && await countActiveSchedulesForUser(env, authed.qq) >= DEFAULTS.scheduleMaxActivePerUser && !permissions.developer) return jsonResponse({ ok: false, message: `有效排程数量已达上限。` }, 429);
    const review = await reviewScheduleWithGemma(env, JSON.stringify(parsed));
    if (review.decision === "reject") return jsonResponse({ ok: false, message: `排程已拒绝：${review.reason}` }, 400);
    const managementAction = parseManagementScheduleAction(parsed.content);
    const directManagement = Boolean(managementAction && (permissions.nativeAdmin || permissions.groupOps || permissions.developer));
    const status = managementAction ? (directManagement ? "active" : "pending_owner") : (review.decision === "allow" ? "active" : "pending_owner");
    const item = await createScheduleRecord(env, { ...parsed, creatorId: authed.qq, groupId, status, enabled: status === "active", managementAction, review });
    if (status === "pending_owner") await notifyDeveloper(env, `【排程待处理】\n编号：${item.id}\n群号：${groupId}\n申请人：${authed.qq}\n内容：${item.content}\n请在 Portal 指派审核人或自行处理。`);
    return jsonResponse({ ok: true, schedule: item, message: status === "active" ? "排程已建立。" : "排程已送交开发者处理。" });
  }
  if (request.method === "DELETE" && path === "/schedules") {
    const result = await cancelSchedule(env, String(body.id || ""), authed.qq, permissions.aiAdmin || permissions.developer);
    return jsonResponse(result, result.ok ? 200 : 403);
  }

  if (request.method === "POST" && path === "/ops/action") {
    if (!(permissions.groupOps || portalIsDeveloper)) return jsonResponse({ ok: false, message: "缺少群操作权限。" }, 403);
    const action = String(body.action || "");
    const target = String(body.qq || "").replace(/\D/g, "");
    const proposedActions = ["mute", "unmute", "kick", "whole_mute", "whole_unmute", "set_admin", "unset_admin"];
    if (proposedActions.includes(action)) {
      if (["set_admin", "unset_admin"].includes(action) && !(await isBotVerifiedGroupOwner(env, groupId))) {
        return jsonResponse({ ok: false, message: "机器人账号当前不是本群群主，真正 QQ 管理员任免功能不可用。" }, 403);
      }
      if (moderationActionNeedsTarget(action) && !target) return jsonResponse({ ok: false, message: "请输入目标 QQ。" }, 400);
      const member = target ? await getGroupMemberSafe(env, groupId, target) : null;
      const proposal = await createModerationProposal(env, {
        groupId,
        actorId: authed.qq,
        actorName: authed.name || authed.qq,
        actorRole: portalIsDeveloper ? "developer" : role,
        action,
        targetId: target,
        targetName: member?.card || member?.nickname || target,
        targetRole: member?.role || "member",
        durationSeconds: action === "mute" ? Math.max(60, parseDurationSeconds(String(body.duration || "10分"))) : 0,
        sourceText: `Portal 提出 ${moderationActionLabel(action)}`,
        classifierReason: "Portal 手动确认单",
        messageId: ""
      });
      return jsonResponse({ ok: true, pendingConfirmation: true, proposal, message: `已建立待确认操作 ${proposal.id}，尚未执行。请在「待确认操作」页面确认。` });
    }
    let result;
    if (action === "rename_group" && String(body.value || "").trim()) result = await runOneBotGroupOperation(env, "set_group_name", { group_id: numericId(groupId), group_name: String(body.value).trim().slice(0, 60) }, { actorId: authed.qq, groupId, action: "网页改群名" });
    else if (action === "set_card" && target) result = await runOneBotGroupOperation(env, "set_group_card", { group_id: numericId(groupId), user_id: numericId(target), card: String(body.value || "").trim().slice(0, 60) }, { actorId: authed.qq, groupId, targetId: target, action: "网页改名片" });
    else return jsonResponse({ ok: false, message: "参数不完整或不支持的操作。" }, 400);
    return jsonResponse({ ok: result.ok, message: result.ok ? "操作已执行。" : `操作失败：${result.error}` }, result.ok ? 200 : 502);
  }

  if (path.startsWith("/admin/") && !(permissions.aiAdmin || permissions.developer)) return jsonResponse({ ok: false, message: "Error 403：缺少 AI 管理权限。" }, 403);
  if (request.method === "GET" && path === "/admin/state") {
    return jsonResponse({
      ok: true,
      ai_on: await dbGet(env, `ai_off:${groupId}`) !== "true",
      memory_on: await dbGet(env, `memo:${groupId}`) !== "false",
      persona: await dbGet(env, `group_persona:${groupId}`) || "",
      interject_rate: Number(await dbGet(env, `interject_rate:${groupId}`) || DEFAULTS.interjectRate),
      commands_enabled: await dbGet(env, `web_command_off:${groupId}`) !== "true",
      active_speaking: await getFeatureFlag(env, `active_speaking:${groupId}`, false),
      keywords: await readJson(env, `keyword_filter:${groupId}`, []),
      blacklist: await readJson(env, `blacklist_group:${groupId}`, []),
      audit_logs: await readJson(env, `audit:system:group:${groupId}`, []),
      auto_checkin_enabled: await dbGet(env, `auto_checkin_enabled:${groupId}`) === "true",
      auto_checkin_time: await dbGet(env, `auto_checkin_time:${groupId}`) || DEFAULTS.autoCheckinTime,
      welcome_enabled: await dbGet(env, `welcome_enabled:${groupId}`) === "true",
      welcome_text: await dbGet(env, `welcome_text:${groupId}`) || DEFAULTS.welcomeText,
      moderation_target_cooldown_seconds: Number(await dbGet(env, `moderation_target_cooldown_seconds:${groupId}`) || DEFAULTS.moderationTargetCooldownSeconds),
      newcomer_observation_days: Number(await dbGet(env, `newcomer_observation_days:${groupId}`) || DEFAULTS.newcomerObservationDays),
      join_assist_enabled: await dbGet(env, `join_assist_enabled:${groupId}`) === "true",
      rule_monitor_enabled: await dbGet(env, `rule_monitor_enabled:${groupId}`) !== "false",
      rule_proxy_mode: normalizeRuleProxyMode(await dbGet(env, `rule_proxy_mode:${groupId}`) || DEFAULTS.ruleProxyMode),
      rule_proxy_mute_seconds: parseUnlimitedNonNegativeInteger(await dbGet(env, `rule_proxy_mute_seconds:${groupId}`), DEFAULTS.ruleProxyMuteSeconds),
      rule_proxy_kick_authorized: await dbGet(env, `rule_proxy_kick_authorized:${groupId}`) === "true",
      bot_is_owner: await isBotVerifiedGroupOwner(env, groupId),
      auto_checkin_enabled: true,
      auto_checkin_time: "00:00"
    });
  }
  if (request.method === "POST" && path === "/admin/state") {
    if (typeof body.ai_on === "boolean") body.ai_on ? await dbDel(env, `ai_off:${groupId}`) : await dbPut(env, `ai_off:${groupId}`, "true");
    if (typeof body.memory_on === "boolean") await dbPut(env, `memo:${groupId}`, body.memory_on ? "true" : "false");
    if (Object.prototype.hasOwnProperty.call(body, "persona")) await dbPut(env, `group_persona:${groupId}`, String(body.persona || ""));
    if (Object.prototype.hasOwnProperty.call(body, "interject_rate")) await dbPut(env, `interject_rate:${groupId}`, String(Math.max(0, Math.min(100, Number(body.interject_rate || 0)))));
    if (Object.prototype.hasOwnProperty.call(body, "commands_enabled")) body.commands_enabled ? await dbDel(env, `web_command_off:${groupId}`) : await dbPut(env, `web_command_off:${groupId}`, "true");
    if (Object.prototype.hasOwnProperty.call(body, "keywords")) await dbPut(env, `keyword_filter:${groupId}`, JSON.stringify(String(body.keywords || "").split(/\n|,/).map(s => s.trim()).filter(Boolean)));
    if (["welcome_enabled", "welcome_text", "moderation_target_cooldown_seconds", "newcomer_observation_days"].some(key => Object.prototype.hasOwnProperty.call(body, key))) {
      if (!(role === "owner" || permissions.developer)) return jsonResponse({ ok: false, message: "这些群级设置仅群主或开发者可修改。" }, 403);
      if (Object.prototype.hasOwnProperty.call(body, "welcome_enabled")) await dbPut(env, `welcome_enabled:${groupId}`, body.welcome_enabled ? "true" : "false");
      if (Object.prototype.hasOwnProperty.call(body, "welcome_text")) await dbPut(env, `welcome_text:${groupId}`, String(body.welcome_text || DEFAULTS.welcomeText).slice(0, 500));
      if (Object.prototype.hasOwnProperty.call(body, "moderation_target_cooldown_seconds")) await dbPut(env, `moderation_target_cooldown_seconds:${groupId}`, String(parseUnlimitedNonNegativeInteger(body.moderation_target_cooldown_seconds, 0)));
      if (Object.prototype.hasOwnProperty.call(body, "newcomer_observation_days")) await dbPut(env, `newcomer_observation_days:${groupId}`, String(Math.max(0, Math.min(30, Number(body.newcomer_observation_days || 0)))));
    }
    if (Object.prototype.hasOwnProperty.call(body, "join_assist_enabled")) {
      if (!(permissions.aiAdmin || permissions.developer || permissions.nativeAdmin)) return jsonResponse({ ok: false, message: "缺少 AI 管理权限，无法设置入群辅助。" }, 403);
      await dbPut(env, `join_assist_enabled:${groupId}`, body.join_assist_enabled ? "true" : "false");
    }
    if (Object.prototype.hasOwnProperty.call(body, "rule_monitor_enabled")) {
      if (!(await isVerifiedGroupOwner(env, groupId, authed.qq))) return jsonResponse({ ok: false, message: "只有当前真实群主可以改变群规持续监控；开发者只能查看。" }, 403);
      await dbPut(env, `rule_monitor_enabled:${groupId}`, body.rule_monitor_enabled ? "true" : "false");
    }
    if (Object.prototype.hasOwnProperty.call(body, "active_speaking")) {
      if (!permissions.developer) return jsonResponse({ ok: false, message: "只有开发者可以开关主动发话。" }, 403);
      await setFeatureFlag(env, `active_speaking:${groupId}`, Boolean(body.active_speaking));
      const groups = await readJson(env, "active_speaking:groups", []); if (!groups.includes(groupId)) { groups.push(groupId); await dbPut(env, "active_speaking:groups", JSON.stringify(groups)); }
    }
    await writeSystemAudit(env, { type: "portal_ai_settings", groupId, actorId: authed.qq, action: "update" });
    return jsonResponse({ ok: true, message: "群务设置已保存。" });
  }
  if (request.method === "GET" && path === "/ai-decisions") {
    if (!(permissions.aiAdmin || permissions.groupOps || permissions.nativeAdmin || portalIsDeveloper)) return jsonResponse({ ok: false, message: "缺少 AI 回覆纪录查看权限。" }, 403);
    const requestedGroupId = portalIsDeveloper && url.searchParams.get("all") === "1" ? "" : groupId;
    const logs = await listAiDecisionLogs(env, {
      groupId: requestedGroupId,
      query: url.searchParams.get("q") || "",
      decision: url.searchParams.get("decision") || "",
      triggerType: url.searchParams.get("triggerType") || "",
      limit: Number(url.searchParams.get("limit") || 300)
    });
    return jsonResponse({ ok: true, logs });
  }

  if (request.method === "GET" && path === "/admin/logs") {
    const query = String(url.searchParams.get("q") || "").trim().toLowerCase();
    const type = String(url.searchParams.get("type") || "").trim().toLowerCase();
    const actor = String(url.searchParams.get("actor") || "").trim();
    const logs = await readJson(env, `audit:system:group:${groupId}`, []);
    const filtered = logs.filter(item => {
      const haystack = JSON.stringify(item).toLowerCase();
      return (!query || haystack.includes(query)) && (!type || String(item.type || "").toLowerCase().includes(type)) && (!actor || String(item.actorId || "") === actor);
    });
    return jsonResponse({ ok: true, logs: filtered.slice(-500).reverse() });
  }

  if (request.method === "POST" && path === "/admin/blacklist") {
    const target = String(body.qq || "").replace(/\D/g, ""); if (!target) return jsonResponse({ ok: false, message: "请输入 QQ。" }, 400);
    if (body.block) await dbPut(env, `blacklist:${groupId}:${target}`, "true"); else await dbDel(env, `blacklist:${groupId}:${target}`);
    const list = await readJson(env, `blacklist_group:${groupId}`, []); const next = body.block ? [...new Set([...list, target])] : list.filter(x => x !== target);
    await dbPut(env, `blacklist_group:${groupId}`, JSON.stringify(next)); return jsonResponse({ ok: true, blacklist: next });
  }

  const isDev = permissions.developer || isDeveloperId(env, authed.qq);
  if (path.startsWith("/root/") && !isDev) return jsonResponse({ ok: false, message: "Error 403：仅开发者可用。" }, 403);

  if (request.method === "GET" && path === "/root/state") {
    const keyCount = parseList(env.GEMINI_API_KEYS).length + parseList(env.VECTORIZE_GEMINI_KEYS).length;
    return jsonResponse({
      ok: true,
      key_pool: { gemini_keys: parseList(env.GEMINI_API_KEYS).length, vectorize_gemini_keys: parseList(env.VECTORIZE_GEMINI_KEYS).length, total: keyCount, deepseek_keys: deepSeekApiKeys(env).length, deepseek: deepSeekApiKeys(env).length > 0 },
      stats: { total_calls: await dbGet(env, "STAT_TOTAL_CALLS") || "0", last_model: await dbGet(env, "STAT_LAST_MODEL") || "无记录" },
      errors: await readJson(env, "system_error_logs", []),
      groups: await getWhitelistedGroupsForUser(env, authed.qq),
      health: await buildHealthState(env),
      flags: {
        private_chat_enabled: await getFeatureFlag(env, "private_chat_enabled", false),
        private_schedule_enabled: await getFeatureFlag(env, "private_schedule_enabled", false),
        private_appeal_enabled: await getFeatureFlag(env, "private_appeal_enabled", true)
      }
    });
  }

  if (request.method === "GET" && path === "/root/members") {
    const members = await readJson(env, `group_members:${groupId}`, []); const output = [];
    for (const member of members) output.push({ ...member, permissions: await getEffectivePermissions(env, groupId, String(member.qq), member.role, false), privateAccess: await getPrivateAccessMode(env, String(member.qq)), quota: await getUserQuota(env, groupId, String(member.qq)) });
    return jsonResponse({ ok: true, members: output });
  }

  if (request.method === "POST" && path === "/root/member") {
    const target = String(body.qq || "").replace(/\D/g, ""); if (!target) return jsonResponse({ ok: false, message: "请输入 QQ。" }, 400);
    if (body.permission) { const perm = normalizePermissionName(body.permission); if (!perm) return jsonResponse({ ok: false, message: "未知权限。" }, 400); await setExplicitPermission(env, groupId, target, perm, Boolean(body.enabled)); }
    if (Object.prototype.hasOwnProperty.call(body, "privateAccess")) await dbPut(env, `private_access:${target}`, ["none", "commands", "full"].includes(body.privateAccess) ? body.privateAccess : "none");
    if (Object.prototype.hasOwnProperty.call(body, "memory_banned")) body.memory_banned ? await dbPut(env, `memory_banned:${target}`, "true") : await dbDel(env, `memory_banned:${target}`);
    if (Object.prototype.hasOwnProperty.call(body, "quota")) { const quota = String(body.quota || "").trim(); if (!quota || quota === "无限" || quota.toLowerCase() === "unlimited") { await dbDel(env, `quota:${groupId}:${target}`); await dbDel(env, `quota:deepseek:user:${target}`); } else { const n = Number(quota); if (!Number.isFinite(n) || n < 0) return jsonResponse({ ok: false, message: "额度必须是非负数或无限。" }, 400); await dbPut(env, `quota:${groupId}:${target}`, String(n)); await dbPut(env, `quota:deepseek:user:${target}`, String(n)); } }
    return jsonResponse({ ok: true, message: "成员权限已更新。" });
  }

  if (request.method === "GET" && path === "/root/whitelist") {
    return jsonResponse({ ok: true, groupIds: await readJson(env, "group_whitelist:index", []), privateUsers: await readJson(env, "private_access:index", []) });
  }
  if (request.method === "POST" && path === "/root/whitelist") {
    const targetGroup = String(body.groupId || "").replace(/\D/g, "");
    if (targetGroup) { body.enabled ? await dbPut(env, `group_whitelist:${targetGroup}`, "true") : await dbDel(env, `group_whitelist:${targetGroup}`); const list = await readJson(env, "group_whitelist:index", []); const next = body.enabled ? [...new Set([...list, targetGroup])] : list.filter(x => x !== targetGroup); await dbPut(env, "group_whitelist:index", JSON.stringify(next)); }
    return jsonResponse({ ok: true });
  }

  if (request.method === "POST" && path === "/root/flags") {
    for (const key of ["private_chat_enabled", "private_schedule_enabled", "private_appeal_enabled", "deepseek_enabled"]) if (Object.prototype.hasOwnProperty.call(body, key)) await setFeatureFlag(env, key, Boolean(body[key]));
    return jsonResponse({ ok: true, message: "功能开关已保存。" });
  }

  if (request.method === "GET" && path === "/root/quotas") {
    return jsonResponse({ ok: true, globalDailyCny: await dbGet(env, "quota:deepseek:global_daily_cny") || "", groupDailyCny: groupId ? await dbGet(env, `quota:deepseek:group:${groupId}`) || "" : "" });
  }
  if (request.method === "POST" && path === "/root/quotas") {
    const setQuota = async (key, value) => { const text = String(value ?? "").trim(); if (!text || text === "无限") return dbDel(env, key); const n = Number(text); if (!Number.isFinite(n) || n < 0) throw new Error("额度必须是非负数或无限"); return dbPut(env, key, String(n)); };
    try { if (Object.prototype.hasOwnProperty.call(body, "globalDailyCny")) await setQuota("quota:deepseek:global_daily_cny", body.globalDailyCny); if (groupId && Object.prototype.hasOwnProperty.call(body, "groupDailyCny")) await setQuota(`quota:deepseek:group:${groupId}`, body.groupDailyCny); } catch (error) { return jsonResponse({ ok: false, message: error.message }, 400); }
    await writeSystemAudit(env, { type: "quota", groupId, actorId: authed.qq, action: "update_deepseek_quota" });
    return jsonResponse({ ok: true, message: "DeepSeek 额度已保存。" });
  }

  if (request.method === "GET" && path === "/root/rate-limit") {
    return jsonResponse({ ok: true, globalSeconds: await getRuntimeRateLimitSeconds(env, ""), groupSeconds: groupId ? await getRuntimeRateLimitSeconds(env, groupId) : null, explicitGroup: groupId ? await dbGet(env, `runtime_rate_limit_seconds:group:${groupId}`) : null });
  }
  if (request.method === "POST" && path === "/root/rate-limit") {
    if (Object.prototype.hasOwnProperty.call(body, "globalSeconds")) await dbPut(env, "runtime_rate_limit_seconds:global", String(parseUnlimitedNonNegativeInteger(body.globalSeconds, DEFAULTS.runtimeRateLimitSeconds)));
    if (groupId && Object.prototype.hasOwnProperty.call(body, "groupSeconds")) {
      if (body.groupSeconds === "" || body.groupSeconds === null) await dbDel(env, `runtime_rate_limit_seconds:group:${groupId}`);
      else await dbPut(env, `runtime_rate_limit_seconds:group:${groupId}`, String(parseUnlimitedNonNegativeInteger(body.groupSeconds, DEFAULTS.runtimeRateLimitSeconds)));
    }
    await writeSystemAudit(env, { type: "rate_limit_portal", groupId, actorId: authed.qq, action: "update" });
    return jsonResponse({ ok: true, message: "速率限制已保存。" });
  }

  if (request.method === "GET" && path === "/root/model-registry") {
    return jsonResponse({ ok: true, categories: await runtimeModelRegistryState(env), note: "环境变量中的默认模型为锁定后备，后台修改只写入 D1，不修改公开代码或变量。" });
  }
  if (request.method === "POST" && path === "/root/model-registry") {
    const kind = normalizeRuntimeModelKind(body.kind);
    const action = String(body.action || "").toLowerCase();
    let items = await readCustomRuntimeModels(env, kind);
    if (action === "add") {
      const id = String(body.id || "").trim();
      if (!validRuntimeModelId(id)) return jsonResponse({ ok: false, message: "模型 ID 格式无效。" }, 400);
      if (immutableRuntimeModelDefaults(env, kind).includes(id)) return jsonResponse({ ok: false, message: "该模型来自锁定默认变量，不能在后台修改；可新增其他模型并调整优先级。" }, 400);
      if (items.some(item => item.id === id)) return jsonResponse({ ok: false, message: "该自定义模型已存在。" }, 409);
      items.push({ id, enabled: true, order: items.length, createdAt: new Date().toISOString() });
    } else if (action === "delete") {
      const id = String(body.id || "");
      items = items.filter(item => item.id !== id);
    } else if (action === "toggle") {
      const target = items.find(item => item.id === String(body.id || ""));
      if (!target) return jsonResponse({ ok: false, message: "找不到该自定义模型。" }, 404);
      target.enabled = body.enabled !== false;
      target.updatedAt = new Date().toISOString();
    } else if (action === "move") {
      const index = items.findIndex(item => item.id === String(body.id || ""));
      if (index < 0) return jsonResponse({ ok: false, message: "找不到该自定义模型。" }, 404);
      const targetIndex = Math.max(0, Math.min(items.length - 1, index + (body.direction === "down" ? 1 : -1)));
      const [item] = items.splice(index, 1); items.splice(targetIndex, 0, item);
    } else if (action === "reorder" && Array.isArray(body.ids)) {
      const order = body.ids.map(String);
      items.sort((a, b) => {
        const ai = order.indexOf(a.id), bi = order.indexOf(b.id);
        return (ai < 0 ? 999999 : ai) - (bi < 0 ? 999999 : bi);
      });
    } else {
      return jsonResponse({ ok: false, message: "不支持的模型管理动作。" }, 400);
    }
    items = await writeCustomRuntimeModels(env, kind, items);
    await writeSystemAudit(env, { type: "runtime_model_registry", groupId, actorId: authed.qq, action: `${action}:${kind}`, targetId: String(body.id || "") });
    return jsonResponse({ ok: true, items, categories: await runtimeModelRegistryState(env), message: "运行时模型列表已保存到 D1；默认变量与源代码没有被修改。" });
  }

  if (request.method === "GET" && path === "/root/schedules") {
    const ids = await readJson(env, "schedule:index", []); const schedules = [];
    for (const id of ids.slice(-500).reverse()) { const item = await readJson(env, `schedule:${id}`, null); if (item) schedules.push(item); }
    return jsonResponse({ ok: true, schedules });
  }
  if (request.method === "POST" && path === "/root/schedule-assign") {
    const item = await readJson(env, `schedule:${body.id}`, null); if (!item) return jsonResponse({ ok: false, message: "找不到排程。" }, 404);
    const requestedReviewers = (Array.isArray(body.reviewerIds) ? body.reviewerIds : String(body.reviewerIds || "").split(/[,\s]+/)).map(String).filter(Boolean);
    const reviewerCheck = await filterAuthorizedReviewers(env, item.groupId, requestedReviewers, "schedule");
    if (reviewerCheck.invalid.length) return jsonResponse({ ok: false, message: `以下 QQ 没有排程审核权限：${reviewerCheck.invalid.join("、")}` }, 400);
    item.reviewerIds = reviewerCheck.valid;
    item.approvalRule = ["single", "majority", "all"].includes(body.approvalRule) ? body.approvalRule : "single";
    if (!body.developerDecision && item.reviewerIds.length === 0) return jsonResponse({ ok: false, message: "请至少指定一位具有排程审核权限的人。" }, 400);
    if (body.developerDecision === "approve") { item.status = "active"; item.enabled = true; item.reviewedAt = new Date().toISOString(); }
    else if (body.developerDecision === "reject") { item.status = "rejected"; item.enabled = false; item.reviewedAt = new Date().toISOString(); }
    else { item.status = "pending_review"; item.enabled = false; }
    await dbPut(env, `schedule:${item.id}`, JSON.stringify(item));
    if (item.status === "pending_review") for (const reviewerId of item.reviewerIds) await sendOneBotAction(env, { action: "send_private_msg", params: { user_id: numericId(reviewerId), message: `【排程审核】\n编号：${item.id}\n群号：${item.groupId}\n内容：${item.content}\n请登录 Portal 审核。`, auto_escape: false } });
    return jsonResponse({ ok: true, schedule: item });
  }
  if (request.method === "GET" && path === "/review/schedules") {
    if (!(permissions.scheduleReviewer || isDev)) return jsonResponse({ ok: false, message: "没有排程审核权。" }, 403);
    const ids = await readJson(env, "schedule:index", []); const schedules = [];
    for (const id of ids.slice(-500).reverse()) { const item = await readJson(env, `schedule:${id}`, null); if (item && (item.reviewerIds || []).includes(authed.qq)) schedules.push(item); }
    return jsonResponse({ ok: true, schedules });
  }
  if (request.method === "POST" && path === "/review/schedule") {
    if (!(permissions.scheduleReviewer || isDev)) return jsonResponse({ ok: false, message: "没有排程审核权。" }, 403);
    const result = await voteSchedule(env, String(body.id || ""), authed.qq, body.vote === "reject" ? "reject" : "approve");
    return jsonResponse(result, result.ok ? 200 : 403);
  }

  if (request.method === "GET" && path === "/root/appeals") {
    const ids = await readJson(env, "appeal:index", []); const appeals = [];
    for (const id of ids.slice(-500).reverse()) { const item = await readJson(env, `appeal:${id}`, null); if (item) { const safe = sanitizeAppealForReviewer(item, true); if (item.againstAdmin) safe.suggestedOwnerId = await getGroupOwnerId(env, item.groupId); appeals.push(safe); } }
    return jsonResponse({ ok: true, appeals });
  }
  if (request.method === "POST" && path === "/root/appeal-assign") {
    const item = await readJson(env, `appeal:${body.id}`, null); if (!item) return jsonResponse({ ok: false, message: "找不到申诉。" }, 404);
    const requestedReviewers = (Array.isArray(body.reviewerIds) ? body.reviewerIds : String(body.reviewerIds || "").split(/[,\s]+/)).map(String).filter(Boolean);
    const reviewerCheck = await filterAuthorizedReviewers(env, item.groupId, requestedReviewers, "appeal");
    if (reviewerCheck.invalid.length) return jsonResponse({ ok: false, message: `以下 QQ 没有申诉审核权限：${reviewerCheck.invalid.join("、")}` }, 400);
    item.reviewerIds = reviewerCheck.valid;
    item.approvalRule = ["single", "majority", "all"].includes(body.approvalRule) ? body.approvalRule : "single";
    if (!body.developerDecision && item.reviewerIds.length === 0) return jsonResponse({ ok: false, message: "请至少指定一位具有申诉审核权限的人。" }, 400);
    const ownerId = item.againstAdmin ? await getGroupOwnerId(env, item.groupId) : "";
    if (item.againstAdmin) {
      if (!ownerId) return jsonResponse({ ok: false, message: "申诉对象涉及管理层，但目前无法确认群主身份，请先让群主在群内发言或刷新成员资料。" }, 400);
      if (body.developerDecision && String(authed.qq) !== String(ownerId)) return jsonResponse({ ok: false, message: `申诉对象涉及管理层，必须由群主 QQ:${ownerId} 参与审核；你仍可查看并加入共同审核。` }, 400);
      if (!body.developerDecision && !item.reviewerIds.includes(String(ownerId))) return jsonResponse({ ok: false, message: `申诉对象涉及管理层，请将群主 QQ:${ownerId} 加入审核人。` }, 400);
    }
    if (body.developerDecision === "approve") { item.status = "approved"; item.result = String(body.note || "申诉通过"); }
    else if (body.developerDecision === "reject") { item.status = "rejected"; item.result = String(body.note || "申诉驳回"); }
    else item.status = "pending_review";
    await dbPut(env, `appeal:${item.id}`, JSON.stringify(item));
    if (item.status === "pending_review") for (const reviewerId of item.reviewerIds) await sendOneBotAction(env, { action: "send_private_msg", params: { user_id: numericId(reviewerId), message: `【匿名申诉审核】\n编号：${item.id}\n群号：${item.groupId}\n类型：${item.type}\n内容：${item.content}\n申诉人身份已隐藏，请登录 Portal 审核。`, auto_escape: false } });
    return jsonResponse({ ok: true, appeal: item });
  }
  if (request.method === "GET" && path === "/review/appeals") {
    if (!(permissions.appealReviewer || isDev)) return jsonResponse({ ok: false, message: "没有申诉审核权。" }, 403);
    const ids = await readJson(env, "appeal:index", []); const appeals = [];
    for (const id of ids.slice(-500).reverse()) { const item = await readJson(env, `appeal:${id}`, null); if (item && (item.reviewerIds || []).includes(authed.qq)) appeals.push(sanitizeAppealForReviewer(item, isDev)); }
    return jsonResponse({ ok: true, appeals });
  }
  if (request.method === "POST" && path === "/review/appeal") {
    if (!(permissions.appealReviewer || isDev)) return jsonResponse({ ok: false, message: "没有申诉审核权。" }, 403);
    const result = await voteAppeal(env, String(body.id || ""), authed.qq, body.vote === "reject" ? "reject" : "approve", String(body.note || ""));
    return jsonResponse(result, result.ok ? 200 : 403);
  }

  if (request.method === "POST" && path === "/root/broadcast") {
    const message = String(body.message || "").trim(); if (!message) return jsonResponse({ ok: false, message: "广播内容不能为空。" }, 400);
    const targets = String(body.groups || groupId).split(/\n|,/).map(s => extractGroupId(s)).filter(Boolean); let sentCount = 0;
    for (const targetGroupId of targets) if (await sendOneBotAction(env, { action: "send_group_msg", params: { group_id: numericId(targetGroupId), message, auto_escape: false } })) sentCount++;
    return jsonResponse({ ok: sentCount > 0, message: `广播已发送到 ${sentCount}/${targets.length} 个群。`, sentCount, total: targets.length }, sentCount > 0 ? 200 : 503);
  }
  if (request.method === "POST" && path === "/root/restart") {
    if (groupId) { await dbDel(env, `chat:group:${groupId}`); await dbDel(env, `context_summary:chat:group:${groupId}`); await dbDel(env, `last_interject:${groupId}`); }
    await dbPut(env, "system_last_restart", new Date().toISOString()); return jsonResponse({ ok: true, message: "系统暂存已重置。" });
  }
  if (request.method === "GET" && path === "/root/backup") {
    return jsonResponse({ ok: true, backup: { groupId, exportedAt: new Date().toISOString(), public_memos: groupId ? await readJson(env, `group_public_memos:${groupId}`, []) : [], audit_logs: groupId ? await readJson(env, `audit:system:group:${groupId}`, []) : [], members: groupId ? await readJson(env, `group_members:${groupId}`, []) : [], recent_logs: groupId ? await readJson(env, `recent_logs:${groupId}`, []) : [] } });
  }

  if (request.method === "GET" && path === "/matrix") {
    const logs = await readJson(env, `recent_logs:${groupId}`, []); const q = String(url.searchParams.get("q") || "").trim(); const filtered = q ? logs.filter(line => line.includes(q)) : logs;
    return jsonResponse({ ok: true, mode: isDev ? "root" : "group", query: q, particles: filtered.slice(-160).map((text, i) => ({ id: i, text: isDev ? text : text.replace(/QQ:\d+/g, "QQ:*"), raw: isDev ? Array.from({ length: 12 }, (_, n) => Number(Math.sin((i + 1) * (n + 1)).toFixed(6))) : undefined, cluster: i % 5, score: Number((1 - i / 180).toFixed(3)) })) });
  }

  return jsonResponse({ ok: false, message: "未知 API。" }, 404);
}

async function handleGeminiLiveUpgrade(request, env) {
  const keys = roundRobinKeys([...new Set([...parseList(env.GEMINI_API_KEYS), ...parseList(env.VECTORIZE_GEMINI_KEYS)])], "gemini");
  if (!keys.length) return new Response("未配置 Gemini API 金钥", { status: 500 });
  const key = keys[Math.floor(Math.random() * keys.length)];
  const model = env.GEMINI_LIVE_MODEL || "gemini-3.1-flash-live-preview";
  const pair = new WebSocketPair();
  const [client, server] = Object.values(pair);
  server.accept();
  const upstream = new WebSocket(`wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${encodeURIComponent(key)}`);
  const queue = [];
  let upstreamReady = false;
  let closed = false;
  const closeBoth = (code = 1000, reason = "closed") => {
    if (closed) return; closed = true;
    try { if (server.readyState === WebSocket.OPEN) server.close(code, reason); } catch {}
    try { if (upstream.readyState === WebSocket.OPEN || upstream.readyState === WebSocket.CONNECTING) upstream.close(code, reason); } catch {}
  };
  upstream.addEventListener("open", () => {
    upstreamReady = true;
    while (queue.length && upstream.readyState === WebSocket.OPEN) upstream.send(queue.shift());
  });
  upstream.addEventListener("message", event => { if (server.readyState === WebSocket.OPEN) server.send(event.data); });
  upstream.addEventListener("error", () => { if (server.readyState === WebSocket.OPEN) server.send(JSON.stringify({ error: { message: "Gemini Live 上游连接错误" } })); });
  upstream.addEventListener("close", event => closeBoth(event.code || 1011, "Gemini Live closed"));
  server.addEventListener("message", event => {
    const data = event.data;
    if (typeof data === "string" && data.length > 2_000_000) return closeBoth(1009, "message too large");
    if (queue.length > 300) return closeBoth(1013, "queue overflow");
    if (upstreamReady && upstream.readyState === WebSocket.OPEN) upstream.send(data); else queue.push(data);
  });
  server.addEventListener("close", event => closeBoth(event.code || 1000, "client closed"));
  server.addEventListener("error", () => closeBoth(1011, "client error"));
  server.send(JSON.stringify({ qqai: { version: VERSION, model, status: "connecting" } }));
  return new Response(null, { status: 101, webSocket: client });
}

function getLiveHtmlPage(host) {
  return `<!doctype html>
<html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>QQAI Live</title><style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;background:radial-gradient(circle at 50% 20%,#183c61,#07101e 42%,#03050a);color:#eef7ff;display:grid;place-items:center;padding:20px}.card{width:min(760px,100%);border:1px solid #ffffff24;background:#07101ed9;backdrop-filter:blur(18px);border-radius:18px;padding:24px;box-shadow:0 30px 80px #0008}h1{margin:0 0 8px}.muted{color:#a8b8ca;line-height:1.65}.row{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}button{border:0;border-radius:10px;height:44px;padding:0 18px;font-weight:800;cursor:pointer;background:#65dcff;color:#02101a}button.stop{background:#ff7474;color:#1a0505}button:disabled{opacity:.45;cursor:not-allowed}.meter{height:10px;background:#ffffff12;border-radius:99px;overflow:hidden;margin-top:16px}.bar{height:100%;width:0;background:linear-gradient(90deg,#60dcff,#86ffbd);transition:width .08s}.log{margin-top:16px;background:#02060d;border:1px solid #ffffff18;border-radius:12px;padding:12px;min-height:150px;max-height:320px;overflow:auto;white-space:pre-wrap;line-height:1.55}.status{font-weight:800;color:#8ff0c0}.warn{color:#ffd58a}@media(max-width:520px){button{width:100%}}
</style></head><body><main class="card"><h1>QQAI Live</h1><div class="muted">即時麥克風對話。瀏覽器會傳送 16 kHz PCM 音訊，回傳語音會在本機播放。請勿在對話中提供密碼或敏感資料。</div><div class="row"><button id="start">開始通話</button><button id="mute" disabled>靜音</button><button id="stop" class="stop" disabled>結束</button></div><div class="meter"><div class="bar" id="bar"></div></div><div class="log"><div class="status" id="status">尚未連線</div><div id="transcript"></div></div></main>
<script>
const startBtn=document.getElementById('start'),stopBtn=document.getElementById('stop'),muteBtn=document.getElementById('mute'),statusEl=document.getElementById('status'),transcript=document.getElementById('transcript'),bar=document.getElementById('bar');
let ws,stream,inputCtx,processor,source,muted=false,ready=false,playCtx,playAt=0;
const modelParam=new URLSearchParams(location.search).get('model')||'gemini-3.1-flash-live-preview';const MODEL='models/'+modelParam;
function log(t){transcript.textContent+=(transcript.textContent?'\\n':'')+t;transcript.parentElement.scrollTop=transcript.parentElement.scrollHeight}
function b64FromBytes(bytes){let s='';for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(s)}
function bytesFromB64(s){const b=atob(s),a=new Uint8Array(b.length);for(let i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a}
function f32ToPcm16(input){const out=new Uint8Array(input.length*2),view=new DataView(out.buffer);let peak=0;for(let i=0;i<input.length;i++){const v=Math.max(-1,Math.min(1,input[i]));peak=Math.max(peak,Math.abs(v));view.setInt16(i*2,v<0?v*32768:v*32767,true)}bar.style.width=Math.min(100,peak*180)+'%';return out}
function playPcm(base64,rate=24000){playCtx||=new AudioContext({sampleRate:rate});const bytes=bytesFromB64(base64),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),f=new Float32Array(bytes.byteLength/2);for(let i=0;i<f.length;i++)f[i]=view.getInt16(i*2,true)/32768;const buf=playCtx.createBuffer(1,f.length,rate);buf.copyToChannel(f,0);const src=playCtx.createBufferSource();src.buffer=buf;src.connect(playCtx.destination);playAt=Math.max(playCtx.currentTime+.03,playAt);src.start(playAt);playAt+=buf.duration}
function handleMessage(obj){if(obj.setupComplete){ready=true;statusEl.textContent='已連線，可以說話';return}if(obj.error){statusEl.textContent='錯誤：'+(obj.error.message||JSON.stringify(obj.error));return}const sc=obj.serverContent;if(!sc)return;if(sc.inputTranscription?.text)log('你：'+sc.inputTranscription.text);if(sc.outputTranscription?.text)log('助手：'+sc.outputTranscription.text);for(const part of sc.modelTurn?.parts||[]){const d=part.inlineData?.data;if(d)playPcm(d,Number((part.inlineData.mimeType||'').match(/rate=(\\d+)/)?.[1]||24000));if(part.text)log('助手：'+part.text)}if(sc.interrupted&&playCtx){playAt=playCtx.currentTime}}
async function start(){startBtn.disabled=true;statusEl.textContent='取得麥克風權限…';try{stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true}});ws=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host+'/live');ws.onopen=()=>{statusEl.textContent='正在初始化 Gemini Live…';ws.send(JSON.stringify({setup:{model:MODEL,generationConfig:{responseModalities:['AUDIO'],speechConfig:{voiceConfig:{prebuiltVoiceConfig:{voiceName:'Aoede'}}}},systemInstruction:{parts:[{text:'你是QQ群里的自然简体中文语音助手。回答简洁、口语化；不要讨论、承认或否认模型、AI、机器人或系统身份，直接回到话题。'}]},inputAudioTranscription:{},outputAudioTranscription:{}}}))};ws.onmessage=e=>{try{handleMessage(JSON.parse(e.data))}catch(err){console.warn(err)}};ws.onerror=()=>statusEl.textContent='WebSocket 連線錯誤';ws.onclose=()=>{statusEl.textContent='連線已結束';cleanup(false)};
inputCtx=new AudioContext({sampleRate:16000});source=inputCtx.createMediaStreamSource(stream);processor=inputCtx.createScriptProcessor(4096,1,1);processor.onaudioprocess=e=>{if(!ready||muted||!ws||ws.readyState!==1)return;const pcm=f32ToPcm16(e.inputBuffer.getChannelData(0));ws.send(JSON.stringify({realtimeInput:{audio:{mimeType:'audio/pcm;rate=16000',data:b64FromBytes(pcm)}}}))};source.connect(processor);processor.connect(inputCtx.destination);stopBtn.disabled=false;muteBtn.disabled=false}catch(e){statusEl.textContent='無法啟動：'+e.message;cleanup(false)}}
function cleanup(close=true){ready=false;if(close&&ws&&ws.readyState<2)ws.close();try{processor?.disconnect();source?.disconnect();inputCtx?.close();stream?.getTracks().forEach(t=>t.stop())}catch{}ws=null;stream=null;processor=null;source=null;inputCtx=null;startBtn.disabled=false;stopBtn.disabled=true;muteBtn.disabled=true;bar.style.width='0'}
startBtn.onclick=start;stopBtn.onclick=()=>cleanup(true);muteBtn.onclick=()=>{muted=!muted;muteBtn.textContent=muted?'取消靜音':'靜音'};
</script></body></html>`;
}

async function handleAppealApi(request, env, url) {
  const body = request.method === "GET" ? {} : await request.json().catch(() => ({}));
  const path = url.pathname.replace("/api/appeal", "");
  if (!(await getFeatureFlag(env, "private_appeal_enabled", true))) return jsonResponse({ ok: false, message: "申诉入口暂时关闭。" }, 503);
  if (request.method === "POST" && path === "/request-code") {
    const qq = String(body.qq || "").replace(/\D/g, ""); if (!qq) return jsonResponse({ ok: false, message: "请输入 QQ 号。" }, 400);
    const code = generateSixDigitCode(); await dbPut(env, `appeal_auth_code:${qq}`, JSON.stringify({ code, expiresAt: Date.now()+300000, attempts:0 }));
    const sent = await sendOneBotAction(env, { action:"send_private_msg", params:{ user_id:numericId(qq), message:`【匿名申诉验证码】\n验证码：${code}\n有效期：5分钟。`, auto_escape:false } });
    return jsonResponse({ ok: sent, message: sent ? "验证码已发送至 QQ 私讯。" : "NapCat 当前未连接。" }, sent ? 200 : 503);
  }
  if (request.method === "POST" && path === "/verify-code") {
    const qq=String(body.qq||"").replace(/\D/g,""),code=String(body.code||"").replace(/\D/g,""); const raw=await dbGet(env,`appeal_auth_code:${qq}`); if(!raw)return jsonResponse({ok:false,message:"验证码不存在或已过期。"},400);
    let item;try{item=JSON.parse(raw)}catch{} if(!item||Date.now()>item.expiresAt){await dbDel(env,`appeal_auth_code:${qq}`);return jsonResponse({ok:false,message:"验证码已过期。"},400)}
    if(item.code!==code){item.attempts=(item.attempts||0)+1;item.attempts>=5?await dbDel(env,`appeal_auth_code:${qq}`):await dbPut(env,`appeal_auth_code:${qq}`,JSON.stringify(item));return jsonResponse({ok:false,message:"验证码错误。"},400)}
    await dbDel(env,`appeal_auth_code:${qq}`);const token=crypto.randomUUID()+crypto.randomUUID();await dbPut(env,`appeal_session:${token}`,JSON.stringify({qq,expiresAt:Date.now()+3600000}));return jsonResponse({ok:true,token,message:"验证成功。"});
  }
  const token=request.headers.get("Authorization")?.replace(/^Bearer\s+/i,"")||body.token||url.searchParams.get("token")||"";const sess=await readJson(env,`appeal_session:${token}`,null);if(!sess||Date.now()>Number(sess.expiresAt||0))return jsonResponse({ok:false,message:"申诉验证已过期。"},401);
  if(request.method==="GET"&&path==="/groups")return jsonResponse({ok:true,groups:await getWhitelistedGroupsForUser(env,sess.qq)});
  if(request.method==="POST"&&path==="/submit"){
    const groupId=String(body.groupId||"").replace(/\D/g,"");if(!groupId||!(await isGroupWhitelisted(env,groupId))||!(await verifyGroupMembership(env,groupId,sess.qq)))return jsonResponse({ok:false,message:"无法确认你属于该 AI 白名单群。"},403);
    const type=String(body.type||"其他").trim(),content=String(body.content||"").trim();if(content.length<5)return jsonResponse({ok:false,message:"请填写较完整的申诉内容。"},400);
    const id=`app_${Date.now().toString(36)}_${crypto.randomUUID().slice(0,8)}`;const appeal={id,anonymousLabel:`匿名申诉-${id.slice(-6)}`,applicantId:String(sess.qq),groupId,type,content,evidenceMessageId:String(body.evidenceMessageId||""),status:"pending_owner",createdAt:new Date().toISOString(),reviewerIds:[],votes:{},approvalRule:"single",result:"",againstAdmin:/管理|群主|开发者|開發者/i.test(type+content),recommendedReviewerRole:/管理|群主|开发者|開發者/i.test(type+content)?"owner":"developer_choice"};
    await dbPut(env,`appeal:${id}`,JSON.stringify(appeal));await appendIndex(env,"appeal:index",id,5000);await appendIndex(env,`appeal:user:${sess.qq}`,id,200);
    await notifyDeveloper(env,`【收到匿名申诉】\n编号：${id}\n群号：${groupId}\n申诉人QQ：${sess.qq}\n类型：${type}\n内容：${content}\n只通知了你，请在 Portal 自行处理或指派审核人。`);
    return jsonResponse({ok:true,id,message:"申诉已匿名提交，仅开发者可查看你的 QQ。"});
  }
  if(request.method==="GET"&&path==="/mine"){
    const ids=await readJson(env,`appeal:user:${sess.qq}`,[]),appeals=[];for(const id of ids.slice(-100).reverse()){const a=await readJson(env,`appeal:${id}`,null);if(a)appeals.push({id:a.id,groupId:a.groupId,type:a.type,content:a.content,status:a.status,result:a.result,createdAt:a.createdAt})}return jsonResponse({ok:true,appeals});
  }
  return jsonResponse({ok:false,message:"未知申诉 API。"},404);
}

function getAppealPage(host) {
  return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>QQAI 匿名申訴</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;font-family:system-ui;background:radial-gradient(circle at 30% 10%,#173b60,#060d18 45%,#020409);color:#edf7ff;padding:22px}.wrap{max-width:760px;margin:auto}.card{background:#07101ee8;border:1px solid #ffffff22;border-radius:16px;padding:20px;margin:14px 0}h1{margin-bottom:6px}.muted{color:#a9bacd;line-height:1.6}label{display:block;margin-top:12px;color:#b8c7d9}input,select,textarea{width:100%;border:1px solid #ffffff24;background:#081525;color:#fff;border-radius:9px;padding:11px;margin-top:6px}textarea{min-height:150px}button{margin-top:14px;border:0;border-radius:9px;background:#67ddff;color:#03111a;font-weight:800;padding:11px 16px;cursor:pointer}.hidden{display:none}.msg{white-space:pre-wrap;color:#8ff0c0;margin-top:12px}.item{border-top:1px solid #ffffff17;padding:10px 0}</style></head><body><div class="wrap"><h1>匿名申訴</h1><div class="muted">審核人看不到申訴人的 QQ；只有開發者可查看真實身分。系統會先确认你屬於可使用 AI 的白名單群。</div><section class="card" id="login"><label>QQ 號</label><input id="qq" inputmode="numeric"><button id="send">發送驗證碼</button><label>驗證碼</label><input id="code" maxlength="6" inputmode="numeric"><button id="verify">驗證</button><div class="msg" id="loginMsg"></div></section><section class="card hidden" id="form"><label>所屬白名單群</label><select id="group"></select><label>申訴類型</label><select id="type"><option>禁言</option><option>踢出</option><option>AI黑名单</option><option>管理操作</option><option>排程</option><option>其他</option></select><label>相關訊息 ID（選填）</label><input id="evidence"><label>申訴內容</label><textarea id="content"></textarea><button id="submit">匿名提交</button><button id="refresh">查看我的案件</button><div class="msg" id="formMsg"></div><div id="cases"></div></section></div><script>let token='';const post=async(p,d)=>{const r=await fetch('/api/appeal'+p,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(d||{})});return r.json()},get=async p=>(await fetch('/api/appeal'+p,{headers:token?{Authorization:'Bearer '+token}:{}})).json();send.onclick=async()=>loginMsg.textContent=(await post('/request-code',{qq:qq.value})).message;verify.onclick=async()=>{const r=await post('/verify-code',{qq:qq.value,code:code.value});loginMsg.textContent=r.message;if(r.ok){token=r.token;const g=await get('/groups');group.innerHTML=(g.groups||[]).map(x=>'<option value="'+x.groupId+'">'+x.groupName+'（'+x.groupId+'）</option>').join('');login.classList.add('hidden');form.classList.remove('hidden')}};submit.onclick=async()=>{const r=await post('/submit',{groupId:group.value,type:type.value,content:content.value,evidenceMessageId:evidence.value});formMsg.textContent=r.message;if(r.ok){content.value='';load()}};async function load(){const r=await get('/mine');cases.innerHTML=(r.appeals||[]).map(a=>'<div class="item"><b>'+a.id+'</b>｜'+a.status+'<br>'+a.type+'｜'+a.content+(a.result?'<br>結果：'+a.result:'')+'</div>').join('')||'<div class="muted">暂无案件</div>'}refresh.onclick=load;</script></body></html>`;
}

function getPortalHomePage(host) {
  return String.raw`<!doctype html>
<html lang="zh-Hant-TW">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>QQAIbot Control Center</title>
<script>(function(){try{var t=localStorage.getItem('qqai_theme');document.documentElement.dataset.theme=t==='dark'?'dark':'light'}catch(e){document.documentElement.dataset.theme='light'}})();</script>
<style>
:root{color-scheme:light;--bg:#f5f7fb;--panel:#fff;--panel2:#f8fafc;--text:#172033;--muted:#68748a;--line:#e3e8f0;--primary:#5b5bd6;--primary2:#7777e8;--ok:#17845f;--warn:#b26a00;--bad:#c53d4d;--shadow:0 18px 48px rgba(31,42,68,.08);--login-panel:rgba(255,255,255,.92);--topbar-bg:rgba(245,247,251,.88);font-family:Inter,"Noto Sans TC","Microsoft JhengHei",system-ui,sans-serif}
:root[data-theme="dark"]{color-scheme:dark;--bg:#070a11;--panel:#101521;--panel2:#151c2a;--text:#eef2f8;--muted:#9ca8bb;--line:#293247;--primary:#8585ff;--primary2:#a091ff;--ok:#48cfa0;--warn:#e5a94f;--bad:#ff7687;--shadow:0 18px 48px rgba(0,0,0,.38);--login-panel:rgba(16,21,34,.94);--topbar-bg:rgba(7,10,17,.9)}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text)}button,input,select,textarea{font:inherit}.hidden{display:none!important}.muted{color:var(--muted)}
.login{min-height:100vh;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at 15% 10%,rgba(91,91,214,.15),transparent 38%),radial-gradient(circle at 90% 90%,rgba(23,132,95,.11),transparent 40%),var(--bg)}
.login-card{width:min(450px,100%);background:var(--login-panel);border:1px solid var(--line);border-radius:26px;padding:30px;box-shadow:var(--shadow);backdrop-filter:blur(14px)}.brand{display:flex;align-items:center;gap:12px;margin-bottom:24px}.logo{width:46px;height:46px;border-radius:15px;display:grid;place-items:center;background:linear-gradient(135deg,var(--primary),#8a69e8);color:#fff;font-weight:800}.brand h1{font-size:22px;margin:0}.brand p{margin:4px 0 0;color:var(--muted);font-size:14px}
.field{display:grid;gap:7px;margin:14px 0}.field label{font-size:13px;font-weight:700}.field input,.field select,.field textarea{width:100%;border:1px solid var(--line);border-radius:12px;background:var(--panel);color:var(--text);padding:11px 12px;outline:none}.field input:focus,.field select:focus,.field textarea:focus{border-color:var(--primary);box-shadow:0 0 0 3px rgba(91,91,214,.12)}.field textarea{min-height:100px;resize:vertical}.row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.grow{flex:1;min-width:160px}
.btn{border:0;border-radius:11px;padding:10px 14px;font-weight:700;cursor:pointer;background:var(--panel2);color:var(--text)}.btn:hover{filter:brightness(.98)}.btn.primary{background:var(--primary);color:#fff}.btn.danger{background:#fde9ec;color:var(--bad)}.btn.ghost{background:transparent;border:1px solid var(--line)}.btn:disabled{opacity:.55;cursor:not-allowed}.notice{margin-top:14px;padding:11px 13px;border-radius:11px;background:var(--panel2);color:var(--muted);font-size:14px;line-height:1.55}
.app{min-height:100vh;display:grid;grid-template-columns:250px 1fr}.sidebar{position:sticky;top:0;height:100vh;background:#171b2b;color:#e9ecf4;padding:18px 14px;display:flex;flex-direction:column}.side-brand{display:flex;align-items:center;gap:10px;padding:8px 8px 18px}.side-brand .logo{width:38px;height:38px;border-radius:12px}.side-brand b{display:block}.side-brand small{color:#98a2b7}.nav{display:grid;gap:4px;overflow:auto}.nav button{border:0;background:transparent;color:#aeb7c9;padding:10px 12px;border-radius:10px;text-align:left;cursor:pointer;font-weight:650}.nav button:hover,.nav button.active{background:rgba(255,255,255,.1);color:#fff}.side-bottom{margin-top:auto;padding:12px 8px 2px;border-top:1px solid rgba(255,255,255,.1)}
.main{min-width:0}.topbar{height:72px;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:0 24px;border-bottom:1px solid var(--line);background:var(--topbar-bg);backdrop-filter:blur(12px);position:sticky;top:0;z-index:5}.topbar h2{margin:0;font-size:20px}.top-actions{display:flex;align-items:center;gap:10px}.top-actions select{max-width:250px;border:1px solid var(--line);border-radius:10px;padding:9px 10px;background:#fff}.content{padding:24px;max-width:1500px;margin:auto}.view{display:none}.view.active{display:block}.section-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:18px}.section-head h2{margin:0 0 5px;font-size:25px}.section-head p{margin:0;color:var(--muted)}
.grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:16px}.card{background:var(--panel);border:1px solid var(--line);border-radius:17px;padding:18px;box-shadow:0 8px 28px rgba(38,49,76,.045);min-width:0}.span-3{grid-column:span 3}.span-4{grid-column:span 4}.span-6{grid-column:span 6}.span-8{grid-column:span 8}.span-12{grid-column:1/-1}.metric-label{font-size:13px;color:var(--muted);margin-bottom:8px}.metric-value{font-size:27px;font-weight:800;letter-spacing:-.03em}.metric-sub{font-size:12px;color:var(--muted);margin-top:7px}.card h3{margin:0 0 13px;font-size:16px}.status{display:inline-flex;align-items:center;gap:7px;border-radius:999px;padding:5px 9px;font-size:12px;font-weight:800;background:#edf1f7}.status:before{content:"";width:7px;height:7px;border-radius:50%;background:#8390a5}.status.ok{background:#e5f5ee;color:var(--ok)}.status.ok:before{background:var(--ok)}.status.warning{background:#fff2d9;color:var(--warn)}.status.warning:before{background:var(--warn)}.status.error{background:#fde9ec;color:var(--bad)}.status.error:before{background:var(--bad)}
.list{display:grid;gap:10px}.item{border:1px solid var(--line);border-radius:13px;padding:13px;background:var(--panel)}.item-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.item-title{font-weight:800;word-break:break-word}.item-meta{font-size:12px;color:var(--muted);margin-top:5px;line-height:1.55}.item-body{margin-top:9px;line-height:1.55;word-break:break-word}.empty{padding:28px 12px;text-align:center;color:var(--muted);border:1px dashed var(--line);border-radius:13px}.health-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:13px}.health-card{border:1px solid var(--line);border-radius:14px;padding:14px;background:var(--panel)}.health-card .latency{font-size:12px;color:var(--muted);margin-top:8px}.health-card .detail{font-size:12px;color:var(--muted);margin-top:8px;word-break:break-word;white-space:pre-wrap}
.timeline{display:grid;gap:8px}.step{display:flex;gap:10px;align-items:flex-start}.step i{width:9px;height:9px;border-radius:50%;background:var(--primary);margin-top:6px;flex:0 0 auto}.step span{line-height:1.5}.pill{display:inline-block;border-radius:999px;padding:4px 8px;background:#eef0ff;color:#5050bd;font-size:12px;font-weight:700;margin:2px 4px 2px 0}.split{display:grid;grid-template-columns:1fr 1fr;gap:16px}.switch{display:flex;align-items:center;gap:9px;margin:10px 0}.switch input{width:18px;height:18px}.code{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;background:#151a29;color:#e9ecf4;border-radius:12px;padding:12px;white-space:pre-wrap;word-break:break-word;font-size:12px}
.toast{position:fixed;right:22px;bottom:22px;max-width:420px;padding:12px 15px;border-radius:12px;background:#1c2233;color:#fff;box-shadow:var(--shadow);z-index:30}.mobile-menu{display:none}
:root[data-theme="dark"] .sidebar{background:#090d17}:root[data-theme="dark"] .btn.danger{background:#351820}:root[data-theme="dark"] .status{background:#20283a}:root[data-theme="dark"] .status.ok{background:#13372d}:root[data-theme="dark"] .status.warning{background:#3a2b13}:root[data-theme="dark"] .status.error{background:#3a1820}:root[data-theme="dark"] .pill{background:#292750;color:#c8c7ff}
.theme-toggle{white-space:nowrap}
@media(max-width:1050px){.span-3{grid-column:span 6}.span-4{grid-column:span 6}.span-8{grid-column:span 12}}
@media(max-width:760px){.app{display:block}.sidebar{position:fixed;left:0;top:0;width:270px;z-index:20;transform:translateX(-102%);transition:.2s}.sidebar.open{transform:none}.mobile-menu{display:inline-flex}.topbar{padding:0 14px}.topbar h2{font-size:17px}.top-actions select{max-width:145px}.content{padding:16px}.span-3,.span-4,.span-6,.span-8{grid-column:1/-1}.split{grid-template-columns:1fr}.section-head{display:block}.section-head .row{margin-top:12px}}
</style>
</head>
<body>
<section id="login" class="login">
  <div class="login-card">
    <div class="brand"><div class="logo">AI</div><div><h1>QQAIbot Control Center</h1></div></div>
    <div class="row"><button id="loginThemeToggle" type="button" class="btn ghost theme-toggle">切換黑色模式</button></div>
    <div class="field"><label for="loginQq">QQ 號</label><input id="loginQq" inputmode="numeric" placeholder="輸入你的 QQ 號"></div>
    <div class="row"><button id="sendCode" type="button" class="btn ghost grow">傳送驗證碼</button></div>
    <div class="field"><label for="loginCode">六位驗證碼</label><input id="loginCode" inputmode="numeric" maxlength="6" placeholder="驗證碼"></div>
    <button id="verifyCode" type="button" class="btn primary" style="width:100%">登入管理中心</button>
    <div id="loginNotice" class="notice">驗證碼會由已連線的 NapCat 私訊至你的 QQ。</div>
  </div>
</section>
<div id="app" class="app hidden">
  <aside id="sidebar" class="sidebar">
    <div class="side-brand"><div class="logo">AI</div><div><b>QQAIbot</b><small>Control Center</small></div></div>
    <nav class="nav" id="nav">
      <button data-view="overview" class="active">總覽</button>
      <button data-view="health">健康檢查</button>
      <button data-view="tasks">任务与等待队列</button>
      <button data-view="moderation">待确认操作</button>
      <button data-view="simulator">事件模拟器</button>
      <button data-view="models">模型中心</button>
      <button data-view="quota">额度与限制</button>
      <button data-view="groups">群组设置</button>
      <button data-view="memory">记忆管理</button>
      <button data-view="logs">操作日志</button>
    </nav>
    <div class="side-bottom"><div id="identity" style="font-size:13px"></div><button id="logout" class="btn ghost" style="margin-top:10px;width:100%;color:#fff;border-color:rgba(255,255,255,.18)">登出</button></div>
  </aside>
  <main class="main">
    <header class="topbar"><div class="row"><button id="menu" class="btn ghost mobile-menu">☰</button><h2 id="pageTitle">總覽</h2></div><div class="top-actions"><select id="groupSelect"><option value="">选择群组</option></select><button id="themeToggle" type="button" class="btn ghost theme-toggle">黑色模式</button><button id="refresh" class="btn ghost">重新整理</button></div></header>
    <div class="content">
      <section id="v-overview" class="view active">
        <div class="section-head"><div><h2>系統總覽</h2><p>只顯示重要狀態；詳細資訊可進入對應頁面。</p></div><span id="overallStatus" class="status">尚未檢查</span></div>
        <div class="grid">
          <div class="card span-3"><div class="metric-label">NapCat</div><div id="mNapcat" class="metric-value">—</div><div id="mNapcatSub" class="metric-sub">等待資料</div></div>
          <div class="card span-3"><div class="metric-label">執行中問題</div><div id="mActive" class="metric-value">0</div><div class="metric-sub">每位群友同時最多 1 題</div></div>
          <div class="card span-3"><div class="metric-label">等待中的問題</div><div id="mQueued" class="metric-value">0</div><div class="metric-sub">前一題完成後自動處理</div></div>
          <div class="card span-3"><div class="metric-label">待确认待确认操作</div><div id="mProposals" class="metric-value">0</div><div class="metric-sub">AI 永遠不直接踢人或禁言</div></div>
          <div class="card span-8"><h3>最近需要注意</h3><div id="overviewIssues" class="list"><div class="empty">執行健康檢查後顯示</div></div></div>
          <div class="card span-4"><h3>路由摘要</h3><div class="item-meta">簡短聊天</div><div class="item-title">Gemma 4 26B</div><div class="item-meta" style="margin-top:10px">一般聊天</div><div class="item-title">Gemma 4 31B</div><div class="item-meta" style="margin-top:10px">圖片理解</div><div class="item-title">Gemini 視覺模型</div><div class="item-meta" style="margin-top:10px">複雜推理／程式</div><div class="item-title">DeepSeek／Gemini</div></div>
        </div>
      </section>
      <section id="v-health" class="view">
        <div class="section-head"><div><h2>完整健康檢查</h2><p>快速檢查只驗證綁定與連線；完整檢查會發送最小模型請求。</p></div><div class="row"><button id="quickHealth" class="btn">快速檢查</button><button id="fullHealth" class="btn primary">完整檢查</button></div></div>
        <div id="healthSummary" class="grid" style="margin-bottom:16px"></div><div id="healthList" class="health-grid"><div class="empty">尚未執行</div></div>
      </section>
      <section id="v-tasks" class="view">
        <div class="section-head"><div><h2>任务与等待队列</h2><p>同一位群友的新問題會排隊，不會與前一題同時生成。</p></div><div class="row"><button id="clearQueue" class="btn danger">清空目前群等待列</button><button id="reloadTasks" class="btn">重新加载</button></div></div>
        <div id="taskStats" class="grid" style="margin-bottom:16px"></div><div id="taskList" class="list"><div class="empty">暂无任務</div></div>
      </section>
      <section id="v-moderation" class="view">
        <div class="section-head"><div><h2>群待确认操作</h2><p>自然語言和 Portal 操作都只建立待确认操作，确认後才會呼叫 OneBot。</p></div><button id="reloadProposals" class="btn">重新加载</button></div>
        <div class="grid">
          <div class="card span-4"><h3>手動建立待确认操作</h3><div class="field"><label>動作</label><select id="opAction"><option value="mute">禁言</option><option value="unmute">解除禁言</option><option value="kick">踢出群聊</option><option value="whole_mute">全員禁言</option><option value="whole_unmute">解除全員禁言</option><option value="set_admin">設為管理員</option><option value="unset_admin">取消管理員</option></select></div><div class="field"><label>目標 QQ（全員操作可留空）</label><input id="opQq" inputmode="numeric"></div><div class="field"><label>禁言時長</label><input id="opDuration" value="10分"></div><button id="createProposal" class="btn primary">建立待确认操作，不直接執行</button><div id="opMessage" class="notice">高風險操作需要二次确认；設為／取消 QQ 群管理員只允許目前群主提出及确认。</div></div>
          <div class="card span-8"><h3>提案紀錄</h3><div id="proposalList" class="list"><div class="empty">暂无提案</div></div></div>
        </div>
      </section>
      <section id="v-simulator" class="view">
        <div class="section-head"><div><h2>事件模拟器</h2><p>部署前先檢查觸發、排隊、思考提示與記憶行為。</p></div><button id="runSimulator" class="btn primary">執行模擬</button></div>
        <div class="split"><div class="card"><div class="field"><label>模擬訊息</label><textarea id="simText" placeholder="例如：把 @某人 殺了"></textarea></div><div class="field"><label>發送者角色</label><select id="simRole"><option value="member">群友</option><option value="admin">管理員</option><option value="owner">群主</option></select></div><label class="switch"><input id="simMention" type="checkbox" checked>有 @ 機器人</label><label class="switch"><input id="simImage" type="checkbox">含圖片</label><label class="switch"><input id="simBusy" type="checkbox">此群友已有問題執行中</label></div><div class="card"><h3>模擬結果</h3><div id="simDecision" class="notice">尚未執行</div><div id="simSteps" class="timeline" style="margin-top:14px"></div></div></div>
      </section>
      <section id="v-models" class="view">
        <div class="section-head"><div><h2>模型中心</h2><p>免費優先：Gemma／Gemini 優先處理；DeepSeek 僅用於高難度或明確指定，並受每日人民幣預算限制。</p></div><button id="reloadModels" class="btn">重新加载</button></div><div id="modelList" class="grid"><div class="empty span-12">尚未加载</div></div>
      </section>
      <section id="v-quota" class="view">
        <div class="section-head"><div><h2>DeepSeek 额度与限制</h2><p>留空代表不限制；填 0 代表完全禁止；正數代表每日人民幣上限。</p></div><button id="saveQuota" class="btn primary">儲存額度</button></div>
        <div class="grid"><div class="card span-6"><h3>全站每日 CNY</h3><div class="field"><label>所有群組合計上限</label><input id="globalQuota" type="number" min="0" step="0.01" placeholder="留空＝無限制"></div><div class="notice">0＝完全停用 DeepSeek；空白＝不設每日上限。</div></div><div class="card span-6"><h3>目前群每日 CNY</h3><div class="field"><label>目前选择群组上限</label><input id="groupQuota" type="number" min="0" step="0.01" placeholder="留空＝無限制"></div><div id="quotaStatus" class="notice">僅開發者可以修改。</div></div></div>
      </section>
      <section id="v-groups" class="view">
        <div class="section-head"><div><h2>群组设置</h2><p>修改目前選擇群的 AI、記憶、插話率與人格。</p></div><button id="saveGroup" class="btn primary">儲存設定</button></div>
        <div class="grid"><div class="card span-6"><h3>功能開關</h3><label class="switch"><input id="groupAi" type="checkbox">啟用 AI</label><label class="switch"><input id="groupMemory" type="checkbox">啟用聊天記憶</label><label class="switch"><input id="activeSpeaking" type="checkbox">允許主動發話（開發者）</label><div class="field"><label>隨機插話率（0–100%）</label><input id="interjectRate" type="number" min="0" max="100"></div></div><div class="card span-6"><h3>人格與關鍵字</h3><div class="field"><label>群組人格</label><textarea id="groupPersona"></textarea></div><div class="field"><label>過濾關鍵字（逗號或換行）</label><textarea id="groupKeywords"></textarea></div></div></div>
      </section>
      <section id="v-memory" class="view">
        <div class="section-head"><div><h2>记忆管理</h2><p>指令、白名單提示與系統訊息不會進入聊天記憶。</p></div><button id="reloadMemory" class="btn">重新加载</button></div>
        <div class="grid"><div class="card span-4"><h3>新增記憶</h3><div class="field"><label>範圍</label><select id="memoryScope"><option value="private">個人</option><option value="public">群組公開</option></select></div><div class="field"><label>內容</label><textarea id="memoryText"></textarea></div><button id="addMemory" class="btn primary">新增</button></div><div class="card span-8"><h3>目前記憶</h3><div id="memoryList" class="list"><div class="empty">暂无記憶</div></div></div></div>
      </section>
      <section id="v-logs" class="view">
        <div class="section-head"><div><h2>操作日志</h2><p>群務與設定操作獨立保存，不會當成 AI 聊天語料。</p></div><button id="reloadLogs" class="btn">重新加载</button></div><div id="logList" class="list"><div class="empty">暂无日誌</div></div>
      </section>
    </div>
  </main>
</div>
<div id="toast" class="toast hidden"></div>
<script>
(function(){
'use strict';
var token='';var currentGroup='';var session=null;
var $=function(id){return document.getElementById(id)};
function activeTheme(){return document.documentElement.dataset.theme==='dark'?'dark':'light'}
function updateThemeButtons(){var dark=activeTheme()==='dark';if($('loginThemeToggle'))$('loginThemeToggle').textContent=dark?'切換白色模式':'切換黑色模式';if($('themeToggle'))$('themeToggle').textContent=dark?'白色模式':'黑色模式'}
function setTheme(theme){var next=theme==='dark'?'dark':'light';document.documentElement.dataset.theme=next;try{localStorage.setItem('qqai_theme',next)}catch(e){}updateThemeButtons()}
function toggleTheme(){setTheme(activeTheme()==='dark'?'light':'dark')}
var titles={overview:'总览',health:'健康检查',tasks:'任务与等待队列',moderation:'待确认操作',simulator:'事件模拟器',models:'模型中心',quota:'额度与限制',groups:'群组设置',memory:'记忆管理',logs:'操作日志',aidecisions:'AI 回覆紀錄',platform:'300 功能平台'};
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function toast(msg){$('toast').textContent=String(msg||'');$('toast').classList.remove('hidden');clearTimeout(toast.t);toast.t=setTimeout(function(){$('toast').classList.add('hidden')},3200)}
async function raw(path,method,data){try{var opt={method:method||'GET',headers:{},credentials:'same-origin',cache:'no-store'};if(data!==undefined){opt.headers['Content-Type']='application/json';opt.body=JSON.stringify(data)}var r=await fetch(path,opt);var j=await r.json().catch(function(){return{ok:false,message:'無法解析伺服器回應'}});if(!r.ok&&!j.message)j.message='HTTP '+r.status;return j}catch(e){return{ok:false,message:'網路請求失敗：'+String(e&&e.message||e)}}}
async function api(path,method,data){var opt={method:method||'GET',headers:{},credentials:'same-origin'};if(data!==undefined){opt.headers['Content-Type']='application/json';opt.body=JSON.stringify(data)}var r=await fetch('/api/portal'+path,opt);var j=await r.json().catch(function(){return{ok:false,message:'無法解析伺服器回應'}});if(r.status===401){showLogin()}return j}
function statusClass(s){return s==='ok'?'ok':s==='warning'?'warning':s==='error'?'error':''}
function ensureModal(){if($('qqaiModal'))return;var d=document.createElement('div');d.id='qqaiModal';d.className='hidden';d.style.cssText='position:fixed;inset:0;z-index:9999;background:#0009;display:grid;place-items:center;padding:18px';d.innerHTML='<div style="width:min(520px,100%);background:#101826;border:1px solid #ffffff22;border-radius:16px;padding:20px"><h3 id="qqaiModalTitle" style="margin-top:0">确认操作</h3><div id="qqaiModalText" style="white-space:pre-wrap;margin:12px 0"></div><textarea id="qqaiModalInput" class="hidden" style="width:100%;min-height:110px;margin:8px 0"></textarea><div style="display:flex;justify-content:flex-end;gap:10px"><button id="qqaiModalCancel" class="btn">取消</button><button id="qqaiModalOk" class="btn primary">确认</button></div></div>';document.body.appendChild(d)}
function customDialog(message,options){ensureModal();options=options||{};return new Promise(function(resolve){var d=$('qqaiModal'),input=$('qqaiModalInput');$('qqaiModalTitle').textContent=options.title||'确认操作';$('qqaiModalText').textContent=String(message||'');input.classList.toggle('hidden',!options.input);input.value=options.value||'';d.classList.remove('hidden');var done=function(value){d.classList.add('hidden');$('qqaiModalOk').onclick=null;$('qqaiModalCancel').onclick=null;resolve(value)};$('qqaiModalOk').onclick=function(){done(options.input?input.value:true)};$('qqaiModalCancel').onclick=function(){done(options.input?null:false)}})}
function confirmModal(message,title){return customDialog(message,{title:title||'确认操作'})}
function textModal(message,value,title){return customDialog(message,{title:title||'编辑内容',input:true,value:value||''})}
function applyRoleVisibility(){if(!session)return;var p=session.permissions||{},role=session.role||'member';document.querySelectorAll('#nav button').forEach(function(b){var v=b.dataset.view,show=true;if(role==='member'&&!['overview','models','memory'].includes(v))show=false;if(role==='admin'&&['quota','health'].includes(v))show=false;if(role==='owner'&&v==='quota')show=false;if(v==='quota'&&!p.developer)show=false;b.style.display=show?'':'none'})}
function ensureGroupSettingsExtras(){if($('welcomeEnabled')||!$('v-groups'))return;var grid=$('v-groups').querySelector('.grid');if(!grid)return;var card=document.createElement('div');card.className='card span-12';card.innerHTML='<h3>自动化与安全参数</h3><div class="grid"><div class="card span-6"><div class="notice">自动 QQ 群打卡固定在台北时间 00:00:00，对机器人所在的全部群执行，不受 AI 开关与 AI 白名单影响。Cloudflare／NapCat 实际发送可能有数秒延迟，因此是尽力争取首个打卡。</div><label class="switch"><input id="welcomeEnabled" type="checkbox">自动欢迎新人</label><label class="switch"><input id="joinAssistEnabled" type="checkbox">入群辅助（只建议同意，不拒绝）</label><label class="switch"><input id="ruleMonitorEnabled" type="checkbox">持续检查群成员是否违反群规</label><div class="field"><label>欢迎词（支持 {at}、{qq} 与表情符号）</label><textarea id="welcomeText"></textarea></div></div><div class="card span-6"><div class="field"><label>同一对象处置冷却（秒，默认 0＝关闭）</label><input id="moderationCooldown" type="number" min="0" ></div><div class="notice">处置冷却默认 0 秒且不设最大值；0 代表关闭。</div><div class="field"><label>新人观察期（天，0＝关闭）</label><input id="newcomerDays" type="number" min="0" max="30"></div><div class="notice">群规持续监控只有当前真实群主可以开关；开发者与 QQ 管理员可查看。它只提示疑似违规，不会自动处罚。</div></div></div>';grid.appendChild(card);ensureDeveloperPermissionPanel()}

function ensureR3Views(){
  var nav=$('nav');var container=document.querySelector('main .content')||document.querySelector('main')||$('app');if(!nav||!container)return;
  function addView(name,label){if(!$('v-'+name)){var b=document.createElement('button');b.dataset.view=name;b.textContent=label;b.onclick=function(){showView(name)};nav.appendChild(b);var section=document.createElement('section');section.id='v-'+name;section.className='view';container.appendChild(section)}titles[name]=label}
  addView('ruleviolations','群规监控');addView('settingscenter','设置中心');addView('bilibili','B站串接');addView('aidecisions','AI 回覆紀錄');
  if(!$('v-ruleviolations').dataset.ready){$('v-ruleviolations').dataset.ready='1';$('v-ruleviolations').innerHTML='<div class="section-head"><div><h2>群规监控记录</h2><p>默认开启并仅记录；可按群友、内容与 AI 分类的违规项目搜索。</p></div><button id="rvReload" class="btn">重新加载</button></div><div class="card"><div class="row"><input id="rvMember" placeholder="群友名称或 QQ"><input id="rvContent" placeholder="消息内容"><input id="rvType" placeholder="违规项目"><button id="rvSearch" class="btn primary">搜索</button></div><div class="row" style="margin-top:12px"><select id="rvProxyMode"><option value="record">仅记录</option><option value="warn">自动警告</option><option value="mute">自动禁言</option><option value="auto">按 AI 分类处理</option></select><input id="rvMuteSeconds" type="number" min="0" placeholder="禁言秒数"><label class="switch"><input id="rvKickAuth" type="checkbox">授权 AI 踢出</label><button id="rvSave" class="btn primary">保存代理设置</button></div></div><div id="rvList" class="list" style="margin-top:16px"></div>';$('rvReload').onclick=loadRuleViolations;$('rvSearch').onclick=loadRuleViolations;$('rvSave').onclick=saveRuleViolationSettings}
  if(!$('v-settingscenter').dataset.ready){$('v-settingscenter').dataset.ready='1';$('v-settingscenter').innerHTML='<div class="section-head"><div><h2>设置中心</h2><p>按角色显示可配置项目。开发者可指定目标 QQ/角色，并选择是否写入操作日志。</p></div><button id="scReload" class="btn">重新加载</button></div><div id="scDeveloper" class="card hidden"><div class="row"><input id="scTargetQq" placeholder="目标 QQ"><select id="scTargetRole"><option value="member">群员</option><option value="admin">管理员</option><option value="owner">群主</option><option value="developer">开发者</option></select><select id="scAudit"><option value="log">记录 log</option><option value="silent">不记录 log</option></select></div></div><div id="scList" class="list" style="margin-top:16px"></div>';$('scReload').onclick=loadSettingsCenter;['scTargetQq','scTargetRole'].forEach(function(id){$(id).onchange=loadSettingsCenter})}
  if(!$('v-aidecisions').dataset.ready){$('v-aidecisions').dataset.ready='1';$('v-aidecisions').innerHTML='<div class="section-head"><div><h2>AI 回覆與未回覆紀錄</h2><p>每則群聊觸發判斷、主動插話來源、模型、智能 @ 規劃、獨立搜索內容與實際發送結果都獨立保存。</p></div><button id="aiLogReload" class="btn">重新載入</button></div><div class="card"><div class="row"><input id="aiLogSearch" class="grow" placeholder="搜尋 QQ、訊息、原因、模型"><select id="aiLogDecision"><option value="">全部決策</option><option value="reply_generated">已產生回覆</option><option value="skipped">未回覆</option><option value="blocked">遭阻擋</option><option value="error">錯誤</option></select><select id="aiLogTrigger"><option value="">全部觸發</option><option value="mention">@機器人</option><option value="reply_to_ai">回覆機器人</option><option value="auto_interject">主動插話</option><option value="private">私聊</option><option value="none">未觸發</option></select><button id="aiLogSearchBtn" class="btn primary">搜尋</button></div></div><div id="aiDecisionList" class="list" style="margin-top:16px"><div class="empty">尚未載入</div></div>';$('aiLogReload').onclick=loadAiDecisions;$('aiLogSearchBtn').onclick=loadAiDecisions;$('aiLogSearch').onkeydown=function(e){if(e.key==='Enter')loadAiDecisions()}}
  if(!$('v-bilibili').dataset.ready){$('v-bilibili').dataset.ready='1';$('v-bilibili').innerHTML='<div class="section-head"><div><h2>B站串接</h2><p>不绑定固定示例账号。填写使用者实际要求串接的创作者，并选择直播/新视频及 @全体选项。</p></div><button id="biliReload" class="btn">重新加载</button></div><div class="card"><div class="row"><input id="biliCreatorName" placeholder="创作者名称"><input id="biliCreatorId" placeholder="开放平台创作者 ID / UID"><select id="biliMode"><option value="official_webhook">B站开放平台 Webhook</option><option value="generic_webhook">通用事件桥接 Webhook</option></select></div><div class="row"><label class="switch"><input id="biliLiveNotify" type="checkbox">开播通知</label><label class="switch"><input id="biliLiveAtAll" type="checkbox">开播 @全体</label><label class="switch"><input id="biliVideoNotify" type="checkbox">新视频通知</label><label class="switch"><input id="biliVideoAtAll" type="checkbox">新视频 @全体</label><button id="biliAdd" class="btn primary">新增串接</button></div><div class="notice">所有通知均可关闭，此时只记录事件。@全体只有 Bot 为 QQ 管理员或群主时才会发送。</div></div><div id="biliList" class="list" style="margin-top:16px"></div>';$('biliReload').onclick=loadBilibili;$('biliAdd').onclick=saveBilibiliConnector}
  if(!$('v-platform')){var b=document.createElement('button');b.dataset.view='platform';b.textContent='300 功能平台';$('nav').appendChild(b);b.onclick=function(){showView('platform')};var v=document.createElement('section');v.id='v-platform';v.className='view';v.innerHTML='<div class="section-head"><div><h2>300 功能平台</h2><p>搜尋功能、查看實作模式並依角色管理開關。</p></div><button id="pfReload" class="btn">重新載入</button></div><div class="card"><div class="row"><input id="pfSearch" class="grow" placeholder="搜尋功能名稱、ID、類別"><select id="pfAudit"><option value="log">記錄 Log</option><option value="silent">不記錄 Log（僅開發者）</option></select><button id="pfGo" class="btn primary">搜尋</button></div><div id="pfSummary" class="notice">尚未載入</div></div><div id="pfList" class="list" style="margin-top:16px"></div>';document.querySelector('.content').appendChild(v);$('pfReload').onclick=loadPlatformFeatures;$('pfGo').onclick=loadPlatformFeatures;$('pfSearch').onkeydown=function(e){if(e.key==='Enter')loadPlatformFeatures()}}
}
function applyR3RoleVisibility(){ensureR3Views();var perms=(session&&session.permissions)||{};var management=!!(perms.aiAdmin||perms.groupOps||perms.nativeAdmin||perms.developer||session&&['admin','owner'].includes(session.role));var dev=!!perms.developer;document.querySelectorAll('#nav button').forEach(function(b){if(['ruleviolations','bilibili','aidecisions'].includes(b.dataset.view))b.hidden=!management;if(b.dataset.view==='settingscenter')b.hidden=false});$('scDeveloper').classList.toggle('hidden',!dev);if($('rvSave'))$('rvSave').disabled=!(session&&session.role==='owner');if($('rvKickAuth'))$('rvKickAuth').disabled=!(session&&session.role==='owner')}
async function loadAiDecisions(){var p=new URLSearchParams({q:$('aiLogSearch').value||'',decision:$('aiLogDecision').value||'',triggerType:$('aiLogTrigger').value||'',limit:'500'});var r=await api('/ai-decisions?'+p.toString());if(!r.ok){$('aiDecisionList').innerHTML='<div class="empty">'+esc(r.message)+'</div>';return}$('aiDecisionList').innerHTML=(r.logs||[]).map(function(x){var title=(x.decision||'unknown')+'｜'+(x.senderName||x.userId||'')+'（'+(x.userId||'')+'）';var meta=(x.at||'')+'｜觸發 '+(x.triggerType||'none')+'｜原因 '+(x.reason||'')+'｜'+(x.provider||'')+((x.model)?'/'+x.model:'')+'｜發送 '+(x.sendStatus||'');var body='來源訊息：'+(x.input||'')+(x.generatedReply?'\nAI 回覆：'+x.generatedReply:'')+'\n關係：'+JSON.stringify({mentionedQqs:x.mentionedQqs||[],quotedMessageId:x.quotedMessageId||'',quotedSenderId:x.quotedSenderId||''})+'\n智能 @ 規劃：'+JSON.stringify(x.mentionRouting||{})+'\n回覆計畫：'+JSON.stringify(x.replyPlan||{})+'\n是否搜索：'+(x.searchPerformed?'有':'無')+'（需要='+(x.searchRequired?'是':'否')+'，嘗試='+(x.searchAttempted?'是':'否')+'）'+'\n搜索查詢：'+(x.searchQuery||'')+'\n搜索關鍵詞：'+JSON.stringify(x.searchQueries||[])+'\n搜索提供者：'+(x.searchProvider||'')+((x.searchModel)?'/'+x.searchModel:'')+'\n搜索錯誤：'+(x.searchError||'')+'\n搜索內容：'+(x.searchContext||'')+'\n搜索來源：'+JSON.stringify(x.searchSources||[])+'\n上下文：原文 '+(x.contextExactMessages||0)+'／摘要 '+(x.contextSummarizedMessages||0)+'／提供者 '+(x.contextSummaryProvider||'');return '<div class="item"><div class="item-title">'+esc(title)+'</div><div class="item-meta">'+esc(meta)+'</div><div class="item-body" style="white-space:pre-wrap">'+esc(body)+'</div></div>'}).join('')||'<div class="empty">沒有符合的紀錄</div>'}
async function loadRuleViolations(){var p=new URLSearchParams({member:$('rvMember').value||'',content:$('rvContent').value||'',type:$('rvType').value||''});var r=await api('/rule-violations?'+p.toString());if(!r.ok){$('rvList').innerHTML='<div class="empty">'+esc(r.message)+'</div>';return}$('rvProxyMode').value=r.settings.proxyMode||'record';$('rvMuteSeconds').value=r.settings.muteSeconds||600;$('rvKickAuth').checked=!!r.settings.kickAuthorized;$('rvList').innerHTML=(r.items||[]).map(function(x){return '<div class="item"><div class="item-head"><div><div class="item-title">'+esc(x.senderName||x.userId)+'（'+esc(x.userId)+'）｜'+esc(x.violationType||'其他')+'</div><div class="item-meta">'+new Date(Number(x.createdAt||0)).toLocaleString()+'｜置信度 '+esc(x.confidence)+'｜处理 '+esc(x.actionTaken||'none')+'</div></div></div><div class="item-body">'+esc(x.content)+'<br><b>分类：</b>'+esc(x.violationType||'')+'<br><b>原因：</b>'+esc(x.reason||'')+'<br><b>结果：</b>'+esc(x.actionResult||'')+'</div></div>'}).join('')||'<div class="empty">暂无违规记录</div>'}
async function saveRuleViolationSettings(){var r=await api('/rule-violations/settings','POST',{proxyMode:$('rvProxyMode').value,muteSeconds:$('rvMuteSeconds').value,kickAuthorized:$('rvKickAuth').checked});toast(r.message);if(r.ok)loadRuleViolations()}
async function loadSettingsCenter(){var dev=session&&(session.permissions||{}).developer;var p=new URLSearchParams();if(dev){p.set('targetQq',$('scTargetQq').value||session.qq);p.set('targetRole',$('scTargetRole').value)}var r=await api('/settings-center?'+p.toString());if(!r.ok){$('scList').innerHTML='<div class="empty">'+esc(r.message)+'</div>';return}if(dev&&!$('scTargetQq').value)$('scTargetQq').value=r.targetQq||session.qq;$('scList').innerHTML='';(r.settings||[]).forEach(function(s){var d=document.createElement('div');d.className='item';var input;if(s.type==='boolean'){input=document.createElement('input');input.type='checkbox';input.checked=!!s.value}else if(s.type==='select'){input=document.createElement('select');(s.options||[]).forEach(function(v){var o=document.createElement('option');o.value=v;o.textContent=v;input.appendChild(o)});input.value=String(s.value)}else if(s.type==='textarea'){input=document.createElement('textarea');input.value=String(s.value==null?'':s.value)}else{input=document.createElement('input');input.type=s.type==='number'?'number':'text';input.value=String(s.value==null?'':s.value);if(s.min!=null)input.min=s.min;if(s.max!=null)input.max=s.max}var save=document.createElement('button');save.className='btn primary';save.textContent='保存';save.onclick=async function(){var value=input.type==='checkbox'?input.checked:input.value;var payload={key:s.key,value:value};if(dev){payload.targetQq=$('scTargetQq').value;payload.targetRole=$('scTargetRole').value;payload.auditMode=$('scAudit').value}var x=await api('/settings-center','POST',payload);toast(x.message)};d.innerHTML='<div class="item-title">'+esc(s.label)+'</div><div class="item-meta">角色：'+esc(s.minRole)+'｜对应指令：'+esc(s.command||'')+'</div>';d.append(input,save);$('scList').appendChild(d)})}
async function loadBilibili(){var r=await api('/integrations/bilibili');if(!r.ok){$('biliList').innerHTML='<div class="empty">'+esc(r.message)+'</div>';return}$('biliList').innerHTML='';(r.connectors||[]).forEach(function(c){var d=document.createElement('div');d.className='item';d.innerHTML='<div class="item-title">'+esc(c.creatorName||c.creatorId)+'</div><div class="item-meta">模式：'+esc(c.mode)+'｜直播：'+(c.liveNotify?'通知':'仅记录')+(c.liveAtAll?'＋@全体':'')+'｜视频：'+(c.videoNotify?'通知':'仅记录')+(c.videoAtAll?'＋@全体':'')+'</div><div class="item-body">Webhook：'+esc(c.webhookUrl||'')+'</div>';var row=document.createElement('div');row.className='row';var testLive=document.createElement('button');testLive.className='btn';testLive.textContent='测试开播';testLive.onclick=function(){testBilibili(c.id,'live_start')};var testVideo=document.createElement('button');testVideo.className='btn';testVideo.textContent='测试新视频';testVideo.onclick=function(){testBilibili(c.id,'video_publish')};var del=document.createElement('button');del.className='btn danger';del.textContent='删除';del.onclick=async function(){if(!(await confirmModal('删除此 B站串接？','确认删除')))return;var x=await api('/integrations/bilibili','POST',{action:'delete',id:c.id});toast(x.message);if(x.ok)loadBilibili()};row.append(testLive,testVideo,del);d.appendChild(row);$('biliList').appendChild(d)});if(!$('biliList').children.length)$('biliList').innerHTML='<div class="empty">暂无 B站串接</div>'}
async function saveBilibiliConnector(){var r=await api('/integrations/bilibili','POST',{action:'save',creatorName:$('biliCreatorName').value,creatorId:$('biliCreatorId').value,mode:$('biliMode').value,liveNotify:$('biliLiveNotify').checked,liveAtAll:$('biliLiveAtAll').checked,videoNotify:$('biliVideoNotify').checked,videoAtAll:$('biliVideoAtAll').checked});toast(r.message);if(r.ok){$('biliCreatorName').value='';$('biliCreatorId').value='';loadBilibili()}}
async function testBilibili(id,eventType){var r=await api('/integrations/bilibili','POST',{action:'test',id:id,eventType:eventType});toast(r.message)}

function setNativeAdminVisibility(botIsOwner){var sel=$('opAction');if(!sel)return;Array.from(sel.options||[]).forEach(function(o){if(o.value==='set_admin'||o.value==='unset_admin'){o.hidden=!botIsOwner;o.disabled=!botIsOwner}});if(sel.selectedOptions&&sel.selectedOptions[0]&&sel.selectedOptions[0].disabled)sel.selectedIndex=0}
async function refreshCapabilities(){if(!currentGroup){setNativeAdminVisibility(false);return null}var r=await api('/capabilities');if(r&&r.ok)setNativeAdminVisibility(!!r.bot_is_owner);else setNativeAdminVisibility(false);return r}
function ensureDeveloperPermissionPanel(){if(!session||!(session.permissions||{}).developer||$('developerPermissionPanel')||!$('v-groups'))return;var grid=$('v-groups').querySelector('.grid');if(!grid)return;var card=document.createElement('div');card.id='developerPermissionPanel';card.className='card span-12';card.innerHTML='<h3>程序内 AI 管理权限</h3><p class="notice">这里授予的是使用机器人执行禁言、踢出、待确认操作等程序权限，不会把对方设为真正 QQ 管理员。</p><div class="row"><input id="permissionQq" placeholder="目标 QQ"><select id="permissionType"><option value="ai_admin">AI 管理</option><option value="group_ops">群操作（可用 Bot 禁言等）</option></select><button id="grantPermission" class="btn primary">授予</button><button id="revokePermission" class="btn danger">撤销</button></div>';grid.appendChild(card);$('grantPermission').onclick=function(){changeProgramPermission(true)};$('revokePermission').onclick=function(){changeProgramPermission(false)}}
async function changeProgramPermission(enabled){var qq=String($('permissionQq').value||'').replace(/\D/g,'');if(!qq){toast('请输入目标 QQ');return}var r=await api('/root/member','POST',{qq:qq,permission:$('permissionType').value,enabled:enabled});toast(r.message||'完成')}
function ensureModelRegistryPanel(){if($('runtimeModelPanel')||!$('v-models'))return;var panel=document.createElement('div');panel.id='runtimeModelPanel';panel.className='card';panel.style.marginTop='16px';panel.innerHTML='<h3>运行时模型顺序（开发者）</h3><p class="notice">新增、删除与排序只写入 D1。wrangler 环境变量中的默认模型保持锁定，不修改源代码，并只作为后备。</p><div class="row"><select id="runtimeModelKind"><option value="chat">Gemini 聊天</option><option value="decision">Gemma 判断</option><option value="last_resort">Gemma 最后备案</option><option value="tts">TTS</option></select><input id="runtimeModelId" placeholder="模型 ID"><button id="runtimeModelAdd" class="btn primary">新增</button></div><div id="runtimeModelList" class="list" style="margin-top:12px"></div>';$('v-models').appendChild(panel);$('runtimeModelKind').onchange=loadRuntimeModels;$('runtimeModelAdd').onclick=async function(){var id=$('runtimeModelId').value.trim();if(!id){toast('请输入模型 ID');return}var r=await api('/root/model-registry','POST',{action:'add',kind:$('runtimeModelKind').value,id:id});toast(r.message||'完成');if(r.ok){$('runtimeModelId').value='';loadRuntimeModels()}}}
async function runtimeModelAction(action,id,direction,enabled){var r=await api('/root/model-registry','POST',{action:action,kind:$('runtimeModelKind').value,id:id,direction:direction,enabled:enabled});toast(r.message||'完成');if(r.ok)loadRuntimeModels()}
async function loadRuntimeModels(){if(!session||!(session.permissions||{}).developer)return;ensureModelRegistryPanel();var r=await api('/root/model-registry');if(!r.ok){$('runtimeModelList').innerHTML='<div class="empty">'+esc(r.message)+'</div>';return}var kind=$('runtimeModelKind').value;var state=(r.categories||{})[kind]||{custom:[],immutable:[]};var html='';(state.custom||[]).forEach(function(m){html+='<div class="item"><div class="item-head"><div><div class="item-title">'+esc(m.id)+'</div><div class="item-meta">自定义｜'+(m.enabled?'已启用':'已停用')+'</div></div><div class="row"><button class="btn" data-act="up" data-id="'+esc(m.id)+'">上移</button><button class="btn" data-act="down" data-id="'+esc(m.id)+'">下移</button><button class="btn" data-act="toggle" data-enabled="'+(!m.enabled)+'" data-id="'+esc(m.id)+'">'+(m.enabled?'停用':'启用')+'</button><button class="btn danger" data-act="delete" data-id="'+esc(m.id)+'">删除</button></div></div></div>'});(state.immutable||[]).forEach(function(m){html+='<div class="item"><div class="item-title">'+esc(m.id)+'</div><div class="item-meta">锁定默认后备｜不可修改</div></div>'});$('runtimeModelList').innerHTML=html||'<div class="empty">没有模型</div>';$('runtimeModelList').querySelectorAll('button[data-act]').forEach(function(b){b.onclick=function(){var a=b.dataset.act;if(a==='up'||a==='down')runtimeModelAction('move',b.dataset.id,a);else if(a==='toggle')runtimeModelAction('toggle',b.dataset.id,'',b.dataset.enabled==='true');else runtimeModelAction('delete',b.dataset.id)}})}

function ensureSearchTools(){if($('logList')&&!$('logSearch')){var wrap=document.createElement('div');wrap.className='row';wrap.innerHTML='<input id="logSearch" placeholder="搜索操作、操作者、类型"><button id="logSearchBtn" class="btn">搜索日志</button>';$('logList').parentNode.insertBefore(wrap,$('logList'));$('logSearchBtn').onclick=loadLogs;$('logSearch').onkeydown=function(e){if(e.key==='Enter')loadLogs()}}if($('memoryList')&&!$('vectorSearch')){var v=document.createElement('div');v.className='row';v.innerHTML='<input id="vectorSearch" placeholder="搜索群聊向量"><button id="vectorSearchBtn" class="btn">向量搜索</button><div id="vectorResults" style="width:100%"></div>';$('memoryList').parentNode.insertBefore(v,$('memoryList'));$('vectorSearchBtn').onclick=loadVectorSearch}}
async function loadVectorSearch(){var q=$('vectorSearch')?$('vectorSearch').value.trim():'';if(!q)return;var r=await api('/vector-search?q='+encodeURIComponent(q));$('vectorResults').innerHTML=r.ok?(r.results||[]).map(function(x){return '<div class="item"><div class="item-title">相关度 '+esc(Number(x.score||0).toFixed(3))+'</div><div class="item-meta">QQ '+esc(x.qq||'')+'</div><div class="item-body">'+esc(x.text||'')+'</div></div>'}).join(''):'<div class="empty">'+esc(r.message||'搜索失败')+'</div>'}

function showLogin(){$('login').classList.remove('hidden');$('app').classList.add('hidden')}
function showApp(){$('login').classList.add('hidden');$('app').classList.remove('hidden')}
async function loadPlatformFeatures(){var q=$('pfSearch')?$('pfSearch').value:'';var r=await api('/platform/features?q='+encodeURIComponent(q));if(!r.ok){$('pfList').innerHTML='<div class="empty">'+esc(r.message)+'</div>';return}$('pfSummary').textContent='總功能 '+r.total+' 項；目前可見 '+r.visible+' 項；部署模式：單一 Worker；付費 Cloudflare 服務：未啟用';$('pfList').innerHTML='';(r.features||[]).forEach(function(f){var d=document.createElement('div');d.className='item';var sw=document.createElement('input');sw.type='checkbox';sw.checked=!!f.enabled;sw.onchange=async function(){var x=await api('/platform/features','POST',{id:f.id,enabled:sw.checked,auditMode:$('pfAudit').value});toast(x.message);if(!x.ok)sw.checked=!sw.checked};d.innerHTML='<div class="item-head"><div><div class="item-title">'+esc(f.id)+'｜'+esc(f.name)+'</div><div class="item-meta">類別：'+esc(f.category)+'｜模式：'+esc(f.mode)+'｜最低角色：'+esc(f.minRole)+'</div></div></div>';d.appendChild(sw);$('pfList').appendChild(d)});if(!$('pfList').children.length)$('pfList').innerHTML='<div class="empty">沒有符合的功能</div>'}
function showView(name){document.querySelectorAll('.view').forEach(function(v){v.classList.remove('active')});document.querySelectorAll('#nav button').forEach(function(b){b.classList.toggle('active',b.dataset.view===name)});$('v-'+name).classList.add('active');$('pageTitle').textContent=titles[name]||name;$('sidebar').classList.remove('open');if(name==='health')loadHealth('quick');if(name==='tasks')loadTasks();if(name==='moderation')loadProposals();if(name==='models')loadModels();if(name==='quota')loadQuota();if(name==='groups')loadGroupSettings();if(name==='memory')loadMemory();if(name==='logs')loadLogs();if(name==='aidecisions')loadAiDecisions();if(name==='ruleviolations')loadRuleViolations();if(name==='settingscenter')loadSettingsCenter();if(name==='bilibili')loadBilibili();if(name==='platform')loadPlatformFeatures()}
async function loadGroups(){var r=await api('/groups');if(!r.ok){toast(r.message);return false}var sel=$('groupSelect');sel.innerHTML='<option value="">选择群组</option>';(r.groups||[]).forEach(function(g){var o=document.createElement('option');o.value=g.groupId;o.textContent=(g.groupName||g.groupId)+' ('+g.groupId+')';sel.appendChild(o)});if(r.selectedGroupId){sel.value=r.selectedGroupId;currentGroup=r.selectedGroupId}return true}
async function selectGroup(id){if(!id){currentGroup='';setNativeAdminVisibility(false);return}var r=await api('/select-group','POST',{groupId:id});if(!r.ok){toast(r.message);return}currentGroup=id;session=r.session;$('identity').innerHTML='<b>'+esc(session.qq)+'</b><br><span style="color:#98a2b7">'+esc(session.role||'member')+'</span>';await refreshCapabilities();applyR3RoleVisibility();toast('群组已切换');refreshOverview()}
async function boot(){ensureR3Views();if(!token){setNativeAdminVisibility(false);showLogin();return}showApp();var me=await api('/me');if(!me.ok){setNativeAdminVisibility(false);showLogin();return}session=me.session;$('identity').innerHTML='<b>'+esc(session.qq)+'</b><br><span style="color:#98a2b7">'+esc(session.role||'member')+'</span>';await loadGroups();await refreshCapabilities();applyR3RoleVisibility();refreshOverview()}
async function loadHealth(mode){$('healthList').innerHTML='<div class="empty">檢查中…</div>';var r=await api('/health?mode='+encodeURIComponent(mode||'quick'));if(!r.checks){$('healthList').innerHTML='<div class="empty">'+esc(r.message||'檢查失敗')+'</div>';return}renderHealth(r)}
function renderHealth(r){$('healthSummary').innerHTML='<div class="card span-4"><div class="metric-label">正常</div><div class="metric-value">'+esc(r.counts.ok)+'</div></div><div class="card span-4"><div class="metric-label">警告</div><div class="metric-value">'+esc(r.counts.warning)+'</div></div><div class="card span-4"><div class="metric-label">錯誤</div><div class="metric-value">'+esc(r.counts.error)+'</div></div>';$('healthList').innerHTML=(r.checks||[]).map(function(c){var detail=c.error||JSON.stringify(c.detail||'');return '<div class="health-card"><div class="item-head"><div class="item-title">'+esc(c.name)+'</div><span class="status '+statusClass(c.status)+'">'+esc(c.status)+'</span></div><div class="latency">'+esc(c.latencyMs)+' ms</div><div class="detail">'+esc(detail)+'</div></div>'}).join('')||'<div class="empty">沒有檢查項目</div>';var issues=(r.checks||[]).filter(function(c){return c.status!=='ok'});$('overviewIssues').innerHTML=issues.map(function(c){return '<div class="item"><div class="item-head"><div class="item-title">'+esc(c.name)+'</div><span class="status '+statusClass(c.status)+'">'+esc(c.status)+'</span></div><div class="item-meta">'+esc(c.error||JSON.stringify(c.detail||''))+'</div></div>'}).join('')||'<div class="empty">所有檢查項目正常</div>';$('overallStatus').className='status '+(r.ok?'ok':'error');$('overallStatus').textContent=r.ok?'系統正常':'需要處理'}
async function loadTasks(){var r=await api('/tasks');if(!r.ok){$('taskList').innerHTML='<div class="empty">'+esc(r.message)+'</div>';return}$('mActive').textContent=r.inFlightQuestions||0;$('mQueued').textContent=r.queuedQuestions||0;$('taskStats').innerHTML='<div class="card span-6"><div class="metric-label">執行中</div><div class="metric-value">'+esc(r.inFlightQuestions||0)+'</div></div><div class="card span-6"><div class="metric-label">等待中</div><div class="metric-value">'+esc(r.queuedQuestions||0)+'</div></div>';$('taskList').innerHTML='';(r.queues||[]).forEach(function(q){var d=document.createElement('div');d.className='item';d.innerHTML='<div class="item-head"><div><div class="item-title">群 '+esc(q.groupId)+'／QQ '+esc(q.userId)+'</div><div class="item-meta">執行中：'+esc(q.preview||'無')+'<br>排隊：'+esc((q.queued||[]).length)+' 題</div></div></div>';(q.queued||[]).forEach(function(x){var p=document.createElement('div');p.className='item-body';p.textContent='等待：'+x.preview;d.appendChild(p)});var b=document.createElement('button');b.className='btn danger';b.textContent='取消此使用者等待列';b.addEventListener('click',async function(){var x=await api('/tasks/cancel','POST',{groupId:q.groupId,userId:q.userId});toast(x.message||'完成');loadTasks()});d.appendChild(b);$('taskList').appendChild(d)});if(!$('taskList').children.length)$('taskList').innerHTML='<div class="empty">目前沒有執行中或等待中的問題</div>'}
function proposalState(p){if(p.status==='pending'&&Date.now()>Number(p.expiresAt||0))return'expired';return p.status||'pending'}
async function loadProposals(){await refreshCapabilities();var r=await api('/moderation/proposals');if(!r.ok){$('proposalList').innerHTML='<div class="empty">'+esc(r.message)+'</div>';return}var pending=(r.proposals||[]).filter(function(p){return proposalState(p)==='pending'});$('mProposals').textContent=pending.length;$('proposalList').innerHTML='';(r.proposals||[]).forEach(function(p){var st=proposalState(p);var d=document.createElement('div');d.className='item';d.innerHTML='<div class="item-head"><div><div class="item-title">'+esc(p.id)+'｜'+esc(p.actionLabel||p.action)+'</div><div class="item-meta">提出者：'+esc(p.actorName||p.actorId)+'｜目标：'+esc(p.targetName||p.targetId||'全群')+'｜状态：'+esc(st)+'</div></div><span class="status '+(st==='executed'?'ok':st==='pending'?'warning':st==='failed'?'error':'')+'">'+esc(st)+'</span></div><div class="item-body">'+esc(p.sourceText||'')+'</div>';if(st==='pending'){var a=document.createElement('div');a.className='row';a.style.marginTop='10px';var yes=document.createElement('button');yes.className='btn primary';yes.textContent='确认并执行';yes.onclick=async function(){if(!(await confirmModal('确定执行 '+p.id+'？','确认待执行操作')))return;var x=await api('/moderation/confirm','POST',{id:p.id});toast(x.message);loadProposals()};var no=document.createElement('button');no.className='btn danger';no.textContent='取消';no.onclick=async function(){var x=await api('/moderation/cancel','POST',{id:p.id});toast(x.message);loadProposals()};a.append(yes,no);d.appendChild(a)}$('proposalList').appendChild(d)});if(!$('proposalList').children.length)$('proposalList').innerHTML='<div class="empty">暂无待确认操作</div>'}
async function loadModels(){var r=await api('/models');if(!r.ok){$('modelList').innerHTML='<div class="empty span-12">'+esc(r.message)+'</div>';return}$('modelList').innerHTML=(r.models||[]).map(function(m){return '<div class="card span-4"><div class="item-head"><div><div class="item-title">'+esc(m.id)+'</div><div class="item-meta">'+esc(m.provider)+'／'+esc(m.family)+(m.billing?'／'+esc(m.billing):'')+'</div></div><span class="status '+statusClass(m.status)+'">'+esc(m.status)+'</span></div><div style="margin-top:10px">'+(m.capabilities||[]).map(function(x){return'<span class="pill">'+esc(x)+'</span>'}).join('')+'</div></div>'}).join('')||'<div class="empty span-12">没有模型</div>';if(session&&(session.permissions||{}).developer){ensureModelRegistryPanel();loadRuntimeModels()}}
async function loadQuota(){var r=await api('/root/quotas');if(!r.ok){$('quotaStatus').textContent=r.message;$('globalQuota').disabled=true;$('groupQuota').disabled=true;$('saveQuota').disabled=true;return}$('globalQuota').disabled=false;$('groupQuota').disabled=false;$('saveQuota').disabled=false;$('globalQuota').value=r.globalDailyCny||'';$('groupQuota').value=r.groupDailyCny||'';$('quotaStatus').textContent='全站：'+(r.globalDailyCny===''?'無限制':r.globalDailyCny+' CNY／日')+'；目前群：'+(r.groupDailyCny===''?'無限制':r.groupDailyCny+' CNY／日')}
async function loadGroupSettings(){ensureGroupSettingsExtras();var r=await api('/admin/state');if(!r.ok){toast(r.message);return}$('groupAi').checked=!!r.ai_on;$('groupMemory').checked=!!r.memory_on;$('activeSpeaking').checked=!!r.active_speaking;$('interjectRate').value=r.interject_rate;$('groupPersona').value=r.persona||'';$('groupKeywords').value=(r.keywords||[]).join('\n');$('welcomeEnabled').checked=!!r.welcome_enabled;$('joinAssistEnabled').checked=!!r.join_assist_enabled;$('ruleMonitorEnabled').checked=!!r.rule_monitor_enabled;$('welcomeText').value=r.welcome_text||'歡迎 {at} 加入本群 🎉 請先閱讀群規，有問題可以詢問管理員。';$('moderationCooldown').value=Number(r.moderation_target_cooldown_seconds||0);$('newcomerDays').value=Number(r.newcomer_observation_days||0);var canSetCommon=!!(session&&((session.permissions||{}).aiAdmin||(session.permissions||{}).developer));$('joinAssistEnabled').disabled=!canSetCommon;var owner=!!(session&&session.role==='owner');$('ruleMonitorEnabled').disabled=!owner;var ownerOrDeveloper=!!(session&&(owner||(session.permissions||{}).developer));['welcomeEnabled','welcomeText','moderationCooldown','newcomerDays'].forEach(function(id){$(id).disabled=!ownerOrDeveloper});setNativeAdminVisibility(!!r.bot_is_owner);ensureDeveloperPermissionPanel()}
async function loadMemory(){var r=await api('/memories');if(!r.ok){$('memoryList').innerHTML='<div class="empty">'+esc(r.message)+'</div>';return}var all=(r.private||[]).map(function(x){return Object.assign({},x,{_scope:'private'})}).concat((r.public||[]).map(function(x){return Object.assign({},x,{_scope:'public'})})).filter(function(x){return x.id&&String(x.text||'').trim()});$('memoryList').innerHTML='';all.forEach(function(m){var d=document.createElement('div');d.className='item';d.innerHTML='<div class="item-head"><div><div class="item-title">'+esc(m.text)+'</div><div class="item-meta">'+esc(m._scope)+'｜'+esc(m.at||m.updatedAt||'')+'</div></div></div>';var row=document.createElement('div');row.className='row';var edit=document.createElement('button');edit.className='btn';edit.textContent='编辑';edit.onclick=async function(){var text=await textModal('修改记忆内容',m.text,'编辑记忆');if(text===null)return;var x=await api('/memories','PUT',{scope:m._scope,id:m.id,text:text});toast(x.message|| (x.ok?'已更新':'更新失败'));loadMemory()};var del=document.createElement('button');del.className='btn danger';del.textContent='删除';del.onclick=async function(){if(!(await confirmModal('删除这条记忆？对应的长期记忆向量也会删除。','删除记忆')))return;var x=await api('/memories','DELETE',{scope:m._scope,id:m.id});toast(x.message||'已删除');loadMemory()};row.append(edit,del);d.appendChild(row);$('memoryList').appendChild(d)});if(!$('memoryList').children.length)$('memoryList').innerHTML='<div class="empty">暂无记忆</div>';ensureSearchTools()}
async function loadLogs(){var q=$('logSearch')?$('logSearch').value.trim():'';var r=await api('/admin/logs?q='+encodeURIComponent(q));if(!r.ok){$('logList').innerHTML='<div class="empty">'+esc(r.message)+'</div>';return}$('logList').innerHTML=(r.logs||[]).map(function(a){return '<div class="item"><div class="item-title">'+esc(a.type||a.action||'操作')+'</div><div class="item-meta">'+esc(a.at||'')+'｜'+esc(a.actorId||'')+'</div><div class="item-body">'+esc(a.action||JSON.stringify(a))+'</div></div>'}).join('')||'<div class="empty">暂无操作日志</div>'}
async function refreshOverview(){var h=await api('/health?mode=quick');if(h.checks)renderHealth(h);var t=await api('/tasks');if(t.ok){$('mActive').textContent=t.inFlightQuestions||0;$('mQueued').textContent=t.queuedQuestions||0}var p=await api('/moderation/proposals');if(p.ok)$('mProposals').textContent=(p.proposals||[]).filter(function(x){return proposalState(x)==='pending'}).length;var doCheck=(h.checks||[]).find(function(c){return c.name==='Durable Object / NapCat'});var connected=doCheck&&doCheck.status==='ok';$('mNapcat').textContent=connected?'已連線':'未連線';$('mNapcatSub').textContent=doCheck?String(doCheck.latencyMs)+' ms':'暂无資料'}
async function requestLoginCode(){var qq=String($('loginQq').value||'').replace(/\D/g,'');if(!/^\d{5,12}$/.test(qq)){$('loginNotice').textContent='請輸入正確的 QQ 號。';return}var b=$('sendCode');b.disabled=true;b.textContent='傳送中…';$('loginNotice').textContent='正在透過 NapCat 傳送驗證碼…';var r=await raw('/api/auth/request-code','POST',{qq:qq});$('loginNotice').textContent=r.message||'驗證碼傳送失敗。';b.disabled=false;b.textContent=r.ok?'重新傳送驗證碼':'傳送驗證碼'}
async function verifyLoginCode(){var qq=String($('loginQq').value||'').replace(/\D/g,''),code=String($('loginCode').value||'').replace(/\D/g,'');if(!/^\d{5,12}$/.test(qq)||!/^\d{6}$/.test(code)){$('loginNotice').textContent='請輸入正確的 QQ 號與六位驗證碼。';return}var b=$('verifyCode');b.disabled=true;b.textContent='驗證中…';var r=await raw('/api/auth/verify-code','POST',{qq:qq,code:code});$('loginNotice').textContent=r.message||'驗證失敗。';b.disabled=false;b.textContent='登入管理中心';if(r.ok){boot()}}
$('sendCode').addEventListener('click',requestLoginCode);$('verifyCode').addEventListener('click',verifyLoginCode);$('loginQq').addEventListener('keydown',function(e){if(e.key==='Enter')requestLoginCode()});$('loginCode').addEventListener('keydown',function(e){if(e.key==='Enter')verifyLoginCode()});$('loginThemeToggle').addEventListener('click',toggleTheme);$('themeToggle').addEventListener('click',toggleTheme);updateThemeButtons();
$('logout').onclick=async function(){await raw('/api/auth/logout','POST',{});location.reload()};$('menu').onclick=function(){$('sidebar').classList.toggle('open')};$('refresh').onclick=function(){var active=document.querySelector('#nav button.active');showView(active?active.dataset.view:'overview')};$('groupSelect').onchange=function(){selectGroup(this.value)};document.querySelectorAll('#nav button').forEach(function(b){b.onclick=function(){showView(b.dataset.view)}});
$('quickHealth').onclick=function(){loadHealth('quick')};$('fullHealth').onclick=function(){loadHealth('full')};$('reloadTasks').onclick=loadTasks;$('clearQueue').onclick=async function(){if(!currentGroup){toast('請先选择群组');return}if(!(await confirmModal('清空当前群所有等待中的问题？正在生成的问题不会被强制中断。','清空等待队列')))return;var r=await api('/tasks/clear','POST',{groupId:currentGroup});toast(r.message||'完成');loadTasks()};$('reloadProposals').onclick=loadProposals;
$('createProposal').onclick=async function(){var r=await api('/ops/action','POST',{action:$('opAction').value,qq:$('opQq').value,duration:$('opDuration').value});$('opMessage').textContent=r.message;toast(r.message);if(r.ok)loadProposals()};
$('runSimulator').onclick=async function(){var r=await api('/simulator','POST',{text:$('simText').value,senderRole:$('simRole').value,mentionsBot:$('simMention').checked,hasImage:$('simImage').checked,currentlyBusy:$('simBusy').checked});if(!r.ok){toast(r.message);return}$('simDecision').textContent=r.decisions.final;$('simSteps').innerHTML=(r.steps||[]).map(function(x){return'<div class="step"><i></i><span>'+esc(x)+'</span></div>'}).join('')};$('reloadModels').onclick=loadModels;$('saveQuota').onclick=async function(){var r=await api('/root/quotas','POST',{globalDailyCny:$('globalQuota').value,groupDailyCny:$('groupQuota').value});toast(r.message);if(r.ok)loadQuota()};
$('saveGroup').onclick=async function(){ensureGroupSettingsExtras();var payload={ai_on:$('groupAi').checked,memory_on:$('groupMemory').checked,active_speaking:$('activeSpeaking').checked,interject_rate:$('interjectRate').value,persona:$('groupPersona').value,keywords:$('groupKeywords').value};var perms=(session&&session.permissions)||{};if(perms.aiAdmin||perms.developer)payload.join_assist_enabled=$('joinAssistEnabled').checked;if(session&&session.role==='owner')payload.rule_monitor_enabled=$('ruleMonitorEnabled').checked;if(session&&(session.role==='owner'||perms.developer)){payload.welcome_enabled=$('welcomeEnabled').checked;payload.welcome_text=$('welcomeText').value;payload.moderation_target_cooldown_seconds=$('moderationCooldown').value;payload.newcomer_observation_days=$('newcomerDays').value}var r=await api('/admin/state','POST',payload);toast(r.message)};$('reloadMemory').onclick=loadMemory;$('addMemory').onclick=async function(){var r=await api('/memories','POST',{scope:$('memoryScope').value,text:$('memoryText').value});toast(r.message||'已新增');if(r.ok){$('memoryText').value='';loadMemory()}};$('reloadLogs').onclick=loadLogs;
boot();
})();
</script>
</body></html>`;
}

export class OneBotHub {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.activeSocket = null;
    this.connectedAt = null;
    this.lastHeartbeatAt = null;
    this.pending = new Map();
    this.eventTasks = new Set();
    this.toolInFlight = new Map();
    this.toolCounts = new Map();
    this.userInFlight = new Map();
    this.userQueues = new Map();
    this.queueReady = Promise.resolve();
    if (state?.storage && typeof state.blockConcurrencyWhile === "function") {
      this.queueReady = state.blockConcurrencyWhile(async () => {
        const saved = await state.storage.list({ prefix: "userqueue:" });
        for (const [storageKey, value] of saved) {
          const key = String(storageKey).slice("userqueue:".length);
          const queue = Array.isArray(value) ? value.filter(item => Date.now() - Number(item?.enqueuedAt || 0) <= DEFAULTS.userQueueTtlMs) : [];
          if (queue.length) this.userQueues.set(key, queue);
          else await state.storage.delete(storageKey);
        }
      });
    }
  }

  async fetch(request) {
    await this.queueReady;
    const url = new URL(request.url);
    const upgrade = request.headers.get("Upgrade");
    if (upgrade && upgrade.toLowerCase() === "websocket") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      server.accept();
      if (this.activeSocket && this.activeSocket.readyState === WebSocket.OPEN) { try { this.activeSocket.close(4001, "replaced by newer NapCat connection"); } catch {} }
      this.activeSocket = server; this.connectedAt = Date.now(); this.lastHeartbeatAt = Date.now();
      server.addEventListener("message", event => {
        // 不把长任务 Promise 直接回传给 WebSocket 事件；让后续 NapCat 事件与 RPC 回包可继续进入。
        const task = this.handleMessage(server, request, event).catch(error => console.error("OneBotHub handler failed", error));
        this.eventTasks.add(task);
        task.finally(() => this.eventTasks.delete(task));
      });
      server.addEventListener("close", () => { if (this.activeSocket === server) this.activeSocket = null; this.rejectAll("NapCat disconnected"); });
      server.addEventListener("error", () => { if (this.activeSocket === server) this.activeSocket = null; this.rejectAll("NapCat socket error"); });
      for (const key of this.userQueues.keys()) {
        if (this.userInFlight.has(key)) continue;
        const task = this.drainUserQueue(key).catch(error => console.error("restore queued questions failed", error));
        this.eventTasks.add(task);
        task.finally(() => this.eventTasks.delete(task));
      }
      return new Response(null, { status: 101, webSocket: client });
    }

    if (request.method === "POST" && ["/rpc", "/send"].includes(url.pathname)) {
      const payload = await request.json().catch(() => null);
      if (!payload?.action) return Response.json({ ok: false, sent: false, error: "invalid_payload" }, { status: 400 });
      try {
        const response = await this.sendAction(payload, Number(payload.timeoutMs || 15000));
        const ok = response?.status === "ok" || response?.retcode === 0;
        return Response.json({ ok, sent: true, data: response?.data ?? null, response, error: ok ? null : response?.message || `retcode:${response?.retcode}` }, { status: ok ? 200 : 502 });
      } catch (error) {
        return Response.json({ ok: false, sent: false, error: String(error.message || error) }, { status: 503 });
      }
    }

    if (request.method === "POST" && url.pathname === "/moderation/expiry") {
      const data = await request.json().catch(() => ({}));
      const proposalId = String(data.proposalId || "");
      const expiresAt = Number(data.expiresAt || 0);
      if (!proposalId || !expiresAt) return Response.json({ ok: false, message: "invalid expiry payload" }, { status: 400 });
      await this.state.storage.put(`moderation-expiry:${proposalId}`, { proposalId, expiresAt });
      const currentAlarm = await this.state.storage.getAlarm();
      if (!currentAlarm || expiresAt < currentAlarm) await this.state.storage.setAlarm(expiresAt);
      return Response.json({ ok: true, proposalId, expiresAt });
    }

    if (url.pathname === "/status") return Response.json({
      sockets: this.activeSocket?.readyState === WebSocket.OPEN ? 1 : 0,
      connected: this.activeSocket?.readyState === WebSocket.OPEN,
      connectedAt: this.connectedAt,
      lastHeartbeatAt: this.lastHeartbeatAt,
      pendingRpc: this.pending.size,
      inFlightQuestions: this.userInFlight.size,
      queuedQuestions: [...this.userQueues.values()].reduce((sum, list) => sum + list.length, 0),
      queues: this.queueSnapshot()
    });
    if (request.method === "POST" && url.pathname === "/queue/cancel") {
      const data = await request.json().catch(() => ({}));
      const key = `group:${String(data.groupId || "")}:user:${String(data.userId || "")}`;
      const queue = this.userQueues.get(key) || [];
      const messageId = String(data.messageId || "");
      const next = messageId ? queue.filter(item => String(item.body?.message_id || "") !== messageId) : [];
      if (next.length) this.userQueues.set(key, next); else this.userQueues.delete(key);
      await this.persistUserQueue(key);
      return Response.json({ ok: true, removed: queue.length - next.length, remaining: next.length, message: `已移除 ${queue.length - next.length} 条等待中的问题。` });
    }
    if (request.method === "POST" && url.pathname === "/queue/clear") {
      const data = await request.json().catch(() => ({}));
      const groupId = String(data.groupId || "");
      let removed = 0;
      const clearedKeys = [];
      for (const [key, queue] of this.userQueues) {
        if (!groupId || key.startsWith(`group:${groupId}:`)) { removed += queue.length; this.userQueues.delete(key); clearedKeys.push(key); }
      }
      await Promise.all(clearedKeys.map(key => this.persistUserQueue(key)));
      return Response.json({ ok: true, removed, message: `已清除 ${removed} 条等待中的问题。` });
    }
    return new Response("OneBotHub OK", { status: 200 });
  }

  async alarm() {
    const now = Date.now();
    const rows = await this.state.storage.list({ prefix: "moderation-expiry:" });
    let nextAlarm = 0;
    for (const [storageKey, item] of rows) {
      const expiresAt = Number(item?.expiresAt || 0);
      if (expiresAt > now) {
        nextAlarm = nextAlarm ? Math.min(nextAlarm, expiresAt) : expiresAt;
        continue;
      }
      const proposalId = String(item?.proposalId || storageKey.slice("moderation-expiry:".length));
      const proposal = await readJson(this.env, `moderation:proposal:${proposalId}`, null);
      if (proposal?.status === "pending") {
        proposal.status = "expired";
        proposal.expiredAt = now;
        if (proposal.notificationMessageId && !proposal.notificationRetractedAt) {
          try {
            await this.sendAction({ action: "delete_msg", params: { message_id: numericId(proposal.notificationMessageId) } }, 10000);
            proposal.notificationRetractedAt = now;
            proposal.notificationRetractReason = "expired";
            proposal.notificationRetractStatus = "success";
          } catch (error) {
            proposal.notificationRetractStatus = "failed";
            proposal.notificationRetractError = String(error?.message || error);
          }
        }
        await dbPut(this.env, `moderation:proposal:${proposalId}`, JSON.stringify(proposal));
      }
      await this.state.storage.delete(storageKey);
    }
    if (nextAlarm) await this.state.storage.setAlarm(nextAlarm);
  }

  rejectAll(reason) {
    for (const [, p] of this.pending) { clearTimeout(p.timer); p.reject(new Error(reason)); }
    this.pending.clear();
  }

  async sendAction(payload, timeoutMs = 15000) {
    const socket = this.activeSocket;
    if (!socket || socket.readyState !== WebSocket.OPEN) throw new Error("NAPCAT_NOT_CONNECTED");
    const echo = String(payload.echo || `qqai:rpc:${Date.now()}:${crypto.randomUUID()}`);
    const action = { action: payload.action, params: payload.params || {}, echo };
    if (["send_group_msg", "send_private_msg", "send_msg"].includes(action.action)) {
      const isGroup = action.action === "send_group_msg" || action.params.message_type === "group";
      await markOutboundPending(this.env, { isGroup, groupId: isGroup ? String(action.params.group_id || "") : "", peerId: isGroup ? "" : String(action.params.user_id || ""), text: extractMessageText(action.params.message), mediaTypes: extractOutboundMediaTypes(action.params.message) });
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(echo); reject(new Error("ONEBOT_RPC_TIMEOUT")); }, Math.max(1000, Math.min(timeoutMs, 30000)));
      this.pending.set(echo, { resolve, reject, timer, action });
      try { socket.send(JSON.stringify(action)); } catch (error) { clearTimeout(timer); this.pending.delete(echo); reject(error); }
    });
  }

  async handleMessage(socket, request, event) {
    let body;
    try { body = JSON.parse(typeof event.data === "string" ? event.data : new TextDecoder().decode(event.data)); } catch { return; }
    this.lastHeartbeatAt = Date.now();
    if (body?.echo && this.pending.has(String(body.echo))) {
      const pending = this.pending.get(String(body.echo)); this.pending.delete(String(body.echo)); clearTimeout(pending.timer);
      const messageId = body?.data?.message_id ?? body?.data?.messageId;
      if (messageId && ["send_group_msg", "send_private_msg", "send_msg"].includes(pending.action.action)) {
        await dbPut(this.env, `outbound:${messageId}`, JSON.stringify({ at: Date.now(), action: pending.action.action }));
      }
      pending.resolve(body); return;
    }
    if (!body || body.post_type === "meta_event") return;

    if (await this.shouldQueueUserQuestion(body)) {
      await this.enqueueUserQuestion(body, request.url);
      return;
    }
    await this.processInboundEvent(body, request.url);
  }

  shouldQueueUserQuestion(body) {
    if (!body || body.post_type !== "message" || body.message_type !== "group") return false;
    if (String(body.user_id || "") === String(body.self_id || "")) return false;
    const selfId = String(body.self_id || "");
    let mentioned = false;
    let text = "";
    if (Array.isArray(body.message)) {
      mentioned = body.message.some(part => part?.type === "at" && String(part?.data?.qq || "") === selfId);
      text = body.message.filter(part => part?.type === "text").map(part => part?.data?.text || "").join("").trim();
    } else {
      const raw = String(body.raw_message || body.message || "");
      mentioned = Boolean(selfId && raw.includes(`[CQ:at,qq=${selfId}]`));
      text = raw.replace(/\[CQ:[^\]]+\]/g, " ").trim();
    }
    if (!mentioned || !text || /^[!！]/.test(text)) return false;
    const role = String(body.sender?.role || "member");
    if (["owner", "admin"].includes(role) && /(?:踢|移出|请出|請出|杀了|殺了|斩了|斬了|禁言|闭麦|閉麥|全员禁言|全員禁言|管理员|管理員)/i.test(text)) return false;
    if (["owner", "admin"].includes(role) && /^(?:确认|确认|同意执行|同意執行|执行|執行|取消操作|取消执行|取消執行|取消)(?:\s+[a-z0-9_-]+)?$/i.test(text)) return false;
    return true;
  }

  userQueueKey(body) {
    return `group:${String(body.group_id || "")}:user:${String(body.user_id || "")}`;
  }

  queueSnapshot() {
    const rows = [];
    for (const [key, active] of this.userInFlight) {
      const queue = this.userQueues.get(key) || [];
      rows.push({ key, groupId: active.groupId, userId: active.userId, startedAt: active.startedAt, messageId: active.messageId, preview: active.preview, queued: queue.map(item => ({ messageId: String(item.body?.message_id || ""), enqueuedAt: item.enqueuedAt, preview: item.preview })) });
    }
    for (const [key, queue] of this.userQueues) {
      if (this.userInFlight.has(key)) continue;
      const [groupId, userId] = [key.match(/group:([^:]+)/)?.[1] || "", key.match(/user:([^:]+)/)?.[1] || ""];
      rows.push({ key, groupId, userId, startedAt: null, messageId: "", preview: "", queued: queue.map(item => ({ messageId: String(item.body?.message_id || ""), enqueuedAt: item.enqueuedAt, preview: item.preview })) });
    }
    return rows;
  }

  async persistUserQueue(key) {
    if (!this.state?.storage) return;
    const queue = this.userQueues.get(key) || [];
    const storageKey = `userqueue:${key}`;
    if (queue.length) await this.state.storage.put(storageKey, queue);
    else await this.state.storage.delete(storageKey);
  }

  eventPreview(body) {
    return extractMessageText(body?.message || body?.raw_message || "").replace(/\s+/g, " ").trim().slice(0, 120);
  }

  async enqueueUserQuestion(body, requestUrl) {
    const key = this.userQueueKey(body);
    const queue = this.userQueues.get(key) || [];
    if (this.userInFlight.has(key)) {
      if (queue.length >= DEFAULTS.userQueueMax) {
        await this.sendQueueNotice(body, `等待列已满（最多 ${DEFAULTS.userQueueMax} 条），请等前面的回答完成后再问。`).catch(() => {});
        return;
      }
      const entry = { body, requestUrl, enqueuedAt: Date.now(), preview: this.eventPreview(body) };
      queue.push(entry);
      this.userQueues.set(key, queue);
      await this.persistUserQueue(key);
      await this.sendQueueNotice(body, `你前一个问题仍在处理，这条已加入等待列，目前排第 ${queue.length} 位。`).catch(() => {});
      return;
    }
    this.userInFlight.set(key, { groupId: String(body.group_id || ""), userId: String(body.user_id || ""), messageId: String(body.message_id || ""), preview: this.eventPreview(body), startedAt: Date.now() });
    try {
      await this.processInboundEvent(body, requestUrl);
    } finally {
      this.userInFlight.delete(key);
      await this.drainUserQueue(key);
    }
  }

  async drainUserQueue(key) {
    const queue = this.userQueues.get(key) || [];
    while (queue.length) {
      const entry = queue.shift();
      if (queue.length) this.userQueues.set(key, queue); else this.userQueues.delete(key);
      await this.persistUserQueue(key);
      if (!entry || Date.now() - Number(entry.enqueuedAt || 0) > DEFAULTS.userQueueTtlMs) continue;
      const body = { ...entry.body, __qqai_queued: true };
      this.userInFlight.set(key, { groupId: String(body.group_id || ""), userId: String(body.user_id || ""), messageId: String(body.message_id || ""), preview: entry.preview, startedAt: Date.now() });
      try {
        await this.processInboundEvent(body, entry.requestUrl);
      } catch (error) {
        console.error("queued user question failed", error);
        await this.sendQueueNotice(body, "排队的问题处理失败，已跳到下一条。请稍后重试。").catch(() => {});
      } finally {
        this.userInFlight.delete(key);
      }
    }
  }

  async sendQueueNotice(body, text) {
    const message = [
      ...(body.message_id !== undefined && body.message_id !== null ? [{ type: "reply", data: { id: String(body.message_id) } }] : []),
      { type: "at", data: { qq: String(body.user_id || "") } },
      { type: "text", data: { text: ` ${String(text)}` } }
    ];
    await this.sendAction({ action: "send_group_msg", params: { group_id: body.group_id, message, auto_escape: false } }, 10000);
  }

  async processInboundEvent(body, requestUrl) {
    const toolTask = this.classifyToolTask(body);
    const lease = toolTask ? this.acquireToolLease(body, toolTask) : { ok: true, key: "", token: "", type: "" };
    if (!lease.ok) {
      await this.sendToolBusyNotice(body, toolTask, lease.reason).catch(error => console.error("send tool busy notice failed", error));
      return;
    }

    let payload = null;
    let action = body.message_type === "private" ? "send_private_msg" : "send_group_msg";
    try {
      const sourceUrl = new URL(requestUrl);
      const internalTimeoutMs = toolTask ? 82000 : 65000;
      let internalResponse;
      try {
        internalResponse = await fetch(`${sourceUrl.protocol}//${sourceUrl.host}/__onebot_event`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-QQAI-Transport": "websocket-do",
            "Authorization": `Bearer ${String(this.env.ONEBOT_ACCESS_TOKEN || "")}`
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(internalTimeoutMs)
        });
      } catch (error) {
        console.error("OneBot internal event processing failed", error);
        const timedOut = /abort|timeout/i.test(String(error?.message || error));
        if (toolTask && timedOut) {
          await this.sendDirectText(body, `⏱️ ${toolTask.label}处理超过时限，任务已自动结束；机器人不会继续被占用。`).catch(() => {});
        } else if (timedOut && await this.shouldQueueUserQuestion(body)) {
          await this.sendQueueNotice(body, "这次回答处理超时，任务已释放，请稍后再试。").catch(() => {});
        }
        return;
      }
      if (!internalResponse || internalResponse.status === 204) return;
      payload = await internalResponse.json().catch(() => null);
      if (!payload?.reply) return;
      const plan = payload.reply_plan || {};
      const isPrivate = body.message_type === "private";
      const message = isPrivate ? String(payload.reply) : this.buildSegments(body, plan, payload.reply);
      action = isPrivate ? "send_private_msg" : "send_group_msg";
      const params = isPrivate ? { user_id: body.user_id, message, auto_escape: false } : { group_id: body.group_id, message, auto_escape: false };
      try {
        const response = await this.sendAction({ action, params }, 15000);
        const messageId = response?.data?.message_id;
        if (messageId && payload.moderation_proposal_id) {
          await attachModerationProposalMessage(this.env, String(payload.moderation_proposal_id), String(messageId), String(body.group_id || ""));
        }
        // 只有真正的 AI 对话回覆才写入 message cache／recent_logs。
        if (payload.ai_log_id) await updateAiDecisionLog(this.env, payload.ai_log_id, { sendStatus: "sent", sentMessageId: String(messageId || ""), sentAt: Date.now() });
        if (messageId && payload.record_reply === true) {
          await recordStructuredMessage(this.env, {
            messageId: String(messageId), groupId: String(body.group_id || ""), senderId: String(body.self_id || ""), senderName: "QQAI",
            text: extractMessageText(message), mentions: plan.mentionIds || [], replyId: plan.quoteMessageId || plan.replyId || "", media: [],
            source: "ai", createdAt: Date.now()
          });
        }
      } catch (error) {
        console.error("send reply failed", error);
        if (payload?.ai_log_id) await updateAiDecisionLog(this.env, payload.ai_log_id, { sendStatus: "failed", sendError: String(error?.message || error), sendFailedAt: Date.now() }).catch(() => null);
      } finally {
        if (payload.thinking_message_id) {
          try { await this.sendAction({ action: "delete_msg", params: { message_id: numericId(payload.thinking_message_id) } }, 8000); } catch {}
        }
      }
    } finally {
      if (toolTask) this.releaseToolLease(lease);
    }
  }

  classifyToolTask(body) {
    if (!body || !["message", "message_sent"].includes(body.post_type)) return null;
    const text = extractMessageText(body.message || body.raw_message || "")
      .replace(/@\d{5,}\s*/g, "")
      .trim();
    const definitions = [
      { type: "tts", label: "语音生成", limit: 2, pattern: /^[!！](?:语音|語音|speak|tts)(?:\s|$)/i },
      { type: "web", label: "网页分析", limit: 3, pattern: /^[!！](?:读网页|讀網頁)(?:\s|$)/i }
    ];
    return definitions.find(item => item.pattern.test(text)) || null;
  }

  acquireToolLease(body, toolTask) {
    const scope = body.message_type === "group"
      ? `group:${String(body.group_id || "")}`
      : `private:${String(body.user_id || "")}`;
    const key = `${scope}:${toolTask.type}`;
    if (this.toolInFlight.has(key)) return { ok: false, reason: "same_scope", key, type: toolTask.type };
    const count = Number(this.toolCounts.get(toolTask.type) || 0);
    if (count >= toolTask.limit) return { ok: false, reason: "global_limit", key, type: toolTask.type };
    const token = crypto.randomUUID();
    this.toolInFlight.set(key, token);
    this.toolCounts.set(toolTask.type, count + 1);
    return { ok: true, key, token, type: toolTask.type };
  }

  releaseToolLease(lease) {
    if (!lease?.ok || !lease.key) return;
    if (this.toolInFlight.get(lease.key) === lease.token) this.toolInFlight.delete(lease.key);
    const count = Math.max(0, Number(this.toolCounts.get(lease.type) || 0) - 1);
    if (count) this.toolCounts.set(lease.type, count);
    else this.toolCounts.delete(lease.type);
  }

  async sendDirectText(body, text) {
    const isPrivate = body.message_type === "private";
    const action = isPrivate ? "send_private_msg" : "send_group_msg";
    const params = isPrivate
      ? { user_id: body.user_id, message: String(text), auto_escape: false }
      : { group_id: body.group_id, message: String(text), auto_escape: false };
    await this.sendAction({ action, params }, 10000);
  }

  async sendToolBusyNotice(body, toolTask, reason) {
    const text = reason === "same_scope"
      ? `⏳ 本聊天已有一个${toolTask.label}任务正在处理，这次重复指令未加入队列；普通 AI 对话仍可继续使用。`
      : `⏳ 目前${toolTask.label}工作槽已满，请稍后再试；普通 AI 对话不受影响。`;
    await this.sendDirectText(body, text);
  }

  parseCqSegments(value) {
    const input = String(value || "");
    const segments = [];
    const re = /\[CQ:(at|reply|image|record|video|face),([^\]]+)\]/g;
    let last = 0, match;
    const parseData = raw => Object.fromEntries(String(raw).split(",").map(part => { const i = part.indexOf("="); return i < 0 ? [part, ""] : [part.slice(0, i), part.slice(i + 1)]; }));
    while ((match = re.exec(input))) {
      if (match.index > last) segments.push({ type: "text", data: { text: input.slice(last, match.index) } });
      const data = parseData(match[2]);
      if (match[1] === "at" && data.qq) segments.push({ type: "at", data: { qq: String(data.qq) } });
      else if (match[1] === "reply" && (data.id || data.message_id)) segments.push({ type: "reply", data: { id: String(data.id || data.message_id) } });
      else if (["image", "record", "video", "face"].includes(match[1])) segments.push({ type: match[1], data });
      last = re.lastIndex;
    }
    if (last < input.length) segments.push({ type: "text", data: { text: input.slice(last) } });
    return segments.length ? segments : [{ type: "text", data: { text: input } }];
  }

  buildSegments(eventBody, plan, text) {
    const segments = [];
    const quoteId = plan.quoteMessageId || plan.replyId;
    if (quoteId) segments.push({ type: "reply", data: { id: String(quoteId) } });
    const mentions = [...new Set((plan.mentionIds || []).map(String).filter(id => id && id !== String(eventBody.self_id || "")))];
    for (const id of mentions) { segments.push({ type: "at", data: { qq: id } }); segments.push({ type: "text", data: { text: " " } }); }
    segments.push(...this.parseCqSegments(text));
    return segments;
  }
}
