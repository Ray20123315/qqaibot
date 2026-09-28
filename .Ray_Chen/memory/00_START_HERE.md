# Ray_Chen Memory Entry

- memory_version: v0.0.21
- project: QQAIBOT
- repository: Ray20123315/qqaibot
- canonical_branch: main
- development_branch: v4-qqopen-native
- task_id: qqaibot-20260928-command-capability-fallback
- task_status: completed
- goal_revision: 1
- product_revision: fd11cd640cae1124edc03b0fef3d8d8d529cc52b
- updated_at: 2026-09-28T12:50:30+08:00

## Quick Recovery

The requested command/capability restoration is complete and verified.

- QQ Open/AIBot remains the primary inbound owner and the first action transport.
- The V4 command catalog now exposes 75 command entries while preserving the original first-panel ordering.
- Deterministically unsupported/unavailable QQ Open actions may fall back to legacy NapCat/OneBot only inside the same AIBot command execution.
- Mutating legacy group fallback resolves the confirmed numeric group mapping and checks that the legacy Bot is present with the action-required role.
- Missing legacy permission returns an actionable permission request.
- Member-target legacy fallback requires a confirmed member OpenID <-> numeric QQ mapping; unsafe IDs are never coerced.
- Ambiguous mutating QQ Open timeout/5xx failures are not cross-retried.
- Development CI run 36378926121 and main CI run 36379048954 both succeeded.
- Cloudflare production Connected Build 53058046-38a3-4ecc-9fbd-581032693db5 succeeded for fd11cd640cae1124edc03b0fef3d8d8d529cc52b.

## Recovery Route

1. Read ACTIVE_TASK.md and CURRENT_STATE.md.
2. Treat fd11cd640cae1124edc03b0fef3d8d8d529cc52b as the verified product revision.
3. If live QQ behavior differs, inspect the command/action audit and the legacy Bot role/group/member mappings before changing routing.
4. Do not re-enable parallel OneBot ingress while QQ Open is primary.
