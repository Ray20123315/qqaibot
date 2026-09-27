# PROJECT

## Purpose

QQAIBOT is a QQ bot project on Cloudflare Workers. The current production path uses OneBot/NapCat; the active V4 migration builds a native QQ Open Platform transport while preserving mature AI, Codex, plugin, Portal, and data layers.

## Canonical Repository

- GitHub: `Ray20123315/qqaibot`
- production branch: `main`
- active V4 branch: `v4-qqopen-native`

## Long-term Safety Constraints

- Existing command permission and confirmation checks remain authoritative; UI/AI must not bypass them.
- QQ Open `openid` / `group_openid` are first-class identifiers; do not fake them into numeric QQ IDs.
- Bot capability and caller authorization are separate checks.
- Never commit AppSecret, tokens, cookies, private keys, bridge tokens, or other authorization material.
- Keep CodexWork local filesystem authorization on the local bridge with explicit read/edit allowlists and no deletion.
- Keep production OneBot available until QQ Open receive/send/permissions/moderation pass end-to-end verification.
