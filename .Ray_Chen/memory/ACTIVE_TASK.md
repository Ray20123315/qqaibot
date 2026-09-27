# ACTIVE_TASK

task_id: qqaibot-20260927-qqopen-v4-native
task_status: active
goal_revision: 4

## Goal

Make QQ Open V4 a full production ingress for the existing QQAIBOT capabilities instead of a connectivity-only path. Reuse the same AI, Codex, memory, cooldown, plugin, permission and command logic; adapt platform actions/media/group management to QQ Open APIs without pretending OpenIDs are numeric QQ IDs.

## Completed Steps

1. Added `src/v4/qqopen/legacy-bridge.js` for canonical QQ Open → legacy-compatible event/action translation.
2. Updated `src/v4/qqopen/runtime.js` so non-connectivity messages enter the shared Worker path and replies return through QQ Open.
3. Added QQ Open action routing in `src/core/permissions.js`; no QQ Open side effect silently falls back to NapCat.
4. Added explicit `QQ_OPEN_DEVELOPER_OPENIDS` support in deployment identity logic.
5. Bypassed legacy OneBot whitelist/private-access gates only for the current authenticated QQ Open ingress context.
6. Added Worker direct-loopback with a local OneBotHub facade to avoid Durable Object self-call deadlocks.
7. Added rich-media, member, mute, remove, recall and join-request compatibility.
8. Added `verify-v4-runtime-bridge.mjs` and included it in `npm run check:v4`.
9. Updated README and `.dev.vars.example`.

## Verification

Feature head: `18160ef97f602a324d5c094b2f15ec2f6ca5a415`

GitHub Actions run: `36335909533`

All steps succeeded:
- repository regression checks
- V3 regression checks
- V4 QQ Open regression checks
- isolated V4 test deployment checks
- single Worker bundle

## Remaining Authorization Gate

`main` and production are intentionally unchanged. Production cutover requires an explicit user instruction to merge/update `main` and deploy.

## next_exact_action

After explicit production authorization, fast-forward/update `main` to the verified feature head, let Cloudflare build/deploy, verify Gateway READY, then live-test ordinary AI, public Codex, developer Codex after OpenID allowlisting, media send/receive, member management and join-request review.

last_checkpoint_at: 2026-09-28T01:18:00+08:00
