# VERIFY

Pending verification gates:
- Static regression verifier passes.
- Existing `npm run check` passes.
- `npm run check:bundle` passes (Wrangler dry-run only; must not deploy).
- Git diff contains no unrelated behavior changes.
- Query text no longer contains the two known scheduler prefix LIKE scans.
- Prefix range boundaries include exactly the intended ASCII prefixes.

Runtime verification after deployment (not executable from current tools):
- D1 Query Insights should show drastic reduction in rows read for both cleanup queries.
- `EXPLAIN QUERY PLAN` should show indexed SEARCH/MULTI-INDEX OR rather than full SCAN where applicable.
