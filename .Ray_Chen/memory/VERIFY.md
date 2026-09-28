# VERIFY

## V4 Public Branch

Branch: `feature/v4-public-bot`
Base main: `08ceeb725590d9efb0160ea38733d929e6e7d18c`

## Foundation Assertions Prepared

`verify-v4-public-foundation.mjs` checks:
- role precedence and Chinese labels;
- default legal statement version;
- text-first political block/review/pass behavior;
- classifier review behavior;
- official capability error classification;
- no fallback on 5xx/timeout;
- mapped numeric group fallback;
- OpenID-target fallback refusal;
- official message-ID fallback refusal;
- user provider ownership/shared-group/private-chat fields;
- live-membership requirement for provider and consumer;
- global plugin-risk non-overridable result;
- core permission router wiring;
- all-rights-reserved license notice.

## Recovery Check

After the first orchestration-limit failure, branch read-back showed head `61acced3d9bd96ec54cc02f30cff239bef9873b6`; no product mutation had landed.

## Pending

- Foundation tree/commit.
- GitHub CI for foundation.
- Integrated BYOK/DM/Portal/plugin runtime verification.
- Same-Worker Cloudflare preview.
- Official QQ 2023 self-test workbook.
