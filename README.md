# QQ AI Bot

目前版本：**2.7.12**

QQ AI Bot 是部署在 Cloudflare Workers 的單一 Worker QQ 群聊機器人。它透過 NapCat／OneBot WebSocket 接收 QQ 事件，整合 Gemini、Gemma、DeepSeek、D1、Vectorize、Durable Objects 與內建 Portal，提供聊天、記憶、群規、活動、排程、通知、狼人殺與管理工具。

本儲存庫不再把維護者 QQ 號當成程式預設。部署者必須設定自己的開發者 QQ、公開網址、Cloudflare 資源與 API 憑證。

> 本專案使用未經 QQ 官方背書的第三方機器人接入方式，可能存在帳號限制、封禁、資料遺失與平台條款風險。建議使用測試帳號，並自行評估部署與使用後果。

## 架構

Cloudflare 只部署一個 Worker，入口固定為 `worker.js`。

```text
NapCat / OneBot
      │ WebSocket
      ▼
OneBotHub Durable Object
      │ 事件去重、同號回音防護、排隊、RPC
      ▼
worker.js
      ├─ src/ai/             模型路由、搜尋、TTS、回答完整性
      ├─ src/config/         執行期與部署設定正規化
      ├─ src/moderation/     群規、群管提案、禁言鎖、關係綁定
      ├─ src/portal/         Portal、登入、密碼、API
      ├─ src/notifications/  人工通知路由
      ├─ src/operations/     活動、投票、協作與自動化
      ├─ src/scheduler/      排程、衝突守衛、群打卡
      ├─ src/social/         人格、關係、輸出風格與表情庫
      ├─ src/games/          狼人殺與本地娛樂指令
      └─ src/data/           D1／KV 相容資料存取
```

Wrangler 會把所有模組打包成同一個 Worker，不需要建立第二個 Worker。

## 五層設定模型

設定依用途分成五層，不應全部塞進同一頁或同一檔案。

1. **Cloudflare 基礎資源**：Worker 名稱、網域、D1、Vectorize、Durable Object、Cron、Rate Limiter。設定於 `wrangler.toml`。
2. **公開執行期變數**：開發者 QQ、公開網址、模型名稱、預算、功能開關與安全範圍內的限制值。設定於 `[vars]` 或 Cloudflare Dashboard Variables。
3. **Secrets**：API Key、OneBot Token、Portal 加密金鑰。使用 `wrangler secret put`，不得提交至 GitHub。
4. **Portal／群組動態設定**：人格、群規、通知路由、模型偏好、活動、排程、權限與各群開關。保存於 D1，不必重新部署。
5. **不可任意關閉的系統不變量**：權限驗證、資料隔離、政治靜默、安全規則、危險操作二次確認、Durable Object migration 歷史與資料結構完整性。

優先順序通常是：Portal／群組明確設定 → Worker 公開變數 → 程式安全預設。Secrets 只提供憑證，不應被 Portal 回傳或顯示。

## 快速部署

### 1. 準備環境

需要：

- Node.js 22
- npm
- Cloudflare 帳號與 Wrangler
- NapCat 或相容 OneBot 11 實作
- 至少一組可用的 Gemini API Key

```bash
npm install --ignore-scripts
npx wrangler login
```

### 2. 建立 Cloudflare 資源

建立 D1 與 Vectorize，並記下回傳的名稱與 ID：

```bash
npx wrangler d1 create your-qqai-db
npx wrangler vectorize create your-qqai-index --dimensions=1024 --metric=cosine
```

Rate Limiter、Workers AI、Durable Object 與自訂網域依 Cloudflare Dashboard／Wrangler 建立。`ONEBOT_HUB` 的 class 名稱不可任意改名。

### 3. 建立部署設定

新部署請從範本開始，不要直接沿用維護者的正式資源 ID：

```bash
cp wrangler.example.toml wrangler.toml
```

至少替換：

- Worker `name`
- 自訂網域，或移除 `[[routes]]`
- D1 `database_name` 與 `database_id`
- Vectorize `index_name`
- Rate Limiter `namespace_id`
- `DEVELOPER_IDS`
- `PUBLIC_BASE_URL`
- `DEPLOY_NOTIFY_WORKER_NAME`

Durable Object migration 的 `v1_onebot_hub`、`v2_budget_guard`、`v3_remove_budget_guard` 順序屬於專案歷史，既有部署不可刪除、重新命名或重排。

### 4. 設定 Secrets

本機可先複製安全範本：

```bash
cp .dev.vars.example .dev.vars
```

正式環境使用：

```bash
npx wrangler secret put GEMINI_API_KEYS
npx wrangler secret put ONEBOT_ACCESS_TOKEN
npx wrangler secret put PORTAL_AUTH_SECRET
npx wrangler secret put TOTP_ENCRYPTION_KEY
```

### 5. 驗證與部署

```bash
npm run check
npm run check:bundle
npm run deploy
```

`check:bundle` 是 Wrangler dry-run，不會部署；`deploy` 才會更新正式 Worker。

## Cloudflare Bindings

| Binding | 類型 | 必要性 | 用途 |
| --- | --- | --- | --- |
| `AI` | Workers AI | 建議 | Embedding 與 Cloudflare AI |
| `ONEBOT_HUB` | Durable Object | 必要 | OneBot WebSocket、RPC、事件佇列 |
| `DB` | D1 | 必要 | 對話、設定、稽核、Portal 與索引 |
| `VECTORIZE` | Vectorize | 長期記憶需要 | 群組／使用者隔離的語意記憶 |
| `MY_RATE_LIMITER` | Rate Limiter | 建議 | Cloudflare 原生速率限制 |

Cron 預設每分鐘執行，用於排程、自動化、暫存清理、主動發話與自動群打卡。更改 Cron 會影響所有上述工作，不應只為調整打卡時間而降低觸發頻率。

## 公開 Worker 變數

這些值可放在 `wrangler.toml [vars]` 或 Cloudflare Dashboard。變更後通常需要重新部署，除非使用 Dashboard 直接更新 Worker 變數。

### 身分與公開網址

| 變數 | 格式／預設 | 說明 |
| --- | --- | --- |
| `DEVELOPER_IDS` | 逗號、分號或換行分隔 QQ ID；預設空 | 開發者／Root QQ 清單。建議使用此欄位，可設定多人。 |
| `DEVELOPER_ID` | 單一 QQ；預設空 | 舊版相容欄位，只有一位開發者時仍可用。 |
| `ROOT_QQ_IDS` | QQ 清單；預設空 | 額外 Root 清單，相容部署使用；會與 `DEVELOPER_IDS` 合併去重。 |
| `PUBLIC_BASE_URL` | `https://bot.example.com`；預設使用請求來源 | `!help`、Portal 與 Live 對外連結的基底網址，不加結尾 `/`。 |
| `BOT_DISPLAY_NAME` | `QQAI` | 對外顯示名稱，供可支援的 UI／訊息使用。 |

`DEVELOPER_IDS` 不屬於密碼，但它授予最高權限。不要允許一般 Portal 管理員修改，否則會形成自行提權。應由部署者在 Cloudflare 設定。

### 部署通知

| 變數 | 預設 | 說明 |
| --- | --- | --- |
| `DEPLOY_NOTIFY_WORKER_NAME` | `qqai` | 只接受此 Worker 的 Build 事件。 |
| `DEPLOY_NOTIFY_BRANCH` | `main` | 只接受此分支的部署事件。 |
| `DEPLOY_NOTIFY_DEVELOPER_IDS` | 空 | 部署失敗通知收件人；空白時使用第一個開發者 QQ。 |
| `DEPLOY_NOTIFY_DEVELOPER_ID` | 空 | 舊版單一收件人相容欄位。 |
| `DEPLOY_NOTIFY_START_COOLDOWN_SECONDS` | `600` | 部署開始事件冷卻。 |
| `DEPLOY_NOTIFY_SELF_GRACE_SECONDS` | `90` | Worker 自我版本確認等待時間，範圍由程式限制。 |

### OneBot 與自動群打卡

| 變數 | 預設／範圍 | 說明 |
| --- | --- | --- |
| `ENABLE_ONEBOT_HTTP_EVENTS` | `false` | 是否允許 OneBot HTTP 事件入口。 |
| `AUTO_CHECKIN_ENABLED` | `true` | 全域停用或啟用自動群打卡。 |
| `AUTO_CHECKIN_RETRY_INTERVAL_MS` | `1000`，限制 500～5000 | 午夜打卡失敗後的重試間隔。 |
| `AUTO_CHECKIN_CONCURRENCY` | `12`，限制 1～30 | 同時處理的群數量。 |

自動群打卡目前使用 Asia/Taipei 語意：23:59 預載群列表，00:00:00～00:01:59 重試。這個時區與日期邏輯屬於完整演算法，不是單一字串即可安全更換；要支援其他時區需連同日期解析與測試一起修改。

### 模型與預算

| 變數 | 說明 |
| --- | --- |
| `GEMINI_CHAT_MODELS` | Gemini／Gemma 聊天模型優先序，逗號分隔。 |
| `GEMMA_DECISION_MODELS` | 分類、審查與低成本決策模型清單。 |
| `GEMINI_IMAGE_MODELS` | 圖片相關模型清單；空白代表不啟用該路由。 |
| `IMAGEN_MODELS` | Imagen 模型清單；目前 QQ 指令式生圖未開放。 |
| `GEMINI_TTS_MODELS` | TTS 模型優先序。 |
| `GEMINI_LIVE_MODEL` | Gemini Live 模型。 |
| `DEEPSEEK_FLASH_MODEL` | DeepSeek 低成本模型名稱。 |
| `DEEPSEEK_PRO_MODEL` | DeepSeek 高能力模型名稱。 |
| `DEEPSEEK_DAILY_BUDGET_CNY` | 每日 DeepSeek 預算上限；請依帳務需求設定。 |

模型名稱會隨供應商變動。不存在或無權限的模型會造成 fallback 或錯誤，更新前應先在供應商控制台確認。

### Cloudflare 設定檔可調項目

以下不是 Worker `env`，而是 Wrangler 基礎設定：

- Worker `name`
- `workers_dev`
- `[[routes]]` 自訂網域
- D1 名稱與 ID
- Vectorize index 名稱
- Cron 表達式
- Rate Limiter namespace、limit、period
- `[observability].enabled`
- `compatibility_date` 與 flags

修改 D1 ID、Vectorize index 或 migration 可能切換資料來源或破壞既有部署。操作前先備份並確認資源。

## Secrets

Secrets 不可放在 `[vars]`、README 範例值、Portal 回應、Git log 或聊天通知。

| Secret | 用途 |
| --- | --- |
| `GEMINI_API_KEYS` | Gemini 通用 Key，可用逗號分隔多組。 |
| `GEMINI_CHAT_API_KEYS` | 可選，聊天專用 Key 池。 |
| `GEMMA_CHAT_API_KEYS` | 可選，Gemma 聊天備援。 |
| `GEMMA_DECISION_API_KEYS` | 可選，分類與路由。 |
| `GEMINI_SEARCH_API_KEYS` | 即時搜尋專用 Key，不與聊天 Key 混用。 |
| `GEMINI_VISION_API_KEYS` | 圖片理解；未設定時自動停用。 |
| `DEEPSEEK_API_KEYS` | DeepSeek Key 池。 |
| `ONEBOT_ACCESS_TOKEN` | NapCat WebSocket 驗證 Token。 |
| `ONEBOT_HTTP_URL` | 可選 OneBot HTTP 備援網址。若含憑證資訊仍應視為 Secret。 |
| `ONEBOT_HTTP_ACCESS_TOKEN` | HTTP 備援 Token。 |
| `PORTAL_AUTH_SECRET` | Portal 敏感資料與登入相關加密。 |
| `TOTP_ENCRYPTION_KEY` | TOTP 種子加密。 |
| `CLOUDFLARE_BUILDS_API_TOKEN` | 可選，讀取 Cloudflare Build 詳細日誌。 |

列出 Secrets：

```bash
npx wrangler secret list
```

更新某個 Secret：

```bash
npx wrangler secret put SECRET_NAME
```

## Portal／群組動態設定

以下設定本來就應由 Portal 或 QQ 管理指令修改，不需要寫入 `wrangler.toml`：

- 群白名單與群組使用狀態
- AI 開關、記憶開關、插話率與模型偏好
- 群組人格、個人人格、模仿模式與表情庫
- 群規內容、嚴格度、代理模式、多動作與處置冷卻
- 自動歡迎、歡迎詞、入群輔助與新人觀察期
- 人工通知路由；預設只找開發者，群主通知總開關預設關閉
- AI 管理、群操作、排程審核與申訴審核權限
- 活動、報名、候補、投票、排程與狼人殺
- Bilibili 監控設定
- 使用者記憶、免打擾、黑名單、好感度與申訴資料

開發者 QQ 清單、API Key、Token、加密金鑰、Cloudflare binding 與 migration 不開放給一般 Portal 使用者修改。

## 不提供成任意開關的項目

為避免部署者誤以為「可自訂」等於「所有保護都能關掉」，下列項目刻意不是一般設定：

- 開發者／群主／管理員權限驗證與禁止自行提權
- 危險群操作二次確認
- 種族歧視固定警告邊界
- 現實政治內容靜默略過
- 隱私與跨群資料隔離
- OneBot 自我回音與重複事件防護
- 密碼雜湊、Session、TOTP 與 Secrets 隱藏
- Durable Object migration 歷史
- D1 schema 與索引完整性
- 模型不得偽稱已搜尋、不得輸出控制指令等安全規則

這些若要改動，必須以原始碼變更、測試與版本升級處理，不能只在 Portal 放一個危險開關。

## 核心能力

### AI 聊天與模型路由

- Gemini 為主要聊天模型，Gemma 可作免費備援與分類模型。
- DeepSeek 受成本、權限與每日預算限制。
- 即時資料問題進入獨立搜尋流程；搜尋失敗不得假裝已查證。
- 長回答會檢查截斷、續寫並按完整句子分段。
- 圖片理解使用獨立 Vision Key 池；沒有設定時停用。

### 記憶、人格與群規

- D1 保存結構化對話、設定、稽核與 Portal 資料。
- Vectorize 保存依群組與使用者隔離的長期語意記憶。
- 群組人格最多 12,000 字元，為持續基底；個人與模仿風格只作覆蓋層。
- 政治內容在聊天與群規分類前靜默略過。
- 明確種族歧視固定公開警告，不自動撤回、禁言、踢出或累進處罰。
- 高風險群管先建立提案，再由有權限者確認。

### Portal

Portal 入口由 `PUBLIC_BASE_URL` 或實際請求來源決定，不再固定指向維護者網站。包含登入、密碼重設、群組與群友、權限、群規、通知、模型、對話、違規、申訴、活動、投票、狼人殺與系統維護。

## 指令

QQ 內輸入 `!help` 可取得依目前權限產生的條列清單。Portal 與 Live 連結會依 `PUBLIC_BASE_URL`／目前請求網域產生。

本地娛樂指令不呼叫模型 API：

| 指令 | 說明 |
| --- | --- |
| `!娛樂` | 顯示娛樂指令 |
| `!骰子 [面數／NdM]` | 擲骰，例如 `!骰子 2d6` |
| `!隨機數 [最小] [最大]` | 預設 1～100 |
| `!硬幣` | 擲硬幣 |
| `!猜拳 石頭／剪刀／布` | 與機器人猜拳 |
| `!選擇 A \| B \| C` | 隨機選一項 |
| `!今日運勢` | 同一人每天結果固定 |
| `!真心話` | 隨機真心話題目 |
| `!大冒險` | 隨機安全任務 |

高權限設定以 `!help` 與 Portal 實際顯示為準。

## NapCat／OneBot

建議 WebSocket Client：

```text
URL: wss://你的網域/onebot
Message format: Array
Report self messages: Enabled
Heartbeat: 1000 ms
Reconnect: 1000 ms
Token: 與 ONEBOT_ACCESS_TOKEN 相同
```

上報自身訊息必須開啟，系統使用 `message_sent`、message ID 與 outbound fingerprint 區分同號人工指令及機器人 API 回覆。

## 從 2.7.11 升級

1. 在 Cloudflare 先設定 `DEVELOPER_IDS`，內容為你自己的 QQ；可用逗號分隔多人。
2. 設定 `PUBLIC_BASE_URL`，避免 `!help` 產生錯誤網址。
3. 確認 `AUTO_CHECKIN_ENABLED`、重試間隔與 concurrency。
4. 不要刪除既有 Durable Object migrations。
5. 執行完整 regression 與 dry-run bundle。
6. 部署後用開發者 QQ 測試 `!help`、Portal 登入、通知與私訊 `!群打卡`。

若沒有設定任何有效的開發者 QQ，系統不會偷偷回退到原作者帳號；所有開發者專屬功能都會保持不可用，直到部署者正確設定。

## 驗證與 GitHub Actions

```bash
npm install --ignore-scripts --no-package-lock
npm run check
npm run check:bundle
```

`.github/workflows/validate.yml` 在 `main` push 與 PR 執行完整 regression 和單一 Worker bundle，正式 workflow 僅使用 `contents: read`。

## 授權與責任

本專案採用儲存庫現有的自訂限制性授權條款。使用、修改或散布前請先閱讀授權文件。軟體按現狀提供，使用者自行承擔部署、帳號、第三方平台與資料風險。
