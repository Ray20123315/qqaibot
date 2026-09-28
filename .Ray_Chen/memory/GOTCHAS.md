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


## G-063 Text fallback can mask invalid keyboard payloads
Risk: a deterministic QQ 4xx on a malformed keyboard can be followed by a successful text fallback, making the feature look superficially functional while no buttons render.
Mitigation: expose keyboard-specific error/fallback diagnostics and treat live text-only rendering as a failed keyboard smoke test.

## G-064 Inline keyboard button defaults are not safely omittable
Risk: sending only action.type/action.data may pass local structural tests but differ from Tencent's official serialization and be rejected by QQ.
Mitigation: explicitly include permission.type=2, click_limit=1 and group_id in every custom callback button and preserve them in runtime normalization.

## G-065 QQ keyboard E2E uses Markdown payloads
Risk: attaching a keyboard to a plain text msg_type=0 body can be rejected even when the keyboard object itself is well-formed.
Mitigation: send keyboard-bearing C2C/group replies as msg_type=2 with markdown.content, retaining passive-reply IDs/sequences.
