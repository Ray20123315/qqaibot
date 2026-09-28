# DECISIONS

## Retained

D-001 through D-061 remain in force.

## D-062 QQ group panel slash is a reserved transport form
status: accepted
date: 2026-09-29
Decision: QQ-rendered `/!面板 ...` is normalized into the internal `!面板 ...` category router before generic group `/!` opt-out parsing.

## D-063 Generic /! semantics are preserved
status: accepted
date: 2026-09-29
Decision: the slash normalization is intentionally narrow. Inputs such as `/!普通内容` keep the existing explicit AI-bypass behavior and are never promoted into commands merely because a panel fix exists.
