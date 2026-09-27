# VERIFY

## Retained Production Verification

- production V4 build and migration from v0.0.10 remain valid
- OneBotHub and QqOpenGateway remain deployed
- production bindings cleanup remains verified

## Secret Verification

Cloudflare secret-list read-back:
- `qqai-v4test`: `QQ_OPEN_CLIENT_SECRET` present
- `qqai`: `QQ_OPEN_CLIENT_SECRET` absent

No secret value is stored in this repository or memory package.

## Next Verification

After the user manually creates `QQ_OPEN_CLIENT_SECRET` on production `qqai`:
1. re-read secret names;
2. verify Gateway configured state;
3. connect and confirm READY;
4. test C2C/group `!qqping`;
5. test `!qqecho hello`.
