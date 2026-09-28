# GOTCHAS

## Retained

G-001 through G-055 remain relevant.

## G-056 QQ panel UI prefixes command text with slash
Risk: a panel item configured as `!面板 基础` can be presented/sent by QQ as `/!面板 基础`. This collides with QQAIBOT's pre-existing `/!` group AI-opt-out syntax.
Mitigation: normalize only the reserved `/!面板` transport form before generic opt-out parsing; regression-test both the positive panel path and the negative ordinary `/!` path.

## G-057 API-success does not prove live command dispatch
Risk: menu/panel creation tests can pass while the client sends a different command text shape.
Mitigation: keep transport normalization tests and require a live QQ click smoke test for discovery UI changes.
