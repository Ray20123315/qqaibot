# CURRENT_STATE

## Verified Product State

- canonical repository: `Ray20123315/qqaibot`
- canonical branch: `main`
- verified product commit: `e2956f001e1c6263aa58b7224c2645dd6a2c91cf`
- validate run: `36305191852` — success
- Windows EXE run: `36305191806` — success
- regression checks: success
- V3 regression checks: success
- single Worker dry-run bundle: success

## Shared Codex Conversation Model

### Direct QQ commands

For the same QQ user and chat scope, these capability modes share one stable session key:

`qqaibot:<group-or-private-scope>:user:<qq>:codex`

Therefore:
- `!codex`
- `!codexchat`
- `!codexwork`

resume the same Codex thread instead of creating mode-specific threads. Changing CodexWork root or toggling read/edit no longer intentionally changes the direct thread key.

Public `!codex` remains quota-bound and fixed to GPT-6 Luna with reasoning `none`. `!codexchat` and `!codexwork` remain developer-only.

### Plugin/suffix Codex modes

`--codex`, `--codexchat`, and `--codexwork` share a stable key within the same plugin + QQ user + chat scope. Plugin isolation is retained so unrelated plugin tasks do not silently merge conversations.

## Windows Codex Bridge EXE

- File: `QQAIBOT-CodexBridge.exe`
- Architecture: Windows x86-64 PE32+.
- Size: 57,625,687 bytes.
- SHA-256: `457a5d6ca74011ae2a9c13c5f95f9017492a82787a050428819e888a6b205513`.
- GitHub Actions artifact: `QQAIBOT-CodexBridge-Windows-x64`, artifact ID `10926823025`.
- Artifact expires according to GitHub retention policy; a conversation copy was also downloaded for delivery.

The EXE wrapper imports the existing `tools/codex-work-bridge.mjs` core. It supports:
- `--init-config`
- `--run`
- `--install-startup`
- `--uninstall-startup`
- `--config <path>`
- no-argument hidden background launch

Default local config path is `%APPDATA%\QQAIBOT\codex-bridge.json`.

## Filesystem Security Boundary

The existing bridge remains authoritative:
- read roots are explicit allowlists;
- edit roots must be inside read roots;
- staging snapshots are used;
- symlinks and sensitive paths are excluded;
- deletions are never propagated;
- writeback validates destinations;
- exports are explicit and bounded;
- the bridge connects outbound to Worker.

## Deployment / Runtime State

Repository implementation and Windows packaging are verified. Production Cloudflare deployment revision and live local Windows Codex CLI/NapCat/QQ behavior were not changed or verified in this task.
