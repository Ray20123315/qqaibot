# Environment / Binding Reference

本文件是 **目前 source 實際讀取** 的 Cloudflare bindings、公開 Worker 變數與 Secrets 對照表。  
原則：敏感憑證、密碼、Token、API Key 一律用 Cloudflare Secret；需要由 Cloudflare Dashboard 網頁維護且不可被 Git 部署覆蓋的非敏感變數，使用 Dashboard Variables。正式 `wrangler.toml` 固定 `keep_vars = true`，部署腳本也使用 `--keep-vars`。只有明確由 Git 管理的公開預設值才放 `[vars]`。

> Portal 內部的系統管理員綁定仍固定使用保留名稱 `admin`，但登入名稱與密碼可分別由 `PORTAL_ADMIN_USERNAME` Worker Variable 和 `PORTAL_ADMIN_PASSWORD` Secret 設定。這組變數只驗證登入，不會改寫 D1 管理員身份或舊密碼 hash；兩者都未設定時，維持既有 D1 管理員登入方式。

## 1. Cloudflare bindings

| 名稱 | 類型 | 現況 | 用途 |
| --- | --- | --- | --- |
| `DB` | D1 | 必要 | Portal 帳號、Session、設定、對話、稽核、索引與各類持久資料。 |
| `ONEBOT_HUB` | Durable Object | 必要 | OneBot WebSocket、RPC、事件佇列與連線狀態。 |
| `AI` | Workers AI | 建議 | Workers AI / embedding 等 Cloudflare AI 路徑。 |
| `VECTORIZE` | Vectorize | 記憶功能需要 | 長期語意記憶與向量查詢。 |
| `PLUGIN_LOADER` | Worker Loader | 可選 / Paid | Marketplace/外部插件的 Dynamic Workers 隔離執行；未綁定時 fail closed。 |
| `MY_RATE_LIMITER` | Rate Limiter | 設定檔存在 | Wrangler 已建立 binding；目前核心 source 沒有直接呼叫此 binding，主要 runtime rate-limit 仍有自己的保護。 |
| `QQAI_PLUGIN` | Dynamic Worker internal env | **不要手動設定** | 只由外部插件 sandbox wrapper 注入插件 id/version/mode。 |

### 目前沒有正式 source binding 的資源

`KV`、`R2` **目前不是 production source 直接讀取的 binding**。它們可出現在 BYOR / 未來接入設計中，但新部署不要因首頁預覽就誤以為現在一定要建立。若日後程式真正加入 `KV` / `R2` binding，env contract verifier 也必須同步更新。

## 2. 開發者身份與 Portal 首次帳密

| 名稱 | 類型 | 必要性 | 說明 |
| --- | --- | --- | --- |
| `DEVELOPER_IDS` | public var | 必要 | 逗號/分號/換行分隔的最高開發者 QQID 清單。 |
| `ROOT_QQ_IDS` | public var | 可選 | 額外 Root QQID，與 `DEVELOPER_IDS` 合併。 |
| `DEVELOPER_ID` | public var | legacy | 單一開發者 QQID 相容欄位。 |
| `PORTAL_ADMIN_USERNAME` | public var | 選用 | 此部署的管理員登入名稱，需符合一般 username 格式；`admin` 仍可用。不得與既有一般帳號名稱重疊。 |
| `PORTAL_ADMIN_PASSWORD` | Secret | 與 username 同設 | 此部署的管理員登入密碼，至少 10 字元；以常數時間比較，只用於管理員認證，不會寫入 D1。 |
| Portal 內部系統帳號 | 固定系統帳號 | 必要 | D1 中固定為保留名稱 `admin`；一般使用者不可註冊或升級成此帳號。 |
| 傳統 D1 管理員密碼 | Web / D1 PBKDF2 | 相容 | 只在兩個 `PORTAL_ADMIN_*` 變數都未設定時使用。首次建立只能寫入空值，不會覆蓋既有 hash。Workers Web Crypto 相容參數固定為 PBKDF2-SHA-256 / 100000 iterations。 |

開發者 QQ 身份與 **admin 首次啟用資格** 仍由 V2 原本的 public var 判定，production 由 **Cloudflare Dashboard → Workers → qqai → Settings → Variables** 管理：

```text
DEVELOPER_IDS = 你的QQID[,第二個QQID...]
ROOT_QQ_IDS = 可選
DEVELOPER_ID = legacy，可選
```

這三個 identity var **不要再寫入 production `wrangler.toml [vars]`**。Wrangler 預設會讓設定檔中的 Vars 成為部署值；若設定檔寫了空字串，下一次部署就可能把 Dashboard 值覆蓋成空值。本專案因此同時使用 `keep_vars = true` 與 `wrangler deploy --keep-vars`，並從 production `[vars]` 移除 identity assignments。

開發者第一次走 `/register`：輸入 `DEVELOPER_IDS`／`ROOT_QQ_IDS` 中的 QQID → 建立保留帳號 `admin`。若已設定 `PORTAL_ADMIN_*`，表單密碼必須符合 `PORTAL_ADMIN_PASSWORD`，且密碼只留在 Secret；若兩者未設定，D1 密碼只在尚未存在時建立。一般 QQ 帳號不得轉成 admin，重複啟用不會重設既有密碼。**此開發者首次啟用路徑不傳送 QQ 六位驗證碼，也不要求 `PORTAL_AUTH_SECRET`／OneBot Token。** 管理員登入後可在 Portal「帳號與設定 → Developer QQ 管理」管理額外的 D1 Developer 清單；Cloudflare Dashboard 的靜態清單保持唯讀。

`PORTAL_AUTH_SECRET` / `TOTP_ENCRYPTION_KEY` 仍可供 Portal 敏感資料與 TOTP seed 加密使用，但它們不再是 admin 登入或首次啟用的密碼／鑰匙。

## 3. 公開 Worker vars（source 目前有讀取）

### 公開網址 / 顯示

- `PUBLIC_BASE_URL`：Portal/help/live 對外基底網址。
- `BOT_DISPLAY_NAME`：Bot 顯示名稱。

### 部署通知

- `DEPLOY_NOTIFY_WORKER_NAME`
- `DEPLOY_NOTIFY_BRANCH`
- `DEPLOY_NOTIFY_DEVELOPER_IDS`
- `DEPLOY_NOTIFY_DEVELOPER_ID`
- `DEPLOY_NOTIFY_SELF_GRACE_SECONDS`

`DEPLOY_NOTIFY_START_COOLDOWN_SECONDS` 仍留在現有設定檔作相容/預留，但 **目前 source 沒有直接讀取**，不要以為改它一定會改 runtime 行為。

### OneBot / 自動化安全

- `ENABLE_ONEBOT_HTTP_EVENTS`：HTTP event ingress；正常維持 `false`。
- `QQAI_PUBLIC_INTERNAL_FALLBACK`：direct loopback 失敗後的 public loopback 緊急開關；正常維持 `false`。
- `AUTO_CHECKIN_ENABLED`
- `AUTO_CHECKIN_RETRY_INTERVAL_MS`
- `AUTO_CHECKIN_CONCURRENCY`

### 模型 / 路由 / 成本（source 目前有讀取）

- `GEMINI_CHAT_MODELS`
- `GEMINI_DECISION_MODELS`
- `GEMINI_SEARCH_MODELS`
- `GEMINI_VISION_MODELS`
- `GEMINI_TTS_MODELS`
- `GEMINI_LIVE_MODEL`
- `GEMMA_CHAT_MODELS`
- `GEMMA_DECISION_MODELS`
- `GEMMA_LAST_RESORT_MODELS`
- `DEEPSEEK_FLASH_MODEL`
- `DEEPSEEK_DAILY_BUDGET_CNY`
- `DEEPSEEK_EMERGENCY_FALLBACK`
- `MODEL_COST_POLICY`
- `IMAGE_INSPECTION_ENABLED`

以下名稱仍在舊設定/文件中，但目前 source 不直接讀取：`DEEPSEEK_PRO_MODEL`、`GEMINI_IMAGE_MODELS`、`IMAGEN_MODELS`。保留它們是為了部署相容與未來功能，不應把它們當成目前已生效的路由開關。

## 4. Secrets / 敏感值（source 目前有讀取）

### Google / Gemini / Gemma

- `GEMINI_API_KEYS`
- `VECTORIZE_GEMINI_KEYS`
- `GEMINI_CHAT_API_KEYS`
- `GEMINI_DECISION_API_KEYS`
- `GEMMA_CHAT_API_KEYS`
- `GEMMA_DECISION_API_KEYS`
- `GEMINI_SEARCH_API_KEYS`
- `GEMINI_SEARCH_API_KEY`（legacy singular）
- `GEMINI_VISION_API_KEYS`
- `GEMINI_VISION_API_KEY`（legacy singular）
- `IMAGE_CHECK_API_KEYS`（legacy alias）
- `IMAGE_CHECK_API_KEY`（legacy singular alias）

### DeepSeek

- `DEEPSEEK_API_KEYS`
- `DEEPSEEK_API_KEY`（legacy singular）

### OneBot / NapCat

- `ONEBOT_ACCESS_TOKEN`
- `ONEBOT_HTTP_ACCESS_TOKEN`：HTTP action fallback 專用，現在會優先於共用 token。
- `ONEBOT_HTTP_ACTION_URL`
- `ONEBOT_HTTP_URL`
- `NAPCAT_HTTP_URL`
- `NAPCAT_ACCESS_TOKEN`（alias）
- `ONEBOT_TOKEN`（legacy alias）

URL 如果內含 credential/query secret，也要當 Secret 管理。

### Portal / 2FA

- `PORTAL_AUTH_SECRET`：Portal 一般敏感資料／2FA 加密 fallback；不是 `admin` 密碼，也不參與 Developer 首次啟用。
- `PORTAL_ADMIN_PASSWORD`：此部署的管理員登入 Secret；需同時設定 `PORTAL_ADMIN_USERNAME` Variable。旋轉方式是更新 Secret，不用 Portal 密碼重設表單。
- `TOTP_ENCRYPTION_KEY`：**TOTP seed 的優先加密 key**；建議獨立設定，不與 OneBot token 共用。

### Cloudflare build detail

- `CLOUDFLARE_BUILDS_API_TOKEN`：可選，取得 build 詳細資料。

## 5. 建議的 production secrets 指令

至少：

```bash
npx wrangler secret put GEMINI_API_KEYS
npx wrangler secret put ONEBOT_ACCESS_TOKEN
npx wrangler secret put PORTAL_ADMIN_PASSWORD
npx wrangler secret put PORTAL_AUTH_SECRET
npx wrangler secret put TOTP_ENCRYPTION_KEY
```


依功能再加：

```bash
npx wrangler secret put GEMINI_SEARCH_API_KEYS
npx wrangler secret put GEMINI_VISION_API_KEYS
npx wrangler secret put DEEPSEEK_API_KEYS
npx wrangler secret put ONEBOT_HTTP_ACCESS_TOKEN
npx wrangler secret put CLOUDFLARE_BUILDS_API_TOKEN
```

## 6. 不要做的事

- 不要把 `DEVELOPER_IDS`／`ROOT_QQ_IDS`／`DEVELOPER_ID` 重新加回 production `wrangler.toml [vars]`；它們由 Dashboard 管理，否則部署可能覆寫網頁設定。
- 不要移除 `keep_vars = true` 或 deploy script 的 `--keep-vars`，除非已明確改成「Wrangler 設定檔為唯一變數來源」並完成遷移。
- 不要把 API Key、Token、初始密碼放入 `wrangler.toml [vars]`。
- 不要只設定 `PORTAL_ADMIN_USERNAME` 或 `PORTAL_ADMIN_PASSWORD` 其中一個；完整設定前管理員登入會 fail closed。
- 不要將 `PORTAL_ADMIN_USERNAME` 設成既有一般使用者帳號；此時該變數登入會拒絕，以免接管該一般帳號。
- 不要在 GitHub Issue、commit message、Portal log 或 Ray_Chen memory 寫真實 Secret。
- 不要把 `DEVELOPER_IDS` 開放給一般 Portal 使用者修改。
- 不要透過重複 `/register` 覆蓋管理員資料；環境變數模式的登入密碼只由 Cloudflare Secret 管理。
- 不要為了讓首頁「顯示已連接」而建立其實程式沒用到的 KV/R2；UI 預覽必須標示真實/預留狀態。
