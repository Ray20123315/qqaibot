# VERIFY

## QQ Open User Persistence

Verified commit: `38b5cbac605e8add9c25e28a8375dea3d6052bb5`
GitHub Actions run: `36387088840`
Conclusion: success

Passed:
- npm run check
- npm run check:v3
- npm run check:v4
- npm run check:v4test
- npm run check:bundle

`verify-v4-user-persistence-routing.mjs` asserts:
- QQ Open detection and canonical principal format;
- private history module uses User Persistence read/write/delete;
- USER_STORAGE_REQUIRED has no platform fallback;
- worker reads QQ Open private history through user storage;
- worker writes QQ Open private history through user storage;
- QQ Open group chat-history branch has no appendChatHistoryTurn/dbPut;
- platform group-content persistence block is disabled for QQ Open;
- QQ Open clear-session routes through user storage.

## Pending

- plugin security center UI modernization
- same-Worker Cloudflare Preview
- remaining QQ Open persistent-setting audit
- QQ self-test workbook
