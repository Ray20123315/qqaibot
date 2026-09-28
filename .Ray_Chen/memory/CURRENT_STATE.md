# CURRENT_STATE

## Latest Verified Product

`af89a42aae1219224a2323fc69118ef6c2a94b4c`
GitHub Actions run `36386417711`: success.

## Portal

Normal V4 navigation now emphasizes:
- 總覽
- AI 與資料
- AI / Codex
- 插件

Developer-only navigation remains hidden until both conditions are true:
1. backend viewer state says developer;
2. the developer enters hidden key `00000`.

The hidden input progressively reveals `開發者模式`; the code itself is not an authorization credential.

## Resource UI

- AI cards show provider/model/share state, not raw API keys.
- Storage cards show D1/KV and connection state, not API tokens or internal config names.
- Add AI/storage actions create authenticated one-time tickets.
- Sharing and delete operations use custom V4 modal.
- Gateway raw JSON diagnostics are developer-only.

## Verification

Portal regression, V3, V4, isolated V4 dry-run and Worker bundle all passed.

## Production

No production Cloudflare resource was changed. main remains untouched by this task.
