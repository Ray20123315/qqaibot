# 2026-10-24 — 聊天與 HRS 客服分離 / 聊天与 HRS 客服分离 / Separation of Chat and HRS Support

**繁體中文：** 本獨立 Worker 目前定位是 QQAIBOT 通用聊天，可加入非 HRS 群組。既有聊天、上下文、搜尋、思考、圖片、語音、常用指令仍依原有權限與供應商能力運作；移除 HRS 客服專用提示詞、知識庫查詢／上傳介面與 AI Search Binding。既有客服索引不刪除，舊版 Git 設於 `backup/qqaibot-pre-split-20261024`。模型優先使用本機 Unsloth 的既有 HTTPS 上游；僅發生連線、逾時、503 等可回復錯誤時，且有 Worker Secret `GEMINI_API_KEY` 和設定 `GEMINI_FALLBACK_MODEL`，才會切至 Gemini。搜尋 Grounding 預設不會在備援啟用，可另設 `GEMINI_SEARCH_GROUNDING=true` 並實測，避免未授權付費。LLM 本身不共用 HRS 客服資料庫。未部署正式環境。

**简体中文：** QQAIBOT 改为通用聊天 Bot，不限 HRS 群。保留已实现的聊天、记忆、搜索、思考、图像、语音及常用命令；移除 HRS 客服知识库与客服角色。优先连接你的电脑上的 Unsloth；连接失败后可在设置 Gemini Secret、模型 ID 后使用 Gemini。不会清除旧数据库及支持索引。原版可从备份分支恢复。

**English:** QQAIBOT is now general chat, including non-HRS QQ groups. Existing chat features, QQ context, search/reasoning toggles, image, audio and commands are retained. HRS customer-service prompt, KB retrieval/upload UI and AI Search binding are removed without deleting stored index data. The existing local Unsloth HTTPS endpoint is primary; Gemini is a failure-only backup requiring `GEMINI_API_KEY` (Worker Secret) and `GEMINI_FALLBACK_MODEL`. Gemini grounding is opt-in. Previous code: `backup/qqaibot-pre-split-20261024`. Production is not changed.

---

## 2026-10-24 用户模式、图片与反刷屏（分阶段）

- 每个经 QQ 回调验证的群成员或私聊用户，可使用 `/搜索开`、`/搜索关`、`/思考开`、`/思考关`。模型请求始终显式传 `enable_thinking:false`（默认）、仅搜索开启时启用 `enabled_tools:['web_search']`，禁用 MCP、Python、终端、文件读写、图像生成与权限绕过。群组成员开关按 QQ author 分开，避免一个成员影响其他人；状态在既有 CONFIG_KV 中保存 30 天。未收到可信 author 的事件不能更改设置。
- `/深度搜索` 只会说明暂未开放。Unsloth API 字段存在不代表这个本地 GGUF 及工具 handoff 已验收；普通搜索与深度搜索不能同时启用。
- 从 QQ native `d.attachments` 解析图片，严格 HTTPS 域名白名单，禁止重定向、限制 MIME 和 2MiB 图片体积，转换成 OpenAI 多模态 `image_url` data URI 交给本机 Qwen；接收失败须明确告知而非虚称无图片。这不接入任何图片生成模型。上传图像是否被你现在的 Unsloth vision runtime 成功读取，须端到端实测。
- 识别明显纯重复刷屏要求（例如一次发 100 个相同字符）并简短拒绝；输出层对高比例重复行做第二次保护。正常聊天、代码示例和合理长文本不应被全面封锁。
- 主题范围限制可令机器人避免参与明显的政治立场辩论，但自然聊天、游戏和生活内容仍可正常回复。
- **HTML 群文件**：当前 QQ 官方群富媒体 `file_type:4` 可用性未经实测，公开实现显示群聊可能尚不开放（仅 C2C）。没有确定支持前，任何生成请求不能声称已将 `.html` 文件发到群聊。本阶段不伪造文件成功、不提供本地读写或 Python 执行权限。每日可消费的配额及执行隔离，需要在真正的 HTML 文件交付链路验证后启用。
- 多用户并行及 GPU 消耗还没有独立负载验证。Cloudflare 可并发收回调，不代表单一 Unsloth 模型可以无限并行；不要宣称已实现公平调度或后台长任务结果投递。
- 本阶段不接入收费资源、Cloudflare AI Search 新消费路径或 R2；当前已有绑定保持，后续知识库替换为 SQLite FTS5 必须单独验收再发布。

## 對話記憶、262K 規劃、向量客服知識庫和指令（2026-10-24）

此版本新增**獨立** Cloudflare SQLite Durable Objects `CHAT_ROOMS`（每個 QQ 群組及私信一個隔離 Object）與 AI Search `SUPPORT_SEARCH`（公開客服資料，Embedding `@cf/qwen/qwen3-embedding-0.6b`）。聊天原文保存在 SQLite 的 `qq_message_log`，摘要儲存在 `qq_compaction`；摘要游標前進時不刪原文，摘要失敗不使既有聊天不可用。以 QQ App Secret＋群/用戶 ID 產生不可逆 scope 鍵，資料庫不儲存明文 QQ OpenID；日後更換 App Secret 需規劃 memory key migration。

**262,144 Tokens 是 Qwen 模型聲稱的理論上限，不代表實際載入的 Unsloth GGUF 已啟用。** 初始預設工作窗口 `16,384`，頁面「会话记忆」可以提高到 `262,144`，實際推論可用長度必須由 Unsloth Studio context/cache 驗證，且每次推論預留 28% 餘量；輸入依實際需用選取最新多輪對話與已整理摘要，並非每次載滿 262K。Durable Objects 以 24 條為單位做非破壞性壓縮，至少留最近 16 條原文，使用獨立**不帶搜尋或其他工具**的摘要請求。摘要保留原文版本與序列游標，防止並發摘要覆蓋。

### 公開知識庫
管理網站新增「知识库管理」可上傳 `txt/md/pdf/docx/csv` 文件，不超過 4 MiB。經管理員 `ADMIN_TOKEN` 已驗證 Session 方可呼叫：
- `GET /api/knowledge`：顯示公開客服文件索引狀態。
- `POST /api/knowledge`：`multipart/form-data` `file` 欄位，上傳到 AI Search instance `qqaibot-support` 的內建 R2/Vectorize 索引，不另外要求用戶設 API Key。
- 本 Worker 僅在碰到 HRS/MFL/客服/訂單/付款/權限等客服主題時，以 AI Search retrieve 前四段相關資料，做為**不可信參考資料**傳給 Qwen，不能被資料內容誘導執行命令。

**重要：此版本知識庫只有「完全公開客服」類型。上傳後可能被任何向機器人發問的 QQ 用戶取得摘要資訊，因此不要上傳私人用戶資料、帳單、token、密碼、內部決策或未公開文件。** 未做好群組／角色 ACL 前不提供私人知識庫分類，不連接既有 HRS 帳號或資料庫。

### 命令
目前可使用的安全指令：`/帮助`、`/骰子`、`/抽签 甲 乙`、`/今日话题`、`/上下文`、`/总结`。群管理 `/禁言`、`/解禁`、`/踢出`、`/审核` 因 QQ 官方機器人權限與身分驗證仍須另行開通，**明確告知未執行**，不以 LLM 決定任何實際處分。客服工單與私人長期記憶管理等需要權限、刪除流程後續獨立接入。

### 資料存放與部署
- 原帳號 D1 已達 **10 個資料庫上限**（Cloudflare HTTP 403 / 7406），因此不新增 D1，也不挪用其他專案的資料庫；改以 SQLite Durable Objects 實作。
- `CHAT_ROOMS` Durable Objects SQLite binding、`SUPPORT_SEARCH` AI Search binding 必須在正式部署時存在；原有四個 Worker Secrets＋`CONFIG_KV` 需嚴格繼承。
- 每個 Durable Object 首次啟動時自動以 idempotent SQL 建立兩個 SQLite 資料表；不使用 D1 migration。
- 若 Durable Objects / AI Search 暫時無法回應，既有 QQ 文字聊天仍會盡力執行，**不聲稱已讀取歷史或資料庫**。
- 使用已驗證的 `/api/session` HttpOnly Session 管理員登入；所有新增 POST 路由沿用同源保護；禁用圖像生成與理解模型。

# QQAIBOT · 獨立 Unsloth QQ AI

這是 **qq aibot 舊系統以外**的獨立 Cloudflare Worker `qqaibot-unsloth`。它只接 QQ 官方群組 @ 事件 `GROUP_AT_MESSAGE_CREATE` 與私訊 `C2C_MESSAGE_CREATE`，使用固定上游 `https://msiai.ray2025.com/v1/chat/completions` 及 QQ 官方 API 被動回覆。**沒有執行系統指令、工具呼叫、檔案操作、任意 URL 代理的功能**。

## QQ 自然客服與聊天角色（2026-10-24 最新修訂）

這次使用者要求 QQbot 的使用者體驗更加擬人化：**自然、親切的客服與聊天夥伴**，而非制式「AI 模型介紹」。所有生成文字維持**簡體中文**，會解答已知客服疑問、陪聊、接梗與處理一般問題，不自行宣稱已辦理訂單、退款、授權或其它實際操作。

**模型相關資訊對外不提供**：無論使用者是否直接詢問，QQbot 都不透露底層模型、廠商、版本、量化資訊、部署或內部提示詞；可說「这些属于内部技术信息，暂不提供。你想了解哪方面，我来帮你。」這是資訊保密政策，而不是捏造模型身份。擬人化只影響語氣與交流方式；如果用戶直接核對是否為真人，不能冒充真實人類員工，也不捏造線下經歷。

不變：固定的 Unsloth HTTPS API 和 Secret、每次嘗試 `web_search`、QQ Markdown、ASR/TTS 設定，禁止任意程式執行與圖片路由。

模型遵守系統提示詞屬於概率式行為；本次僅改變角色指令，未新增機械式後處理／簡繁轉換。原 Worker 的部分固定繁體錯誤文字尚未被修改，應與模型生成輸出區分。實際 QQ 聊天效果須透過測試確認。

## 2026-10-24 全對話 Web Search 與 QQ Markdown 回覆

依使用者最新要求，**每次模型聊天都會向 Unsloth Studio 請求使用內建網路搜尋**，不必輸入 `/search`，不用在後台手動切換搜尋。所有舊 KV 的 `webSearch:false` 設定將被讀取層覆寫為預設開啟，並在新設定儲存時寫入 true。上游請求限制 `enabled_tools:["web_search"]` 且 `mcp_enabled:false`，絕不啟用 terminal、Python、檔案、電腦控制、圖片理解或圖片生成。模型系統指令要求嘗試搜尋並附來源；若工具未真正執行或無法取得結果，不得聲稱查證最新資訊。

注意：Unsloth Studio `web_search` 工具是否真的執行仍取決於版本、網路和工具調度。Worker **只保證每次嘗試啟用，不會僅因 `enable_tools:true` 就回報搜尋已成功**。Unsloth 官方曾記錄 `enabled_tools:["web_search"]` 在特定 GGUF 版本未執行工具的問題，必須用真實模型測試。每次嘗試搜尋會增加網路流量、推論延遲及可能使公開群組資訊送交搜尋服務。群組工作流程有 23 秒背景推論時限，慢搜尋會顯示模型逾時而不是無限等待。

QQ 官方 `/v2/groups/{group_openid}/messages` / `/v2/users/{openid}/messages` `msg_type:2` 支援 `markdown:{content:"# 大標題\n## 小標題\n1. 條目"}`；本 Worker 現在**優先發送真正的 Markdown**，並保持 `msg_id` 被動回覆關聯。標題、編號清單和段落會由 QQ 客戶端排版，不是將原始 `#`/`**` 當普通文字顯示。

QQ 官方文件明確說明「原生 Markdown」與「群組被動 Markdown」可能需要**單獨申請權限**。若 QQ 發送 API 明確回傳 400/403/415/422 或數字業務拒絕碼，Worker 會**只降級一次為可閱讀的純文字**，移除生硬的 Markdown 標記、保留換行與編號；該拒絕狀態暫存於 KV `qq-markdown-denied-v1` 24 小時以免持續重試刷頻。傳輸逾時/連線例外或不確定是否已送達時絕不二次發送。QQ 的 Markdown 實際顯示及申請權限狀態必須以真實平台測試確認。

**風險與明確排除**：即使 QQ API 存在 `msg_type:2`，未必表示此機器人已開通被動 Markdown，因此仍可能只顯示純文字（例如 `【標題】`、`1. 條目`）。此版本不安裝或啟用任何圖片相關模型，也不擴大 QQ 單次訊息數或取消發送限速。只有完成真實 QQ 回覆驗收後才可認定富文字可用。

## Unsloth 多模型路由（2026-10-24）

獨立 QQ AI Worker 維持單一上游 `https://msiai.ray2025.com/v1` 與原 `UNSLOTH_API_KEY` Cloudflare Secret，不需要額外模型 API 金鑰，也沒有任何可變上游 URL。模型路由設在管理台「多模型路由」：

| 角色 | 設定值 | 實際 API |
| --- | --- | --- |
| 文字聊天及搜尋 | `chat` | `POST /v1/chat/completions` |
| 語音辨識 | `asr`，可不設定 | `POST /v1/audio/transcriptions` |
| 語音合成 | `tts`，可不設定 | `POST /v1/audio/speech`（WAV） |
| 網路搜尋 | `webSearch`（預設關） | **相同聊天模型**，明確搜尋時開啟 `enable_tools:true`、`enabled_tools:["web_search"]`，關閉 MCP |

**圖片理解與圖片生成沒有任何路由、模型角色或執行端點**，依使用者最新要求暫停。使用者已將模型安裝在 Unsloth Studio，這次不下載／更動圖片模型。

管理 API `GET/POST /api/model-roles` 使用現有 ADMIN_TOKEN Bearer 或安全 Session Cookie，KV key `model-roles-v3` 儲存純模型 ID 與 webSearch 布林值，與舊 `selected-model-v2` 同步以相容既有模型選擇 UI。拒絕非白名單欄位、URL、金鑰和未知角色。首次升級以現有聊天模型作 fallback，語音角色不預設任何模型，搜尋預設關閉。Unsloth 模型 ID 必須與你的 Studio 模型清單一致；若 ASR／TTS 模型不在通用 `/v1/models` 中，可手動填入實際 ID。

新增的管理員測試端點：
- `POST /api/audio/speech`：JSON `{"text":"測試文字"}`；只呼叫固定 Unsloth TTS API，最大 600 字與 6 MiB WAV。
- `POST /api/audio/transcriptions`：`multipart/form-data` 的 `file` 欄位；只接受 audio MIME 類型、最大 8 MiB，固定 Unsloth ASR API。
- 上面兩項目前為**管理介面測試**，不代表 QQ 富媒體語音事件已接入；QQ 語音發送可能需要 SILK 格式及 QQ Media API，另行驗證後才可聲稱成功。

聊天只有使用者**明確要求搜尋**（如 `/search ...`、`/web ...`、搜尋／幫我查／即時新聞）且管理員開啟 `webSearch`，才會允許 `web_search`。其他聊天明確送 `enable_tools:false`、`enabled_tools:[]`、`mcp_enabled:false`。Worker 本身**沒有任意 Python、Shell、檔案存取、MCP 或任意 HTTP 工具執行權限**；不把 Unsloth 的網頁搜尋視為 unrestricted agent access。搜尋採 SSE 解析，實際上游版本可能不同，必須以本機實測驗證。啟用網路搜尋會使 Unsloth 對外查詢，管理員應評估外部內容風險及群組資料隱私。

Unsloth Studio 的 Model auto-switch 與 idle unload 請在 **Settings → API** 設定；此 Worker 不主動呼叫模型 Load/Unload。多模型同時駐留依本機硬體、VRAM、推論後端而定；若後端會切換模型，ASR/TTS 和 Qwen 聊天會造成切換延遲。強制多模型常駐並非 Worker 可保證的設定。

驗收限制：目前只有程式模擬測試；QQ 真實群組搜尋回覆、音訊推論結果與同時載入行為，必須實際打開管理介面、選擇已安裝的模型並測試。不應宣稱 QQ 已支援接收/發送語音附件或圖片。

## 新版 Qwen 管理控制台（2026-10-24）

管理網址：<https://qqbot-ai.ray2025.com/>。新版管理頁改為暗色系、行動裝置自適應的正式登入與後台，具備：
- 管理員登入／登出、儀表板、Qwen 模型選擇、網頁文字測試聊天、QQ 事件診斷及功能狀態總覽。
- `ADMIN_TOKEN` 僅由 HTTPS 登入表單提交一次，Worker 驗證後核發有效期 8 小時的 `__Host-qqai_session` cookie，設定 HttpOnly、Secure、SameSite=Strict。登入狀態透過 HMAC-SHA256 簽章，由 Worker Secret `ADMIN_TOKEN` 推導密鑰；不使用 localStorage / sessionStorage，亦不回傳金鑰值。
- `POST /api/session` 登入、`GET /api/session` 查詢登入狀態、`DELETE /api/session` 登出。要求來源同源，登入狀態透過 cookie 傳遞；既有 `Authorization: Bearer <ADMIN_TOKEN>` 相容外部管理 API。
- 網頁測試 AI 回覆會保留段落、換行與 tab；仍保留現有模型回覆安全控制與 QQ 發訊條件，不擅自改動其他 QQ 系統。
- 使用者已具備 Qwen 圖片理解、網路搜尋及語音服務，**但目前此 standalone Worker 程式碼仍只把 QQ 文字事件轉送 OpenAI Chat Completions**。後台對此清楚顯示「已有服務、QQ 接入待核對」，不宣稱 QQ 圖片／語音／搜尋已實際由本 Worker 執行。Qwen 生圖依使用者要求暫不啟用，也不新增任何圖像模型。
- Cookie 登出會清除瀏覽器 cookie；密鑰更換會使既有登入簽章失效。無伺服器端單筆 Session 撤銷功能，故不應在公用裝置上登入。建議配合 Cloudflare WAF 設定登入端點的 IP 速率限制。

這次只有網頁管理後台重設計與文字換行修復；沒有安裝模型、沒有賦予 LLM 任意上網或操作電腦權限、沒有改動 QQ Webhook 協定或模型 Secret。

## Cloudflare Worker Secret 與模型選擇

管理網址：https://qqbot-ai.ray2025.com/ 。Worker 僅使用以下 Cloudflare Worker **Secret**，不得在網頁輸入或在 GitHub / KV 保存 Unsloth API Key：

| Secret | 值 |
| --- | --- |
| `UNSLOTH_API_KEY` | Unsloth Studio 產生的 API Key，**必須**存放在獨立 Worker `qqaibot-unsloth` 的 Secret |
| `ADMIN_TOKEN` | 網頁管理用隨機強密碼，至少 32 個隨機字元，也要選擇 Secret 類型；不可設為 Plain Text |
| `QQ_APP_ID` | 獨立 QQ 官方 Bot 的 AppID |
| `QQ_APP_SECRET` | 獨立 QQ Bot 的 AppSecret |

設定位置：[Cloudflare Dashboard](https://dash.cloudflare.com/) → Workers & Pages → `qqaibot-unsloth` → Settings → Variables and Secrets → Add Secret。金鑰不需要傳給 ChatGPT。只有 `UNSLOTH_API_KEY` 與 `ADMIN_TOKEN` 是「列出模型」和「儲存模型」的必要條件；QQ 憑證之後配置。

使用方式：
1. 將 API Key 儲存成 Worker Secret `UNSLOTH_API_KEY`，並確保 `ADMIN_TOKEN` 是 Secret（不是一般 Plain Text Variable）。
2. 在管理網頁輸入 `ADMIN_TOKEN`，按「取得模型清單」。Worker 使用環境 Secret 對固定 `https://msiai.ray2025.com/v1/models` 呼叫 Bearer API。
3. 選擇其中的模型並按「儲存並套用」，Worker 會再驗證所選模型存在，將**模型 ID（僅 ID）**儲存在專用 KV `qqaibot-unsloth-config`，不寫入任何 API 金鑰。
4. 使用管理員聊天測試，再設定獨立 QQ Bot 回呼。

此 Worker 的 `compatibility_flags = ["global_fetch_strictly_public"]` 讓對相同 Cloudflare Zone 的 `msiai.ray2025.com` 上游 `fetch()` 走 Cloudflare 公開路由，避免同 Zone 連線被送往與公開端點不同的來源。這是針對舊 `MODEL_LIST_NETWORK_ERROR` 的修復設定，但上線仍須實測。

## 管理 API

- `GET /api/status`：公開、僅顯示設定狀態；不含 Secret 原文。
- `GET /api/models`：支援已登入的安全 Cookie 或既有 `Authorization: Bearer <ADMIN_TOKEN>` 管理驗證；由 Worker Secret 抓模型清單，不接受網頁提供 API Key。
- `GET /api/settings`：須管理驗證；顯示目前模型 ID。
- `POST /api/settings`：須管理驗證，`{"model":"模型 ID"}`；再次驗證模型存在後將 ID 寫到 KV，拒絕 `api_key` 請求欄位。
- `POST /api/chat`：純文字聊天測試，使用已選模型和 Worker Secret，禁止任何工具呼叫。
- `POST /webhook`：QQ 官方 Webhook 簽章驗證和訊息回覆。

舊版 KV `model-configuration-v1` 曾可包含加密金鑰。新程式**完全不會讀取它**，首次成功儲存模型後會將該舊項刪除。現有獨立 KV API 讀回清單為空；本次不改動其他 Worker、D1 或 QQ 既有資料。變更 ADMIN_TOKEN 不會影響已選模型。

### 模型清單錯誤

| 錯誤代碼 | 檢查 |
| --- | --- |
| `UNSLOTH_SECRET_NOT_CONFIGURED` | 設定 `qqaibot-unsloth` Worker 的 `UNSLOTH_API_KEY` Secret |
| `MODEL_LIST_CONNECTION_FAILED` | 檢查 Cloudflare Worker 同 Zone 路由、Tunnel 和本機 API |
| `MODEL_LIST_TIMEOUT` | 檢查上游 12 秒連線逾時 |
| `MODEL_LIST_REDIRECT_3xx` | 檢查登入/重新導向 |
| `MODEL_LIST_HTTP_401` | 檢查 Unsloth API Key 有效性 |
| `MODEL_LIST_HTTP_502/503/524` | 檢查 Unsloth 本機服務/Tunnel |
| `INVALID_MODEL_LIST` | 目前上游沒有提供標準 `data[].id` 格式 |


### 聊天測試的模型錯誤診斷

模型列表可用，不代表 `POST /v1/chat/completions` 一定成功。管理網頁以前將所有錯誤統一為 `MODEL_UNAVAILABLE`，現在改為以下安全代碼（**不會輸出金鑰、上游錯誤本文或模型原始訊息**）：

| 代碼 | 原因／處理 |
| --- | --- |
| `MODEL_NOT_CONFIGURED` | 需要 `UNSLOTH_API_KEY` Secret 與已選模型 |
| `MODEL_HTTP_400` | 推論 API 拒絕請求；檢查所選模型或 Unsloth Studio 版本 |
| `MODEL_HTTP_401/403` | 上游 Bearer 驗證失敗或未授權 |
| `MODEL_HTTP_500/502/503/524` | Unsloth Studio、推論後端或 Tunnel 出錯 |
| `MODEL_TIMEOUT` | 管理員網頁最多等待 60 秒；可能是大型模型首次推論、資源不足或模型卡住 |
| `MODEL_CONNECTION_FAILED` | Worker 無法建立到上游的網路連線 |
| `MODEL_REDIRECT_3xx` | 公開 API 發生重新導向 |
| `MODEL_INVALID_RESPONSE` | 上游回傳非 JSON |
| `MODEL_EMPTY_RESPONSE` | 上游成功但沒有回覆文字 |

為相容 Unsloth，傳送最小 OpenAI chat completions 請求：`model`、`messages`、`stream:false`、`max_tokens:1024`；沒有任何 `tools` 或 `tool_choice` 欄位，Worker 本身也不具備呼叫工具的能力。管理介面推論上限 60 秒；QQ 被動 Webhook 在 `waitUntil` 內使用 22 秒上限，避免超過常見的背景執行時限。非常慢的模型仍可能無法及時回覆 QQ，必須另外設計持久化佇列。

在 Windows 已確認 `GET /v1/models` 本機和公開帶 Key 可以回傳 HTTP 200 且載入模型；`POST /v1/chat/completions` 的真實結果尚未獲得使用者確認。不可由 GET 200 推定推論也正常。

## QQ 接入

1. **建議建立新的 QQ 官方機器人**。目前儲存庫既有 `qqai` Worker 已有自己的正式 QQ 機器人。不得直接覆蓋原有 QQ 平台回呼，以免中斷舊服務。
2. 完成上述 Secret 與網頁模型選擇後，在 [QQ 開放平台](https://q.qq.com/) 設定回呼 `https://<實際 Worker 網域>/webhook`，開啟 `GROUP_AT_MESSAGE_CREATE` 和 `C2C_MESSAGE_CREATE`。官方會先以 `op=13` 進行無簽名挑戰。
3. 確認 QQ 沙箱成員、事件訂閱、發布資格及 **API 出站 IP 白名單**。一般 Cloudflare Worker 的對外連線不保證固定 IP；如果 QQ App 啟用固定 IP 白名單，必須先提供合規的固定出口才能真正發送。
4. 確認電腦上的 Unsloth Studio 已運行，`msiai.ray2025.com` 的 Tunnel 可用，模型清單與所選模型正確。
5. 用網頁測試模型，再從 QQ 私訊或群組 @ 官方機器人做端對端測試。

部分 QQ 網路環境無法連接 `*.workers.dev`；此時請在 Cloudflare 綁定獨立的 `*.ray2025.com` Worker Custom Domain，再於 QQ 後台填入該網址。

## HTTP 端點

- `GET /`：簡單管理頁（只提供狀態與管理員文字聊天測試）。
- `POST /api/chat`：管理測試；`Authorization: Bearer <ADMIN_TOKEN>`，JSON `{"message":"你好"}`，不會傳送 QQ 訊息。
- `POST /webhook`：只接受 QQ 官方事件；`op=13` 回傳 Ed25519 challenge signature，一般事件檢查 `X-Signature-Ed25519` 與時間戳後回傳 `{"op":12}`。

## 安全與限制

- 模型 ID 僅儲存在獨立 KV；Unsloth API Key 僅放 Cloudflare Worker Secret，管理 API 必須經過 ADMIN_TOKEN Bearer 驗證。KV 非強一致，更新跨資料中心可能有短暫延遲。
- Worker 不提供 Shell、RCE、檔案存取、執行程式碼、代理請求或任何模型工具。Unsloth 模型呼叫固定 `tools: []`、`tool_choice: "none"`。
- 上游 URL 固定為 `msiai.ray2025.com`；禁止 HTTP redirect，不能由聊天訊息改變 URL。
- Webhook 非初始化事件需簽章及 5 分鐘時間窗；原始訊息不落盤，也沒有跨回合記憶。
- 管理介面聊天測試設 60 秒推論上限；QQ Worker 使用 `waitUntil` 處理 ACK 後回覆，QQ 背景推論以 22 秒為上限，慢模型可能逾時失敗。
- 目前只實作 **單 isolate 記憶體短期去重**，不保證多實例下嚴格去重；QQ 自身的 `msg_id/msg_seq` 可輔助防止重覆回覆。若正式要大規模上線，需新增獨立 Queue/D1 與頻率限制。
- 請在 Unsloth 本機另外停用 MCP、Shell、Computer Use 等具操作權限的功能；Worker 不能控制本機其他程式。

## QQ 無回覆診斷

Cloudflare Worker 管理頁 `https://qqbot-ai.ray2025.com/` 現有「查看 QQ 診斷」按鈕。請先以 `ADMIN_TOKEN` 登入，再在 QQ 群內 **@機器人** 或 QQ 私訊傳一則**新**訊息，然後按診斷按鈕。此面板只顯示最近 24 小時的事件階段、UTC 時間、經白名單限制的錯誤代碼，不保存或展示 QQ ID、訊息內容、AppSecret、API Key、Access Token 或上游原始錯誤。

| 階段 | 解讀 |
| --- | --- |
| 沒有任何事件 | 優先檢查 QQ 開放平台 `https://qqbot-ai.ray2025.com/webhook` 回調**驗證通過且保存**、選擇 HTTP Webhook、訂閱 C2C_MESSAGE_CREATE / GROUP_AT_MESSAGE_CREATE、沙箱帳號與群組。此指標只是最佳努力，KV 短暫延遲或寫入節流亦可能造成缺口 |
| `callback_verify OK` | QQ 平台完成 op=13 驗證請求（不代表已訂閱或送達聊天事件） |
| `callback_rejected INVALID_APP` | Worker 的 QQ_APP_ID 和 QQ 平台來源不符 |
| `callback_rejected INVALID_SIGNATURE` | 非有效簽名，請確認同一機器人的 QQ_APP_SECRET |
| `event_received GROUP_AT/C2C` | 收到已驗簽且格式符合群@／私訊的事件 |
| `event_ignored` | 不是可處理的事件或訊息為空 |
| `model_failed MODEL_HTTP_400` | Unsloth 回傳錯誤；若上游內容為 No model loaded，可啟用 Studio Settings → API 的 Model auto-switch，並設定閒置自動卸載。程式會**盡可能回一則安全的錯誤訊息**，不會執行模型工具 |
| `send_failed QQ_AUTH_FETCH_FAILED` | 呼叫 QQ Access Token API 的 `fetch()` 失敗（可能是 DNS/TLS/網路/執行環境，**不代表金鑰錯**） |
| `send_failed QQ_AUTH_TIMEOUT` | 取得 QQ Access Token 等待逾時（8 秒） |
| `send_failed QQ_AUTH_CODE_100016` | QQ API 透過 HTTP 200 回報 AppID 或 AppSecret 無效（核對同一隻機器人） |
| `send_failed QQ_AUTH_CODE_100007` | QQ API 回報 AppID 無效 |
| `send_failed QQ_AUTH_HTTP_NNN` | QQ Token API 返回非 2xx HTTP 狀態碼 |
| `send_failed QQ_SEND_FETCH_FAILED` | 已取得 Token，但呼叫 QQ 發訊 API 的 `fetch()` 失敗（檢查網路連線與 Cloudflare Worker 出口） |
| `send_failed QQ_SEND_TIMEOUT` | QQ 發送 API 等待超過 8 秒 |
| `send_failed QQ_SEND_CODE_NNN` | QQ 發送 API HTTP 200 仍回傳錯誤碼；對照 QQ 官方錯誤碼 |
| `send_failed QQ_AUTH_*` | QQ AppID/AppSecret 兌換 Access Token 失敗 |
| `send_failed QQ_SEND_HTTP_403` | QQ 發送 API 拒絕，檢查正式／沙箱模式、權限、IP 白名單、訊息有效期 |
| `reply_sent OK` | QQ API 回應接受該則訊息（仍需手機 QQ 實際收件驗證） |

QQ 回調事件被拒絕（INVALID_APP/INVALID_SIGNATURE）仍不會觸發 AI，也不會返回任何對話資料。未收到真正平台事件時不會憑空生成 QQ 訊息。新的 OpenID 驗證允許合法的不透明字串（含 + / =），送出時完整 URL 編碼。診斷 KV 是最佳努力且可能有傳播延遲；不應作為高流量正式持久事件系統。

推論錯誤 QQ fallback 只發送純文字，不會顯示 API Key、QQ ID 或上游原始 HTTP 內容。QQ 非錯誤回覆的推論最多等待 18 秒以預留 QQ Token + 出站消息時間；非常慢的模型建議改用持久化隊列處理（避免 Cloudflare Worker `waitUntil` 背景時間過限）。

## 部署與驗證

在本目錄執行 `npx wrangler deploy`（需有 Cloudflare 登入權限，且會使用本目錄專用 KV binding）。這與根目錄 `wrangler.toml` 的 `qqai` 不同。以 `npm test` 驗證基本功能；沒有 ADMIN_TOKEN 時無法使用網頁設定；沒有 QQ Secret 時無法從 QQ 實際收發；上線驗證必須以真實 API 與 QQ 訊息為準。
