# VERIFY

## Canonical Product Verification

- workflow: `.github/workflows/validate.yml`
- verified product commit: `e2956f001e1c6263aa58b7224c2645dd6a2c91cf`
- verified run_id: `36305191852`
- `npm run check`: success
- `npm run check:v3`: success
- `npm run check:bundle`: success
- main blob readback for shared session/runtime/EXE wrapper/workflow/test fixture: success

## Windows EXE Verification

- workflow: `.github/workflows/build-codex-bridge-exe.yml`
- run_id: `36305191806`
- conclusion: success
- Windows runner: `windows-latest`
- build step: success
- executable `--help` smoke test: success
- artifact upload: success
- artifact name: `QQAIBOT-CodexBridge-Windows-x64`
- artifact ID: `10926823025`
- artifact GitHub digest: `sha256:1cbd5f11699a3daeb1b7bf597d32ccee6518db99cf9f7a5d5d4d0d932af84e9b`
- downloaded ZIP inspection: contains EXE + SHA256SUMS
- executable type: PE32+ Windows x86-64
- executable size: `57625687` bytes
- executable SHA-256: `457a5d6ca74011ae2a9c13c5f95f9017492a82787a050428819e888a6b205513`
- bundled SHA256SUMS matches independently computed EXE hash: success

## Shared Session Invariants

- Direct `!codex`, `!codexchat`, `!codexwork` use `qqaibot:<scope>:user:<qq>:codex`.
- Direct session identity does not contain mode, work root, read/edit state, model, or reasoning.
- Plugin/suffix Codex modes share `qqaibot:plugin:<plugin>:<scope>:<peer>:user:<qq>:codex`.
- Public quota/model policy remains distinct from conversation identity.
- Developer-only gates for CodexChat/CodexWork remain distinct from conversation identity.

## Existing Security Invariants

- Work bridge read roots are required for filesystem work.
- Edit roots must be contained within read roots.
- Sensitive paths and symlinks are excluded from snapshots.
- Staging deletions are reported/ignored and never applied to source files.
- Writeback validates every target against local edit roots.
- QQ export requires explicit markers and a safe file inside the staging root.
- EXE wrapper reuses the existing bridge core.

## External / Live Verification Still Needed

A live test on the user's computer is still required because this environment cannot inspect the installed Codex CLI authentication state, Windows filesystem ACLs, production Cloudflare deployment revision, or the actual NapCat process. The first local test should run the EXE in `--run` mode and confirm context continuity across all three commands before enabling logon startup.
