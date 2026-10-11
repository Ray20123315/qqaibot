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

## 政治話題限制（2026-10-10）

QQAIBOT AI 助理**不討論政治相關話題**。Abot 官方 AI 與備用 Bbot AI 路由共用 `src/topic-policy.js`：收到明顯涉及政治、選舉、政黨、政府政治、政治人物等主題的問題時直接回覆「抱歉，我不討論政治相關話題。可以聊聊其他主題。」，不呼叫模型；模型系統指令禁止政治話題；模型仍意外生成政治內容時，回覆會再被替換成相同的拒答訊息，不保存該段政治輸出到短期對話歷史。繁中、簡中及英文均有回歸測試。

這是保守規則與關鍵詞防線，不是完整語意分類；可能出現漏判或誤攔截。一般問答、操作指令、跨群插件的原始訊息傳遞不受這條 AI 生成限制影響。**真實 QQ 發送仍受 QQ 官方權限限制**。

## 精簡純文字與長度（2026-10-11）

QQAIBOT AI 使用純文字，不輸出 Markdown 標題／粗體／程式碼圍欄等標記。系統指令優先要求 1–3 段自然且完整的回答，約 120–350 中文字；**不在句子中間截斷**。超長答案會請模型重寫成完整短答；如果仍無法安全縮短，請使用者拆開問題。QQ 官方單則文字限制交給發送前明確驗證，不再默默做固定字數 `slice`。

## Codex Bridge（Windows EXE）

現有 Cloudflare `CODEX_BRIDGE_ACCESS_TOKEN` 用於 `wss://aibot.ray2025.com/v3/codex-bridge`；保留舊 EXE 的 `qqai-codex-bridge-v1` Hello/Request/Response 格式。WebSocket 已在線時 AI 會優先送 `model=gpt-6-luna`、`reasoningEffort=none`，用 QQ 群／用戶的不可逆雜湊建立穩定 sessionKey；連線中斷或回覆失敗回退既有 Gemini。

Codex 的 Windows 工具來源移回 `tools/codex-work-bridge.mjs`、`tools/codex-bridge-windows.mjs`，並加上 CLI non-think 設定。注意：「session 保留」是 Codex 對話延續和 EXE WebSocket 常駐，並不表示 GPT 模型權重在本機常駐；Codex CLI 仍按要求啟動執行。必須以本機登入狀態與支援的模型名稱實測；不能只根據服務端送出的字串宣稱已成功使用 Luna。Secret 不寫入 repo，使用原本 EXE 的設定檔即可。

## Bbot D1 + Vectorize 記憶

保留 Cloudflare 既有 D1 `qqaibot`、既有 1024 維 Vectorize index `qqai`，與 `VECTORIZE_GEMINI_KEYS` 嵌入金鑰池，不新增重複資源。Bbot 群內指令：
- `!memory status`：查看本群記憶狀態
- `!memory on`、`!memory off`：管理員按既有受保護 QQ 權限規則切換
- `!memory clear`：有權限的管理員清除本群已儲存內容

記憶**每群預設關閉**，啟用後只收集純文字正常群訊息，不收集圖片／語音／分享卡片與已識別的政治話題；每群每日最多 200 條，保留兩天。Bbot 寫 D1，Google `gemini-embedding-001` 輸出 1024 維向量進 Vectorize；索引失敗時 D1 不丟失。被撤回的原訊息會從 D1／向量索引同步刪除。

Abot 用 QQ 官方 group_openid，Bbot 用數字 QQ 群號；**只對既有 verified bridge_groups 映射的群**檢索 Bbot 記憶。查詢附群 namespace 並在 D1 再驗證群 ID，不能跨群猜測或混用。未有明確映射的群，Abot 不會取得 Bbot 群紀錄。AI 記憶內容只能當參考，不可視為指令。

## 測試限制

GitHub 自動測試只使用模擬 EXE、Gemini 與 Vectorize；正式 QQ 傳訊、EXE 是否在線、Luna 模型是否支援、實際 1024 維嵌入與 D1 群組映射，仍需要線上驗證。跨群插件保持預設關閉；Abot AI 與 Bbot 收集分工不會讓兩者同時回覆。

## 2026-10-11 Codex Bridge EXE 雙擊閃退／啟動 UX 修復

原版的**無參數啟動**會立即分離背景程序並關閉視窗，尚未填寫設定時則建立 JSON 範本後結束。這不一定是程式崩潰，但使用者看不到任何診斷。

新版 Windows x64 EXE 的預設雙擊行為改為**前景可見**：
1. 在主控台顯示啟動、連線、Worker 已握手、斷線重連、無 Codex CLI 或 HTTP 401 等狀態。
2. 沒有設定時自動建立 `%APPDATA%\QQAIBOT\codex-bridge.json`，並開啟 Windows 記事本。請只在本機填入原有 Bridge Token 的 `bridgeToken` 欄位；關閉記事本後會自動重新讀取並嘗試連線。Token 不會印在主控台與日誌。
3. 初次設定範本的 `readRoots` 為空物件，不再假設電腦存在 `D:\QQAIBOT`。需要 CodexWork 讀檔權限時，才由使用者明確指定資料夾。
4. 設定無效時顯示錯誤原因和檔案位置；雙擊啟動會保留主控台，等待 Enter 才關閉。成功連上後則維持視窗和 WebSocket 常駐。
5. 日誌位於 `%LOCALAPPDATA%\QQAIBOT\logs\codex-bridge.log`，只寫入安全狀態碼、時間與事件，不記錄任何 Token 或 QQ 訊息文字；超過 512 KiB 會輪替。

另外提供 `--diagnose`（不發送請求，只檢查本機設定、Token 是否存在及 Codex CLI 可執行性）、`--run`（明確前景）、`--background`（使用者明確要求才隱藏背景）、`--install-startup`（保持先前登入啟動相容）和 `--help`。

實際 Windows 雙擊與使用者本機 Codex 登入狀態仍需人工測試；Windows CI 會驗證 EXE 的 `--help`、首次 `--diagnose` 設定建立，以及缺少 Token 的失敗碼，避免只有 smoke test --help 就宣稱啟動正常。

## 2026-10-11：原生 Windows GUI 版本

**`QQAIBOT-CodexBridge.exe` 是真正的 Windows WinForms 圖形程式（WinExe，無 CLI 視窗）**，取代先前以 Node pkg 建置的主控台啟動器；同 ZIP 附上 `QQAIBOT-CodexBridge-Backend.exe`，負責與 Worker 持續連線、使用既有 Codex CLI，兩個檔案必須放在同一資料夾，請務必完整解壓。

視窗提供：Bridge 連線狀態、Worker 握手資訊、`wss://aibot.ray2025.com/v3/codex-bridge`、遮蔽的 Bridge Token 欄位、Codex CLI 指定、儲存設定、啟動／停止、進階設定（Notepad）、安全診斷訊息、縮小至系統匣。設定沿用 `%APPDATA%\QQAIBOT\codex-bridge.json`，只改 GUI 控制的三個欄位，舊 CodexWork 的 readRoots、editRoots 等設定不覆蓋；密鑰絕不寫入 Git 或應用程式日誌。前景 GUI 透過子程序執行既有 Bridge CLI，啟動與狀態不需要使用者自行敲終端指令。GUI 關閉時關閉 Bridge，縮小到系統匣則保持連線。

Windows CI 除了測 Node Bridge 後端的第一次啟動、Token 缺少和設定建立，還檢查原生 GUI `--self-test` 及編譯後 PE Subsystem=2（Windows GUI），以防再次把 CLI 誤標為 GUI。GitHub mock／CI 通過不代表已確認使用者 Windows 上的 Codex CLI 登入與 Luna 模型可用。

### 過期 QQ 官方指令選單

使用者看見的 `/!设置插话率`、`查看主动插话暂停状态` 是 QQ 客戶端原生「/」指令建議，不是目前 QQAIBOT AI 的有效功能。程式碼與回歸測試保證不重新註冊這些名稱；既有 QQ 平台發布資料必須在 **QQ 開放平台 → AIBot → 發布設定 → 功能配置 → 指令配置** 刪掉並確認發布，詳見 `docs/QQ_COMMAND_PANEL_CLEANUP.md`。不能聲稱 Worker 程式部署已刪除遠端平台選單。

## QQ 舊指令面板一次性清理

已補上 QQ 官方指令面板 API 的精確比對，移除不存在的 `/!设置插话率` 項目，其他指令全部保留。清理結果可在 `/health` 查看 `abot.command_panel_cleanup`。若為 `no_match` 或 `failed`，請參照 `docs/QQ_COMMAND_PANEL_CLEANUP.md`；不能把尚存在 QQ 客戶端的舊發布指令當成新版程式仍有功能。
