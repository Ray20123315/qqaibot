# Environment / Binding Reference

本文件是 **目前 source 實際讀取** 的 Cloudflare bindings、公開 Worker 變數與 Secrets 對照表。  
原則：公開設定放 `wrangler.toml [vars]`；憑證、密碼、Token、API Key 一律用 Cloudflare Secret；不要把真實值提交到 Git。

> Developer Portal 的開發者帳號固定為保留名稱 `admin`。第一次啟用只輸入 `DEVELOPER_IDS`／`ROOT_QQ_IDS` 中的 QQID並直接設定 admin 密碼；不使用 QQ 六位驗證碼，也不使用 `PORTAL_AUTH_SECRET`、OneBot Token 或其他新增 Secret 作登入前置條件。系統沒有預設 admin 密碼。

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
| 開發者 Portal username | 固定系統帳號 | 必要 | 固定為保留名稱 `admin`；一般使用者不可註冊此名稱。 |
| 開發者 Portal password | Web / D1 PBKDF2 | 首次啟用時設定 | 第一次在 `/register` 直接設定 admin 密碼；沒有預設密碼，只保存 PBKDF2 salt/hash。 |

開發者身份仍由 V2 原本的 public var 判定：

```bash
# wrangler.toml [vars]
DEVELOPER_IDS = "你的QQID"
```

開發者第一次走 `/register`：輸入 `DEVELOPER_IDS`／`ROOT_QQ_IDS` 中的 QQID → 直接設定密碼 → 系統建立或遷移保留帳號 `admin`。**不傳送 QQ 六位驗證碼，也不要求 `PORTAL_AUTH_SECRET`／OneBot Token。** 之後走 `/login`，帳號固定輸入 `admin`，密碼就是第一次設定的密碼；只有使用者自行啟用 2FA 時才追加第二因素。

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

- `PORTAL_AUTH_SECRET`：Portal 一般敏感資料加密 fallback。
- `TOTP_ENCRYPTION_KEY`：**TOTP seed 的優先加密 key**；建議獨立設定，不與 OneBot token 共用。

### Cloudflare build detail

- `CLOUDFLARE_BUILDS_API_TOKEN`：可選，取得 build 詳細資料。

## 5. 建議的 production secrets 指令

至少：

```bash
npx wrangler secret put GEMINI_API_KEYS
npx wrangler secret put ONEBOT_ACCESS_TOKEN
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

- 不要把 API Key、Token、初始密碼放入 `wrangler.toml [vars]`。
- 不要在 GitHub Issue、commit message、Portal log 或 Ray_Chen memory 寫真實 Secret。
- 不要把 `DEVELOPER_IDS` 開放給一般 Portal 使用者修改。
- 開發者首次啟用的 username/password 直接由 `/register` 網頁建立；不要再新增 deploy-time 的開發者帳號／初始密碼變數。
- 不要為了讓首頁「顯示已連接」而建立其實程式沒用到的 KV/R2；UI 預覽必須標示真實/預留狀態。
