# QQAI v3 TTS / Audio Output

The v3 TTS path separates speech synthesis from QQ transport so failures can be diagnosed at the correct stage.

## Pipeline

```text
text
  -> Gemini Interactions TTS
  -> normalized canonical audio part
  -> can_send_record capability probe
  -> OneBot record segment
  -> send_group_msg / send_private_msg
```

## Gemini API

QQAI v3 uses the current Gemini Interactions API instead of the legacy `generateContent + responseModalities` TTS path.

Request characteristics:

- endpoint: `POST /v1beta/interactions`
- API key is sent in `x-goog-api-key`, never in the request URL
- schema revision header: `Api-Revision: 2026-05-20`
- `response_format: { type: "audio", mime_type: "audio/wav", delivery: "inline" }`
- `generation_config.speech_config` selects the voice

If a provider still returns raw `audio/l16`, v3 wraps the PCM bytes in a mono/stereo 16-bit WAV container before handing the media to OneBot.

Generated audio is bounded before it becomes a canonical message part. Oversized or malformed audio fails with a stage-specific `TtsError` rather than being treated as a successful QQ voice message.

## Plugin API

`ctx.ai.tts(input)` requires the `ai.tts` capability and returns a result containing:

- `model`
- `voice`
- normalized audio metadata
- `part`, a canonical `{ kind: "audio", media: ... }` value

Generating speech does not grant permission to send it. A plugin still needs `media.send` plus a message-send capability to put the returned audio part onto QQ.

Example:

```js
const speech = await ctx.ai.tts({
  text: "大家好，這是 QQAI。",
  voice: "Kore"
});

await ctx.reply([speech.part]);
```

## NapCat / OneBot output guard

Before the first outbound canonical `audio` part for a Host Adapter instance, v3 calls `can_send_record`.

- explicit `false`: reject with `PLUGIN_AUDIO_SEND_UNAVAILABLE`
- explicit `true`: cache the positive result
- probe error / unknown response: log the diagnostic and attempt the real send instead of creating a false negative

The actual outbound segment remains standard OneBot:

```js
{
  type: "record",
  data: {
    file: "base64://..."
  }
}
```

No production deployment or runtime flag is enabled by this foundation step.
