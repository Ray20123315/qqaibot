# GOTCHAS

## Retained

G-001 through G-050 remain relevant.

## G-051 Group panels cannot target one user
Risk: assuming `target_type=specific` can target a Developer inside a group leads to a design the QQ API does not support.
Mitigation: group panels are group-scoped; keep all group commands discoverable by category and enforce Developer/owner permissions at runtime.

## G-052 Privileged-only group filtering removes normal commands
Risk: building group discovery from only management permission classes makes ordinary commands appear missing to privileged users.
Mitigation: group discovery is generated from all permission classes and regression-tested against every enabled group-scoped command.

## G-053 Diverged feature branches must not overwrite main
Risk: a feature branch can be ahead in product work while also far behind current main; updating main directly to that ref can discard newer work.
Mitigation: compare from merge base, resolve overlaps, create a two-parent merge, validate on an integration branch, then non-force fast-forward main.

## G-054 CI can miss live Durable Object status paths
Risk: static/module regression suites may pass while a low-frequency live path references an undefined symbol.
Mitigation: after production deploy, always probe `/healthz` and require OneBot/NapCat status to execute successfully before completion.

## G-055 Preview namespace must never leak to production
Risk: defining `QQAI_DB_TABLE` in production would redirect normal traffic to the Preview table or mix namespaces unexpectedly.
Mitigation: read back production bindings after deploy and require `QQAI_DB_TABLE` to be absent.
