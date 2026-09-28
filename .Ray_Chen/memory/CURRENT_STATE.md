# CURRENT_STATE

## GitHub

- canonical branch: `main`
- verified product revision: `df7958e9e99be0d5724dc4fd24a39da616e1befd`
- final main CI `36447663272`: success
- previous clean merge main CI `36445884523`: success
- Windows Codex Bridge build `36445884500`: success
- feature branch `feature/v4-public-bot` is fully contained in main.

## Cloudflare Production

- Worker: `qqai`
- Connected Build: `9070f843-d627-4d69-8c03-d3e8c6f751b9`
- outcome: success
- deployment: `15d74fcd-2514-48a1-8892-f44b4660d7ec`
- Worker version: `2aa24e2a-b640-4ac2-83ae-07efb428b099`
- version number: 2129
- main module: `worker.js`
- production DB id: `569a01fe-3297-40e1-832f-09c3793056ed`
- production `QQAI_DB_TABLE`: absent
- QQ Open: enabled
- live health: HTTP 200, ok=true, 10 ok / 1 warning / 0 error
- OneBot/NapCat: connected=true, rpcRoundTrip=true

## Public V4 Foundation

- user-scoped AI provider accounts can be owned and selectively shared to groups.
- user settings, memory, private history and storage routing use explicit user resources where implemented.
- D1/KV user storage connector infrastructure and Portal resource management are present.
- plugin runtime guard can block unsafe plugin capabilities according to policy.
- Preview uses the same Worker code path with an isolated `kv_store_v4public_preview` table namespace.
- production does not inherit the Preview table namespace.

## Hybrid QQ Transport

- QQ Open remains primary.
- OneBot remains fallback/auxiliary and still enforces read-only mode and permission checks.
- unsupported/denied official capabilities can route to OneBot only when the fallback is considered safe.
- numeric QQ/group mapping safety remains required.
- OneBot health uses `hybridRuntimeStatus`; the prior undefined `hybridStatus` runtime call is fixed.

## Remaining Operational Risk

- live health reports one warning, but zero errors.
- NapCat has historical abnormal WebSocket closes (1006) in diagnostics; current socket is connected and RPC round-trip succeeds.
