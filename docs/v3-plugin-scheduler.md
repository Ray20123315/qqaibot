# QQAI v3 Plugin Scheduler

QQAI v3 plugins need scheduled code execution, not only the legacy feature that sends a group message at a chosen time. The plugin scheduler is therefore isolated from the existing user-facing group scheduler.

## Plugin API

A plugin declaring the `scheduler` capability receives:

```js
const job = await ctx.scheduler.create({
  name: "poll",
  intervalMs: 5 * 60 * 1000,
  payload: { channel: "example" }
});

const jobs = await ctx.scheduler.list();
const sameJob = await ctx.scheduler.get(job.id);
await ctx.scheduler.cancel(job.id);
```

When a due job runs, only the owning plugin receives `onCron`:

```js
async function onCron(ctx, event) {
  // event.jobId
  // event.name
  // event.payload
  // event.scheduledAt
  // event.runCount
  // event.attempt
}
```

Cron events are targeted. They are never broadcast to all installed plugins.

## Supported schedules

Initial Plugin API v1 supports:

- one-time `runAt` / `at`
- one-time `delayMs`
- recurring `intervalMs` / `everyMs`

Recurring intervals are bounded to 1 minute through 30 days. This matches the Cloudflare cron host's practical cadence while preventing plugins from creating sub-minute polling loops.

Calendar-style cron expressions are intentionally not part of the first runtime contract. They can be added later without changing ownership or dispatch semantics.

## Ownership boundary

Every job stores its owning `pluginId`. Public scheduler methods automatically apply that ID:

- a plugin can list only its own jobs
- `get()` returns `null` for another plugin's job
- `cancel()` cannot cancel another plugin's job
- due execution dispatches only to the stored owner

Plugin jobs use exact D1/KV-style keys:

```text
plugin_scheduler:index
plugin_scheduler:due
plugin_scheduler:job:<job-id>
```

The runtime does not use prefix `LIKE` scans.

## Reliability

The scheduler includes:

- per-plugin active-job limit: 100 by default
- global index limit: 5000 by default
- JSON payload limit: 16 KiB by default
- execution timeout: 25 seconds by default
- execution lease: 60 seconds by default
- bounded retry backoff after failures
- automatic pause after five consecutive failures
- interval cadence preservation after retries

A lease token is written before execution. A stale completion cannot overwrite a job if its lease has changed.

## Host integration

`createV3HostAdapter()` exposes `runDuePluginJobs(options)`. This calls the scheduler runtime and performs a targeted `host.dispatchTo(pluginId, "cron", event)`.

This foundation step does **not** connect `runDuePluginJobs()` to the production Cloudflare Worker scheduled handler. Production execution remains disabled until the v3 bootstrap/cutover phase explicitly wires and validates that entrypoint.


## D1 row-read guard

`runDue()` no longer walks the global job index on every cron tick. `plugin_scheduler:due` stores only job IDs plus their next-run timestamps in one exact-key row. A normal minute with no due jobs reads that single row and does not fetch any job records.

When upgrading from an older v3 scheduler state that has jobs but no due index, the first `runDue()` performs a one-time repair from `plugin_scheduler:index` and persists the due index. Subsequent empty ticks stay at one exact-key read. Create/cancel/retry/completion keep the due index synchronized.

`plugin_scheduler:index` remains for management operations such as list/limits; it is no longer the cron execution scan path.
