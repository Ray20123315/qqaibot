# Ray_Chen Memory Entry

- memory_version: v0.0.47
- project: QQAIBOT
- repository: Ray20123315/QQAIBOT
- canonical_branch: main
- development_branch: feature/v4-public-bot
- task_id: qqaibot-20261001-v4-preview-user-acceptance
- task_status: active
- goal_revision: 1
- product_revision: 18f254cc18fe599ca27a89106fa4e87759776165
- updated_at: 2026-10-01T08:52:00+08:00

## Current Goal

Keep all new V4 acceptance work off production. Make the existing stable V4 Preview URL usable at highest privilege, verify it automatically, then wait for the user to manually accept it before any production merge.

## Verified Preview State

- feature branch fast-forwarded to current main without force, then received Preview-only commit `18f254cc18fe599ca27a89106fa4e87759776165`.
- GitHub CI run `36797489597`: success.
- Cloudflare branch build `5fc78ebc-9f14-4f61-8f2c-a347252f09b2`: success.
- stable Preview deployment: `df3e4ed6-59c5-4ece-9cd4-e711846525a2` / number 5.
- stable URL: `https://feature-v4-public-bot-qqai.ray20123315.workers.dev/`.
- Preview HTML shows the highest-privilege test-login button.
- Browser-driven live probe: login HTTP 200, `systemAdmin=true`, `preview=true`; viewer API HTTP 200, `developer=true`, role `developer`, `systemAdmin=true`.
- Preview D1 namespace: `kv_store_v4public_preview`.
- Preview `QQ_OPEN_ENABLED=false`.
- production QQ secret, OneBot secret/DO, Gemini secret, Vectorize and production admin secret are absent from the promoted Preview deployment.

## Acceptance Gate

Do not merge this Preview-only test login into `main` until the user manually opens the stable Preview URL and confirms the V4 UI is usable.

## Resume Rule

Continue from feature commit `18f254cc18fe599ca27a89106fa4e87759776165`. The next exact action is user manual acceptance, not a production merge.


## Feature Memory Packaging

The existing Ray_Chen package workflow is enabled on `feature/v4-public-bot` so the exact acceptance-test memory tree can be exported without modifying `main`.
