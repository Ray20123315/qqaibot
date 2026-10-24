# QQAIBOT · 獨立 Unsloth QQ AI

這是 **qq aibot 舊系統以外**的獨立 Cloudflare Worker `qqaibot-unsloth`。它只接 QQ 官方群組 @ 事件 `GROUP_AT_MESSAGE_CREATE` 與私訊 `C2C_MESSAGE_CREATE`，使用固定上游 `https://msiai.ray2025.com/v1/chat/completions` 及 QQ 官方 API 被動回覆。**沒有執行系統指令、工具呼叫、檔案操作、任意 URL 代理的功能**。

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
