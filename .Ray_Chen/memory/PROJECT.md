# PROJECT

## Purpose

QQAIBOT is a QQ bot project using Cloudflare Worker infrastructure, OneBot/NapCat integration, permission-aware command handling, AI routing, and a V3 plugin platform.

## Canonical Repository

- GitHub: `Ray20123315/qqaibot`
- Canonical branch: `main`

## Long-term Safety Constraints

- Preserve existing command permission checks; AI routing must never become a bypass.
- High-risk group operations remain governed by existing role/permission/confirmation logic.
- Do not expose raw internal OneBot/D1 structures to QQ users when a curated human-readable report is sufficient.
- Avoid unnecessary plugin/tool loading in runtime paths.
- Never write secrets, tokens, cookies, private keys, or authorization material into project memory.
