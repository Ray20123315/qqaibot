# ACTIVE_TASK

task_id: qqaibot-20261001-v4-preview-user-acceptance
task_status: active
goal_revision: 5

## Goal

Finish V4 Portal visual acceptance: keep the now-working persistent login, remove intrusive motion-control/status UI, and make page transitions visibly match the supplied reference. Keep changes on `feature/v4-public-bot`; do not touch `main`; do not live-test the Bot in existing QQ groups.

## Acceptance Criteria

- Persistent login remains intact across reload.
- No separate motion-mode control occupies the Portal UI.
- Toast/status feedback does not participate in layout or cover a large content area.
- Old view visibly leaves before the new view activates.
- Destination page has a visible ~0.55s enter from translateY/scale/opacity.
- Page children stagger rather than appearing all at once.
- Click interactions show ripple feedback.
- Page title/subtitle, numeric counters, nav indicator, motion bar and aurora remain animated.
- Reduced-motion accessibility remains available via prefers-reduced-motion.
- Full repository/V3/V4/isolated/bundle CI passes.
- Preview remains isolated from production credentials and QQ Open.
- No live Bot/group canary testing.
- No `main` merge before user acceptance.

## Completed Steps

- VERIFIED USER: persistent login now works.
- VERIFIED: removed visible motion-mode toggle that appeared in the user's screenshot.
- VERIFIED: removed obsolete document.startViewTransition path from view switching.
- VERIFIED: deterministic leave -> activate -> enter transition sequence.
- VERIFIED: old view leave duration 0.22s.
- VERIFIED: destination page entry 0.55s from translateY(18px) scale(.985) with blur/opacity.
- VERIFIED: card entry 0.52s, content fade 0.46s, child delays 0.03/0.09/0.15/0.21/0.27s.
- VERIFIED: ripple 0.55s ease-out.
- VERIFIED: toast fixed bottom-center, max width 360px, slide/fade 0.24s.
- VERIFIED: latest GitHub CI `36988519024` SUCCESS.
- VERIFIED: Cloudflare build `4e7b2549-b0c3-4c8c-bede-25f219b4ba98` SUCCESS.
- VERIFIED: Worker version 2227 / `e9301249-0cd6-453f-951e-7a5e5ecee9d9`.
- VERIFIED: stable Preview #25 `6ba45208-40af-44b4-b0fb-d0097ca96b56` deployed with safe bindings.
- VERIFIED LIVE: old view remained visible with leave animation before destination activation; ripple existed.
- VERIFIED LIVE: destination health view ran 7 concurrent page/card/content animations after activation.
- VERIFIED LIVE: toast is fixed at bottom 26px, centered, 360px wide.
- VERIFIED LIVE: reload smoke ended with app visible and login hidden.
- USER VISUAL ACCEPTANCE PENDING.

## Product Files Changed Since v0.0.54

- `src/portal/runtime.js`
- `verify-portal-auth-password.mjs`

## Hard Constraints

- Do not merge/update `main`.
- Do not live-test Bot behavior in existing QQ groups.
- Do not enable QQ Open or production QQ/OneBot/AI secrets in the isolated Preview.
- Do not add a motion-control widget solely to demonstrate animations.
- Toast must stay overlay-only and must not alter layout.
- Persistent authentication code that is already user-accepted must not be rewritten without a concrete regression.

## Current Phase

user_visual_acceptance

## next_exact_action

User opens stable Preview #25 and switches between several sidebar pages. Confirm the old page visibly leaves, the new page/card content enters in a clear stagger, ripple is visible on clicks, and no motion-control/toast element overlaps the dashboard.

last_checkpoint_at: 2026-10-02T17:20:00+08:00
