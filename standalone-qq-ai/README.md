# QQAIBOT · 獨立 Unsloth QQ AI

這是 **qq aibot 舊系統以外**的獨立 Cloudflare Worker `qqaibot-unsloth`。它只接 QQ 官方群組 @ 事件 `GROUP_AT_MESSAGE_CREATE` 與私訊 `C2C_MESSAGE_CREATE`，使用固定上游 `https://msiai.ray2025.com/v1/chat/completions` 及 QQ 官方 API 被動回覆。**沒有執行系統指令、工具呼叫、檔案操作、任意 URL 代理的功能**。

## 網頁配置 Unsloth 模型

Cloudflare 已新增**獨立** Workers KV：`qqaibot-unsloth-config`，Worker binding 為 `CONFIG_KV`，已寫入本資料夾的 `wrangler.toml`。它不使用舊 QQAIBOT 的 D1、DO 或其他 KV。

在 [Cloudflare Dashboard](https://dash.cloudflare.com/) → `qqaibot-unsloth` → Settings → Variables and Secrets，至少設定以下 Secret：

| 名稱 | 用途 |
| --- | --- |
| `ADMIN_TOKEN` | 網頁管理金鑰，請使用至少 32 個隨機字元。也作為加密資料金鑰的來源；**變更後須重新輸入 Unsloth API Key** |
| `QQ_APP_ID` | 新 QQ 官方機器人 AppID |
| `QQ_APP_SECRET` | 新 QQ AppSecret，不能共用公開金鑰 |

之後開啟 [QQ AI 網頁](https://qqbot-ai.ray2025.com/)：

1. 填入管理金鑰 `ADMIN_TOKEN`。
2. 填入 Unsloth API Key（在 Unsloth Studio 取得）。
3. 點選「取得模型清單」，透過固定網址 `GET https://msiai.ray2025.com/v1/models` 讀取 API 回傳的模型 ID。
4. 從下拉選單選取模型，按「儲存並套用此模型」；Worker 會驗證選取的模型是否在清單中，再以 AES-GCM 加密 API Key 和模型設定後寫入專用 KV。
5. 使用網頁聊天室測試，確認正常後再測 QQ 群組 @／私訊。QQ 與網頁使用同一份已選設定。

**不可把 API Key 或 ADMIN_TOKEN 提交至 GitHub、放在網址、日誌、瀏覽器 localStorage 或聊天訊息。** 網頁 API Key 僅在本次表單中暫存，儲存成功即清空。KV 內只有加密密文、IV；加密金鑰由 Worker Secret `ADMIN_TOKEN` 衍生。管理員金鑰遺失或變更後，原密文無法復原；可重新輸入 API Key 覆蓋設定（舊密文無須解密）。

若原本已有 Cloudflare Secret `UNSLOTH_API_KEY`、`UNSLOTH_MODEL`，在未經網頁儲存設定前，仍可作為 fallback。**網頁成功儲存的設定優先於這兩個 Secret。**

## 管理 API

- `GET /api/status`：公開、只顯示已設定狀態；不含 Secret 或模型 ID。
- `GET /api/settings`：管理驗證後顯示已選模型與是否已設定，不回傳 API Key。
- `POST /api/models`：使用 `Authorization: Bearer <ADMIN_TOKEN>` 與 JSON `{"api_key":"sk-local-..."}` 取得模型清單；已儲存金鑰可省略。
- `POST /api/settings`：送 `{"api_key":"sk-local-...","model":"模型 ID"}`，驗證模型清單後儲存。已儲存金鑰可省略。
- `POST /api/chat`：管理驗證的純文字聊天測試，使用目前已選模型。
- `POST /webhook`：QQ 官方訊息入口，維持原 Ed25519 安全驗證。

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

- 管理 API 只接受有管理金鑰的同源操作，API Key 和選擇的模型以 AES-GCM 加密存在獨立 KV；KV 非強一致，更新跨資料中心可能有短暫傳播延遲。
- Worker 不提供 Shell、RCE、檔案存取、執行程式碼、代理請求或任何模型工具。Unsloth 模型呼叫固定 `tools: []`、`tool_choice: "none"`。
- 上游 URL 固定為 `msiai.ray2025.com`；禁止 HTTP redirect，不能由聊天訊息改變 URL。
- Webhook 非初始化事件需簽章及 5 分鐘時間窗；原始訊息不落盤，也沒有跨回合記憶。
- 每次模型回覆須在短時間內完成，Worker 使用 `waitUntil` 處理 ACK 後回覆；慢模型可能逾時失敗。
- 目前只實作 **單 isolate 記憶體短期去重**，不保證多實例下嚴格去重；QQ 自身的 `msg_id/msg_seq` 可輔助防止重覆回覆。若正式要大規模上線，需新增獨立 Queue/D1 與頻率限制。
- 請在 Unsloth 本機另外停用 MCP、Shell、Computer Use 等具操作權限的功能；Worker 不能控制本機其他程式。

## 部署與驗證

在本目錄執行 `npx wrangler deploy`（需有 Cloudflare 登入權限，且會使用本目錄專用 KV binding）。這與根目錄 `wrangler.toml` 的 `qqai` 不同。以 `npm test` 驗證基本功能；沒有 ADMIN_TOKEN 時無法使用網頁設定；沒有 QQ Secret 時無法從 QQ 實際收發；上線驗證必須以真實 API 與 QQ 訊息為準。

## 模型清單連線診斷

若管理頁「取得模型清單」失敗，請保留**錯誤代碼**，不要傳 API Key：

| 代碼 | 意義 | 檢查方向 |
| --- | --- | --- |
| `MODEL_LIST_TIMEOUT` | Worker 等待 12 秒仍無回應 | 電腦上的 Unsloth Studio API 是否在回應；Tunnel 指向的服務連接埠 |
| `MODEL_LIST_CONNECTION_FAILED` | 網路、TLS、DNS 或連線建立失敗 | Cloudflare Tunnel 公開主機名與本機服務是否可達；Worker 到上游的連線 |
| `MODEL_LIST_REDIRECT_301/302/307/308` | 上游要求轉址 | 是否被導向登入、其他路徑或 Cloudflare 防護頁（Worker 不追隨重新導向） |
| `MODEL_LIST_HTTP_401/403` | 上游確實回應拒絕 | Unsloth API Key 或額外的存取控制 |
| `MODEL_LIST_HTTP_502/503/522/524` | 上游或 Cloudflare 錯誤 | 本機推論服務、Tunnel 到本機的連線、逾時 |
| `INVALID_MODEL_LIST` | 上游回的不是 Unsloth 模型清單格式 | 上游 API 路由或服務類型 |

**請在執行 Unsloth 的電腦測試**（Windows PowerShell，先不要貼出 API Key 或回應內的敏感資料）：

```powershell
# 這個檢查只驗證本機是否能與 Unsloth API 取得 HTTP 回應。
curl.exe -I --max-time 10 http://127.0.0.1:8888/v1/models
```

`401` 代表 HTTP API 可以連接，但需要身分驗證；`200` 代表可讀；`connection refused` 或 `timeout` 表示本機 API 服務未就緒。若 Cloudflare Tunnel 指向的並非 `127.0.0.1`，還要檢查它所設定的實際本機位址。

請勿把管理員金鑰或 Unsloth API Key 發到聊天、GitHub Issue 或記錄檔。
