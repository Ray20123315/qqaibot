# Ray_Chen Memory Entry

- memory_version: v0.0.40
- project: QQAIBOT
- repository: Ray20123315/QQAIBOT
- canonical_branch: main
- development_branch: v4-qqopen-native
- task_id: qqaibot-20260929-interaction-timeout-fix
- task_status: completed
- goal_revision: 1
- verified_product_revision: 2bbcca4dfcc2f7ce99c21df84bdc2dc2479a3bdf
- updated_at: 2026-09-29T10:05:00+08:00

## Completed Goal

Fixed QQ inline-keyboard buttons timing out because the production Gateway subscribed only to GROUP_MESSAGES and did not subscribe to INTERACTION_CREATE.

## Root Cause

- old production binding: QQ_OPEN_INTENTS=33554432 = 1 << 25
- required button callback bit: INTERACTION = 1 << 26
- required combined mask: 100663296
- without INTERACTION, buttons render but callback events never reach QqOpenGateway, so QQ cannot receive an ACK and shows request timeout.

## Result

- production/test/default intents are now 100663296;
- Tencent INTERACTION callbacks are included;
- stale sessions may resume only when their recorded sessionIntents match configuredIntents;
- intent changes therefore force a fresh IDENTIFY instead of silently resuming the old subscription;
- production binding read-back confirms QQ_OPEN_INTENTS=100663296;
- keyboard payload/handlers/permissions/TEMP-admin work remain preserved.

## Verification

- development CI 36510290690: success
- main CI 36510415265: success
- Cloudflare Connected Build 16be6f33-cdd1-4e31-9a26-60036dc0f237: success
- production binding read-back: 100663296

## next_exact_action

Click one inline-keyboard button in QQ. If it still reports timeout, inspect Gateway lastError for QQ close code 4014; that would mean the QQ application itself still lacks INTERACTION permission in the developer console.
