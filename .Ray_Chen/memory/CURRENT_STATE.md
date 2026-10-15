# CURRENT_STATE
- Repository Ray20123315/qqaibot; main at task start 6172bf1043653fa34634db6494d030d92acc78f0, feature feature/manual-cross-group-command-20261015 @ 4e9924729598d556b5030acd91561a9bba6d6f2d.
- Strict Bbot /跨群 command-only source implemented and tested in feature; AI reply path remains Abot passive, Codex GUI source unchanged, Bbot D1/Vectorize memory source unchanged.
- Existing cross-group binding storage: D1 bridge_groups and bridge_rooms; synthetic napcat:<QQ group> IDs remain. No migrations or D1 writes made during this task.
- Cloudflare D1 read-only 2026-10-15: 8 total group binding rows, 4 verified under one room; all 4 verified rows stopped=1 with numeric group IDs; zero active sender/destination. Real send acceptance BLOCKED until authorized resume.
- Feature tests enforce text length 1–1200, exact literal /跨群, all active same-room targets, no self/other-room/stop, recall mapping, manual-v1 outbox-only, no stale auto sends and no unsolicited join broadcast.
- Existing Windows GUI Codex Bridge built by prior Windows CI 38114199372; preserve tools/codex-bridge-gui and package workflow.
- QQ stale official native menu item /!设置插话率 remains UNKNOWN/NOT VERIFIED removed. Cloudflare earlier QQ panel endpoint returned unsupported schema; no broad deletes authorized.
