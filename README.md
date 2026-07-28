# QQ AI Bot

目前版本：**2.7.11**

QQ AI Bot 是部署在 Cloudflare Workers 的單一 Worker QQ 群聊機器人。它透過 NapCat／OneBot WebSocket 接收 QQ 事件，整合 Gemini、Gemma、DeepSeek、D1、Vectorize、Durable Objects 與內建 Portal，提供聊天、記憶、群規、活動、排程、通知、狼人殺及管理工具。

> 本專案使用未經 QQ 官方背書的第三方機器人接入方式，可能存在帳號限制、封禁、資料遺失與平台條款風險。請使用測試帳號，並自行評估部署與使用後果。

## 目前架構

Cloudflare 只部署一個 `qqai` Worker，入口固定為 `worker.js`。

```text
NapCat / OneBot
      │ WebSocket
      ▼
OneBotHub Durable Object
      │ 事件去重、同號回音防護、排隊、RPC
      ▼
worker.js
      ├─ src/ai/             模型路由、搜尋、TTS、回答完整性
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

## 核心能力

### AI 聊天與模型路由

- Gemini 為主要聊天模型，Gemma 可作免費備援與分類模型。
- DeepSeek 預設受成本與權限限制，只在明確選擇或符合緊急備援條件時使用。
- 需要即時資料的問題會進入獨立搜尋流程；搜尋失敗時不得假裝已查證。
- 長回答會檢查截斷並嘗試續寫，再按完整句子分段發送。
- 圖片理解使用獨立 Vision Key 池；沒有設定時自動停用。
- 專案目前不提供 QQ 指令式圖片生成。

### 對話、記憶與人格

- D1 保存結構化對話、設定、稽核與 Portal 資料。
- Vectorize 保存依群組與使用者隔離的長期語意記憶。
- 群聊上下文採近期精確訊息、長上下文整理與個人記憶分層組合。
- 群組人格最多保存 12,000 字元，作為持續基底。
- 個人人格與模仿模式只作覆蓋層，不會刪除群組人格。
- 安全、權限、政治靜默、隱私、事實性與群規永遠高於人格設定。
- Bot 與 Portal 對外文字統一使用簡體中文。

### 群規與群管理

- 群規嚴格度預設為 `smart`，會根據管理員復核與誤判記錄調整。
- 政治內容在聊天與群規分類前確定性靜默略過。
- 明確種族歧視固定公開警告，但不自動撤回、禁言、踢出或累進處罰。
- 一般群規代理支援僅記錄、警告、禁言與完全代理模式。
- 禁言、踢人、全員禁言與管理員變更等高風險操作先建立提案，必須二次確認。
- 同一規則可配置多個動作，執行結果逐項記錄。
- 人工補檢、誤判撤銷、申訴與 Portal 歷史記錄均保留稽核。

### Portal

Portal 預設入口：

```text
https://qqai.ray2025.com/
```

目前包含：

- QQ 驗證碼登入、密碼登入與驗證碼重設密碼。
- 持久／臨時 Session 與登入安全限制。
- 群組、群友、權限、群規、通知路由與模型設定。
- 對話與 AI 回覆分頁，預設 20 筆，每頁最多 100 筆。
- 違規、申訴、活動、投票、狼人殺與系統維護紀錄。
- 人工通知預設只通知開發者；群主通知總開關預設關閉。

### OneBot 可靠性

- 使用 Durable Object 維持 NapCat WebSocket。
- 依 message ID 與 outbound fingerprint 防止機器人回覆自己形成循環。
- 同一人的問題採單一進行中＋等待佇列。
- 短時間重複事件、重複短回覆與重複通知都有去重保護。
- 非白名單群不會顯示內部失敗提示。
- 同號人工操作支援 `!指令`、`//聊天`、`??聊天` 與 `/!聊天`。
- 一般群友使用 `/!內容` 代表本則訊息完全跳過 AI。

## 指令

QQ 內輸入 `!help` 可取得依目前權限動態產生的完整條列式清單。

### 本地娛樂指令

這些指令不呼叫任何模型 API：

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

指令同時接受繁體、簡體及部分英文別名；Bot 回覆仍輸出簡體中文。

### 常用指令分類

- AI 與工具：`!status`、`!模型`、`!live`、`!語音`、`!讀網頁`、`!翻譯`
- 群聊整理：`!會議紀要`、`!總結`、`!吃瓜`、`!查成分`、`!詳細資料`
- 記憶與人格：`!記住`、`!忘記`、`!你記住了什麼`、`!set人格`、`!del人格`
- 活動與投票：`!活動`、`!報名`、`!取消報名`、`!活動名單`、`!投票`
- 排程：`!排程`
- 群規：`!群規`、`!檢查`、`!無違規`
- 群操作：`!禁言`、`!解禁`、`!撤回`、`!踢出`、`!確認op`、`!取消op`

高權限設定以 `!help` 與 Portal 顯示為準。

## Cloudflare Bindings

`wrangler.toml` 目前需要：

| Binding | 類型 | 用途 |
| --- | --- | --- |
| `AI` | Workers AI | Embedding 與 Cloudflare AI |
| `ONEBOT_HUB` | Durable Object | OneBot WebSocket、RPC、佇列 |
| `DB` | D1 | 對話、設定、稽核與 Portal |
| `VECTORIZE` | Vectorize | 長期語意記憶 |
| `MY_RATE_LIMITER` | Rate Limiter | Cloudflare 原生速率限制 |

排程觸發器目前為每分鐘一次，用於排程、自動化、清理與群打卡。Durable Object migration 歷史不可刪除或重新排序。

## Secrets 與環境變數

至少需要一組可用的 Google Chat Key：

```bash
npx wrangler secret put GEMINI_API_KEYS
```

常見 Secrets：

| 名稱 | 說明 |
| --- | --- |
| `GEMINI_API_KEYS` | Gemini 通用 Key，可用逗號分隔 |
| `GEMINI_CHAT_API_KEYS` | 可選，聊天專用 Key |
| `GEMMA_CHAT_API_KEYS` | 可選，Gemma 聊天備援 |
| `GEMMA_DECISION_API_KEYS` | 可選，分類與路由 |
| `GEMINI_SEARCH_API_KEYS` | 獨立搜尋 Key，不與聊天 Key 混用 |
| `GEMINI_VISION_API_KEYS` | 圖片理解，未設定時停用 |
| `DEEPSEEK_API_KEYS` | DeepSeek Key |
| `ONEBOT_ACCESS_TOKEN` | OneBot WebSocket 驗證 |
| `ONEBOT_HTTP_URL` | 可選 HTTP 備援 |
| `ONEBOT_HTTP_ACCESS_TOKEN` | HTTP 備援 Token |
| `PORTAL_AUTH_SECRET` | Portal 敏感資料加密 |
| `TOTP_ENCRYPTION_KEY` | TOTP 加密 |
| `CLOUDFLARE_BUILDS_API_TOKEN` | 可選，部署通知讀取 Build 詳情 |

不要把 Key、Token、Cookie 或私鑰提交至 GitHub。

## NapCat／OneBot

建議 NapCat WebSocket Client：

```text
URL: wss://你的網域/onebot
Message format: Array
Report self messages: Enabled
Heartbeat: 1000 ms
Reconnect: 1000 ms
Token: 與 ONEBOT_ACCESS_TOKEN 相同
```

上報自身訊息必須開啟，系統會利用 `message_sent`、message ID 與 outbound fingerprint 區分人工同號指令及機器人 API 回覆。

## 安裝、驗證與部署

需求：Node.js 22、npm、Cloudflare Wrangler，以及已建立的 D1、Vectorize、Durable Object 與相關 bindings。

```bash
npm install --ignore-scripts
npm run check
npm run check:bundle
npx wrangler login
npm run deploy
```

- `npm run check`：完整永久 regression。
- `npm run check:bundle`：Wrangler dry-run，不部署。
- `npm run deploy`：部署正式 Worker。

## GitHub Actions

`.github/workflows/validate.yml` 在 `main` push 與 PR 時執行：

1. 安裝依賴。
2. 執行完整 regression。
3. 建置單一 Worker bundle。

正式 workflow 使用唯讀 `contents: read`，不得在驗證中修改 `main`。

## 部署通知

程式支援 Cloudflare Workers Builds Event Subscriptions，仍由原本 `qqai` Worker 消費事件，不新增第二個 Worker。通知只處理 `main`，以 Build UUID 去重；失敗詳情只通知開發者。

## 授權與責任

本專案由 `ray20123315` 維護，採用儲存庫現有的自訂限制性授權條款。使用、修改或散布前請先閱讀授權文件及原 README 歷史中的條款；軟體按現狀提供，使用者自行承擔部署、帳號與資料風險。
