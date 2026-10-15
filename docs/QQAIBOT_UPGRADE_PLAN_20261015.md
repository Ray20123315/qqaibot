# QQAIBOT 完整升級：分階段實作與驗收

狀態：2026-10-15，僅草稿 PR `#81`；不是正式部署或完整交付。

## 0. 已確認現況與風險
- `main` 程式以 Abot 官方被動 AI、Bbot/OneBot 手動 `/跨群 <文字>`、D1/Vectorize、Windows 原生 GUI Bridge 為主；入口 `worker.js` 並未提供完整舊版 Portal 的管理頁面／API。
- `archive/legacy-main-20261009` 是舊系統備份，含 Portal、社交人格、管理／插件模組。不得直接以舊 `worker.js` 覆寫目前 `main`，也不得直接恢復已刪除的功能。
- 後台帳號、QQ 群綁定、D1、Vectorize、Cloudflare Secrets、Protected QQ、停用中的跨群設定均不可清空或自動重啟。
- Code 變更留在功能分支；不對正式 D1 做 migration、不改 Cloudflare Production、不推進 `main`。
- 開發者本機 Codex CLI 的模型識別及 inference effort 不可僅根據 Bridge 字串推斷支援；必須使用實際介面能力檢查。

## 1. Phase 1：Gemini 優先與抗刷（本 PR）
- [x] 移除正常 AI 聊天的「Bridge 在線即優先 Luna」邏輯；仍保留原 Bridge 協定與 GUI。
- [x] 移除 Abot 固定每日 20 人／120 群 Gemini 限制，採 D1 原子限流：每使用者／每群／每 10 秒最多 4 次 AI 生成。
- [x] 保留事件去重、政治話題規則、原本的 QQ 被動發訊路徑。
- [x] 更新失效測試並新增回歸測試；首次 106 項 105 通過，修正舊期望後 CI run 38729107874 SUCCESS。
- [ ] 真實 D1 migration 和 QQ 回覆尚未測試；CI 使用模擬 D1 和 Wrangler dry-run，不能視為 Production 驗收。

## 2. Phase 2：配額、備援與 Agent 安全基礎（未實作）
- 建立跨群統一、經驗證的 QQ 身分映射（Abot OpenID ≠ Bbot 數字 QQ）。不得將未驗證映射當作唯一配額依據。
- Luna 主動聊天獨立每日 10 次；按 Asia/Taipei 重置，跨群原子計量及重送去重；配置後台管理。
- Gemini 故障僅限可辨識的 429/5xx/網路暫時性錯誤，經持久化 30 秒冷卻與獨立全站 DO 3 並行閘門，才可經明確授權備援至 Luna None；備援不扣主動 Luna 額度；預設關閉直至驗證完成。
- 全站 Codex 熔斷、模型與推理參數能力偵測；Sol Low 僅開發者，Max/XHigh 只允許受控功能。
- Agent 以 preview/edit/recheck/confirm/run/state/stop/history 狀態機實作；每日 5 次，在使用者確認並資源預留成功後才扣額度；取消與逾時不扣。
- 文件及命令安全先於功能開放：獨立 VM 驗證、專用暫存區、拒絕主機 Shell/掛載/憑證/符號連結/Junction/路徑穿越；權限檢查在後端執行。隔離測試失敗時所有檔案、Shell 工具一律不可用。

## 3. Phase 3：舊人格與網站（未實作）
- 從備份逐段還原有效聊天風格、純文字、政治話題規則；與系統安全政策分層。
- 從現有 Portal schema 和 API 評估保留路線；必要時另建安全兼容層，不以本次極簡 Worker 偷換登入或直接套回舊版。
- 提示詞版控／審閱／測試／回退；所有全站限制、Sol、Max 與 Agent 政策只能由後端驗證開發者身分。
- 繁中、簡中、英文 i18n 和原站互動風格；儲存後 read-back 驗證。

## 4. Phase 4：插件系統（未實作）
- 活動：D1 group-scoped event/participation/action log；以單一條件 INSERT 或受限 transaction 防止滿額競態、重複參與；建立/報名/退出/取消、主辦人與群管理授權、提醒去重；QQ 文字指令確保真正能送出，官方互動按鈕經平台實測支援後才啟用。
- 功能實驗室：提案、狀態機與每人每提案唯一投票，開發者最後決定採用；任何投票不可自動觸發 Agent。
- Max 特殊玩法預設關閉；明確上限、專屬權限與無檔案工具。
- 預設關閉不必要插件，保持 `/跨群 <文字>` 唯一轉發觸發方式。

## 5. 驗收與發布 Gate
1. 隔離、身分、額度及全站並行測試皆必須通過，不能由提示詞代替。
2. D1 遷移只能在備份及 staging 使用 `CREATE TABLE IF NOT EXISTS` 一類可重入擴充；正式資料只在明確授權後變更。
3. 過測後於 staging 使用模擬 QQ Gateway/OneBot 做收送整合；真實 QQ 群僅使用管理員授權的小群測試。
4. 所有 17 項需求驗收通過、網站登入兼容、Abot/Bbot/Bridge 無回歸，才能請求正式合併與部署。
5. 任何待驗證工作以 UNKNOWN/未完成標示，不可讓 README 或後台假裝已上線。

唯一下一步：建立 Phase 2 的「經驗證跨群身分／獨立 Luna 配額」資料模型與隔離測試，先核對既有 D1 schema 及 Abot/OpenID 對映來源。
