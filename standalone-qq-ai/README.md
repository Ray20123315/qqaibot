# QQAIBOT · 獨立 Unsloth QQ AI

這是 **qq aibot 舊系統以外**的獨立 Cloudflare Worker `qqaibot-unsloth`。它只接 QQ 官方群組 @ 事件 `GROUP_AT_MESSAGE_CREATE` 與私訊 `C2C_MESSAGE_CREATE`，使用固定上游 `https://msiai.ray2025.com/v1/chat/completions` 及 QQ 官方 API 被動回覆。**沒有執行系統指令、工具呼叫、檔案操作、任意 URL 代理的功能**。

## Cloudflare Worker Secrets

在 [Cloudflare Workers & Pages](https://dash.cloudflare.com/) → `qqaibot-unsloth` → Settings → Variables and Secrets，新增以下 5 項 Secret：

| 名稱 | 值 |
| --- | --- |
| `QQ_APP_ID` | QQ 開放平台機器人的 AppID |
| `QQ_APP_SECRET` | QQ AppSecret（Webhook Ed25519 與 Access Token） |
| `UNSLOTH_API_KEY` | 在 Unsloth Studio Settings → API 建立的 API Key |
| `UNSLOTH_MODEL` | Unsloth 實際載入的模型 ID（可由 `/v1/models` 查詢） |
| `ADMIN_TOKEN` | 自訂強隨機密碼（至少 32 bytes），供網頁聊天測試 |

密鑰不可提交 GitHub。若 Unsloth URL 另外設有 Cloudflare Access，請另外配置有權限的 Service Token，現有 Worker 不會繞過驗證。

## QQ 接入

1. **建議建立新的 QQ 官方機器人**。目前儲存庫既有 `qqai` Worker 已有自己的正式 QQ 機器人。不得直接覆蓋原有 QQ 平台回呼，以免中斷舊服務。
2. 完成上述 Secret 後，在 [QQ 開放平台](https://q.qq.com/) 設定回呼 `https://<實際 Worker 網域>/webhook`，開啟 `GROUP_AT_MESSAGE_CREATE` 和 `C2C_MESSAGE_CREATE`。官方會先以 `op=13` 進行無簽名挑戰。
3. 確認 QQ 沙箱成員、事件訂閱、發布資格及 **API 出站 IP 白名單**。一般 Cloudflare Worker 的對外連線不保證固定 IP；如果 QQ App 啟用固定 IP 白名單，必須先提供合規的固定出口才能真正發送。
4. 確認電腦上的 Unsloth Studio 已運行，`msiai.ray2025.com` 的 Tunnel 可用，上游模型 API Key 與模型 ID 正確。
5. 用網頁測試模型，再從 QQ 私訊或群組 @ 官方機器人做端對端測試。

部分 QQ 網路環境無法連接 `*.workers.dev`；此時請在 Cloudflare 綁定獨立的 `*.ray2025.com` Worker Custom Domain，再於 QQ 後台填入該網址。

## HTTP 端點

- `GET /`：簡單管理頁（只提供狀態與管理員文字聊天測試）。
- `GET /api/status`：只顯示各金鑰是否已設定，完全不輸出值。
- `POST /api/chat`：管理測試；`Authorization: Bearer <ADMIN_TOKEN>`，JSON `{"message":"你好"}`，不會傳送 QQ 訊息。
- `POST /webhook`：只接受 QQ 官方事件；`op=13` 回傳 Ed25519 challenge signature，一般事件檢查 `X-Signature-Ed25519` 與時間戳後回傳 `{"op":12}`。

## 安全與限制

- Worker 不提供 Shell、RCE、檔案存取、執行程式碼、代理請求或任何模型工具。Unsloth 模型呼叫固定 `tools: []`、`tool_choice: "none"`。
- 上游 URL 固定為 `msiai.ray2025.com`；禁止 HTTP redirect，不能由聊天訊息改變 URL。
- Webhook 非初始化事件需簽章及 5 分鐘時間窗；原始訊息不落盤，也沒有跨回合記憶。
- 每次模型回覆須在短時間內完成，Worker 使用 `waitUntil` 處理 ACK 後回覆；慢模型可能逾時失敗。
- 目前只實作 **單 isolate 記憶體短期去重**，不保證多實例下嚴格去重；QQ 自身的 `msg_id/msg_seq` 可輔助防止重覆回覆。若正式要大規模上線，需新增獨立 Queue/D1 與頻率限制。
- 請在 Unsloth 本機另外停用 MCP、Shell、Computer Use 等具操作權限的功能；Worker 不能控制本機其他程式。

## 部署與驗證

在本目錄執行 `npx wrangler deploy`（需有 Cloudflare 登入權限）。這與根目錄 `wrangler.toml` 的 `qqai` 不同。以 `npm test` 驗證基本功能；沒有 Secrets 的部署只提供管理頁與設定狀態，不等於 QQ 與模型已連線。
