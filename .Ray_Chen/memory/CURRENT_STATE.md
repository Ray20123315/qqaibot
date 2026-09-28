# CURRENT_STATE

## GitHub

- canonical branch: `main`
- final main/dev head: `806af06ba56f0d8f9741bb2520b58be60069126f`
- verified product revision: `a78003cda6ef9b5d8b8b9d28dd2a798aa3d2424a`
- product main CI `36479310886`: success
- final memory-head CI `36479807514`: success
- duplicate final validation `36479804549`: success
- v0.0.35 package workflow `36479807508`: success

## Cloudflare Production

- Worker: `qqai`
- Connected Build: `09d6a646-a0b2-4e98-b73d-d9f2c74925c0`
- commit: `a78003cda6ef9b5d8b8b9d28dd2a798aa3d2424a`
- outcome: success

## QQ Group Panel UX

- root panel: one managed category list;
- category reply: QQ inline keyboard card;
- layout: two buttons per row, maximum five rows;
- large categories: paginated;
- command callbacks: existing canonical `!` commands;
- navigation callbacks: `!面板 <分类> --page=N`;
- deterministic keyboard rejection: text fallback;
- ambiguous timeout/5xx: no second write.

## Preserved Portal Security

- TEMP system-admin support remains present;
- D1 CAS auth-rate-limit fallback remains present;
- TEMP secret values remain absent from Git/memory.

## Remaining Live Check

Click one category and one child button in the actual QQ group client.
