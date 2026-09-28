# DECISIONS

## Retained

D-001 through D-065 remain in force.

## D-066 Group category replies use QQ inline keyboards
status: accepted
date: 2026-09-29
Decision: selecting a group-panel category returns a QQ inline keyboard instead of only a plain child-command list. Buttons reuse canonical existing commands so there is no second authorization or execution path.

## D-067 Keyboard fallback is deterministic-only
status: accepted
date: 2026-09-29
Decision: when QQ rejects keyboard capability with deterministic client/capability 4xx responses, the same response may fall back to text. Ambiguous 5xx/timeouts are not resent because the original write may have succeeded.

## D-068 Concurrent main work is merged, never overwritten
status: accepted
date: 2026-09-29
Decision: the keyboard feature is integrated with two-parent merges that preserve the Portal temporary-admin hotfix and its memory history. Main is never force-replaced by the feature branch.
