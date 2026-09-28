# GOTCHAS

## Retained

G-001 through G-059 remain relevant.

## G-060 Inline keyboard payload limits require pagination
Risk: a large command category can exceed QQ keyboard row/button limits.
Mitigation: use two command buttons per row, at most five rows, and reserve navigation space by paging large categories.

## G-061 Keyboard fallback must not duplicate ambiguous writes
Risk: retrying a keyboard message as text after timeout/5xx can duplicate a message that QQ actually accepted.
Mitigation: text fallback is allowed only for deterministic keyboard/capability 4xx responses; ambiguous failures propagate without a second write.

## G-062 Feature branches can become stale during validation
Risk: main can gain unrelated security fixes while a UX feature is still being validated.
Mitigation: compare branch histories immediately before promotion, merge newest main as first parent, preserve concurrent file changes explicitly, and rerun full CI.
