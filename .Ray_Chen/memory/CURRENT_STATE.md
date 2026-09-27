# CURRENT_STATE

## Verified Product State

- canonical repository: `Ray20123315/qqaibot`
- canonical branch: `main`
- verified product commit: `b6d757261f2c5ceffda09e78b20bfc466456640f`
- verified GitHub Actions run: `36304035160`
- regression checks: success
- V3 regression checks: success
- single Worker dry-run bundle: success

## Codex Access Model

### Public `!codex` / `--codex`

- Available to ordinary users and developers.
- Model is fixed to `gpt-6-luna`.
- Reasoning is fixed to `none`.
- Uses a per-user Taipei-day D1 quota; default is 5 requests/day and is deployment-configurable.
- Uses stable session keys so subsequent requests in the same scope/user reuse the Codex conversation rather than intentionally starting a fresh thread.
- Failed bridge calls refund the reserved public quota when possible.

### Developer `!codexchat` / `--codexchat`

- Developer-only advanced chat path.
- Retains model, reasoning level, and original-prompt controls that belonged to the former developer `!codex` flow.

### Developer `!codexwork` / `--codexwork`

- Developer-only local workspace path.
- Local bridge connects outbound to the Worker; no inbound local listening port is required.
- Read access is limited by `QQAI_CODEXWORK_READ_ROOTS` on the user's computer.
- Default work mode is read-only.
- Writeback is possible only with explicit `--edit` plus `QQAI_CODEXWORK_EDIT_ROOTS`; every edit root must lie inside a read root.
- Work is performed on a temporary staging snapshot. Symlinks and sensitive paths such as `.git`, `.codex`, `.agents`, `node_modules`, `.env*`, credential/secret files, and private-key-like files are excluded.
- Deletions in staging are ignored and are never propagated to source data.
- Changed/new files are written with a temporary file and rename/copy only after destination allowlist validation.
- A response may mark up to 10 files with `[[QQAI_EXPORT:relative/path]]`; the local bridge copies only safe files to its export directory, and Worker/OneBot uploads returned attachments to QQ.
- Dedicated `QQAI_CODEX_HOME` isolates the bridge from the user's normal Codex plugin/MCP/skill configuration; prompts also require on-demand minimal context.

## Portal Diagnostics

- `src/portal/diagnostics.js` adds a terminal-style diagnostics/log view for developer/system-admin sessions.
- Supports log viewing and text download with secret-pattern redaction.
- Self-check is deterministic and does not require AI.
- Safe repair calls `/v3/repair-safe`, restores socket references and kicks the queue scheduler when safe; `aiUsed` is false.

## Security Boundary

Host-side/local-bridge allowlists are authoritative. Worker prompts or model behavior are not treated as a filesystem security boundary. The design keeps sandboxing plus explicit host validation, consistent with current OpenAI guidance to use constrained execution environments and explicit writable roots.

## Deployment / Runtime State

Repository implementation is verified on `main`. Production Cloudflare deployment revision and live local bridge/NapCat behavior were not verified in this task.
