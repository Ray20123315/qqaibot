# QQAIBOT · Bbot（NapCat）單一模式

**Abot／QQ Open Platform 暫停。** 本 Worker 不會建立新的 QQ 官方 Gateway 連線、處理官方指令或呼叫官方發送 API。所有群組的訊息接收、QQ 號與群成員身分查核、邀請碼、回覆、管理指令及跨群轉發都由 **Bbot（NapCat / OneBot）** 完成。

Cloudflare Worker + D1 負責群組連線、去重、權限和待發送佇列。AI 聊天、舊插件和 QQ 快捷面板均不載入。完整原版程式仍保存在 `archive/legacy-main-20261009`。

## 指令（在群內傳普通文字，不加 @）

| 指令 | 用途 |
| --- | --- |
| `!use` | 第一個群建立跨群連線並取得邀請碼 |
| `!連線碼 群簡寫` | 其他群加入相同連線，Bbot 驗證本群管理身分 |
| `!status`、`!help` | 查詢狀態及指令 |
| `!code`、`!revoke` | 換發或撤銷邀請碼 |
| `!rename 名稱` | 修改群簡寫 |
| `!stop`、`!resume`、`!leave` | 停止、恢復、退出 |
| `!grant QQ號 manage\|stop\|both`、`!ungrant QQ號` | 授權與取消授權 |

`/!use` 與 `/use` 仍可解析，最推薦 **`!use`**。無須加入 Abot，無須 Group OpenID，無須 `/!verify`。原先 Abot 建立的待驗證代碼不能當成 NapCat 邀請碼使用，舊資料不刪除。

QQ `3569028262`、`2681167798` 為受保護帳號；群內有任一在場時，未獲授權的群主／管理員不能經本系統停用或退出橋接，只有受保護帳號可授權其他人。群主／管理員仍可正常建立或加入群組連線。這不會阻止 QQ 群主使用 QQ 平台本身的管理功能。

## 發送方式

目標群必須有已核實的數字 QQ 群號。Bbot 使用原生 OneBot `send_group_msg` 轉發文字、真實 @（需最新目標群成員資料）、圖片、語音、影片與檔案訊息段；格式依 NapCat/QQ 客戶端能力而定。所有歷史群組，包括原本有真正 OpenID 的目的群，也**只使用 Bbot**。

若目標沒有 QQ 群號，系統明確記錄失敗，絕不拿 OpenID 當 QQ 群號或改呼叫 Abot。發送需要 OneBot 回覆 ACK；回覆結果不明時禁止盲目重送。Bbot 離線時，cron 保留 pending 佇列以待重新連線。

## 連線與健康檢查

設定 NapCat WebSocket Client：
- URL：`wss://aibot.ray2025.com/onebot`
- 消息格式：`Array`
- Token：等於 Cloudflare Secret `ONEBOT_ACCESS_TOKEN`
- 心跳／重連：`30000`／`5000` 毫秒

`GET https://aibot.ray2025.com/health` 應顯示 `mode="bbot-only"`、`abot.enabled=false` 及 `bbot.connected`。

Cloudflare 原有 QQ_OPEN_GATEWAY 類別與 D1 不刪除（為了保護舊 migration）；舊 Gateway 的已知實例會被要求關閉。QQ 開放平台端殘留的舊指令面板與 Bot 帳號需另行管理，Worker 部署不會刪掉 QQ 平台的選單配置。

完整步驟與風險參考 [部署與測試](docs/DEPLOY.md)。

## 多群加速：並行 OneBot 送出（2026-10-10）

- 同一則來源訊息的文字、圖片與表情等可用 OneBot 訊息段，盡量合併成**每個目標群一筆** `send_group_msg`，避免拆成多則。
- **同時最多處理 4 個不同目的群**；同一目的群仍按原始佇列順序送出，每筆都要收到 NapCat ACK 才標記成功。
- 新訊息入列後的 Durable Object alarm 排程縮短至約 50 毫秒，下一批超過 20 筆會續排，不必等到整分鐘 cron。
- Cron 僅通知同一個 OneBotHub 排程，不直接搶送；避免 cron 與 alarm 對相同群的佇列造成順序競爭。
- `/health` 提供 `bbot.connected`、`bbot.websocket_count`、`last_connected_at`、`last_event_at`、`last_closed_at`，便於追查你遇到的 `connected=false`。
- 訊息經 NapCat／QQ 平台的實際速度仍受網路與平台限制，**不能保證**三群一定在 5 秒內完成；可看 Worker `BBOT_BATCH_RESULT.duration_ms` 找瓶頸。

## 2026-10-10：舊 WebSocket 熱實例切換

Cloudflare 部署並不會強制中斷已經建立的 Durable Object WebSocket。觀察到 `bridge-bbot-napcat-v2` 仍執行舊程式（新 Cron 呼叫 `/flush` 得到 HTTP 404），因此新並行版使用獨立的 `bridge-bbot-parallel-v3`。**部署成功之後，請在 NapCat WebSocket Client 停用再啟用一次。** URL、Token、群組資料均不必改。

新版 `GET /health` 會回報 `bbot.hub_generation="parallel-v3"`，而 `bbot.connected=true` 只在新 WebSocket 真正連上後出現；尚未重連時顯示 false 是預期的。若重連後仍 false，請查看新的 `last_connected_at`、`last_event_at` 和 `last_closed_at`，並檢查握手是否 101（而非 401）。舊 DO 可能繼續在幾分鐘內留下事件紀錄，但不再作為新路由。
