# VERIFY

## V4 Lean Portal / QQ Open Verification

- branch: `v4-qqopen-native`
- latest verified product commit: `75483f71fb0707043082f891851581f03ac2c15c`
- final product CI run: `36327804832`
- repository regression: success
- V3 regression: success
- V4 regression: success
- Worker bundle dry-run: success
- changed-file remote read-back: success

## V4 Coverage Added

- lean Portal style/script injection.
- six primary V4 navigation labels.
- forced V4 Overview landing instead of legacy-hash landing.
- reduced-motion CSS.
- authenticated QQ Open Portal status/connect/disconnect wiring.
- group members / blacklist / join request / mute Portal routes.
- media upload routes for group and C2C.
- QQ Open group-management API paths/methods.
- Codex principal-scoped direct session source assertions.
- Codex Bridge EXE test updated for the principal session model.
- retired activity/vote/schedule V4 registry surface.

## External Capability Verification

QQ official message overview confirms:
- C2C/group send and receive.
- `msg_type=0` text.
- `msg_type=2` Markdown send.
- `msg_type=7` rich media send/receive.
- images, video, voice/audio, files use upload → `file_info` → message.

QQ official changelog confirms:
- 2026-09-03 member list/info, batch removal, blacklist query/update.
- 2026-08-10 mute management, join request list/review, join request event.
- 2026-08-12 custom menus and command panels.

## Verification Limitations

- No deployed-browser visual screenshot/interaction test was run.
- No real QQ Open group/member/media request was sent with production credentials.
- QQ permission-dependent endpoints remain unverified for the user's specific app.
- Legacy rollback code/data is intentionally still present.

## Live Verification Still Required

1. Configure QQ Open credentials only in Cloudflare variable/secret storage.
2. Deploy the V4 branch to a safe test/cutover context.
3. Visually inspect desktop/mobile Portal and Gateway online state.
4. Verify real member list, join approve/decline+blacklist, blacklist, mute/unmute.
5. Send/receive image and video (plus file/audio as practical).
6. Verify principal identity behavior across C2C/group.
7. Only then perform physical legacy-code deletion.
