# QQAI v3 Official Bilibili Live Plugin

The first real scheduler-backed official plugin is a webhook-free Bilibili live-status provider. It is deliberately separate from the legacy Bilibili integration so v3 can validate the public Plugin API without changing production behavior.

## Why this shape

The legacy integration and the v3 plugin now share the same low-risk live-status direction: the batch live endpoint is used instead of the older per-UID `getRoomInfoOld` request. Video discovery remains a different risk profile and is handled separately.

The current design separates the concerns:

- live status: lightweight batch endpoint, default every 30 minutes
- video publishing: low-frequency WBI-signed archive lookup, with dynamic-feed compatibility fallback
- no webhook requirement
- no Bilibili login cookie requirement for the selected live-status endpoint
- optional `BILIBILI_COOKIE` is used only as browser-session context for compatibility requests
- API failure never flips a last-known live state to offline
- video-only risk control does not suspend live-status polling

## Provider

The plugin uses:

```text
GET https://api.live.bilibili.com/room/v1/Room/get_status_info_by_uids?uids[]=<mid>
```

Multiple configured creator UIDs are placed in one batch request. The provider record normalizes:

- `live_status`: `0` offline, `1` live, `2` rotating/looping
- room ID and watch URL
- title and creator name
- online count
- cover and keyframe
- area name
- live start time

Bilibili image URLs are normalized from `http://` to `https://` before state is exposed to a web UI.

This is a Bilibili web API rather than a long-term compatibility guarantee from an official public Open Platform contract. The plugin therefore treats provider data as fallible.

## AUTO / FORCE state

Each creator has one mode:

```text
auto
force_live
force_offline
```

`auto` uses the latest valid Bilibili snapshot. A force mode overrides the effective `live` flag while preserving `providerLive`, so administrators can still see what Bilibili last reported.

A future Portal/site control can write this same config instead of inventing a second live-state system.

## Failure fallback and provider backoff

The plugin uses three namespaced storage records:

```text
config
snapshot
health
```

If Bilibili returns an HTTP/API/parsing error:

- `snapshot` is not overwritten
- `health.ok` becomes false
- `consecutiveFailures` increments
- `lastError` is recorded
- effective rows become `stale: true`
- the last valid title/cover/room/live state remains available
- `nextPollNotBefore` prevents the scheduler from hammering a failing provider

Transient failures back off approximately 2, 5, 10, then 30 minutes. Risk-control responses such as HTTP 412/429 or Bilibili `-412` use a longer sequence of approximately 5, 15, 30, 60 minutes, then 3 and 6 hours. While backoff is active, cron checks return the stale last-good state without issuing another Bilibili request. A manual refresh may bypass ordinary transient backoff, but it does not bypass an active Bilibili risk-control block.

If a batch succeeds but one configured UID is missing, that creator's prior record is preserved and marked stale/partial instead of being interpreted as offline.

## Scheduler

On load, the plugin ensures one owned `live-poll` interval job. The default and minimum interval are 30 minutes; the maximum is 6 hours. This deliberately trades freshness for much lower provider risk and background-resource usage.

The job is owned by `official.bilibili-live`, so the v3 scheduler dispatches only that plugin's `onCron` hook.

The production Worker `scheduled()` handler calls `runV3RuntimeScheduled()`, so due plugin-owned jobs are dispatched through the V3 scheduler. The host cron remains minute-level, but Bilibili network fetches only occur when the plugin job is due or when an authorized manual refresh is requested.

## Control surface

The plugin already exposes API-level commands for testing/future routing:

```text
bili-live-status
bili-live-refresh
bili-live-mode <uid> auto|force_live|force_offline
```

Refresh and mode changes require an explicit `adminUserIds` allowlist supplied when the plugin is instantiated. The plugin is exported as a factory and is not automatically added to `OFFICIAL_BUNDLED_PLUGINS` until v3 has a real plugin settings/installation surface.

## Website / status endpoint integration

The live-status state is intentionally UI-agnostic. A later Portal or public site endpoint can expose the effective snapshot as `/api/status`, while browser JavaScript polls that QQAI endpoint every 20-30 seconds. Visitors should not call Bilibili directly.

Recommended flow:

```text
Cloudflare Cron (1 minute host cadence)
        |
Plugin Scheduler (Bilibili due every 30 minutes by default)
        |
Official Bilibili Live Plugin
        |
plugin storage: snapshot + health + AUTO/FORCE config
        |
future /api/status or Portal route
        |
browser UI refresh every 20-30 seconds
```

## YouTube follow-up

Under the current YouTube Data API granular quota model, `search.list` has its own default quota bucket of 100 calls/day. Polling every 15 minutes consumes 96 calls/day, leaving almost no operational headroom. The future YouTube provider should prefer roughly 20-minute polling (72 calls/day) or adaptive polling that becomes more frequent only near expected live windows.


## Video / dynamic polling

The live-status endpoint above is the preferred anonymous path because it does not require a login cookie. New-video discovery is a different risk profile and now prefers the WBI-signed archive endpoint:

```text
GET https://api.bilibili.com/x/space/wbi/arc/search?mid=<uid>&pn=1&ps=1&order=pubdate&wts=<unix>&w_rid=<md5>
```

QQAI obtains the current WBI image/sub keys from `/x/web-interface/nav`, caches them briefly, derives the mixin key, and signs the archive query. Dynamic-feed endpoints remain compatibility fallbacks.

A 412/429 from video discovery is isolated from live polling: the connector keeps the last video baseline, marks the check partial, and backs off video requests separately while the anonymous live-status checks continue. Existing connectors created by the older provider revision automatically clear the old long global block once so they can retry with the upgraded provider path.

If a deployment provides `BILIBILI_COOKIE`, it is sent only as browser-session context and must remain a Worker secret; it is never stored in plugin settings or returned by Portal APIs. A valid Cookie can help endpoints that expect browser state, but it does not guarantee success when Bilibili is rejecting the Worker egress IP or another request characteristic.
