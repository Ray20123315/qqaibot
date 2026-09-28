# CURRENT_STATE

## GitHub

- canonical branch: `main`
- verified revision: `a78003cda6ef9b5d8b8b9d28dd2a798aa3d2424a`
- latest development-head CI `36479102835`: success
- main CI `36479310886`: success

## Cloudflare Production

- Worker: `qqai`
- Connected Build: `09d6a646-a0b2-4e98-b73d-d9f2c74925c0`
- commit: `a78003cda6ef9b5d8b8b9d28dd2a798aa3d2424a`
- branch: `main`
- outcome: success

## QQ Group Panel UX

- root panel: one managed category list.
- category reply: QQ inline keyboard card.
- layout: two buttons per row, maximum five rows.
- large categories: paginated.
- command callbacks: existing canonical `!` commands.
- navigation callbacks: `!面板 <分类> --page=N`.
- deterministic keyboard rejection: text fallback.
- ambiguous timeout/5xx: no second write.

## Preserved Portal Security

- TEMP system-admin support remains present.
- D1 CAS auth-rate-limit fallback remains present.
- TEMP secret values remain absent from Git/memory.
- TEMP expiry remains `2026-10-02T00:00:00+08:00`.

## Remaining Live Check

Click one category and one child button in the actual QQ group client.
