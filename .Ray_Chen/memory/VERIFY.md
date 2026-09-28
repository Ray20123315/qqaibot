# VERIFY

## Verified Product Revision

`df7958e9e99be0d5724dc4fd24a39da616e1befd`

## GitHub Actions

Integration run `36445181452`: SUCCESS.
Clean merge main run `36445884523`: SUCCESS.
Windows Codex Bridge run `36445884500`: SUCCESS.
Hotfix validation run `36447367149`: SUCCESS.
Final main run `36447663272`: SUCCESS.

Passed in the final main validation:
- repository regression checks
- V3 regression checks
- V4 QQ Open regression checks
- isolated V4 test deployment checks
- single Worker bundle

## Cloudflare Production

Connected Build `9070f843-d627-4d69-8c03-d3e8c6f751b9`:
- commit: `df7958e9e99be0d5724dc4fd24a39da616e1befd`
- branch: `main`
- outcome: success
- deployment: `15d74fcd-2514-48a1-8892-f44b4660d7ec`
- Worker version: `2aa24e2a-b640-4ac2-83ae-07efb428b099`
- version number: 2129
- main module: `worker.js`

Production binding read-back:
- DB: present, D1 id `569a01fe-3297-40e1-832f-09c3793056ed`
- AI: present
- VECTORIZE: present
- ONEBOT_HUB: present
- QQ_OPEN_GATEWAY: present
- QQ Open client secret: present
- QQ_OPEN_ENABLED: true
- QQAI_DB_TABLE: absent

## Live Health

`https://aibot.ray2025.com/healthz` via Browser Rendering:
- HTTP: 200
- ok: true
- counts: 10 ok / 1 warning / 0 error
- D1: ok
- OneBot/NapCat: ok
- OneBot connected: true
- RPC round-trip: true

This live probe caught and then verified the fix for `hybridStatus is not defined`.

## Remaining Limit

The one remaining health warning was not an error and did not prevent Worker, D1 or OneBot operation. NapCat diagnostics contain historical abnormal close code 1006 events, while the current socket is connected.
