# Ray_Chen Memory
version: v0.0.109
task_id: qqaibot-full-upgrade-20261015
task_status: active
goal_revision: 1
canonical_branch: feature/qqaibot-upgrade-phase1-20261015
base_main_commit: 78d7a8b252cbd12a44599e8c93e1462a524de4a6
updated_at: 2026-10-15T11:44:00Z

## Quick resume
- User requests a complete staged QQAIBOT upgrade, NOT a new bot; preserve Abot passive AI, NapCat/Bbot, manual-only /跨群 <文字>, verified D1 bindings, Vectorize, native Windows GUI Codex Bridge and live credentials/settings.
- Work-in-progress PR #81 is DRAFT, not merged/deployed. Phase 1: Gemini-first regardless of local Codex Bridge status; remove daily Gemini chat caps while adding D1 short burst rate gate and tests. CI run 38729107874 passed BEFORE this memory update.
- Gemini→Luna None fallback must remain OFF until globally coordinated ≤3 concurrency, 30s cooldown, security authorization and circuit breaker are implemented and tested.
- Do not expose group Agent filesystem/shell tools without proven independent isolation. Sol only developer; Max off by default.
- Old portal/persona sources reside in archive/legacy-main-20261009. The current main Worker lacks full old Portal; do not blindly replace main with legacy.
- Previous /跨群 task main had all 4 verified QQ bindings stopped according to read-only D1 inspection. Never auto-resume or reset them. Real QQ /跨群 end-to-end remains unverified until authorized !resume.
- Read ACTIVE_TASK.md, CURRENT_STATE.md, DECISIONS.md, GOTCHAS.md, VERIFY.md, FILE_MANIFEST.json and docs/QQAIBOT_UPGRADE_PLAN_20261015.md before continuing.
