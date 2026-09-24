# QQAI v3 Plugin Lifecycle Registry

The lifecycle registry uses one exact key: `plugin_lifecycle:registry:v1`. It never performs a prefix scan.

Each assembled plugin candidate persists installed/available metadata, plugin/API versions, desired and effective state, requested/granted/missing permissions, compatibility, block reason, and audit actor/timestamps.

Effective states are `enabled`, `disabled`, and `blocked`. Definitions remain registered as Host candidates, but only enabled records are activated. Enable runs `onLoad`; disable/block runs `onUnload`. Inactive plugins receive no events or commands and are omitted from public status.

Plugin API v1 currently treats every requested capability as required. Missing any requested permission while desired-enabled makes the plugin blocked. This is conservative until optional permissions are introduced.

Optional manifest `minQQAI` and `maxQQAI` bounds are checked in addition to Plugin API v1. Runtime activation failures are contained per plugin and persisted as a blocked state rather than crashing the V3 Host.

Inactive scheduled jobs are not deleted. When one becomes due, the centralized scheduler records a successful inactive skip and advances the schedule, avoiding repeated failure/retry churn.
