# VERIFY

## Current Repair

Task: qqaibot-20261001-panel-complete-real-message-send
Base: a1c19cf0d732fd576000c8ecb2753facf38c51e8
Product revision: 6cb891571bdb2744b13bd11e3731c2a267fdf1ed

## Required Keyboard Behavior

- direct/no-argument command: action.type=2, enter=true, canonical command unchanged;
- parameterized/target/content command: action.type=2, enter=false, canonical command plus trailing space;
- pagination: action.type=2, enter=true;
- reply=false for normal panel buttons;
- click_limit absent for reusable normal buttons.

## Coverage Verification

- Every non-empty group category/page is enumerated by `verify-v4-qqopen.mjs`.
- Every enabled group command is required to have a matching button.
- Restored runtime/plugin command IDs are explicitly asserted.
- Root panel must expose `关系` and `互动`.
- Long global-rate-limit syntax uses the panel-safe alias `!全局限速`.

## Verification Gates

- product patch: VERIFIED
- development CI: VERIFIED — 36848544391
- main update: VERIFIED — non-force fast-forward to 6cb891571bdb2744b13bd11e3731c2a267fdf1ed
- main CI: VERIFIED — 36848826594
- production Connected Build: VERIFIED — d8abfda4-4595-427a-8fbf-7f0a5ffcd31f, success
- production commit: VERIFIED — 6cb891571bdb2744b13bd11e3731c2a267fdf1ed
- live QQ client smoke: PENDING_USER

## User Smoke Procedure

1. Send/open `!面板`.
2. Open 基础, 关系 and 互动; verify buttons render and pages remain reusable.
3. Click `help` or `status`; verify the command itself appears as a normal QQ chat message and the bot replies.
4. Click a parameterized command such as `codex`; verify only `!codex ` is placed in the input box until the user completes and sends it.
