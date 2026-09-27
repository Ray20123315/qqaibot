# QQ Open V4 isolated test Worker

The `qqai-v4test` Worker exists only to prove QQ Open Gateway connectivity and native passive replies before production cutover.

## Isolation

`wrangler.v4test.toml` intentionally has:

- no production custom domains or routes;
- no D1 binding;
- no Vectorize binding;
- no OneBot Durable Object;
- its own `QqOpenGateway` Durable Object namespace/migration;
- a workers.dev/preview URL only;
- a one-minute test-only watchdog.

The test entrypoint is `worker.v4test.js`, not `worker.js`.

## Credentials

The test config contains only the non-secret AppID and the basic C2C/group-at intent.

Set the following Secret on **qqai-v4test only**:

```text
QQ_OPEN_CLIENT_SECRET
```

Never place the AppSecret in GitHub, Wrangler vars, Ray_Chen memory, or deployment logs.

## Smoke test

Open the `qqai-v4test` workers.dev URL. It reports `OFFLINE / CONNECTING / CONNECTED / READY`.

When READY:

- C2C: `!qqping`
- group: `@机器人 !qqping`
- echo: `!qqecho hello`

The Gateway runtime replies natively through QQ OpenAPI. No production QQAIBOT database is used.
