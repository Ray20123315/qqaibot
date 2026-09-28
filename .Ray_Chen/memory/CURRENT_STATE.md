# CURRENT_STATE

## GitHub

- canonical branch: `main`
- verified product revision: `64513e94f6634921f0b1ee8f7c6d5d44a754a6f5`
- development CI `36476322049`: success
- main CI `36476525721`: success

## Cloudflare Production

- Worker: `qqai`
- Connected Build: `8aa6ab67-ad80-4ddd-b916-0b76e7bfcf3c`
- commit: `64513e94f6634921f0b1ee8f7c6d5d44a754a6f5`
- branch: `main`
- outcome: success

## QQ Group Panel

- one managed group root panel contains category roots.
- category router remains `!面板 <分类> [子指令] [参数]`.
- QQ-rendered slash form `/!面板 ...` is normalized before group AI opt-out parsing.
- ordinary `/!普通内容` still bypasses AI and is not treated as a panel command.
- category + child reuses existing canonical handlers and permissions.

## Public V4 / Hybrid State

- QQ Open remains primary.
- OneBot remains controlled fallback/auxiliary.
- public-user AI/storage isolation work from current main is preserved.
- runtime authorization remains authoritative regardless of command-panel visibility.

## Remaining Live Verification

Automated tests prove input normalization and routing order but cannot generate a real QQ client panel click. One live group panel click should be checked after deployment.
