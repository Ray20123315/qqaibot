# PROJECT

## Purpose

QQAIBOT is a QQ bot project on Cloudflare Workers. Production currently uses OneBot/NapCat while V4 migrates transport, identity, message/action integration, and command presentation to QQ Open Platform native APIs.

## Canonical Repository

- GitHub: `Ray20123315/qqaibot`
- production branch: `main`
- V4 development branch: `v4-qqopen-native`

## Long-term Safety Constraints

- Existing command permission and confirmation checks remain authoritative; UI/AI must not bypass them.
- QQ Open `openid` / `group_openid` are opaque first-class identifiers; never coerce them into numeric QQ IDs.
- Bot capability and caller authorization are separate checks.
- Never commit AppSecret, access tokens, cookies, private keys, bridge tokens, or equivalent secrets.
- Keep CodexWork local filesystem authorization on the local bridge with explicit read/edit allowlists and no deletion.
- Keep OneBot production available until QQ Open receive/send/permissions/moderation pass end-to-end verification.
