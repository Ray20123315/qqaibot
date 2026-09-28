# GOTCHAS

## Retained

G-001 through G-048 remain relevant.

## G-049 Specific QQ panels can shadow general discovery
Risk: a `target_type=specific` panel set filtered to only privileged commands can make ordinary commands disappear for the privileged user if the QQ client prioritizes specific panels.
Mitigation: specific privileged panels must be cumulative and regression-tested against the lower-permission command set.

## G-050 Artificial panel caps can break cumulative visibility
Risk: inheriting lower-permission categories increases panel count; an internal cap below QQ's official 20-panel limit can reject otherwise valid discovery.
Mitigation: enforce the official 20-panel maximum and rely on discovery fingerprinting to avoid unnecessary resyncs.
