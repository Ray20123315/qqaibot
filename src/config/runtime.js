// Extracted from worker.js without behavioral changes.
// Cloudflare still deploys worker.js as the single Worker entry point.



const VERSION = "2.7.3";


const BUILD_DATE = "2026-07-26";


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
  inputDebounceMs: 1200,
  inputDebounceMaxMs: 3500,
  scheduleMinIntervalMinutes: 1,
  scheduleMaxActivePerUser: 0,
  scheduleMaxPerGroupHour: 0,
  appealEnabled: true,
  appealFormerMemberDays: 30,
  ruleStrikeWindowDays: 7,
  ruleProgressiveFirstMuteSeconds: 60,
  ruleProgressiveSecondMuteSeconds: 600,
  userQueueMax: 5,
  userQueueTtlMs: 10 * 60 * 1000,
  queueRecoveryAlarmMs: 30 * 1000,
  queueRecoveryBatchSize: 5,
  autoCheckinRetryIntervalMs: 1000,
  autoCheckinConcurrency: 12,
  moderationProposalTtlMs: 2 * 60 * 1000,
  modelCostPolicy: "free_first",
  deepseekEmergencyFallback: false,
  paidContextSummary: false,
  portalSessionTtlMs: 30 * 24 * 60 * 60 * 1000,
  portalSessionAbsoluteTtlMs: 180 * 24 * 60 * 60 * 1000,
  portalSessionCookieSeconds: 180 * 24 * 60 * 60,
  portalSessionTemporaryTtlMs: 12 * 60 * 60 * 1000,
  portalSessionTemporaryAbsoluteTtlMs: 24 * 60 * 60 * 1000,
  moderationTargetCooldownSeconds: 0,
  newcomerObservationDays: 0,
  autoCheckinTime: "00:00",
  welcomeText: "欢迎 {at} 加入本群 🎉 请先阅读群规，有问题可以询问管理员。",
  ruleMonitorEnabled: true,
  ruleProxyMode: "record",
  ruleProxyMuteSeconds: 600,
  ruleStrictness: "medium",
  runtimeRateLimitSeconds: 0,
  joinPatternAutoApproveThreshold: 2,
  joinAiApproveConfidence: 0.90,
  ruleSpamWindowSeconds: 60,
  ruleSpamThreshold: 4,
  ruleSpamKeepCount: 3,
  ruleMuteGuardEnabled: true,
  operationsRetentionDays: 90,
  operationsQuietStart: "23:00",
  operationsQuietEnd: "08:00",
  operationsInviteCooldownSeconds: 30,
  operationsFuseFailureThreshold: 5,
  ingredientAnalysisMinimumMessages: 8,
  ingredientAnalysisMaximumMessages: 30,
  deepseekEmergencyFailureThreshold: 3,
  deepseekEmergencyFailureWindowMs: 15 * 60 * 1000,
  deepseekEmergencyAccessWindowMs: 10 * 60 * 1000,
});



const EXPLICIT_REPLY_FAILURE_MESSAGES = Object.freeze({
  worker_error: "内部执行异常，任务已释放。请到 Portal 的‘系统维护’查看诊断记录。",
  worker_http_error: "内部处理接口返回非成功状态，任务已结束。请到 Portal 的‘系统维护’查看诊断记录。",
  worker_timeout: "处理链路响应超时，任务已释放；不会继续占用。请稍后重试。",
  worker_empty_reply: "模型或处理链没有返回有效内容，任务已结束。请重新 @我。",
  worker_no_reply: "这次处理没有产生回复，任务已结束。开发者可在 Portal 的‘系统维护’查看触发原因。",
  send_failed: "回答已经生成，但 NapCat／OneBot 的 WebSocket 与 HTTP 备用发送都失败。请检查连接、Token 与群发送权限。",
  uncaught_error: "本次处理发生未预期错误，任务已释放。请到 Portal 查看最新错误记录后重试。"
});



function classifyOperationalFailure(errorLike, options = {}) {
  const status = Number(options.status || 0);
  const disposition = String(options.disposition || "");
  const source = [
    String(errorLike?.message || errorLike || ""),
    String(options.preview || ""),
    String(options.code || ""),
    String(status || "")
  ].join(" ");
  const lower = source.toLowerCase();
  let code = "INTERNAL_EXECUTION_ERROR";
  let userText = EXPLICIT_REPLY_FAILURE_MESSAGES[disposition] || EXPLICIT_REPLY_FAILURE_MESSAGES.uncaught_error;
  if (/api_keys?_missing|未配置.{0,20}(?:api|模型).{0,10}(?:key|金钥|密钥)|missing.{0,20}(?:api.?key|credential)/i.test(source)) {
    code = "MODEL_CREDENTIALS_MISSING";
    userText = "模型配置缺失：当前没有可用的 API Key，任务已停止。管理员请检查 Portal 的模型中心。";
  } else if (status === 429 || /resource_exhausted|rate.?limit|too many requests|quota|额度不足|配额/i.test(source)) {
    code = "MODEL_RATE_LIMITED";
    userText = "模型服务触发限流或额度不足，当前请求已结束。请稍后重试；管理员可在 Portal 查看具体提供者。";
  } else if (/abort|timeout|timed out|deadline|超时|超过时限/i.test(source) || disposition === "worker_timeout") {
    code = "PROCESSING_TIMEOUT";
    userText = "模型或内部处理响应超时，任务已释放，不会继续占用。请稍后重试。";
  } else if (/d1|database|sqlite|sql_|sql error|资料库|数据库|db_get|db_put/i.test(source)) {
    code = "DATABASE_ERROR";
    userText = "资料库读写异常，系统无法安全完成这次处理，任务已停止。管理员请检查 Portal 的 D1 状态。";
  } else if (/napcat|onebot|websocket|no active websocket|rpc.*(?:fail|error)|send_(?:group|private)_msg/i.test(source) || disposition === "send_failed") {
    code = "NAPCAT_CONNECTION_ERROR";
    userText = disposition === "send_failed"
      ? EXPLICIT_REPLY_FAILURE_MESSAGES.send_failed
      : "NapCat／OneBot 连接异常，系统无法完成消息收发。请检查 WebSocket、Access Token 与机器人在线状态。";
  } else if (/gemini|gemma|deepseek|workers.?ai|model|generatecontent/i.test(source)) {
    code = "MODEL_PROVIDER_ERROR";
    userText = "模型服务当前不可用，且后备模型也未成功完成回答。请稍后重试；具体提供者错误只记录在 Portal。";
  } else if ([401, 403].includes(status) || /unauthorized|forbidden|鉴权|权限验证失败/i.test(source)) {
    code = "INTERNAL_AUTH_ERROR";
    userText = "内部鉴权或权限配置异常，系统已拒绝继续处理。管理员请检查 Worker 与 Durable Object 配置。";
  } else if (disposition === "worker_empty_reply") {
    code = "EMPTY_MODEL_REPLY";
    userText = EXPLICIT_REPLY_FAILURE_MESSAGES.worker_empty_reply;
  } else if ([502, 503, 504].includes(status)) {
    code = "UPSTREAM_UNAVAILABLE";
    userText = "上游服务暂时不可用，系统已结束本次任务。请稍后重试；具体上游与状态记录在 Portal。";
  } else if (status >= 500) {
    code = "INTERNAL_HTTP_ERROR";
    userText = "内部处理接口发生服务器错误，任务已结束。管理员可在 Portal 查看对应诊断记录。";
  }
  const failureId = String(options.failureId || "").trim();
  if (failureId) userText += `
诊断编号：${failureId}`;
  return { code, userText, raw: source.slice(0, 1000), lower };
}



const AFFINITY_DEFAULTS = Object.freeze({
  fixedBase: 50,
  fixedMin: 0,
  fixedMax: 85,
  aiMin: -15,
  aiMax: 15,
  aiRefreshMs: 6 * 60 * 60 * 1000,
  dailyPositiveCap: 3,
  dailyNegativeCap: 6,
  manualCheckCooldownMs: 20 * 1000,
  manualCheckHourlyLimit: 8
});



const AI_MEDIA_LIMITS = Object.freeze({
  imageBytes: 8 * 1024 * 1024,
  audioBytes: 12 * 1024 * 1024,
  videoBytes: 25 * 1024 * 1024,
  forwardBundles: 3,
  forwardNodes: 80,
  forwardTextChars: 40000,
  conversationRecords: 10000,
  mentionBatchSize: 30,
  mentionMaxRecipients: 300
});



const PLATFORM_FEATURE_COUNT = 300;


const PLATFORM_FEATURE_NAMES = Object.freeze([
  "群規持續監控",
  "違規紀錄獨立頁面",
  "依群員搜索違規",
  "依訊息內容搜索違規",
  "依 AI 違規分類搜索",
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
  "群文件搜索",
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
  "搜索任務使用獨立併發槽",
  "DeepSeek Pro 有較低全站併發",
  "取消",
  "暫停",
  "重試",
  "改用其他模型重試",
  "查看原始錯誤",
  "查看目前處理階段",
  "查看工具呼叫",
  "查看 Token",
  "查看搜索來源",
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
  "搜索知識快取",
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
  "搜索結果不直接當永久事實",
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
  "搜索使用率",
  "搜索平均來源數",
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
  "搜索結果只能作為資料，不能變更系統規則",
  "QQ 号遮罩",
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
  "可選是否顯示搜索狀態",
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
  "搜索中心",
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
  "全域搜索",
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

export { AFFINITY_DEFAULTS, AI_MEDIA_LIMITS, BUILD_DATE, DEFAULTS, DEFAULT_DEVELOPER_ID, EXPLICIT_REPLY_FAILURE_MESSAGES, PLATFORM_FEATURES, PLATFORM_FEATURE_COUNT, PLATFORM_FEATURE_NAMES, VERSION, classifyOperationalFailure };
