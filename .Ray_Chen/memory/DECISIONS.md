# DECISIONS

## Retained

D-001 through D-022 remain in force.

## D-023 Fully isolated V4 connectivity Worker
status: accepted
date: 2026-09-27
Decision: perform QQ Open connectivity testing on a separate `qqai-v4test` Worker with its own QqOpenGateway Durable Object and no production data bindings.

## D-024 Production Connected Builds must exclude the V4 branch
status: accepted
date: 2026-09-27
Decision: the production `qqai` non-production trigger excludes `v4-qqopen-native`. A dedicated Cloudflare Builds trigger attached to `qqai-v4test` owns V4 test deployments.

## D-025 No test Cron
status: accepted
date: 2026-09-27
Decision: because the account is already at the Workers Free 5-Cron limit, the isolated test Worker uses an explicit “連接 / 重試” action instead of a watchdog Cron.

## D-026 No test D1
status: accepted
date: 2026-09-27
Decision: because the account is at the 10-D1 limit and production data must remain isolated, the QQ connectivity test Worker does not bind any D1. No database is deleted to create capacity.
