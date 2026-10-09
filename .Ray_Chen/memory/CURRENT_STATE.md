# CURRENT_STATE

- Active GitHub main code revision: 5b36ddcd8106f4566fcc15f2c63706cd5febd8dc
- Original full legacy branch archive/legacy-main-20261009 revision 6a22b06433cfaffcf13abe2b60a917305290b629
- Latest parallel-v3 Worker deployed Cloudflare qqai deployment 11d869b9-a305-4e0a-ad60-7be82a616293, Worker version 77ce16ed-350d-4b7f-ad55-e8c2309f4d01, 100%, main build success
- Latest code main CI 37966044948 SUCCESS; feature CI 37965979192 SUCCESS; prior parallel core CI 37965452837 SUCCESS
- Bbot-only: QQ Open Platform API and Abot remain disabled
- OneBotHub canonical ID now bridge-bbot-parallel-v3 in shared src/bbot-hub.js, not bridge-bbot-napcat-v2
- Inbound message relays to target groups in parallel up to 4 groups, preserved within-group FIFO, native OneBot segment message batches, ACK required, pending outbox retained offline
- Old hot OneBotHub returned /flush 404 immediately following first parallel deployment. New hub ID fix is deployed, but old WS must be disconnected/reconnected by user.
- Live bbot.connected state and QQ E2E 3-group timings UNKNOWN after new deployment.
