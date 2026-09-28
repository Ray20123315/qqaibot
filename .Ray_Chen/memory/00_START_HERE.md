# Ray_Chen Memory Entry

- memory_version: v0.0.38
- project: QQAIBOT
- repository: Ray20123315/QQAIBOT
- canonical_branch: main
- development_branch: v4-qqopen-native
- task_id: qqaibot-20260929-keyboard-payload-fix
- task_status: completed
- goal_revision: 1
- verified_product_revision: 0fa643433285df0879878441e846dcfc023054b7
- updated_at: 2026-09-29T05:45:00+08:00

## Completed Goal

Fixed the live QQ inline-keyboard payload after the real QQ client proved the previous implementation was being rejected and downgraded to plain text.

## Root Cause

The previous custom keyboard did not match Tencent's current official SDK serialization:
- button action omitted `permission`;
- button action omitted `click_limit`;
- button omitted `group_id`;
- keyboard replies were sent as plain text `msg_type:0` instead of the Markdown `msg_type:2` shape used by Tencent's current keyboard E2E path.

## Result

- keyboard buttons now include `permission:{type:2}`, `click_limit:1`, and stable `group_id`;
- runtime normalization preserves/defaults those fields;
- keyboard messages use `msg_type:2` + `markdown:{content}`;
- passive replies still include `msg_id` / `msg_seq`;
- interaction replies still include `event_id`;
- deterministic keyboard 4xx fallback is recorded in keyboard-specific runtime diagnostics;
- ambiguous 5xx/timeouts are never resent as text;
- existing handlers, permissions, confirmation flows, /! bypass behavior, and Portal TEMP-admin hotfix remain unchanged.

## Verification

- development CI 36481097113: success
- main CI 36481292173: success
- Cloudflare production Connected Build 0d835129-1a85-413b-9e0a-ec063da9e464: success
- production product revision: 0fa643433285df0879878441e846dcfc023054b7

## next_exact_action

In the QQ group, click the “基础” category once. The expected result is a two-column inline keyboard. If QQ still falls back to text, read the new keyboard diagnostic fields before changing payload format again.
