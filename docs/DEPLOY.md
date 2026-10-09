# QQAIBOT - NapCat 原生跨群橋接設定

## 第一群建立與其他群加入

1. NapCat WebSocket Client：名稱 `QQAIBOT-Bbot`、URL `wss://aibot.ray2025.com/onebot`、訊息格式 `Array`、Token 與 Cloudflare Worker Secret `ONEBOT_ACCESS_TOKEN` 相同、心跳 `30000` 毫秒、重連 `5000` 毫秒。
2. 健康檢查 `https://aibot.ray2025.com/health` 應回傳 `bbot.connected=true`；若無，查 NapCat 握手狀態及 Token（HTTP 401 表示未通過驗證）。
3. Bbot 需位於至少兩個 QQ 群；Worker 透過 OneBot `get_group_member_list` 核對使用者 QQ 號與 owner/admin 角色。
4. 第一群直接傳普通訊息 `!use`（不加 @AIBot）。Bbot 直接回覆 12 字連線碼。
5. 第二群由群主／管理員傳 `!這個連線碼 群簡寫`；Bbot 確認管理身分後立即加入，**無需 Abot Group OpenID，也不必 /verify**。
6. 用 `!status` 檢查各群狀態及加入群數；正常聊天則經 D1 outbox 轉發。

## 指令與安全

- `!use`、`!代碼 簡寫` 可由群主、管理員、受保護 QQ 帳號或本群受授權成員執行。
- `!stop`、`!leave`、`!revoke`、`!code`、`!rename`、`!grant`、`!ungrant` 保留受保護群權限要求；`3569028262`／`2681167798` 在群內時，未授權管理員不能停止，只有受保護 QQ 可授權。
- 缺少新鮮的 OneBot 群成員名單時，拒絕會更改群組／連線的管理操作。
- `!verify` 改為說明訊息；NapCat 直接驗證管理身分，不要求額外官方雙向校驗。

## Abot 與 Bbot 發送

目的群具有**真實的 Group OpenID** 時，轉發仍由 Abot 官方 API 優先、明確拒絕時 Bbot 備援；如果目的群只有 NapCat 群號，無法使用 Abot API 定址，直接透過 Bbot OneBot `send_group_msg` 發送。
NapCat 原生目標群的 D1 `group_openid` 欄位使用 `napcat:<群號>` 合成識別鍵，**不能傳給 QQ 官方 API**。原先的 Abot 配對資料及所有舊 D1 表保留，沒有清空。
D1 outbox 在群訊息入站後排隊，OneBotHub 在短延遲 alarm 分送（Cron 亦為備援），OneBot 發送須收到 ACK 才標記成功；結果不確定時不盲目重試。

## 舊 QQ 指令面板

QQ 客戶端的 `/!设置插话率` 等舊選單來自 QQ 開放平台「指令配置」，不是 Worker 源碼；應由帳號管理員到 QQ 開放平台刪除舊配置。新 Worker 完全不依賴它。

## 驗證

CI 透過 `npm run check` 運行 Node 測試和 Wrangler dry-run。跨群文字、圖片、語音、影片與 @ 仍需要真實群組端到端驗證；AI 聊天維持停用。

## Bbot 熱更新後必須重新連線

本次 NapCat 原生控制器使用新的 Durable Object 身分 `bridge-bbot-napcat-v2`，避免舊 WebSocket 長時間停留在更新前的程式版本。
正式部署後，請在 NapCat 的 WebSocket Client 將 `QQAIBOT-Bbot` **先停用，再啟用一次**（或直接重新啟動該 Client），以建立新連線。
無須變更 Token 或 URL。重新連線後，透過 `/health` 檢查 `bbot.connected`，再在群裡發送普通文字 `!use`。
