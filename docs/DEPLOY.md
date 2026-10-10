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

## 政治討論封鎖

`src/topic-policy.js` 以全域 AI 話題限制實作：輸入先於 Gemini 請求攔截、Abot/Bbot 模型 system instruction 加入限制、模型輸出再做檢查及固定拒答。拒答的政治內容不寫入 AI 對話歷史。測試 `tests/political-policy.test.mjs`、`tests/abot-ai.test.mjs`、`tests/assistant.test.mjs`，須確認政治問題 0 模型呼叫、生成政治內容不原樣發送、正常提問不被拒絕。這不會自動刪除舊歷史政治對話或過濾跨群插件的他人訊息，也不能保證涵蓋所有變體與隱語。

## 2026-10-11：Codex 與記憶整合

- Cloudflare Worker `qqai`：新增原 EXE 已使用的 `/v3/codex-bridge`，只接受有 `CODEX_BRIDGE_ACCESS_TOKEN` Bearer Token 的 WebSocket upgrade。OneBotHub 以不同 tags 管理 NapCat 與 Codex，避免斷線與訊息互相混淆。
- EXE 發送 `hello` + `qqai-codex-bridge-v1`，Worker 回 Hello；Worker Chat 請求指定 `gpt-6-luna`、`reasoningEffort=none`、哈希 sessionKey。更新版 Windows EXE 會把 none 映射成 `codex exec -c model_reasoning_effort="none"`；需確認安裝的 CLI 真正支援該模型和 config。
- `wrangler.toml` 增加既有 `qqai` Vectorize 綁定、`BOT_MEMORY_ENABLED=true` 表示允許此功能，但每個 QQ 群仍須管理員輸入 `!memory on` 才開始收集。
- D1 新表 `bot_memory_groups`、`bot_memory_items`，只新增、不改／刪既有 schema；群命名空間限制 Vectorize 的跨群檢索。
- 檢查 `/health` 的 `codex.connected`、`memory.collection_available`、`memory.vectorize_bound`，不公開金鑰。
- 不能假裝原本 EXE 已在線，不能因 API mock 成功聲稱 Codex／實際向量嵌入可用。正式驗證時先在小群由有權限者啟用記憶，單發普通訊息，確認 D1 和 Vectorize 檢索後再測 Abot。
