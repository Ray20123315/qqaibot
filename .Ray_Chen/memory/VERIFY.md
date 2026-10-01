# VERIFY

## Goal Revision 3

Validated product commit: `0c4cc0aa55f9e01212b2a39cb979ee8de1ace1fe`

## Development Evidence

- GitHub Actions run `36878357756`: success.
- regression checks: success.
- V3 regression checks: success.
- V4 QQ Open regression checks: success.
- isolated V4 deployment checks: success.
- single Worker bundle: success.

## Required Invariants

- one native group category-root panel;
- no relationship category;
- retained category keyboards cover all retained commands;
- direct/prefill split preserved;
- no relationship creation/approval/management API or handler;
- legacy relationship rows only support deletion;
- old relationship lock sources only support safe historical compatibility;
- no 狼人杀/狼人殺 in worker/help/catalog.

## Remaining Gates

- main promotion: PENDING
- main CI: PENDING
- Cloudflare Connected Build: PENDING
- live QQ smoke: PENDING_USER
