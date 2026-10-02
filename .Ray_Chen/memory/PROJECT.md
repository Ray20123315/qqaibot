# PROJECT

## Purpose

QQAIBOT is a Cloudflare Workers QQ AI bot using QQ Open/AIBot as the primary transport and NapCat/OneBot as an auxiliary capability fallback.

## Current Production

- branch: `main`
- verified product code revision: `668525a1db65402c8428cfa03930c8c77f255240`
- deployed main trigger revision: `5f40bf4ade906a0eae7aa555eac70225f054665e`
- Worker: `qqai`
- Cloudflare Connected Build: `e33665d0-549a-4926-a797-2add410f2dca`
- outcome: `success`
- main CI: `36988176740` — success
- QQ_OPEN_INTENTS: `100663296`
- Hybrid primary: `qq-open`

## Discovery / Command UX

- C2C global custom menu uses QQ native submenu discovery.
- QQ native group discovery uses one compact category-root panel because the native client cannot reliably display the full command surface.
- Selecting a retained category sends `!面板 <分类>` and should return a bot-managed two-column paginated inline keyboard.
- Category keyboard cards use `msg_type:0 + content + keyboard`; they do not require Markdown permission.
- Successful keyboard-card text contains only the title/prompt. Emergency command-list fallback text is separate and is sent only after a real QQ keyboard capability rejection.
- Inline keyboard pagination stays within QQ keyboard row/button limits.
- Direct/no-argument child commands use `action.type=2`, `enter=true`, `reply=false`.
- Parameter/target/content child commands use `action.type=2`, `enter=false` and a trailing-space prefill.
- Normal buttons omit `click_limit` and remain reusable.
- Runtime authorization remains authoritative.

## Retired Features

- master/partner relationship command and Portal functionality is retired.
- Historical relationship rows can only be deleted for cleanup.
- Historical master/partner mute-lock sources remain readable only to expire or unlock safely.
- Werewolf functionality remains removed.

## Safety

- Never store secrets in Git or Ray_Chen memory.
- Never coerce OpenID into numeric QQ IDs.
- Never use discovery visibility as an authorization boundary.
- Never retry ambiguous mutating writes through a second transport.
