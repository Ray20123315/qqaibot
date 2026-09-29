# ACTIVE_TASK

task_id: qqaibot-20260929-interaction-timeout-fix
task_status: completed
goal_revision: 1

## Goal

Stop QQ inline-keyboard callbacks from timing out.

## Acceptance Results

- VERIFIED: production/test/default intents are `100663296`.
- VERIFIED: INTERACTION (1<<26) is included with GROUP_MESSAGES (1<<25).
- VERIFIED: production Cloudflare binding read-back is `100663296`.
- VERIFIED: runtime records `sessionIntents` and exposes configured/session intent masks.
- VERIFIED: an old session is resumable only when `sessionIntents === configuredIntents`.
- VERIFIED: changed intents force fresh IDENTIFY and prevent stale-session subscription reuse.
- VERIFIED: callback ACK remains official `PUT /interactions/{id}` with `{"code":0}`.
- VERIFIED: keyboard payload, original command handlers, permissions, confirmations, cooldowns and Portal security work remain intact.
- VERIFIED: development CI, main CI and production Connected Build succeed.

## Evidence

- product revision: `2bbcca4dfcc2f7ce99c21df84bdc2dc2479a3bdf`
- development CI: `36510290690` — success
- main CI: `36510415265` — success
- production build: `16be6f33-cdd1-4e31-9a26-60036dc0f237` — success
- old production intent: `33554432`
- new production intent: `100663296`

## Remaining Live Verification

One real QQ button click remains required. If QQ still shows request timeout, inspect for Gateway close code 4014, which indicates the QQ application permission itself lacks INTERACTION.

## next_exact_action

Click one keyboard child command in the QQ group and report only if it still times out.

last_checkpoint_at: 2026-09-29T10:05:00+08:00
