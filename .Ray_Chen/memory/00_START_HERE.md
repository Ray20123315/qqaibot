# Ray_Chen Memory Entry

- memory_version: v0.0.30
- project: QQAIBOT
- repository: Ray20123315/QQAIBOT
- canonical_branch: main
- development_branch: v4-qqopen-native
- task_id: qqaibot-20260929-group-panel-slash-dispatch
- task_status: completed
- goal_revision: 1
- product_revision: 64513e94f6634921f0b1ee8f7c6d5d44a754a6f5
- updated_at: 2026-09-29T04:08:00+08:00

## Completed Goal

Fixed live QQ group panel clicks that were sending a leading-slash command such as `/!面板 基础` and being swallowed by the existing `/!` AI-opt-out syntax.

## Verified Behavior

- `/!面板 基础` is normalized to `!面板 基础` before AI opt-out parsing and returns category child commands.
- `/!面板 基础 help` expands to the existing `!help` handler.
- `/!普通内容` remains the original group-member AI bypass and is not converted into a command.
- Existing direct `!` commands, permissions, confirmations, cooldowns and Portal switches are unchanged.
- Development CI 36476322049: success.
- Main CI 36476525721: success.
- Cloudflare production Connected Build 8aa6ab67-ad80-4ddd-b916-0b76e7bfcf3c: success.

## Recovery Route

Treat 64513e94f6634921f0b1ee8f7c6d5d44a754a6f5 as the verified product revision. If a live QQ panel command still fails, capture the exact sent message text and QQ event type; do not change the category registry until the transport/input shape is known.
