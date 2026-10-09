# QQAIBOT AI 助理重構：部署與驗收

## 部署範圍

Cloudflare Worker：`qqai`，自訂域名 `aibot.ray2025.com`。維持既有 D1 ID、Durable Object migration 與 Secrets；設定檔 `keep_vars=true`。

只使用既有 Secret 名稱：`GEMINI_API_KEYS`、`DEEPSEEK_API_KEY`、`ONEBOT_ACCESS_TOKEN`。前兩者由 HTTP 模型供應商介面使用；請勿將內容寫到 GitHub、Worker URL、日志或回覆。Gemini 透過 `x-goog-api-key` request header 呼叫 `generateContent`；DeepSeek 使用 Bearer Authorization 呼叫 `chat/completions`。不新增 Cloudflare AI binding。

## 切換

部署新 Worker 後，必須在 NapCat WebSocket Client 停用／啟用一次，使之連至新的 `bridge-bbot-ai-v1`。原 Token、URL、群組與權限資料維持原樣。

**跨群插件預設關閉。** 舊聯通群不會因部署自動轉發，且至少要來源群與目標群明確開啟插件。新 AI 助理只回答 `@Bot`、回覆 Bot 或 `!ai`。

## 驗證順序

1. GitHub Actions 執行 `npm test` 與 Wrangler dry-run，檢查舊橋接／Abot 安全性及新 AI Secret mock。
2. `/health` 顯示 `mode=ai-assistant`、`assistant.configured=true`，`bbot.connected=true`。若無，先查看 Bot Secret 名稱（非值）與 NapCat 握手。
3. 在測試群 `!help`、`!status`、`!model`（不呼叫模型）。
4. 在測試群單次 `!ai 你好`，確認真實 Gemini 回覆與短期對話；普通訊息不應觸發。
5. 管理員切換 `!model deepseek` 前應確認願意使用付費 DeepSeek 模型。
6. 在兩個測試群均啟用 `!plugin bridge on` 後，才檢查跨群轉發。不要直接在大型群壓力測試。

## 已知限制

初版 AI 核心僅支援文字問答；圖片、語音、檔案理解與外部工具插件先不自動啟用。真實 QQ 媒體不一定可由模型直接讀取，需要額外具權限限制的 Media Resolver。NapCat 可能回傳不同的 message_id 型別，回覆串接需真實 QQ 測試。

模型商可能限速、停用部分預覽模型或變更計費；本版限制為最多兩個同供應商候選模型與兩把 API Key，Gemini 不會自動切到 DeepSeek。
