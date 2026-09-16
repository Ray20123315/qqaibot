# QQAI D1 hot-read fix

Canonical task control: `ACTIVE_TASK.md`.
Current phase: implementation on `fix/d1-prefix-scan`.
Memory state: DIRTY.
Unique next step: replace the two scheduler prefix `LIKE` scans with indexable range queries, add regression verification, run repository checks, then consolidate memory and remove these temporary task-memory files before delivery.
