
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

本專案已實作 API 發送與錯誤紀錄，但**不能保證 QQ 平台接受、不能宣稱所有一般訊息可即時跨群發送**。失敗的佇列項目記錄為 failed，不盲目重試（避免重複與刷屏）；不偷改由 Bbot 發送。

QQ 官方群訊息格式是否接受 `<@!member_openid>` 也需要以實際 Abot 帳號測試。預設 `BRIDGE_REAL_MENTIONS=false`，此時顯示文字 `@QQ號`；僅在獲准且實測有效時啟用。

任何群的管理員可由 QQ 平台移除 Bot，本系統無法也不應繞過平台權限。

## 上線關卡

`npm run check` 驗證純函式與 Wrangler dry-run。實際發送前另須確認：
- Bbot 成功完成 WebSocket 認證並回覆 get_group_member_list。
- Abot Gateway 成功建立連線、官方事件到達。
- 在隔離沙箱中，用兩個不同 QQ 群測試主動發送與 @ 真實通知。
- 真正的 QQ API 回傳成功，且目標 QQ 群確實顯示訊息，才可以把傳輸標為 VERIFIED。

若官方限制阻斷，不應自動升級至正式 main。
