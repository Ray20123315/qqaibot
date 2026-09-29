# VERIFY

## Verified Product Revision

`dea8ae5448382830262399aa3ee3773d5e4e030f`

## Final Keyboard Behavior

- direct/no-argument command: reusable action.type=1 callback, no click_limit;
- parameterized/target/content command: action.type=2, enter=false, canonical command plus trailing space;
- pagination: reusable callback;
- callback path: INTERACTION_CREATE is ACKed before canonical command execution;
- parameterized buttons do not invoke a handler until the user completes and sends the input.

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
- direct metadata maps to type=1 callback;
- non-direct metadata maps to type=2 editable prefill;
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
