# GOTCHAS

## Retained

Prior transport, identity, user-storage, political and plugin risks remain relevant.

## G-049 Runtime error text must not over-quarantine
Risk: treating every plugin exception as malicious would disable benign plugins for normal bugs.
Mitigation: quarantine requires explicit security violation metadata or narrow recognized global-risk codes.

## G-050 Runtime block and persistent lifecycle must agree
Risk: removing only the in-memory plugin would allow it to return after host restart.
Mitigation: runtime security boundary also calls lifecycle.markRuntimeBlocked and writes a security-center record.
