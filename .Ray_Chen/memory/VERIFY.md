# VERIFY

## QQ Open Personal Persistence

Verified product commit: `5def3958512fcd45a5219be83a0b77cfe454061d`
GitHub Actions run: `36403470105`
Conclusion: `success`

Passed:
- npm run check
- npm run check:v3
- npm run check:v4
- npm run check:v4test
- npm run check:bundle

New `verify-v4-user-profile-persistence.mjs` assertions cover:
- manual memories use User Persistence `memory` purpose;
- QQ Open personal style writes/reads user settings;
- QQ Open DND writes/reads user settings;
- QQ Open manual memory uses user storage helpers;
- QQ Open manual memory retrieval skips platform Vectorize;
- QQ Open `!clear` clears user-storage private history;
- legacy OneBot paths remain present.

## Cloudflare Preview Preflight

Create target: `qqaibot-v4-public-preview`
Create result: failed, Cloudflare API code 7406 — account D1 limit reached (10).
Read-back: exact target name absent.
Production D1 protected: `qqaibot` / `569a01fe-3297-40e1-832f-09c3793056ed`.
Production mutation: none.

## Pending

- obtain one safe D1 slot or quota increase;
- create/read-back dedicated Preview D1;
- configure/deploy same-`qqai` Worker Preview with Preview-safe D1/Vectorize bindings;
- run isolated live Preview verification;
- fill the official 2023 QQ self-test workbook after live verification.
