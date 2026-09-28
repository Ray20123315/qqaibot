# ACTIVE_TASK

task_id: qqaibot-20260929-keyboard-payload-fix
task_status: completed
goal_revision: 1

## Goal

Make the real QQ client render the group category inline keyboard instead of silently falling back to plain text.

## Acceptance Results

- VERIFIED: keyboard action includes `permission:{type:2}`.
- VERIFIED: keyboard action includes `click_limit:1`.
- VERIFIED: each button includes a stable `group_id`.
- VERIFIED: runtime keyboard normalization preserves/defaults all official fields.
- VERIFIED: keyboard replies use `msg_type:2` and `markdown:{content}`.
- VERIFIED: passive keyboard replies keep `msg_id` and `msg_seq`.
- VERIFIED: interaction keyboard replies keep `event_id`.
- VERIFIED: deterministic keyboard rejection increments keyboard-specific fallback diagnostics.
- VERIFIED: ambiguous 5xx/timeouts do not trigger a second fallback write.
- VERIFIED: existing command handlers, permissions, confirmations, cooldowns, slash-panel routing and TEMP-admin logic are unchanged.
- VERIFIED: development and main full CI pass.
- VERIFIED: production Connected Build succeeds.

## Evidence

- product revision: `0fa643433285df0879878441e846dcfc023054b7`
- development CI: `36481097113` — success
- main CI: `36481292173` — success
- production build: `0d835129-1a85-413b-9e0a-ec063da9e464` — success
- Tencent SDK reference used for DTO/message shape: `tencent-connect/qqbot-agent-sdk@6163b5dc979a2f12379b1916805009075008c3c3`

## Remaining Live Verification

Automated tests validate the exact outbound structure but cannot render the QQ client. One live category click remains required.

## next_exact_action

Live-click `/!面板 基础`; if buttons still do not render, inspect runtime `keyboard.lastError` and `keyboard.fallbackCount`.

last_checkpoint_at: 2026-09-29T05:45:00+08:00
