# ACTIVE_TASK

task_id: qqaibot-20260927-codex-shared-session-exe
task_status: completed
goal_revision: 1

## Goal

Extend the existing Codex bridge without replacing its security model:
1. Package the existing local Codex bridge as a Windows x64 EXE suitable for background use.
2. Preserve the existing read/edit allowlists, staging, sensitive-path exclusions, no-delete behavior, export flow, and outbound-only WebSocket architecture.
3. Make direct `!codex`, `!codexchat`, and `!codexwork` reuse the same Codex conversation for the same QQ user/chat scope.
4. Keep suffix/plugin `--codex`, `--codexchat`, and `--codexwork` on one stable thread within the same plugin/user/chat scope.
5. Add CI that actually builds and smoke-tests the Windows EXE.

## Acceptance Criteria

- The EXE imports and runs `tools/codex-work-bridge.mjs`; it does not duplicate filesystem authorization logic.
- Local bridge token/config remain local and are not committed as secrets.
- The EXE supports config initialization, foreground debug mode, hidden background launch, install/remove logon startup, and custom config path.
- Direct three-mode Codex commands share `qqaibot:<scope>:user:<qq>:codex`.
- Plugin/suffix three-mode Codex commands share one plugin-scoped Codex key.
- Mode switches, work root changes, and read/edit mode changes do not intentionally create another direct Codex thread.
- Existing public quota and developer-only restrictions remain unchanged.
- Repository regression, V3 regression, and Worker dry-run bundle pass.
- A Windows runner builds the executable and runs `QQAIBOT-CodexBridge.exe --help` successfully.
- Built EXE SHA-256 is recorded.

## Completed Steps

- Unified direct Codex session key in `src/v3/ai/codex-command-runtime.js`.
- Unified plugin/suffix Codex session key in `src/v3/host/adapter.js`.
- Updated help/usage/README and relevant regression expectations.
- Exported bridge `main()` so the Windows wrapper reuses the existing core.
- Added `tools/codex-bridge-windows.mjs` and local config example.
- Added `npm run codex:bridge:exe`.
- Added `.github/workflows/build-codex-bridge-exe.yml`.
- Added `verify-codex-bridge-exe.mjs`.
- Repaired the first Windows bundle smoke failure caused by CJS `import.meta.url` handling.
- Product commits: `9b4a20cf4aec9d2322b6aec6b1788e103c227ecd`, `700402392c28678931f8432103fe464814fcaf86`, `e2956f001e1c6263aa58b7224c2645dd6a2c91cf`.
- Windows EXE artifact downloaded and independently inspected as PE32+ x86-64.

## Verification Results

- GitHub Actions validate run `36305191852`: success.
- `npm run check`: success.
- `npm run check:v3`: success.
- `npm run check:bundle`: success.
- Windows EXE run `36305191806`: success.
- Windows EXE build: success.
- Windows EXE `--help` smoke test: success.
- Artifact ID: `10926823025`.
- Artifact GitHub digest: `sha256:1cbd5f11699a3daeb1b7bf597d32ccee6518db99cf9f7a5d5d4d0d932af84e9b`.
- EXE size: `57625687` bytes.
- EXE SHA-256: `457a5d6ca74011ae2a9c13c5f95f9017492a82787a050428819e888a6b205513`.
- Final relevant blobs read back from `main`: success.
- Live end-to-end test on the user's Windows machine with the user's actual Codex CLI/NapCat remains not available from this environment.

## Known Limitations

- The EXE does not contain the user's bridge token or filesystem paths; these must be configured locally.
- Production Cloudflare deployment revision was not changed or verified by this task.
- Actual local Codex CLI login, Windows ACLs, NapCat file upload, and real QQ end-to-end behavior still require one smoke test on the user's computer.

## next_exact_action

On the user's Windows computer, place `QQAIBOT-CodexBridge.exe`, run `--init-config`, fill only the local bridge token and explicit read/edit roots, run `--run` for the first smoke test, then issue `!codex`, `!codexchat`, and `!codexwork` sequentially in the same QQ chat and confirm context continuity plus one safe CodexWork read/export.

last_checkpoint_at: 2026-09-27T16:10:00+08:00
