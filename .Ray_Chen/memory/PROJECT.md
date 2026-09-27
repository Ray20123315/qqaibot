# PROJECT

## Purpose

QQAIBOT is now running the V4-capable production Worker on Cloudflare while retaining the legacy OneBot path for rollback and compatibility. The project is transitioning operationally from OneBot/NapCat toward QQ Open Platform native transport and actions.

## Production

- GitHub production branch: `main`
- production Worker: `qqai`
- custom domains: `aibot.ray2025.com`, `qqai.ray2025.com`
- current production migration tag: `v4_qqopen_gateway`
- Durable Objects: `OneBotHub` + `QqOpenGateway`
- D1 / Vectorize / Rate Limiter bindings remain unchanged

## Safety Constraints

- Do not remove `OneBotHub` until QQ Open live receive/reply and management flows are proven.
- Keep AppSecret/access tokens only in Cloudflare Secrets.
- Never coerce QQ Open OpenID values into numeric QQ IDs.
- Existing command authorization remains authoritative.
- CodexWork filesystem restrictions remain local and no-delete.
- Production configuration cleanup must preserve secrets/resources unless their removal is separately verified.
