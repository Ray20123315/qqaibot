# QQAIBOT · 精簡 QQ AI 助理

新版方向：**Bbot / NapCat 收發、Gemini／DeepSeek 模型、群組隔離、明確觸發、插件預設關閉**。舊版跨群橋接功能保留為獨立插件，不再作為主功能，也不主動插話。

## AI 對話

群聊中只在三種情況回答：

- `@Bot 問題`
- 回覆 Bot 先前的訊息並提問
- `!ai 問題`

普通群訊息不主動回覆。不同 QQ 群、不同成員的短期對話記憶分開保存，最多保留 3 天；個人每日預設 20 次，本群每日預設 120 次（臺灣時間零時重置）。失敗時不將密鑰或模型完整回應寫到日誌。

| 指令 | 功能 |
| --- | --- |
| `!ai 問題` | 直接詢問 AI |
| `!help` | 精簡使用指南 |
| `!status` | AI／模型與 NapCat 狀態 |
| `!setting` | 本群 AI 與插件設定 |
| `!setting ai on\|off` | 管理員開關 AI |
| `!model` | 看本群 AI 模型 |
| `!model gemini` / `!model deepseek` | 管理員切換模型供應商 |
| `!plugin list` | 顯示插件 |
| `!plugin bridge on\|off` | 經權限驗證後開關跨群橋接 |
| `!clear` | 刪除自己在本群的短期 AI 對話記憶 |

跨群橋接**預設關閉**。需要來源與目的群均明確開啟 `bridge` 插件，才能轉發；舊版 `!use`／連線代碼僅在啟用橋接後才處理。舊 D1 邀請碼／連線群資料保留，不自動啟用。

## 既有 API Secret（無須重新提供）

AI 模型直接使用 Cloudflare Worker 已配置的 Secret：

- `GEMINI_API_KEYS`：Gemini（預設），支援逗號分隔金鑰池；模型優先順序取自現有 `GEMINI_CHAT_MODELS`，並有 `gemini-2.5-flash` 相容候選
- `DEEPSEEK_API_KEY`：明確選擇 DeepSeek 才呼叫；模型取自 `DEEPSEEK_FLASH_MODEL`，並有 `deepseek-chat` 相容候選
- `GEMINI_VISION_API_KEYS`：保留供下一階段安全圖片理解使用，本版文字核心不會讀取它的 Secret 內容
- `ONEBOT_ACCESS_TOKEN`：認證 NapCat reverse WebSocket

**不要求 Cloudflare Workers AI binding，也不自動將 Gemini 失敗轉成 DeepSeek 付費請求。** 所有 Secret 都只留在伺服器端，`/health` 僅回報是否配置與可用供應商名稱，不顯示 Key。

## NapCat 連線

WebSocket Client URL 為 `wss://aibot.ray2025.com/onebot`，消息格式 `Array`，Token 對應 `ONEBOT_ACCESS_TOKEN`；心跳 30000 毫秒，重連 5000 毫秒。新版使用獨立的 `bridge-bbot-ai-v1` Durable Object；部署時須讓 NapCat Client 停用／啟用一次，URL 和 Token 不變。

健康檢查：`https://aibot.ray2025.com/health`。AI 助理資訊會顯示 `mode=ai-assistant`、`bbot.hub_generation=ai-v1`、`assistant.configured` 與 `assistant.providers`。

## 簡化原則

- 舊版完整程式另存 `archive/bbot-bridge-before-ai-20261010`，更早的完整原始 main 在 `archive/legacy-main-20261009`
- 不刪除既有 D1 橋接、ACL、成員名單或 Secret；跨群插件只在明確啟用後動態載入
- Abot／QQ Open Platform Gateway 持續停用
- QQ 群真實 AI 回覆、Gemini／DeepSeek 上線流量及圖片理解均需分階段驗證，CI mock 不能當作真實模型成功證明
