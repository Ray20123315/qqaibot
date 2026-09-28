# CURRENT_STATE

## Keyboard Integration

- product integration commit: `af4b743fec796cc071aafce3559f66c2ae7c9a50`
- integration CI `36478691850`: success
- current development head includes memory reconciliation only after that product merge
- main promotion: pending

## Keyboard Behavior

- group category replies use QQ inline keyboard cards;
- two buttons per row, maximum five rows;
- larger categories paginate;
- button callback data reuses existing command handlers;
- QQ Open runtime supports keyboard payloads for passive and interaction replies;
- deterministic unsupported-keyboard errors fall back to text.

## Portal TEMP Admin

- verified product base: `4865c7c6c9f381916082e70063be78aaaba8e6d6`
- Cloudflare Rate Limiter remains primary;
- D1 atomic fallback remains enabled for limiter invocation failures;
- TEMP system-admin remains separate, self-expiring and secret-backed;
- expiry: `2026-10-02T00:00:00+08:00`;
- prior main CI `36477699417`: success;
- prior production build `e1e34aef-e53d-4851-9fbe-0f686f9c3651`: success;
- prior health: HTTP 200, ok=true, 10 ok / 1 warning / 0 error.

## Safety

- no force update;
- TEMP secret values absent from memory;
- runtime command authorization unchanged;
- QQ Open primary / OneBot controlled fallback unchanged.
