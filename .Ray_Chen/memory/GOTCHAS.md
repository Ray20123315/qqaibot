# GOTCHAS

## Retained

Previous QQ Open, OpenID, gateway lifecycle, reconnect, Portal animation, pruning, permission, and principal-identity risks remain in force.

## G-020 Cloudflare Connected Builds overrides Worker name
Risk: a non-production trigger attached to `qqai` overrides a different `name` from Wrangler config back to `qqai`, which could target the production Worker.
Avoidance: exclude `v4-qqopen-native` from the production trigger and attach the branch to a distinct `qqai-v4test` Worker trigger.

## G-021 Account D1 limit
Risk: account currently has 10 D1 databases; creating another returns error 7406.
Avoidance: do not delete unrelated databases. The isolated QQ connectivity Worker has no D1 binding.

## G-022 Account Cron limit
Risk: account currently has all 5 Free-plan Cron triggers allocated; adding a test Cron returns error 10072.
Avoidance: no Cron in `wrangler.v4test.toml`; use the manual connection endpoint/button.

## G-023 GitHub deploy credentials are not configured
Risk: the repo does not currently expose `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` to GitHub Actions.
Avoidance: deployment is owned by the isolated Cloudflare Builds trigger, not GitHub Actions.
