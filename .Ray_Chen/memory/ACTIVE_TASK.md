# ACTIVE_TASK
task_id: qq-retired-panel-schema-diagnostic-20261011
task_status: active
goal_revision: 3
goal: Safely diagnose and remove obsolete QQ native slash entry /!设置插话率 without disturbing the verified native Windows Codex GUI, Abot AI or Bbot memory.
acceptance_criteria: Fail-closed JSON envelope handling, regression tests and Node CI green; main promotion only after green; actual QQ command removal requires runtime/platform confirmation.
hard_constraints: Never bulk-delete QQ panels, expose secrets or raw QQ records, overwrite native WinForms GUI, change Abot/Bbot/D1/Vectorize or remove existing backups.
current_phase: Feature promoted to main; main CI and Cloudflare deployed, QQ platform outcome pending.
current_step: Inspect production QQ cleanup after next retry and check native QQ slash menu.
completed_steps:
- Windows native Codex GUI tested by GitHub Windows CI 38114199372. Artifact 11693066002 verified; original CLI backup exists. Actual double-click on user machine unobserved.
- Main baseline b4bfd8036a2419c6448161368c0effa7167dd87c CI 38115171608 passed. Cloudflare deployment 76a77bf2-c2e4-4064-9159-d3c70f380a8f, version 9ef32fc9-0039-4bcd-abe7-0de69633e68f at 100%.
- Cloudflare observability 2026-10-11 05:34Z shows QQ_RETIRED_PANEL_CLEANUP_FAILED none QQ_PANEL_RECORDS_MISSING. No successful command deletion evidence.
- Feature supports up to two documented data envelopes, emits type-only schema errors and adds regression tests. Promoted to main 7a206ebb33639f7d4cd8413f8f339a58066dc0c2 after feature CI green; main CI and Cloudflare deployment verified.
verification_results: Feature CI 38115855773 success; main CI 38115895140 success; Cloudflare deployment 62887ac7-c947-4efc-93a0-bcd2ef9797db at 100%. Post-deploy QQ cleanup UNKNOWN.
blockers: QQ API returned unsupported record schema; published QQ legacy command may require separate authenticated bot management console.
known_risks: One-shot state retries only after 15 minutes; successful new panel lookup may not cover old published slash menu.
next_exact_action: Read Cloudflare safe QQ panel diagnostic after next retry (around 05:49Z or later); confirm QQ client menu; if legacy entry remains, use official QQ developer portal.
resume_rule: Recheck GitHub main/feature SHA and Actions; never duplicate already verified native GUI.
last_checkpoint_date: 2026-10-11
