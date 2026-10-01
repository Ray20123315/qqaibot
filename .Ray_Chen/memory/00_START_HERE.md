# Ray_Chen Memory Entry

- memory_version: v0.0.48
- project: QQAIBOT
- repository: Ray20123315/QQAIBOT
- canonical_branch: main
- development_branch: v4-qqopen-native
- task_id: qqaibot-20261001-panel-complete-real-message-send
- task_status: active
- goal_revision: 2
- base_revision: 5b7f3c5e1c75d98150d794b2d2c689c77a145bfc
- verified_product_revision: 6cb891571bdb2744b13bd11e3731c2a267fdf1ed
- updated_at: 2026-10-01T21:45:00+08:00

## Current Goal

Repair QQ native group discovery after live client evidence showed that production only registers category placeholders such as `!面板 群聊`, `!面板 关系`, `!面板 互动`.

Required behavior:
- QQ native group panels must directly expose the actual standalone commands from the canonical registry.
- Commands stay categorized across multiple QQ panels so the platform item/panel limits are respected.
- `!面板 <分类>` inline-keyboard routing remains available as an additional/fallback entry point.
- Category placeholder items must no longer replace the actual native commands.

## Live Evidence

User screenshot on 2026-10-01 shows only category entries with descriptions like “4 个子指令，发送后查看”; concrete commands are absent from the native command list.

## Execution Plan

1. Replace the single group-root discovery panel with categorized group command panels built from the registry.
2. Keep developer-targeted C2C panels and global menu behavior intact.
3. Expand discovery regression to require every enabled group command in native group panels and prohibit category placeholders from replacing them.
4. Run development CI, then fast-forward main only on success.
5. Verify main CI, Cloudflare Connected Build, discovery resync evidence if observable, then reconcile memory and notify the user.

## next_exact_action

Patch src/v4/qqopen/discovery.js and verify-v4-qqopen.mjs on v4-qqopen-native.
