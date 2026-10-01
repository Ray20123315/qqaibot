# VERIFY

## V4 Preview Acceptance Revision

`18f254cc18fe599ca27a89106fa4e87759776165`

## GitHub

- branch: `feature/v4-public-bot`
- CI run `36797489597`: SUCCESS
- passed repository regression checks
- passed V3 regression checks
- passed V4 QQ Open regression checks
- passed isolated V4 test-deployment checks
- passed single Worker bundle

## Cloudflare Branch Build

Build `5fc78ebc-9f14-4f61-8f2c-a347252f09b2`:
- branch: `feature/v4-public-bot`
- commit: `18f254cc18fe599ca27a89106fa4e87759776165`
- outcome: success

The uploaded branch version inherited production bindings, so it was not directly used as the stable Preview deployment.

## Stable Preview Deployment

- Preview id: `068adb610f4d47daa65c1376e021787f`
- deployment: `df3e4ed6-59c5-4ece-9cd4-e711846525a2`
- deployment number: 5
- stable URL: `https://feature-v4-public-bot-qqai.ray20123315.workers.dev/`
- source commit annotation: `18f254cc18fe599ca27a89106fa4e87759776165`

Binding read-back:
- D1: present
- `QQAI_DB_TABLE=kv_store_v4public_preview`
- `V4_PREVIEW_TEST_LOGIN=true`
- `V4_PREVIEW_TEST_EXPIRES_AT=2026-10-03T00:00:00+08:00`
- `QQ_OPEN_ENABLED=false`
- production QQ client secret: absent
- production OneBot secret: absent
- production OneBot Durable Object binding: absent
- Vectorize: absent
- Gemini secret: absent
- production Portal admin password: absent

## Live Preview UI

Browser Rendering of the stable URL returned HTTP 200 and confirmed:
- Preview login wrapper is visible.
- button text renders as `进入 V4 最高权限测试` after Simplified-Chinese output normalization.
- the old QQ-only frontend validation is no longer the active Preview UI.

## Live Highest-Privilege Login

Browser-side request against the real stable Preview URL:
- `POST /api/auth/preview-test-login`: HTTP 200
- login `systemAdmin=true`
- login `preview=true`
- `GET /api/portal/v4/resources/viewer`: HTTP 200
- viewer `developer=true`
- viewer role: `developer`
- viewer `systemAdmin=true`

## Safety Guards

Regression verifies:
- production hostname cannot use Preview test login;
- expired Preview test login is rejected;
- Preview test login is rejected when `QQ_OPEN_ENABLED` is not false;
- created session is system-admin/developer.

## Pending

User manual acceptance is still required. No production merge is authorized before that confirmation.

## Feature Memory Package

`.github/workflows/ray-chen-memory-package.yml` now also runs for `feature/v4-public-bot` when memory files change. The resulting artifact must contain the exact `v0.0.47` memory tree, required Canonical files, archive listing and SHA-256 evidence.

