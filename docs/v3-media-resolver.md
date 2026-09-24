# QQAI v3 Media Resolution Pipeline

Media resolution converts canonical message media references into bounded, AI-ready payloads instead of treating a NapCat file token or local path as successful media access.

Resolution order:

1. inline Base64 or public URL already present on the canonical part;
2. if a direct/signed URL is stale or rejected and a OneBot file token exists, refresh it through `get_image` / `get_record`;
3. OneBot file resolution (`get_group_file_url` where applicable);
4. message refresh through `get_msg` and match the original media part;
5. explicit failure such as `MEDIA_LOCAL_PATH_UNREACHABLE` or `MEDIA_UNRESOLVED`.

Forward bundles use `get_forward_msg` and are normalized into bounded canonical nodes.

Safety rules:

- image/audio/video limits reuse `AI_MEDIA_LIMITS` (8 MiB / 12 MiB / 25 MiB);
- Content-Length is checked when available and streaming reads are stopped once the byte cap is exceeded;
- kind-specific MIME checks reject obvious mismatches;
- callers inject `safeFetch`; production wiring must use QQAI SSRF-protected `fetchPublicUrl`;
- Cloudflare never dereferences NapCat-local Windows/POSIX paths;
- resolver traces store stage/action/error code only, never URLs, Base64, or local paths.
