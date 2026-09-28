# CURRENT_STATE

## GitHub

Production product head:
`edeacf6cf8c215cc3987b86a4a0d5220c7f581d9`

Feature implementation:
`535804857f530dd8bf16d221422a6ed095300fe8`

Verification:
- feature product CI: success
- regression CI `36366534308`: success
- main CI `36366701774`: success

## Cloudflare

Production Worker: `qqai`
Production build: `2f3fa902-2e60-44a2-8355-7459a5ef9db4`
Outcome: success
Worker version: `4d8fff7e-5713-4e5c-83e2-7caa9bcbb633`

Retained bindings:
- OneBotHub
- QqOpenGateway
- D1
- Vectorize
- Workers AI
- Rate Limiter
- QQ Open Secret and all existing application Secrets

Production Intent remains `33554432`.

## Reply Fix

QQ Open ordinary AI responses:
- do not prepend `reply_plan.mentionIds`;
- do not serialize the source user OpenID into visible text;
- continue to include source `msg_id` and allocated `msg_seq`;
- rich media `msg_type=7` includes placeholder content.

Current QQ group/C2C message reference/quote UI cannot be forced through an unsupported `message_reference` field.

## Discovery Fix

The deployed API now:
- PUTs global menu as `{ menu }`;
- lists panels with required `scope` separately for C2C and group;
- supports panel-list `records` and pagination;
- PUTs panel updates as `{ panel }`.

Live Gateway discovery status has not yet been re-read from the authenticated Portal after deploy.

## Hybrid Mapping Fix

New D1 keys/data:
- `hybrid_aux_recent`: OneBot observations
- `hybrid_qqopen_recent`: QQ Open observations
- `qqopen_group_map_evidence:<group_openid>:<numeric_group>`
- `qqopen_group_map_candidates`
- `qqopen_dynamic_group_map`

Mapping behavior:
- observations are recorded before ownership suppression;
- either transport may arrive first;
- correlation window is 12 seconds;
- generic/low-information text is ignored;
- ambiguous candidates are rejected;
- 3 distinct official message IDs remain required;
- Portal exposes pending candidates/progress.

Pre-fix production D1 contained none of the learner rows, explaining the user's 0 mapping count.
