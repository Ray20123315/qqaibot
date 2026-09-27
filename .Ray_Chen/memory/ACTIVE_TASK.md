# ACTIVE_TASK

task_id: qqaibot-20260927-member-details-smart-command
task_status: completed
goal_revision: 1

## Goal

Fix three user-visible behaviors:
1. `!详细资料` must not dump raw OneBot/D1 structured payloads into QQ.
2. `!撤回` must be silent on success.
3. Natural-language AI should be able to select supported `!` commands like tools, while every execution still obeys the original command permissions and confirmations.

## Acceptance Criteria

- Raw OneBot/D1 object sections removed from member-detail QQ output.
- Member-detail output remains useful via curated fields and source-state summaries.
- Successful admin `!撤回` returns no success chat message; error paths remain visible.
- AI command routing uses an allowlist and cannot emit arbitrary OneBot actions.
- Routed commands return to the existing command handler after classification.
- Existing groupOps / aiAdmin / owner / developer / Portal setting / confirmation checks remain authoritative.
- Regression tests and Worker dry-run bundle pass.

## Completed Steps

- Updated `src/members/details.js` to emit curated status summaries instead of raw JSON.
- Updated `worker.js` so successful `!撤回` returns HTTP 204.
- Added an allowlisted AI Command Tool Router in `src/operations/runtime.js`.
- Synced routed command text back into the existing command parser path in `worker.js`.
- Added regression coverage in `verify-member-details.mjs` and `verify-smart-command-routing.mjs`.
- Added the new regression to `package.json`.
- Updated `src/help/commands.js`.
- Fast-forwarded `main` to product commit `0d86baf190a02de5be3e9622ddceea248eb67e8a`.
- GitHub Actions run `36268773902` completed successfully.

## Verification Results

- `npm run check`: success
- `npm run check:v3`: success
- `npm run check:bundle`: success
- Product files read back from `main` with expected blob SHAs: success
- Gmail update notification: sent once and verified in Sent

## Known Limitation

No end-to-end test against the user's live NapCat/QQ runtime was possible in this environment.

## next_exact_action

If further work is requested, first smoke-test or inspect live NapCat/Worker logs for:
- `!详细资料 @成员`
- reply + `!撤回`
- @bot / reply-to-bot natural-language requests that should map to an existing command.

last_checkpoint_at: 2026-09-27T12:07:00+08:00
