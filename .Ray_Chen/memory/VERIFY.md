# VERIFY

## Verified Product Revision

`2bbcca4dfcc2f7ce99c21df84bdc2dc2479a3bdf`

## Root Cause Evidence

Production settings before the fix:
- `QQ_OPEN_INTENTS=33554432`
- this equals `GROUP_MESSAGES (1<<25)` only.

Tencent's current SDK defines:
- `INTERACTION = 1<<26`
- inline keyboard clicks dispatch `INTERACTION_CREATE`
- interaction ACK uses `PUT /interactions/{interaction_id}` with `{"code":0}`.

Required combined mask:
`100663296`.

## Regression Coverage

- default QQ Open intents include GROUP_MESSAGES + INTERACTION;
- production wrangler config requires `100663296`;
- isolated V4 test config requires `100663296`;
- previous "interaction remains opt-in" assertions were removed;
- runtime source verifies `sessionIntents`, `configuredIntents`, and intent-equality before RESUME;
- stale intent sessions force IDENTIFY;
- existing keyboard DTO/Markdown assertions remain.

## GitHub Actions

- development run `36510290690`: SUCCESS
- main run `36510415265`: SUCCESS

Passed:
- repository regression checks
- V3 regression checks
- V4 QQ Open regression checks
- isolated V4 test deployment checks
- single Worker bundle

## Cloudflare Production

Connected Build `16be6f33-cdd1-4e31-9a26-60036dc0f237`:
- commit: `2bbcca4dfcc2f7ce99c21df84bdc2dc2479a3bdf`
- branch: `main`
- outcome: success

Production settings read-back:
- QQ_OPEN_ENABLED = true
- QQ_OPEN_TRANSPORT = websocket
- QQ_OPEN_INTENTS = 100663296

## Remaining Live Verification

Click one keyboard button. If it still times out, inspect Gateway close/error state for 4014; that would indicate the QQ application itself lacks authorization for the INTERACTION intent.
