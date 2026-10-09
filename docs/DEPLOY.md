
# 部署與驗證

## 必要資源

本改版沿用舊 `qqai` Worker、D1 `qqaibot`、既有 DO migration 歷史與網域，但**使用全新 bridge_* SQL 資料表**，不刪除舊資料表。

Cloudflare Secrets:

- `QQ_OPEN_CLIENT_SECRET`：Abot 的官方 AppSecret。
- `ONEBOT_ACCESS_TOKEN`：Bbot 上報專用高熵密鑰；NapCat 反向 WebSocket 或 HTTP POST 必須傳 `Authorization: Bearer <secret>`。

在 `wrangler.toml` 中設定 `QQ_OPEN_APP_ID`、`QQ_OPEN_INTENTS`；其他祕密不可硬編碼。

Bbot NapCat 反向 WebSocket 使用 `wss://aibot.ray2025.com/onebot`，授權標頭需相符。亦支援 HTTP `POST /onebot`，或 `POST /onebot/roster` 供 HTTP-only 上報更新群員快照。

健康檢查：`GET /health`（僅回覆功能啟用與配置狀態，不洩露密鑰）。

## 安全配對

1. Abot 收到 `@Abot /use` 建立暫存房間與驗證碼。
2. Bbot 使用 OneBot `get_group_member_list` 取得可信數字 QQ ID 名單及身分；此名單僅兩分鐘有效。
3. 同群管理員／群主輸入 `/verify <code>`，Bbot 綁定來源 QQ 群號與 Abot 的 `group_openid`。
4. 新群以 `@Abot /<邀請代碼> <簡寫>` 加入，仍須獨立驗證。
5. 要將 QQ ID 對應成 OpenID，先 `@Abot /id`，再由相同用戶發送 `@Abot /verifyid <code>`；Abot 與 Bbot 雙方看到驗證內容後才建立映射。

權限查核若 Bbot 名單逾期或不可使用，一律拒絕有風險的修改指令。不採信 Abot 任意推導的數字 QQ ID。

## 重大平台限制

騰訊官方文件顯示，自 2025-04-21 起一般的主動推送能力不再提供。跨群轉發時，Abot 在**接收群**沒有該群新的被動回覆 `msg_id`，大多數情況屬於主動發送，因此可能被平台拒絕。

本專案已實作 API 發送與錯誤紀錄，但**是否允許主動發言依各群的機器人設定和平台權限而異，必須以實測為準**。失敗的佇列項目記錄為 failed，不盲目重試（避免重複與刷屏）；不偷改由 Bbot 發送。

QQ 官方群訊息格式是否接受 `<@!member_openid>` 也需要以實際 Abot 帳號測試。預設 `BRIDGE_REAL_MENTIONS=false`，此時顯示文字 `@QQ號`；僅在獲准且實測有效時啟用。

任何群的管理員可由 QQ 平台移除 Bot，本系統無法也不應繞過平台權限。

## 上線關卡

`npm run check` 驗證純函式與 Wrangler dry-run。實際發送前另須確認：
- Bbot 成功完成 WebSocket 認證並回覆 get_group_member_list。
- Abot Gateway 成功建立連線、官方事件到達。
- 在隔離沙箱中，用兩個不同 QQ 群測試主動發送與 @ 真實通知。
- 真正的 QQ API 回傳成功，且目標 QQ 群確實顯示訊息，才可以把傳輸標為 VERIFIED。

若官方限制阻斷時，已加入僅在明確拒絕時由 Bbot 發送的備援；仍須先驗證，才能進入正式 main。

## 2026-10-09 訊息傳送優先順序（v0.0.67）

1. **Abot 優先**：群聊主動發言可能已重新開放。群主在手機 QQ 的「群設定 → 機器人管理／權限 → 允許機器人主動發言」中尋找並開啟選項；實際文案可能因 QQ 版本不同。
2. 可嘗試官方 `GET /v2/groups/{group_openid}/bot_state` 取得 `allow_proactive_msg`（部分帳號未獲白名單權限時會拒絕）；`/status` 將可查到的狀態列出。無法查詢不代表關閉。
3. Abot API 明確拒絕（如 403、22009 或媒體 URL 不受支援），且 Bbot 已連線、具有目標數字 QQ 群號時，透過已授權 OneBot WebSocket 傳送 `send_group_msg`，**等待 OneBot 成功 ACK 才計為送達**。
4. Abot HTTP 超時、斷線、5xx 或 Bbot ACK 超時都屬於結果不明；**不要重送／再次備援**，避免兩個機器人重複發布。
5. 設定 `BRIDGE_BBOT_FALLBACK=disabled` 可完全停用備援；預設 `on-rejection`。
6. `BRIDGE_REAL_MENTIONS=true` 僅在 QQ ID／OpenID 完成雙重識別時採用 `<qqbot-at-user id="..."/>` 官方群聊提及標記；無映射保留文字 @。Bbot 備援時，從有效的目標群成員名單中對數字 QQ ID 執行真正的 OneBot at。

## 媒體處理

Bbot 會保存 OneBot 結構化的文字、@、圖片、語音、影片、檔案、face/mface、回覆／轉發標示。Abot 優先經過 `/v2/groups/{group_openid}/files` 使用安全 HTTPS 公網 URL 上傳圖片／語音／影片／檔案，再以 `msg_type:7` 發送。

當原始媒體沒有可公開存取的 HTTPS URL、官方 API 無法編碼該訊息格式，才改由 Bbot 嘗試原生 OneBot 訊息段；若 Bbot 也無法存取原始附件，記錄失敗。QQ 平台單則富媒體限制可能要求拆分多則依序發送，實際順序與客戶端顯示仍需線上驗證。

**特殊限制**：回覆引用的是來源群訊息 ID，跨群不能直接指向目標群的原始訊息；合併轉發、商城表情、語音貼圖與自訂卡片有版本或權限差異，僅做到已知格式的盡力還原，不保證 1:1。

## 上線前驗證與已知風險

- NapCat 已配置帶驗證標頭的反向 WebSocket，且會完成群名單查詢。
- QQ AppID／ClientSecret 和 ONEBOT_ACCESS_TOKEN 需已設定（不可提交 Git）。
- **正式 main 目前尚未切換**。部署目前仍由原版 Worker 運作；開發分支通過 CI 不代表群內成功。
- 需確認 Abot／Bbot 兩個 Bot 都在測試群中（Bbot 可以收到群訊息）；若 Abot 不允許主動發言，群主需手動開啟群內的主動推送設定。
- 建議預先取得群成員同意跨群轉發，避免把原群私人內容發給未授權的群。

參考：QQ 官方 [發送訊息規格](https://github.com/tencent-connect/bot-docs/blob/main/docs/develop/api-v2/server-inter/message/send-receive/send.md)、[NapCat 消息段](https://doc.napneko.icu/onebot/segment)、[Chobits 2026 API 聯調報告](https://github.com/xueelf/chobits)。
