# Abot 官方 AI 試行版部署

## 既有綁定與開關
保留 Cloudflare `QQ_OPEN_APP_ID`、`QQ_OPEN_CLIENT_SECRET`、`QQ_OPEN_GATEWAY`、`GEMINI_API_KEYS`、D1、ONEBOT_HUB、ONEBOT_ACCESS_TOKEN，不讀取或記錄 Secret 值。

`wrangler.toml` 設 `QQ_AI_ABOT_ENABLED=true`，只重新啟用官方 Gateway 的 **AI 被動回覆**，並不啟用跨群 Abot 主動推送。舊 `BRIDGE_ABOT_ENABLED=false` 和 `BRIDGE_MODE=plugin-disabled` 保持不變。

`QqOpenGateway` 使用新執行個體 `qqai-abot-passive-ai-v1`；Cron /ensure 檢查閘道，HELLO op10 後 IDENTIFY op2，HEARTBEAT op1，READY op0；Gateway 斷線依 alarm 安全重連。舊 bridge-abot、bridge-abot-commands-v2 執行個體仍依 cron 關閉。

## 流程與限制
只有官方 `GROUP_AT_MESSAGE_CREATE` 或可證實被 @ 的群訊息會處理。查出 `group_openid`、`author.member_openid`、`id`（原始 msg_id），在 D1 `abot_ai_seen` 做去重與配額；Gemini 從既有 Secret 呼叫，然後帶原始 `msg_id` 官方被動發送。無法確定官方發送成功時不向 Bbot 盲目重發。

建議先測 `@AIBot !help`（不用模型 API），其次 `@AIBot 你好`（Gemini）。若不能收事件檢查 `QQ_OPEN_INTENTS` 和 QQ 群 Bot 權限；若 API 回應錯誤碼 `40034105`，記錄代碼並確認官方主體是否具被動回覆權限。不能將自動測試成功等同 QQ 正式收發。

## 回復
完整上一版 `archive/bbot-ai-before-abot-20261010`；可以將 `QQ_AI_ABOT_ENABLED=false` 關閉官方 Gateway 並保留 D1。所有新增 D1 表採 CREATE IF NOT EXISTS，既有表無刪除。
