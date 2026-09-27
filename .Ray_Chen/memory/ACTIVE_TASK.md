# ACTIVE_TASK

task_id: qqaibot-20260927-codexwork-public-quota-diagnostics
task_status: completed
goal_revision: 1

## Goal

Implement the requested Codex split and safe local-work path directly on `main`:
1. Public `!codex` / `--codex` for all users with bounded per-user quota, fixed GPT-6 Luna and no reasoning, reusing the same conversation session.
2. Developer `!codexchat` / `--codexchat` retaining the former advanced Codex controls.
3. Developer `!codexwork` / `--codexwork` that can read only explicitly allowlisted local folders, is read-only by default, can write only inside explicit edit roots, never deletes source files, and can return selected artifacts to QQ.
4. Avoid unnecessary skills/plugins/context by using an isolated local Codex home and on-demand context policy.
5. Add Portal terminal-style Logs with view/download, deterministic self-check, and safe automatic repair without AI.

## Acceptance Criteria

- Public Codex is available to ordinary users and developers, uses GPT-6 Luna + reasoning `none`, and is limited per user/day.
- Public repeated calls reuse a stable session key rather than forcing a new conversation.
- Advanced model/reasoning/original-prompt controls are developer-only via CodexChat.
- CodexWork requires a local bridge and local read-root allowlist; edit mode requires explicit edit roots contained inside read roots.
- Symlinks and sensitive paths are not copied into the work snapshot; deletions are never written back.
- Changed/new files are written back only when their destination is inside an edit root.
- Selected exported files can be handed from the local bridge through Worker/OneBot to QQ.
- Codex execution does not automatically load unrelated project skills/plugins/MCP configuration.
- Portal logs are developer/system-admin only, redact secrets, can be viewed/downloaded, and diagnostics provide no-AI safe repair.
- Full repository regression, V3 regression, and Worker dry-run bundle pass.

## Completed Steps

- Added D1-backed public Codex quota and fixed public model policy.
- Split command parsing/runtime into public Codex, developer CodexChat, and developer CodexWork, including suffix forms.
- Added stable per-user/per-scope public session keys and failure quota refund behavior.
- Extended Codex bridge protocol with bounded `work` metadata and attachment/work result handling.
- Added local outbound `tools/codex-work-bridge.mjs` with isolated `CODEX_HOME`, read/edit allowlists, staging snapshots, sensitive-path exclusion, no-delete writeback, explicit export markers, and session resume mapping.
- Added QQ file transfer support for CodexWork exports.
- Added Portal diagnostics/log terminal UI, log download, deterministic checks, and `/v3/repair-safe` no-AI repair.
- Added/updated Codex, bridge-security, quota, diagnostics, and host-adapter regressions.
- Repaired duplicated syntax introduced in the large feature commit so CI could execute all checks.
- Final verified product commit: `b6d757261f2c5ceffda09e78b20bfc466456640f`.
- Final GitHub Actions run `36304035160`: all required steps successful.

## Verification Results

- `npm run check`: success in GitHub Actions run `36304035160`.
- `npm run check:v3`: success in GitHub Actions run `36304035160`.
- `npm run check:bundle`: success in GitHub Actions run `36304035160`.
- Targeted Codex policy/work security/Portal diagnostics tests: included in `check:v3` and passed.
- Local bridge syntax/security mini-test before repository write: success.
- Current relevant file blobs read back from `main`: success.
- Live end-to-end test on the user's Windows machine with the user's actual Codex CLI/NapCat: not available from this environment.

## Known Limitations

- The local bridge cannot become active until the user's computer supplies `QQAI_CODEX_BRIDGE_URL`, `QQAI_CODEX_BRIDGE_TOKEN`, and at least one `QQAI_CODEXWORK_READ_ROOTS` entry and runs the bridge process.
- Edit access remains disabled unless `QQAI_CODEXWORK_EDIT_ROOTS` is explicitly configured.
- The exact locally installed Codex CLI version/authentication state is not observable here; CLI compatibility therefore still needs one live smoke test on the user's computer.

## next_exact_action

On the user's computer, configure the bridge environment with the minimum read-root allowlist, leave edit roots empty for the first test, start `npm run codex:bridge`, then send one `!codexwork --root <alias> <read-only question>` from QQ and verify the returned answer plus Portal diagnostics/logs.

last_checkpoint_at: 2026-09-27T15:49:15+08:00
