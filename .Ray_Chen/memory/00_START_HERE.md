# Ray_Chen Memory Entry

- memory_version: v0.0.46
- project: QQAIBOT
- repository: Ray20123315/QQAIBOT
- canonical_branch: main
- development_branch: fix/qq-panel-message-send-20261001
- task_id: qqaibot-20261001-panel-normal-message-send
- task_status: active
- goal_revision: 1
- product_revision: 821373fc1c7e32116b8f15cca69a38bc5a81545d
- base_main_revision: a1c19cf0d732fd576000c8ecb2753facf38c51e8
- updated_at: 2026-10-01T08:37:00+08:00

## Current Goal

Correct QQ group keyboard behavior without touching main:

- direct/no-argument commands such as `!help` and `!status` must create a normal QQ command message event;
- direct commands must not rely on callback-only execution;
- parameterized commands such as `!codex` and `!模型` remain editable input prefills;
- pagination must also travel through the normal command-message path;
- main remains unchanged while the latest main build is under user testing.

## Current Result

- PRODUCED: `src/v4/commands/group-panel.js` now emits action.type=2 for keyboard command buttons.
- PRODUCED: direct/no-argument and pagination buttons use `enter=true`; parameterized buttons use `enter=false`.
- PRODUCED: `verify-v4-qqopen.mjs` now asserts normal-message semantics instead of callback semantics.
- VERIFIED: GitHub Actions run 36796984396 passed repository, V3, V4 QQ Open, isolated V4 test-deployment, and bundle checks.
- VERIFIED: main was not updated; work is isolated on `fix/qq-panel-message-send-20261001`.
- NEEDS_REVIEW: live QQ client behavior still requires a real client smoke test because historical clients have sometimes ignored `enter=true`.

## Recovery Route

Resume from branch `fix/qq-panel-message-send-20261001`. Do not fast-forward or merge main until live QQ confirms that `help/status` are actually sent as user messages and Bot replies through the ordinary message handler. If a client only prefills despite `enter=true`, keep the normal-message requirement and investigate client/platform behavior rather than reverting to callback-only execution.
