# ACTIVE_TASK

task_id: qqaibot-20260927-qqopen-v4-native
task_status: active
goal_revision: 5

## Goal

Run QQAIBOT as a hybrid QQ bot: QQ Open owns official interactions/actions while NapCat/OneBot supplements visibility and legacy capabilities without duplicate AI/plugin/moderation behavior.

## Completed This Transaction

- Diagnosed raw `<@OpenID>` as a QQ Open runtime bug caused by prepending `reply_plan.mentionIds` as CQ mentions.
- Removed that prefix injection. QQ Open answers now send the AI text without synthetic OpenID mention markup.
- Retained official passive-reply semantics: source `msg_id` plus unique `msg_seq`.
- Did not add unsupported `message_reference`; current QQ group/C2C APIs do not guarantee a classic quote box.
- Hardened rich-media reply payloads with non-empty content for `msg_type=7`.
- Diagnosed discovery `必填字段缺失`:
  - menu update lacked the outer `menu` property;
  - panel list omitted required `scope`;
  - panel update lacked the outer `panel` property.
- Corrected menu/panel payloads and scoped C2C/group pagination.
- Queried production D1 before mapping fix; learner keys/evidence were completely absent.
- Diagnosed mapping chicken-and-egg:
  - OneBot observation was recorded only after a message was already considered auxiliary;
  - user was mentioning the official AIBot, not the legacy NapCat bot;
  - therefore the old transport saw the group message but never recorded mapping evidence.
- Added `recordHybridMappingObservation` before ownership suppression so every human OneBot group message may contribute evidence.
- Added QQ Open recent-observation storage and reverse reconciliation so QQ Open-first and OneBot-first delivery order both work.
- Retained safe mapping threshold: 3 distinct official message IDs.
- Kept low-information rejection; a plain `HI` still does not count as mapping evidence by design.
- Portal now displays candidate count and learning progress.
- Feature commit `535804857f530dd8bf16d221422a6ed095300fe8`: full CI success.
- Regression commit `edeacf6cf8c215cc3987b86a4a0d5220c7f581d9`: full CI `36366534308` success.
- Main CI `36366701774`: success.
- Isolated Worker build `e280d9fb-bb0d-4659-91e8-cb2db205e1a3`: success.
- Production build `2f3fa902-2e60-44a2-8355-7459a5ef9db4`: success.
- Production Worker version `4d8fff7e-5713-4e5c-83e2-7caa9bcbb633`.
- Production read-back confirms OneBotHub, QqOpenGateway, D1, Vectorize, Workers AI, Rate Limiter and existing Secrets remain intact.
- Production `QQ_OPEN_INTENTS` remains `33554432`.

## Current Production Behavior

- QQ Open AI reply text no longer receives a synthetic OpenID mention prefix.
- QQ Open passive replies use `msg_id + msg_seq`.
- OneBot/NapCat remains installed and connected as auxiliary visibility/fallback.
- OneBot mapping observation is independent from ownership, so unmapped groups can now be learned.
- QQ Open observations remain available for later OneBot correlation and vice versa.
- Static `QQ_HYBRID_GROUP_MAP` remains authoritative.
- Interaction implementation remains dormant unless its permission is explicitly confirmed.

## Live Verification Still Needed

1. Refresh QQ Open diagnostics after deploy and verify discovery `lastError` clears and fingerprint becomes non-empty.
2. Send three new distinctive @AIBot messages after this deploy. Avoid generic `HI/你好`-only samples.
3. Confirm Portal mapping candidate progresses `1/3 → 2/3 → mapped`.
4. Confirm replies no longer contain literal `<@OpenID>`.
5. Confirm passive replies continue to succeed. A classic visible quote box is not expected because that reference field is not currently supported for QQ group/C2C.
6. If receive-all-message is enabled, verify GROUP_MESSAGE_CREATE ownership after mapping.

## next_exact_action

Ask the user to refresh the Gateway diagnostic and send three new distinctive @AIBot messages such as `映射测试 A7281`, `映射测试 B4136`, `映射测试 C9502`; then inspect Portal candidate progress and production D1 evidence.

last_checkpoint_at: 2026-09-28T09:40:00+08:00
