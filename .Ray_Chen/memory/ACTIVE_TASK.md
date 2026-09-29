# ACTIVE_TASK

task_id: qqaibot-20260929-interaction-timeout-fix
task_status: active
goal_revision: 1

## Goal

Stop all QQ inline-keyboard callbacks from timing out.

## Confirmed Evidence

- production Worker binding read-back: `QQ_OPEN_INTENTS=33554432`;
- Tencent SDK: `GROUP_MESSAGES=1<<25`, `INTERACTION=1<<26`;
- current runtime default is also only `1<<25`;
- button callback requires `INTERACTION_CREATE` and immediate `PUT /interactions/{id}` ACK.

## Acceptance Criteria

- production/test/default intents are `100663296`;
- regression tests assert `INTERACTION` is included;
- previous tests that required interaction to remain opt-in are corrected;
- runtime reports configured/connected intents;
- a live socket created with stale intents is replaced when configured intents change;
- callback ACK endpoint/body remains official `PUT /interactions/{id}` + `{"code":0}`;
- keyboard payload fix remains intact;
- full CI and production deployment pass;
- production binding read-back shows `100663296`.

## next_exact_action

Implement intent mask + reconnect-on-intent-change and run CI.

last_checkpoint_at: 2026-09-29T09:55:00+08:00
