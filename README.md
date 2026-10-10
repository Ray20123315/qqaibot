# QQAIBOT · Abot 官方 AI 助理（試行）

**AI 訊息由 Abot（QQ 官方 API）接收與回覆，不再由 NapCat/Bbot 發送 AI 答案。**

- 官方 Abot 監聽 `GROUP_AT_MESSAGE_CREATE`（以及確定 @機器人的 `GROUP_MESSAGE_CREATE`），僅在使用者提及時回覆。普通群聊不主動插話。
- Abot 官方回覆使用 **原始 `msg_id`**，以 `POST /v2/groups/{group_openid}/messages` 被動回覆；不使用主動推送，亦不讓 Bbot 假裝官方發送成功。官方群被動回覆有效期限約 5 分鐘。
- AI 繼續透過既有 Cloudflare Secret `GEMINI_API_KEYS` 呼叫 Gemini；`DEEPSEEK_API_KEY` 與歷史使用者配額設定仍保留。正式 Abot 首版預設 Gemini，**不自動切換為付費 DeepSeek**。
- 群別與發訊者 OpenID 隔離對話歷史；簡單每日 20 次個人／120 次群組限額、每則事件去重，錯誤僅記錄安全狀態碼，不記錄 Secret 或聊天內文。
- Abot 支援 `@Bot 你好`、`@Bot !help`、`@Bot !status`、`@Bot !clear` 及 `@Bot !ai 問題`。QQ 官方事件若只訂閱 @，單獨 `!ai` 不會抵達 Abot，請先 @Bot。
- `!model`／群管理等涉及官方 OpenID 身分與權限映射的操作暫不向 Abot 開放，避免不安全授權；後續可建立有驗證的管理入口。
- Bbot 保留 NapCat WebSocket 與原有跨群插件，**跨群預設關閉**。Bbot 不再回覆一般 AI 訊息；有權限者仍可在 Bbot 管理入口 `!plugin bridge on/off` 切換。
- 原完整 AI/Bbot 版本備份在 `archive/bbot-ai-before-abot-20261010`；更早版本 `archive/bbot-bridge-before-ai-20261010`、`archive/legacy-main-20261009` 保留。
- Cloudflare Durable Object `QqOpenGateway` 維持舊遷移 class，正式執行個體名稱改 `qqai-abot-passive-ai-v1`，由 Cron 保持 Gateway 連線及心跳。舊 Abot Gateway 執行個體會收到關閉要求。

## 健康檢查與測試

`https://aibot.ray2025.com/health`：
- `mode=abot-ai-passive`
- `primary_command_transport=abot`
- `abot.enabled=true`
- `abot.connected=true`、`abot.session_ready=true`（需 Gateway 真正 READY）
- `abot.last_error`：只顯示不含金鑰的錯誤碼

先在一個你管理的小型 QQ 群 **@AIBot !help**，確認 Abot 官方身分直接回答；然後單次 **@AIBot 你好**，才測真實 Gemini 呼叫。若官方回應 HTTP 403、40034105 或 其他拒絕，不會自動交給 Bbot 發送，請提供健康檢查與時間點以便查日誌。

QQ 官方群被動回覆使用 msg_id（需在有效期內），不保證群組已有 Abot 權限或事件訂閱；須先確認 QQ 開放平台 Bot 已加群並有接收 @ 事件權限。
