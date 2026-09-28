# GOTCHAS

## Retained

G-001 through G-050 remain relevant.

## G-051 Group panels cannot target one user
Risk: assuming `target_type=specific` can target a Developer inside a group leads to a design the QQ API does not support.
Mitigation: group panels are group-scoped; keep all group commands discoverable by category and enforce Developer/owner permissions at runtime.

## G-052 Privileged-only group filtering removes normal commands
Risk: building group discovery from only management permission classes makes ordinary commands appear missing to privileged users.
Mitigation: group discovery is generated from all permission classes and regression-tested against every enabled group-scoped command.
