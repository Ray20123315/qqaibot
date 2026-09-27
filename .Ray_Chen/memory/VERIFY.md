# VERIFY

## Canonical Product Verification

- workflow: `.github/workflows/validate.yml`
- verified product commit: `b6d757261f2c5ceffda09e78b20bfc466456640f`
- verified run_id: `36304035160`
- `npm run check`: success
- `npm run check:v3`: success
- `npm run check:bundle`: success

## Targeted Codex / Diagnostics Regressions Included in `check:v3`

- `verify-v3-host-adapter.mjs`: success
- `verify-v3-codex-websocket.mjs`: success
- `verify-codex-command.mjs`: success
- `verify-codex-policy.mjs`: success
- `verify-codex-work-security.mjs`: success
- `verify-portal-diagnostics.mjs`: success

## Important Invariants

- Public `!codex` cannot select another model or reasoning level; policy remains GPT-6 Luna / `none`.
- Public quota storage failure fails closed.
- Public failure path refunds quota where possible.
- `!codexchat` and `!codexwork` remain developer-only.
- Work bridge read roots are required for filesystem work.
- Edit roots must be contained within read roots.
- Sensitive paths and symlinks are excluded from snapshots.
- Staging deletions are reported/ignored and never applied to source files.
- Writeback validates every target against local edit roots.
- QQ export requires explicit markers and a safe file inside the staging root.
- Portal diagnostics requires developer/system-admin authorization and redacts log output.
- Safe repair reports `aiUsed: false`.

## External / Live Verification Still Needed

A live test on the user's computer is still required because this environment cannot inspect the installed Codex CLI, its authentication state, Windows filesystem ACLs, or the actual NapCat process. The first smoke test should use read-only CodexWork with no edit roots configured.
