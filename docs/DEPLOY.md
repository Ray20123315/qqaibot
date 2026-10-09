# Bbot-only 部署與測試（2026-10-10）

目前完全停用 Abot 的官方 Gateway 與 QQ Open Platform 發送 API；只保留歷史 Durable Object/D1 資料與設定，供日後恢復時參考。**不要再使用 @AIBot /!use。**

## NapCat WebSocket Client

| 欄位 | 填寫內容 |
| --- | --- |
| 名稱 | `QQAIBOT-Bbot` |
| URL | `wss://aibot.ray2025.com/onebot` |
| 訊息格式 | `Array` |
| Token | 與 Cloudflare Worker Secret `ONEBOT_ACCESS_TOKEN` 完全一致（不要公開） |
| 心跳間隔 | `30000` 毫秒 |
| 重連間隔 | `5000` 毫秒 |

部署時沿用 `bridge-bbot-napcat-v2`，若已連線，無須更動 Token 或 URL。若 `bbot.connected=false`，可以在 NapCat 將 WebSocket Client 停用、再啟用一次。

## 使用方式

1. 在有 Bbot 的第一個群**不加 @** 發送普通文字 `!use`，由 NapCat 驗證該群管理身分並回傳邀請碼。
2. 在第二個有 Bbot 的群由群主／管理員發送 `!連線碼 群簡寫`；NapCat 直接識別群 QQ 號並加入同一連線。
3. 使用 `!status` 確認連線群數；再測試一則普通聊天及圖片。
4. 使用 `!stop`／`!resume` 控制群組轉發。QQ `3569028262`、`2681167798` 的保護／授權規則不變。

## 送出規則

目的群必須有可信任、非空的數字 QQ 群號。文字、QQ @、圖片、語音、影片與檔案依 OneBot 訊息段由 Bbot 發送；格式依 NapCat 和 QQ 用戶端支援情況可能有限制。官方 OpenID **不會被用來發送**。

Worker 的 scheduled cron 不再打開 QQ Open Platform Gateway，只執行 Bbot outbox 配送，並要求兩個歷史 Gateway DO 關閉；原 class 維持無作用狀態以保證既有 Cloudflare migration 相容。

## 監控與安全

- `GET https://aibot.ray2025.com/health`：應顯示 `mode=bbot-only`、`abot.enabled=false`、`bbot.connected=true`。
- 假如 WebSocket 握手收到 HTTP 401，檢查 Token；不可把 Token 交給 QQ 群或 Git。
- Bbot 離線時，outbox 暫存訊息不立刻宣告已發送；重新上線後依序處理，但 ACK 結果未知者不盲目重試，以免重複訊息。
- QQ 開放平台的舊 slash 面板是獨立配置，程式暫停 Abot 不會刪掉那份設定。
- 保留完整舊版 Git 分支 `archive/legacy-main-20261009`，不刪除歷史 DB 資料。
- AI 聊天維持停用。

## 並行轉發與 WebSocket 診斷（2026-10-10）

- Bbot 的群組發送改為最多 4 組並行（各群組內仍依序）；OneBot 接受 Array 訊息段，因此同一來源訊息可盡量合併文字、圖片、表情為一個訊息，不再每一類分別等待 ACK。
- DO `alarm` 會在入列後約 50 毫秒喚醒，而非固定 1 秒；繁忙時續排下一批。Cron 僅喚醒同一 DO，不直接和 DO 搶發送佇列。
- 新 `/health` 的 `bbot.connected` 僅表示當下存在 readyState=OPEN 的 WebSocket，`last_event_at` 只表示曾有最近訊息，**不能當作仍連線**。有 `last_event_at` 但 `connected=false` 時，檢查 `last_closed_at`、NapCat WebSocket Client 重新連線記錄及是否顯示 HTTP 401。
- 詳細延遲由 `BBOT_BATCH_RESULT` 記錄總任務數、目的群數、並行度、成功失敗及 Worker batch 耗時（不寫入 QQ 訊息內容）。
- **不要保證固定秒數**：QQ／NapCat 速率限制、網路與媒體上傳耗時可能仍導致大於 5 秒。若 QQ 拒絕複合媒體訊息，需依實際 OneBot 回傳代碼調整格式。

## 必要：切換新 OneBotHub WebSocket 執行個體

發現現有 `bridge-bbot-napcat-v2` 的舊 WebSocket Durable Object 在新 Worker 部署後仍持續執行過期程式，Cloudflare 日誌出現 `GET https://internal/flush` 回覆 404。新路由改成 `bridge-bbot-parallel-v3`，兩個路徑在程式內共用 `src/bbot-hub.js` 定義。

**部署後務必至 NapCat WebSocket Client 停用，再啟用**，讓它斷開舊實例並向同一個 `wss://aibot.ray2025.com/onebot` 建立新 WebSocket。Token、URL、心跳、重連秒數保持不變；D1 群組連線及邀請碼不會清空。

檢查 `/health`：
- `bbot.hub_generation = "parallel-v3"`
- `bbot.websocket_count >= 1`
- `bbot.connected = true`
- `bbot.last_connected_at` 是此次重連時刻，`last_event_at` 隨入站事件前進

若 still false：NapCat 檢查 WebSocket 連線狀態、是否顯示 HTTP 401、Token 是否與 `ONEBOT_ACCESS_TOKEN` 一致；不要把密鑰張貼到公開群。重連後才測三群同時轉發與 `BBOT_BATCH_RESULT` 耗時。
