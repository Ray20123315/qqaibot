# DECISIONS

- 2026-10-10: user reported Abot no reply after main cutover. Evidence from Cloudflare Workers Observability showed QQ 40034024 invalid/unauthorized msg_id. On this explicit rejection only, retry once proactively with no msg_id; still obey QQ group permissions. No retry on timeout/5xx.
- 2026-10-10: /use retries for verified group stay read-only; for incomplete pending group issue new random invite and nonce and revoke previous invite to permit safe recovery.
- 2026-10-10: repair branch tested, fast-forwarded into main; Cloudflare connected deployment observed 100% on repair version. Do not claim live QQ success until user tests.
