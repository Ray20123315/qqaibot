# VERIFY

## Verified Product Revision

`dea8ae5448382830262399aa3ee3773d5e4e030f`

## Final Keyboard Behavior

Current test-branch target:
- direct/no-argument command: action.type=2, enter=true, canonical command data, no click_limit;
- parameterized/target/content command: action.type=2, enter=false, canonical command plus trailing space;
- pagination: action.type=2, enter=true;
- direct buttons must generate the ordinary QQ message path; callback-only execution is not accepted;
- parameterized buttons do not send until the user completes the input.

## All-Category Regression Coverage

The V4 regression enumerates every non-empty group category:
- 基础
- 群聊
- 记忆
- 活动
- 群规
- AI管理
- 群操作
- 群主
- 开发者

For every category/page it verifies:
- keyboard exists;
- <=5 rows;
- <=2 buttons per row;
- every enabled group-scoped command appears exactly once across category coverage;
- direct metadata maps to type=2 + enter=true normal command message;
- non-direct metadata maps to type=2 + enter=false editable prefill;
- click_limit is absent;
- transport serialization succeeds for every non-empty category.

## GitHub Actions

- development run `36522596708`: SUCCESS
- main run `36522715591`: SUCCESS

Passed:
- repository regression checks
- V3 regression checks
- V4 QQ Open regression checks
- isolated V4 test deployment checks
- single Worker bundle

## Cloudflare Production

Connected Build `ce40accb-f1f3-4824-b299-411e130e2573`:
- commit: `dea8ae5448382830262399aa3ee3773d5e4e030f`
- branch: `main`
- outcome: success

## Remaining Live Verification

Confirm in the QQ client:
1. help/status executes immediately and does not remain in the input box;
2. codex/翻译/禁言 prefills the input box;
3. at least one non-basic category renders its button card.

## 2026-10-01 Branch Verification

- branch: `fix/qq-panel-message-send-20261001`
- base main: `a1c19cf0d732fd576000c8ecb2753facf38c51e8`
- product patch commit: `821373fc1c7e32116b8f15cca69a38bc5a81545d`
- GitHub Actions run `36796984396`: SUCCESS
- passed: repository regression, V3 regression, V4 QQ Open regression, isolated V4 test-deployment checks, single Worker bundle
- main update: NOT PERFORMED
- live QQ send/reply smoke: PENDING
